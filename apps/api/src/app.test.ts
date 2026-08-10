import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAppState, createServerForState } from "./app.js";

async function withServer(
  fn: (base: string) => Promise<void>,
): Promise<void> {
  const state = createAppState();
  const server = createServerForState(state);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  if (!addr || typeof addr === "string") throw new Error("no address");
  const base = `http://127.0.0.1:${addr.port}`;
  try {
    await fn(base);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

describe("API RBAC §14a + §9", () => {
  it("rejects enduser grid and feed-in writes with 403", async () => {
    await withServer(async (base) => {
      const g = await fetch(`${base}/grid/signal`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-role": "enduser" },
        body: JSON.stringify({
          source: "aux",
          mode: "normal",
          maxSteuveGridKw: 99,
        }),
      });
      assert.equal(g.status, 403);

      const f = await fetch(`${base}/feedin/signal`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-role": "enduser" },
        body: JSON.stringify({
          source: "rundsteuerung",
          mode: "normal",
          maxFeedInPercent: 1,
        }),
      });
      assert.equal(f.status, 403);
    });
  });

  it("status exposes both laws as non-writable for enduser", async () => {
    await withServer(async (base) => {
      const status = await fetch(`${base}/status`, {
        headers: { "x-role": "enduser" },
      });
      assert.equal(status.status, 200);
      const body = (await status.json()) as {
        grid: { writableByEnduser: boolean; law: string };
        feedIn: { writableByEnduser: boolean; law: string; maxFeedInKw: number };
      };
      assert.equal(body.grid.writableByEnduser, false);
      assert.equal(body.feedIn.writableByEnduser, false);
      assert.match(body.grid.law, /14a/);
      assert.match(body.feedIn.law, /§9|EEG/);
      assert.equal(body.feedIn.maxFeedInKw, 6);
    });
  });

  it("control tick returns HP command and feed-in cap", async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/control/tick`, {
        method: "POST",
        headers: { "x-role": "enduser" },
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        ceilingKw: number;
        maxFeedInKw: number;
        effective: {
          heatPump: { mode: string; level?: number };
          wallboxKw: number;
          batteryGridChargeKw: number;
        };
      };
      assert.equal(body.ceilingKw, 4.2);
      assert.equal(body.maxFeedInKw, 6);
      assert.ok(body.effective.heatPump);
    });
  });
});
