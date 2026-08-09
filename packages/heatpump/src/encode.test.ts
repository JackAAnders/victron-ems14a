import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeSgReadyRelays, InMemoryHeatPumpAdapter } from "./index.js";

describe("encodeSgReadyRelays", () => {
  it("encodes off as 00", () => {
    assert.deepEqual(encodeSgReadyRelays({ mode: "off", level: 0, powerKw: 0 }), [
      false,
      false,
    ]);
  });

  it("encodes level 3 as 11", () => {
    assert.deepEqual(
      encodeSgReadyRelays({ mode: "level", level: 3, powerKw: 4 }),
      [true, true],
    );
  });
});

describe("InMemoryHeatPumpAdapter", () => {
  it("stores last command", async () => {
    const hp = new InMemoryHeatPumpAdapter();
    await hp.apply({ mode: "on", level: 1, powerKw: 2 });
    assert.equal(hp.getLastCommand()?.mode, "on");
  });
});
