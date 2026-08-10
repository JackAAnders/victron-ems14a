# Feature Specification: Victron EMS — §14a + EEG §9 (MultiPlus, EV, Heat Pump)

**Feature Branch**: `001-ems-multiplus-wallbox`

**Created**: 2026-08-08

**Updated**: 2026-08-09

**Status**: Draft

**Input**: Extend EMS for EnWG §14a and EEG §9. For §14a support basic MultiPlus charger limiting, EV-charger limiting, and heat-pump signalling with simple on/off as well as dedicated levels.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See §14a and §9 constraints (Priority: P1)

As an end user or installer, I can see live plant data plus whether **§14a offtake** and **§9 feed-in** constraints are active (ceiling / max export), without being able to change either.

**Why this priority**: Trust, debugging, VNB/MSB evidence.

**Independent Test**: `/status` shows `grid.law` §14a and `feedIn.law` §9, both `writableByEnduser: false`.

**Acceptance Scenarios**:

1. **Given** Cerbo or demo gateway, **When** status is read, **Then** PV/SoC/wallbox and both constraint blocks are present.
2. **Given** role `enduser`, **When** `POST /grid/signal` or `POST /feedin/signal`, **Then** 403 + audit.

---

### User Story 2 - §14a: limit EV charger (Priority: P1)

As the grid operator path asserts a §14a limit, the EMS reduces EV charge power so netzwirksamer wallbox grid draw respects the ceiling; PV surplus may still charge the EV.

**Independent Test**: limit 4.2 kW, 0 surplus, wish 11 kW → effective wallbox ≤ 4.2 kW.

---

### User Story 3 - §14a: MultiPlus basic charger function (Priority: P1)

Under §14a, the EMS limits **MultiPlus grid-side battery charging** (basic charger / AC-in charge limit) as part of the steuVE budget, with lowest priority after heat pump and EV.

**Independent Test**: tight ceiling with HP+EV demand → `batteryGridChargeKw` cut first; gateway records charger setpoint.

---

### User Story 4 - §14a: heat pump on/off and levels (Priority: P1)

The EMS signals a heat pump with:

- simple **on/off**, and
- **dedicated discrete levels** (SG-Ready-like 0–3 via two relays),

derived from allocated HP power under the §14a ceiling. End user may prefer a level only within the allowed budget.

**Independent Test**: allocated HP power > 0 → command `level`/`on`; ceiling 0 → `off` relays 00.

---

### User Story 5 - EEG §9 feed-in management (Priority: P1)

When a §9 curtailment/zero signal is active, the EMS sets `maxFeedInKw` (from % of rated PV or absolute) and applies it on the Multi/settings path; enduser cannot clear it.

**Independent Test**: curtailed 60% of 10 kWp → maxFeedInKw = 6; enduser feed-in write → 403.

---

### User Story 6 - PV surplus to EV when unconstrained (Priority: P2)

Without binding offtake limit (or within remaining room), EV uses MPPT surplus with hysteresis / min current.

---

### User Story 7 - Installer mapping & audit (Priority: P2)

Installer maps AUX/digital inputs for §14a and §9, verifies Steuerfall, exports audit of grid/feed-in/setpoints/denials.

---

### Edge Cases

- Simultaneous §14a limit and §9 zero export.
- HP level request above budget → clamped level/off.
- MQTT loss: hardware AUX/Rundsteuerung still authoritative.
- Multiple MPPTs; rated PV missing → fall back carefully for % curtailment.
- EV below min current → off rather than flap.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST implement EnWG §14a `GridConstraint` (normal/limited/off + ceiling kW), immutable for enduser.
- **FR-002**: System MUST implement EEG §9 `FeedInConstraint` (normal/curtailed/zero + % or kW), immutable for enduser.
- **FR-003**: System MUST limit EV charger power under §14a via WallboxAdapter.
- **FR-004**: System MUST limit MultiPlus basic grid charging under §14a (`batteryGridChargeKw` / AC-in current limit).
- **FR-005**: System MUST signal heat pump on/off and discrete levels (adapter: relays / SG-Ready encoding).
- **FR-006**: System MUST allocate under §14a with priority heat pump → EV → MultiPlus charger.
- **FR-007**: System MUST allow PV surplus to supply EV/HP above §14a grid ceiling where applicable.
- **FR-008**: System MUST propagate §9 max feed-in into setpoints and Multi/settings write path when enabled.
- **FR-009**: System MUST expose status for both laws and reject enduser writes (403).
- **FR-010**: System MUST audit grid_signal, feedin_signal, setpoints_applied, bypass/forbidden.
- **FR-011**: Demo/in-memory mode MUST cover §14a + §9 + HP without Cerbo.
- **FR-012**: Docs MUST describe physical independence of AUX / Rundsteuerung from EMS.

### Key Entities

- GridSignal / GridConstraint (§14a)
- FeedInSignal / FeedInConstraint (§9)
- HeatPumpCommand (off|on|level)
- PowerSetpoints (HP, EV, MultiPlus charger, maxFeedInKw)
- PlantState, UserComfortWish, AuditEvent, adapters

## Success Criteria *(mandatory)*

- **SC-001**: Invariant tests for FR-001–FR-005 pass in `npm test`.
- **SC-002**: Under 4.2 kW §14a and 0 surplus, sum of grid-side steuVE setpoints ≤ 4.2 kW.
- **SC-003**: §9 60% of 10 kW rated → maxFeedInKw = 6 in tick/status.
- **SC-004**: Enduser grid and feed-in writes → HTTP 403.
- **SC-005**: HP off when budget 0; level encoding 00/10/01/11 testable.
- **SC-006**: MultiPlus charger setpoint present in effective setpoints under §14a.

## Assumptions

- German VNB/MSB context; 2-bit/AUX and Rundsteuerung/digital inputs today; EEBus later on same ports.
- Heat pump uses two potential-free contacts or Cerbo relays (SG-Ready-like).
- Victron EVCS or WallboxAdapter; MultiPlus ESS Mode 1 for MVP.
- Percent curtailment needs configured `pvRatedKw`.
- Not legal advice; operator docs / VNB rules prevail.
