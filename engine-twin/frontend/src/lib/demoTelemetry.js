/**
 * demoTelemetry.js — Centralised demo / fallback data
 * =====================================================
 * All hardcoded demo values live here and nowhere else.
 *
 * When backend is connected, TelemetryContext provides real data.
 * Components receive real data when available, fall back to this object.
 *
 * FUTURE: Replace individual fields with live API/WebSocket data by
 * passing real values through context and using this only as defaults.
 *
 * Shape is intentionally aligned with the WebSocket TelemetryRecord
 * and the AlertRecord models from the backend (backend/app/models.py).
 */

/** @type {import('./demoTelemetry').DemoState} */
export const DEMO = {
  // ── Engine summary ─────────────────────────────────────────────
  engineHealth: {
    score:  94.2,
    status: 'HEALTHY',    // HEALTHY | MONITOR | CRITICAL
    trend:  '+0.8%',
  },

  rul: {
    value:  21.4,         // hours
    unit:   'hr',
    trend:  'STABLE',     // string label or numeric delta like '-0.3 hr'
  },

  mission: {
    status: 'NOMINAL',    // NOMINAL | DEGRADED | ABORTED
    phase:  'LOITER',     // current phase key
  },

  ai: {
    status: 'ONLINE',
  },

  // ── Raw sensor values ──────────────────────────────────────────
  sensors: [
    { id: 'rpm',      label: 'RPM',           value: 2840,  unit: 'rpm',  status: 'NORMAL', trend: '+1.2%' },
    { id: 'egt',      label: 'EGT',           value: 684,   unit: '°C',   status: 'NORMAL', trend: '+0.4%' },
    { id: 'cht',      label: 'CHT',           value: 172,   unit: '°C',   status: 'NORMAL', trend: 'STABLE' },
    { id: 'oil_p',    label: 'Oil Pressure',  value: 48,    unit: 'psi',  status: 'NORMAL', trend: '-1.1%' },
    { id: 'oil_t',    label: 'Oil Temp',      value: 96,    unit: '°C',   status: 'NORMAL', trend: '+0.8%' },
    { id: 'fuel',     label: 'Fuel Flow',     value: 42.6,  unit: 'L/h',  status: 'NORMAL', trend: '-0.5%' },
    { id: 'vib',      label: 'Vibration',     value: 2.1,   unit: 'mm/s', status: 'NORMAL', trend: 'STABLE' },
    { id: 'map',      label: 'MAP',           value: 1.18,  unit: 'bar',  status: 'NORMAL', trend: '+0.2%' },
  ],

  // ── Subsystem health ───────────────────────────────────────────
  subsystems: [
    { id: 'cyl1', label: 'Cylinder 1',  health: 96, status: 'HEALTHY',  trend: '+0.4%' },
    { id: 'cyl2', label: 'Cylinder 2',  health: 94, status: 'HEALTHY',  trend: 'STABLE' },
    { id: 'cyl3', label: 'Cylinder 3',  health: 92, status: 'HEALTHY',  trend: '-0.3%' },
    { id: 'cyl4', label: 'Cylinder 4',  health: 95, status: 'HEALTHY',  trend: '+0.2%' },
    { id: 'lub',  label: 'Lubrication', health: 89, status: 'MONITOR',  trend: '-1.2%' },
    { id: 'cool', label: 'Cooling',     health: 97, status: 'HEALTHY',  trend: 'STABLE' },
    { id: 'turbo',label: 'Turbo',       health: 91, status: 'HEALTHY',  trend: '+0.3%' },
    { id: 'vib',  label: 'Vibration',   health: 88, status: 'MONITOR',  trend: '-0.6%' },
  ],

  // ── AI assessment ──────────────────────────────────────────────
  aiAssessment: {
    fault:     'Oil pressure degradation detected',
    severity:  'MEDIUM',     // LOW | MEDIUM | HIGH | CRITICAL
    confidence: 93,          // percent
    subsystem: 'Lubrication',
  },

  // ── Mission phases ─────────────────────────────────────────────
  missionPhases: ['TAKEOFF', 'CLIMB', 'CRUISE', 'LOITER', 'DESCENT'],

  // ── Demo fault alerts (shape matches AlertRecord + extra fields) ─
  // FaultAlerts.jsx expects: { timestamp, fault_type, confidence, rul_hours, shap_top_features }
  // Live dashboard also shows: severity, subsystem, message
  alerts: [
    {
      timestamp:         new Date(Date.now() - 6 * 60_000).toISOString(),
      fault_type:        'lubrication',
      confidence:        0.71,
      rul_hours:         21.4,
      shap_top_features: ['oil_pressure', 'oil_temp', 'vibration'],
      severity:          'WARNING',
      subsystem:         'Lubrication',
      message:           'Oil pressure trending below nominal',
    },
    {
      timestamp:         new Date(Date.now() - 22 * 60_000).toISOString(),
      fault_type:        'sensor_drift',
      confidence:        0.62,
      rul_hours:         null,
      shap_top_features: ['cht', 'egt'],
      severity:          'WARNING',
      subsystem:         'Sensors',
      message:           'CHT sensor reading marginally high',
    },
  ],

  // ── Historical RUL trend for chart (synthetic, descending slowly) ─
  // Shape matches telemetry ring-buffer entries used by RULChart
  rulHistory: Array.from({ length: 30 }, (_, i) => ({
    timestamp:  new Date(Date.now() - (29 - i) * 60_000).toISOString(),
    rul_hours:  22.1 - i * 0.023,          // slow linear degradation
    rpm:        2830 + Math.sin(i * 0.4) * 40,
    egt:        682  + Math.sin(i * 0.3) * 8,
    cht:        171  + Math.cos(i * 0.5) * 4,
    vibration:  2.05 + Math.sin(i * 0.6) * 0.15,
  })),
}

// ── Status colour helper (shared, no logic in components) ─────────
export const STATUS_COLOR = {
  HEALTHY:  '#39D98A',
  NORMAL:   '#39D98A',
  MONITOR:  '#F2B84B',
  WARNING:  '#F2B84B',
  CRITICAL: '#FF5C5C',
  ONLINE:   '#39D98A',
  NOMINAL:  '#39D98A',
  DEGRADED: '#F2B84B',
  STABLE:   '#8FA1A9',
}

export function statusColor(s) {
  return STATUS_COLOR[s?.toUpperCase()] ?? '#8FA1A9'
}

export function trendColor(t) {
  if (!t || t === 'STABLE') return '#8FA1A9'
  if (t.startsWith('+')) return '#39D98A'
  if (t.startsWith('-')) return '#F2B84B'
  return '#8FA1A9'
}
