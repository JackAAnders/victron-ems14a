import type { VenusMqttGateway } from "@victron-ems14a/victron-mqtt";
import { ampsToKw, kwToAmps } from "./current.js";
import type { WallboxAdapter, WallboxElectrical } from "./types.js";

export interface VictronEvcsAdapterOptions {
  gateway: VenusMqttGateway;
  instance?: string;
  electrical?: WallboxElectrical;
}

/**
 * Controls a Victron EV Charging Station via Venus MQTT SetCurrent.
 * Exact path may vary by firmware – override instance after discovery.
 */
export class VictronEvcsAdapter implements WallboxAdapter {
  private lastKw: number | null = null;
  private readonly gateway: VenusMqttGateway;
  private readonly instance: string;
  private readonly electrical: WallboxElectrical;

  constructor(opts: VictronEvcsAdapterOptions) {
    this.gateway = opts.gateway;
    this.instance = opts.instance ?? "1";
    this.electrical = opts.electrical ?? { phases: 1, volts: 230, minCurrentA: 6, maxCurrentA: 16 };
  }

  async setChargeKw(kw: number): Promise<void> {
    const amps = kwToAmps(kw, this.electrical);
    this.lastKw = amps === 0 ? 0 : ampsToKw(amps, this.electrical);
    this.gateway.publishWrite("evcharger", this.instance, "SetCurrent", amps);
  }

  getLastSetKw(): number | null {
    return this.lastKw;
  }
}
