import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { kwToAmps } from "./current.js";

describe("kwToAmps", () => {
  it("returns 0 below 6A minimum", () => {
    assert.equal(kwToAmps(1.0, { phases: 1, volts: 230, minCurrentA: 6 }), 0);
  });

  it("maps ~3.7 kW to 16A single phase", () => {
    assert.equal(kwToAmps(3.7, { phases: 1, volts: 230, maxCurrentA: 16 }), 16);
  });
});
