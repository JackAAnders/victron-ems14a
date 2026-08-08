import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryVictronGateway } from "@victron-ems14a/victron-mqtt";
import { runControlTick } from "./controlLoop.js";

describe("runControlTick", () => {
  it("applies setpoints under AUX 4.2 kW ceiling", async () => {
    const gateway = new InMemoryVictronGateway({
      auxLimited: true,
      limitKw: 4.2,
      state: {
        pvKw: 0,
        houseLoadKw: 0.3,
        batterySocPercent: 40,
        batteryPowerKw: 0,
        gridPowerKw: 1,
      },
    });

    const result = await runControlTick({
      gateway,
      wish: { wallboxKw: 11 },
    });

    const sum =
      result.effective.heatPumpKw +
      result.effective.wallboxKw +
      result.effective.batteryGridChargeKw;

    assert.equal(result.ceilingKw, 4.2);
    assert.ok(sum <= 4.2 + 1e-9);
    assert.deepEqual(gateway.lastSetpoints, result.effective);
  });
});
