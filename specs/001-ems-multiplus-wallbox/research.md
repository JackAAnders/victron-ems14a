# Research: 001-ems-multiplus-wallbox (§14a + §9)

## Decisions

### D1 — Two constraint objects

- **Decision**: Separate `GridConstraint` (EnWG §14a offtake) and `FeedInConstraint` (EEG §9 export).
- **Rationale**: Different legal actuators and semantics; both enduser-immutable.

### D2 — §14a actuator set

- **Decision**: EV charge limit + MultiPlus basic charger (AC-in current) + HP on/off and discrete levels.
- **Rationale**: Matches user requirement; charger last in priority so comfort loads win under ceiling.

### D3 — Heat pump levels as SG-Ready-like 2-bit

- **Decision**: Levels 0–3 → relay pairs 00/10/01/11 via `encodeSgReadyRelays`.
- **Alternatives**: Modbus OEM APIs; single contactor only.
- **Rationale**: Common WP interface; simple on/off is level 0 vs ≥1.

### D4 — §9 as maxFeedInKw into settings/Multi path

- **Decision**: Resolve % of `pvRatedKw` or absolute kW; publish when `enableMultiWrites`.
- **Rationale**: Aligns with Venus feed-in limitation patterns; exact path configurable.

### D5 — ESS Mode 1 remains default

- Unchanged; avoid Mode 2/3 until fail-safes mature.
