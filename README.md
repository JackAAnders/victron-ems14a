# victron-ems14a

Energiemanagementsystem für Victron **MultiPlus + MPPT + Wallbox + Wärmepumpe** mit manipulationssicherer Steuerung nach **EnWG §14a** und **EEG §9**.

## Spec Kit (GitHub Spec-Driven Development)

Projekt ist mit [GitHub Spec Kit](https://github.com/github/spec-kit) initialisiert.

| Artefakt | Pfad |
|----------|------|
| Constitution | [`.specify/memory/constitution.md`](./.specify/memory/constitution.md) |
| Feature-Spec | [`specs/001-ems-multiplus-wallbox/spec.md`](./specs/001-ems-multiplus-wallbox/spec.md) |
| Plan | [`specs/001-ems-multiplus-wallbox/plan.md`](./specs/001-ems-multiplus-wallbox/plan.md) |
| Tasks | [`specs/001-ems-multiplus-wallbox/tasks.md`](./specs/001-ems-multiplus-wallbox/tasks.md) |

```bash
export SPECIFY_FEATURE=001-ems-multiplus-wallbox
export SPECIFY_FEATURE_DIRECTORY=specs/001-ems-multiplus-wallbox
# Agent: /speckit-implement · /speckit-converge · /speckit-analyze
```

## Dokumente (Hintergrund)

- **[PLAN.md](./PLAN.md)** – Anforderungen, Rechtslage, Physik, Endanwenderschutz
- **[docs/STEUERBOX-SCHNITTSTELLE.md](./docs/STEUERBOX-SCHNITTSTELLE.md)** – Steuerbox ↔ Venus/EMS (AUX, §14a/§9, später EEBus)
- **[docs/ANLAGE-MULTIPLUS-MPPT-WALLBOX.md](./docs/ANLAGE-MULTIPLUS-MPPT-WALLBOX.md)** – Anlagenplan
- **[docs/IMPLEMENTATION.md](./docs/IMPLEMENTATION.md)** – technische Umsetzung / Sprints
- **[docs/vnb-checkliste.md](./docs/vnb-checkliste.md)** – VNB-/Abnahme-Checkliste

## Prinzip

- **§14a GridControl** (Offtake-Ceiling): Endkunde gesperrt → limitiert EV, MultiPlus-Netzladung, WP
- **§9 FeedInControl** (Einspeise-Cap): Endkunde gesperrt → `maxFeedInKw`
- **Wärmepumpe**: Ein/Aus + Stufen (SG-Ready-ähnlich, 2 Relais)
- MPPT nur lesen; Komfortwünsche nur unter den aktiven Limits

## Schnellstart

```bash
cp .env.example .env   # VENUS_MQTT_URL setzen für Live-Cerbo
npm install
npm test
```

Demo Control-Loop (InMemory Multi/MPPT/Wallbox):

```bash
npm start -w @victron-ems14a/controller
```

Collector (liest Venus MQTT oder Demo):

```bash
npm start -w @victron-ems14a/collector
```

API:

```bash
npm start -w @victron-ems14a/api
# Header X-Role: enduser|installer|system
```

## Pakete

| Paket | Inhalt |
|-------|--------|
| `victron-mqtt` | Topic-Parser, Cache, AUX→GridSignal, `VenusMqttGateway` |
| `wallbox` | Adapter + Victron EVCS SetCurrent |
| `safety` / `rules` / `rbac` | Ceiling, Surplus, Rollen |
| `apps/collector` | periodischer PlantState-Dump |
| `apps/controller` | Regelzyklus |
| `apps/api` | HTTP Status/Comfort |
