/**
 * telemetryService.js
 * ====================
 * Normalization layer between raw WebSocket messages and the
 * typed frontend telemetry state.
 *
 * BACKEND CONTRACT (do not change without updating backend AND README.md):
 *
 *   WebSocket message type "telemetry":
 *     { timestamp, rpm, egt, cht, oil_pressure, oil_temp,
 *       fuel_flow, vibration, altitude, ambient_temp, fault_label? }
 *
 *   WebSocket message type "alert":
 *     { id?, timestamp, fault_type, confidence, rul_hours?, shap_top_features[] }
 *
 * This service translates that shape to NormalizedTelemetry (see below).
 * All field renames and unit conversions happen here — never in components.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Type constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fields the backend sends in every telemetry message.
 * These map directly from snake_case → camelCase.
 *
 * @typedef {Object} RawTelemetry
 * @property {string}  timestamp
 * @property {number}  rpm
 * @property {number}  egt           — Exhaust Gas Temperature (°C)
 * @property {number}  cht           — Cylinder Head Temperature (°C)
 * @property {number}  oil_pressure  — (bar)
 * @property {number}  oil_temp      — (°C)
 * @property {number}  fuel_flow     — (L/h)
 * @property {number}  vibration     — (g)
 * @property {number}  altitude      — (m)
 * @property {number}  ambient_temp  — (°C)
 * @property {string|null} fault_label — ML classifier label, null = normal
 */

/**
 * Frontend-normalized telemetry shape.
 * Components import this type — NOT RawTelemetry.
 *
 * @typedef {Object} NormalizedTelemetry
 * @property {string}      timestamp
 * @property {number}      rpm
 * @property {number}      egt
 * @property {number}      cht
 * @property {number}      oilPressure   — renamed from oil_pressure
 * @property {number}      oilTemp       — renamed from oil_temp
 * @property {number}      fuelFlow      — renamed from fuel_flow
 * @property {number}      vibration
 * @property {number}      altitude
 * @property {number}      ambientTemp   — renamed from ambient_temp
 * @property {string|null} faultLabel    — renamed from fault_label
 * @property {number|null} map           — NOT in backend schema → always null until backend adds it
 * @property {number|null} batteryVoltage— NOT in backend schema → always null
 */

/**
 * Normalize a raw WS telemetry payload to the frontend shape.
 * Call this once per WS message — keep it pure (no side effects).
 *
 * @param {RawTelemetry} raw
 * @returns {NormalizedTelemetry}
 */
export function normalizeTelemetry(raw) {
  if (!raw || typeof raw !== 'object') return null

  return {
    timestamp:      raw.timestamp ?? new Date().toISOString(),
    rpm:            raw.rpm            ?? null,
    egt:            raw.egt            ?? null,
    cht:            raw.cht            ?? null,
    oilPressure:    raw.oil_pressure   ?? null,
    oilTemp:        raw.oil_temp       ?? null,
    fuelFlow:       raw.fuel_flow      ?? null,
    vibration:      raw.vibration      ?? null,
    altitude:       raw.altitude       ?? null,
    ambientTemp:    raw.ambient_temp   ?? null,
    faultLabel:     raw.fault_label    ?? null,
    // Fields not yet in backend schema — reserved for future
    map:            raw.map            ?? null,
    batteryVoltage: raw.battery_voltage ?? null,
  }
}

/**
 * Normalize a raw WS alert payload.
 *
 * @typedef {Object} NormalizedAlert
 * @property {string}   timestamp
 * @property {string}   faultType
 * @property {number}   confidence   — 0.0–1.0
 * @property {number|null} rulHours
 * @property {string[]} shapFeatures
 * @property {string}   severity     — derived from confidence
 */

/**
 * @param {object} raw
 * @returns {NormalizedAlert}
 */
export function normalizeAlert(raw) {
  if (!raw || typeof raw !== 'object') return null

  const conf = raw.confidence ?? 0
  const severity = conf >= 0.85 ? 'CRITICAL'
                 : conf >= 0.60 ? 'WARNING'
                 : 'INFO'

  return {
    id:           raw.id             ?? null,
    timestamp:    raw.timestamp      ?? new Date().toISOString(),
    faultType:    raw.fault_type     ?? 'UNKNOWN',
    confidence:   conf,
    rulHours:     raw.rul_hours      ?? null,
    shapFeatures: raw.shap_top_features ?? [],
    severity,
    // Legacy fields kept for backward compat with FaultAlerts component
    fault_type:          raw.fault_type      ?? 'UNKNOWN',
    rul_hours:           raw.rul_hours       ?? null,
    shap_top_features:   raw.shap_top_features ?? [],
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Physics expected values
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Physics-expected values are NOT provided by the current backend.
 * They will come from the ML service in a future phase.
 *
 * When `physicsExpected` is null, the UI shows "EXPECTED DATA UNAVAILABLE".
 * Never fabricate expected values.
 *
 * @typedef {Object} PhysicsExpected
 * @property {number|null} egt
 * @property {number|null} oilPressure
 * @property {number|null} fuelFlow
 * @property {number|null} cht
 * @property {number|null} vibration
 */

/** @returns {PhysicsExpected|null} always null until ML service provides it */
export function getPhysicsExpected(_normalized) {
  // TODO (ML team): wire to /api/ml/expected when available
  // The ML service at port 8001 is the future source for this data.
  return null
}

/**
 * Compute deviation between actual and expected value.
 * Returns null if either value is missing.
 *
 * @param {number|null} actual
 * @param {number|null} expected
 * @returns {{ delta: number, pct: number, direction: 'above'|'below'|'nominal' }|null}
 */
export function computeDeviation(actual, expected) {
  if (actual == null || expected == null) return null
  const delta = actual - expected
  const pct   = expected !== 0 ? (delta / expected) * 100 : 0
  const direction = Math.abs(pct) < 2 ? 'nominal'
                  : pct > 0           ? 'above'
                  : 'below'
  return { delta, pct, direction }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sensor metadata (units, labels, thresholds)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Sensor descriptor for display. Consumed by TelemetryPage sensor table.
 * Thresholds are indicative for the MALE UAV aero-piston engine class.
 * Update when ML team provides calibrated limits.
 */
export const SENSOR_META = [
  {
    key:    'rpm',
    label:  'RPM',
    unit:   'rpm',
    warnLow:  1500,
    warnHigh: 3200,
    critHigh: 3500,
    format: (v) => v != null ? Math.round(v).toLocaleString() : '—',
  },
  {
    key:    'egt',
    label:  'EGT',
    unit:   '°C',
    warnHigh: 750,
    critHigh: 850,
    format: (v) => v != null ? v.toFixed(1) : '—',
  },
  {
    key:    'cht',
    label:  'CHT',
    unit:   '°C',
    warnHigh: 220,
    critHigh: 260,
    format: (v) => v != null ? v.toFixed(1) : '—',
  },
  {
    key:    'oilPressure',
    label:  'Oil Pressure',
    unit:   'bar',
    warnLow:  2.0,
    warnHigh: 6.0,
    critLow:  1.5,
    format: (v) => v != null ? v.toFixed(2) : '—',
  },
  {
    key:    'oilTemp',
    label:  'Oil Temp',
    unit:   '°C',
    warnHigh: 120,
    critHigh: 140,
    format: (v) => v != null ? v.toFixed(1) : '—',
  },
  {
    key:    'fuelFlow',
    label:  'Fuel Flow',
    unit:   'L/h',
    warnLow:  10,
    warnHigh: 80,
    format: (v) => v != null ? v.toFixed(1) : '—',
  },
  {
    key:    'vibration',
    label:  'Vibration',
    unit:   'g',
    warnHigh: 4.0,
    critHigh: 6.0,
    format: (v) => v != null ? v.toFixed(3) : '—',
  },
  {
    key:    'altitude',
    label:  'Altitude',
    unit:   'm',
    format: (v) => v != null ? Math.round(v).toLocaleString() : '—',
  },
  {
    key:    'ambientTemp',
    label:  'Ambient Temp',
    unit:   '°C',
    format: (v) => v != null ? v.toFixed(1) : '—',
  },
]

/**
 * Determine sensor status from value and thresholds.
 * @param {number|null} value
 * @param {object} meta  — one entry from SENSOR_META
 * @returns {'NORMAL'|'WARNING'|'CRITICAL'|'NO DATA'}
 */
export function sensorStatus(value, meta) {
  if (value == null) return 'NO DATA'
  const { critLow, critHigh, warnLow, warnHigh } = meta
  if ((critLow  != null && value < critLow)  ||
      (critHigh != null && value > critHigh)) return 'CRITICAL'
  if ((warnLow  != null && value < warnLow)  ||
      (warnHigh != null && value > warnHigh)) return 'WARNING'
  return 'NORMAL'
}
