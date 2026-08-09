/** Roles in the EMS trust model. */
export type Role = "enduser" | "installer" | "system";

/** Origin of a grid / feed-in constraint – never from end-user config. */
export type GridSignalSource =
  | "aux"
  | "eebus"
  | "steuerbox"
  | "rundsteuerung"
  | "manual_installer";

export type GridMode = "normal" | "limited" | "off";

/**
 * EnWG §14a – steuVE offtake constraint (netzwirksamer Bezug).
 * Immutable for enduser.
 */
export interface GridSignal {
  source: GridSignalSource;
  mode: GridMode;
  /** Max netzwirksame SteuVE-Bezugsleistung in kW (Ceiling). */
  maxSteuveGridKw: number;
  receivedAt: string; // ISO
}

/**
 * EEG §9 – feed-in / generation management (Einspeisemanagement).
 * Caps export to the public grid; immutable for enduser.
 */
export type FeedInMode = "normal" | "curtailed" | "zero";

export interface FeedInSignal {
  source: GridSignalSource;
  mode: FeedInMode;
  /**
   * Max allowed feed-in as fraction of plant rated power (0..1),
   * or absolute kW when `maxFeedInKw` is set.
   */
  maxFeedInPercent?: number;
  maxFeedInKw?: number;
  receivedAt: string;
}

export interface MpptState {
  id: string;
  powerKw: number;
  /** Victron charge state code if available. */
  state?: number;
}

export interface WallboxState {
  id: string;
  powerKw: number;
  maxKw: number;
  connected: boolean;
  charging: boolean;
}

/**
 * Heat-pump signalling target for §14a / EMS.
 * - `off` / `on`: simple contactor / SG-Ready binary
 * - `level`: dedicated discrete levels (0 = off … N = max allow)
 */
export type HeatPumpSignalMode = "off" | "on" | "level";

export interface HeatPumpCommand {
  mode: HeatPumpSignalMode;
  /**
   * Discrete level when mode === "level".
   * Convention: 0 = blocked/off, 1 = normal, 2 = enhanced, 3 = forced/max
   * (SG-Ready-like; exact relay encoding is adapter-specific).
   */
  level?: number;
  /** Approximate electrical power budget attributed to HP (for ceiling math). */
  powerKw: number;
}

export interface HeatPumpState {
  id: string;
  mode: HeatPumpSignalMode;
  level?: number;
  powerKw: number;
}

export interface PlantState {
  /** Aggregated PV from all MPPTs (+ optional AC-PV). */
  pvKw: number;
  /** Rated / installed PV AC-equivalent for §9 percent curtailment. */
  pvRatedKw?: number;
  mppt?: MpptState[];
  houseLoadKw: number;
  batterySocPercent: number;
  batteryPowerKw: number; // +charge / -discharge convention for EMS
  gridPowerKw: number; // +import / -export
  wallbox?: WallboxState;
  heatPump?: HeatPumpState;
  /** Current measured / last commanded feed-in (export) kW, positive = export. */
  feedInKw?: number;
}

export interface UserComfortWish {
  /** Desired wallbox charge power (before clamp). */
  wallboxKw?: number;
  /** Desired heat-pump behaviour under ceilings. */
  heatPump?: {
    preferOn?: boolean;
    /** Preferred discrete level when levels are supported. */
    preferredLevel?: number;
  };
  /** Priority weights; higher = prefer when splitting budget. */
  priority?: {
    heatPump: number;
    wallbox: number;
    batteryGridCharge: number;
  };
  /** Optional EV ready-by deadline (ISO); allocator may prefer wallbox. */
  wallboxReadyBy?: string;
}

export interface SafetyLimits {
  socFloorPercent: number;
  socCeilingPercent: number;
  maxWallboxKw: number;
  maxBatteryGridChargeKw: number;
  maxHeatPumpKw: number;
  /** Max discrete HP level (inclusive), typically 3 for SG-Ready-like. */
  maxHeatPumpLevel: number;
  maxWriteHz: number;
}

export interface PowerSetpoints {
  heatPumpKw: number;
  heatPump: HeatPumpCommand;
  wallboxKw: number;
  /** MultiPlus AC-in / ESS grid charge of battery (basic charger under §14a). */
  batteryGridChargeKw: number;
  /**
   * EEG §9: max allowed export to grid in kW (Infinity = unconstrained).
   * Applied to Multi/MPPT curtailment path.
   */
  maxFeedInKw: number;
}

export type AuditKind =
  | "grid_signal"
  | "feedin_signal"
  | "setpoints_applied"
  | "bypass_denied"
  | "forbidden_write";

export interface AuditEvent {
  kind: AuditKind;
  at: string;
  role?: Role;
  detail: Record<string, unknown>;
}

export const DEFAULT_SAFETY_LIMITS: SafetyLimits = {
  socFloorPercent: 15,
  socCeilingPercent: 95,
  maxWallboxKw: 11,
  maxBatteryGridChargeKw: 5,
  maxHeatPumpKw: 4.2,
  maxHeatPumpLevel: 3,
  maxWriteHz: 1,
};

export function heatPumpCommandFromPower(
  powerKw: number,
  limits: SafetyLimits,
  preferLevel?: number,
): HeatPumpCommand {
  if (powerKw <= 0) {
    return { mode: "off", level: 0, powerKw: 0 };
  }
  const maxL = Math.max(1, limits.maxHeatPumpLevel);
  const level =
    preferLevel !== undefined
      ? Math.min(maxL, Math.max(1, Math.round(preferLevel)))
      : Math.min(
          maxL,
          Math.max(1, Math.ceil((powerKw / Math.max(limits.maxHeatPumpKw, 1e-6)) * maxL)),
        );
  return {
    mode: "level",
    level,
    powerKw: Math.min(powerKw, limits.maxHeatPumpKw),
  };
}
