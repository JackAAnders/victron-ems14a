import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FeedInConstraint,
  ForbiddenFeedInWriteError,
} from "./feedInConstraint.js";

describe("FeedInConstraint", () => {
  it("rejects enduser writes", () => {
    const fc = new FeedInConstraint();
    assert.throws(
      () =>
        fc.applySignal("enduser", {
          source: "steuerbox",
          mode: "curtailed",
          maxFeedInPercent: 0.6,
          receivedAt: new Date().toISOString(),
        }),
      ForbiddenFeedInWriteError,
    );
  });

  it("resolves percent curtailment against rated PV", () => {
    const fc = new FeedInConstraint();
    fc.applySignal("system", {
      source: "rundsteuerung",
      mode: "curtailed",
      maxFeedInPercent: 0.6,
      receivedAt: new Date().toISOString(),
    });
    assert.equal(fc.getMaxFeedInKw(10), 6);
  });

  it("zero mode yields 0 export", () => {
    const fc = new FeedInConstraint();
    fc.applySignal("system", {
      source: "steuerbox",
      mode: "zero",
      maxFeedInPercent: 0,
      receivedAt: new Date().toISOString(),
    });
    assert.equal(fc.getMaxFeedInKw(10), 0);
  });
});
