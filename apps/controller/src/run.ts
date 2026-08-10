import { InMemoryHeatPumpAdapter } from "@victron-ems14a/heatpump";
import { InMemoryVictronGateway } from "@victron-ems14a/victron-mqtt";
import { InMemoryWallboxAdapter } from "@victron-ems14a/wallbox";
import { runControlTick } from "./controlLoop.js";

const gateway = new InMemoryVictronGateway({
  auxLimited: true,
  limitKw: 4.2,
  feedInCurtailed: true,
  feedInPercent: 0.6,
  state: {
    pvKw: 5,
    pvRatedKw: 10,
    mppt: [
      { id: "280", powerKw: 2 },
      { id: "281", powerKw: 3 },
    ],
    houseLoadKw: 0.5,
    batterySocPercent: 50,
    batteryPowerKw: 0,
    gridPowerKw: 2,
    wallbox: {
      id: "1",
      powerKw: 0,
      maxKw: 11,
      connected: true,
      charging: false,
    },
  },
});

const wallbox = new InMemoryWallboxAdapter();
const heatPump = new InMemoryHeatPumpAdapter();

const result = await runControlTick({
  gateway,
  wallbox,
  heatPump,
  wish: {
    wallboxKw: 11,
    heatPump: { preferOn: true, preferredLevel: 2 },
  },
});

console.log(
  JSON.stringify(
    {
      ceilingKw: result.ceilingKw,
      maxFeedInKw: result.maxFeedInKw,
      pvSurplusKw: result.pvSurplusKw,
      effective: result.effective,
      wallboxSetKw: wallbox.getLastSetKw(),
      heatPump: heatPump.getLastCommand(),
      multiPlusChargerKw: result.effective.batteryGridChargeKw,
      auditKinds: result.audits.map((a) => a.kind),
    },
    null,
    2,
  ),
);
