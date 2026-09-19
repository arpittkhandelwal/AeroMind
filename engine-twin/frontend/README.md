# ENGINE-TWIN Frontend — Telemetry Data Contract

**SIH26054 · Digital Twin · Frontend/Backend Interface Reference**

> **Audience**: Frontend developers, backend team, simulator team, ML team.
> This document is the single source of truth for what the frontend expects from the backend.
> All changes to this contract require coordination across all teams.

---

## Running locally

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build
```

Environment variables (`.env` or Docker Compose):

```
VITE_API_URL=http://localhost:8000   # Backend REST API
VITE_WS_URL=ws://localhost:8000/ws   # WebSocket endpoint
```

---

## 1. WebSocket Endpoint

```
ws://localhost:8000/ws
```

The frontend connects automatically on mount and reconnects every 3 seconds on disconnect.

### Message envelope

All WebSocket messages use this top-level envelope:

```json
{
  "type": "telemetry" | "alert",
  "data": { ... }
}
```

---

## 2. Telemetry Message

**Trigger**: Backend receives MQTT on topic `engine/telemetry` → broadcasts to all WS clients.

### Wire format (backend → frontend)

```json
{
  "type": "telemetry",
  "data": {
    "timestamp":    "2026-09-18T04:00:00.000Z",
    "rpm":          2840.0,
    "egt":          684.2,
    "cht":          172.1,
    "oil_pressure": 3.48,
    "oil_temp":     96.3,
    "fuel_flow":    42.6,
    "vibration":    2.105,
    "altitude":     1200.0,
    "ambient_temp": 28.5,
    "fault_label":  "normal"
  }
}
```

### Frontend normalized shape (`NormalizedTelemetry`)

After `normalizeTelemetry()` in `src/services/telemetryService.js`:

| Frontend field    | Backend field    | Type         | Notes                                   |
|-------------------|------------------|--------------|-----------------------------------------|
| `timestamp`       | `timestamp`      | string (ISO) |                                         |
| `rpm`             | `rpm`            | number       | rotations per minute                    |
| `egt`             | `egt`            | number       | Exhaust Gas Temperature (°C)            |
| `cht`             | `cht`            | number       | Cylinder Head Temperature (°C)          |
| `oilPressure`     | `oil_pressure`   | number       | renamed snake_case → camelCase          |
| `oilTemp`         | `oil_temp`       | number       | renamed snake_case → camelCase          |
| `fuelFlow`        | `fuel_flow`      | number       | renamed snake_case → camelCase          |
| `vibration`       | `vibration`      | number       | (g — gravitational acceleration)        |
| `altitude`        | `altitude`       | number       | (metres)                                |
| `ambientTemp`     | `ambient_temp`   | number       | renamed snake_case → camelCase          |
| `faultLabel`      | `fault_label`    | string\|null | ML classifier output                    |
| `map`             | *(not sent)*     | null         | Reserved — add when backend provides it |
| `batteryVoltage`  | *(not sent)*     | null         | Reserved — add when backend provides it |

> **Rule**: Components must NEVER read `oil_pressure` from raw data directly.
> Always use `oilPressure` from the normalized shape.
> Normalization happens once in `useWebSocket.js` via `normalizeTelemetry()`.

---

## 3. Alert Message

**Trigger**: Backend receives MQTT on topic `engine/alerts` → broadcasts to all WS clients.

### Wire format (backend → frontend)

```json
{
  "type": "alert",
  "data": {
    "id":                42,
    "timestamp":         "2026-09-18T04:00:00.000Z",
    "fault_type":        "lubrication",
    "confidence":        0.71,
    "rul_hours":         21.4,
    "shap_top_features": ["oil_pressure", "vibration"]
  }
}
```

### Frontend normalized shape (`NormalizedAlert`)

After `normalizeAlert()` in `src/services/telemetryService.js`:

| Frontend field   | Backend field         | Notes                                           |
|------------------|-----------------------|-------------------------------------------------|
| `id`             | `id`                  | null if not provided                            |
| `timestamp`      | `timestamp`           |                                                 |
| `faultType`      | `fault_type`          | renamed                                         |
| `confidence`     | `confidence`          | 0.0–1.0                                         |
| `rulHours`       | `rul_hours`           | renamed; null if unavailable                    |
| `shapFeatures`   | `shap_top_features`   | renamed                                         |
| `severity`       | *(derived)*           | CRITICAL ≥0.85 · WARNING ≥0.60 · INFO <0.60    |

Also kept for backward compat with `FaultAlerts.jsx`: `fault_type`, `rul_hours`, `shap_top_features`.

---

## 4. REST Endpoints

| Method | Path                        | Response          | Caller / frequency              |
|--------|-----------------------------|-------------------|---------------------------------|
| GET    | `/api/alerts/health-index`  | `HealthIndex`     | `TelemetryContext` every 10 s   |
| GET    | `/api/telemetry/latest`     | `TelemetryRecord` | Available, not yet called       |
| GET    | `/api/telemetry/history`    | `TelemetryRecord[]` | `MissionReplay` on demand     |
| GET    | `/api/alerts?limit=N`       | `AlertRecord[]`   | Available, not yet called       |
| GET    | `/health`                   | `{status,service}`| Available, not yet called       |

### `HealthIndex` shape

```json
{
  "score":      94.2,
  "status":     "nominal",
  "updated_at": "2026-09-18T04:00:00.000Z"
}
```

`status` values: `"nominal"` | `"degraded"` | `"critical"`

---

## 5. Fields NOT Yet Provided by Backend

These are `null` in the frontend until the backend/ML team adds support.

| Field                    | Future source                | Frontend file to update when ready                     |
|--------------------------|------------------------------|--------------------------------------------------------|
| `map`                    | Simulator (MAP sensor)       | `src/services/telemetryService.js` → `normalizeTelemetry()` |
| `batteryVoltage`         | Simulator / hardware         | same                                                   |
| Physics expected EGT     | ML service (port 8001)       | `src/services/telemetryService.js` → `getPhysicsExpected()` |
| Physics expected OilP    | ML service (port 8001)       | same                                                   |
| Physics expected FuelFlow | ML service (port 8001)      | same                                                   |
| `rul` in telemetry frame | ML service (port 8001)       | Currently only available via alert `rul_hours`         |
| `engineId`               | Simulator config             | Add to `TelemetryRecord`                               |
| `missionId`              | Simulator config             | Add to `TelemetryRecord`                               |

> **ML team**: Physics-expected values → implement `GET /api/ml/expected` returning `PhysicsExpected`
> and update `getPhysicsExpected()` in `src/services/telemetryService.js`.

---

## 6. Frontend Data Flow

```
Backend MQTT broker (engine/telemetry, engine/alerts)
  └─► backend/app/mqtt_listener.py
        └─► manager.broadcast({ type: "telemetry"|"alert", data: ... })

WebSocket ws://localhost:8000/ws
  └─► src/hooks/useWebSocket.js
        ├─► normalizeTelemetry(raw)  → NormalizedTelemetry
        ├─► normalizeAlert(raw)      → NormalizedAlert
        │     (src/services/telemetryService.js)
        ├─► setTelemetry(normalized)          ← latest; re-renders subscribers
        ├─► historyBuf.current.push(...)      ← ring buffer (useRef, NO re-render)
        └─► setTelemetryHistory() flush       ← every 1 s → triggers chart updates

src/context/TelemetryContext.jsx
  ├─► telemetry         NormalizedTelemetry | null
  ├─► telemetryHistory  NormalizedTelemetry[]  (120 samples, 1 s flush)
  ├─► alerts            NormalizedAlert[]      (50 max, newest first)
  ├─► connected         boolean
  ├─► lastValidAt       ISO string | null
  ├─► disconnectedAt    ISO string | null
  └─► healthIndex       { score, status, updated_at }

Pages
  ├─► /             Overview.jsx      — Live Operations Dashboard
  ├─► /live         LiveMonitor.jsx   — Stream-focused monitor
  ├─► /telemetry    TelemetryPage.jsx — Charts, A vs E, sensor table
  ├─► /diagnostics  Diagnostics.jsx   — (Phase 2)
  └─► /digital-twin DigitalTwin.jsx   — (Phase 3 — Three.js)
```

---

## 7. Disconnect Behaviour

- On disconnect: **last valid telemetry is preserved** (never cleared)
- `connected = false`
- `disconnectedAt` = ISO timestamp of disconnect
- `lastValidAt` = timestamp of last good WS message
- UI shows `TELEMETRY DISCONNECTED` banner with last-valid time and relative age
- Reconnect retries every 3 seconds automatically

---

## 8. High-Frequency Rendering Strategy

Backend sends telemetry at ~1 Hz. The frontend avoids unnecessary re-renders:

| Data            | Update mechanism                    | Re-render scope          |
|-----------------|-------------------------------------|--------------------------|
| Latest telemetry | `useState` → every WS message      | Gauges, metric cards     |
| Chart buffer    | `useRef` + 1 s `setInterval` flush  | Chart components only    |
| Alerts          | `useState` → per alert message      | Alert list               |
| Health index    | `useState` → REST poll every 10 s   | Health gauge             |

---

## 9. Sensor Thresholds

Defined in `src/services/telemetryService.js → SENSOR_META`.
These are **indicative** for the MALE UAV aero-piston engine class.

| Sensor       | Warn Low | Warn High | Crit Low | Crit High | Unit |
|--------------|----------|-----------|----------|-----------|------|
| RPM          | 1500     | 3200      | —        | 3500      | rpm  |
| EGT          | —        | 750       | —        | 850       | °C   |
| CHT          | —        | 220       | —        | 260       | °C   |
| Oil Pressure | 2.0      | 6.0       | 1.5      | —         | bar  |
| Oil Temp     | —        | 120       | —        | 140       | °C   |
| Fuel Flow    | 10       | 80        | —        | —         | L/h  |
| Vibration    | —        | 4.0       | —        | 6.0       | g    |

---

## 10. Key Source Files

| File                                      | Purpose                                                |
|-------------------------------------------|--------------------------------------------------------|
| `src/hooks/useWebSocket.js`               | WS connection, normalization entry point, ring buffer  |
| `src/services/telemetryService.js`        | Pure normalization functions, SENSOR_META, thresholds  |
| `src/utils/telemetry.js`                  | Pure display formatting utilities                      |
| `src/context/TelemetryContext.jsx`        | React context — app-wide telemetry state               |
| `src/lib/demoTelemetry.js`               | Centralised demo/fallback data                         |
| `src/lib/config.js`                       | `API_URL`, `WS_URL` from Vite env vars                 |
| `src/lib/colors.js`                       | Design system color constants                          |
| `src/pages/TelemetryPage.jsx`             | `/telemetry` — charts, sensor table, Actual vs Expected|
| `src/pages/Overview.jsx`                  | `/` — Live Operations Dashboard                        |
| `src/pages/LiveMonitor.jsx`               | `/live` — Stream-focused monitor                       |
| `src/components/HealthGauge.jsx`          | SVG health gauge (props: score, status, trend)         |
| `src/components/RULChart.jsx`             | Recharts sensor trend chart (props: history, rulValue) |
| `src/components/FaultAlerts.jsx`          | Alert list (props: alerts, onViewAll)                  |
| `src/components/layout/AppShell.jsx`      | TopBar + Sidebar + Outlet layout                       |
| `src/components/layout/TopBar.jsx`        | 48px top bar with status pills, UTC clock              |
| `src/components/layout/Sidebar.jsx`       | Collapsible navigation sidebar                         |

---

*Last updated: 2026-09-18 · SIH26054 ENGINE-TWIN*
