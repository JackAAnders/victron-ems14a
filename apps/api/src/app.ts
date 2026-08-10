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
  FeedInConstraint,
  ForbiddenFeedInWriteError,
  ForbiddenGridWriteError,
  GridConstraint,
} from "@victron-ems14a/safety";
import { InMemoryVictronGateway } from "@victron-ems14a/victron-mqtt";

export interface AppState {
  grid: GridConstraint;
  feedIn: FeedInConstraint;
  gateway: InMemoryVictronGateway;
  wish: UserComfortWish;
  audits: AuditEvent[];
}

export function createAppState(): AppState {
  const grid = new GridConstraint();
  grid.applySignal("system", {
    source: "aux",
    mode: "limited",
    maxSteuveGridKw: 4.2,
    receivedAt: new Date().toISOString(),
  });
  const feedIn = new FeedInConstraint();
  feedIn.applySignal("system", {
    source: "rundsteuerung",
    mode: "curtailed",
    maxFeedInPercent: 0.6,
    receivedAt: new Date().toISOString(),
  });
  return {
    grid,
    feedIn,
    gateway: new InMemoryVictronGateway({
      auxLimited: true,
      limitKw: 4.2,
      feedInCurtailed: true,
      feedInPercent: 0.6,
      state: {
        pvKw: 5,
        pvRatedKw: 10,
        houseLoadKw: 0.5,
        batterySocPercent: 50,
        batteryPowerKw: 0,
        gridPowerKw: 0,
      },
    }),
    wish: {
      wallboxKw: 7,
      heatPump: { preferOn: true, preferredLevel: 2 },
    },
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
        const plant = await state.gateway.readPlantState();
        const rated = plant.pvRatedKw ?? 10;
        send(res, 200, {
          grid: {
            ...state.grid.getSnapshot(),
            ceilingKw: state.grid.getCeilingKw(),
            writableByEnduser: false,
            law: "EnWG §14a",
          },
          feedIn: {
            ...state.feedIn.getSnapshot(),
            maxFeedInKw: state.feedIn.getMaxFeedInKw(rated),
            writableByEnduser: false,
            law: "EEG §9",
          },
          wish: state.wish,
          lastSetpoints: state.gateway.lastSetpoints,
        });
        return;
      }

      if (req.method === "POST" && url.pathname === "/grid/signal") {
        assertCan(role, "grid:write");
        const body = (await readJson(req)) as {
          source: "aux" | "eebus" | "steuerbox" | "rundsteuerung" | "manual_installer";
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

      if (req.method === "POST" && url.pathname === "/feedin/signal") {
        assertCan(role, "grid:write");
        const body = (await readJson(req)) as {
          source: "aux" | "eebus" | "steuerbox" | "rundsteuerung" | "manual_installer";
          mode: "normal" | "curtailed" | "zero";
          maxFeedInPercent?: number;
          maxFeedInKw?: number;
        };
        const audit = state.feedIn.applySignal(role, {
          ...body,
          receivedAt: new Date().toISOString(),
        });
        state.audits.push(audit);
        const plant = await state.gateway.readPlantState();
        send(res, 200, {
          ok: true,
          maxFeedInKw: state.feedIn.getMaxFeedInKw(plant.pvRatedKw ?? 10),
        });
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
        const gridSignal = await state.gateway.readGridSignal();
        if (gridSignal) {
          state.audits.push(state.grid.applySignal("system", gridSignal));
        }
        const feedInSignal = await state.gateway.readFeedInSignal();
        if (feedInSignal) {
          state.audits.push(state.feedIn.applySignal("system", feedInSignal));
        }
        const ceilingKw = state.grid.getCeilingKw();
        const maxFeedInKw = state.feedIn.getMaxFeedInKw(plant.pvRatedKw ?? 10);
        const finiteCeiling = Number.isFinite(ceilingKw)
          ? ceilingKw
          : DEFAULT_SAFETY_LIMITS.maxWallboxKw + DEFAULT_SAFETY_LIMITS.maxHeatPumpKw;
        const requested = allocateUnderCeiling({
          ceilingKw: finiteCeiling,
          maxFeedInKw,
          state: plant,
          wish: state.wish,
          limits: DEFAULT_SAFETY_LIMITS,
        });
        const pvSurplusKw = Math.max(0, plant.pvKw - plant.houseLoadKw);
        const guarded = enforceActuatorGuard({
          role: "system",
          requested,
          gridCeilingKw: Number.isFinite(ceilingKw) ? ceilingKw : Number.POSITIVE_INFINITY,
          maxFeedInKw,
          limits: DEFAULT_SAFETY_LIMITS,
          pvSurplusKw,
          preferHeatPumpLevel: state.wish.heatPump?.preferredLevel,
        });
        state.audits.push(...guarded.audits);
        await state.gateway.applySetpoints(guarded.effective);
        send(res, 200, {
          ceilingKw,
          maxFeedInKw,
          effective: guarded.effective,
          deniedBypass: guarded.deniedBypass,
        });
        return;
      }

      send(res, 404, { error: "not_found" });
    } catch (err) {
      if (err instanceof ForbiddenGridWriteError || err instanceof ForbiddenFeedInWriteError) {
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
