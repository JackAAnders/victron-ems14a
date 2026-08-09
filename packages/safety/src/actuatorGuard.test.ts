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
        heatPump: { mode: "level", level: 2, powerKw: 3 },
        wallboxKw: 11,
        batteryGridChargeKw: 5,
        maxFeedInKw: Number.POSITIVE_INFINITY,
      },
    });

    const fromGrid =
      result.effective.heatPumpKw +
      result.effective.wallboxKw +
      result.effective.batteryGridChargeKw;
    assert.ok(fromGrid <= 4.2 + 1e-9);
    assert.equal(result.deniedBypass, true);
    assert.ok(result.audits.some((a) => a.kind === "bypass_denied"));
    assert.ok(result.effective.heatPump.mode !== "off" || result.effective.heatPumpKw === 0);
  });

  it("allows PV surplus above ceiling for flexible loads", () => {
    const result = enforceActuatorGuard({
      role: "system",
      gridCeilingKw: 4.2,
      pvSurplusKw: 6,
      limits: DEFAULT_SAFETY_LIMITS,
      requested: {
        heatPumpKw: 3,
        heatPump: { mode: "level", level: 2, powerKw: 3 },
        wallboxKw: 5,
        batteryGridChargeKw: 0,
        maxFeedInKw: Number.POSITIVE_INFINITY,
      },
    });

    assert.equal(result.deniedBypass, false);
    assert.ok(result.effective.heatPumpKw + result.effective.wallboxKw >= 8 - 1e-9);
  });

  it("propagates EEG §9 maxFeedInKw", () => {
    const result = enforceActuatorGuard({
      role: "system",
      gridCeilingKw: 11,
      maxFeedInKw: 0,
      limits: DEFAULT_SAFETY_LIMITS,
      requested: {
        heatPumpKw: 0,
        heatPump: { mode: "off", level: 0, powerKw: 0 },
        wallboxKw: 0,
        batteryGridChargeKw: 0,
        maxFeedInKw: Number.POSITIVE_INFINITY,
      },
    });
    assert.equal(result.effective.maxFeedInKw, 0);
  });

  it("maps zero HP power to off signal", () => {
    const result = enforceActuatorGuard({
      role: "system",
      gridCeilingKw: 0,
      pvSurplusKw: 0,
      limits: DEFAULT_SAFETY_LIMITS,
      requested: {
        heatPumpKw: 2,
        heatPump: { mode: "on", level: 1, powerKw: 2 },
        wallboxKw: 0,
        batteryGridChargeKw: 0,
        maxFeedInKw: Number.POSITIVE_INFINITY,
      },
    });
    assert.equal(result.effective.heatPump.mode, "off");
    assert.equal(result.effective.heatPumpKw, 0);
  });
});
