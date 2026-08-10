# Quickstart: §14a + EEG §9 EMS

```bash
npm install && npm test
npm start -w @victron-ems14a/controller
# shows ceilingKw, maxFeedInKw, heatPump level, wallbox, MultiPlus charger
```

API:

```bash
npm start -w @victron-ems14a/api
curl -H 'X-Role: enduser' http://127.0.0.1:8787/status
# grid.law = EnWG §14a, feedIn.law = EEG §9, both writableByEnduser: false
```

Live Cerbo: copy `.env.example`, set `VENUS_MQTT_URL`, AUX + optional §9 digitalinput instances, `VENUS_PV_RATED_KW`.
