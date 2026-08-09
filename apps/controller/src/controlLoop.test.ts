import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryHeatPumpAdapter } from "@victron-ems14a/heatpump";
import { InMemoryVictronGateway } from "@victron-ems14a/victron-mqtt";
import { InMemoryWallboxAdapter } from "@victron-ems14a/wallbox";
import { runControlTick } from "./controlLoop.js";

describe("runControlTick", () => {
  it("limits EV + MultiPlus charger under §14a and signals HP levels", async () => {
    const gateway = new InMemoryVictronGateway({
      auxLimited: true,
      limitKw: 4.2,
      feedInCurtailed: true,
      feedInPercent: 0.6,
      state: {
        pvKw: 1,
        pvRatedKw: 10,
        houseLoadKw: 0.5,
        batterySocPercent: 40,
        batteryPowerKw: 0,
        gridPowerKw: 1,
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

    const sum =
      result.effective.heatPumpKw +
      result.effective.wallboxKw +
      result.effective.batteryGridChargeKw;

    assert.equal(result.ceilingKw, 4.2);
    assert.equal(result.maxFeedInKw, 6);
    assert.ok(sum <= 4.2 + result.pvSurplusKw + 1e-9);
    assert.equal(wallbox.getLastSetKw(), result.effective.wallboxKw);
    assert.ok(heatPump.getLastCommand());
    assert.ok(result.audits.some((a) => a.kind === "feedin_signal"));
    assert.ok(result.audits.some((a) => a.kind === "grid_signal"));
  });
});
