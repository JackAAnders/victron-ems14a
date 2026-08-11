# EEBus an Cerbo / Venus anbinden

## Kurzantwort

**Der Cerbo GX hat derzeit keine zertifizierte, eingebaute EEBus-Schnittstelle** (VDE-AR-E 2829-6 / SHIP+SPINE) für §14a/§9.  
EEBus kommt **über Ethernet (RJ45)** von der Steuerbox — nicht über AUX, VE.Bus oder einen Victron-Spezialstecker.

Praktisch schließt man an:

1. **physisch** die Digitale Schnittstelle der Steuerbox (RJ45 im zRfZ / anlagenseitiger Anschlussraum) an ein **Kunden-LAN**, und  
2. **logisch** ein **EEBus-fähiges EMS/Gateway**, das die Befehle versteht und sie an Venus weitergibt (MQTT/Modbus/dbus) — z. B. dieses Projekt `victron-ems14a` **oder** ein zertifiziertes HEMS-Produkt.

Victron-seitig bleibt für die Abnahme oft parallel der **AUX-/2-Bit-Pfad** relevant, solange kein EEBus-Stack am EMS zertifiziert ist.

## 1. Was die Steuerbox physisch anbietet

Laut FNN / VNB-Umsetzungshilfen typischerweise im Zählerschrank:

| Übergabe | Medium | Nutzung |
|----------|--------|---------|
| Klemmleiste | potentialfreie Relais (2-Bit) | klassisch → Multi AUX |
| **RJ45-Buchse** | **Ethernet** | **digitale Schnittstelle → EEBus** |

Mindeststandard der digitalen Seite: **EEBus** über Ethernet (IPv4/IPv6, TLS, WebSocket/SHIP, Use Cases u. a. **LPC** Bezugsbegrenzung, **LPP** Einspeisebegrenzung).

```text
SMGW ──CLS──► Steuerbox
                 │
                 ├─ Relais K1/K2 ──► MultiPlus AUX   (§14a hardware)
                 │
                 └─ RJ45 (IF_CLS_CTRL / EEBus)
                        │
                        │ CAT5/6, oft eigener Patch
                        ▼
                 Switch (Kundenanlage / Technik-VLAN)
                        │
            ┌───────────┼───────────┐
            ▼           ▼           ▼
         Cerbo       EMS-Host    (WP/WB mit EEBus)
        (Ethernet)  (Node/EMS)
```

**Cerbo-Anschluss:** normales **Ethernet-Kabel** in den LAN-Port des Cerbo (oder in denselben Switch wie der EMS-Host). Es gibt **keinen** „EEBus-Port“ am Cerbo — nur IP.

## 2. Was am Cerbo *nicht* passiert

- Kein Aufstecken von EEBus auf VE.Can / VE.Bus / USB „out of the box“
- Venus OS spricht von Haus aus **kein** vollständiges EEBus-LPC/LPP mit Zertifikats-Lifecycle
- AUX am MultiPlus ist **kein** EEBus, sondern die Relais-Alternative

## 3. Sinnvolle Architekturen

### A — Empfohlen für dieses Repo (EMS = EEBus-Ende)

```text
Steuerbox RJ45 ──EEBus──► EMS (auf Venus oder Mini-PC im LAN)
                              │
                              ├─ GridConstraint / FeedInConstraint
                              ├─ MQTT localhost → Cerbo (EV, Limits)
                              └─ Relais/WP/Wallbox
```

- Cerbo und EMS **im selben LAN** (feste IPs, Technik-VLAN)
- Patch: zRfZ-RJ45 → Switch → EMS-NIC (und Cerbo am Switch)
- EMS implementiert später `EebusGridControlPort` → füllt dieselben Constraints wie heute AUX
- **Zertifizierung / SHIP-Zertifikate** sind der schwere Teil (nicht nur Kabel)

### B — Fremd-HEMS / Gateway mit EEBus, Cerbo nur Aktor

```text
Steuerbox ──EEBus──► zertifiziertes HEMS/Gateway
                         │ Modbus-TCP / MQTT / API
                         ▼
                      Cerbo / Venus
```

Nützlich, wenn schnell VNB-Digitalpfad nötig ist und Eigenbau-EEBus noch fehlt.

### C — Nur Relais (heute üblich mit Victron)

```text
Steuerbox K1/K2 ──► Multi AUX (+ optional Cerbo DI)
EMS liest Zustand, steuert EV/WP unter Ceiling
```

Das ist **kein** EEBus-Anschluss, erfüllt aber viele aktuelle §14a-Übergangs-/Herstellerwege.

## 4. Netzwerk-Checkliste (Elektriker / IT)

1. VNB/MSB: Ist die **RJ45-Digitale Schnittstelle** bestellt/verbaut?  
2. CAT-Leitung vom zRfZ zum Technikschrank (Leerrohr vorsehen).  
3. Kleiner **Switch** in der Kundenanlage, wenn mehrere EEBus-Teilnehmer (EMS, WP, Wallbox).  
4. Cerbo: Ethernet DHCP oder Fix-IP; **kein** Gäste-WLAN für Steuerpfad.  
5. EMS-Host: zweite NIC optional (Steuer-VLAN vs. Haus-LAN).  
6. Firewall: EEBus nur lokal; kein Port-Forward ins Internet.  
7. Dokumentation: welcher Port = „Steuerbox EEBus“, welcher = Cerbo.

## 5. Software-Anbindung in `victron-ems14a`

Heute: AUX/`digitalinput` → `GridConstraint` / `FeedInConstraint`.  
Für EEBus später derselbe Kern:

```text
EebusAdapter (LPC/LPP Use Cases)
    → maxSteuveGridKw / maxFeedInKw
    → bestehende ActuatorGuard-Logik
    → Cerbo MQTT (evcharger, Relais, Limits)
```

Cerbo bleibt Aktor-Bus; **EEBus-Peer ist das EMS**, nicht der Cerbo-Firmware-Kern.

## 6. Praktische Empfehlung

| Phase | Was verdrahten / bauen |
|-------|-------------------------|
| Jetzt | Steuerbox Relais → Multi AUX; Cerbo LAN für EMS/MQTT; CAT zum zRfZ **vorbereiten** |
| Digital | RJ45 Steuerbox → Switch → EMS; EEBus-Stack (Eigenbau mit Zertifizierung **oder** Gateway-Produkt) |
| Cerbo | Nur Ethernet + bestehende Victron-Steuerung; nicht „EEBus-Kabel direkt in einen Spezialport“ erwarten |

**Fazit:** EEBus bekommt man an den Cerbo, indem man die **Steuerbox-RJ45 ins gleiche Ethernet wie Cerbo/EMS** bringt und ein **EEBus-fähiges EMS/Gateway** die Befehle auswertet. Der Cerbo selbst ist (Stand übliche Victron-Ausstattung) der **Victron-Aktor**, nicht der EEBus-Endpunkt zur Steuerbox.
