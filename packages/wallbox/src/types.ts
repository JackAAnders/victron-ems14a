export interface WallboxAdapter {
  /** Apply charge power target in kW (implementation maps to A if needed). */
  setChargeKw(kw: number): Promise<void>;
  getLastSetKw(): number | null;
}

export interface WallboxElectrical {
  /** Nominal volts per phase for A↔kW. */
  volts?: number;
  phases?: 1 | 3;
  minCurrentA?: number;
  maxCurrentA?: number;
}
