# Implementation Plan: Victron EMS MultiPlus + MPPT + Wallbox (§14a)

**Branch**: `001-ems-multiplus-wallbox` | **Date**: 2026-08-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-ems-multiplus-wallbox/spec.md`

## Summary

Deliver a Node.js/TypeScript EMS policy layer on Victron Venus (Cerbo) for MultiPlus + MPPT + Wallbox: read MQTT telemetry, map AUX to immutable GridConstraint, allocate PV-surplus and §14a-limited wallbox power through ActuatorGuard, expose RBAC-protected API, and keep hardware AUX independent of EMS process health.

## Technical Context

**Language/Version**: TypeScript on Node.js ≥ 20 (ESM)

**Primary Dependencies**: `mqtt`, workspace packages (`domain`, `safety`, `rules`, `rbac`, `victron-mqtt`, `wallbox`), Node `node:test` + `tsx`

**Storage**: MVP audit in-memory / stdout; optional SQLite/Postgres later (not blocking P1)

**Testing**: `npm test` via `node --import tsx --test` per workspace

**Target Platform**: Linux EMS host on same LAN as Cerbo (Docker optional, host network for MQTT)

**Project Type**: Monorepo edge service (packages + apps); no mobile app in MVP

**Performance Goals**: Control tick ≤ 1 Hz typical; MQTT keepalive ~30 s; p95 tick compute ≪ 100 ms on Pi-class CPU

**Constraints**: No enduser MQTT write ACL; no ESS Mode 2/3 required for MVP; local-first; fail-safe must not defeat AUX

**Scale/Scope**: Single residential plant; 1 Multi (1P/3P), 1–N MPPT, 1 wallbox

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. GridControl immutable for enduser | PASS | RBAC + GridConstraint + API 403 |
| II. Policy layer above ESS | PASS | Mode 1; wallbox primary write |
| III. Test-backed invariants | PASS | Existing + extended tests required in tasks |
| IV. Local-first / least privilege | PASS | `.env` LAN MQTT; API role header → real auth later |
| V. Simplicity reference plant | PASS | HP max 0 in controller defaults |

No CRITICAL violations. Auth header `X-Role` is a stub — production auth tracked as follow-up task (not a constitution breach if documented).

## Project Structure

### Documentation (this feature)

```text
specs/001-ems-multiplus-wallbox/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── api.md
├── checklist.md
├── tasks.md
└── spec.md
```

### Source Code (repository root)

```text
packages/
├── domain/           # PlantState, GridSignal, AuditEvent, roles
├── safety/           # GridConstraint, ActuatorGuard
├── rules/            # allocateUnderCeiling, computePvSurplusKw
├── rbac/             # can/assertCan
├── victron-mqtt/     # VenusMqttGateway, cache, AUX map
└── wallbox/          # WallboxAdapter, VictronEvcsAdapter
apps/
├── collector/        # read-only snapshots
├── controller/       # control loop
└── api/              # HTTP status/comfort/grid
deploy/docker-compose.yml
docs/                 # Anlage, VNB checklist, IMPLEMENTATION
```

**Structure Decision**: Keep npm workspaces monorepo already in repo; extend packages rather than greenfield `src/`.

## Complexity Tracking

> No constitution violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| — | — | — |
