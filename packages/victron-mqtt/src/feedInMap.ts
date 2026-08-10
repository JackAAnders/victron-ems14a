import type { FeedInSignal } from "@victron-ems14a/domain";
import type { VenusValueCache } from "./cache.js";

export interface FeedInMapConfig {
  /**
   * Optional digital inputs encoding curtailment (site-specific).
   * If unset, feed-in stays normal until system injects a signal.
   */
  curtailedInput?: {
    service: string;
    instance: string;
    path?: string;
    activeValue?: number;
  };
  zeroInput?: {
    service: string;
    instance: string;
    path?: string;
    activeValue?: number;
  };
  /** Used when curtailedInput active and no absolute kW override. */
  curtailedPercent?: number;
}

function isActive(
  cache: VenusValueCache,
  ref: { service: string; instance: string; path?: string; activeValue?: number },
): boolean {
  const path = ref.path ?? "State";
  const value = cache.getNumber(ref.service, ref.instance, path);
  if (value === undefined) return false;
  return value === (ref.activeValue ?? 1);
}

/** Map digital inputs to EEG §9 FeedInSignal. */
export function feedInSignalFromInputs(
  cache: VenusValueCache,
  config: FeedInMapConfig = {},
): FeedInSignal {
  const zero = config.zeroInput ? isActive(cache, config.zeroInput) : false;
  const curtailed = config.curtailedInput
    ? isActive(cache, config.curtailedInput)
    : false;

  if (zero) {
    return {
      source: "rundsteuerung",
      mode: "zero",
      maxFeedInPercent: 0,
      maxFeedInKw: 0,
      receivedAt: new Date().toISOString(),
    };
  }
  if (curtailed) {
    const pct = config.curtailedPercent ?? 0.6;
    return {
      source: "rundsteuerung",
      mode: "curtailed",
      maxFeedInPercent: pct,
      receivedAt: new Date().toISOString(),
    };
  }
  return {
    source: "steuerbox",
    mode: "normal",
    maxFeedInPercent: 1,
    receivedAt: new Date().toISOString(),
  };
}
