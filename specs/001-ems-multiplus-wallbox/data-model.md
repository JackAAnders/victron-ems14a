# Data Model: 001-ems-multiplus-wallbox

## Enumerations

- **Role**: `enduser` | `installer` | `system`
- **GridMode**: `normal` | `limited` | `off`
- **GridSignalSource**: `aux` | `eebus` | `steuerbox` | `manual_installer`
- **AuditKind**: `grid_signal` | `setpoints_applied` | `bypass_denied` | `forbidden_write`

## Entities

### MpptState

| Field | Type | Notes |
|-------|------|-------|
| id | string | Venus instance id |
| powerKw | number | from Yield/Power (W→kW) |
| state | number? | Victron charge state code |

### WallboxState

| Field | Type | Notes |
|-------|------|-------|
| id | string | |
| powerKw | number | measured |
| maxKw | number | from max current × volts × phases |
| connected | boolean | |
| charging | boolean | |

### PlantState

| Field | Type | Notes |
|-------|------|-------|
| pvKw | number | sum MPPT or system Dc/Pv |
| mppt | MpptState[]? | |
| houseLoadKw | number | consumption − wallbox |
| batterySocPercent | number | |
| batteryPowerKw | number | |
| gridPowerKw | number | import positive convention in EMS |
| wallbox | WallboxState? | |

### GridSignal

| Field | Type | Notes |
|-------|------|-------|
| source | GridSignalSource | never from enduser config |
| mode | GridMode | |
| maxSteuveGridKw | number | ceiling; Infinity when normal |
| receivedAt | ISO string | |

### UserComfortWish

| Field | Type | Notes |
|-------|------|-------|
| wallboxKw | number? | desire before clamp |
| priority | { heatPump, wallbox, batteryGridCharge }? | |
| wallboxReadyBy | ISO string? | deadline boost |

### PowerSetpoints

| Field | Type | Notes |
|-------|------|-------|
| heatPumpKw | number | MVP typically 0 |
| wallboxKw | number | |
| batteryGridChargeKw | number | |

### SafetyLimits

Defaults: SoC floor/ceiling, max wallbox/battery/HP kW, max write Hz.

### AuditEvent

| Field | Type | Notes |
|-------|------|-------|
| kind | AuditKind | |
| at | ISO string | |
| role | Role? | |
| detail | object | payload |

## Relationships

```text
GridSignal --(system apply)--> GridConstraint.ceiling
PlantState + UserComfortWish --> allocateUnderCeiling --> PowerSetpoints (requested)
requested + ceiling + surplus --> ActuatorGuard --> PowerSetpoints (effective)
effective.wallboxKw --> WallboxAdapter
effective --> VictronGateway.applySetpoints (soft/no-op MVP for Multi)
all mutations of interest --> AuditEvent[]
```

## Validation rules

- `enduser` MUST NOT create/update GridSignal.
- `effective` grid-side steuVE ≤ ceiling.
- Wallbox amps 0 or ≥ minCurrentA and ≤ maxCurrentA.
