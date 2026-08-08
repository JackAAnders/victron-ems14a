import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertCan, can } from "./index.js";

describe("rbac", () => {
  it("enduser cannot write grid", () => {
    assert.equal(can("enduser", "grid:write"), false);
    assert.throws(() => assertCan("enduser", "grid:write"));
  });

  it("enduser may write comfort and read grid status", () => {
    assert.equal(can("enduser", "comfort:write"), true);
    assert.equal(can("enduser", "grid:read"), true);
  });

  it("system may write grid", () => {
    assert.equal(can("system", "grid:write"), true);
  });
});
