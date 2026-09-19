/**
 * useTelemetryFeed.js — Robust REST polling for UAV Digital Twin
 * ==============================================================
 * - On mount: immediately starts a mission and begins polling
 * - Polls /telemetry/latest every 800ms
 * - Polls /faults every 2s for alerts
 * - HMR-safe: no module-level state that can get stuck across hot reloads
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { API_URL, apiHeaders } from '../lib/config'

const TELEMETRY_POLL_MS = 800
const ALERTS_POLL_MS    = 2000
const MAX_HISTORY        = 120
const MAX_ALERTS         = 50

// Normalize backend frame → internal shape
function normalizeTelemetry(raw) {
  if (!raw) return null
  return {
    timestamp:         raw.timestamp          ?? new Date().toISOString(),
    missionId:         raw.mission_id         ?? null,
    rpm:               raw.rpm                ?? null,
    egt:               raw.egt_c              ?? null,
    cht:               raw.cht_c              ?? null,
    oilPressure:       raw.oil_pressure_kpa   ?? null,
    oilTemp:           raw.oil_temp_c         ?? null,
    fuelFlow:          raw.fuel_flow_lph       ?? null,
    vibration:         raw.vibration_g         ?? null,
    altitude:          raw.altitude_m          ?? null,
    ambientTemp:       raw.ambient_temp_c      ?? null,
    faultLabel:        raw.fault_label         ?? null,
    throttle:          raw.throttle_pct        ?? null,
    batteryVoltage:    raw.battery_voltage_v   ?? null,
    alternatorCurrent: raw.alternator_current_a ?? null,
    injectionTiming:   raw.injection_timing_deg ?? null,
    map:               null,
  }
}

function normalizeAlert(raw) {
  if (!raw) return null
  const confidence = raw.confidence ?? 0.5
  return {
    id:           raw.id           ?? String(Date.now()),
    timestamp:    raw.timestamp    ?? new Date().toISOString(),
    faultType:    (raw.fault_type  ?? '').replace(/_/g, ' ').toUpperCase(),
    confidence,
    rulHours:     raw.rul_hours    ?? null,
    shapFeatures: raw.shap_top_features ?? [],
    severity:     confidence > 0.8 ? 'CRITICAL' : confidence > 0.5 ? 'WARNING' : 'CAUTION',
  }
}

// ── Module-level mission cache (survives across re-renders but NOT HMR) ──
// We store in window so HMR-reloaded modules can pick up the existing session
function getCachedMissionId() {
  return window.__uavMissionId ?? null
}
function setCachedMissionId(id) {
  window.__uavMissionId = id
}

async function startNewMission(profile = 'nominal', fault = 'none', speedup = 1) {
  const res = await fetch(`${API_URL}/simulation/start`, {
    method:  'POST',
    headers: apiHeaders(),
    body:    JSON.stringify({ profile, fault, speedup }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = await res.json()
  setCachedMissionId(data.mission_id)
  return data.mission_id
}

export function useTelemetryFeed() {
  const [telemetry,        setTelemetry]        = useState(null)
  const [telemetryHistory, setTelemetryHistory] = useState([])
  const [alerts,           setAlerts]           = useState([])
  const [connected,        setConnected]        = useState(false)
  const [lastValidAt,      setLastValidAt]      = useState(null)
  const [disconnectedAt,   setDisconnectedAt]   = useState(null)
  const [missionId,        setMissionId]        = useState(() => getCachedMissionId())

  const historyBuf   = useRef([])
  const missionIdRef = useRef(missionId)

  // Keep ref in sync
  useEffect(() => {
    missionIdRef.current = missionId
  }, [missionId])

  // Flush history to state every 1s
  useEffect(() => {
    const id = setInterval(() => {
      if (historyBuf.current.length > 0) {
        setTelemetryHistory([...historyBuf.current])
      }
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Commit a telemetry frame
  const commitTelemetry = useCallback((data) => {
    const frame      = data?.frame ?? data
    const normalized = normalizeTelemetry(frame)
    if (!normalized) return
    normalized.healthIndex       = data?.health_index        ?? null
    normalized.efficiencyPct     = data?.engine_efficiency_pct ?? null
    normalized.physicsResiduals  = data?.physics_residuals   ?? null
    normalized.expectedPhysics   = data?.expected_physics    ?? null
    setTelemetry(normalized)
    setLastValidAt(normalized.timestamp)
    setConnected(true)
    setDisconnectedAt(null)
    historyBuf.current = historyBuf.current.length >= MAX_HISTORY
      ? [...historyBuf.current.slice(-(MAX_HISTORY - 1)), normalized]
      : [...historyBuf.current, normalized]
  }, [])

  // ── Primary: REST telemetry polling ──────────────────────────────────
  useEffect(() => {
    let stopped = false
    let pollTimer = null
    let consecutive404s = 0

    let lastPolledMid = null

    const poll = async () => {
      let mid = getCachedMissionId()

      // If mission changed (e.g. fault injection started new mission), sync state + reset retry counter
      if (mid && mid !== lastPolledMid) {
        if (mid !== missionIdRef.current) setMissionId(mid)
        consecutive404s = 0  // fresh tolerance window for new mission
        lastPolledMid = mid
      }

      // Auto-start a mission if none exists
      if (!mid) {
        try {
          mid = await startNewMission()
          setMissionId(mid)
          lastPolledMid = mid
          consecutive404s = 0
          console.info('[useTelemetryFeed] Started mission:', mid)
        } catch (e) {
          console.warn('[useTelemetryFeed] Cannot start mission:', e.message)
          if (!stopped) pollTimer = setTimeout(poll, 3000)
          return
        }
      }

      try {
        const res = await fetch(`${API_URL}/telemetry/latest?mission_id=${mid}`, {
          headers: apiHeaders()
        })
        if (res.status === 404) {
          // 404 means no frames in DB. Could be dead, OR it's just booting up.
          // Give it 15 retries (~12 seconds) before we consider it permanently dead.
          consecutive404s++
          if (consecutive404s > 15) {
            console.warn('[useTelemetryFeed] Mission assumed dead after 15 retries. Restarting.')
            setCachedMissionId(null)
            setMissionId(null)
            consecutive404s = 0
          }
          if (!stopped) pollTimer = setTimeout(poll, 800)
          return
        }
        
        // Success
        consecutive404s = 0
        if (!res.ok) {
          setConnected(false)
          setDisconnectedAt(new Date().toISOString())
          if (!stopped) pollTimer = setTimeout(poll, TELEMETRY_POLL_MS)
          return
        }
        commitTelemetry(await res.json())
      } catch {
        setConnected(false)
        setDisconnectedAt(new Date().toISOString())
      }

      if (!stopped) pollTimer = setTimeout(poll, TELEMETRY_POLL_MS)
    }

    poll()
    return () => { stopped = true; clearTimeout(pollTimer) }
  }, [commitTelemetry])

  // ── Alerts / faults polling ──────────────────────────────────────────
  useEffect(() => {
    let stopped = false

    const poll = async () => {
      const mid = getCachedMissionId()
      if (!mid) return

      try {
        const res = await fetch(`${API_URL}/faults/${mid}`, { headers: apiHeaders() })
        if (!res.ok) return
        const data = await res.json()
        const rawAlerts = Array.isArray(data) ? data : data?.faults ?? []
        const normalized = rawAlerts.map(normalizeAlert).filter(Boolean).slice(0, MAX_ALERTS)
        if (normalized.length > 0) setAlerts(normalized)
      } catch { /* silent */ }
    }

    poll()
    const id = setInterval(poll, ALERTS_POLL_MS)
    return () => { stopped = true; clearInterval(id) }
  }, [])

  return {
    telemetry,
    telemetryHistory,
    alerts,
    connected,
    lastValidAt,
    disconnectedAt,
    missionId,
    rawTelemetry: useRef(null),
  }
}

// ── Fault injection into existing mission ────────────────────────────────
export async function startMissionWithFault(fault = 'none', _profile = 'nominal') {
  // Use dedicated inject-fault endpoint — returns a new mission_id
  try {
    const res = await fetch(`${API_URL}/simulation/inject-fault`, {
      method:  'POST',
      headers: apiHeaders(),
      body:    JSON.stringify({ fault, speedup: 60 }),
    })
    if (res.ok) {
      const data = await res.json()
      const newMid = data.mission_id
      setCachedMissionId(newMid)  // poll loop will pick this up on next tick
      console.info('[startMissionWithFault] Started fault mission:', newMid)
      return newMid
    }
  } catch (e) {
    console.warn('[startMissionWithFault] inject-fault failed, falling back:', e.message)
  }

  // Fallback: start new mission via simulation/start
  try {
    const newMid = await startNewMission('nominal', fault, 60)
    console.info('[startMissionWithFault] Started fault mission (fallback):', newMid)
    return newMid
  } catch (e) {
    console.error('[startMissionWithFault]', e)
    return null
  }
}
