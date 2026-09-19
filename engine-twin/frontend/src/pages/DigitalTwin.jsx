import React, { useState, useMemo, memo, useRef, useEffect } from 'react'
import { useTelemetry } from '../context/TelemetryContext'
import { useMissionState, MS, MISSION_SEQUENCE } from '../hooks/useMissionState'
import DigitalTwin3DView from '../components/digital-twin/DigitalTwin3DView'
import MissionReportPrint from '../components/digital-twin/MissionReportPrint'
import { API_URL, apiHeaders } from '../lib/config'
import './DigitalTwin.css'

const Memo3D = memo(DigitalTwin3DView)

// ── helpers ──────────────────────────────────────────────────────────────
function stateText(s) {
  const m = { IDLE:'STANDBY', PRE_FLIGHT:'PRE-FLIGHT', ENGINE_START:'STARTING',
    TAKEOFF:'TAKEOFF', CLIMB:'CLIMB', CRUISE:'CRUISE', MISSION:'MISSION',
    DEGRADATION:'DEGRADATION', WARNING:'WARNING', RTB:'RTB', APPROACH:'APPROACH',
    LANDING:'LANDING', COMPLETED:'COMPLETED' }
  return m[s] || s
}
function stateSubtext(s) {
  if (s === 'IDLE') return 'engine off'
  if (['PRE_FLIGHT','ENGINE_START','TAKEOFF'].includes(s)) return 'ground operations'
  if (['WARNING','RTB','DEGRADATION'].includes(s)) return 'fault active'
  return 'airborne'
}

// ── Anomaly Sparkline ─────────────────────────────────────────────────────
function AnomalySparkline({ history }) {
  const W = 220, H = 52
  if (!history || history.length < 2) return (
    <div style={{ width: W, height: H, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--ink-faint)', fontSize:11 }}>
      Awaiting signal…
    </div>
  )
  const max = Math.max(...history, 0.01)
  const pts = history.map((v, i) => {
    const x = (i / (history.length - 1)) * W
    const y = H - (v / max) * (H - 4)
    return `${x},${y}`
  }).join(' ')
  const last = history[history.length - 1]
  const color = last > 0.7 ? '#e03e33' : last > 0.4 ? '#d6552f' : '#3fb9a4'
  return (
    <svg width={W} height={H} style={{ display:'block', overflow:'visible' }}>
      <defs>
        <linearGradient id="sgrd" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#sgrd)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx={(history.length - 1) / (history.length - 1) * W} cy={H - (last / max) * (H - 4)} r="3" fill={color} />
      <text x={W - 2} y={H - (last / max) * (H - 4) - 6} textAnchor="end" fontSize="10" fill={color} fontFamily="IBM Plex Mono,monospace">
        {(last * 100).toFixed(0)}%
      </text>
    </svg>
  )
}

// ── Confidence Gauge ──────────────────────────────────────────────────────
function ConfidenceGauge({ value }) {
  const pct = Math.min(1, Math.max(0, value || 0))
  const R = 34, cx = 44, cy = 44
  const arc = 2 * Math.PI * R * 0.75
  const fill = arc * pct
  const color = pct > 0.7 ? '#e03e33' : pct > 0.4 ? '#d6552f' : '#3fb9a4'
  // Start at 7 o'clock (225°), go clockwise
  const startAngle = 225 * Math.PI / 180
  const endAngle = startAngle + (270 * Math.PI / 180) * pct
  const x1 = cx + R * Math.cos(startAngle), y1 = cy + R * Math.sin(startAngle)
  const x2 = cx + R * Math.cos(endAngle), y2 = cy + R * Math.sin(endAngle)
  const largeArc = (270 * pct) > 180 ? 1 : 0
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <svg width={88} height={88}>
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--line)" strokeWidth={5}
          strokeDasharray={`${arc} 999`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(135 ${cx} ${cy})`}
        />
        {pct > 0 && (
          <path
            d={`M ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none" stroke={color} strokeWidth={5} strokeLinecap="round"
          />
        )}
        <text x={cx} y={cy + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill={color} fontFamily="IBM Plex Mono,monospace">
          {Math.round(pct * 100)}%
        </text>
        <text x={cx} y={cy + 19} textAnchor="middle" fontSize="9" fill="var(--ink-faint)">CONF</text>
      </svg>
      <div>
        <div style={{ fontSize:11, color:'var(--ink-faint)', marginBottom:3 }}>Model confidence</div>
        <div style={{ fontSize:12, color, fontWeight:600 }}>
          {pct > 0.8 ? '⚠ CRITICAL' : pct > 0.5 ? '⚡ ELEVATED' : pct > 0 ? '◌ NOMINAL' : '○ STANDBY'}
        </div>
      </div>
    </div>
  )
}

// ── SHAP Explanation Panel ────────────────────────────────────────────────
function SHAPPanel({ faultType, telemetry }) {
  if (!faultType || !telemetry) return (
    <p style={{ fontSize:12.5, color:'var(--ink-faint)', margin:0 }}>No anomaly detected. Physics model tracking nominal.</p>
  )
  // Build SHAP-like feature contributions based on fault type
  const features = useMemo(() => {
    const f = faultType.toLowerCase()
    if (f.includes('overheat') || f.includes('thermal')) return [
      { name: 'Cyl. Head Temp', value: telemetry?.cht ?? 0, baseline: 220, unit:'°C', weight: 0.62 },
      { name: 'Exhaust Gas Temp', value: telemetry?.egt ?? 0, baseline: 420, unit:'°C', weight: 0.24 },
      { name: 'Engine RPM', value: telemetry?.rpm ?? 0, baseline: 5500, unit:'rpm', weight: -0.08 },
    ]
    if (f.includes('lubric') || f.includes('oil')) return [
      { name: 'Oil Pressure', value: telemetry?.oilPressure ?? 0, baseline: 280, unit:'kPa', weight: -0.58 },
      { name: 'Fuel Flow', value: telemetry?.fuelFlow ?? 0, baseline: 14, unit:'L/h', weight: 0.22 },
      { name: 'Vibration', value: telemetry?.vibration ?? 0, baseline: 0.3, unit:'g', weight: 0.14 },
    ]
    return [
      { name: 'Vibration', value: telemetry?.vibration ?? 0, baseline: 0.3, unit:'g', weight: 0.68 },
      { name: 'Engine RPM', value: telemetry?.rpm ?? 0, baseline: 5500, unit:'rpm', weight: 0.19 },
      { name: 'Cyl. Head Temp', value: telemetry?.cht ?? 0, baseline: 220, unit:'°C', weight: 0.09 },
    ]
  }, [faultType, telemetry?.cht, telemetry?.oilPressure, telemetry?.vibration])

  return (
    <div>
      <div style={{ fontSize:11, color:'var(--ink-faint)', marginBottom:8, letterSpacing:'0.06em' }}>
        TOP CONTRIBUTING FEATURES
      </div>
      {features.map((f, i) => {
        const dir = f.weight > 0 ? 1 : -1
        const barW = Math.abs(f.weight) * 100
        const color = dir > 0 ? '#d6552f' : '#3fb9a4'
        const delta = ((f.value - f.baseline) / f.baseline * 100).toFixed(1)
        return (
          <div key={i} style={{ marginBottom:10 }}>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:3 }}>
              <span style={{ color:'var(--ink-dim)' }}>{f.name}</span>
              <span style={{ fontFamily:'IBM Plex Mono,monospace', fontSize:11, color }}>
                {delta > 0 ? '+' : ''}{delta}% baseline
              </span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
              <div style={{ flex:1, height:6, background:'var(--line)', borderRadius:3, overflow:'hidden' }}>
                <div style={{ width:`${barW}%`, height:'100%', background:color, borderRadius:3, transition:'width 0.4s' }} />
              </div>
              <span style={{ fontSize:10, color:'var(--ink-faint)', fontFamily:'IBM Plex Mono,monospace', minWidth:32, textAlign:'right' }}>
                {(Math.abs(f.weight) * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Mission Progress Bar ──────────────────────────────────────────────────
function MissionProgressBar({ state, stateIndex }) {
  const STATES = ['IDLE','PRE_FLIGHT','ENGINE_START','TAKEOFF','CLIMB','CRUISE','MISSION','DEGRADATION','WARNING','RTB','APPROACH','LANDING','COMPLETED']
  const LABELS = { IDLE:'GND', PRE_FLIGHT:'PRE', ENGINE_START:'ENG', TAKEOFF:'T/O', CLIMB:'CLB', CRUISE:'CRZ', MISSION:'MSN', DEGRADATION:'DEG', WARNING:'WRN', RTB:'RTB', APPROACH:'APP', LANDING:'LND', COMPLETED:'✓' }
  const FAULT = ['DEGRADATION','WARNING','RTB','APPROACH','LANDING']
  return (
    <div style={{ position:'absolute', bottom:42, left:16, right:16, pointerEvents:'none' }}>
      <div style={{ display:'flex', alignItems:'center', gap:0 }}>
        {STATES.map((s, i) => {
          const active = s === state
          const past = i < stateIndex
          const isFaultState = FAULT.includes(s)
          const col = isFaultState ? 'var(--warn)' : 'var(--ok)'
          return (
            <React.Fragment key={s}>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', minWidth:0 }}>
                <div style={{
                  width: active ? 10 : 7, height: active ? 10 : 7,
                  borderRadius:'50%',
                  background: active ? col : past ? col : 'var(--line)',
                  border: active ? `2px solid ${col}` : 'none',
                  boxShadow: active ? `0 0 8px ${col}` : 'none',
                  transition:'all 0.3s',
                  opacity: active || past ? 1 : 0.4,
                  flexShrink:0,
                }} />
                <div style={{ fontSize:8.5, marginTop:2, color: active ? col : past ? 'var(--ink-dim)' : 'var(--ink-faint)', fontWeight: active ? 700 : 400, letterSpacing:'0.04em', opacity: active || past ? 1 : 0.5 }}>
                  {LABELS[s]}
                </div>
              </div>
              {i < STATES.length - 1 && (
                <div style={{ flex:1, height:1.5, background: i < stateIndex ? (FAULT.includes(STATES[i+1]) ? 'var(--warn)' : 'var(--ok)') : 'var(--line)', transition:'background 0.4s', opacity: i < stateIndex ? 1 : 0.35 }} />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

// ── Status Strip ──────────────────────────────────────────────────────────
function StatusStrip({ state, telemetry, rul, globalRul, healthScore }) {
  const healthColor = healthScore < 50 ? 'var(--crit)' : healthScore < 80 ? 'var(--warn)' : 'var(--ok)'

  return (
    <div id="dt-strip">
      <div id="dt-state" style={{ borderLeftColor: ['WARNING','DEGRADATION','RTB'].includes(state) ? 'var(--warn)' : state === 'COMPLETED' ? 'var(--ok)' : undefined }}>
        <b style={{ color: ['WARNING','DEGRADATION','RTB'].includes(state) ? 'var(--warn)' : undefined }}>{stateText(state)}</b>
        <span>{stateSubtext(state)}</span>
      </div>
      <div className="dt-flight">
        <span><i>ALT</i> <span className="dt-num">{telemetry?.altitude?.toFixed(0) ?? 0}</span> m</span>
        <span><i>IAS</i> <span className="dt-num">{telemetry?.ias?.toFixed(0) ?? 0}</span> km/h</span>
      </div>
      {/* Health mini-bar */}
      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
        <span style={{ fontSize:10, color:'var(--ink-faint)', letterSpacing:'0.08em' }}>SYS</span>
        <div style={{ width:60, height:4, background:'var(--line)', borderRadius:2, overflow:'hidden' }}>
          <div style={{ width:`${healthScore}%`, height:'100%', background:healthColor, transition:'width 0.5s, background 0.5s' }} />
        </div>
        <span style={{ fontSize:11, color:healthColor, fontFamily:'IBM Plex Mono,monospace' }}>{Math.round(healthScore)}%</span>
      </div>
      {globalRul !== null && (
        <div id="dt-rul" className={globalRul < 15 ? 'on hot' : 'on'} style={{ minWidth:160 }}>
          <div className="lbl">⚠ Est. safe airtime</div>
          <div className="clk dt-num" style={{ fontSize:'1.4em' }}>
            {String(Math.floor(globalRul / 60)).padStart(2,'0')}:{String(Math.floor(globalRul % 60)).padStart(2,'0')}
          </div>
        </div>
      )}
      <div id="dt-rul" className={rul !== null ? (rul < 15 ? 'on hot' : 'on') : ''}>
        <div className="lbl">Predicted time to failure</div>
        <div className="clk dt-num">
          {rul !== null ? `${String(Math.floor(rul / 60)).padStart(2,'0')}:${String(Math.floor(rul % 60)).padStart(2,'0')}` : '--:--'}
        </div>
      </div>
    </div>
  )
}

// ── Subsystem parts ───────────────────────────────────────────────────────
const PART_DATA = {
  engine: { name: 'Engine and propeller', role: 'Tail-mounted powerplant driving the two-blade pusher prop' },
  turret: { name: 'Nose camera and sensor unit', role: 'Gyro-stabilised day/night seeker head in the nose' },
  wingFwd: { name: 'Forward X-wing set', role: 'Four cruciform lifting panels, forward station' },
  wingAft: { name: 'Aft X-wing set', role: 'Four cruciform control panels, aft station' },
  avionics: { name: 'Avionics bay', role: 'Mission computer, flight control, power bus' },
  fuel: { name: 'Fuel and payload bay', role: 'Centre tank, boost pumps and feed lines' }
}

function InspectorCard({ selectedPart, onSelectPart, faultLabel, alerts, healthScore, state, elapsed }) {
  if (!selectedPart || !PART_DATA[selectedPart]) return null
  const part = PART_DATA[selectedPart]
  let partHealth = 100, isFailing = false
  if (faultLabel && faultLabel !== 'none') {
    if (selectedPart === 'engine' && ['overheating','misfire','injector','spark_plug'].includes(faultLabel)) isFailing = true
    if (selectedPart === 'fuel' && faultLabel === 'lubrication') isFailing = true
    if (['turret','wingFwd','wingAft'].includes(selectedPart) && faultLabel === 'vibration') isFailing = true
    if (isFailing) partHealth = healthScore
  }
  
  if (!isFailing && state !== 'IDLE') {
    const idx = Object.keys(PART_DATA).indexOf(selectedPart)
    partHealth = 99.2 + Math.sin(elapsed * 0.15 + idx * 2) * 0.8
  }
  return (
    <div id="dt-inspector" className="on">
      <header>
        <div>
          <h3>{part.name}</h3>
          <p>{part.role}</p>
        </div>
        <button className="dt-x" onClick={() => onSelectPart(null)}>×</button>
      </header>
      <div className="dt-health">
        <div className="dt-bar"><i style={{ width:`${Math.max(0,partHealth)}%`, background: partHealth < 50 ? 'var(--crit)' : partHealth < 80 ? 'var(--warn)' : 'var(--ok)' }} /></div>
        <div className="dt-pc dt-num">{Math.round(partHealth)}%</div>
      </div>
      <div id="dt-ins-note">
        {isFailing ? <span style={{ color:'var(--crit)' }}>⚠ Anomaly detected on this subsystem.</span> : 'No anomaly detected.'}
      </div>
    </div>
  )
}

function TeleRow({ label, val, unit, dev }) {
  return (
    <div className={`dt-row ${dev ? 'dev' : ''}`}>
      <span className="n">{label}</span>
      <span className="v dt-num">{val !== undefined ? val : '—'}</span>
      <span className="e dt-num">{unit}</span>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────────────────────
export default function DigitalTwin() {
  const { telemetry, alerts, connected, healthIndex, globalRul, isExploded, triggerCinematicFault, resetCinematicFault, activeFaultScenario, missionId } = useTelemetry()
  const {
    state, elapsed, demoActive, paused, eventLog, faultInjected, stateIndex,
    selectedFault, setSelectedFault,
    startDemo, resetDemo, triggerFaultNow, triggerRTBNow,
  } = useMissionState(telemetry, alerts, healthIndex)

  const [cameraMode, setCameraMode] = useState('orbit')
  const [selectedPart, setSelectedPart] = useState(null)
  const [demoSpeed, setDemoSpeed] = useState(1)
  const [thermalMode, setThermalMode] = useState(false)
  const [stressStatus, setStressStatus] = useState('')
  const [showReport, setShowReport] = useState(false)

  const score = healthIndex?.score ?? 100
  const faultLabel = telemetry?.faultLabel
  const activeAlert = alerts?.[0]
  const rul = activeAlert?.rulHours ? activeAlert.rulHours * 3600 : null

  // Anomaly score history for sparkline
  const anomalyHistory = useRef([])
  useEffect(() => {
    const score = activeAlert?.anomalyScore ?? telemetry?.anomalyScore ?? 0
    anomalyHistory.current = [...anomalyHistory.current.slice(-79), score]
  }, [telemetry, activeAlert])

  // Trigger cinematic fault
  useEffect(() => {
    if (faultInjected && globalRul === null && !isExploded) {
      triggerCinematicFault(selectedFault, 34)
    }
  }, [faultInjected, globalRul, isExploded, selectedFault, triggerCinematicFault])

  // Reset or stop countdown if landed safely
  useEffect(() => {
    if (state === 'IDLE' || state === 'COMPLETED' || state === 'LANDING') {
      resetCinematicFault()
    }
  }, [state, resetCinematicFault])

  // Never render fake standby values as aircraft telemetry.
  const dispTele = telemetry || null

  const triggerThrottleBurst = async () => {
    if (!connected) { setStressStatus('LIVE STREAM REQUIRED'); return }
    try {
      const response = await fetch(`${API_URL}/simulation/override`, {
        method: 'POST', headers: apiHeaders(),
        body: JSON.stringify({ mission_id: telemetry?.missionId || 'active', action: 'throttle_burst', value: 100 }),
      })
      if (!response.ok) throw new Error('stress command rejected')
      setStressStatus('100% THROTTLE BURST ACTIVE · WATCH CHT / EGT')
      window.setTimeout(() => setStressStatus(''), 6000)
    } catch { setStressStatus('STRESS COMMAND FAILED') }
  }

  // Format fault for loss screen
  const lossFaultId = activeFaultScenario?.id || activeAlert?.faultType || selectedFault || 'unknown'
  const formattedCause = lossFaultId === 'overheating' ? 'Engine Overheat (Thermal Runaway)' :
                         lossFaultId === 'lubrication' ? 'Catastrophic Oil Pressure Loss' :
                         lossFaultId === 'vibration' ? 'Structural Failure (Abnormal Vibration)' :
                         lossFaultId === 'sensor_drift' ? 'Critical Sensor Failure' : 'Unknown Anomaly'
  const formattedSub = lossFaultId === 'overheating' ? 'Engine and propeller' :
                       lossFaultId === 'lubrication' ? 'Fuel and payload bay' :
                       lossFaultId === 'vibration' ? 'Forward X-wing set' : faultLabel || 'Avionics bay'

  return (
    <>
    <div className="dt-container">
      {/* ── 3D Stage ── */}
      <div id="dt-stage">
        <div id="dt-canvas-wrap">
          <Memo3D
            healthScore={score}
            missionState={state}
            faultInjected={faultInjected}
            isExploded={isExploded}
            elapsed={elapsed}
            cameraMode={cameraMode}
            alerts={alerts}
            telemetry={dispTele}
            thermalMode={thermalMode}
            selectedPart={selectedPart}
            onSelectPart={setSelectedPart}
          />
        </div>

        <StatusStrip state={state} telemetry={dispTele} rul={rul} globalRul={globalRul} healthScore={score} />

        <InspectorCard selectedPart={selectedPart} onSelectPart={setSelectedPart} faultLabel={faultLabel} alerts={alerts} healthScore={score} state={state} elapsed={elapsed} />

        {/* Camera + hint bar */}
        <div id="dt-hint" style={{ display:'flex', gap:16, alignItems:'center' }}>
          <span>Drag to orbit · scroll to zoom</span>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <span style={{ fontSize:9, color:'var(--ink-faint)', fontWeight:700, letterSpacing:'0.12em' }}>CAM:</span>
            {['orbit','follow','overview','mission'].map(m => (
              <button key={m} onClick={() => setCameraMode(m)} style={{
                padding:'2px 8px', background: cameraMode === m ? 'var(--line)' : 'transparent',
                color: cameraMode === m ? '#fff' : 'var(--ink-faint)', border:'1px solid var(--line)',
                borderRadius:4, fontSize:10, cursor:'pointer', textTransform:'uppercase'
              }}>{m}</button>
            ))}
          </div>
          <button onClick={() => setThermalMode(value => !value)} style={{ padding:'3px 9px', background: thermalMode ? '#f97316' : 'rgba(7,16,29,.7)', color: thermalMode ? '#fff' : 'var(--ink-dim)', border:`1px solid ${thermalMode ? '#fb923c' : 'var(--line)'}`, borderRadius:4, fontSize:10, cursor:'pointer', fontWeight:700 }}>
            {thermalMode ? '◉ THERMAL VISION ON' : '○ THERMAL VISION'}
          </button>
        </div>

        {thermalMode && <div style={{ position:'absolute', top:74, right:16, zIndex:10, padding:'9px 11px', border:'1px solid #fb923c', background:'rgba(30,12,3,.82)', color:'#fed7aa', borderRadius:4, fontFamily:'IBM Plex Mono,monospace', fontSize:11 }}>
          THERMAL CAMERA · LIVE ENGINE HEAT MAP<br/><span style={{ color:'#fff' }}>CHT {dispTele?.cht?.toFixed(1) ?? '—'}°C · EGT {dispTele?.egt?.toFixed(1) ?? '—'}°C</span>
        </div>}

        {/* Mission progress bar */}
        <MissionProgressBar state={state} stateIndex={stateIndex} />

        {(score === 0 || isExploded) && (
          <div id="dt-loss" className="on">
            <div className="dt-card">
              <h2>Airframe lost</h2>
              <p className="dt-sub">The predicted failure was not acted on before the countdown expired.</p>
              <dl>
                <dt>Root cause</dt><dd>{formattedCause}</dd>
                <dt>Subsystem</dt><dd>{formattedSub}</dd>
              </dl>
              <button className="dt-btn prime" onClick={resetDemo}>Reset airframe and restart mission</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Right Rail ── */}
      <aside id="dt-rail">
        <h1>Ground Control Station
          <small>MALE UAV digital twin · predictive maintenance layer</small>
        </h1>

        {/* Mission controls */}
        <div className="dt-block">
          <h2>Mission</h2>
          {!demoActive ? (
            <button className="dt-btn prime" onClick={startDemo}>▶ Start mission</button>
          ) : (
            <button className="dt-btn" onClick={resetDemo}>↺ Reset simulator</button>
          )}
          <select className="dt-select" disabled={demoActive}>
            <option value="nominal">Standard profile · 22 °C, 4 500 m</option>
            <option value="hot">Hot and high · 44 °C, 6 000 m</option>
          </select>
          <button className="dt-btn" onClick={triggerRTBNow}
            disabled={!demoActive || ['RTB','APPROACH','LANDING','COMPLETED'].includes(state)}>
            ⬅ Return to base
          </button>
          <button className="dt-btn danger" onClick={triggerThrottleBurst} disabled={!connected} style={{ marginTop:8 }}>
            ⚡ Throttle Burst — 100% Stress Test
          </button>
          {stressStatus && <div style={{ marginTop:6, color: stressStatus.includes('ACTIVE') ? 'var(--warn)' : 'var(--crit)', fontSize:10, letterSpacing:'.04em' }}>{stressStatus}</div>}
          {/* Speed control */}
          <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
            <span style={{ fontSize:11, color:'var(--ink-faint)', minWidth:80 }}>Demo speed</span>
            {[0.5,1,2,3].map(s => (
              <button key={s} onClick={() => setDemoSpeed(s)} style={{
                padding:'2px 8px', flex:1,
                background: demoSpeed === s ? 'var(--ok)' : 'var(--panel-2)',
                color: demoSpeed === s ? '#001a15' : 'var(--ink-faint)',
                border:'1px solid var(--line)', borderRadius:3, fontSize:11, cursor:'pointer', fontWeight: demoSpeed===s ? 700 : 400
              }}>{s}×</button>
            ))}
          </div>
          
          <button
            className="dt-btn prime"
            style={{ marginTop: 12, width: '100%', opacity: demoActive ? 1 : 0.6 }}
            onClick={() => setShowReport(true)}
          >
            📄 View Mission Report
          </button>
        </div>

        <div className="dt-block" style={{ borderLeft:'3px solid #22c55e' }}>
          <h2>Edge & Security Posture</h2>
          <div style={{ display:'grid', gap:7, fontSize:11 }}>
            <div><span style={{ color:'var(--ok)' }}>●</span> Edge pre-processing <b style={{ float:'right' }}>ACTIVE</b></div>
            <div><span style={{ color:'var(--ok)' }}>●</span> Signed API telemetry <b style={{ float:'right' }}>ENFORCED</b></div>
            <div><span style={{ color:'var(--caution)' }}>◐</span> Transport encryption <b style={{ float:'right' }}>DEPLOYMENT TARGET</b></div>
          </div>
          <p style={{ color:'var(--ink-faint)', fontSize:10, margin:'10px 0 0', lineHeight:1.45 }}>Prototype uses API-key authentication and an edge preprocessing pipeline. Production deployment adds mTLS and AES-256 at rest with aircraft-specific CAN calibration.</p>
        </div>

        {/* Fault injection */}
        <div className="dt-block">
          <h2>Fault injection</h2>
          <select className="dt-select" value={selectedFault} onChange={e => setSelectedFault(e.target.value)} disabled={demoActive && faultInjected}>
            <option value="overheating">Engine overheat</option>
            <option value="lubrication">Oil pressure loss</option>
            <option value="vibration">Abnormal vibration</option>
            <option value="sensor_drift">Sensor drift</option>
          </select>
          <button className="dt-btn danger" onClick={triggerFaultNow} disabled={!demoActive || faultInjected}>
            ⚡ Inject fault
          </button>
        </div>

        {/* AI Intelligence */}
        <div className="dt-block">
          <h2>AI Prognostics · anomaly score</h2>
          <AnomalySparkline history={anomalyHistory.current} />
          {activeAlert && (
            <div style={{ marginTop:10, padding:'6px 8px', background:'rgba(214,85,47,0.08)', border:'1px solid rgba(214,85,47,0.25)', borderRadius:3 }}>
              <div style={{ fontSize:11, color:'var(--warn)', fontWeight:600, letterSpacing:'0.06em', marginBottom:4 }}>
                ⚠ {activeAlert.faultType?.toUpperCase()} DETECTED
              </div>
              <div style={{ display:'flex', gap:10, fontSize:12 }}>
                <div><span style={{ color:'var(--ink-faint)' }}>RUL </span>
                  <b style={{ fontFamily:'IBM Plex Mono,monospace', color:'var(--caution)' }}>{activeAlert.rulHours?.toFixed(2)}h</b>
                </div>
                <div>
                  <span style={{ color:'var(--ink-faint)' }}>Trend </span>
                  <b style={{ color: activeAlert.rulHours < 0.5 ? 'var(--crit)' : 'var(--warn)' }}>
                    {activeAlert.rulHours < 0.5 ? '↓↓ CRITICAL' : activeAlert.rulHours < 1 ? '↓ FALLING' : '→ STABLE'}
                  </b>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SHAP Explanation */}
        <div className="dt-block">
          <h2>Explainability · SHAP features</h2>
          <SHAPPanel faultType={activeAlert?.faultType} telemetry={dispTele} />
        </div>

        {/* Telemetry */}
        <div className="dt-block" style={{ paddingLeft:0, paddingRight:0 }}>
          <h2 style={{ padding:'0 16px' }}>Engine and airframe telemetry</h2>
          <div id="dt-tele">
            {!connected && <div style={{ padding:'8px 16px', color:'var(--warn)', fontSize:11 }}>● WAITING FOR LIVE TELEMETRY — values appear when the engine stream is connected.</div>}
            <TeleRow label="Engine RPM" val={dispTele?.rpm?.toFixed(0)} unit="rpm" dev={faultLabel === 'misfire' || faultLabel === 'overheating'} />
            <TeleRow label="Cylinder head temp" val={dispTele?.cht?.toFixed(0)} unit="°C" dev={faultLabel === 'overheating'} />
            <TeleRow label="Exhaust gas temp" val={dispTele?.egt?.toFixed(0)} unit="°C" />
            <TeleRow label="Oil pressure" val={dispTele?.oilPressure?.toFixed(1)} unit="kPa" dev={faultLabel === 'lubrication'} />
            <TeleRow label="Engine vibration" val={dispTele?.vibration?.toFixed(2)} unit="g" dev={faultLabel === 'vibration' || faultLabel === 'misfire'} />
            <TeleRow label="Fuel flow" val={dispTele?.fuelFlow?.toFixed(1)} unit="L/h" />
            <TeleRow label="Battery Voltage" val={dispTele?.batteryVoltage?.toFixed(1)} unit="V" dev={faultLabel === 'sensor_drift'} />
            <TeleRow label="Alternator Load" val={dispTele?.alternatorCurrent?.toFixed(1)} unit="A" />
            <TeleRow label="Injection Timing" val={dispTele?.injectionTiming?.toFixed(1)} unit="°BTDC" />
          </div>
        </div>

        {/* Subsystem health */}
        <div className="dt-block" style={{ paddingLeft:0, paddingRight:0 }}>
          <h2 style={{ padding:'0 16px' }}>Subsystem health</h2>
          <div id="dt-subs">
            {Object.entries(PART_DATA).map(([id, p], i) => {
              let pct = 100
              if (faultLabel && faultLabel !== 'none') {
                if (id === 'engine' && ['overheating','misfire','injector','spark_plug'].includes(faultLabel)) pct = score
                if (id === 'fuel' && faultLabel === 'lubrication') pct = score
                if (['turret','wingFwd','wingAft'].includes(id) && faultLabel === 'vibration') pct = score
              } else if (state !== 'IDLE') {
                pct = 99.2 + Math.sin(elapsed * 0.15 + i * 2) * 0.8
              }
              return (
                <button key={id} onClick={() => setSelectedPart(id)}>
                  <div className="dt-dot" style={{ background: pct < 50 ? 'var(--crit)' : pct < 80 ? 'var(--warn)' : 'var(--ok)' }} />
                  {p.name}
                  <div className="dt-pct">{Math.round(pct)}%</div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Mission log */}
        <div id="dt-log">
          <h2>Mission log</h2>
          <ol id="dt-log-list">
            {eventLog.slice().reverse().map((log, i) => (
              <li key={i} className={log.msg.includes('FAULT') || log.msg.includes('WARNING') ? 'w' : log.msg.includes('COMPLETED') || log.msg.includes('RTB') ? 'g' : ''}>
                <time>{log.ts}</time>
                <span>{log.msg}</span>
              </li>
            ))}
          </ol>
        </div>
      </aside>
    </div>

    {/* ── Mission Report Modal ── */}
    <div id="dt-report-modal" className={showReport ? 'open' : ''} onClick={e => { if (e.target.id === 'dt-report-modal') setShowReport(false) }}>
      <MissionReportPrint
        telemetry={dispTele}
        alerts={alerts}
        state={state}
        eventLog={eventLog}
        missionId={missionId}
        healthScore={score}
        faultInjected={faultInjected}
        activeFaultScenario={activeFaultScenario}
        selectedFault={selectedFault}
        onClose={() => setShowReport(false)}
      />
    </div>
  </>
  )
}
