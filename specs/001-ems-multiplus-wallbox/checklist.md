# Quality Checklist: 001-ems-multiplus-wallbox

## Spec quality

- [x] User stories prioritized (P1/P2) and independently testable
- [x] Acceptance scenarios in Given/When/Then form
- [x] Edge cases listed
- [x] Functional requirements numbered (FR-001+)
- [x] Success criteria measurable and tech-agnostic where required
- [x] Assumptions explicit (ESS Mode 1, German §14a AUX, Victron EVCS)

## Constitution alignment

- [x] Enduser cannot modify GridControl (I)
- [x] EMS is policy layer over Victron ESS (II)
- [x] Invariants covered by tests (III)
- [x] Local-first MQTT / least privilege (IV)
- [x] Reference plant MultiPlus+MPPT+Wallbox (V)

## Plan / design

- [x] Technical context filled (no NEEDS CLARIFICATION left for MVP)
- [x] Constitution Check table completed
- [x] data-model.md matches domain package
- [x] API contract documents 403 for grid writes
- [x] quickstart runnable

## Gaps to close in tasks

- [ ] Replace `X-Role` stub with real auth before production exposure
- [ ] Persist audit beyond process memory
- [ ] Live fixture capture from a real Cerbo
- [ ] Debounce policy for flapping AUX formalized in code
