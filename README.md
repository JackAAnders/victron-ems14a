# victron-ems14a

Energiemanagementsystem für Victron-ESS mit manipulationssicherer §14a-Steuerung.

## Dokumente

- **[PLAN.md](./PLAN.md)** – Anforderungen, Rechtslage, Physik, Endanwenderschutz
- **[docs/ANLAGE-MULTIPLUS-MPPT-WALLBOX.md](./docs/ANLAGE-MULTIPLUS-MPPT-WALLBOX.md)** – Anlagenplan MultiPlus + MPPT + Wallbox
- **[docs/IMPLEMENTATION.md](./docs/IMPLEMENTATION.md)** – technische Umsetzung / Sprints
- **[docs/vnb-checkliste.md](./docs/vnb-checkliste.md)** – VNB-/Abnahme-Checkliste

## Prinzip

- **GridControl** (VNB/AUX/EEBus): für Endkunden gesperrt
- **UserComfort**: Wünsche nur unter `gridCeiling`
- `ActuatorGuard` erzwingt `effective <= ceiling`

## Repo-Struktur

```text
packages/domain      Typen
packages/safety      GridConstraint, ActuatorGuard
packages/rules       Allokation unter Ceiling
packages/rbac        Rollen enduser/installer/system
packages/victron-mqtt  Gateway-Interface + InMemory-Stub
apps/controller      Control-Loop
apps/api             HTTP-API (Status, Comfort, gesperrtes Grid-Write)
```

## Schnellstart

```bash
npm install
npm test
npm start -w @victron-ems14a/api
```

API (Header `X-Role: enduser|installer|system`):

- `GET /status` – Ceiling + Wunsch (Grid nicht schreibbar für enduser)
- `PUT /comfort` – Komfortwunsch
- `POST /grid/signal` – nur installer/system
- `POST /control/tick` – ein Regelzyklus gegen InMemory-Victron

Dry-Run Controller:

```bash
npm start -w @victron-ems14a/controller
```
