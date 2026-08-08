# victron-ems14a

Planung und Umsetzung eines Energiemanagementsystems (EMS) für Victron-ESS mit Fokus auf §14a EnWG.

## Dokumente

- **[PLAN.md](./PLAN.md)** – physische und informatische Umsetzung, Rechtslage, Kurzfristziele, Phasen

## Geplante Richtung

- Victron Venus OS als energetische Basis (MQTT/Modbus)
- EMS-Policy-Layer bevorzugt in **Node.js/TypeScript**
- Kurzfristig: Monitoring, lokale Optimierung, AUX-basierte §14a-Koordination
- Mittelfristig: SteuVE-Allokation, Audit-Log, Vorbereitung digitaler Netzsteuerung (EEBus)
