import type { GridMode, GridSignal, PlantState, PowerSetpoints } from "@victron-ems14a/domain";

/** Port for Venus OS integration – MQTT implementation comes in sprint 2. */
export interface VictronGateway {
  readPlantState(): Promise<PlantState>;
  /** Digital inputs / mapped AUX → grid signal. */
  readGridSignal(): Promise<GridSignal | null>;
  applySetpoints(setpoints: PowerSetpoints): Promise<void>;
}

export interface InMemoryVictronOptions {
  state?: PlantState;
  auxLimited?: boolean;
  limitKw?: number;
}

/** Deterministic fake for tests and local dry-runs. */
export class InMemoryVictronGateway implements VictronGateway {
  state: PlantState;
  auxLimited: boolean;
  limitKw: number;
  lastSetpoints: PowerSetpoints | null = null;

  constructor(opts: InMemoryVictronOptions = {}) {
    this.state = opts.state ?? {
      pvKw: 0,
      houseLoadKw: 0.4,
      batterySocPercent: 55,
      batteryPowerKw: 0,
      gridPowerKw: 0,
    };
    this.auxLimited = opts.auxLimited ?? false;
    this.limitKw = opts.limitKw ?? 4.2;
  }

  async readPlantState(): Promise<PlantState> {
    return { ...this.state };
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

  async applySetpoints(setpoints: PowerSetpoints): Promise<void> {
    this.lastSetpoints = { ...setpoints };
  }
}
