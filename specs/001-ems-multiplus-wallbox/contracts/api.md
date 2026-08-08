# API Contract: EMS HTTP (MVP)

Base URL: `http://<ems-host>:8787`

Auth (MVP stub): header `X-Role: enduser | installer | system`  
(Production MUST replace with real authentication; contract roles remain.)

## GET /health

- **Roles**: any
- **200**: `{ "ok": true }`

## GET /status

- **Roles**: `status:read` (enduser, installer, system)
- **200**:
```json
{
  "grid": {
    "source": "aux",
    "mode": "limited",
    "maxSteuveGridKw": 4.2,
    "receivedAt": "2026-08-08T22:00:00.000Z",
    "ceilingKw": 4.2,
    "writableByEnduser": false
  },
  "wish": { "wallboxKw": 7 },
  "lastSetpoints": { "heatPumpKw": 0, "wallboxKw": 4.2, "batteryGridChargeKw": 0 }
}
```

## PUT /comfort

- **Roles**: `comfort:write` (enduser, installer)
- **Body**: UserComfortWish partial JSON
- **200**: `{ "ok": true, "wish": { ... } }`

## POST /grid/signal

- **Roles**: `grid:write` (installer with `manual_installer` source, or system)
- **Body**:
```json
{
  "source": "aux",
  "mode": "limited",
  "maxSteuveGridKw": 4.2
}
```
- **200**: `{ "ok": true, "ceilingKw": 4.2 }`
- **403**: enduser or forbidden source/role combo; body includes `error` and optional `audit`

## POST /control/tick

- **Roles**: `status:read` (triggers system-side apply internally)
- **200**:
```json
{
  "ceilingKw": 4.2,
  "effective": { "heatPumpKw": 0, "wallboxKw": 4.2, "batteryGridChargeKw": 0 },
  "deniedBypass": false
}
```

## Error shape

```json
{ "error": "forbidden" | "forbidden_grid_write" | "not_found" | "internal", "message": "..." }
```
