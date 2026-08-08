# Anlagenplan: MultiPlus + MPPT + Wallbox

Zielkonfiguration für `victron-ems14a`: Victron-ESS mit **MultiPlus(-II)**, einem oder mehreren **SmartSolar/BlueSolar MPPT**, **Cerbo/GX**, Batterie, Netz-Zähler und **Wallbox** als SteuVE – inkl. manipulationssicherer §14a-Steuerung.

## 1. Referenz-Topologie

```text
                         öffentliches Netz
                               │
                        ┌──────┴──────┐
                        │ Netz-Zähler │  ET112 / EM24 / Compatible
                        │ (Grid Meter)│  am Cerbo (ESS Pflicht)
                        └──────┬──────┘
                               │
                    ┌──────────┴──────────┐
                    │   MultiPlus(-II)    │  VE.Bus → Cerbo
                    │   AC-In / AC-Out    │  AUX1/AUX2 ← Steuerbox §14a
                    └──────────┬──────────┘
                         AC-Out│
              ┌────────────────┼────────────────┐
              │                │                │
         Hauslast          Wallbox         (optional AC-PV)
                               │
                          EMS steuert
                          Ladestrom A/kW

   PV-Module ──► MPPT (VE.Direct/VE.Can) ──► Batterie-Bus ◄── MultiPlus DC
                                              │
                                         Batterie + BMS
                                              │
                                           Cerbo GX
                                         MQTT / Modbus
                                              │
                                      EMS (Node.js Host)
```

**Wichtig:** MPPT speisen **DC-seitig** die Batterie. Die Wallbox hängt **AC-seitig** (typisch am AC-Out oder Unterverteilung hinter dem Multi). Eigenverbrauch/Überschussladung der Wallbox steuert das EMS über Messwerte vom Cerbo – nicht über den MPPT direkt.

## 2. Stückliste (Minimal / Typisch)

| Komponente | Rolle | Anbindung |
|------------|-------|-----------|
| MultiPlus-II (1P oder 3P) | ESS-Wechselrichter/Ladegerät | VE.Bus |
| Cerbo GX (o. ä.) | Venus OS, MQTT, DVCC | Ethernet |
| SmartSolar MPPT (1…n) | PV-Ladung DC | VE.Direct und/oder VE.Can |
| Batterie + BMS | Speicher | VE.Can / BMS-Can |
| Grid Meter | ESS-Netzmessung | VE.Can / RS485 / Ethernet |
| Wallbox | SteuVE §14a | Ethernet (OCPP/Modbus/API) oder Victron EV Charging Station |
| Steuerbox / SMGW | §14a-Signal | potentialfrei → AUX1/AUX2 Master |
| EMS-Host | Policy-Layer | LAN zum Cerbo |

Varianten bewusst offen: 1-phasig vs. 3-phasig, ein vs. mehrere MPPT, Victron EVCS vs. Drittanbieter-Wallbox.

## 3. Physische Umsetzung – Schritte

### 3.1 Victron-ESS aufbauen

1. MultiPlus mit ESS-Assistent konfigurieren (Netzparallel, Batterietyp, Größen).
2. Cerbo verbinden (VE.Bus); DVCC aktiv wo vom Batteriehersteller vorgesehen.
3. MPPT am Cerbo anmelden; PV-Ertrag in Venus/`solarcharger` sichtbar.
4. Grid Meter als **Rollen: Grid** setzen – sonst falsche ESS-Regelung.
5. VRM optional; MQTT lokal auf dem Cerbo aktivieren (nur LAN).

### 3.2 §14a am MultiPlus

1. Steuerbox K1/K2 → **AUX1/AUX2 am Master-Multi** (L1), laut aktueller Victron-Herstellererklärung.
2. Kein Endkunden-Bypass; Leitungen im Zähler-/Technikbereich.
3. Abnahme ohne EMS: Signal → Netzladebegrenzung / Sperre greift am Multi.
4. Firmware Multi + Venus auf Stand laut §14a-/ESS-Doku prüfen.

### 3.3 Wallbox einbinden

| Wallbox-Typ | Empfohlener Weg |
|-------------|-----------------|
| Victron EV Charging Station | am Cerbo (GX); Mess-/Steuerwerte über Venus MQTT `evcharger` |
| Drittanbieter (go-e, Keba, cFos, …) | Modbus-TCP / HTTP / OCPP → eigener Adapter im EMS |
| Nur Schütz/Relais | Notlösung; keine feine Dimmen-Stufen |

Wallbox-Leistung und Multi-/Hausanschluss-Absicherung gemeinsam planen (Lastmanagement: EMS + ggf. Wallbox-internes LB).

### 3.4 MPPT-Besonderheiten

- Mehrere MPPT: Cerbo summiert PV; EMS nutzt **aggregierte** PV-Leistung (`system` / Summe `solarcharger`).
- Bei vollem Speicher drosselt DVCC/MPPT automatisch – EMS darf das nicht als „Überschuss für Wallbox“ falsch interpretieren (SoC, Charge-State, Grid-Export prüfen).
- MPPT ist **keine** SteuVE nach §14a; gesteuert wird Wallbox + Netzladung Multi.

## 4. Datenmodell für diese Anlage

```text
PlantState (erweitert)
├── gridPowerKw          aus grid / system
├── pvKw                 Summe MPPT (+ optional AC-PV)
├── mppt[]               je Regler: P, V, I, state
├── batterySocPercent
├── batteryPowerKw
├── multi[]              VE.Bus: Ladezustand, AC-In-Leistung, Limits
├── houseLoadKw          Verbrauch ohne Wallbox (oder gesamt − wallbox)
└── wallbox
    ├── powerKw
    ├── setCurrentA / setPowerKw
    └── sessionEnergyKwh
```

GridSignal weiterhin nur aus AUX/Steuerbox/EEBus → `GridConstraint` (Endkunde read-only).

## 5. Steuerlogik speziell Multi + MPPT + Wallbox

### 5.1 Betriebsmodi (EMS)

| Modus | Bedingung | Aktion |
|-------|-----------|--------|
| **Normal** | kein §14a-Limit | ESS macht Eigenverbrauch; EMS optional Peak/Tarif |
| **PV→Wallbox** | PV-Überschuss, SoC ok | Wallbox-Soll = f(Überschuss), Hysterese |
| **§14a limited** | Ceiling z. B. 4,2 kW | Summe netzwirksamer SteuVE-Bezug ≤ Ceiling; PV-Überschuss darf Wallbox zusätzlich speisen |
| **§14a off** | Sperre | Wallbox-Netzbezug 0; Multi-Netzladung 0 (laut Signal) |

### 5.2 Überschuss-Formel (Startpunkt)

```text
pvSurplusKw = max(0, pvKw - houseLoadWithoutWallboxKw)

# ohne §14a-Limit:
wallboxTargetKw = min(wallboxMaxKw, pvSurplusKw + optionalGridAllowanceKw)

# mit Ceiling:
wallboxFromGridKw = min(remainingCeilingKw, wallboxWishKw)
wallboxTargetKw   = min(wallboxMaxKw, wallboxFromGridKw + pvSurplusKw)
```

Hysterese (z. B. 300–600 W) und Mindestladestrom der Wallbox (oft 6 A) beachten – darunter eher aus statt „flackern“.

### 5.3 Priorität unter Ceiling

1. (optional später WP)  
2. **Wallbox**, wenn Ladewunsch / Deadline  
3. **Multi Netzladung Batterie** zuletzt (oder 0 im Steuerfall)

Multi-/ESS-Eigenregelung (Optimized) bleibt aktiv, solange das EMS nicht in ESS Mode 2/3 wechselt. Für MVP: EMS steuert primär die **Wallbox**; Multi-Netzladung begrenzt es über bekannte Limits/AUX, ohne dauerhaft `AcPowerSetpoint`-External-Control zu übernehmen – das reduziert Risiko.

### 5.4 ESS Mode-Empfehlung

| Phase | ESS | EMS |
|-------|-----|-----|
| MVP | Mode 1 (Optimized) + AUX §14a | Wallbox-Steuerung + lesen MPPT/Grid/SoC |
| Später | optional Mode 2/3 für feine Multi-Setpoints | nur mit Watchdog und klaren Fail-safes |

## 6. MQTT / Schnittstellen (Cerbo)

Lesen (Beispiele, IDs installationsabhängig):

| Größe | Service (typisch) |
|-------|-------------------|
| PV je MPPT | `solarcharger/<id>/Yield/Power` o. ä. |
| Batterie | `system` / `battery` SoC, Leistung |
| Netz | `grid` / `system` |
| Multi | `vebus` AC-In, Stromlimits |
| AUX / Digitaleingänge | `digitalinput` / digital inputs am Cerbo oder Multi |
| Wallbox (Victron) | `evcharger/<id>/...` |

Schreiben:

| Ziel | Weg |
|------|-----|
| Wallbox Strom/Leistung | Victron `evcharger` Write-Topics **oder** Hersteller-API |
| Multi-Limits | nur kontrolliert; §14a primär über AUX-Hardware |
| GridConstraint im EMS | nur Rolle `system` aus AUX-Mapping |

Kunden-UI spricht **nie** roh den Broker mit Write-ACL an.

## 7. Software-Umsetzung im Repo (anlagenspezifisch)

Erweiterung der bestehenden Pakete:

1. **`packages/victron-mqtt`**
   - `VenusMqttGateway`: Subscribe `solarcharger`, `vebus`, `system`, `grid`, `digitalinput`, optional `evcharger`
   - Mapper: DigitalInput/AUX → `GridSignal`
   - Aggregator: `pvKw = sum(mppt.power)`

2. **`packages/wallbox`** (neu)
   - Interface `WallboxAdapter.setChargeKw / setChargeA`
   - Implementierungen: `VictronEvcsAdapter`, später `GoEAdapter` / Modbus

3. **`packages/rules`**
   - `allocateUnderCeiling` um MPPT-Surplus + Wallbox-Mindeststrom erweitern
   - Hysterese-Hilfen

4. **`apps/collector`**
   - periodischer Snapshot `PlantState` + Roh-MPPT-Array

5. **`apps/controller`**
   - Tick: Signal → Ceiling → Surplus → Wallbox-Soll → Guard → Adapter

6. **Tests mit Fixtures**
   - Aufnahme echter MQTT-JSON vom Cerbo (anonymisiert) als Testdaten
   - Szenarien: „MPPT 5 kW, Haus 1 kW, §14a 4,2 → Wallbox ~4+ kW aus Surplus+Ceiling“

## 8. Kurzfristige Meilensteine (diese Anlage)

| Stufe | Inhalt | Ergebnis |
|-------|--------|----------|
| **M1** | Cerbo+Multi+MPPT+Meter live; EMS nur lesen | Dashboard PV/Batt/Grid |
| **M2** | AUX §14a am Multi geprüft | Hardware-Konformität ohne Wallbox-Logik |
| **M3** | Wallbox-Adapter + Surplus-Laden | PV→Auto ohne Netzbezug (Soll) |
| **M4** | Ceiling-Allokation Wallbox + Batt-Netzladung | §14a-koordiniert, Endkunde ohne Bypass |
| **M5** | Abnahmeprotokoll VNB + Audit | Modul/Steuerbarkeit nachgewiesen |

## 9. Inbetriebnahme-Reihenfolge (praktisch)

1. Multi + Batterie + Cerbo + Meter → ESS stabil  
2. MPPT dazu → PV in Venus plausibel  
3. AUX verdrahten & testen  
4. Wallbox elektrisch + Kommunikationsweg  
5. EMS Collector (read-only)  
6. EMS Wallbox-Schreiben mit Guard (erst ohne, dann mit §14a-Simulation)  
7. Dokumentation / VNB-Checkliste abhaken  

## 10. Offene Planungsfragen (pro Objekt)

- 1- oder 3-phasiger Multi / Wallbox?  
- Welche Wallbox (Victron EVCS vs. Drittanbieter)?  
- Batteriekapazität und erlaubte Netzladung?  
- Max. Wallbox-A vs. Hausanschluss?  
- Ein oder mehrere MPPT, Ost/West?  
- Notstrom am AC-Out (Wallbox im Backup-Pfad – ja/nein)?  

Diese Antworten parametrisieren `SafetyLimits` und die Wallbox-Adapter-Wahl, ändern aber nicht die Architektur GridControl vs. UserComfort.
