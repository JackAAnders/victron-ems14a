# Feature Specification: Victron EMS MultiPlus + MPPT + Wallbox (§14a)

**Feature Branch**: `001-ems-multiplus-wallbox`

**Created**: 2026-08-08

**Status**: Draft

**Input**: User description: "Energy management system for Victron MultiPlus with MPPT controllers and wallbox, including non-modifiable §14a grid control for end users, PV surplus charging, RBAC, and Cerbo MQTT integration."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See live plant and grid constraint (Priority: P1)

As an end user or installer, I can see live PV (MPPT aggregate), house load, battery SoC, grid power, wallbox power, and whether a grid constraint (§14a) is active including the allowed ceiling — without being able to change that ceiling.

**Why this priority**: Visibility is the foundation for trust, debugging, and VNB evidence; no actuation risk.

**Independent Test**: Run collector/API against Cerbo or fixtures; status shows plant fields and `writableByEnduser: false` for grid.

**Acceptance Scenarios**:

1. **Given** Cerbo MQTT is reachable, **When** the collector/API reads state, **Then** aggregated MPPT power and battery SoC are shown within expected tolerance of Venus UI.
2. **Given** AUX/limited input is active, **When** status is read, **Then** grid mode is `limited` (or equivalent) and ceiling equals the configured limit (e.g. 4.2 kW).
3. **Given** role `enduser`, **When** a grid-limit write is attempted, **Then** the system rejects it and records a tamper/forbidden audit event.

---

### User Story 2 - Charge EV from PV surplus (Priority: P1)

As an end user, when there is PV surplus (MPPT production above house load excluding wallbox), the EMS raises wallbox charge power toward that surplus (respecting EVSE min current), and lowers/stops it when surplus disappears, with hysteresis to avoid flapping.

**Why this priority**: Core economic/comfort value of the MultiPlus+MPPT+Wallbox plant.

**Independent Test**: Fixture or demo plant with PV=5 kW, house=0.5 kW, no §14a limit → wallbox setpoint approaches surplus; drop PV → setpoint falls to 0 after hysteresis rules.

**Acceptance Scenarios**:

1. **Given** surplus ≥ EVSE minimum power, **When** a control tick runs, **Then** wallbox target uses surplus (not forced from battery/grid beyond comfort rules).
2. **Given** surplus below hysteresis / below min current, **When** a control tick runs, **Then** wallbox target is 0 (no flap at 1–5 A).
3. **Given** wallbox adapter connected, **When** effective setpoint is computed, **Then** adapter receives the guarded kW/A command.

---

### User Story 3 - Obey §14a ceiling without end-user bypass (Priority: P1)

As the grid operator (via Steuerbox/AUX), when a limit or off signal is active, the EMS ensures netzwirksamer SteuVE grid draw (wallbox + battery grid charge, etc.) does not exceed the ceiling; PV surplus may still feed the wallbox. The end user cannot raise or clear the ceiling.

**Why this priority**: Compliance / VNB acceptance; NON-NEGOTIABLE per constitution.

**Independent Test**: Simulate limited=4.2 kW with high wallbox wish and zero PV → effective grid-side steuVE ≤ 4.2 kW; enduser POST to grid endpoint → 403.

**Acceptance Scenarios**:

1. **Given** mode `limited` at 4.2 kW and no PV surplus, **When** user wishes 11 kW wallbox, **Then** effective wallbox (grid-side) ≤ 4.2 kW.
2. **Given** mode `limited` and PV surplus 4.5 kW, **When** allocating, **Then** wallbox may exceed 4.2 kW total by using surplus while grid-side share stays ≤ ceiling.
3. **Given** mode `off`, **When** allocating, **Then** wallbox grid draw and battery grid charge targets are 0.
4. **Given** EMS process stopped, **When** AUX is asserted at MultiPlus, **Then** Victron hardware reaction still applies (documented physical path; not EMS-dependent).

---

### User Story 4 - Installer commissioning & mapping (Priority: P2)

As an installer, I can configure Venus MQTT URL, portal ID, and which digital input instances map to limited/off, then verify a simulated or real Steuerfall.

**Why this priority**: Needed for site bring-up; not required for pure demo mode.

**Independent Test**: `.env` mapping → limited input high → ceiling 4.2 in status; wrong instance → remains normal (documented).

**Acceptance Scenarios**:

1. **Given** valid `.env` / config, **When** collector starts, **Then** it connects and prints/returns plant snapshots.
2. **Given** installer role, **When** bootstrap/manual mapping is needed, **Then** only installer/system may inject grid signals — not enduser.

---

### User Story 5 - Audit and acceptance evidence (Priority: P2)

As an operator/installer preparing VNB acceptance, I can export or view an audit trail of grid signals, applied setpoints, and denied bypass attempts.

**Why this priority**: Supports Abnahme; secondary to live control.

**Independent Test**: Trigger forbidden write + limited signal → audit contains both event kinds with timestamps.

**Acceptance Scenarios**:

1. **Given** a control tick under limit, **When** setpoints apply, **Then** an audit event records ceiling and effective setpoints.
2. **Given** enduser bypass attempt, **When** rejected, **Then** audit kind is forbidden/bypass and visible to installer.

---

### Edge Cases

- MQTT disconnect mid-control: no unbounded retries that spam writes; wallbox left at last guarded value or safe stop policy documented.
- Multiple MPPTs: aggregate Yield/Power; one offline MPPT does not zero the others.
- Wallbox reports not connected: do not count phantom load; skip or zero charge commands.
- SoC at floor: do not grid-charge battery; wallbox surplus charging may continue if PV allows.
- 3-phase vs 1-phase wallbox: current conversion uses configured phases/volts.
- Flapping AUX: debounce/sticky behavior documented (minimum: persist last valid signal until timeout policy defined).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST read plant telemetry from Victron Venus/Cerbo (at least PV/MPPT, battery SoC, grid, consumption, wallbox if present).
- **FR-002**: System MUST map configured AUX/digital inputs to a grid constraint (normal / limited / off) with a numeric ceiling in kW.
- **FR-003**: System MUST refuse grid-constraint modifications by role `enduser`.
- **FR-004**: System MUST clamp all steuVE setpoints so netzwirksamer grid draw ≤ ceiling (PV surplus may supply flexible loads above ceiling).
- **FR-005**: System MUST compute PV surplus as max(0, PV − house load excluding wallbox) with hysteresis and EVSE minimum current behavior.
- **FR-006**: System MUST apply wallbox setpoints through an adapter interface (Victron EVCS and test double).
- **FR-007**: System MUST expose a status API/view including ceiling and `writableByEnduser: false` for grid.
- **FR-008**: System MUST allow enduser comfort wishes (e.g. desired wallbox kW / priority) only under the guard.
- **FR-009**: System MUST emit audit events for grid signals, applied setpoints, and forbidden writes.
- **FR-010**: System MUST support an offline/demo mode (in-memory gateway) for tests without Cerbo.
- **FR-011**: MultiPlus ESS remains responsible for core battery/grid balance in MVP; EMS MUST NOT require ESS Mode 2/3 for the first accepted delivery.
- **FR-012**: Documentation MUST describe physical AUX wiring independence from EMS for VNB checklist.

### Key Entities

- **PlantState**: Snapshot of PV/MPPTs, house load, battery, grid, wallbox.
- **GridSignal / GridConstraint**: Authoritative ceiling and mode from VNB path.
- **UserComfortWish**: End-user preferences under ceiling.
- **PowerSetpoints**: heatPump (optional), wallbox, batteryGridCharge.
- **AuditEvent**: Tamper-evident operational log record.
- **WallboxAdapter**: Port to set charge power/current.
- **VictronGateway**: Port to Cerbo MQTT or in-memory fake.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With fixtures, 100% of automated invariant tests for FR-003/FR-004 pass in CI (`npm test`).
- **SC-002**: Demo control tick with PV surplus produces wallbox setpoint ≥ surplus − hysteresis band when unconstrained.
- **SC-003**: Under 4.2 kW limit and 0 surplus, effective grid-side steuVE power ≤ 4.2 kW on every tick.
- **SC-004**: Enduser grid write attempts return HTTP 403 (or equivalent) in API tests.
- **SC-005**: Installer can obtain a status snapshot from Cerbo within one collector interval after connect (when URL configured).
- **SC-006**: VNB checklist has a completed software evidence section (audit + non-modifiable UI/API) for a simulated Steuerfall.

## Assumptions

- Reference plant is German grid context with §14a-style 2-bit/AUX today; EEBus may come later via the same GridConstraint port.
- Cerbo local MQTT is available on LAN; portal ID discoverable from notify topics if not preconfigured.
- Wallbox is Victron EVCS or any adapter implementing the same interface; Drittanbieter adapters are follow-on.
- Heat pump is out of scope for MVP allocation (max 0) but data model may keep the field.
- Physical AUX commissioning is performed by Elektrofachkraft; software assumes mapped digital inputs.
- Existing monorepo packages (`domain`, `safety`, `rules`, `rbac`, `victron-mqtt`, `wallbox`, apps) are the implementation baseline.
