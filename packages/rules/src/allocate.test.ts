import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SAFETY_LIMITS } from "@victron-ems14a/domain";
import { allocateUnderCeiling } from "./allocate.js";

describe("allocateUnderCeiling", () => {
  it("prefers heat pump over battery grid charge within 4.2 kW", () => {
    const setpoints = allocateUnderCeiling({
      ceilingKw: 4.2,
      limits: DEFAULT_SAFETY_LIMITS,
      wish: {},
      state: {
        pvKw: 0,
        houseLoadKw: 0.5,
        batterySocPercent: 40,
        batteryPowerKw: 0,
        gridPowerKw: 0,
      },
    });

    assert.ok(setpoints.heatPumpKw > 0);
    assert.ok(
      setpoints.heatPumpKw + setpoints.wallboxKw + setpoints.batteryGridChargeKw <=
        4.2 + 1e-9,
    );
  });
});
