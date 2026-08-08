# Tasks: Victron EMS MultiPlus + MPPT + Wallbox (§14a)

**Input**: Design documents from `/specs/001-ems-multiplus-wallbox/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Required for GridConstraint, ActuatorGuard, RBAC, surplus, API 403 (constitution III).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel
- **[Story]**: US1…US5
- Paths are repo-relative

## Phase 1: Setup (Shared Infrastructure)

- [x] T001 Create npm workspaces monorepo (`packages/*`, `apps/*`)
- [x] T002 [P] Add TypeScript base config `tsconfig.base.json`
- [x] T003 [P] Add `.env.example` and `deploy/docker-compose.yml`
- [x] T004 Initialize Spec Kit (`.specify/`, constitution, this feature)

---

## Phase 2: Foundational (Blocking Prerequisites)

- [x] T005 Create domain types in `packages/domain/src/index.ts`
- [x] T006 [P] Implement `GridConstraint` + tests in `packages/safety/`
- [x] T007 [P] Implement `ActuatorGuard` + tests in `packages/safety/`
- [x] T008 [P] Implement RBAC in `packages/rbac/`
- [x] T009 Implement `allocateUnderCeiling` in `packages/rules/src/allocate.ts`
- [x] T010 Implement `VictronGateway` port + `InMemoryVictronGateway`

**Checkpoint**: Foundation ready — stories can proceed

---

## Phase 3: User Story 1 - Live plant & grid status (P1) 🎯 MVP

**Goal**: Read/aggregate Cerbo state; show ceiling; block enduser grid writes

**Independent Test**: Collector/API status + 403 on enduser grid write

- [x] T011 [P] [US1] Venus topic parse/cache in `packages/victron-mqtt/src/topics.ts` + `cache.ts`
- [x] T012 [P] [US1] `plantStateFromCache` MPPT aggregation + tests
- [x] T013 [US1] AUX map `gridSignalFromAux` + tests
- [x] T014 [US1] `VenusMqttGateway` connect/subscribe/keepalive
- [x] T015 [US1] `apps/collector` snapshot loop
- [x] T016 [US1] `apps/api` `GET /status` with `writableByEnduser: false`
- [x] T017 [US1] API test: enduser `POST /grid/signal` → 403

**Checkpoint**: US1 demoable without wallbox writes

---

## Phase 4: User Story 2 - PV surplus wallbox (P1)

**Goal**: Surplus → wallbox setpoint with hysteresis / min current

- [x] T018 [P] [US2] `computePvSurplusKw` + tests in `packages/rules/src/surplus.ts`
- [x] T019 [P] [US2] `packages/wallbox` adapter + `kwToAmps` tests
- [x] T020 [US2] `VictronEvcsAdapter` SetCurrent publish
- [x] T021 [US2] Wire wallbox into `apps/controller/src/controlLoop.ts`
- [x] T022 [US2] Controller test: surplus raises wallbox under open ceiling path

**Checkpoint**: Demo controller shows wallboxSetKw from surplus

---

## Phase 5: User Story 3 - §14a ceiling enforcement (P1)

**Goal**: Limited/off modes clamp netzwirksamen Bezug; hardware AUX documented

- [x] T023 [US3] Guard + allocate under 4.2 kW fixtures
- [x] T024 [US3] Document physical AUX independence in `docs/ANLAGE-MULTIPLUS-MPPT-WALLBOX.md` + VNB checklist
- [ ] T025 [US3] Add debounce/hold for flapping AUX in `packages/victron-mqtt` (config: ms)
- [ ] T026 [US3] Integration fixture file from anonymized Cerbo MQTT capture under `packages/victron-mqtt/fixtures/`

**Checkpoint**: Simulated Steuerfall reproducible in tests

---

## Phase 6: User Story 4 - Installer mapping (P2)

**Goal**: Configure MQTT URL + digitalinput instances

- [x] T027 [US4] Env-driven AUX mapping in `apps/collector/src/main.ts`
- [ ] T028 [US4] Validate config on startup (clear error if URL invalid)
- [ ] T029 [US4] Installer-only config endpoint or documented file schema `docs/config-schema.md`

---

## Phase 7: User Story 5 - Audit & acceptance evidence (P2)

**Goal**: Durable audit for Abnahme

- [x] T030 [US5] In-process audit events on forbidden write / setpoints
- [ ] T031 [US5] Persist audits (SQLite) in `apps/api` or `packages/audit`
- [ ] T032 [US5] `GET /audit` installer-only per `contracts/api.md` extension
- [ ] T033 [US5] Fill software evidence section in `docs/vnb-checkliste.md` from a dry-run

---

## Phase 8: Polish & Cross-Cutting

- [ ] T034 Replace `X-Role` stub with token/basic auth for LAN deploy
- [ ] T035 [P] Status UI read-only grid (simple static/web app under `apps/web`)
- [ ] T036 [P] Docker host-network notes verified on EMS mini-PC
- [ ] T037 Run `/speckit-analyze` mentally: keep constitution I–III green
- [ ] T038 Converge: live Cerbo tick + wallbox SetCurrent observed in Venus

---

## Dependencies (story order)

```text
Phase 1–2 → US1 → US2 → US3 → (US4 ∥ US5) → Polish
```

## Parallel opportunities

- T011/T012/T018/T019 parallel after T010
- T031/T035/T036 parallel after US3 checkpoint

## Implementation status note

P1 core paths already exist in repo; remaining work focuses on debounce, fixtures, persistence, auth hardening, UI, and live Cerbo validation.
