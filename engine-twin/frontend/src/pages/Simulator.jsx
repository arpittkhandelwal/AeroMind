/**
 * Simulator.jsx — Engine simulator control (route: /simulator)
 * =============================================================
 * Wired to UAV Digital Twin backend: POST /missions to start,
 * uses local RUL countdown logic identical to files 2 prototype.
 */

import React, { useState, useRef, useCallback } from 'react'
import { Cpu, Play, Square, Zap, RefreshCw } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import { API_URL } from '../lib/config'
import { useTelemetry } from '../context/TelemetryContext'

const FAULTS = [
  { id: 'none',               label: 'Normal Operation',    color: '#39D98A', rul: null },
  { id: 'misfire',            label: 'Cylinder Misfire',    color: '#F2B84B', rul: 92 },
  { id: 'injector_fault',     label: 'Injector Fault',      color: '#FF5C5C', rul: 66 },
  { id: 'lubrication_issue',  label: 'Lubrication Failure', color: '#FF5C5C', rul: 54 },
  { id: 'sensor_drift',       label: 'Sensor Drift',        color: '#F2B84B', rul: 104 },
  { id: 'overheating',        label: 'Engine Overheat',     color: '#FF5C5C', rul: 78 },
  { id: 'abnormal_vibration', label: 'Abnormal Vibration',  color: '#FF5C5C', rul: 62 },
]

const PROFILES = [
  { id: 'nominal',        label: 'Standard · 4 500 m, 22 °C' },
  { id: 'hot_weather',    label: 'Hot & High · 6 000 m, 44 °C' },
  { id: 'endurance',      label: 'Long Endurance · low power' },
  { id: 'rapid_throttle', label: 'Max Climb · full throttle' },
]

export default function Simulator() {
  const { globalRul, triggerCinematicFault, resetCinematicFault } = useTelemetry()
  
  const [running,    setRunning]    = useState(false)
  const [missionId,  setMissionId]  = useState(null)
  const [selectedFault,   setFault]   = useState('none')
  const [selectedProfile, setProfile] = useState('nominal')
  const [rul,        setRul]        = useState(null)
  const [rulMax,     setRulMax]     = useState(null)
  const [status,     setStatus]     = useState('STANDBY')
  const [logs,       setLogs]       = useState([{ t: '00:00', msg: 'Simulator ready · select a profile and start' }])

  const rulRef   = useRef(null)
  const lastRef  = useRef(null)
  const loopRef  = useRef(null)
  const startRef = useRef(null)

  const addLog = (msg, cls = '') => {
    const el = startRef.current ? Math.floor((Date.now() - startRef.current) / 1000) : 0
    const t  = `T+${String(Math.floor(el/60)).padStart(2,'0')}:${String(el%60).padStart(2,'0')}`
    setLogs(p => [{ t, msg, cls }, ...p].slice(0, 30))
  }

  const stopLoop = useCallback(() => {
    if (loopRef.current) { cancelAnimationFrame(loopRef.current); loopRef.current = null }
  }, [])

  const startRULLoop = useCallback((faultObj) => {
    if (!faultObj?.rul) return
    setRulMax(faultObj.rul)
    triggerCinematicFault(faultObj.id, faultObj.rul)
  }, [triggerCinematicFault])

  const handleStart = async () => {
    if (running) {
      stopLoop()
      setRunning(false)
      setStatus('STANDBY')
      addLog('Mission held by operator')
      return
    }
    try {
      const res = await fetch(`${API_URL}/missions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ profile: selectedProfile, fault: selectedFault, speedup: 60 }),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      setMissionId(data.mission_id)
      startRef.current = Date.now()
      setRunning(true)
      setStatus('NOMINAL')
      addLog(`Mission started · ${PROFILES.find(p => p.id === selectedProfile)?.label}`)

      // If fault selected, start local RUL countdown
      const f = FAULTS.find(f => f.id === selectedFault)
      if (f?.rul) {
        setStatus('CAUTION')
        addLog(`Fault injected: ${f.label} · RUL ${f.rul}s`, 'warn')
        startRULLoop(f)
      }
    } catch (e) {
      addLog(`Error: ${e.message}`, 'err')
    }
  }

  const handleReset = () => {
    stopLoop()
    resetCinematicFault()
    setRunning(false)
    setMissionId(null)
    setRulMax(null)
    setStatus('STANDBY')
    startRef.current = null
    setLogs([{ t: '00:00', msg: 'Simulator reset · digital twin reinitialised' }])
  }

  // Sync status to globalRul if it's running
  useEffect(() => {
    if (globalRul === null) return
    const frac = globalRul / (rulMax || 1)
    if (globalRul <= 0) {
      if (status !== 'AIRFRAME LOST') {
        setStatus('AIRFRAME LOST')
        setRunning(false)
        addLog('💥 CATASTROPHIC FAILURE — airframe lost', 'err')
      }
    } else if (frac < 0.2) {
      if (status !== 'CRITICAL') setStatus('CRITICAL')
    } else if (frac < 0.55) {
      if (status !== 'WARNING') setStatus('WARNING')
    }
  }, [globalRul, rulMax, status])

  const rulPct   = globalRul != null && rulMax ? (globalRul / rulMax) * 100 : 0
  const rulMM    = globalRul != null ? Math.floor(globalRul / 60) : 0
  const rulSS    = globalRul != null ? Math.floor(globalRul % 60) : 0
  const rulStr   = globalRul != null ? `${String(rulMM).padStart(2,'0')}:${String(rulSS).padStart(2,'0')}` : '--:--'
  const statusCol = { NOMINAL: '#39D98A', CAUTION: '#F2B84B', WARNING: '#F2B84B', CRITICAL: '#FF5C5C', 'AIRFRAME LOST': '#FF5C5C', STANDBY: '#4A6270' }[status] ?? '#4A6270'
  const activeFault = FAULTS.find(f => f.id === selectedFault)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader
        icon={Cpu}
        title="Simulator"
        subtitle="Engine flight simulator · physics model · real-time fault injection"
        badge={running ? 'LIVE' : 'STANDBY'}
        badgeColor={running ? '#39D98A' : '#4A6270'}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 12 }}>
        {/* Controls Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Panel>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#4A6270', letterSpacing: '0.14em', textTransform: 'uppercase', paddingBottom: 10, borderBottom: '1px solid #20343C', marginBottom: 12 }}>
              Flight Profile
            </div>
            {PROFILES.map(p => (
              <div key={p.id}
                onClick={() => !running && setProfile(p.id)}
                style={{
                  padding: '7px 10px', marginBottom: 4, borderRadius: 3, cursor: running ? 'not-allowed' : 'pointer',
                  background: selectedProfile === p.id ? '#0D2035' : '#071014',
                  border: `1px solid ${selectedProfile === p.id ? '#55C7E8' : '#172830'}`,
                  fontSize: 11, color: selectedProfile === p.id ? '#55C7E8' : '#8FA1A9',
                  opacity: running ? 0.6 : 1,
                }}
              >{p.label}</div>
            ))}
          </Panel>

          <Panel>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#4A6270', letterSpacing: '0.14em', textTransform: 'uppercase', paddingBottom: 10, borderBottom: '1px solid #20343C', marginBottom: 12 }}>
              Fault Scenario
            </div>
            {FAULTS.map(f => (
              <div key={f.id}
                onClick={() => !running && setFault(f.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '7px 10px', marginBottom: 4, borderRadius: 3, cursor: running ? 'not-allowed' : 'pointer',
                  background: selectedFault === f.id ? `${f.color}15` : '#071014',
                  border: `1px solid ${selectedFault === f.id ? f.color : '#172830'}`,
                  opacity: running ? 0.6 : 1,
                }}
              >
                <span style={{ fontSize: 11, color: f.color }}>{f.label}</span>
                {f.rul && <span style={{ fontSize: 9, color: '#4A6270' }}>{f.rul}s RUL</span>}
              </div>
            ))}
          </Panel>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleStart} style={{
              flex: 1, padding: '9px 0', borderRadius: 3, border: 'none', cursor: 'pointer', fontWeight: 700,
              fontSize: 12, letterSpacing: '0.08em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              background: running ? '#2A0D0D' : '#0D2A1A', color: running ? '#FF5C5C' : '#39D98A',
            }}>
              {running ? <><Square size={12} /> HOLD</> : <><Play size={12} /> START</>}
            </button>
            <button onClick={handleReset} style={{
              padding: '9px 14px', borderRadius: 3, border: '1px solid #20343C', cursor: 'pointer',
              background: '#071014', color: '#8FA1A9', fontSize: 12,
            }}>
              <RefreshCw size={12} />
            </button>
          </div>
        </div>

        {/* Output Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Status + RUL */}
          <Panel>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, padding: '8px 0' }}>
              <div>
                <div style={{ fontSize: 9, color: '#4A6270', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Mission Status</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: statusCol, fontFamily: 'monospace' }}>{status}</div>
                {missionId && <div style={{ fontSize: 9, color: '#4A6270', marginTop: 4 }}>ID: {missionId.slice(0,8)}…</div>}
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#4A6270', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Predicted Failure</div>
                <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'monospace', color: status === 'CRITICAL' || status === 'AIRFRAME LOST' ? '#FF5C5C' : rul != null ? '#F2B84B' : '#4A6270' }}>
                  {rulStr}
                </div>
                {rulMax && <div style={{ marginTop: 8, height: 4, background: '#172830', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${rulPct}%`, background: rulPct > 55 ? '#39D98A' : rulPct > 20 ? '#F2B84B' : '#FF5C5C', borderRadius: 2, transition: 'width 0.3s' }} />
                </div>}
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#4A6270', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>Active Fault</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: activeFault?.color ?? '#4A6270' }}>
                  {activeFault?.id === 'none' ? 'None' : activeFault?.label ?? '—'}
                </div>
                <div style={{ fontSize: 10, color: '#4A6270', marginTop: 4 }}>{PROFILES.find(p => p.id === selectedProfile)?.label}</div>
              </div>
            </div>
          </Panel>

          {/* Mission Log */}
          <Panel style={{ flex: 1 }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: '#4A6270', letterSpacing: '0.14em', textTransform: 'uppercase', paddingBottom: 10, borderBottom: '1px solid #20343C', marginBottom: 10 }}>
              Mission Log
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
              {logs.map((l, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: l.cls === 'err' ? '#FF5C5C' : l.cls === 'warn' ? '#F2B84B' : '#8FA1A9' }}>
                  <span style={{ color: '#4A6270', flexShrink: 0 }}>{l.t}</span>
                  <span>{l.msg}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  )
}
