# Quickstart: 001-ems-multiplus-wallbox

## Prerequisites

- Node.js ≥ 20
- Optional: Cerbo GX on LAN with MQTT enabled

## Install & test

```bash
cd /workspace   # or repo root
npm install
npm test
```

## Demo without Cerbo

```bash
npm start -w @victron-ems14a/controller
npm start -w @victron-ems14a/api
# curl -H 'X-Role: enduser' http://127.0.0.1:8787/status
```

## Live Cerbo

```bash
cp .env.example .env
# set VENUS_MQTT_URL=mqtt://<cerbo-ip>:1883
# set VENUS_PORTAL_ID if known; else discover from first notifies
# set VENUS_AUX_LIMIT_INSTANCE to your digitalinput id
npm start -w @victron-ems14a/collector
```

## Spec Kit

```bash
# Active feature
export SPECIFY_FEATURE=001-ems-multiplus-wallbox
export SPECIFY_FEATURE_DIRECTORY=specs/001-ems-multiplus-wallbox

# Agent skills (after specify init): /speckit-tasks, /speckit-implement, /speckit-converge
```

## VNB evidence (software)

1. Simulate limit via system/installer signal or real AUX.
2. Show `/status` ceiling + `writableByEnduser: false`.
3. Attempt enduser `POST /grid/signal` → 403 + audit.
4. Keep physical AUX test independent of EMS (Elektriker).
