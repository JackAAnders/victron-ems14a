# API Contract: EMS HTTP (MVP) — §14a + §9

Base URL: `http://<ems-host>:8787`  
Auth stub: `X-Role: enduser | installer | system`

## GET /health → `{ "ok": true }`

## GET /status

```json
{
  "grid": {
    "source": "aux",
    "mode": "limited",
    "maxSteuveGridKw": 4.2,
    "ceilingKw": 4.2,
    "writableByEnduser": false,
    "law": "EnWG §14a"
  },
  "feedIn": {
    "source": "rundsteuerung",
    "mode": "curtailed",
    "maxFeedInPercent": 0.6,
    "maxFeedInKw": 6,
    "writableByEnduser": false,
    "law": "EEG §9"
  },
  "wish": {
    "wallboxKw": 7,
    "heatPump": { "preferOn": true, "preferredLevel": 2 }
  },
  "lastSetpoints": {
    "heatPumpKw": 2,
    "heatPump": { "mode": "level", "level": 2, "powerKw": 2 },
    "wallboxKw": 2.2,
    "batteryGridChargeKw": 0,
    "maxFeedInKw": 6
  }
}
```

## PUT /comfort

Body: `UserComfortWish` (wallboxKw, heatPump.preferOn/preferredLevel, priorities)

## POST /grid/signal (§14a)

Roles: `grid:write` only. Enduser → **403**.

## POST /feedin/signal (§9)

Roles: `grid:write` only. Enduser → **403**.

Body example:

```json
{
  "source": "rundsteuerung",
  "mode": "curtailed",
  "maxFeedInPercent": 0.6
}
```

## POST /control/tick

Returns `ceilingKw`, `maxFeedInKw`, `effective` (incl. `heatPump`, `wallboxKw`, `batteryGridChargeKw`).
