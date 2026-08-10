# Implementation Plan: Victron EMS — §14a + EEG §9

**Branch**: `001-ems-multiplus-wallbox` | **Date**: 2026-08-09 | **Spec**: [spec.md](./spec.md)

## Summary

EMS policy layer on Victron Venus for MultiPlus + MPPT + EV + heat pump:

- **§14a**: immutable offtake ceiling → limit EV, MultiPlus basic charger, HP on/off + levels  
- **§9**: immutable feed-in cap → `maxFeedInKw` to Multi/settings path  
- RBAC, audit, LAN MQTT; hardware paths remain authoritative without EMS

## Technical Context

**Language/Version**: TypeScript, Node.js ≥ 20 (ESM)  
**Primary Dependencies**: `mqtt`, workspace packages (+ `heatpump`)  
**Storage**: in-process audit MVP; SQLite later  
**Testing**: `node --import tsx --test` / `npm test`  
**Target Platform**: Linux EMS host, LAN to Cerbo  
**Project Type**: monorepo edge services  
**Performance Goals**: ≤1 Hz control tick  
**Constraints**: no enduser bypass of §14a/§9; no ESS Mode 2/3 required for MVP  
**Scale/Scope**: single residential plant

## Constitution Check

| Principle | Status |
|-----------|--------|
| I Dual immutable paths §14a+§9 | PASS |
| II Policy layer | PASS |
| III Test invariants | PASS (extend continuously) |
| IV Local-first | PASS |
| V Reference plant incl. HP | PASS |

## Project Structure

```text
packages/
  domain/ safety/ rules/ rbac/ victron-mqtt/ wallbox/ heatpump/
apps/
  collector/ controller/ api/
specs/001-ems-multiplus-wallbox/
docs/ PLAN.md
```

**Structure Decision**: extend existing workspaces; add `packages/heatpump`.

## Complexity Tracking

None requiring justification.
