<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0
- Modified principles: I (add EEG §9), V (HP + MultiPlus charger in scope)
- Added sections: Dual legal control paths (§14a + §9)
- Removed sections: none
- Follow-up TODOs: site-specific relay/feed-in topic mapping
-->

# victron-ems14a Constitution

Binding principles for the Victron MultiPlus + MPPT + Wallbox (+ heat pump) EMS with **EnWG §14a** and **EEG §9** grid interfaces. All specs, plans, tasks, and code changes MUST comply.

## Core Principles

### I. Dual Grid Paths Immutable for End Users (NON-NEGOTIABLE)

Two independent, enduser-immutable control paths exist:

1. **EnWG §14a (GridControl)** – limits netzwirksamen SteuVE offtake (ceiling kW): MultiPlus grid charging, EV charger, heat pump.
2. **EEG §9 (FeedInControl)** – limits feed-in / export to the public grid (percent or absolute kW).

End-user UIs are read-only for both. Comfort wishes apply only under active ceilings. Physical Steuerbox/AUX/Rundsteuerung paths MUST remain effective if the EMS process is down.

**Rationale**: VNB/MSB acceptance and statutory Steuerbarkeit / Einspeisemanagement.

### II. Policy Layer Above Victron ESS

Victron Venus/Cerbo remains system of record. EMS reads plant state and writes: EV charge limit, MultiPlus basic charger / AC-in current limit, heat-pump on/off + discrete levels (relay/SG-Ready), and feed-in cap setpoints. Prefer ESS Mode 1 for MVP.

### III. Test-Backed Safety Invariants (NON-NEGOTIABLE)

Changes touching GridConstraint, FeedInConstraint, ActuatorGuard, RBAC, AUX/feed-in mapping, wallbox, MultiPlus charger limits, or heat-pump signalling MUST include automated tests:

- Ceilings never from enduser config (§14a and §9)
- `enduser` denied writes to both paths
- Netzwirksamer SteuVE-Bezug ≤ §14a ceiling
- Feed-in cap propagated to setpoints
- Bypass attempts audited

`npm test` MUST pass before merge.

### IV. Local-First & Least Privilege

MQTT/control on LAN; enduser clients use EMS API only (no raw MQTT write ACL).

### V. Reference Plant Scope

In scope: MultiPlus (+ basic charger limit), MPPT(s), EV charger limit, heat pump on/off and dedicated levels, Cerbo, grid meter, battery. Prefer pure functions in `packages/rules` and `packages/safety`.

## Dual Legal Control Paths

| Law | EMS object | Actuators |
|-----|------------|-----------|
| EnWG §14a | `GridConstraint` | EV limit, MultiPlus grid charge, HP on/off/levels |
| EEG §9 | `FeedInConstraint` | max feed-in kW / % toward Multi/settings / MPPT curtailment path |

Allocation under §14a: prefer heat pump (comfort) → EV → MultiPlus grid charge last. PV surplus may supply flexible loads above the §14a grid ceiling.

## Security & Privacy

Roles: `enduser` | `installer` | `system`. Fail-safe must not defeat hardware AUX / Rundsteuerung.

## Development Workflow

Spec Kit: constitution → specify → plan → tasks → implement → converge. Feature docs under `specs/NNN-*/` are authoritative for agent delivery; `PLAN.md` / `docs/*` remain narrative reference.

## Governance

Constitution supersedes informal shortcuts on conflict. Amendments require PR + Sync Impact Report + semver (MAJOR for NON-NEGOTIABLE changes).

**Version**: 1.1.0 | **Ratified**: 2026-08-08 | **Last Amended**: 2026-08-09
