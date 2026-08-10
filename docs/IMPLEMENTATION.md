# Umsetzung: Victron-EMS mit manipulationssicherem §14a

Dieses Dokument beschreibt **wie** die Requirements aus `PLAN.md` technisch gebaut werden. Der Code-Kern liegt unter `packages/` und `apps/`.

## Zielbild der ersten lauffähigen Version (MVP)

1. AUX-/Signalzustand → `GridConstraint` (nur `system`)
2. Jeder Aktor-Schreibwunsch läuft durch `ActuatorGuard` → Ceiling erzwungen
3. API mit Rollen: `enduser` sieht Status, kann Grid **nicht** ändern; Komfortwünsche werden geclampt
4. Audit jedes Steuerfalls und jedes Bypass-Versuchs
5. Victron zunächst über **Mock + MQTT-Adapter-Interface** (echte Cerbo-Topics als nächster Schritt)

## Laufzeit-Architektur

```text
┌─────────────┐  digital in / MQTT   ┌──────────────┐
│ Steuerbox   │ ───────────────────► │ collector    │
│ / AUX       │                      └──────┬───────┘
└─────────────┘                             │ GridSignal
                                            ▼
┌─────────────┐  comfort wish        ┌──────────────┐
│ web / API   │ ───────────────────► │ controller   │
│ (enduser)   │ ◄──── status ─────── │  rules+guard │
└─────────────┘                      └──────┬───────┘
                                            │ clamped setpoints
                                            ▼
                                     ┌──────────────┐
                                     │ victron-mqtt │──► Cerbo
                                     │ wallbox-adapter
                                     └──────────────┘
```

**Deployment:** ein Host neben dem Cerbo (Docker Compose). Cerbo bleibt ESS-Master; EMS ist Policy-Layer.

## Modul-Schnitt

| Paket / App | Verantwortung |
|-------------|----------------|
| `packages/domain` | Typen: `GridSignal`, `PowerSetpoints`, `Role`, Audit-Events |
| `packages/safety` | `GridConstraint` Store, `ActuatorGuard`, SafetyLimits |
| `packages/rules` | Allokation unter Ceiling (WP → Wallbox → Batt-Netzladung) |
| `packages/rbac` | Rollenprüfung, Verbot von Grid-Writes für `enduser` |
| `packages/victron-mqtt` | Topic-Map, Read/Write-Client (Interface + Stub zuerst) |
| `apps/controller` | Zyklus: Signal → Regeln → Guard → Aktoren |
| `apps/api` | HTTP-API + Auth-Stub; Status read-only für Grid |
| `apps/collector` | (Phase 2) MQTT-Ingest |

## Harte Invarianten (Tests müssen das absichern)

```text
I1  gridCeiling kommt nie aus User-Config
I2  enduser → 403 auf GridConstraint-Write
I3  effectiveKw <= gridCeilingKw  (netzwirksamer SteuVE-Bezug)
I4  AUX/Grid-Signal setzt Ceiling auch wenn API offline
I5  Bypass-Versuch erzeugt TamperAudit-Event
```

## Anlagenfokus

Primäre Hardware-Zielkonfiguration: **MultiPlus + MPPT + Wallbox + Wärmepumpe** – siehe [`ANLAGE-MULTIPLUS-MPPT-WALLBOX.md`](./ANLAGE-MULTIPLUS-MPPT-WALLBOX.md).

Kurz:

- **§14a**: EV-Limit, MultiPlus-Netzladung (basic charger), WP Ein/Aus + Stufen  
- **§9**: Feed-in-Cap (`maxFeedInKw` / % von `pvRatedKw`)  
- MPPT nur lesen; beide Rechtskreise für Endkunden immutable

## Umsetzungsreihenfolge

### Sprint 1 – Policy-Kern (jetzt im Repo)

- [x] Domain-Typen
- [x] `GridConstraint` + `ActuatorGuard` + Allokator
- [x] RBAC-Helfer
- [x] Unit-Tests für I1–I3, I5
- [x] API-Stub mit Status + Comfort-Endpoint (`apps/api`)
- [x] Control-Loop + InMemory-Victron (`apps/controller`)

### Sprint 2 – Victron MultiPlus + MPPT lesen

- [x] Topic-Parser, `VenusValueCache`, `plantStateFromCache` (MPPT-Summe)
- [x] AUX/`digitalinput` → `GridSignal`
- [x] `VenusMqttGateway` (mqtt.js + keepalive)
- [x] `apps/collector` (Live-URL oder InMemory-Demo)
- [ ] Fixtures von echter Kundenanlage einchecken

### Sprint 3 – Wallbox-Adapter

- [x] `packages/wallbox`: Interface, InMemory, `VictronEvcsAdapter` (SetCurrent)
- [x] Surplus-Hysterese + Min.-Strom (6 A)
- [x] Controller setzt Wallbox unter ActuatorGuard
- [ ] Drittanbieter-Wallbox (go-e/Modbus) bei Bedarf
- [ ] ESS Mode 2/3 nur später optional

### Sprint 4 – API & Endkunden-UI

- Login: Installateur vs. Endkunde
- Status: PV je MPPT, SoC, Grid, Wallbox, Ceiling (Grid read-only)
- Comfort: Wallbox-Wunsch / Priorität – immer geclampt
- Kein UI „§14a aus“

### Sprint 5 – Betrieb & Abnahme

- Audit-Persistenz, Watchdog/Docker
- VNB-Checkliste + Nachweis Manipulationsschutz
- Optional später: ESS Mode 2/3 für feinere Multi-Setpoints

## Physische Umsetzung (parallel zur Software)

1. Elektriker: K1/K2 → AUX1/AUX2 am Master laut Victron-Erklärung
2. Kein kundenseitiger Bypass-Schalter
3. Funktionstest ohne EMS: Signal → Victron limitiert
4. Danach EMS dazu: koordiniert Wallbox/WP unter demselben Ceiling

## Warum diese Zerlegung

- Reine Funktionen in `rules`/`safety` sind ohne Anlage testbar (CI).
- Victron-Zugriff ist austauschbar (MQTT jetzt, Modbus später).
- VNB-Anforderung „keine Endkunden-Modifikation“ sitzt in **RBAC + Guard**, nicht in der UI-Ethik.