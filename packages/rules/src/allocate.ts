import type {
  PlantState,
  PowerSetpoints,
  SafetyLimits,
  UserComfortWish,
} from "@victron-ems14a/domain";

export interface AllocateInput {
  ceilingKw: number;
  state: PlantState;
  wish: UserComfortWish;
  limits: SafetyLimits;
  now?: Date;
}

/**
 * Propose setpoints under a known ceiling.
 * Priority default: heat pump > wallbox (if deadline soon) > battery grid charge.
 * Final enforcement remains in ActuatorGuard.
 */
export function allocateUnderCeiling(input: AllocateInput): PowerSetpoints {
  const { ceilingKw, state, wish, limits } = input;
  const now = input.now ?? new Date();
  const pvSurplusKw = Math.max(0, state.pvKw - state.houseLoadKw);

  const priority = wish.priority ?? {
    heatPump: 3,
    wallbox: 2,
    batteryGridCharge: 1,
  };

  let deadlineBoost = 0;
  if (wish.wallboxReadyBy) {
    const ready = new Date(wish.wallboxReadyBy).getTime();
    const hours = (ready - now.getTime()) / 3_600_000;
    if (hours >= 0 && hours <= 8) deadlineBoost = 2;
  }

  const wallboxPriority = priority.wallbox + deadlineBoost;
  const hpMax = limits.maxHeatPumpKw;
  const wbMax = Math.min(limits.maxWallboxKw, wish.wallboxKw ?? limits.maxWallboxKw);

  // Battery must not grid-charge below SoC floor or above ceiling.
  const canGridChargeBatt =
    state.batterySocPercent >= limits.socFloorPercent &&
    state.batterySocPercent < limits.socCeilingPercent;

  const budget = ceilingKw + pvSurplusKw;
  let remaining = budget;

  const order = [
    { key: "heatPumpKw" as const, prio: priority.heatPump, max: hpMax },
    { key: "wallboxKw" as const, prio: wallboxPriority, max: wbMax },
    {
      key: "batteryGridChargeKw" as const,
      prio: priority.batteryGridCharge,
      max: canGridChargeBatt ? limits.maxBatteryGridChargeKw : 0,
    },
  ].sort((a, b) => b.prio - a.prio);

  const out: PowerSetpoints = {
    heatPumpKw: 0,
    wallboxKw: 0,
    batteryGridChargeKw: 0,
  };

  for (const item of order) {
    const take = Math.min(item.max, Math.max(0, remaining));
    out[item.key] = take;
    remaining -= take;
  }

  return out;
}
