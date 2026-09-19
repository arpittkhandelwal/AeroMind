/**
 * FleetIntelligence.jsx — Multi-UAV Fleet Intelligence Hub (route: /fleet-intelligence)
 */

import React, { useState, useEffect } from 'react'
import {
  Activity, AlertTriangle, CheckCircle, Radio, Shield,
  Clock, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react'
import { API_URL, apiHeaders } from '../lib/config'

const FLEET = [
  {
    id: 'UAV-07', callsign: 'TAPAS-BH-201', role: 'ISR Primary',
    profile: 'nominal', fault: 'none',
    color: '#22c55e', status: 'NOMINAL', mission: 'RECONNAISSANCE-ALPHA',
    lat: '28.6139°N', lon: '77.2090°E', alt: '4500m', speed: '180 km/h',
  },
  {
    id: 'UAV-12', callsign: 'TAPAS-BH-212', role: 'ISR Secondary',
    profile: 'hot_weather', fault: 'lubrication_issue',
    color: '#f59e0b', status: 'CAUTION', mission: 'SURVEILLANCE-BRAVO',
    lat: '28.7041°N', lon: '77.1025°E', alt: '4200m', speed: '165 km/h',
  },
  {
    id: 'UAV-19', callsign: 'TAPAS-BH-219', role: 'Strike Support',
    profile: 'rapid_throttle', fault: 'misfire',
    color: '#ef4444', status: 'CRITICAL · RTB', mission: 'PATROL-CHARLIE',
    lat: '28.5355°N', lon: '77.3910°E', alt: '3800m', speed: '210 km/h',
  },
]

async function startMission(profile, fault) {
  try {
    const res = await fetch(`${API_URL}/simulation/start`, {
      method: 'POST', headers: apiHeaders(),
      body: JSON.stringify({ profile, fault, speedup: 60 }),
    })
    if (res.ok) return (await res.json()).mission_id
  } catch { }
  return null
}

async function fetchTelemetry(missionId) {
  if (!missionId) return null
  try {
    const res = await fetch(`${API_URL}/telemetry/latest?mission_id=${missionId}`, { headers: apiHeaders() })
    if (res.ok) return await res.json()
  } catch { }
  return null
}

function PulseDot({ color, animate = false }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: color, boxShadow: `0 0 6px ${color}`,
      animation: animate ? 'fleetPulse 1.4s ease-in-out infinite' : 'none',
    }} />
  )
}

function FleetCard({ drone, missionId, tele, expanded, onToggle }) {
  const hi = tele?.health_index ?? null
  const frame = tele?.frame ?? {}
  const alerts = tele?.active_alerts ?? []
  const hasAlert = alerts.length > 0
  const connected = tele !== null
  const healthColor = !hi ? '#64748b' : hi >= 80 ? '#22c55e' : hi >= 55 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{
      background: '#0f172a', border: `1px solid ${drone.color}30`,
      borderRadius: 10, overflow: 'hidden', boxShadow: `0 0 24px ${drone.color}10`,
    }}>
      <div style={{
        background: `linear-gradient(135deg, ${drone.color}12 0%, transparent 100%)`,
        borderBottom: `1px solid ${drone.color}20`, padding: '14px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PulseDot color={healthColor} animate={hasAlert} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{drone.id}</div>
              <div style={{ fontSize: 10, color: '#64748b' }}>{drone.callsign}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 9, fontWeight: 800, color: healthColor, background: `${healthColor}15`,
              padding: '3px 8px', borderRadius: 4, border: `1px solid ${healthColor}30`, letterSpacing: '0.06em' }}>
              {connected ? drone.status : 'NO LINK'}
            </span>
            <button onClick={onToggle} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: 2 }}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: '#475569' }}>{drone.role}</span>
          <span style={{ fontSize: 9, color: '#334155', fontFamily: 'monospace' }}>{drone.mission}</span>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 9, color: '#475569', letterSpacing: '0.06em' }}>ENGINE HEALTH INDEX</span>
            <span style={{ fontSize: 12, fontWeight: 800, color: healthColor, fontFamily: 'monospace' }}>
              {hi !== null ? `${hi.toFixed(1)}%` : '--'}
            </span>
          </div>
          <div style={{ height: 5, background: '#1e293b', borderRadius: 3 }}>
            <div style={{
              width: `${hi ?? 0}%`, height: '100%', borderRadius: 3, background: healthColor,
              transition: 'width 1s ease', boxShadow: `0 0 8px ${healthColor}60`,
            }} />
          </div>
        </div>
      </div>

      <div style={{ padding: '10px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {[
            { label: 'RPM', value: frame.rpm ? Math.round(frame.rpm) : '—', color: frame.rpm > 7000 ? '#ef4444' : '#94a3b8' },
            { label: 'CHT °C', value: frame.cht_c ? frame.cht_c.toFixed(1) : '—', color: frame.cht_c > 220 ? '#ef4444' : frame.cht_c > 185 ? '#f59e0b' : '#22c55e' },
            { label: 'EGT °C', value: frame.egt_c ? frame.egt_c.toFixed(1) : '—', color: frame.egt_c > 760 ? '#ef4444' : frame.egt_c > 680 ? '#f59e0b' : '#22c55e' },
            { label: 'VIB g', value: frame.vibration_g ? frame.vibration_g.toFixed(2) : '—', color: frame.vibration_g > 2.5 ? '#ef4444' : '#94a3b8' },
            { label: 'OIL kPa', value: frame.oil_pressure_kpa ? frame.oil_pressure_kpa.toFixed(0) : '—', color: frame.oil_pressure_kpa < 250 ? '#ef4444' : '#22c55e' },
            { label: 'THR %', value: frame.throttle_pct ? frame.throttle_pct.toFixed(0) : '—', color: '#94a3b8' },
          ].map(m => (
            <div key={m.label} style={{ padding: '6px 8px', background: '#071014', borderRadius: 4, border: '1px solid #1e293b', textAlign: 'center' }}>
              <div style={{ fontSize: 8, color: '#475569', letterSpacing: '0.06em', marginBottom: 2 }}>{m.label}</div>
              <div style={{ fontSize: 12, fontWeight: 800, color: m.color, fontFamily: 'monospace' }}>{m.value}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 8, fontSize: 9, color: '#334155', fontFamily: 'monospace', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span>📍 {drone.lat}</span><span>{drone.lon}</span><span>⬆ {drone.alt}</span><span>➤ {drone.speed}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {hasAlert && (
            <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={13} color="#ef4444" />
              <span style={{ fontSize: 10, color: '#fca5a5', fontWeight: 700, letterSpacing: '0.04em' }}>
                FAULT: {alerts[0]?.fault_type?.replace(/_/g, ' ').toUpperCase() ?? 'ANOMALY DETECTED'}
              </span>
            </div>
          )}
          {!hasAlert && (
            <div style={{ marginTop: 10, padding: '8px 10px', background: 'rgba(34,197,94,0.06)',
              border: '1px solid rgba(34,197,94,0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={13} color="#22c55e" />
              <span style={{ fontSize: 10, color: '#86efac', fontWeight: 700 }}>ALL SYSTEMS NOMINAL</span>
            </div>
          )}
        </div>
      )}

      {missionId && (
        <div style={{ padding: '4px 16px 8px', fontSize: 8, color: '#1e293b', fontFamily: 'monospace' }}>
          MISSION: {missionId.slice(0, 16)}…
        </div>
      )}
    </div>
  )
}

function FleetHealthMatrix({ statuses }) {
  const sensors = ['CHT', 'EGT', 'Oil', 'Vib', 'RPM']
  const getVal = (droneId, sensor) => {
    const f = statuses[droneId]?.frame ?? {}
    return { CHT: f.cht_c, EGT: f.egt_c, Oil: f.oil_pressure_kpa, Vib: f.vibration_g, RPM: f.rpm }[sensor]
  }
  const getLevel = (droneId, sensor) => {
    const v = getVal(droneId, sensor)
    if (!v) return null
    const thresh = { CHT: [185, 220], EGT: [680, 760], Oil: [260, 240], Vib: [2.0, 2.5], RPM: [7000, 7500] }
    const [w, c] = thresh[sensor]
    if (sensor === 'Oil') return v < c ? 2 : v < w ? 1 : 0
    return v >= c ? 2 : v >= w ? 1 : 0
  }
  const COLORS = ['#22c55e', '#f59e0b', '#ef4444']
  const LABELS = ['OK', 'WARN', 'CRIT']

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
      <thead>
        <tr>
          <th style={{ padding: '7px 10px', textAlign: 'left', color: '#475569', fontSize: 10, letterSpacing: '0.06em', fontWeight: 700 }}>SENSOR</th>
          {FLEET.map(d => <th key={d.id} style={{ padding: '7px 10px', textAlign: 'center', color: d.color, fontSize: 10, fontFamily: 'monospace', fontWeight: 700 }}>{d.id}</th>)}
        </tr>
      </thead>
      <tbody>
        {sensors.map(s => (
          <tr key={s} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <td style={{ padding: '7px 10px', color: '#94a3b8', fontSize: 10, fontWeight: 600 }}>{s}</td>
            {FLEET.map(d => {
              const level = getLevel(d.id, s)
              const val = getVal(d.id, s)
              const col = level !== null ? COLORS[level] : '#334155'
              return (
                <td key={d.id} style={{ padding: '7px 10px', textAlign: 'center' }}>
                  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    padding: '4px 10px', borderRadius: 4,
                    background: level !== null ? `${col}15` : 'transparent',
                    border: `1px solid ${level !== null ? col + '30' : 'transparent'}` }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: col, fontFamily: 'monospace' }}>{val ? val.toFixed(0) : '—'}</span>
                    <span style={{ fontSize: 7, color: col + 'aa', letterSpacing: '0.06em' }}>{level !== null ? LABELS[level] : '—'}</span>
                  </div>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ThreatBoard({ statuses }) {
  const threats = FLEET.flatMap(d => {
    return (statuses[d.id]?.active_alerts ?? []).map(a => ({
      uav: d.id, color: d.color,
      fault: a.fault_type?.replace(/_/g, ' ').toUpperCase() ?? 'ANOMALY',
      severity: a.severity?.toUpperCase() ?? 'WARNING',
      action: a.recommended_action ?? 'Continue monitoring',
    }))
  })

  if (!threats.length) return (
    <div style={{ padding: '20px 0', textAlign: 'center' }}>
      <CheckCircle size={24} color="#22c55e" style={{ marginBottom: 6 }} />
      <div style={{ color: '#22c55e', fontWeight: 700, fontSize: 12, letterSpacing: '0.06em' }}>FLEET NOMINAL</div>
      <div style={{ color: '#334155', fontSize: 10, marginTop: 4 }}>No active threat conditions</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {threats.map((t, i) => (
        <div key={i} style={{ padding: '10px 14px', borderRadius: 6, background: 'rgba(239,68,68,0.06)',
          border: '1px solid rgba(239,68,68,0.2)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <AlertTriangle size={13} color="#ef4444" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
              <span style={{ fontSize: 10, fontWeight: 800, color: t.color, fontFamily: 'monospace' }}>{t.uav}</span>
              <span style={{ fontSize: 9, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.15)', padding: '1px 6px', borderRadius: 3 }}>{t.severity}</span>
            </div>
            <div style={{ fontSize: 11, color: '#fca5a5', fontWeight: 600 }}>{t.fault}</div>
            <div style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>→ {t.action}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function FleetIntelligence() {
  const [missions, setMissions] = useState({})
  const [statuses, setStatuses] = useState({})
  const [expanded, setExpanded] = useState({})
  const [initialized, setInitialized] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)

  useEffect(() => {
    if (initialized) return
    setInitialized(true)
    ;(async () => {
      const map = {}
      for (const d of FLEET) {
        const mid = await startMission(d.profile, d.fault)
        if (mid) map[d.id] = mid
      }
      setMissions(map)
    })()
  }, [initialized])

  useEffect(() => {
    if (!Object.keys(missions).length) return
    const poll = async () => {
      const s = {}
      for (const d of FLEET) s[d.id] = await fetchTelemetry(missions[d.id])
      setStatuses(s)
      setLastUpdate(new Date().toISOString().slice(11, 19))
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [missions])

  const fleetHI = FLEET.reduce((s, d) => s + (statuses[d.id]?.health_index ?? 100), 0) / FLEET.length
  const faulted = FLEET.filter(d => (statuses[d.id]?.active_alerts ?? []).length > 0).length
  const fleetColor = fleetHI >= 80 ? '#22c55e' : fleetHI >= 60 ? '#f59e0b' : '#ef4444'

  return (
    <div style={{ minHeight: '100vh', background: '#060d17', color: '#e2e8f0', fontFamily: "'IBM Plex Mono', monospace" }}>
      <style>{`
        @keyframes fleetPulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>

      {/* Command Bar */}
      <div style={{ borderBottom: '1px solid #1e293b', background: '#0a1628', padding: '14px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Radio size={18} color="#38bdf8" />
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9', letterSpacing: '0.04em' }}>FLEET INTELLIGENCE CENTRE</div>
            <div style={{ fontSize: 9, color: '#475569', letterSpacing: '0.12em' }}>TAPAS-BH SERIES · 3 UAV ACTIVE · SWARM ANALYSIS</div>
          </div>
          <div style={{ height: 28, width: 1, background: '#1e293b', margin: '0 4px' }} />
          <span style={{ fontSize: 9, color: '#22c55e', letterSpacing: '0.06em' }}>◉ AES-256 ENCRYPTED DATALINK</span>
        </div>
        <div style={{ fontSize: 9, color: '#475569', display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastUpdate && <span>LAST SYNC: {lastUpdate} UTC</span>}
          <RefreshCw size={11} color="#22c55e" style={{ animation: 'spin 3s linear infinite' }} />
        </div>
      </div>

      <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { label: 'FLEET HEALTH INDEX', value: `${fleetHI.toFixed(1)}%`, color: fleetColor, sub: 'Combined engine health' },
            { label: 'UAVs AIRBORNE', value: '3', color: '#38bdf8', sub: 'Active missions' },
            { label: 'FAULT CONDITIONS', value: `${faulted}`, color: faulted > 0 ? '#ef4444' : '#22c55e', sub: faulted > 0 ? 'Requires action' : 'All clear' },
            { label: 'THREAT LEVEL', value: faulted >= 2 ? 'HIGH' : faulted === 1 ? 'MEDIUM' : 'LOW', color: faulted >= 2 ? '#ef4444' : faulted === 1 ? '#f59e0b' : '#22c55e', sub: 'Fleet posture' },
          ].map(k => (
            <div key={k.label} style={{ padding: '16px 20px', background: '#0a1628', border: '1px solid #1e293b',
              borderRadius: 8, borderTop: `3px solid ${k.color}` }}>
              <div style={{ fontSize: 9, color: '#475569', letterSpacing: '0.1em', marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: k.color, lineHeight: 1 }}>{k.value}</div>
              <div style={{ fontSize: 9, color: '#334155', marginTop: 4 }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* 3 UAV Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {FLEET.map(d => (
            <FleetCard key={d.id} drone={d} missionId={missions[d.id]} tele={statuses[d.id]}
              expanded={!!expanded[d.id]} onToggle={() => setExpanded(p => ({ ...p, [d.id]: !p[d.id] }))} />
          ))}
        </div>

        {/* Threat Board + Correlation Matrix */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 14 }}>
          <div style={{ background: '#0a1628', border: '1px solid #1e293b', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #1e293b' }}>
              <Shield size={14} color="#ef4444" />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#f1f5f9' }}>ACTIVE THREATS</span>
              {faulted > 0 && <span style={{ marginLeft: 'auto', fontSize: 9, color: '#ef4444', fontWeight: 700, letterSpacing: '0.06em' }}>● LIVE</span>}
            </div>
            <ThreatBoard statuses={statuses} />
          </div>
          <div style={{ background: '#0a1628', border: '1px solid #1e293b', borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid #1e293b' }}>
              <Activity size={14} color="#38bdf8" />
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#f1f5f9' }}>SENSOR HEALTH CORRELATION MATRIX</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, color: '#38bdf8' }}>LIVE · 2s</span>
            </div>
            <FleetHealthMatrix statuses={statuses} />
          </div>
        </div>
      </div>
    </div>
  )
}
