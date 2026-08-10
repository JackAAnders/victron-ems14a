import mqtt, { type MqttClient } from "mqtt";
import type {
  FeedInSignal,
  GridSignal,
  PlantState,
  PowerSetpoints,
} from "@victron-ems14a/domain";
import { gridSignalFromAux, type AuxMapConfig } from "./auxMap.js";
import { VenusValueCache } from "./cache.js";
import { feedInSignalFromInputs, type FeedInMapConfig } from "./feedInMap.js";
import type { VictronGateway } from "./gateway.js";
import { plantStateFromCache } from "./plantFromCache.js";
import { keepaliveTopic, writeTopic } from "./topics.js";

export interface VenusMqttGatewayOptions {
  url: string;
  portalId?: string;
  username?: string;
  password?: string;
  aux?: AuxMapConfig;
  feedIn?: FeedInMapConfig;
  keepaliveMs?: number;
  /** Apply MultiPlus charger limit + feed-in related writes. */
  enableMultiWrites?: boolean;
  vebusInstance?: string;
  /**
   * Settings path for max grid feed-in (site/firmware specific).
   * Published as watts when finite.
   */
  maxFeedInSettingsPath?: string;
}

export class VenusMqttGateway implements VictronGateway {
  readonly cache = new VenusValueCache();
  private client: MqttClient | null = null;
  private keepaliveTimer: NodeJS.Timeout | null = null;
  private readonly opts: VenusMqttGatewayOptions;
  lastSetpoints: PowerSetpoints | null = null;

  constructor(opts: VenusMqttGatewayOptions) {
    this.opts = opts;
  }

  async connect(): Promise<void> {
    if (this.client) return;
    const client = mqtt.connect(this.opts.url, {
      username: this.opts.username,
      password: this.opts.password,
      reconnectPeriod: 2_000,
    });
    this.client = client;

    await new Promise<void>((resolve, reject) => {
      const onErr = (err: Error) => {
        client.removeListener("connect", onOk);
        reject(err);
      };
      const onOk = () => {
        client.removeListener("error", onErr);
        resolve();
      };
      client.once("connect", onOk);
      client.once("error", onErr);
    });

    const portal = this.opts.portalId ?? "+";
    client.subscribe(`N/${portal}/#`);
    client.on("message", (topic, payload) => {
      this.cache.ingest(topic, payload);
    });

    const ms = this.opts.keepaliveMs ?? 30_000;
    const beat = () => {
      const id = this.opts.portalId ?? this.cache.getPortalId();
      if (!id || !this.client?.connected) return;
      this.client.publish(keepaliveTopic(id), "");
    };
    beat();
    this.keepaliveTimer = setInterval(beat, ms);
  }

  async disconnect(): Promise<void> {
    if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
    this.keepaliveTimer = null;
    if (this.client) {
      await new Promise<void>((resolve) => this.client!.end(false, {}, () => resolve()));
      this.client = null;
    }
  }

  getClient(): MqttClient | null {
    return this.client;
  }

  async readPlantState(): Promise<PlantState> {
    return plantStateFromCache(this.cache);
  }

  async readGridSignal(): Promise<GridSignal | null> {
    return gridSignalFromAux(this.cache, this.opts.aux ?? {});
  }

  async readFeedInSignal(): Promise<FeedInSignal | null> {
    return feedInSignalFromInputs(this.cache, this.opts.feedIn ?? {});
  }

  async applySetpoints(setpoints: PowerSetpoints): Promise<void> {
    this.lastSetpoints = {
      ...setpoints,
      heatPump: { ...setpoints.heatPump },
    };
    if (!this.opts.enableMultiWrites || !this.client) return;

    const instance =
      this.opts.vebusInstance ?? this.cache.listInstances("vebus")[0];
    if (instance) {
      // Basic charger function: limit MultiPlus AC-in charge current (A).
      // Approx: kW / (230 * phases). Default 1P.
      const amps =
        setpoints.batteryGridChargeKw <= 0
          ? 0
          : Math.max(1, Math.ceil((setpoints.batteryGridChargeKw * 1000) / 230));
      this.publishWrite("vebus", instance, "Ac/In/1/CurrentLimit", amps);
    }

    if (Number.isFinite(setpoints.maxFeedInKw)) {
      const path =
        this.opts.maxFeedInSettingsPath ??
        "Settings/CGwacs/MaxFeedInPower";
      // settings service often uses instance 0
      this.publishWrite("settings", "0", path, Math.round(setpoints.maxFeedInKw * 1000));
    }
  }

  publishWrite(
    service: string,
    instance: string | number,
    path: string,
    value: unknown,
  ): void {
    const portal = this.opts.portalId ?? this.cache.getPortalId();
    if (!portal || !this.client?.connected) {
      throw new Error("Venus MQTT not connected or portalId unknown");
    }
    const topic = writeTopic(portal, service, instance, path);
    this.client.publish(topic, JSON.stringify({ value }));
  }
}
