import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computePvSurplusKw } from "./surplus.js";

describe("computePvSurplusKw", () => {
  it("zeros small surplus under hysteresis", () => {
    assert.equal(computePvSurplusKw(1.2, 1.0, { hysteresisKw: 0.4 }), 0);
  });

  it("passes clear surplus", () => {
    assert.ok(computePvSurplusKw(5, 1, { hysteresisKw: 0.4 }) >= 4);
  });
});
