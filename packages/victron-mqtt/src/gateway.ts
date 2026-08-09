import type {
  FeedInSignal,
  GridSignal,
  PlantState,
  PowerSetpoints,
} from "@victron-ems14a/domain";

/** Port for Venus OS integration. */
export interface VictronGateway {
  readPlantState(): Promise<PlantState>;
  /** Digital inputs / mapped AUX → §14a grid signal. */
  readGridSignal(): Promise<GridSignal | null>;
  /** Optional mapped inputs → EEG §9 feed-in signal. */
  readFeedInSignal(): Promise<FeedInSignal | null>;
  /**
   * Apply MultiPlus-related setpoints: basic charger (battery grid charge)
   * and EEG §9 max feed-in. Wallbox/HP use dedicated adapters.
   */
  applySetpoints(setpoints: PowerSetpoints): Promise<void>;
}
