import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryVictronGateway } from "@victron-ems14a/victron-mqtt";

describe("collector gateway smoke", () => {
  it("reads demo plant", async () => {
    const gw = new InMemoryVictronGateway({
      state: {
        pvKw: 1,
        houseLoadKw: 0.2,
        batterySocPercent: 50,
        batteryPowerKw: 0,
        gridPowerKw: 0,
      },
    });
    const plant = await gw.readPlantState();
    assert.equal(plant.pvKw, 1);
  });
});
