import {
  DEFAULT_SAFETY_LIMITS,
  type AuditEvent,
  type PowerSetpoints,
  type SafetyLimits,
  type UserComfortWish,
} from "@victron-ems14a/domain";
import { allocateUnderCeiling, computePvSurplusKw } from "@victron-ems14a/rules";
import {
  enforceActuatorGuard,
  GridConstraint,
} from "@victron-ems14a/safety";
import type { VictronGateway } from "@victron-ems14a/victron-mqtt";
import type { WallboxAdapter } from "@victron-ems14a/wallbox";

export interface ControlLoopOptions {
  gateway: VictronGateway;
  wallbox?: WallboxAdapter;
  gridConstraint?: GridConstraint;
  limits?: SafetyLimits;
  wish?: UserComfortWish;
  /** Sticky surplus hysteresis state. */
  previousWallboxKw?: number;
}

export interface ControlTickResult {
  ceilingKw: number;
  pvSurplusKw: number;
  requested: PowerSetpoints;
  effective: PowerSetpoints;
  audits: AuditEvent[];
}

/**
 * One control cycle: read grid signal as system → allocate → guard → apply.
 */
export async function runControlTick(
  opts: ControlLoopOptions,
): Promise<ControlTickResult> {
  const grid = opts.gridConstraint ?? new GridConstraint();
  const limits = opts.limits ?? {
    ...DEFAULT_SAFETY_LIMITS,
    maxHeatPumpKw: 0, // MultiPlus + Wallbox reference plant
  };
  const wish = opts.wish ?? {};
  const audits: AuditEvent[] = [];

  const signal = await opts.gateway.readGridSignal();
  if (signal) {
    audits.push(grid.applySignal("system", signal));
  }

  const state = await opts.gateway.readPlantState();
  const ceilingKw = grid.getCeilingKw();
  const pvSurplusKw = computePvSurplusKw(state.pvKw, state.houseLoadKw, {
    hysteresisKw: 0.4,
    previousTargetKw: opts.previousWallboxKw,
  });

  const requested = allocateUnderCeiling({
    ceilingKw: Number.isFinite(ceilingKw)
      ? ceilingKw
      : limits.maxWallboxKw + limits.maxHeatPumpKw,
    state,
    wish: {
      priority: { heatPump: 0, wallbox: 3, batteryGridCharge: 1 },
      ...wish,
    },
    limits,
  });

  const guarded = enforceActuatorGuard({
    role: "system",
    requested,
    gridCeilingKw: Number.isFinite(ceilingKw) ? ceilingKw : Number.POSITIVE_INFINITY,
    limits,
    pvSurplusKw,
  });
  audits.push(...guarded.audits);

  await opts.gateway.applySetpoints(guarded.effective);
  if (opts.wallbox) {
    await opts.wallbox.setChargeKw(guarded.effective.wallboxKw);
  }

  return {
    ceilingKw,
    pvSurplusKw,
    requested,
    effective: guarded.effective,
    audits,
  };
}
