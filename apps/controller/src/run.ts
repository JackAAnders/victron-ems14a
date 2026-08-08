import { InMemoryVictronGateway } from "@victron-ems14a/victron-mqtt";
import { runControlTick } from "./controlLoop.js";

const gateway = new InMemoryVictronGateway({
  auxLimited: true,
  limitKw: 4.2,
  state: {
    pvKw: 1.5,
    houseLoadKw: 0.5,
    batterySocPercent: 50,
    batteryPowerKw: 0,
    gridPowerKw: 2,
  },
});

const result = await runControlTick({
  gateway,
  wish: { wallboxKw: 11 },
});

console.log(
  JSON.stringify(
    {
      ceilingKw: result.ceilingKw,
      effective: result.effective,
      applied: gateway.lastSetpoints,
      auditKinds: result.audits.map((a) => a.kind),
    },
    null,
    2,
  ),
);
