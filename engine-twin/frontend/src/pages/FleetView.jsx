/**
 * FleetView.jsx — Fleet Health Grid (route: /fleet)
 * ==================================================
 * Shows 3 simulated UAVs with live health index, fault status, and RUL.
 * Reuses existing single-mission endpoints — starts 3 parallel missions
 * on mount and polls each independently.
 *
 * NOTE: This demonstrates the fleet monitoring infrastructure concept.
 * A production fleet system would have a fleet-level orchestration layer,
 * but the core prediction pipeline (physics → ML → HI) is identical per UAV.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Activity, AlertTriangle, CheckCircle, Clock, Wifi, WifiOff } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import { API_URL, apiHeaders } from '../lib/config'

// The 3 simulated UAVs in our demo fleet
const FLEET_DRONES = [
  { id: 'UAV-07', callsign: 'TAPAS-BH-201', profile: 'nominal',       fault: 'none',            role: 'ISR Primary',       color: '#39D98A' },
  { id: 'UAV-12', callsign: 'TAPAS-BH-212', profile: 'hot_weather',   fault: 'lubrication_issue', role: 'ISR Secondary',    color: '#F2B84B' },
  { id: 'UAV-19', callsign: 'TAPAS-BH-219', profile: 'rapid_throttle', fault: 'misfire',          role: 'Strike Support',  color: '#FF5C5C' },
]

async function startFleetMission(profile, fault) {
  try {
    const res = await fetch(`${API_URL}/simulation/start`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify({ profile, fault, speedup: 60 }),
    })
    if (res.ok) {
      const d = await res.json()
      return d.mission_id
    }
  } catch (e) { console.warn('[FleetView] mission start failed:', e.message) }
  return null
}

async function pollDroneStatus(missionId) {
  if (!missionId) return null
  try {
    const res = await fetch(`${API_URL}/telemetry/latest?mission_id=${missionId}`, {
      headers: apiHeaders(),
    })
    if (res.ok) return await res.json()
  } catch { /* silent */ }
  return null
}

function HealthBar({ score }) {
  const col = score >= 80 ? '#39D98A' : score >= 50 ? '#F2B84B' : '#FF5C5C'
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#8FA1A9' }}>Health Index</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: col, fontFamily: 'monospace' }}>{score?.toFixed(0) ?? '--'}</span>
      </div>
      <div style={{ height: 5, background: '#172830', borderRadius: 3 }}>
        <div style={{
          height: '100%', width: `${score ?? 0}%`, background: col, borderRadius: 3,
          transition: 'width 1s ease', boxShadow: `0 0 6px ${col}60`,
        }} />
      </div>
    </div>
  )
}

function DroneCard({ drone, missionId, telemetryData, connected }) {
  const hi = telemetryData?.health_index ?? null
  const alerts = telemetryData?.active_alerts ?? []
  const hasAlert = alerts.length > 0
  const frame = telemetryData?.frame ?? {}

  const statusCol = !connected ? '#4A6270' : !hi ? '#8FA1A9' : hi >= 80 ? '#39D98A' : hi >= 50 ? '#F2B84B' : '#FF5C5C'
  const statusLabel = !connected ? 'NO LINK' : !hi ? 'INITIALISING' : hi >= 80 ? 'NOMINAL' : hi >= 50 ? 'CAUTION' : 'CRITICAL'

  return (
    <Panel style={{ flex: 1, minWidth: 280, position: 'relative' }}>
      {/* Status beacon */}
      <div style={{
        position: 'absolute', top: 14, right: 14,
        width: 10, height: 10, borderRadius: '50%', background: statusCol,
        boxShadow: connected ? `0 0 8px ${statusCol}` : 'none',
        animation: connected && hasAlert ? 'pulse 1s ease-in-out infinite' : 'none',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 6, background: `${drone.color}20`,
          border: `1px solid ${drone.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {connected ? <Wifi size={16} color={drone.color} /> : <WifiOff size={16} color="#4A6270" />}
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#E2F0F8', fontFamily: 'monospace' }}>{drone.id}</div>
          <div style={{ fontSize: 10, color: '#4A6270', letterSpacing: '0.06em' }}>{drone.callsign}</div>
        </div>
      </div>

      {/* Role + Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: 10, color: '#8FA1A9' }}>{drone.role}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, color: statusCol,
          background: `${statusCol}20`, padding: '2px 7px', borderRadius: 3,
        }}>{statusLabel}</span>
      </div>

      {/* Health bar */}
      <HealthBar score={hi ?? 100} />

      {/* Key metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
        {[
          { label: 'RPM',    value: frame.rpm         ? `${Math.round(frame.rpm)}` : '—' },
          { label: 'EGT',    value: frame.egt_c        ? `${frame.egt_c.toFixed(0)}°C` : '—' },
          { label: 'Oil P',  value: frame.oil_pressure_kpa ? `${frame.oil_pressure_kpa.toFixed(0)} kPa` : '—' },
          { label: 'Vib',    value: frame.vibration_g  ? `${frame.vibration_g.toFixed(2)}g` : '—' },
        ].map(m => (
          <div key={m.label} style={{ padding: '6px 10px', background: '#071014', borderRadius: 4, border: '1px solid #172830' }}>
            <div style={{ fontSize: 9, color: '#4A6270', marginBottom: 2 }}>{m.label}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#E2F0F8', fontFamily: 'monospace' }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Alert strip */}
      {hasAlert && (
        <div style={{
          marginTop: 12, padding: '8px 10px', background: '#2A0D0D',
          border: '1px solid #FF5C5C40', borderRadius: 4,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <AlertTriangle size={12} color="#FF5C5C" />
          <span style={{ fontSize: 11, color: '#FF5C5C', fontWeight: 700 }}>
            {alerts[0]?.fault_type?.replace(/_/g, ' ').toUpperCase() ?? 'FAULT DETECTED'}
          </span>
        </div>
      )}

      {/* Mission ID */}
      {missionId && (
        <div style={{ marginTop: 8, fontSize: 9, color: '#4A6270', fontFamily: 'monospace' }}>
          MISSION: {missionId.slice(0, 12)}…
        </div>
      )}
    </Panel>
  )
}

export default function FleetView() {
  const [missions, setMissions]     = useState({})   // droneId → missionId
  const [statuses, setStatuses]     = useState({})   // droneId → telemetryData
  const [connected, setConnected]   = useState({})   // droneId → bool
  const [initialised, setInitialised] = useState(false)

  // Start 3 missions on mount
  useEffect(() => {
    if (initialised) return
    setInitialised(true)

    const init = async () => {
      const missionMap = {}
      for (const drone of FLEET_DRONES) {
        const mid = await startFleetMission(drone.profile, drone.fault)
        if (mid) missionMap[drone.id] = mid
      }
      setMissions(missionMap)
    }
    init()
  }, [initialised])

  // Poll all drones every 2s
  useEffect(() => {
    const poll = async () => {
      const statusMap = {}
      const connMap   = {}
      for (const drone of FLEET_DRONES) {
        const mid = missions[drone.id]
        const data = await pollDroneStatus(mid)
        statusMap[drone.id] = data
        connMap[drone.id]   = data !== null
      }
      setStatuses(statusMap)
      setConnected(connMap)
    }

    if (Object.keys(missions).length === 0) return
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [missions])

  const fleetHealth = FLEET_DRONES.reduce((sum, d) => {
    const hi = statuses[d.id]?.health_index ?? 100
    return sum + hi
  }, 0) / FLEET_DRONES.length

  const activeFaults = FLEET_DRONES.filter(d => (statuses[d.id]?.active_alerts ?? []).length > 0).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader
        icon={Activity}
        title="Fleet Health Monitor"
        subtitle={`${FLEET_DRONES.length} UAVs · TAPAS-BH series · live health index polling`}
        badge={activeFaults > 0 ? `${activeFaults} ACTIVE FAULT${activeFaults > 1 ? 'S' : ''}` : 'FLEET NOMINAL'}
        badgeColor={activeFaults > 0 ? '#FF5C5C' : '#39D98A'}
      />

      {/* Fleet summary bar */}
      <Panel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#4A6270', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Fleet Health Index</div>
            <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'monospace', color: fleetHealth >= 80 ? '#39D98A' : fleetHealth >= 50 ? '#F2B84B' : '#FF5C5C' }}>
              {fleetHealth.toFixed(0)}
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#4A6270', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>UAVs Airborne</div>
            <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'monospace', color: '#55C7E8' }}>{FLEET_DRONES.length}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 10, color: '#4A6270', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Active Faults</div>
            <div style={{ fontSize: 36, fontWeight: 800, fontFamily: 'monospace', color: activeFaults > 0 ? '#FF5C5C' : '#39D98A' }}>{activeFaults}</div>
          </div>
        </div>
      </Panel>

      {/* Drone cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {FLEET_DRONES.map(drone => (
          <DroneCard
            key={drone.id}
            drone={drone}
            missionId={missions[drone.id]}
            telemetryData={statuses[drone.id]}
            connected={connected[drone.id] ?? false}
          />
        ))}
      </div>

      <div style={{ fontSize: 11, color: '#4A6270', textAlign: 'center', marginTop: 4 }}>
        Fleet data polls every 2 seconds via REST. Each UAV runs an independent simulation mission with different fault profiles.
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )
}
