import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  asNumber,
  parseVenusPayload,
  parseVenusTopic,
  writeTopic,
} from "./topics.js";

describe("venus topics", () => {
  it("parses notify topics", () => {
    const p = parseVenusTopic("N/abc123/solarcharger/289/Yield/Power");
    assert.ok(p);
    assert.equal(p.service, "solarcharger");
    assert.equal(p.instance, "289");
    assert.equal(p.path, "Yield/Power");
  });

  it("parses payload value wrapper", () => {
    assert.equal(parseVenusPayload('{"value": 1500}'), 1500);
    assert.equal(asNumber(parseVenusPayload('{"value": true}')), 1);
  });

  it("builds write topics", () => {
    assert.equal(
      writeTopic("abc", "evcharger", 1, "SetCurrent"),
      "W/abc/evcharger/1/SetCurrent",
    );
  });
});
