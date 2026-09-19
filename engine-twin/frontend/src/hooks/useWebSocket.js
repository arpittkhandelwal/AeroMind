/**
 * useWebSocket.js (adapted for UAV Digital Twin REST backend)
 * ===========================================================
 * Originally used WebSocket/MQTT. Rewired to poll our FastAPI backend
 * at http://localhost:8000 which serves REST endpoints.
 *
 * Polling strategy:
 *   - Starts a mission on mount (or uses the last active one)
 *   - Polls /missions/{id}/latest every 800ms for telemetry
 *   - Polls /missions/{id}/faults every 2s for alerts
 *   - Polls /health-index every 5s for health score
 *
 * The returned shape is identical to the original hook so all
 * existing consumers (LiveMonitor, Overview, etc.) work unchanged.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { API_URL } from '../lib/config'

const TELEMETRY_POLL_MS = 800
const ALERTS_POLL_MS    = 2000
const MAX_HISTORY        = 120
const MAX_ALERTS         = 50

// Map our backend field names → engine-twin normalized shape
function normalizeTelemetry(raw) {
  if (!raw) return null
  return {
    timestamp:      raw.timestamp ?? new Date().toISOString(),
    rpm:            raw.rpm            ?? null,
    egt:            raw.egt_c          ?? null,
    cht:            raw.cht_c          ?? null,
    oilPressure:    raw.oil_pressure_kpa ? raw.oil_pressure_kpa / 100 : null, // kPa → bar
    oilTemp:        raw.oil_temp_c     ?? null,
    fuelFlow:       raw.fuel_flow_lph  ?? null,
    vibration:      raw.vibration_g    ?? null,
    altitude:       raw.altitude_m     ?? null,
    ambientTemp:    raw.ambient_temp_c ?? null,
    faultLabel:     raw.fault_label    ?? null,
    throttle:       raw.throttle_pct   ?? null,
    map:            null,
    batteryVoltage: raw.battery_voltage_v ?? null,
  }
}

function normalizeAlert(raw) {
  if (!raw) return null
  const confidence = raw.confidence ?? 0.5
  return {
    id:           raw.id ?? String(Date.now()),
    timestamp:    raw.timestamp ?? new Date().toISOString(),
    faultType:    (raw.fault_type ?? '').replace(/_/g, ' ').toUpperCase(),
    confidence,
    rulHours:     raw.rul_hours ?? null,
    shapFeatures: raw.shap_top_features ?? [],
    severity:     confidence > 0.8 ? 'CRITICAL' : confidence > 0.5 ? 'WARNING' : 'CAUTION',
  }
}

// Global mission state shared across instances
let _activeMissionId = null
let _missionStarted  = false

async function ensureMission() {
  if (_activeMissionId) return _activeMissionId
  if (_missionStarted) return null
  _missionStarted = true
  try {
    const res = await fetch(`${API_URL}/missions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ profile: 'nominal', fault: 'none', speedup: 1 }),
    })
    if (res.ok) {
      const data = await res.json()
      _activeMissionId = data.mission_id
      console.info('[useWebSocket] Auto-started mission:', _activeMissionId)
    }
  } catch (e) {
    console.warn('[useWebSocket] Could not start mission:', e.message)
    _missionStarted = false
  }
  return _activeMissionId
}

export function useWebSocket() {
  const [telemetry,        setTelemetry]        = useState(null)
  const [telemetryHistory, setTelemetryHistory] = useState([])
  const [alerts,           setAlerts]           = useState([])
  const [connected,        setConnected]        = useState(false)
  const [lastValidAt,      setLastValidAt]      = useState(null)
  const [disconnectedAt,   setDisconnectedAt]   = useState(null)
  const [missionId,        setMissionId]        = useState(_activeMissionId)

  const historyBuf = useRef([])
  const rawRef     = useRef(null)

  // Flush history buffer to React state every 1s
  useEffect(() => {
    const id = setInterval(() => {
      if (historyBuf.current.length > 0) {
        setTelemetryHistory([...historyBuf.current])
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Boot: ensure a mission is running
  useEffect(() => {
    ensureMission().then(id => {
      if (id) setMissionId(id)
    })
  }, [])

  // Poll telemetry
  useEffect(() => {
    if (!missionId) return

    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/missions/${missionId}/latest`)
        if (!res.ok) { setConnected(false); setDisconnectedAt(new Date().toISOString()); return }

        const data     = await res.json()
        const frame    = data?.frame ?? data
        const normalized = normalizeTelemetry(frame)
        if (!normalized) return

        rawRef.current = frame
        setTelemetry(normalized)
        setLastValidAt(normalized.timestamp)
        setConnected(true)
        setDisconnectedAt(null)

        historyBuf.current = historyBuf.current.length >= MAX_HISTORY
          ? [...historyBuf.current.slice(-(MAX_HISTORY - 1)), normalized]
          : [...historyBuf.current, normalized]
      } catch {
        setConnected(false)
        setDisconnectedAt(new Date().toISOString())
      }
    }

    poll()
    const id = setInterval(poll, TELEMETRY_POLL_MS)
    return () => clearInterval(id)
  }, [missionId])

  // Poll alerts/faults
  useEffect(() => {
    if (!missionId) return

    const poll = async () => {
      try {
        const res = await fetch(`${API_URL}/missions/${missionId}/faults`)
        if (!res.ok) return
        const data = await res.json()
        const rawAlerts = Array.isArray(data) ? data : data?.faults ?? []
        const normalized = rawAlerts
          .map(normalizeAlert)
          .filter(Boolean)
          .slice(0, MAX_ALERTS)
        if (normalized.length > 0) {
          setAlerts(normalized)
        }
      } catch { /* silent */ }
    }

    poll()
    const id = setInterval(poll, ALERTS_POLL_MS)
    return () => clearInterval(id)
  }, [missionId])

  return {
    telemetry,
    telemetryHistory,
    alerts,
    connected,
    lastValidAt,
    disconnectedAt,
    missionId,
    rawTelemetry: rawRef,
  }
}

// Export helper for pages that need to start/control missions
export async function startMissionWithFault(fault = 'none', profile = 'nominal') {
  try {
    const res = await fetch(`${API_URL}/missions`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ profile, fault, speedup: 60 }),
    })
    if (res.ok) {
      const data = await res.json()
      _activeMissionId = data.mission_id
      _missionStarted  = true
      return data.mission_id
    }
  } catch (e) {
    console.error('[startMissionWithFault]', e)
  }
  return null
}
