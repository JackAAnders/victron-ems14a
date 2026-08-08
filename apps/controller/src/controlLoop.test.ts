import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryVictronGateway } from "@victron-ems14a/victron-mqtt";
import { InMemoryWallboxAdapter } from "@victron-ems14a/wallbox";
import { runControlTick } from "./controlLoop.js";

describe("runControlTick", () => {
  it("applies wallbox under AUX ceiling and uses PV surplus", async () => {
    const gateway = new InMemoryVictronGateway({
      auxLimited: true,
      limitKw: 4.2,
      state: {
        pvKw: 5,
        houseLoadKw: 0.5,
        batterySocPercent: 40,
        batteryPowerKw: 0,
        gridPowerKw: 1,
      },
    });
    const wallbox = new InMemoryWallboxAdapter();

    const result = await runControlTick({
      gateway,
      wallbox,
      wish: { wallboxKw: 11 },
    });

    const sum =
      result.effective.heatPumpKw +
      result.effective.wallboxKw +
      result.effective.batteryGridChargeKw;

    // With ~4.5 kW surplus, wallbox may exceed 4.2 grid ceiling (surplus not grid).
    assert.equal(result.ceilingKw, 4.2);
    assert.ok(result.effective.wallboxKw > 4);
    assert.equal(wallbox.getLastSetKw(), result.effective.wallboxKw);
    // Netzwirksamer Anteil is enforced inside guard; total can exceed ceiling by surplus.
    assert.ok(sum <= 4.2 + result.pvSurplusKw + 1e-9);
  });
});
