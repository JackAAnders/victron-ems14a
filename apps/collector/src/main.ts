import {
  InMemoryVictronGateway,
  VenusMqttGateway,
  type VictronGateway,
} from "@victron-ems14a/victron-mqtt";

function env(name: string, fallback?: string): string | undefined {
  return process.env[name] ?? fallback;
}

async function createGateway(): Promise<{ gateway: VictronGateway; close?: () => Promise<void> }> {
  const url = env("VENUS_MQTT_URL");
  if (!url) {
    console.error("VENUS_MQTT_URL not set – using InMemory demo plant");
    return {
      gateway: new InMemoryVictronGateway({
        auxLimited: false,
        state: {
          pvKw: 3.2,
          mppt: [{ id: "280", powerKw: 3.2 }],
          houseLoadKw: 0.6,
          batterySocPercent: 70,
          batteryPowerKw: 1.1,
          gridPowerKw: -0.5,
        },
      }),
    };
  }

  const gw = new VenusMqttGateway({
    url,
    portalId: env("VENUS_PORTAL_ID"),
    username: env("VENUS_MQTT_USER"),
    password: env("VENUS_MQTT_PASSWORD"),
    aux: {
      limitedInput: {
        service: env("VENUS_AUX_LIMIT_SERVICE", "digitalinput")!,
        instance: env("VENUS_AUX_LIMIT_INSTANCE", "1")!,
      },
      offInput: env("VENUS_AUX_OFF_INSTANCE")
        ? {
            service: env("VENUS_AUX_OFF_SERVICE", "digitalinput")!,
            instance: env("VENUS_AUX_OFF_INSTANCE")!,
          }
        : undefined,
      limitedKw: Number(env("VENUS_LIMIT_KW", "4.2")),
    },
  });
  await gw.connect();
  console.error(`Connected to Venus MQTT at ${url}`);
  return { gateway: gw, close: () => gw.disconnect() };
}

const intervalMs = Number(env("COLLECTOR_INTERVAL_MS", "5000"));
const { gateway, close } = await createGateway();

const tick = async () => {
  const plant = await gateway.readPlantState();
  const signal = await gateway.readGridSignal();
  console.log(
    JSON.stringify({
      at: new Date().toISOString(),
      plant,
      grid: signal,
    }),
  );
};

await tick();
const timer = setInterval(() => {
  void tick().catch((err) => console.error(err));
}, intervalMs);

const shutdown = async () => {
  clearInterval(timer);
  await close?.();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
