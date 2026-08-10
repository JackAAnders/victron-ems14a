import type { HeatPumpCommand } from "@victron-ems14a/domain";
import type { VenusMqttGateway } from "@victron-ems14a/victron-mqtt";

export interface HeatPumpAdapter {
  apply(command: HeatPumpCommand): Promise<void>;
  getLastCommand(): HeatPumpCommand | null;
}

/** In-memory / test double. */
export class InMemoryHeatPumpAdapter implements HeatPumpAdapter {
  private last: HeatPumpCommand | null = null;

  async apply(command: HeatPumpCommand): Promise<void> {
    this.last = { ...command };
  }

  getLastCommand(): HeatPumpCommand | null {
    return this.last ? { ...this.last } : null;
  }
}

export interface RelayHeatPumpOptions {
  /** Map level → which relays are closed [K1, K2] (SG-Ready style). */
  levelRelayMap?: Record<number, [boolean, boolean]>;
}

/**
 * Encode HP command as two boolean relays (on/off + level via bit pattern).
 * Physical wiring is site-specific (Cerbo relays / digital outputs).
 */
export function encodeSgReadyRelays(
  command: HeatPumpCommand,
  map?: Record<number, [boolean, boolean]>,
): [boolean, boolean] {
  const levelMap =
    map ??
    ({
      0: [false, false], // off / blocked
      1: [true, false], // normal
      2: [false, true], // enhanced
      3: [true, true], // forced / max
    } as Record<number, [boolean, boolean]>);

  if (command.mode === "off") return levelMap[0] ?? [false, false];
  if (command.mode === "on") return levelMap[1] ?? [true, false];
  const level = command.level ?? 1;
  return levelMap[level] ?? levelMap[1] ?? [true, false];
}

export interface CerboRelayHeatPumpOptions extends RelayHeatPumpOptions {
  gateway: VenusMqttGateway;
  /** Venus switch/relay instances for K1/K2. */
  relayInstances?: [string, string];
}

/**
 * Drives two Cerbo relays for SG-Ready / EVU contacts.
 * Topic path may vary; uses switch/<id>/State = 0|1.
 */
export class CerboRelayHeatPumpAdapter implements HeatPumpAdapter {
  private last: HeatPumpCommand | null = null;
  private readonly gateway: VenusMqttGateway;
  private readonly relays: [string, string];
  private readonly map?: Record<number, [boolean, boolean]>;

  constructor(opts: CerboRelayHeatPumpOptions) {
    this.gateway = opts.gateway;
    this.relays = opts.relayInstances ?? ["0", "1"];
    this.map = opts.levelRelayMap;
  }

  async apply(command: HeatPumpCommand): Promise<void> {
    this.last = { ...command };
    const [k1, k2] = encodeSgReadyRelays(command, this.map);
    this.gateway.publishWrite("switch", this.relays[0], "State", k1 ? 1 : 0);
    this.gateway.publishWrite("switch", this.relays[1], "State", k2 ? 1 : 0);
  }

  getLastCommand(): HeatPumpCommand | null {
    return this.last ? { ...this.last } : null;
  }
}
