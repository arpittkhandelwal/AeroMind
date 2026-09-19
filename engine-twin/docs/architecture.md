# Architecture — SIH26054 Digital Twin

This is the **single source of truth** for all interface contracts.
If you change a topic name, schema field, or API path, update this doc first
and announce it in the team chat.

---

## System Diagram

```
┌────────────────────────────────────────────────────────────┐
│  Engine Simulator (Python 3.11 · paho-mqtt · numpy)        │
│  simulator/simulator/                                       │
│    engine_model.py  → steady-state sensor generation       │
│    fault_injection.py → 6 fault perturbation functions     │
│    mission_profiles.py → altitude / temp variation         │
│    publisher.py → publish loop @ ~1 Hz                     │
└───────────────────────┬────────────────────────────────────┘
                        │ MQTT  engine/telemetry
                        ▼
           ┌─────────────────────────┐
           │  Mosquitto 2.0          │
           │  :1883 (anon, local)    │
           └──────┬──────────────────┘
                  │              │
          subscribe              subscribe
                  │              │
    ┌─────────────▼──────┐  ┌───▼──────────────────┐
    │ Backend (FastAPI)   │  │  ML Service (FastAPI) │
    │ :8000               │  │  :8001                │
    │ mqtt_listener.py    │  │  serve.py             │
    │   → TimescaleDB     │  │    anomaly_detection  │
    │   → WS broadcast    │  │    fault_classifier   │
    │ routes/             │  │    rul_model          │
    │   telemetry.py      │  │    explainability     │
    │   alerts.py         │  │                       │
    └────────┬────────────┘  └──────────┬────────────┘
             │ WS /ws                   │ MQTT engine/alerts
             │                          │
    ┌────────▼──────────────────────────▼────────────┐
    │  React Dashboard (Vite + Tailwind + Recharts)   │
    │  :5173                                          │
    │  useWebSocket → live telemetry + alerts state   │
    │  HealthGauge · FaultAlerts · RULChart           │
    │  MissionReplay (REST GET /api/telemetry/history)│
    └─────────────────────────────────────────────────┘
             │
    ┌────────▼────────────────┐
    │  TimescaleDB (pg15)     │
    │  :5432                  │
    │  hypertable: telemetry  │
    │  table:      alerts     │
    └─────────────────────────┘
```

---

## MQTT Topics

### `engine/telemetry`

Published by `simulator` every ~1 s.  Subscribed by `backend` and `ml`.

```json
{
  "timestamp":    "2026-09-03T09:30:00.123Z",
  "rpm":          2412.5,
  "egt":          731.2,
  "cht":          177.6,
  "oil_pressure": 4.51,
  "oil_temp":     91.3,
  "fuel_flow":    15.8,
  "vibration":    0.112,
  "altitude":     3000.0,
  "ambient_temp": -4.5,
  "fault_label":  null
}
```

| Field | Type | Unit | Notes |
|-------|------|------|-------|
| timestamp | ISO8601 string | UTC | |
| rpm | float | RPM | Crankshaft speed |
| egt | float | °C | Exhaust Gas Temp |
| cht | float | °C | Cylinder Head Temp |
| oil_pressure | float | bar | Gallery pressure |
| oil_temp | float | °C | Sump temperature |
| fuel_flow | float | L/h | Mass flow proxy |
| vibration | float | g RMS | Lateral vibration |
| altitude | float | m MSL | From mission profile |
| ambient_temp | float | °C | From mission profile |
| fault_label | string \| null | — | Ground-truth for ML training |

### `engine/alerts`

Published by `ml` after inference when anomaly score ≥ threshold.
Subscribed by `backend` (writes to DB + WS broadcast).

```json
{
  "timestamp":         "2026-09-03T09:30:01.456Z",
  "fault_type":        "misfire",
  "confidence":        0.91,
  "rul_hours":         312.5,
  "shap_top_features": ["vibration", "egt", "rpm"]
}
```

---

## Backend REST API

Base URL: `http://localhost:8000`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check → `{"status":"ok"}` |
| GET | `/api/telemetry/latest` | Most recent telemetry row |
| GET | `/api/telemetry/history?from=&to=` | Rows in ISO8601 time range (mission replay) |
| GET | `/api/alerts` | 20 most recent alerts |
| GET | `/api/alerts/health-index` | Derived health score 0–100 |
| WS | `/ws` | Real-time push of telemetry + alerts |

### WebSocket Message Shape

```json
{ "type": "telemetry", "data": { /* TelemetryRecord */ } }
{ "type": "alert",     "data": { /* AlertRecord */     } }
```

---

## ML Service REST API

Base URL: `http://localhost:8001`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| POST | `/infer` | Ad-hoc inference; body = telemetry JSON |

---

## TimescaleDB Schema

```sql
-- Hypertable (partitioned by timestamp, 1-hour chunks)
CREATE TABLE telemetry (
    timestamp       TIMESTAMPTZ NOT NULL,
    rpm             DOUBLE PRECISION,
    egt             DOUBLE PRECISION,
    cht             DOUBLE PRECISION,
    oil_pressure    DOUBLE PRECISION,
    oil_temp        DOUBLE PRECISION,
    fuel_flow       DOUBLE PRECISION,
    vibration       DOUBLE PRECISION,
    altitude        DOUBLE PRECISION,
    ambient_temp    DOUBLE PRECISION,
    fault_label     TEXT
);

-- Regular table
CREATE TABLE alerts (
    id                  SERIAL PRIMARY KEY,
    timestamp           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fault_type          TEXT NOT NULL,
    confidence          DOUBLE PRECISION,
    rul_hours           DOUBLE PRECISION,
    shap_top_features   JSONB
);
```

---

## Fault Classes

| ID | Label | Sensor Signature |
|----|-------|-----------------|
| 0 | normal | All nominal |
| 1 | misfire | ↓ RPM, ↑ EGT, ↑ vibration |
| 2 | injector | ↓ fuel_flow, ↑ EGT, ↓ RPM |
| 3 | lubrication | ↓ oil_pressure, ↑ oil_temp, ↑ CHT |
| 4 | sensor_drift | Bias on EGT, oil_pressure (no real change) |
| 5 | combustion | ↑ EGT variance, ↓ RPM, ↑ vibration |
| 6 | overheating | ↑ CHT, ↑ oil_temp, ↑ EGT |

---

## Environment Variables

See [`.env.example`](../.env.example) for the full list with defaults.

---

## Port Map

| Service | Container port | Host port |
|---------|---------------|-----------|
| frontend | 5173 | 5173 |
| backend | 8000 | 8000 |
| ml | 8001 | 8001 |
| mosquitto | 1883 | 1883 |
| timescaledb | 5432 | 5432 |
