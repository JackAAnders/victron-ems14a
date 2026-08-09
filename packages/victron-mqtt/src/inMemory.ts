import type {
  FeedInMode,
  FeedInSignal,
  GridMode,
  GridSignal,
  PlantState,
  PowerSetpoints,
} from "@victron-ems14a/domain";
import type { VictronGateway } from "./gateway.js";

export interface InMemoryVictronOptions {
  state?: PlantState;
  auxLimited?: boolean;
  limitKw?: number;
  feedInCurtailed?: boolean;
  feedInPercent?: number;
  feedInZero?: boolean;
}

/** Deterministic fake for tests and local dry-runs. */
export class InMemoryVictronGateway implements VictronGateway {
  state: PlantState;
  auxLimited: boolean;
  limitKw: number;
  feedInCurtailed: boolean;
  feedInPercent: number;
  feedInZero: boolean;
  lastSetpoints: PowerSetpoints | null = null;

  constructor(opts: InMemoryVictronOptions = {}) {
    this.state = opts.state ?? {
      pvKw: 0,
      pvRatedKw: 10,
      houseLoadKw: 0.4,
      batterySocPercent: 55,
      batteryPowerKw: 0,
      gridPowerKw: 0,
    };
    this.auxLimited = opts.auxLimited ?? false;
    this.limitKw = opts.limitKw ?? 4.2;
    this.feedInCurtailed = opts.feedInCurtailed ?? false;
    this.feedInPercent = opts.feedInPercent ?? 0.6;
    this.feedInZero = opts.feedInZero ?? false;
  }

  async readPlantState(): Promise<PlantState> {
    return {
      ...this.state,
      mppt: this.state.mppt ? [...this.state.mppt] : undefined,
      wallbox: this.state.wallbox ? { ...this.state.wallbox } : undefined,
      heatPump: this.state.heatPump ? { ...this.state.heatPump } : undefined,
    };
  }

  async readGridSignal(): Promise<GridSignal | null> {
    const mode: GridMode = this.auxLimited ? "limited" : "normal";
    return {
      source: "aux",
      mode,
      maxSteuveGridKw: this.auxLimited ? this.limitKw : Number.POSITIVE_INFINITY,
      receivedAt: new Date().toISOString(),
    };
  }

  async readFeedInSignal(): Promise<FeedInSignal | null> {
    if (this.feedInZero) {
      return {
        source: "rundsteuerung",
        mode: "zero",
        maxFeedInPercent: 0,
        maxFeedInKw: 0,
        receivedAt: new Date().toISOString(),
      };
    }
    if (this.feedInCurtailed) {
      return {
        source: "rundsteuerung",
        mode: "curtailed" satisfies FeedInMode,
        maxFeedInPercent: this.feedInPercent,
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

  async applySetpoints(setpoints: PowerSetpoints): Promise<void> {
    this.lastSetpoints = {
      ...setpoints,
      heatPump: { ...setpoints.heatPump },
    };
  }
}
