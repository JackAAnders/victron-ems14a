import mqtt, { type MqttClient } from "mqtt";
import type { GridSignal, PlantState, PowerSetpoints } from "@victron-ems14a/domain";
import { gridSignalFromAux, type AuxMapConfig } from "./auxMap.js";
import { VenusValueCache } from "./cache.js";
import type { VictronGateway } from "./gateway.js";
import { plantStateFromCache } from "./plantFromCache.js";
import { keepaliveTopic, writeTopic } from "./topics.js";

export interface VenusMqttGatewayOptions {
  url: string; // e.g. mqtt://192.168.1.50:1883
  portalId?: string;
  username?: string;
  password?: string;
  aux?: AuxMapConfig;
  /** Keepalive interval ms (Venus requires periodic R/.../keepalive). */
  keepaliveMs?: number;
  /** Optional: apply battery grid-charge hint via MQTT path (advanced). */
  enableMultiWrites?: boolean;
  vebusInstance?: string;
}

/**
 * Live Cerbo / Venus OS gateway over local MQTT.
 * Read-heavy; wallbox writes go through WallboxAdapter (may share client).
 */
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

  async applySetpoints(setpoints: PowerSetpoints): Promise<void> {
    this.lastSetpoints = { ...setpoints };
    // Multi writes are opt-in; default MVP only records setpoints.
    // Wallbox power is applied by WallboxAdapter in the controller.
    if (!this.opts.enableMultiWrites || !this.client) return;
    const portal = this.opts.portalId ?? this.cache.getPortalId();
    if (!portal) return;
    const instance = this.opts.vebusInstance ?? this.cache.listInstances("vebus")[0];
    if (!instance) return;
    // Soft hint: publish nothing destructive by default.
    void setpoints;
    void writeTopic;
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
