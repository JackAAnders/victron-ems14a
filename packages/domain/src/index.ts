/** Roles in the EMS trust model. */
export type Role = "enduser" | "installer" | "system";

/** Origin of a grid constraint – never from end-user config. */
export type GridSignalSource = "aux" | "eebus" | "steuerbox" | "manual_installer";

export type GridMode = "normal" | "limited" | "off";

export interface GridSignal {
  source: GridSignalSource;
  mode: GridMode;
  /** Max netzwirksame SteuVE-Bezugsleistung in kW (Ceiling). */
  maxSteuveGridKw: number;
  receivedAt: string; // ISO
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

export interface PlantState {
  /** Aggregated PV from all MPPTs (+ optional AC-PV). */
  pvKw: number;
  mppt?: MpptState[];
  houseLoadKw: number;
  batterySocPercent: number;
  batteryPowerKw: number; // +charge / -discharge convention for EMS
  gridPowerKw: number; // +import / -export
  wallbox?: WallboxState;
}

export interface UserComfortWish {
  /** Desired wallbox charge power (before clamp). */
  wallboxKw?: number;
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
  maxWriteHz: number;
}

export interface PowerSetpoints {
  heatPumpKw: number;
  wallboxKw: number;
  batteryGridChargeKw: number;
}

export type AuditKind =
  | "grid_signal"
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
  maxWriteHz: 1,
};
