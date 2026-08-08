/** Venus OS MQTT topic helpers (dbus-flashmq / legacy dbus-mqtt style). */

export interface ParsedTopic {
  direction: "N" | "W" | "R" | "P";
  portalId: string;
  service: string;
  instance: string;
  path: string;
}

const TOPIC_RE =
  /^(?<direction>[NWRP])\/(?<portalId>[^/]+)\/(?<service>[^/]+)\/(?<instance>[^/]+)\/(?<path>.+)$/;

export function parseVenusTopic(topic: string): ParsedTopic | null {
  const m = TOPIC_RE.exec(topic);
  if (!m?.groups) return null;
  return {
    direction: m.groups.direction as ParsedTopic["direction"],
    portalId: m.groups.portalId,
    service: m.groups.service,
    instance: m.groups.instance,
    path: m.groups.path,
  };
}

export function notifyTopic(
  portalId: string,
  service: string,
  instance: string | number,
  path: string,
): string {
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `N/${portalId}/${service}/${instance}/${p}`;
}

export function writeTopic(
  portalId: string,
  service: string,
  instance: string | number,
  path: string,
): string {
  const p = path.startsWith("/") ? path.slice(1) : path;
  return `W/${portalId}/${service}/${instance}/${p}`;
}

export function keepaliveTopic(portalId: string): string {
  return `R/${portalId}/keepalive`;
}

/** Extract numeric/boolean value from Venus MQTT JSON payload. */
export function parseVenusPayload(raw: Buffer | string): unknown {
  const text = typeof raw === "string" ? raw : raw.toString("utf8");
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text) as { value?: unknown };
    if (parsed && typeof parsed === "object" && "value" in parsed) {
      return parsed.value;
    }
    return parsed;
  } catch {
    const n = Number(text);
    return Number.isFinite(n) ? n : text;
  }
}

export function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  if (typeof value === "boolean") return value ? 1 : 0;
  return undefined;
}
