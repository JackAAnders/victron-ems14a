# Data Model: 001-ems-multiplus-wallbox

## Enumerations

- **Role**: `enduser` | `installer` | `system`
- **GridMode** (§14a): `normal` | `limited` | `off`
- **FeedInMode** (§9): `normal` | `curtailed` | `zero`
- **HeatPumpSignalMode**: `off` | `on` | `level`
- **AuditKind**: `grid_signal` | `feedin_signal` | `setpoints_applied` | `bypass_denied` | `forbidden_write`

## GridSignal (§14a)

| Field | Type | Notes |
|-------|------|-------|
| source | GridSignalSource | aux/steuerbox/eebus/… |
| mode | GridMode | |
| maxSteuveGridKw | number | offtake ceiling |
| receivedAt | ISO | |

## FeedInSignal (§9)

| Field | Type | Notes |
|-------|------|-------|
| source | GridSignalSource | rundsteuerung/steuerbox/… |
| mode | FeedInMode | |
| maxFeedInPercent | number? | 0..1 of pvRatedKw |
| maxFeedInKw | number? | absolute override |
| receivedAt | ISO | |

## HeatPumpCommand

| Field | Type | Notes |
|-------|------|-------|
| mode | off/on/level | |
| level | 0..maxHeatPumpLevel | 0=off/blocked … 3=forced/max |
| powerKw | number | budget for ceiling math |

## PowerSetpoints

| Field | Type | Notes |
|-------|------|-------|
| heatPumpKw | number | |
| heatPump | HeatPumpCommand | on/off + levels |
| wallboxKw | number | EV limit |
| batteryGridChargeKw | number | MultiPlus basic charger |
| maxFeedInKw | number | §9 export cap |

## PlantState

Adds `pvRatedKw`, optional `heatPump`, `feedInKw` to prior MPPT/wallbox/battery/grid fields.

## Validation

- enduser MUST NOT write GridConstraint or FeedInConstraint
- grid-side steuVE ≤ §14a ceiling
- HP level encoding via adapter (default SG-Ready 2-bit)
