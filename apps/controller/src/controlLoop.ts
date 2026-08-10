import {
  DEFAULT_SAFETY_LIMITS,
  type AuditEvent,
  type PowerSetpoints,
  type SafetyLimits,
  type UserComfortWish,
} from "@victron-ems14a/domain";
import type { HeatPumpAdapter } from "@victron-ems14a/heatpump";
import { allocateUnderCeiling, computePvSurplusKw } from "@victron-ems14a/rules";
import {
  enforceActuatorGuard,
  FeedInConstraint,
  GridConstraint,
} from "@victron-ems14a/safety";
import type { VictronGateway } from "@victron-ems14a/victron-mqtt";
import type { WallboxAdapter } from "@victron-ems14a/wallbox";

export interface ControlLoopOptions {
  gateway: VictronGateway;
  wallbox?: WallboxAdapter;
  heatPump?: HeatPumpAdapter;
  gridConstraint?: GridConstraint;
  feedInConstraint?: FeedInConstraint;
  limits?: SafetyLimits;
  wish?: UserComfortWish;
  previousWallboxKw?: number;
}

export interface ControlTickResult {
  ceilingKw: number;
  maxFeedInKw: number;
  pvSurplusKw: number;
  requested: PowerSetpoints;
  effective: PowerSetpoints;
  audits: AuditEvent[];
}

/**
 * One control cycle: §14a grid + EEG §9 feed-in → allocate → guard → actuators.
 */
export async function runControlTick(
  opts: ControlLoopOptions,
): Promise<ControlTickResult> {
  const grid = opts.gridConstraint ?? new GridConstraint();
  const feedIn = opts.feedInConstraint ?? new FeedInConstraint();
  const limits = opts.limits ?? DEFAULT_SAFETY_LIMITS;
  const wish = opts.wish ?? {};
  const audits: AuditEvent[] = [];

  const gridSignal = await opts.gateway.readGridSignal();
  if (gridSignal) {
    audits.push(grid.applySignal("system", gridSignal));
  }

  const feedInSignal = await opts.gateway.readFeedInSignal();
  if (feedInSignal) {
    audits.push(feedIn.applySignal("system", feedInSignal));
  }

  const state = await opts.gateway.readPlantState();
  const ceilingKw = grid.getCeilingKw();
  const rated = state.pvRatedKw ?? Math.max(state.pvKw, 1);
  const maxFeedInKw = feedIn.getMaxFeedInKw(rated);

  const pvSurplusKw = computePvSurplusKw(state.pvKw, state.houseLoadKw, {
    hysteresisKw: 0.4,
    previousTargetKw: opts.previousWallboxKw,
  });

  const requested = allocateUnderCeiling({
    ceilingKw: Number.isFinite(ceilingKw)
      ? ceilingKw
      : limits.maxWallboxKw + limits.maxHeatPumpKw,
    maxFeedInKw,
    state,
    wish: {
      ...wish,
      priority: wish.priority ?? {
        heatPump: 3,
        wallbox: 2,
        batteryGridCharge: 1,
      },
      heatPump: { preferOn: true, ...wish.heatPump },
    },
    limits,
  });

  const guarded = enforceActuatorGuard({
    role: "system",
    requested,
    gridCeilingKw: Number.isFinite(ceilingKw) ? ceilingKw : Number.POSITIVE_INFINITY,
    maxFeedInKw,
    limits,
    pvSurplusKw,
    preferHeatPumpLevel: wish.heatPump?.preferredLevel,
  });
  audits.push(...guarded.audits);

  await opts.gateway.applySetpoints(guarded.effective);
  if (opts.wallbox) {
    await opts.wallbox.setChargeKw(guarded.effective.wallboxKw);
  }
  if (opts.heatPump) {
    await opts.heatPump.apply(guarded.effective.heatPump);
  }

  return {
    ceilingKw,
    maxFeedInKw,
    pvSurplusKw,
    requested,
    effective: guarded.effective,
    audits,
  };
}
