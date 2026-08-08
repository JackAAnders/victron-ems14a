<!--
Sync Impact Report
- Version change: (template) → 1.0.0
- Modified principles: placeholders → project-specific I–V
- Added sections: Grid Control & Compliance; Security & Privacy; Development Workflow
- Removed sections: none
- Follow-up TODOs: none
-->

# victron-ems14a Constitution

Binding principles for the Victron MultiPlus + MPPT + Wallbox energy management system (EMS) with §14a EnWG grid control. All specs, plans, tasks, and code changes MUST comply.

## Core Principles

### I. GridControl Immutability for End Users (NON-NEGOTIABLE)

The netzwirksame §14a / VNB control path (GridControl) MUST NOT be disableable, raisable, or bypassable by the end-user role. End-user interfaces are read-only for grid limits. Comfort wishes are applied only under `gridCeiling`. Physical AUX/Steuerbox → MultiPlus MUST remain effective even if the EMS process is down.

**Rationale**: VNB acceptance and legal Steuerbarkeit require non-modifiable customer access to the control function.

### II. Policy Layer Above Victron ESS

Victron Venus/Cerbo remains the energetic system of record (MultiPlus ESS, MPPT via DVCC, meters). The EMS is a policy layer: read plant state, enforce GridConstraint + SafetyLimits, allocate under ceiling, write wallbox (and only carefully other setpoints). Prefer ESS Mode 1 for MVP; ESS Mode 2/3 external control requires explicit design and fail-safes.

**Rationale**: Avoid fighting or replacing Victron’s proven ESS loop; reduce brick/risk of unsafe writes.

### III. Test-Backed Safety Invariants (NON-NEGOTIABLE)

Changes that touch GridConstraint, ActuatorGuard, RBAC, AUX mapping, or wallbox setpoints MUST include automated tests for invariants:

- Ceiling never sourced from end-user config
- `enduser` denied grid writes
- Netzwirksamer SteuVE-Bezug ≤ ceiling (PV surplus may exceed for flexible loads)
- Bypass attempts audited

`npm test` MUST pass before merge.

**Rationale**: Incorrect control logic harms comfort, compliance, and equipment.

### IV. Local-First & Least Privilege

MQTT and control traffic stay on the LAN by default. End-user clients MUST NOT hold raw MQTT write ACLs; they use the EMS API. Service accounts for Cerbo writes are separated from end-user credentials. No internet-exposed broker.

**Rationale**: Tamper resistance and privacy of load profiles.

### V. Simplicity for the Reference Plant

Primary plant: MultiPlus + MPPT(s) + Wallbox (+ Cerbo + grid meter + battery). Heat pumps and other SteuVE are optional extensions. Avoid scope that is not needed for §14a + surplus wallbox charging. Prefer pure functions in `packages/rules` and `packages/safety` over opaque frameworks.

**Rationale**: Faster validation on real hardware; clearer VNB narrative.

## Grid Control & Compliance

- Document physical signal path (Steuerbox → AUX) and software mapping (digitalinput → GridSignal).
- Produce audit events for grid signals, applied setpoints, and forbidden writes.
- VNB checklist items in `docs/vnb-checkliste.md` guide acceptance evidence; EMS does not replace Elektrofachkraft or VNB process.
- No legal advice in code comments pretending to be counsel; link to operator docs.

## Security & Privacy

- Roles: `enduser` | `installer` | `system`.
- Installer access time-bounded where practical; credentials not shipped in end-user docs.
- Persist only operational data needed for control and audit; retention configurable.
- Fail-safe: on EMS/MQTT loss, do not remove hardware AUX enforcement; avoid unbounded write rates.

## Development Workflow

- Spec Kit workflow: constitution → specify → plan → tasks → implement → converge.
- Feature work lives under `specs/NNN-short-name/` with `spec.md`, `plan.md`, `tasks.md`.
- Existing narrative docs (`PLAN.md`, `docs/ANLAGE-*.md`) remain reference; Spec Kit artifacts are authoritative for agent-driven delivery of a feature.
- Prefer TypeScript Node.js monorepo (`packages/*`, `apps/*`) unless a constitution amendment says otherwise.

## Governance

- This constitution supersedes informal README shortcuts when they conflict.
- Amendments require a PR, Sync Impact Report (HTML comment at top), and semantic version bump:
  - MAJOR: remove/redefine a NON-NEGOTIABLE principle
  - MINOR: add principle or material section
  - PATCH: clarification only
- `/speckit.analyze` and plan Constitution Check MUST treat violations of I–III as CRITICAL.

**Version**: 1.0.0 | **Ratified**: 2026-08-08 | **Last Amended**: 2026-08-08
