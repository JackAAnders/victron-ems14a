import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  ForbiddenGridWriteError,
  GridConstraint,
} from "./gridConstraint.js";

describe("GridConstraint", () => {
  it("rejects enduser writes (I2)", () => {
    const gc = new GridConstraint();
    assert.throws(
      () =>
        gc.applySignal("enduser", {
          source: "aux",
          mode: "limited",
          maxSteuveGridKw: 4.2,
          receivedAt: new Date().toISOString(),
        }),
      ForbiddenGridWriteError,
    );
  });

  it("accepts system aux signal and exposes ceiling (I1)", () => {
    const gc = new GridConstraint();
    gc.applySignal("system", {
      source: "aux",
      mode: "limited",
      maxSteuveGridKw: 4.2,
      receivedAt: new Date().toISOString(),
    });
    assert.equal(gc.getCeilingKw(), 4.2);
  });

  it("mode off yields zero ceiling", () => {
    const gc = new GridConstraint();
    gc.applySignal("system", {
      source: "steuerbox",
      mode: "off",
      maxSteuveGridKw: 4.2,
      receivedAt: new Date().toISOString(),
    });
    assert.equal(gc.getCeilingKw(), 0);
  });
});
