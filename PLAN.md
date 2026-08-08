# Umsetzungsplan: Energiemanagementsystem (EMS) mit Victron und §14a EnWG

## 1. Ziel und Funktion

Ein EMS steuert Energieflüsse in der Kundenanlage so, dass:

1. **Eigenverbrauch maximiert** wird (PV → Verbraucher / Speicher, statt Netzbezug).
2. **Netzbezug und Einspeisung** begrenzt oder zeitlich verschoben werden (Tarife, Peak-Shaving).
3. **Steuerbare Verbrauchseinrichtungen (SteuVE)** nach §14a EnWG netzdienlich dimmbar sind (Wallbox, Wärmepumpe, Speicher-Laden aus dem Netz, ggf. Klimaanlage).
4. **Einspeisemanagement** nach §9 EEG (bei PV) umgesetzt werden kann.
5. **Transparenz** entsteht: Live-Leistungen, Historie, Alarme, Audit-Trail für Steuerbefehle.

Victron bildet die energetische Basis (ESS: MultiPlus/Quattro, GX/Cerbo, MPPT, Batterie, optional ET112/EM24 Grid-Meter). Das EMS sitzt **logisch darüber**: es liest Messwerte, bewertet Regeln (Tarif, SoC, Netzsignal) und schreibt Sollwerte zurück (Ladeleistung, AC-In-Limit, Relais, Wallbox-Strom).

```text
                    ┌─────────────────────────────────────┐
                    │  Netzbetreiber / SMGW / Steuerbox   │
                    │  (§14a: Relais 2-Bit oder später    │
                    │   digitale Schnittstelle / EEBus)   │
                    └───────────────┬─────────────────────┘
                                    │ Steuerbefehl
                                    ▼
┌──────────────┐   MQTT/Modbus    ┌──────────────────────┐
│  SteuVE      │◄─────────────────┤  EMS (Node.js)       │
│  Wallbox, WP │                  │  Regeln, Logging,    │
│  …           │                  │  API, Dashboard      │
└──────────────┘                  └──────────▲───────────┘
                                             │ MQTT / Modbus-TCP
┌────────────────────────────────────────────┴───────────┐
│  Victron Venus OS (Cerbo / Venus GX / RPi)             │
│  MultiPlus/Quattro · Batterie · MPPT · Grid-Meter      │
└────────────────────────────────────────────────────────┘
```

---

## 2. Rechtslage (Deutschland, Stand Planung 2026)

Dies ist **keine Rechtsberatung**. Verbindlich sind Festlegungen der BNetzA, EnWG/EEG, VDE/FNN-Dokumente und die Vorgaben des **zuständigen Netzbetreibers**.

### 2.1 §14a EnWG – steuerbare Verbrauchseinrichtungen

| Aspekt | Inhalt |
|--------|--------|
| Zweck | Netzentlastung in der Niederspannung; VNB darf SteuVE bei Netzengpass dimmen |
| Schwelle | typ. **Netzanschlussleistung > 4,2 kW** pro SteuVE (bzw. gruppiert je Kategorie) |
| Betroffen | u. a. Wallboxen, Wärmepumpen, Klimaanlagen, **Netzladung von Speichern**, wenn netzwirksamer Bezug möglich ist |
| Gegenleistung | reduzierte Netzentgelte (Module nach BNetzA-Festlegung) |
| Steuerung heute | oft **präventive / FNN-2-Bit**-Signale über Steuerbox / SMGW-Anbindung (potentialfreie Kontakte) |
| Steuerung Zielbild | **netzorientierte, granulare** Steuerung über digitale Schnittstelle; BNetzA empfiehlt u. a. **EEBus** (VDE-AR-E 2829-6) zum EMS |

**Victron-Praxis (herstellerseitig üblich):**

- Zwei Kontakte der Steuerbox → **AUX1 / AUX2** am Master-Wechselrichter (L1).
- Typisch: ein Signal für Sperre / Abschaltung, eines für Begrenzung der **Netz-Ladeleistung** (z. B. auf Mindestleistung im Steuerungsfall).
- Voraussetzung: passende **VE.Bus-/Venus-Firmware** und dokumentierte ESS-Konfiguration des Herstellers.
- Slave-Geräte folgen über VE.Bus; nur der Master erhält die AUX-Verdrahtung.

**EMS-Vorteil gegenüber reiner Geräte-Dimmung:** Der VNB steuert das EMS; das EMS verteilt die erlaubte Bezugsleistung intelligent (Gleichzeitigkeit, Eigenverbrauch aus PV/Speicher anrechnen wo zulässig). So wird Eigenverbrauch nicht „abgewürgt“, nur der **netzwirksame** Bezug der SteuVE begrenzt.

### 2.2 §9 EEG – Einspeisemanagement / technische Vorgaben

PV-Anlagen unterliegen je nach Größe und Inbetriebnahme technischen Vorgaben zur ferngesteuerten Leistungsreduzierung bzw. zur Wirkleistungsbegrenzung. Das EMS bzw. Venus kann Einspeiseleistung begrenzen (`GridFeedIn`, ESS-Setpoints). Ob Relais, Rundsteuerempfänger oder SMGW/Steuerbox gilt, hängt von Anlagenklasse und Netzbetreiber ab.

### 2.3 Messstellenbetriebsgesetz (MsbG) / iMSys

Intelligentes Messsystem (Smart Meter + Gateway) ist die vorgesehene Basis für netzseitige Steuerung. Ohne iMSys greifen Übergangs-/Alternativlösungen des VNB. EMS-Planung muss die **lokale Schnittstelle** (Steuerbox-Kontakte jetzt, digitale EMS-Schnittstelle später) von Anfang an vorsehen (Leerrohr, RJ45 im Zählerschrank / zRfZ-Feld).

### 2.4 Weitere Pflichten

- **Anmeldung** SteuVE / Speicher / Wallbox beim VNB und ggf. Marktstammdatenregister.
- **Elektrofachkraft** für Netzanschluss, Zählerplatz, Steuerleitungen, Potentialtrennung.
- **IT-Sicherheit:** EMS nicht ungeschützt aus dem Internet; keine offenen MQTT-Ports; VRM nur über sichere Kanäle.
- **Haftung / Betrieb:** Falsche Steuerlogik kann Netzentgelt-Vorteile gefährden oder Netzvorgaben verletzen → Steuerbefehle loggen, Fail-safe (bei Signalverlust: konservativ dimmen).

---

## 3. Physische Umsetzung

### 3.1 Kernkomponenten Victron-ESS

1. **Wechselrichter/Ladegerät** MultiPlus-II oder Quattro (1- oder 3-phasig), ESS-Assistent konfiguriert.
2. **GX-Gerät** (Cerbo GX / Venus OS auf geeigneter Hardware) – zentrale Daten- und Steuerschnittstelle.
3. **Batterie** (z. B. Victron / kompatibel mit BMS-CAN).
4. **PV**: MPPT (DC) und/oder AC-PV am AC-Out/AC-In je Konzept.
5. **Netz-Zähler** am Victron (ET112, EM24, oder Compatible Meter) für korrekte ESS-Regelung.
6. **Verkabelung**: VE.Bus, VE.Direct, VE.Can nach Hersteller; Erdung, FI, Absicherung nach Anlage.

### 3.2 §14a-Verdrahtung (kurzfristig machbar)

1. Steuerbox / SMGW-Ausgänge **K1/K2** (potentialfrei) zum Master.
2. Anschluss an **AUX1/AUX2** gemäß aktueller Victron-Herstellererklärung / ESS-Doku (nicht raten – Pinout und Logik prüfen).
3. Funktionsprüfung: Signal aktiv → erwartete Begrenzung der Netzladung / Sperre sichtbar in Venus / VRM.
4. Parallel: **Leerrohr + CAT5/6** vom Zähler-/Steuerungsfeld zum EMS-/GX-Standort für spätere digitale Steuerung (EEBus/IP).

### 3.3 Weitere SteuVE

| Gerät | Physische Anbindung | EMS-Sollwert |
|-------|---------------------|--------------|
| Wallbox | Ethernet/WiFi (OCPP, Modbus, Hersteller-API) oder Relais | Ladestrom A / kW |
| Wärmepumpe | SG-Ready-Kontakte, EEBus, Modbus | Betriebsmodus / Leistung |
| Heizstab / Verbraucher | Relais am GX oder Schütz | Ein/Aus oder Stufe |
| Zweites ESS / AC-Lader | Modbus/MQTT | Stromlimit |

Platzierung: EMS-Rechner im gleichen LAN wie Cerbo (idealerweise VLAN „Technik“), UPS optional, dokumentierte Schaltpläne.

---

## 4. Informatische Umsetzung (präferiert Node.js)

### 4.1 Warum Node.js hier passt

- Victron Venus bietet **MQTT** (lokal) – Event-getrieben, passt zu Node.js.
- Gute Ökosysteme für MQTT (`mqtt.js`), Modbus (`jsmodbus` / `modbus-serial`), REST, WebSockets.
- Ein Prozess kann: ingest → Regelengine → actuator → Persistenz → UI-API.
- Alternativen bleiben offen (siehe 4.5), falls Team/Hosting anderes favorisiert.

### 4.2 Empfohlene Architektur

```text
victron-ems14a/
├── apps/
│   ├── collector/          # MQTT/Modbus → normalisierte Messwerte
│   ├── controller/         # Regelengine (§14a, Tarif, SoC, Peak)
│   ├── api/                # REST/WebSocket + Auth
│   └── web/                # Dashboard (optional später)
├── packages/
│   ├── domain/             # Typen: Power, SoC, ControlSignal, Device
│   ├── victron-mqtt/       # Topic-Mapping Venus OS
│   └── rules/              # reine Funktionen, gut testbar
├── deploy/
│   └── docker-compose.yml  # EMS + Timescale/Postgres + MQTT-Bridge falls nötig
└── docs/                   # Schaltplan-Hinweise, VNB-Checkliste
```

**Laufzeit:** Docker auf Mini-PC / NUC / Raspberry Pi **neben** Cerbo (nicht Venus ersetzen). Cerbo bleibt System of Record für ESS; EMS ist Policy-Layer.

### 4.3 Schnittstellen Victron

| Weg | Nutzen | Priorität |
|-----|--------|-----------|
| **MQTT lokal** (Venus) | Lesen aller Messwerte; Schreiben vieler Setpoints (z. B. AC-In Current Limit, ESS Mode) | **Primär** |
| **Modbus-TCP** | Stabile Registerliste, gute Fallback-Option | Sekundär |
| **VRM API** | Cloud-Historie, Remote-Monitoring | Optional, nicht für Echtzeit-Steuerung |
| **Node-RED auf GX** | Schnelle Prototypen, Victron-Community | Kurzfristig parallel nutzbar |
| **dbus** (nur auf GX) | Tiefste Integration | Nur wenn EMS *auf* Venus läuft (Large Image / custom) |

Wichtige Steuergrößen (Beispiele, IDs installationsabhängig):

- Netzleistung, PV, Verbrauch, Batterie SoC / Leistung
- `Ac/In/.../CurrentLimit` bzw. ESS-Charge-Limits
- Relais / Digital Inputs (AUX-Zustand als Input für EMS-Logik)
- Systemmodus (ESS Optimized, Keep charged, …)

### 4.4 Regelengine – funktionale Module

1. **Signal-Interpreter §14a:** Mappt AUX/Steuerbits oder später EEBus-Payload → interner Zustand `{ mode: normal | limited | off, maxGridChargeKw, maxSteuveKw }`.
2. **Allokator:** Verteilt erlaubte Netzbezugsleistung auf Wallbox, WP, Speicherladung; priorisiert (z. B. WP Komfort > Auto laden > Speicher Netzladung).
3. **Eigenverbrauchsoptimierer:** Bei PV-Überschuss laden/steuern; bei teurem Tarif entladen (dynamischer Tarif optional via aWATTar/Tibber/… API).
4. **Fail-safe:** MQTT weg oder ungültiges Signal → sichere Defaults; Watchdog.
5. **Audit-Log:** Jeder externe Steuerbefehl und jede EMS-Aktion mit Zeitstempel (Nachweisbarkeit).

### 4.5 Alternativen zu Node.js

| Lösung | Wann sinnvoll |
|--------|----------------|
| **Node-RED** (auf Cerbo Large / extern) | Schnellster Einstieg, weniger Software-Engineering |
| **Home Assistant + Victron-Integration** | Wenn HA ohnehin Hausautomation ist |
| **Python (asyncio + paho-mqtt)** | Data-Science / bestehende Python-Stacks |
| **Go** | Sehr schlanke Edge-Binaries |
| **Kommerzielles EMS** (mit EEBus) | Wenn Zertifizierung / VNB-Abnahme im Vordergrund steht |

Empfehlung: **Kurzfristig Node-RED oder schlanker Node.js-Collector**; mittelfristig Node.js-Controller mit Tests; langfristig EEBus-fähige Anbindung (eigen oder Gateway-Produkt).

---

## 5. Kurzfristig erreichbare Fortschritte

Ohne EEBus-Zertifizierung und ohne vollständige VNB-Digitalsteuerung sind bereits nutzbare Stufen möglich:

### Stufe A – Sichtbarkeit (geringster Aufwand)

- Venus MQTT aktivieren, Node.js- oder Node-RED-Flow: Live-Dashboard (Netz, PV, Batt, Verbrauch).
- Persistenz in InfluxDB/Timescale oder Victron VRM.
- **Ergebnis:** Betriebsverständnis, Basis für Regeln.

### Stufe B – Lokale Optimierung

- Regeln: „Nur bei PV-Überschuss Wallbox X A“, „SoC-Fenster“, „abends Peak kappen“.
- Schreiben von Current-Limit / Relais über MQTT.
- **Ergebnis:** messbarer Eigenverbrauch, Lastspitzenreduktion – unabhängig von §14a.

### Stufe C – §14a-Basis (physisch + Logik)

- AUX1/AUX2 verdrahten und in Venus verifizieren (Herstellerweg).
- EMS liest Digital Inputs / resultierende Limits und **koordiniert** zusätzliche SteuVE (Wallbox runterregeln, statt nur Speicher blind zu drosseln).
- Logging der Steuerfälle.
- **Ergebnis:** Konformitätspfad über Victron-ESS + intelligente Nebenverbraucher; Netzentgelt-Module beim VNB klärbar.

### Stufe D – Vorbereitung Digitalsteuerung

- Netzwerkdose/CAT zum zRfZ; EMS mit stabiler IP; Schnittstellen-Abstraktion `GridControlPort` im Code (heute: 2-Bit, morgen: EEBus/MQTT vom Gateway).
- **Ergebnis:** keine Sackgasse bei Umstellung auf netzorientierte Phase.

**Noch nicht kurzfristig realistisch als Eigenbau:** vollständige EEBus-Stack-Zertifizierung nach VDE-AR-E 2829-6 als „offizielles“ EMS gegenüber jedem VNB – hier Gateway-Produkt oder spezialisierte Middleware einplanen.

---

## 6. Umsetzungsschritte (Reihenfolge)

### Phase 0 – Bestand und VNB

1. Anlageninventar: Victron-Typen, Firmware, 1P/3P, Batterie-kWh, PV-kWp, vorhandene SteuVE.
2. Klärung mit VNB: welche SteuVE melden, welches Netzentgelt-Modul, ob Steuerbox/Relais oder schon IP, Fristen iMSys.
3. Victron-Doku zur aktuellen §14a-/ESS-Herstellererklärung beschaffen; Firmware-Stand prüfen.

### Phase 1 – Physik & Sicherheit

1. ESS korrekt in Betrieb (Grid-Meter, ESS-Assistent, Insel-/Backup-Konzept falls nötig).
2. §14a-Verdrahtung AUX durch Elektrofachkraft; Abnahme/Testprotokoll.
3. LAN-Segment, feste IPs, Firewall; MQTT nur lokal.

### Phase 2 – Datenpfad (Node.js)

1. Repo-Bootstrap: TypeScript, `mqtt.js`, Config via Env.
2. Collector: Topics abonnieren, normalisieren, Health-Check.
3. Speichern + einfaches Web/API (Leistung, SoC, Steuerzustand).
4. Integrationstests gegen aufgezeichnete MQTT-Fixtures (ohne Live-Anlage).

### Phase 3 – Steuerung

1. Sichere Write-Pfade (Rate-Limit, Ack, Rollback).
2. Regelmodule B + C (Überschuss, §14a-Allokation).
3. Wallbox/WP-Adapter als Plugins.
4. Fail-safe und Audit-Log.

### Phase 4 – Betrieb & Compliance

1. Monitoring/Alerts (Telegram/E-Mail bei Steuerfall, Offline, SoC-kritisch).
2. Dokumentation für VNB/Elektriker (Signalmatrix, Schaltbilder).
3. Optional: dynamische Tarife, Prognose (PV/Last), Simulation.

### Phase 5 – Digitale Netzsteuerung

1. Beobachtung FNN/BNetzA/VNB zum EEBus- oder Steuerbox-IP-Profil.
2. Adapter `GridControlPort` auf EEBus-Gateway oder zertifiziertes EMS-Frontend umbiegen.
3. Gleichzeitigkeitsformel und Eigenverbrauchsanrechnung gemäß dann geltender Regeln im Allokator nachziehen.

---

## 7. Minimaler Node.js-Schnitt (Skizze)

```js
// Pseudocode: Steuerbefehl → Victron + Wallbox
async function applyGridConstraint(signal, state, actuators) {
  const budgetKw = signal.maxSteuveGridKw; // z. B. 4.2 im Limit-Fall
  const pvSurplusKw = Math.max(0, state.pvKw - state.houseLoadKw);
  const allowedFromGrid = budgetKw; // vereinfacht; Gleichzeitigkeit später
  const wallboxKw = Math.min(actuators.wallbox.maxKw, allowedFromGrid + pvSurplusKw);
  const batteryGridChargeKw = Math.max(0, allowedFromGrid - wallboxKw);

  await actuators.wallbox.setChargeKw(wallboxKw);
  await actuators.victron.setGridChargeLimitKw(batteryGridChargeKw);
  await audit.log({ signal, wallboxKw, batteryGridChargeKw });
}
```

Produktiv: Typen, Unit-Tests für Grenzfälle (0 PV, voller Speicher, 3-Phasen-Unsymmetrie, Signal flattert).

---

## 8. Risiken und Entscheidungen

| Risiko | Mitigation |
|--------|------------|
| Falsche AUX-Logik / Firmware | Nur nach Herstellererklärung; Integrationstest mit VNB-Signal |
| MQTT Write zerstört ESS-Regelung | Schreibfrequenz begrenzen; ESS-Modi nicht ungeprüft umschalten |
| EEBus noch nicht greifbar | Abstraktion + physische Vorbereitung; ggf. Gateway kaufen |
| Scope-Creep (volles Smart Home) | EMS-Kern: Leistung + SteuVE; HA optional daneben |
| Haftung bei Fehlsteuerung | Fail-safe, Logs, klare Betriebsverantwortung |

**Architekturentscheidung früh treffen:** EMS extern (empfohlen) vs. alles in Node-RED auf dem GX. Extern skaliert besser für Wallbox/Tarife/EEBus; Node-RED ist ideal als Stufe A/B-Beschleuniger.

---

## 9. Definition of Done (erste nutzbare Version)

- [ ] Live-Messwerte aus Venus im EMS
- [ ] Mindestens eine automatische Optimierungsregel aktiv
- [ ] §14a-Signale (AUX oder äquivalent) werden erkannt und geloggt
- [ ] Mindestens eine zusätzliche SteuVE wird im Limit-Fall aktiv reduziert
- [ ] Fail-safe bei Kommunikationsverlust dokumentiert und getestet
- [ ] Schalt- und Signalplan für Elektriker/VNB vorhanden

---

## 10. Nächste konkrete Arbeitspakete im Repo

1. `packages/victron-mqtt`: Topic-Katalog und Read/Write-Client.
2. `apps/collector`: Dienst mit Health-Endpoint.
3. `packages/rules`: reine Funktionen für §14a-Allokation + Tests.
4. `docs/vnb-checkliste.md`: Fragenkatalog Netzbetreiber.
5. Optional: Docker-Compose für lokale Simulation mit Fixture-Publisher.
