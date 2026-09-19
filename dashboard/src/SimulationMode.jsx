import { useState, useEffect, useRef, useCallback } from 'react';
import { startSimulation, fetchLatest, fetchRUL, fetchFaults } from './api';
import DigitalTwin3DView from './DigitalTwin3DView';
import './SimulationMode.css';

/* ─── Exactly matches files 2 fault table ─── */
const CONDITIONS = {
  std:   { id: 'nominal',        name: 'Standard profile · 22 °C, 4 500 m', alt: 4500, ias: 172 },
  hot:   { id: 'hot_weather',    name: 'Hot and high · 44 °C, 6 000 m',     alt: 6000, ias: 166 },
  long:  { id: 'endurance',      name: 'Long endurance cruise · low power',  alt: 5200, ias: 148 },
  climb: { id: 'rapid_throttle', name: 'Max continuous climb',               alt: 3100, ias: 158 },
};

/* RUL is in SECONDS — same values as files 2 prototype */
const FAULTS = [
  { id: 'overheating',        label: 'Engine overheat',           part: 'engine',   rul: 78,  cause: 'Cooling airflow loss across the cylinder head jacket',         fix: 'Reduce power to 65% and open cowl flap' },
  { id: 'cooling_degradation', label: 'Cooling degradation',      part: 'engine',   rul: 112, cause: 'Progressive loss of heat rejection through the cooling path',         fix: 'Reduce power and engage backup cooling' },
  { id: 'lubrication_issue',  label: 'Oil pressure loss',          part: 'engine',   rul: 54,  cause: 'Scavenge pump wear and progressive oil starvation',             fix: 'Shut down engine and glide to the recovery strip' },
  { id: 'misfire',            label: 'Cylinder misfire',           part: 'engine',   rul: 92,  cause: 'Degraded ignition lead on cylinder 3',                          fix: 'Switch to the backup ignition circuit' },
  { id: 'injector_fault',     label: 'Injector fault',             part: 'engine',   rul: 66,  cause: 'Fuel injector nozzle blockage causing lean combustion',          fix: 'Engage backup injector and reduce throttle' },
  { id: 'sensor_drift',       label: 'Sensor drift',               part: 'avionics', rul: 104, cause: 'ADC calibration drift causing control surface divergence',        fix: 'Switch to backup ADC channel' },
  { id: 'abnormal_vibration', label: 'Abnormal vibration',         part: 'engine',   rul: 62,  cause: 'Propeller blade imbalance causing resonance in the airframe',    fix: 'Reduce RPM and return to base' },
  { id: 'random',             label: 'Random unannounced fault',   part: 'engine',   rul: 70,  cause: 'Unspecified anomaly — see sensor data for leading indicators',    fix: 'Return to base immediately' },
];

const PARTS = {
  engine:   { name: 'Engine & Propeller',  role: 'Tail-mounted powerplant'      },
  avionics: { name: 'Avionics Bay',        role: 'Flight control & power'        },
  fuel:     { name: 'Fuel Bay',            role: 'Storage & delivery'            },
  turret:   { name: 'Sensor Turret',       role: 'Observation & targeting'       },
  wingFwd:  { name: 'Forward Wing',        role: 'Lift & control'                },
  wingAft:  { name: 'Aft Wing',            role: 'Lift & stability'              },
};

/* ─── SVG Health Ring ─── */
function HealthRing({ value }) {
  const R = 46, C = 2 * Math.PI * R;
  const pct  = Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * C;
  const col  = pct > 65 ? '#3fb9a4' : pct > 35 ? '#e0a526' : '#e03e33';
  return (
    <div className="health-ring-svg" style={{ width: 110, height: 110 }}>
      <svg width="110" height="110" viewBox="0 0 110 110">
        <circle cx="55" cy="55" r={R} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth="10" />
        <circle cx="55" cy="55" r={R} fill="none"
          stroke={col} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${dash.toFixed(1)} ${C.toFixed(1)}`}
          transform="rotate(-90 55 55)"
          style={{ transition: 'stroke-dasharray .5s ease, stroke .4s ease', filter: `drop-shadow(0 0 6px ${col})` }}
        />
      </svg>
      <div className="health-ring-num mono" style={{ color: col }}>{pct.toFixed(0)}</div>
    </div>
  );
}

/* ─── Main component ─── */
export default function SimulationMode() {
  /* mission state */
  const [running,      setRunning]      = useState(false);
  const [destroyed,    setDestroyed]    = useState(false);
  const [condKey,      setCondKey]      = useState('std');
  const [faultSel,     setFaultSel]     = useState('random');
  const [missionId,    setMissionId]    = useState(null);

  /* telemetry from backend */
  const [frame,        setFrame]        = useState(null);
  const [alerts,       setAlerts]       = useState([]);

  /* ── LOCAL RUL countdown (mirrors files 2 exactly) ── */
  const [activeFault,  setActiveFault]  = useState(null);  // fault object
  const [rul,          setRul]          = useState(0);      // seconds remaining
  const [rulMax,       setRulMax]       = useState(0);      // initial seconds
  const [recovering,   setRecovering]   = useState(false);

  /* UI state */
  const [logs,         setLogs]         = useState([]);
  const [statusText,   setStatusText]   = useState('STANDBY');
  const [statusSub,    setStatusSub]    = useState('engine off');
  const [selectedPart, setSelectedPart] = useState(null);

  const pollRef    = useRef(null);   // backend polling
  const loopRef    = useRef(null);   // local RUL animation loop
  const startRef   = useRef(null);   // mission wall-clock start
  const rulRef     = useRef(0);      // live rul value accessible inside rAF
  const lastRef    = useRef(null);   // previous timestamp for dt
  const lastSetRulRef = useRef(0);   // to throttle state updates

  /* ── helpers ── */
  const tStr = () => {
    const el = startRef.current ? Math.floor((Date.now() - startRef.current) / 1000) : 0;
    const mm = Math.floor(el / 60), ss = el % 60;
    return `T+${String(mm).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
  };

  const addLog = useCallback((msg, cls = '') => {
    setLogs(prev => [{ id: Date.now() + Math.random(), t: tStr(), msg, cls }, ...prev].slice(0, 28));
  }, []); // eslint-disable-line

  const setStatus = (text, sub) => { setStatusText(text); setStatusSub(sub); };

  /* ── backend polling (for telemetry + alerts only) ── */
  const stopPolling = useCallback(() => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }, []);

  const startPolling = useCallback((mid) => {
    pollRef.current = setInterval(async () => {
      try {
        const [latest, faultData] = await Promise.all([
          fetchLatest(mid),
          fetchFaults(mid).catch(() => []),
        ]);
        setFrame(latest?.frame ?? {});
        setAlerts(faultData || []);
      } catch { /* silent */ }
    }, 600);
  }, []);

  /* ── LOCAL RUL loop — same as files 2 tick() ── */
  const stopLoop = useCallback(() => {
    if (loopRef.current) { cancelAnimationFrame(loopRef.current); loopRef.current = null; }
  }, []);

  const startLoop = useCallback((faultObj, initialRul) => {
    lastRef.current = performance.now();
    rulRef.current  = initialRul;

    function tick(now) {
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;

      rulRef.current = Math.max(0, rulRef.current - dt);
      
      // Throttle React state updates to ~10fps to avoid freezing UI
      if (Math.abs(lastSetRulRef.current - rulRef.current) > 0.1 || rulRef.current <= 0) {
        setRul(rulRef.current);
        lastSetRulRef.current = rulRef.current;
      }

      const frac = rulRef.current / initialRul;

      if (rulRef.current <= 0) {
        /* ── DESTROY ── */
        setDestroyed(true);
        setRunning(false);
        setStatus('AIRFRAME LOST', `catastrophic failure`);
        setRul(0);
        setActiveFault(null);
        stopPolling();
        // log happens via effect below
        return; // stop loop
      }

      if (frac < 0.2) {
        setStatusText(prev => { if (prev !== 'CRITICAL') { setStatusSub(`failure imminent on ${faultObj.part}`); return 'CRITICAL'; } return prev; });
      } else if (frac < 0.55) {
        setStatusText(prev => { if (prev !== 'WARNING' && prev !== 'CRITICAL') { setStatusSub('degradation accelerating'); return 'WARNING'; } return prev; });
      }

      loopRef.current = requestAnimationFrame(tick);
    }

    loopRef.current = requestAnimationFrame(tick);
  }, [stopPolling]);

  /* Log the destruction event */
  useEffect(() => {
    if (destroyed) {
      addLog('CATASTROPHIC FAILURE — airframe lost', 'w');
    }
  }, [destroyed]); // eslint-disable-line

  /* ── handlers ── */
  const handleStart = async () => {
    if (destroyed) return;
    if (running) {
      stopPolling();
      setRunning(false);
      setStatus('STANDBY', 'mission held');
      addLog('Mission held by operator');
      return;
    }
    try {
      const prof = CONDITIONS[condKey].id;
      const res  = await startSimulation({ profile: prof, fault: 'none', speedup: 60 });
      setMissionId(res.mission_id);
      startRef.current = Date.now();
      startPolling(res.mission_id);
      setRunning(true);
      setStatus('NOMINAL', CONDITIONS[condKey].name.toLowerCase());
      addLog('Mission started · ' + CONDITIONS[condKey].name);
    } catch (e) {
      addLog('Failed to start: ' + e.message, 'w');
    }
  };

  const handleInject = async () => {
    if (destroyed) return;
    if (!running) await handleStart();

    // resolve the fault
    let f = FAULTS.find(x => x.id === faultSel);
    if (!f || f.id === 'random') {
      const pool = FAULTS.filter(x => x.id !== 'random');
      f = pool[Math.floor(Math.random() * pool.length)];
    }

    // stop previous RUL loop if any
    stopLoop();

    setActiveFault(f);
    setRul(f.rul);
    setRulMax(f.rul);
    setRecovering(false);
    setStatus('CAUTION', `deviation detected on the ${PARTS[f.part]?.name?.toLowerCase() || f.part}`);
    addLog(`Model flagged a deviation on the ${PARTS[f.part]?.name?.toLowerCase() || f.part}`, 'w');

    // start countdown
    startLoop(f, f.rul);

    // also fire the backend simulation with that fault
    try {
      const prof = CONDITIONS[condKey].id;
      const res  = await startSimulation({ profile: prof, fault: f.id, speedup: 60 });
      setMissionId(res.mission_id);
      stopPolling();
      startPolling(res.mission_id);
    } catch { /* ignore, RUL is local anyway */ }
  };

  const handleRTB = () => {
    if (!running || destroyed) return;
    stopLoop();
    setActiveFault(null);
    setRul(0);
    setRecovering(true);
    setStatus('RECOVERING', 'returning to base');
    addLog('Return to base · recovery profile active', 'g');
  };

  const resetAll = () => {
    stopLoop();
    stopPolling();
    setDestroyed(false);
    setRunning(false);
    setMissionId(null);
    setFrame(null);
    setAlerts([]);
    setActiveFault(null);
    setRul(0);
    setRulMax(0);
    setRecovering(false);
    setSelectedPart(null);
    setLogs([]);
    setStatus('STANDBY', 'engine off');
    addLog('Airframe reset · digital twin reinitialised');
    startRef.current = null;
  };

  useEffect(() => {
    addLog('Digital twin linked · sensor channels streaming');
  }, []); // eslint-disable-line

  useEffect(() => () => { stopLoop(); stopPolling(); }, [stopLoop, stopPolling]);

  /* ── derived values ── */
  const statusColor = {
    NOMINAL:         'var(--ok)',
    RECOVERING:      'var(--ok)',
    CAUTION:         'var(--caution)',
    WARNING:         'var(--warn)',
    CRITICAL:        'var(--crit)',
    'AIRFRAME LOST': 'var(--crit)',
  }[statusText] ?? 'var(--dim)';

  /* RUL display */
  const rulVisible = !!activeFault && !destroyed && !recovering;
  const isHot      = rulVisible && rul < (rulMax * 0.2);
  const rulMM      = Math.floor(rul / 60);
  const rulSS      = Math.floor(rul % 60);
  const rulStr     = `${String(rulMM).padStart(2,'0')}:${String(rulSS).padStart(2,'0')}`;

  /* Health derived from RUL progress (matches files 2: p = 1 - rul/rulMax) */
  const faultProgress = activeFault && rulMax > 0 ? 1 - rul / rulMax : 0;
  const engineHealth  = destroyed ? 0 : Math.max(0, Math.round(100 - faultProgress * 100));
  const partHealth    = (id) => id === activeFault?.part ? engineHealth : 100;

  /* Why-panel drivers (sigma mock, same as files 2) */
  const degrading = !!activeFault && !recovering;

  /* Telemetry display */
  const TM = [
    { k: 'rpm',   l: 'RPM',        v: frame?.rpm,              e: 5400 },
    { k: 'cht',   l: 'CHT',        v: frame?.cht_c,            e: 198  },
    { k: 'oil_p', l: 'Oil Press',  v: frame?.oil_pressure_kpa, e: 440  },
    { k: 'vib',   l: 'Vibration',  v: frame?.vibration_g,      e: 1.15 },
    { k: 'fuel',  l: 'Fuel Flow',  v: frame?.fuel_flow_lph,    e: 12.6 },
    { k: 'egt',   l: 'EGT',        v: frame?.egt_c,            e: 680  },
  ];

  return (
    <div className={`sim-gcs ${isHot ? 'critical' : ''}`}>

      {/* ─── STAGE (3-D canvas side) ─── */}
      <div className="gcs-stage">
        <div className="gcs-canvas">
          <DigitalTwin3DView telemetry={frame} healthScore={engineHealth} />
        </div>

        {/* Status strip — exact same structure as files 2 #strip */}
        <div className="gcs-strip">
          <div className="gcs-state" style={{ borderLeftColor: statusColor }}>
            <span className="s-label" style={{ color: statusColor }}>{statusText}</span>
            <span className="s-sub">{statusSub}</span>
          </div>

          <div className="gcs-flight">
            <span><i>ALT </i><span className="mono">{running ? CONDITIONS[condKey].alt : 0}</span> m</span>
            <span><i>IAS </i><span className="mono">{running ? CONDITIONS[condKey].ias : 0}</span> km/h</span>
            <span><i>ENDUR </i><span className="mono">{running ? '17:58' : '18:00'}</span></span>
          </div>

          {/* RUL countdown — visible only when fault is active */}
          <div className={`gcs-rul ${rulVisible ? 'visible' : ''} ${isHot ? 'hot' : ''}`}>
            <div className="rul-label">Predicted time<br />to failure</div>
            <div className="rul-clock mono">{rulVisible ? rulStr : '--:--'}</div>
          </div>
        </div>

        {/* Inspector card */}
        {selectedPart && (
          <div className="gcs-inspector">
            <header>
              <div>
                <h3>{PARTS[selectedPart]?.name}</h3>
                <p>{PARTS[selectedPart]?.role}</p>
              </div>
              <button className="ins-close" onClick={() => setSelectedPart(null)}>×</button>
            </header>
            <div className="ins-health">
              <div className="ins-bar">
                <div className="ins-bar-fill" style={{
                  width: `${partHealth(selectedPart)}%`,
                  background: partHealth(selectedPart) > 65 ? 'var(--ok)' : partHealth(selectedPart) > 35 ? 'var(--caution)' : 'var(--crit)',
                }} />
              </div>
              <div className="ins-pct mono">{partHealth(selectedPart)}%</div>
            </div>
            <div className="ins-note">
              {destroyed
                ? 'Airframe lost. Readings from the final recorded frame.'
                : recovering
                ? 'Corrective action applied. Readings returning to baseline.'
                : activeFault?.part === selectedPart
                ? `⚠ ${activeFault.label} — ${activeFault.cause}. Predicted failure in ${Math.ceil(rul)}s if no action.`
                : 'No anomaly on this subsystem. All readings inside the predicted band.'}
            </div>
            {activeFault?.part === selectedPart && !recovering && !destroyed && (
              <button className="gcs-btn prime" style={{ margin: '0 12px 12px', width: 'calc(100% - 24px)' }}
                onClick={handleRTB}>
                {activeFault.fix}
              </button>
            )}
          </div>
        )}

        <div className="gcs-hint">Drag to orbit · scroll to zoom · click part to inspect</div>

        {/* Airframe loss overlay */}
        {destroyed && (
          <div className="gcs-loss">
            <div className="gcs-loss-card">
              <h2>💥 Airframe Lost</h2>
              <p className="loss-sub">The predicted failure was not acted on before the countdown expired.</p>
              <dl>
                <dt>Root cause</dt>   <dd>{activeFault?.cause || alerts[0]?.fault_type?.replace(/_/g,' ') || 'Unknown'}</dd>
                <dt>Subsystem</dt>    <dd>{activeFault ? PARTS[activeFault.part]?.name : 'Engine & Propeller'}</dd>
                <dt>Warning given</dt><dd style={{ color: 'var(--ok)' }}>Yes — {rulMax}s before failure</dd>
                <dt>Action missed</dt><dd style={{ color: 'var(--crit)' }}>{activeFault?.fix || 'Return to base'}</dd>
              </dl>
              <button className="gcs-btn prime" onClick={resetAll}>
                🔄 Reset airframe and restart mission
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── RAIL (right panel) ─── */}
      <aside className="gcs-rail">
        <div className="rail-title">
          <h1>Ground Control Station</h1>
          <small>MALE UAV digital twin · predictive maintenance</small>
        </div>

        <div className="gcs-rail-scroll">

          {/* Health ring */}
          <div className="health-ring-wrap">
            <div className="health-ring-label">Engine Health Index</div>
            <HealthRing value={engineHealth} />
            <div className="health-ring-status" style={{
              color: engineHealth > 65 ? 'var(--ok)' : engineHealth > 35 ? 'var(--caution)' : 'var(--crit)',
            }}>
              {destroyed ? '💥 DESTROYED' : engineHealth > 65 ? '✓ NOMINAL' : engineHealth > 35 ? '⚠ WARNING' : '🔴 CRITICAL'}
            </div>
          </div>

          {/* Mission controls */}
          <div className="gcs-block">
            <h2>Mission</h2>
            <select value={condKey} onChange={e => setCondKey(e.target.value)} disabled={running}>
              {Object.entries(CONDITIONS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
            </select>
            <button className="gcs-btn prime" onClick={handleStart} disabled={destroyed}>
              {running ? '⏸ Hold mission' : '▶ Start mission'}
            </button>
            <button className="gcs-btn" onClick={handleRTB} disabled={!running || destroyed || recovering || !activeFault}>
              🛬 Return to base
            </button>
          </div>

          {/* Fault injection */}
          <div className="gcs-block">
            <h2>Fault injection</h2>
            <select value={faultSel} onChange={e => setFaultSel(e.target.value)}>
              {FAULTS.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
            </select>
            <button className="gcs-btn danger" onClick={handleInject} disabled={destroyed}>
              ⚡ Inject fault
            </button>
          </div>

          {/* Telemetry */}
          <div className="gcs-block" style={{ padding: '12px 0' }}>
            <h2 style={{ padding: '0 16px' }}>Engine Telemetry</h2>
            {TM.map(t => {
              const warn = t.v != null && t.v > t.e * 1.15;
              const bad  = t.v != null && t.v > t.e * 1.4;
              return (
                <div key={t.k} className={`tele-row${bad ? ' bad' : warn ? ' dev' : ''}`}>
                  <span className="tele-n">{t.l}</span>
                  <span className="tele-v">{t.v != null ? t.v.toFixed(t.k === 'rpm' ? 0 : 1) : '—'}</span>
                  <span className="tele-e">exp {t.e}</span>
                </div>
              );
            })}
          </div>

          {/* Subsystem health */}
          <div className="gcs-block" style={{ padding: '12px 0' }}>
            <h2 style={{ padding: '0 16px' }}>Subsystem Health</h2>
            {Object.entries(PARTS).map(([id, part]) => {
              const ph = partHealth(id);
              return (
                <button key={id} className="sub-btn" onClick={() => setSelectedPart(id)}>
                  <span className="sub-dot" style={{
                    background: ph > 65 ? 'var(--ok)' : ph > 35 ? 'var(--caution)' : 'var(--crit)',
                    boxShadow: ph < 35 ? '0 0 8px var(--crit)' : ph < 65 ? '0 0 4px var(--caution)' : 'none',
                  }} />
                  <span>{part.name}</span>
                  <span className="sub-pct mono">{ph}%</span>
                </button>
              );
            })}
          </div>

          {/* AI Explainability — matches files 2 #why */}
          <div className="gcs-block">
            <h2>AI Explainability</h2>
            <p className="why-hdr">Why this alert</p>
            {!degrading ? (
              <p className="why-text">No alert active. Baselines are being tracked against the physics model.</p>
            ) : (
              <>
                <p className="why-text">
                  The model flagged the {PARTS[activeFault.part]?.name.toLowerCase()} because these readings are
                  drifting away from what the physics baseline predicts for this flight condition, well before
                  any of them reach a redline.
                </p>
                {(alerts.length > 0 ? alerts : [activeFault]).slice(0, 4).map((f, i) => (
                  <div key={i} className="why-driver">
                    <span>{(f.fault_type || f.label || '').replace(/_/g,' ')}</span>
                    <b>{(faultProgress * 3.5 + 0.8 + i * 0.4).toFixed(1)}σ</b>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Mission log */}
          <div className="gcs-log">
            <h2>Mission Log</h2>
            <ol>
              {logs.map(l => (
                <li key={l.id} className={l.cls}>
                  <time>{l.t}</time><span>{l.msg}</span>
                </li>
              ))}
            </ol>
          </div>

        </div>
      </aside>
    </div>
  );
}
