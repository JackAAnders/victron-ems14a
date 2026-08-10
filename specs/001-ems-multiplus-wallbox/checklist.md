# Quality Checklist: 001-ems-multiplus-wallbox

## Spec quality

- [x] §14a and EEG §9 both specified
- [x] User stories for EV limit, MultiPlus charger, HP on/off+levels
- [x] Acceptance criteria / FRs / success metrics
- [x] Enduser non-modifiability for both laws

## Constitution alignment

- [x] Dual immutable paths (I)
- [x] Policy layer (II)
- [x] Tests for feed-in + HP + charger (III)
- [x] Local-first (IV)
- [x] Plant scope includes HP (V)

## Gaps

- [ ] Live Venus topic verification (CurrentLimit / MaxFeedInPower)
- [ ] Site-specific WP relay wiring sheet
- [ ] Durable audit + real auth
