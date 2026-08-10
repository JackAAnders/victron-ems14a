export interface SurplusOptions {
  /** Ignore tiny surplus noise (kW). */
  hysteresisKw?: number;
  /** Previous target for sticky hysteresis. */
  previousTargetKw?: number;
}

/**
 * PV surplus available for flexible loads (wallbox), sticky hysteresis.
 */
export function computePvSurplusKw(
  pvKw: number,
  houseLoadWithoutWallboxKw: number,
  opts: SurplusOptions = {},
): number {
  const raw = Math.max(0, pvKw - houseLoadWithoutWallboxKw);
  const hyst = opts.hysteresisKw ?? 0.4;
  const prev = opts.previousTargetKw ?? 0;

  if (prev > 0) {
    // Keep charging until surplus falls hyst below previous effective need.
    if (raw + hyst >= prev) return raw;
    if (raw < hyst) return 0;
  }
  return raw < hyst ? 0 : raw;
}
