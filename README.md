# victron-ems14a

Energiemanagementsystem für Victron **MultiPlus + MPPT + Wallbox** mit manipulationssicherer §14a-Steuerung.

## Dokumente

- **[PLAN.md](./PLAN.md)** – Anforderungen, Rechtslage, Physik, Endanwenderschutz
- **[docs/ANLAGE-MULTIPLUS-MPPT-WALLBOX.md](./docs/ANLAGE-MULTIPLUS-MPPT-WALLBOX.md)** – Anlagenplan
- **[docs/IMPLEMENTATION.md](./docs/IMPLEMENTATION.md)** – technische Umsetzung / Sprints
- **[docs/vnb-checkliste.md](./docs/vnb-checkliste.md)** – VNB-/Abnahme-Checkliste

## Prinzip

- **GridControl** (VNB/AUX): für Endkunden gesperrt
- **UserComfort**: Wünsche nur unter `gridCeiling`
- MPPT nur lesen; EMS steuert vor allem die **Wallbox**

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
