# Schnittstelle Steuerbox ↔ Venus / EMS

Zielbetrieb: EMS läuft **auf Venus OS** (Cerbo GX / Large Image).  
Die **Steuerbox** (am SMGW / Messstellenbetreiber) ist die netzseitige Schnittstelle für **§14a** (und oft parallel Signale für **§9**/Einspeisemanagement – hersteller- und VNB-abhängig).

> Keine Rechts-/VNB-Beratung: Pinning und Logik immer nach aktueller Victron-Herstellererklärung und Vorgabe des Netzbetreibers.

## 1. Gesamtsicht

```text
  VNB / MSB
      │
  Smart-Meter-Gateway
      │
  Steuerbox (FNN)          ← netzseitiges Gerät, nicht das EMS
      │
      │  potentialfreie Kontakte K1, K2, …  (heute „2-Bit“)
      │  später optional: IP / EEBus zum EMS
      ▼
┌─────────────────────────────────────────┐
│  Kundenanlage                           │
│                                         │
│  MultiPlus Master  AUX1 / AUX2          │  §14a wirkt HIER hardwareseitig
│        │ VE.Bus                         │  auch wenn EMS tot ist
│        ▼                                │
│  Cerbo / Venus OS                       │
│    · spiegelt AUX / Digitaleingänge     │
│    · MQTT lokal  N/<portal>/…           │
│    · EMS (Node.js) auf Venus            │
│         GridConstraint  ← §14a          │
│         FeedInConstraint← §9            │
│         → EV / WP-Relais / Limits       │
└─────────────────────────────────────────┘
```

**Wichtig:** Die Schnittstelle zur Steuerbox ist primär **galvanisch getrennte Relaiskontakte**, nicht eine API des EMS. Das EMS **liest** den Zustand (über Venus) und verteilt das Budget; es **ersetzt** die Steuerbox nicht.

## 2. Heutige Schnittstelle (präventiv / 2-Bit) — §14a

### Physisch

| Steuerbox | Typisch Venus/Multi | Bedeutung (schematisch*) |
|-----------|---------------------|---------------------------|
| **K1** (potentialfrei) | **AUX1** am MultiPlus-Master (L1) | oft Sperre / starker Eingriff |
| **K2** (potentialfrei) | **AUX2** am MultiPlus-Master (L1) | oft Begrenzung Netzladung (z. B. auf Mindestleistung) |

\*Exakte Zuordnung und Ruhe-/Arbeitskontakt: **Victron ESS-/§14a-Herstellererklärung** + VNB-Doku.

Anforderungen:

- Verdrahtung nur im Zähler-/zRfZ-/Technikbereich, **kein** kundenbedienbarer Bypass
- Nur am **Master** verdrahten; Slave-Multis über VE.Bus
- EMS-Prozess darf diesen Pfad **nicht** unterbrechen können

### Logisch auf Venus

Venus spiegelt die Eingänge u. a. als:

- Digitaleingänge / `digitalinput/<id>/State` (MQTT), und/oder
- VE.Bus-/Multi-Zustände, die aus AUX resultieren (Limits bereits im Gerät)

EMS-Mapping (bereits im Code: `gridSignalFromAux`):

```text
digitalinput limited aktiv  →  GridMode = limited, ceiling = z. B. 4.2 kW
digitalinput off aktiv      →  GridMode = off,     ceiling = 0
beide inaktiv               →  GridMode = normal
```

Konfiguration (`.env` / Venus-Env):

- `VENUS_AUX_LIMIT_INSTANCE`, `VENUS_AUX_OFF_INSTANCE`
- `VENUS_LIMIT_KW=4.2`

### Was das EMS dann tut (unter dem Ceiling)

1. **EV-Charger** dimmen  
2. **Wärmepumpe** Ein/Aus + Stufen (Relais am Cerbo)  
3. **MultiPlus-Netzladung** (basic charger) zusätzlich begrenzen – parallel zur hardwareseitigen AUX-Reaktion

## 3. EEG §9 an der Steuerbox / Rundsteuerung

Oft **eigene** Kontakte oder ein Rundsteuerempfänger (nicht immer dieselben K1/K2 wie §14a).

EMS-seitig: `FeedInConstraint` / `feedInSignalFromInputs`

```text
Curtail-Kontakt aktiv  →  maxFeedInPercent (z. B. 0.6) × pvRatedKw
Zero-Kontakt aktiv     →  maxFeedInKw = 0
```

Wieder: physisches Signal hat Vorrang; EMS setzt zusätzlich Export-Caps in Venus, wo freigeschaltet.

## 4. Spätere Schnittstelle (netzorientiert / digital)

Laut BNetzA-/FNN-Zielbild oft:

- EMS als zentrale SteuVE-Schnittstelle
- **EEBus** (VDE-AR-E 2829-6) oder Steuerbox-IP laut Lastenheft
- RJ45 / CAT vom zRfZ zum EMS/Venus

Dann:

```text
Steuerbox/Gateway --EEBus/IP--> EMS auf Venus
                              --> GridConstraint / FeedInConstraint
```

Im Code ist das derselbe Port (`GridControlPort` / Signal-Objekte); nur die Quelle wechselt von AUX-Bits auf digitale Payloads. Endkunde bleibt ohne Schreibrecht.

**Anleitung Cerbo + EEBus (Kabel, Switch, EMS als Peer):** siehe [`EEBUS-CERBO.md`](./EEBUS-CERBO.md).

## 5. Betrieb „EMS auf Venus“

| Thema | Empfehlung |
|-------|------------|
| Laufzeit | Node auf Venus Large / Container / separatem Dienst neben Venus-Services |
| Daten | Lokal `mqtt://127.0.0.1:1883` (FlashMQ) — kein Internet-Broker |
| Steuerbox | Weiterhin **Kabel** zu AUX; EMS nur Subscriber |
| Fail-safe | AUX begrenzt Multi auch bei EMS-Crash; EV/WP: Watchdog → sichere Defaults |
| Manipulationsschutz | Kein Enduser-Root auf Write-Topics; Service-User für EMS |

```text
Steuerbox K1/K2 ──► Multi AUX          (Pflichtpfad §14a)
                 └──► (optional parallel) Cerbo DI zur klaren EMS-Anzeige

EMS on Venus ──MQTT──► liest DI / Systemzustand
          ──MQTT/dbus──► schreibt EV, Relais WP, ggf. Limits
```

## 6. Abnahme-relevant „Schnittstelle Steuerbox“

Für VNB/Elektriker zählt vor allem:

1. Schaltbild K1/K2 → AUX1/AUX2 (und ggf. §9-Kontakte)  
2. Funktionstest **ohne** EMS: Signal → Multi begrenzt  
3. Funktionstest **mit** EMS: EV/WP folgen Ceiling, UI zeigt Limit, Endkunde kann nicht erhöhen  
4. Kein Bypass-Schalter kundenseitig  

Siehe auch `docs/vnb-checkliste.md`.
