import type { GridMode, GridSignal } from "@victron-ems14a/domain";
import type { VenusValueCache } from "./cache.js";

export interface AuxMapConfig {
  /**
   * Digital input instance that means "limited" when active.
   * Victron Multi AUX is often mirrored as digitalinput on GX / vebus.
   */
  limitedInput?: { service: string; instance: string; path?: string; activeValue?: number };
  /** Digital input that means full steuVE off. */
  offInput?: { service: string; instance: string; path?: string; activeValue?: number };
  /** kW ceiling when limited (typical §14a Mindestleistung). */
  limitedKw?: number;
}

const DEFAULT_LIMITED_KW = 4.2;

function isActive(
  cache: VenusValueCache,
  ref: { service: string; instance: string; path?: string; activeValue?: number },
): boolean {
  const path = ref.path ?? "State";
  const value = cache.getNumber(ref.service, ref.instance, path);
  if (value === undefined) return false;
  const active = ref.activeValue ?? 1;
  return value === active;
}

/**
 * Map cached digital inputs / AUX mirrors to a GridSignal.
 * Defaults: no configured inputs → normal (infinite ceiling).
 */
export function gridSignalFromAux(
  cache: VenusValueCache,
  config: AuxMapConfig = {},
): GridSignal {
  const limitedKw = config.limitedKw ?? DEFAULT_LIMITED_KW;
  const off = config.offInput ? isActive(cache, config.offInput) : false;
  const limited = config.limitedInput ? isActive(cache, config.limitedInput) : false;

  let mode: GridMode = "normal";
  let maxSteuveGridKw = Number.POSITIVE_INFINITY;
  if (off) {
    mode = "off";
    maxSteuveGridKw = 0;
  } else if (limited) {
    mode = "limited";
    maxSteuveGridKw = limitedKw;
  }

  return {
    source: "aux",
    mode,
    maxSteuveGridKw,
    receivedAt: new Date().toISOString(),
  };
}
