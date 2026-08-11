# AGENTS.md

## Cursor Cloud specific instructions

`victron-ems14a` is a single TypeScript EMS product in an **npm-workspaces monorepo** (`packages/*` libraries + `apps/*` services). Node `>=20` is required (Node 22 is used here). Dependencies install with a plain `npm install` at the repo root; there are no databases or mandatory external services — every app has an in-memory fallback.

### Services / how to run (all via `tsx`, no build step needed)

Standard commands are already documented in [`README.md`](./README.md) and each workspace's `package.json` `scripts`. Key ones:

- API service: `npm start -w @victron-ems14a/api` → HTTP on `http://0.0.0.0:8787` (binds IPv4 by default; override with `HOST`/`PORT` env). Every request needs an `X-Role: enduser|installer|system` header; RBAC is enforced (e.g. `enduser` gets `403` on `grid:write`). Routes: `GET /health`, `GET /status`, `POST /grid/signal`, `POST /feedin/signal`, `PUT /comfort`, `POST /control/tick`. Note: `/` has no route and returns `404` by design — use `/health` or `/status`.
- Controller demo: `npm start -w @victron-ems14a/controller` → runs a single control tick and prints the clamped setpoints as JSON, then exits (it is a one-shot demo, not a long-running loop).
- Collector: `npm start -w @victron-ems14a/collector` → periodic plant-state dump. Runs against an in-memory demo plant unless `VENUS_MQTT_URL` is set (a real Victron Cerbo GX / Venus OS MQTT broker; optional, hardware-bound).
- Tests: `npm test` (root, all workspaces) uses Node's built-in `node:test` runner. All tests are in-memory and pass with only Node installed.

### Important gotcha: `build` / `typecheck` currently fail (pre-existing, not an environment problem)

`npm run build` and `npm run typecheck` (both run `tsc`) fail with a **pre-existing** compile error: `packages/safety/src/actuatorGuard.ts(72,11): error TS6133: 'hpFromGrid' is declared but its value is never read`. This is committed in the repo history (unrelated to environment setup). Because the apps and tests run through `tsx` (which strips types without type-checking), **runtime and `npm test` are unaffected** — the services run and all tests pass. Do not treat this as a broken environment; fix the unused variable in `actuatorGuard.ts` only if a task calls for a working `tsc` build.

### Viewing the API from a browser (cloud port-forwarding)

The API binds IPv4 `0.0.0.0` so port-forwarders that only detect IPv4 listeners can pick it up. If a local browser at `http://127.0.0.1:8787` still shows `ERR_CONNECTION_REFUSED` while the server is healthy inside the VM (`curl 127.0.0.1:8787/health` → 200), the browser↔VM tunnel isn't established — forward port `8787` from the editor's Ports panel, or open the URL in the in-VM Desktop/VNC browser (no tunnel needed). This is a forwarding-layer issue, not an app issue.

### `.env`

Copy `.env.example` to `.env` only when pointing at a live Cerbo (`VENUS_MQTT_URL`). Not needed for local dev, tests, or the demos above.
