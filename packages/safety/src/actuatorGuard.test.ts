import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SAFETY_LIMITS } from "@victron-ems14a/domain";
import { enforceActuatorGuard } from "./actuatorGuard.js";

describe("enforceActuatorGuard", () => {
  it("clamps netzwirksamen Bezug to grid ceiling (I3)", () => {
    const result = enforceActuatorGuard({
      role: "enduser",
      gridCeilingKw: 4.2,
      pvSurplusKw: 0,
      limits: DEFAULT_SAFETY_LIMITS,
      requested: {
        heatPumpKw: 3,
        wallboxKw: 11,
        batteryGridChargeKw: 5,
      },
    });

    const fromGrid =
      result.effective.heatPumpKw +
      result.effective.wallboxKw +
      result.effective.batteryGridChargeKw;
    assert.ok(fromGrid <= 4.2 + 1e-9);
    assert.equal(result.deniedBypass, true);
    assert.ok(result.audits.some((a) => a.kind === "bypass_denied"));
  });

  it("allows PV surplus above ceiling for flexible loads", () => {
    const result = enforceActuatorGuard({
      role: "system",
      gridCeilingKw: 4.2,
      pvSurplusKw: 6,
      limits: DEFAULT_SAFETY_LIMITS,
      requested: {
        heatPumpKw: 3,
        wallboxKw: 5,
        batteryGridChargeKw: 0,
      },
    });

    assert.equal(result.deniedBypass, false);
    assert.ok(result.effective.heatPumpKw + result.effective.wallboxKw >= 8 - 1e-9);
  });
});
