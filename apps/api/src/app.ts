import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  DEFAULT_SAFETY_LIMITS,
  type AuditEvent,
  type Role,
  type UserComfortWish,
} from "@victron-ems14a/domain";
import { assertCan } from "@victron-ems14a/rbac";
import { allocateUnderCeiling } from "@victron-ems14a/rules";
import {
  enforceActuatorGuard,
  ForbiddenGridWriteError,
  GridConstraint,
} from "@victron-ems14a/safety";
import { InMemoryVictronGateway } from "@victron-ems14a/victron-mqtt";

export interface AppState {
  grid: GridConstraint;
  gateway: InMemoryVictronGateway;
  wish: UserComfortWish;
  audits: AuditEvent[];
}

export function createAppState(): AppState {
  return {
    grid: new GridConstraint(),
    gateway: new InMemoryVictronGateway({ auxLimited: true, limitKw: 4.2 }),
    wish: { wallboxKw: 7 },
    audits: [],
  };
}

function roleFrom(req: IncomingMessage): Role {
  const header = req.headers["x-role"];
  const value = Array.isArray(header) ? header[0] : header;
  if (value === "installer" || value === "system" || value === "enduser") {
    return value;
  }
  return "enduser";
}

async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

export function createServerForState(state: AppState) {
  return createServer(async (req, res) => {
    try {
      const role = roleFrom(req);
      const url = new URL(req.url ?? "/", "http://localhost");

      if (req.method === "GET" && url.pathname === "/health") {
        send(res, 200, { ok: true });
        return;
      }

      if (req.method === "GET" && url.pathname === "/status") {
        assertCan(role, "status:read");
        const signal = state.grid.getSnapshot();
        send(res, 200, {
          grid: {
            ...signal,
            ceilingKw: state.grid.getCeilingKw(),
            writableByEnduser: false,
          },
          wish: state.wish,
          lastSetpoints: state.gateway.lastSetpoints,
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/grid/signal") {
        assertCan(role, "grid:write");
        const body = (await readJson(req)) as {
          source: "aux" | "eebus" | "steuerbox" | "manual_installer";
          mode: "normal" | "limited" | "off";
          maxSteuveGridKw: number;
        };
        const audit = state.grid.applySignal(role, {
          ...body,
          receivedAt: new Date().toISOString(),
        });
        state.audits.push(audit);
        send(res, 200, { ok: true, ceilingKw: state.grid.getCeilingKw() });
        return;
      }

      if (req.method === "PUT" && url.pathname === "/comfort") {
        assertCan(role, "comfort:write");
        const body = (await readJson(req)) as UserComfortWish;
        state.wish = { ...state.wish, ...body };
        send(res, 200, { ok: true, wish: state.wish });
        return;
      }

      if (req.method === "POST" && url.pathname === "/control/tick") {
        assertCan(role, "status:read");
        const plant = await state.gateway.readPlantState();
        const signal = await state.gateway.readGridSignal();
        if (signal) {
          state.audits.push(state.grid.applySignal("system", signal));
        }
        const ceilingKw = state.grid.getCeilingKw();
        const finiteCeiling = Number.isFinite(ceilingKw)
          ? ceilingKw
          : DEFAULT_SAFETY_LIMITS.maxWallboxKw + DEFAULT_SAFETY_LIMITS.maxHeatPumpKw;
        const requested = allocateUnderCeiling({
          ceilingKw: finiteCeiling,
          state: plant,
          wish: state.wish,
          limits: DEFAULT_SAFETY_LIMITS,
        });
        const pvSurplusKw = Math.max(0, plant.pvKw - plant.houseLoadKw);
        const guarded = enforceActuatorGuard({
          role: "system",
          requested,
          gridCeilingKw: Number.isFinite(ceilingKw) ? ceilingKw : Number.POSITIVE_INFINITY,
          limits: DEFAULT_SAFETY_LIMITS,
          pvSurplusKw,
        });
        state.audits.push(...guarded.audits);
        await state.gateway.applySetpoints(guarded.effective);
        send(res, 200, {
          ceilingKw,
          effective: guarded.effective,
          deniedBypass: guarded.deniedBypass,
        });
        return;
      }

      send(res, 404, { error: "not_found" });
    } catch (err) {
      if (err instanceof ForbiddenGridWriteError) {
        state.audits.push(err.audit);
        send(res, 403, { error: "forbidden_grid_write", audit: err.audit });
        return;
      }
      if (err instanceof Error && err.name === "ForbiddenError") {
        state.audits.push({
          kind: "forbidden_write",
          at: new Date().toISOString(),
          detail: { message: err.message },
        });
        send(res, 403, { error: "forbidden", message: err.message });
        return;
      }
      send(res, 500, {
        error: "internal",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });
}
