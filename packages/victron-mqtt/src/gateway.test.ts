import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryVictronGateway } from "./index.js";

describe("InMemoryVictronGateway", () => {
  it("maps AUX limited to 4.2 kW ceiling signal", async () => {
    const gw = new InMemoryVictronGateway({ auxLimited: true, limitKw: 4.2 });
    const signal = await gw.readGridSignal();
    assert.ok(signal);
    assert.equal(signal.mode, "limited");
    assert.equal(signal.maxSteuveGridKw, 4.2);
  });
});
