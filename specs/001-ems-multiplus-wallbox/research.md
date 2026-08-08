# Research: 001-ems-multiplus-wallbox

## Decisions

### D1 — EMS as policy layer (not ESS Mode 3 by default)

- **Decision**: MVP keeps Victron ESS Mode 1 (Optimized); EMS primarily controls wallbox and reads Multi/MPPT/grid; AUX enforces §14a in hardware.
- **Alternatives**: ESS Mode 2/3 with AcPowerSetpoint for full external control.
- **Rationale**: Lower risk, matches constitution II; Mode 2/3 needs stronger watchdogs later.

### D2 — Venus local MQTT as primary integration

- **Decision**: Use Cerbo local MQTT (`mqtt` npm) with notify cache + keepalive `R/<portal>/keepalive`.
- **Alternatives**: Modbus-TCP only; VRM cloud API; dbus on-device scripts.
- **Rationale**: Rich topic coverage for solarcharger/evcharger/system; LAN local-first.

### D3 — Two-level control: GridConstraint vs UserComfort

- **Decision**: Enforce VNB ceiling in `GridConstraint`/`ActuatorGuard`; enduser only writes comfort under RBAC.
- **Alternatives**: Single config blob editable in UI.
- **Rationale**: Constitution I / VNB non-modifiability.

### D4 — PV surplus for wallbox with hysteresis + min 6 A

- **Decision**: `computePvSurplusKw` + `kwToAmps` stop below EVSE minimum.
- **Alternatives**: Continuous sub-6A setpoints; frequency-based AC coupling tricks.
- **Rationale**: Avoid charger flap; matches common EVSE behavior.

### D5 — In-memory gateway for CI

- **Decision**: `InMemoryVictronGateway` + `InMemoryWallboxAdapter` for deterministic tests.
- **Alternatives**: Require live Cerbo in CI.
- **Rationale**: Offline CI; constitution III.

## Open points (site-specific)

- Exact `digitalinput` instance numbers for AUX mirrors on a given Cerbo/Multi firmware.
- Victron EVCS MQTT write path name (`SetCurrent`) verification on target firmware.
- 1P vs 3P wallbox electrical config in `.env` / config file.
