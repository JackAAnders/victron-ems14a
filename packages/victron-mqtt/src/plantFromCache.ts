import type { MpptState, PlantState, WallboxState } from "@victron-ems14a/domain";
import type { VenusValueCache } from "./cache.js";

function wattsToKw(w: number | undefined): number {
  if (w === undefined) return 0;
  return w / 1000;
}

function sumPhases(
  cache: VenusValueCache,
  service: string,
  instance: string,
  basePath: string,
): number {
  let sum = 0;
  for (const phase of ["L1", "L2", "L3"]) {
    const n = cache.getNumber(service, instance, `${basePath}/${phase}/Power`);
    if (n !== undefined) sum += n;
  }
  // Some installs publish a total without phases.
  const total = cache.getNumber(service, instance, `${basePath}/Power`);
  if (total !== undefined && sum === 0) return total;
  return sum;
}

export function plantStateFromCache(cache: VenusValueCache): PlantState {
  const mpptIds = cache.listInstances("solarcharger");
  const mppt: MpptState[] = mpptIds.map((id) => ({
    id,
    powerKw: wattsToKw(cache.getNumber("solarcharger", id, "Yield/Power")),
    state: cache.getNumber("solarcharger", id, "State"),
  }));

  const pvFromMppt = mppt.reduce((s, m) => s + m.powerKw, 0);
  const pvSystem = wattsToKw(cache.getNumber("system", "0", "Dc/Pv/Power"));
  const pvKw = pvFromMppt > 0 ? pvFromMppt : pvSystem;

  const soc =
    cache.getNumber("system", "0", "Dc/Battery/Soc") ??
    cache.getNumber("battery", cache.listInstances("battery")[0] ?? "0", "Soc") ??
    0;

  const batteryPowerW =
    cache.getNumber("system", "0", "Dc/Battery/Power") ??
    cache.getNumber("battery", cache.listInstances("battery")[0] ?? "0", "Dc/0/Power") ??
    0;

  const gridW =
    sumPhases(cache, "system", "0", "Ac/Grid") ||
    sumPhases(cache, "grid", cache.listInstances("grid")[0] ?? "0", "Ac");

  const consumptionW = sumPhases(cache, "system", "0", "Ac/Consumption");

  const evIds = cache.listInstances("evcharger");
  let wallbox: WallboxState | undefined;
  if (evIds.length > 0) {
    const id = evIds[0]!;
    const powerKw = wattsToKw(
      cache.getNumber("evcharger", id, "Ac/Power") ??
        cache.getNumber("evcharger", id, "Power"),
    );
    const maxCurrent =
      cache.getNumber("evcharger", id, "MaxCurrent") ??
      cache.getNumber("evcharger", id, "SetCurrent") ??
      16;
    const status = cache.getNumber("evcharger", id, "Status");
    wallbox = {
      id,
      powerKw,
      maxKw: (maxCurrent * 230) / 1000,
      connected: status !== undefined ? status > 0 : powerKw > 0,
      charging: powerKw > 0.2,
    };
  }

  const wallboxKw = wallbox?.powerKw ?? 0;
  const houseLoadKw = Math.max(0, wattsToKw(consumptionW) - wallboxKw);

  return {
    pvKw,
    mppt,
    houseLoadKw,
    batterySocPercent: soc,
    batteryPowerKw: wattsToKw(batteryPowerW),
    gridPowerKw: wattsToKw(gridW),
    wallbox,
  };
}
