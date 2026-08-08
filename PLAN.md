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
- **Manipulationsschutz:** Endkunde darf die netzwirksame §14a-Steuerung nicht deaktivieren oder parametrisch aushebeln (VNB-/Abnahme-Anforderung) → plombierter Signalweg + softwareseitige Sperre (siehe Abschnitt 8).
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
2. Klärung mit VNB: welche SteuVE melden, welches Netzentgelt-Modul, ob Steuerbox/Relais oder schon IP, Fristen iMSys, **Anforderungen an Manipulationsschutz / fehlende Endkunden-Modifikation**.
3. Victron-Doku zur aktuellen §14a-/ESS-Herstellererklärung beschaffen; Firmware-Stand prüfen.

### Phase 1 – Physik & Sicherheit

1. ESS korrekt in Betrieb (Grid-Meter, ESS-Assistent, Insel-/Backup-Konzept falls nötig).
2. §14a-Verdrahtung AUX durch Elektrofachkraft; Abnahme/Testprotokoll; Signalweg für Endkunden nicht bedienbar/überbrückbar.
3. LAN-Segment, feste IPs, Firewall; MQTT nur lokal; getrennte Zugänge Installateur vs. Endkunde.

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
// Pseudocode: Netz-Ceiling ist verbindlich; User-Wunsch nur darunter
async function applyGridConstraint(signal, userWish, state, actuators) {
  const gridCeilingKw = signal.maxSteuveGridKw; // nur aus VNB/AUX/EEBus – nie aus User-Config
  const pvSurplusKw = Math.max(0, state.pvKw - state.houseLoadKw);
  const wishWallboxKw = userWish.wallboxKw ?? actuators.wallbox.maxKw;
  const wallboxKw = Math.min(wishWallboxKw, gridCeilingKw + pvSurplusKw, actuators.wallbox.maxKw);
  const batteryGridChargeKw = Math.max(0, gridCeilingKw - Math.min(wallboxKw, gridCeilingKw));

  await actuators.wallbox.setChargeKw(wallboxKw);
  await actuators.victron.setGridChargeLimitKw(batteryGridChargeKw);
  await audit.log({ signal, gridCeilingKw, wallboxKw, batteryGridChargeKw, userWish });
}
```

Produktiv: Typen, Unit-Tests für Grenzfälle (0 PV, voller Speicher, 3-Phasen-Unsymmetrie, Signal flattert).

---

## 8. Endanwenderschutz und manipulationssichere Netzsteuerung

VNBs fordern typischerweise, dass die **netzwirksame Steuerung nach §14a vom Endkunden nicht außer Kraft gesetzt, umgangen oder nachträglich verändert** werden kann. Endanwenderschutz heißt deshalb nicht „Kunde kann alles steuern“, sondern: Komfort und Transparenz **innerhalb** eines für den Kunden **gesperrten** Netzsteuerpfads.

### 8.1 Zwei getrennte Ebenen

| Ebene | Wer darf ändern | Inhalt |
|-------|-----------------|--------|
| **A – GridControl (gesperrt)** | nur VNB-Signal / MSB-Steuerbox / Installateur mit Fachzugang | Limit, Sperre, Sollwert vom Netz; Mapping AUX/EEBus → maximale SteuVE-Bezugsleistung |
| **B – UserComfort (erlaubt)** | Endkunde | Prioritäten *innerhalb* des Budgets (z. B. WP vor Wallbox), Zeitwünsche, Tarif-Opt-in, Anzeige |

Alles aus Ebene A ist für die Endkunden-UI **read-only**. Es gibt keinen Schalter „§14a aus“, keinen manuellen AC-In-Limit-Bypass und keinen Modus, der Netzlimits ignoriert.

### 8.2 Was geschützt werden muss

| Schutzgut | Risiko ohne Schutz | Antwort |
|-----------|-------------------|---------|
| Netzkonformität / VNB-Vorgabe | Kunde deaktiviert Dimmen → Steuerbarkeit nicht gegeben | manipulationssicherer Steuerpfad (Hard- + Software) |
| Wohnkomfort / Wärme | WP zu stark gedimmt | Prioritäten **innerhalb** des erlaubten Budgets |
| Mobilität | Auto morgens leer | Ladewünsche nur soweit Budget und GridControl es zulassen |
| Versorgungssicherheit | EMS-Crash | AUX/Victron-Fallback unabhängig vom EMS |
| Manipulation / Sabotage | offenes MQTT, Victron-Passwort bekannt, AUX überbrückt | Rollen, Siegel, gesperrte Writes, Tamper-Log |
| Privatsphäre | Cloud-Leak | Local-first |
| Nachvollziehbarkeit | „Warum lädt nichts?“ | Statusanzeige ohne Eingriffsmöglichkeit |

### 8.3 VNB-Forderung: keine Endkunden-Modifikation am Steuerpfad

#### Physisch (primär, oft entscheidend für Abnahme)

1. **Steuerbox / SMGW-Ausgänge → AUX** nur im plombierten / schwer zugänglichen Bereich (Zählerschrank, zRfZ); Leitungen nicht über frei zugängliche Klemmstellen im Wohnbereich.
2. **Keine kundenbedienbare Überbrückung** (kein Schalter parallel zu K1/K2).
3. Victron-Master so konfigurieren, dass die **AUX-Reaktion herstellerseitig greift**, auch wenn EMS/App offline sind.
4. Optional: plombierbarer Installateur-Zugang; Änderungen an AUX-Funktion nur mit Werkzeug/Fachrolle.
5. Bei digitaler Steuerung später: EMS-/EEBus-Endpunkt im Technikbereich, nicht als „Heim-App-Server“ mit Root für den Kunden.

#### Software / EMS (verbindlich)

1. **`GridConstraint` immutable für Rolle `enduser`**
   - API: keine PATCH/DELETE auf Netzlimits.
   - UI: nur Anzeige (`active`, `budgetKw`, `source`, `since`).
   - Schreibversuche → HTTP 403 + Tamper-Audit-Event.

2. **Actuator-Guard mit Ceiling**
   Jeder Schreibwunsch (Wallbox-A, Speicher-Netzladung, CurrentLimit) wird mit
   `effective = min(userRequest, gridCeiling, safetyLimit)`
   ausgeführt. `gridCeiling` kommt ausschließlich aus dem Netzsignal (bzw. Victron-AUX-Zustand), nie aus User-Config.

3. **Rollenmodell**

   | Rolle | Darf |
   |-------|------|
   | `enduser` | Status lesen; Komfortprioritäten *unter* Ceiling; eigene Tarif-Opt-ins |
   | `installer` | Erstinbetriebnahme, Gerätezuordnung, Zertifikate; zeitlich begrenzter Zugang |
   | `system` | GridConstraint aus Steuerbox/EEBus/AUX-Input setzen |
   | VNB/MSB | steuert nur über genormte Schnittstelle (Kontakte/EEBus), nicht über Kunden-UI |

4. **Victron-/GX-Härtung**
   - GX- und VRM-Zugangsdaten nicht dem Alltagskunden-Login überlassen bzw. getrennte Konten.
   - Remote-Console / MQTT-Write nur aus dem EMS-Service-Account im LAN.
   - Kunden-Dashboard spricht **nur die EMS-API**, nicht roh den MQTT-Broker mit Write-ACL.
   - Broker-ACL: Endgeräte `subscribe` auf Status; nur `ems-controller` darf relevante Write-Topics publishen.

5. **Kein netzignorierender Kundenmodus in Produktivbetrieb**
   Diagnose (`Nur beobachten` / `Manuell`) höchstens für `installer` während Inbetriebnahme, danach deaktiviert. Produktiv: GridControl dauerhaft aktiv, UserComfort nur darunter.

6. **Integrität**
   - Signierte/versionierte Policy für Grid-Mapping.
   - Append-only Audit: Steuerbefehle, Ceiling-Änderungen, fehlgeschlagene Bypass-Versuche, Installateur-Logins.
   - Optional: Tamper-Erkennung (AUX inkonsistent, unerwartete Limit-Erhöhung) → Alarm an Betrieb/Installateur.

### 8.4 Was der Endkunde weiterhin darf (ohne VNB-Konflikt)

- Sehen: ob Netzsteuerung aktiv ist, welches Limit gilt, welche Geräte gedimmt sind.
- Wählen: Reihenfolge/Priorität **innerhalb** des Restbudgets (WP vs. Wallbox).
- Setzen: Wunschzeiten („Auto bis 7:00 möglichst voll“) – Erfüllung nur wenn Ceiling und PV/SoC es erlauben.
- Opt-in: dynamischer Tarif / Peak-Shaving für **nicht netzgesperrte** Freiheitsgrade.
- Benachrichtigungen erhalten.

**Nicht erlaubt:** Limit anheben, Steuerfall ignorieren, AUX/EEBus umgehen, EMS in einen netzignorierenden Modus schalten, Rohzugriff auf Write-Topics.

### 8.5 Schutzprinzipien (Kurzform)

1. **Netzbefehl > Komfort > Optimierung** – technisch erzwungen, nicht nur dokumentiert.
2. **Mindestleistung statt hartem Aus**, soweit Befehl/Geräteklasse das vorsehen.
3. **Fail-safe:** AUX-Pfad unabhängig vom EMS; EMS-Ausfall darf Steuerbarkeit nicht entfernen.
4. **Transparenz ohne Eingriff:** erklären, nicht freischalten.
5. **Local-first & Härtung:** kein Internet-MQTT; least privilege.
6. **Wirtschaftlicher Schutz:** Steuerfall-Log für Netzentgelt-Nachweis; Batterie-SoC-Floor als Safety (nicht als Bypass).

### 8.6 Konkrete Umsetzung im Node.js-EMS

```text
VNB/Steuerbox/AUX/EEBus ──► GridConstraint (system-only, read-only für enduser)
                                    │
                                    ▼ gridCeilingKw
UserComfort request ──► clamp(min(request, ceiling, safety)) ──► actuators
                                    │
                                    ▼
                             audit + status UI (read-only für Grid)
```

| Baustein | Aufgabe |
|----------|---------|
| `GridConstraint` | nur `system`/`installer`-Bootstrap; Ceiling aus Netzsignal |
| `ActuatorGuard` | erzwingt Ceiling; blockt Bypass-Writes |
| `UserPolicy` | Prioritäten unterhalb Ceiling |
| `SafetyLimits` | SoC-Floor, max. Schreibrate, Geräte-max |
| `Rbac` | `enduser` / `installer` / `system` |
| `TamperAudit` | Bypass-Versuche, Limit-Inkonsistenzen |
| `StatusAPI` | Anzeige ohne Schreibfelder für Grid |
| `Watchdog` | EMS-Neustart; Grid-Pfad bleibt über Victron/AUX |

**Prioritätsbeispiel im Limit-Fall (4,2 kW Ceiling):** WP-Mindestbetrieb → Wallbox wenn Deadline → Speicher-Netzladung zuletzt; Summe netzwirksam ≤ Ceiling.

### 8.7 Organisatorisch gegenüber VNB / Installateur

- In der Anlagenbeschreibung festhalten: Endkunde hat **keinen** parametrisierenden Zugang zur Steuerfunktion.
- Installateur-Passwörter / Service-Zugänge nach IBN ändern und nicht in Kundenunterlagen legen.
- Abnahmeprotokoll: Steuerfall simulieren; parallel prüfen, dass Kunden-UI das Limit nicht anheben kann.
- Änderungen an GridControl nur über dokumentierten Serviceprozess (Installateur vor Ort / protokollierte Fernwartung).

### 8.8 Kurzfristig umsetzbar

1. AUX verdrahten, vom Wohnbereich trennen/plombierbar; herstellerseitige Victron-Reaktion testen.
2. EMS: Rolle `enduser` ohne Write auf Limits; ActuatorGuard mit Ceiling.
3. MQTT-ACL: Kunde/UI nur lesen.
4. Dashboard nur Status „Netzsteuerung aktiv – Limit x kW“.
5. Tamper-Audit + Alarm bei Bypass-Versuch.
6. Abnahme-Checkliste VNB: „Endkunde kann Steuerung nicht deaktivieren“.

---

## 9. Risiken und Entscheidungen

| Risiko | Mitigation |
|--------|------------|
| Falsche AUX-Logik / Firmware | Nur nach Herstellererklärung; Integrationstest mit VNB-Signal |
| MQTT Write zerstört ESS-Regelung | Schreibfrequenz begrenzen; ESS-Modi nicht ungeprüft umschalten |
| Endkunde umgeht §14a | Plombierter AUX-Pfad, RBAC, ActuatorGuard-Ceiling, kein Roh-MQTT für Kunden-UI |
| EEBus noch nicht greifbar | Abstraktion + physische Vorbereitung; ggf. Gateway kaufen |
| Scope-Creep (volles Smart Home) | EMS-Kern: Leistung + SteuVE; HA optional daneben, ohne Write auf GridControl |
| Haftung bei Fehlsteuerung | Fail-safe, Logs, klare Betriebsverantwortung |
| Komfortverlust durch EMS | Prioritäten unter Ceiling, Transparenz-UI (ohne Bypass) |

**Architekturentscheidung früh treffen:** EMS extern (empfohlen) vs. alles in Node-RED auf dem GX. Extern skaliert besser für Wallbox/Tarife/EEBus und für getrennte Kunden-/Service-Zugänge; Node-RED ist ideal als Stufe A/B-Beschleuniger, aber Write-ACLs und Rollen dort genauso hart setzen.

---

## 10. Definition of Done (erste nutzbare Version)

- [ ] Live-Messwerte aus Venus im EMS
- [ ] Mindestens eine automatische Optimierungsregel aktiv
- [ ] §14a-Signale (AUX oder äquivalent) werden erkannt und geloggt
- [ ] Mindestens eine zusätzliche SteuVE wird im Limit-Fall aktiv reduziert
- [ ] Fail-safe bei Kommunikationsverlust dokumentiert und getestet
- [ ] Schalt- und Signalplan für Elektriker/VNB vorhanden
- [ ] Endkunde sieht Steuerstatus (Ursache + Limit), kann GridControl **nicht** ändern
- [ ] ActuatorGuard erzwingt `gridCeiling`; Bypass-Versuch wird auditiert
- [ ] MQTT/API: Endkunden-Zugang ohne Write auf Steuer-Topics
- [ ] SafetyLimits (SoC-Floor, max. Schreibrate) und Watchdog aktiv
- [ ] Abnahmepunkt „keine Endkunden-Modifikation der Netzsteuerung“ dokumentiert

---

## 11. Nächste konkrete Arbeitspakete im Repo

1. `packages/victron-mqtt`: Topic-Katalog und Read/Write-Client.
2. `apps/collector`: Dienst mit Health-Endpoint.
3. `packages/rules`: reine Funktionen für §14a-Allokation + Tests.
4. `packages/safety`: SafetyLimits, ActuatorGuard-Ceiling, Watchdog, Fail-safe-Defaults.
5. `packages/rbac`: Rollen `enduser` / `installer` / `system`, TamperAudit.
6. `docs/vnb-checkliste.md`: Fragenkatalog Netzbetreiber inkl. Manipulationsschutz.
7. Optional: Docker-Compose für lokale Simulation mit Fixture-Publisher.
