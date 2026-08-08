import { asNumber, parseVenusPayload, parseVenusTopic } from "./topics.js";

export type CacheKey = `${string}/${string}/${string}`; // service/instance/path

export class VenusValueCache {
  private readonly values = new Map<CacheKey, unknown>();
  private portalId: string | null = null;

  getPortalId(): string | null {
    return this.portalId;
  }

  clear(): void {
    this.values.clear();
  }

  ingest(topic: string, payload: Buffer | string): void {
    const parsed = parseVenusTopic(topic);
    if (!parsed || parsed.direction !== "N") return;
    if (!this.portalId) this.portalId = parsed.portalId;
    const key = this.key(parsed.service, parsed.instance, parsed.path);
    this.values.set(key, parseVenusPayload(payload));
  }

  /** Seed cache in tests without MQTT. */
  seed(service: string, instance: string | number, path: string, value: unknown): void {
    const p = path.startsWith("/") ? path.slice(1) : path;
    this.values.set(this.key(service, String(instance), p), value);
  }

  get(service: string, instance: string | number, path: string): unknown {
    const p = path.startsWith("/") ? path.slice(1) : path;
    return this.values.get(this.key(service, String(instance), p));
  }

  getNumber(service: string, instance: string | number, path: string): number | undefined {
    return asNumber(this.get(service, instance, path));
  }

  /** Sum a path across all instances of a service. */
  sumServicePath(service: string, path: string): number {
    const p = path.startsWith("/") ? path.slice(1) : path;
    const prefix = `${service}/`;
    const suffix = `/${p}`;
    let sum = 0;
    for (const [key, value] of this.values) {
      if (!key.startsWith(prefix) || !key.endsWith(suffix)) continue;
      const n = asNumber(value);
      if (n !== undefined) sum += n;
    }
    return sum;
  }

  listInstances(service: string): string[] {
    const prefix = `${service}/`;
    const ids = new Set<string>();
    for (const key of this.values.keys()) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const instance = rest.split("/")[0];
      if (instance) ids.add(instance);
    }
    return [...ids].sort();
  }

  private key(service: string, instance: string, path: string): CacheKey {
    return `${service}/${instance}/${path}`;
  }
}
