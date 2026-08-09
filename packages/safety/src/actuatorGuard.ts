import {
  heatPumpCommandFromPower,
  type AuditEvent,
  type PowerSetpoints,
  type Role,
  type SafetyLimits,
} from "@victron-ems14a/domain";

export interface GuardInput {
  requested: PowerSetpoints;
  gridCeilingKw: number;
  /** EEG §9 absolute export cap (Infinity = none). */
  maxFeedInKw?: number;
  limits: SafetyLimits;
  /** Optional PV surplus that may feed steuVE without counting against grid ceiling. */
  pvSurplusKw?: number;
  role: Role;
  preferHeatPumpLevel?: number;
}

export interface GuardResult {
  effective: PowerSetpoints;
  deniedBypass: boolean;
  audits: AuditEvent[];
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Enforces §14a grid ceiling + §9 feed-in cap + device safety.
 * Netzwirksamer Bezug (sum of setpoints beyond PV surplus) must not exceed ceiling.
 */
export function enforceActuatorGuard(input: GuardInput): GuardResult {
  const { requested, gridCeilingKw, limits, role } = input;
  const pvSurplusKw = Math.max(0, input.pvSurplusKw ?? 0);
  const maxFeedInKw =
    input.maxFeedInKw === undefined ? Number.POSITIVE_INFINITY : Math.max(0, input.maxFeedInKw);
  const audits: AuditEvent[] = [];

  const cappedPower = {
    heatPumpKw: clamp(requested.heatPumpKw, 0, limits.maxHeatPumpKw),
    wallboxKw: clamp(requested.wallboxKw, 0, limits.maxWallboxKw),
    batteryGridChargeKw: clamp(
      requested.batteryGridChargeKw,
      0,
      limits.maxBatteryGridChargeKw,
    ),
  };

  // Battery grid charge is always netzwirksam; HP/wallbox can use surplus first.
  const flexible = cappedPower.heatPumpKw + cappedPower.wallboxKw;
  const surplusForFlexible = Math.min(flexible, pvSurplusKw);
  const flexibleFromGrid = flexible - surplusForFlexible;
  const totalFromGrid = flexibleFromGrid + cappedPower.batteryGridChargeKw;

  let effectivePower = { ...cappedPower };
  let deniedBypass = false;

  if (totalFromGrid > gridCeilingKw + 1e-9) {
    deniedBypass = true;
    const scaleBudget = Math.max(0, gridCeilingKw);
    // Prefer keeping HP, then wallbox; cut MultiPlus grid charge first.
    let remaining = scaleBudget;

    const flexGridAllowed = Math.min(
      remaining,
      Math.max(0, cappedPower.heatPumpKw + cappedPower.wallboxKw - surplusForFlexible),
    );
    // Allocate flex grid budget: HP first, then wallbox.
    const hpFromGrid = Math.min(cappedPower.heatPumpKw, flexGridAllowed + 0);
    // Recompute with surplus attributed preferentially to HP then wallbox.
    let surplusLeft = pvSurplusKw;
    const hpFromSurplus = Math.min(cappedPower.heatPumpKw, surplusLeft);
    surplusLeft -= hpFromSurplus;
    let hpTotal = hpFromSurplus;
    const hpGridRoom = Math.max(0, cappedPower.heatPumpKw - hpTotal);
    const hpGridTake = Math.min(hpGridRoom, remaining);
    hpTotal += hpGridTake;
    remaining -= hpGridTake;

    const wbFromSurplus = Math.min(cappedPower.wallboxKw, surplusLeft);
    surplusLeft -= wbFromSurplus;
    let wbTotal = wbFromSurplus;
    const wbGridRoom = Math.max(0, cappedPower.wallboxKw - wbTotal);
    const wbGridTake = Math.min(wbGridRoom, remaining);
    wbTotal += wbGridTake;
    remaining -= wbGridTake;

    const batt = Math.min(cappedPower.batteryGridChargeKw, remaining);

    effectivePower = {
      heatPumpKw: hpTotal,
      wallboxKw: wbTotal,
      batteryGridChargeKw: batt,
    };

    audits.push({
      kind: "bypass_denied",
      at: new Date().toISOString(),
      role,
      detail: {
        requested: cappedPower,
        gridCeilingKw,
        pvSurplusKw,
        maxFeedInKw,
        effective: effectivePower,
      },
    });
  }

  const heatPump = heatPumpCommandFromPower(
    effectivePower.heatPumpKw,
    limits,
    input.preferHeatPumpLevel ?? requested.heatPump.level,
  );
  // If power is zero, force off regardless of preferred level.
  const heatPumpCmd =
    effectivePower.heatPumpKw <= 0
      ? { mode: "off" as const, level: 0, powerKw: 0 }
      : heatPump.mode === "level"
        ? heatPump
        : { mode: "on" as const, level: heatPump.level ?? 1, powerKw: effectivePower.heatPumpKw };

  const effective: PowerSetpoints = {
    heatPumpKw: effectivePower.heatPumpKw,
    heatPump: heatPumpCmd,
    wallboxKw: effectivePower.wallboxKw,
    batteryGridChargeKw: effectivePower.batteryGridChargeKw,
    maxFeedInKw,
  };

  audits.push({
    kind: "setpoints_applied",
    at: new Date().toISOString(),
    role,
    detail: { effective, gridCeilingKw, maxFeedInKw },
  });

  return { effective, deniedBypass, audits };
}
