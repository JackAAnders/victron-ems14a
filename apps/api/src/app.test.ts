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

describe("API RBAC", () => {
  it("rejects enduser grid writes with 403", async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/grid/signal`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-role": "enduser",
        },
        body: JSON.stringify({
          source: "aux",
          mode: "normal",
          maxSteuveGridKw: 99,
        }),
      });
      assert.equal(res.status, 403);
    });
  });

  it("allows enduser comfort write and status read", async () => {
    await withServer(async (base) => {
      const put = await fetch(`${base}/comfort`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-role": "enduser",
        },
        body: JSON.stringify({ wallboxKw: 6 }),
      });
      assert.equal(put.status, 200);

      const status = await fetch(`${base}/status`, {
        headers: { "x-role": "enduser" },
      });
      assert.equal(status.status, 200);
      const body = (await status.json()) as {
        grid: { writableByEnduser: boolean };
        wish: { wallboxKw: number };
      };
      assert.equal(body.grid.writableByEnduser, false);
      assert.equal(body.wish.wallboxKw, 6);
    });
  });

  it("control tick keeps effective power under ceiling", async () => {
    await withServer(async (base) => {
      const res = await fetch(`${base}/control/tick`, {
        method: "POST",
        headers: { "x-role": "enduser" },
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        ceilingKw: number;
        effective: {
          heatPumpKw: number;
          wallboxKw: number;
          batteryGridChargeKw: number;
        };
      };
      const sum =
        body.effective.heatPumpKw +
        body.effective.wallboxKw +
        body.effective.batteryGridChargeKw;
      assert.equal(body.ceilingKw, 4.2);
      assert.ok(sum <= 4.2 + 1e-9);
    });
  });
});
