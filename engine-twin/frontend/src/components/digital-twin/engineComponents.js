/**
 * engineComponents.js — Component manifest for the Digital Twin
 * ==============================================================
 * Defines the logical engine components, their telemetry mappings,
 * and their physical positions for the procedural fallback geometry.
 *
 * When a real GLB model is available:
 *   1. Set MODEL_PATH to the public/ asset path
 *   2. Update each component's `meshName` to match the GLB node name
 *
 * telemetryKey — maps to NormalizedTelemetry field names from
 *               src/services/telemetryService.js normalizeTelemetry()
 */

export const MODEL_PATH = null
// export const MODEL_PATH = '/models/engine_male_uav.glb'  // ← set when model is ready

/**
 * Logical engine component definitions.
 * `position` is used by the procedural fallback geometry only.
 * `meshName` must match the GLB node name exactly (case-sensitive).
 *
 * @typedef {Object} EngineComponent
 * @property {string}   id
 * @property {string}   label
 * @property {string}   group        — 'cylinders' | 'systems' | 'sensors'
 * @property {string}   meshName     — GLB mesh/node name (null = not yet mapped)
 * @property {number[]} position     — [x,y,z] fallback position
 * @property {number[]} scale        — [x,y,z] fallback scale
 * @property {object}   telemetry    — maps display fields → normalized telemetry keys
 */

/** @type {EngineComponent[]} */
export const ENGINE_COMPONENTS = [
  {
    id:       'cyl1',
    label:    'Cylinder 1',
    group:    'cylinders',
    meshName: null,
    position: [-1.2,  0,  0.6],
    scale:    [0.35, 0.8, 0.35],
    color:    '#2A4A5C',
    telemetry: { egt: 'egt', cht: 'cht' },
  },
  {
    id:       'cyl2',
    label:    'Cylinder 2',
    group:    'cylinders',
    meshName: null,
    position: [-0.4,  0,  0.6],
    scale:    [0.35, 0.8, 0.35],
    color:    '#2A4A5C',
    telemetry: { egt: 'egt', cht: 'cht' },
  },
  {
    id:       'cyl3',
    label:    'Cylinder 3',
    group:    'cylinders',
    meshName: null,
    position: [ 0.4,  0,  0.6],
    scale:    [0.35, 0.8, 0.35],
    color:    '#2A4A5C',
    telemetry: { egt: 'egt', cht: 'cht' },
  },
  {
    id:       'cyl4',
    label:    'Cylinder 4',
    group:    'cylinders',
    meshName: null,
    position: [ 1.2,  0,  0.6],
    scale:    [0.35, 0.8, 0.35],
    color:    '#2A4A5C',
    telemetry: { egt: 'egt', cht: 'cht' },
  },
  {
    id:       'crankshaft',
    label:    'Crankshaft',
    group:    'systems',
    meshName: null,
    position: [  0, -0.5, 0],
    scale:    [2.8, 0.22, 0.22],
    color:    '#1E3A4A',
    telemetry: { rpm: 'rpm', vibration: 'vibration' },
  },
  {
    id:       'turbo',
    label:    'Turbo',
    group:    'systems',
    meshName: null,
    position: [ 1.9,  0.3, 0],
    scale:    [0.55, 0.55, 0.55],
    color:    '#1C3848',
    telemetry: {},
  },
  {
    id:       'lubrication',
    label:    'Lubrication',
    group:    'systems',
    meshName: null,
    position: [-1.9, -0.2, 0],
    scale:    [0.5, 0.45, 0.45],
    color:    '#1C3848',
    telemetry: { oilPressure: 'oilPressure', oilTemp: 'oilTemp' },
  },
  {
    id:       'cooling',
    label:    'Cooling',
    group:    'systems',
    meshName: null,
    position: [  0,  1.0, 0],
    scale:    [2.6, 0.3, 0.6],
    color:    '#1A3444',
    telemetry: { ambientTemp: 'ambientTemp' },
  },
  {
    id:       'sensors',
    label:    'Sensors',
    group:    'sensors',
    meshName: null,
    position: [  0,  0, -0.7],
    scale:    [2.6, 0.12, 0.12],
    color:    '#15303E',
    telemetry: { vibration: 'vibration' },
  },
]

/** Quick lookup by id */
export const COMPONENT_MAP = Object.fromEntries(ENGINE_COMPONENTS.map(c => [c.id, c]))

/**
 * Determine a component's health status from telemetry and fault info.
 * Returns: 'nominal' | 'warning' | 'critical'
 */
export function componentHealthStatus(compId, telemetry, alerts) {
  if (!telemetry) return 'nominal'

  // Check if there's an active alert referencing this component's telemetry group
  const comp = COMPONENT_MAP[compId]
  if (!comp) return 'nominal'

  const relevantKeys = Object.values(comp.telemetry)

  // Look at the most recent alert's shap features to see if they overlap
  const latestAlert = alerts?.[0]
  if (latestAlert) {
    const features = latestAlert.shap_top_features ?? latestAlert.shapFeatures ?? []
    const conf = latestAlert.confidence ?? 0
    const overlaps = relevantKeys.some(k => {
      // Map normalized key back to raw feature names for SHAP
      const rawKey = k === 'oilPressure' ? 'oil_pressure'
                   : k === 'oilTemp'     ? 'oil_temp'
                   : k === 'fuelFlow'    ? 'fuel_flow'
                   : k === 'ambientTemp' ? 'ambient_temp'
                   : k
      return features.includes(rawKey) || features.includes(k)
    })
    if (overlaps) {
      return conf >= 0.85 ? 'critical' : conf >= 0.6 ? 'warning' : 'nominal'
    }
  }

  // Cylinder thermal check
  if (comp.group === 'cylinders') {
    const egt = telemetry.egt
    const cht = telemetry.cht
    if (egt > 800 || cht > 240) return 'critical'
    if (egt > 720 || cht > 200) return 'warning'
  }

  // Oil pressure check for lubrication
  if (compId === 'lubrication') {
    const op = telemetry.oilPressure
    if (op != null && op < 1.5) return 'critical'
    if (op != null && op < 2.0) return 'warning'
  }

  // Vibration check
  if (compId === 'sensors' || compId === 'crankshaft') {
    const v = telemetry.vibration
    if (v != null && v > 6.0) return 'critical'
    if (v != null && v > 4.0) return 'warning'
  }

  return 'nominal'
}

/** Colour for component based on health */
export function healthColor(status, baseColor) {
  if (status === 'critical') return '#7A1A1A'
  if (status === 'warning')  return '#5C3A00'
  return baseColor
}

/** Emissive colour for component */
export function healthEmissive(status) {
  if (status === 'critical') return '#FF5C5C'
  if (status === 'warning')  return '#F2B84B'
  return '#000000'
}

/** Emissive intensity */
export function healthEmissiveIntensity(status) {
  if (status === 'critical') return 0.35
  if (status === 'warning')  return 0.20
  return 0
}
