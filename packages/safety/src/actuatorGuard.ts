import type {
  AuditEvent,
  PowerSetpoints,
  Role,
  SafetyLimits,
} from "@victron-ems14a/domain";

export interface GuardInput {
  requested: PowerSetpoints;
  gridCeilingKw: number;
  limits: SafetyLimits;
  /** Optional PV surplus that may feed steuVE without counting against grid ceiling. */
  pvSurplusKw?: number;
  role: Role;
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
 * Enforces grid ceiling + device safety caps.
 * Netzwirksamer Bezug (sum of setpoints beyond PV surplus) must not exceed ceiling.
 */
export function enforceActuatorGuard(input: GuardInput): GuardResult {
  const { requested, gridCeilingKw, limits, role } = input;
  const pvSurplusKw = Math.max(0, input.pvSurplusKw ?? 0);
  const audits: AuditEvent[] = [];

  const capped: PowerSetpoints = {
    heatPumpKw: clamp(requested.heatPumpKw, 0, limits.maxHeatPumpKw),
    wallboxKw: clamp(requested.wallboxKw, 0, limits.maxWallboxKw),
    batteryGridChargeKw: clamp(
      requested.batteryGridChargeKw,
      0,
      limits.maxBatteryGridChargeKw,
    ),
  };

  // Battery grid charge is always netzwirksam; HP/wallbox can use surplus first.
  const flexible = capped.heatPumpKw + capped.wallboxKw;
  const surplusForFlexible = Math.min(flexible, pvSurplusKw);
  const flexibleFromGrid = flexible - surplusForFlexible;
  const totalFromGrid = flexibleFromGrid + capped.batteryGridChargeKw;

  let effective = { ...capped };
  let deniedBypass = false;

  if (totalFromGrid > gridCeilingKw + 1e-9) {
    deniedBypass = true;
    const scaleBudget = Math.max(0, gridCeilingKw);
    // Keep battery grid charge last: reduce it first, then scale flexible loads.
    let remaining = scaleBudget;
    const batt = Math.min(capped.batteryGridChargeKw, remaining);
    remaining -= batt;

    const flexGridAllowed = remaining;
    const flexTarget = flexGridAllowed + surplusForFlexible;
    const flexSum = capped.heatPumpKw + capped.wallboxKw;
    const factor = flexSum > 0 ? Math.min(1, flexTarget / flexSum) : 0;

    effective = {
      heatPumpKw: capped.heatPumpKw * factor,
      wallboxKw: capped.wallboxKw * factor,
      batteryGridChargeKw: batt,
    };

    audits.push({
      kind: "bypass_denied",
      at: new Date().toISOString(),
      role,
      detail: {
        requested: capped,
        gridCeilingKw,
        pvSurplusKw,
        effective,
      },
    });
  }

  audits.push({
    kind: "setpoints_applied",
    at: new Date().toISOString(),
    role,
    detail: { effective, gridCeilingKw },
  });

  return { effective, deniedBypass, audits };
}
