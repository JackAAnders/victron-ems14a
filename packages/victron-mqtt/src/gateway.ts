import type { GridSignal, PlantState, PowerSetpoints } from "@victron-ems14a/domain";

/** Port for Venus OS integration. */
export interface VictronGateway {
  readPlantState(): Promise<PlantState>;
  /** Digital inputs / mapped AUX → grid signal. */
  readGridSignal(): Promise<GridSignal | null>;
  applySetpoints(setpoints: PowerSetpoints): Promise<void>;
}
