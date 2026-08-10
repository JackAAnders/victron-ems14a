# VNB- / Abnahme-Checkliste (§14a + Manipulationsschutz)

## Klärung vor IBN

- [ ] Welche SteuVE sind meldepflichtig?
- [ ] Netzentgelt-Modul (welches)?
- [ ] Steuerweg: 2-Bit Relais / Steuerbox / später EEBus?
- [ ] Forderung: Endkunde darf Steuerung nicht parametrisch ändern?
- [ ] Fristen iMSys / Smart-Meter-Gateway

## Physisch

- [ ] K1/K2 → AUX1/AUX2 am Victron-Master laut Herstellererklärung
- [ ] Kein kundenbedienbarer Bypass parallel zu den Kontakten
- [ ] Signalweg im Zähler-/zRfZ-Bereich, nicht Wohnraum-Klemmleiste
- [ ] Test ohne EMS: Steuerfall → Victron limitiert wie spezifiziert
- [ ] Leerrohr/CAT für spätere digitale Schnittstelle

## Software / EMS

- [ ] Endkunden-UI zeigt Ceiling, bietet keinen „§14a aus“-Schalter
- [ ] API: `enduser` → 403 auf Grid-Write
- [ ] ActuatorGuard: Summe netzwirksamer SteuVE-Bezug ≤ Ceiling
- [ ] MQTT-Write nur Service-Account; Kunden-UI ohne Broker-Write
- [ ] Bypass-Versuch im Audit-Log
- [ ] Steuerfall-Simulation dokumentiert (Zeiten, Soll/Ist)

## Nachweis Abnahme

- [ ] Protokoll: Signal aktiv, gemessene Begrenzung
- [ ] Protokoll: Endkunde versucht Limit zu erhöhen → abgewiesen
- [ ] Installateur-Zugänge nicht in Kundenunterlagen
