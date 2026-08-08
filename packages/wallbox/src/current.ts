import type { WallboxElectrical } from "./types.js";

export function kwToAmps(kw: number, elec: WallboxElectrical = {}): number {
  const volts = elec.volts ?? 230;
  const phases = elec.phases ?? 1;
  const minA = elec.minCurrentA ?? 6;
  const maxA = elec.maxCurrentA ?? 16;
  if (kw <= 0) return 0;
  const amps = (kw * 1000) / (volts * phases);
  if (amps < minA) return 0; // below EVSE minimum → stop rather than flap
  return Math.min(maxA, Math.floor(amps));
}

export function ampsToKw(amps: number, elec: WallboxElectrical = {}): number {
  const volts = elec.volts ?? 230;
  const phases = elec.phases ?? 1;
  return (amps * volts * phases) / 1000;
}
