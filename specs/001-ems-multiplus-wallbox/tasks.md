# Tasks: Victron EMS — §14a + EEG §9

**Input**: `/specs/001-ems-multiplus-wallbox/`

## Phase 1–2: Foundation

- [x] T001–T010 Monorepo, domain, GridConstraint, ActuatorGuard, RBAC, allocate, InMemory gateway

## Phase 3: Visibility (§14a + §9) — US1

- [x] T011–T017 Venus MQTT read path, collector, API status, enduser 403 on grid write
- [x] T040 FeedInConstraint + API `/feedin/signal` + status.feedIn
- [x] T041 Enduser 403 on feed-in write (tests)

## Phase 4: §14a EV limit — US2

- [x] T018–T022 Wallbox adapter + surplus + controller wiring

## Phase 5: §14a MultiPlus basic charger — US3

- [x] T042 `batteryGridChargeKw` in allocate/guard (lowest priority)
- [x] T043 Venus `applySetpoints` AC-in CurrentLimit when `enableMultiWrites`
- [ ] T044 Live verify CurrentLimit topic on target Venus firmware

## Phase 6: §14a Heat pump on/off + levels — US4

- [x] T045 `HeatPumpCommand` + `heatPumpCommandFromPower` in domain
- [x] T046 `packages/heatpump` InMemory + SG-Ready relay encode + CerboRelay adapter
- [x] T047 Controller applies HP command each tick
- [ ] T048 Document site wiring matrix K1/K2 ↔ WP terminals in `docs/`

## Phase 7: EEG §9 — US5

- [x] T049 `feedInSignalFromInputs` + FeedInConstraint percent/absolute
- [x] T050 Propagate `maxFeedInKw` through allocate/guard/API/controller
- [x] T051 Optional settings write path for MaxFeedInPower
- [ ] T052 Capture real Rundsteuerung/digitalinput fixture

## Phase 8: Polish

- [ ] T025 AUX/feed-in debounce
- [ ] T031 Persist audit store
- [ ] T034 Real auth replacing `X-Role`
- [ ] T035 Read-only status UI (both laws + HP level)
- [ ] T038 Live Cerbo converge (§14a + §9 + HP relays)

## Story order

```text
US1 → US2 → US3 → US4 → US5 → polish
```
