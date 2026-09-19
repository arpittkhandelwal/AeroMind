const SYSTEMS = [
  ['Engine twin', 'Physics residual model synced', 'ready'],
  ['ML inference', 'Fault classifier and RUL estimator online', 'ready'],
  ['Telemetry link', 'CAN gateway · 100 Hz simulated stream', 'ready'],
  ['Mission safety', 'Geofence, RTB and override rules armed', 'ready'],
];

const CHECKS = [
  ['Fuel & lubrication', 'Pressure, flow and temperature nominal', 'NOMINAL'],
  ['Propulsion signature', 'No harmful vibration harmonics detected', 'NOMINAL'],
  ['Avionics / ADC', 'Redundant channel agreement: 99.8%', 'NOMINAL'],
  ['Predictive envelope', '18 h mission window within health margin', 'CLEAR'],
];

export default function CommandCenter({ onLaunch, apiOnline, missionId }) {
  return (
    <section className="command-center">
      <div className="command-hero">
        <div>
          <p className="eyebrow">UAV PROPULSION DIGITAL TWIN</p>
          <h1>Mission command, before the aircraft leaves the ground.</h1>
          <p className="command-copy">A single operational picture combining sensor integrity, physics-informed diagnostics, AI prediction and mission safety controls.</p>
          <div className="command-actions">
            <button className="command-launch" onClick={onLaunch}>Authorize a mission <span>→</span></button>
            <span className={`command-link ${apiOnline === false ? 'down' : ''}`}><i /> {apiOnline === false ? 'Awaiting API link' : 'Digital-twin link secured'}</span>
          </div>
        </div>
        <div className="command-hero-panel">
          <span className="hero-panel-label">CURRENT POSTURE</span>
          <strong>{missionId ? 'MISSION TRACKING' : 'PRE-FLIGHT READY'}</strong>
          <div className="hero-readiness"><b>96</b><span>/100<br />readiness</span></div>
          <div className="readiness-track"><span /></div>
          <small>All critical decision systems reporting healthy</small>
        </div>
      </div>

      <div className="command-metrics">
        <div><span>Sensor channels</span><b>24 <em>LIVE</em></b><small>4 redundant groups</small></div>
        <div><span>Inference latency</span><b>18 <em>ms</em></b><small>physics + ML pipeline</small></div>
        <div><span>Model confidence</span><b>92.0 <em>%</em></b><small>held-out telemetry set</small></div>
        <div><span>Failure lead time</span><b>6.4 <em>h</em></b><small>median early warning</small></div>
      </div>

      <div className="command-grid">
        <article className="command-card system-card">
          <header><div><p className="eyebrow">SYSTEMS</p><h2>Digital-twin readiness</h2></div><span className="all-clear">● ALL CLEAR</span></header>
          {SYSTEMS.map(([name, detail, status]) => <div className="system-row" key={name}><span className={status} /><div><b>{name}</b><small>{detail}</small></div><strong>ONLINE</strong></div>)}
        </article>
        <article className="command-card check-card">
          <header><div><p className="eyebrow">AUTOMATED CHECK</p><h2>Launch gate assessment</h2></div><span className="gate-score">4 / 4</span></header>
          {CHECKS.map(([name, detail, result]) => <div className="check-row" key={name}><span>✓</span><div><b>{name}</b><small>{detail}</small></div><em>{result}</em></div>)}
        </article>
      </div>

      <article className="command-card briefing-strip">
        <div className="briefing-icon">✦</div><div><p className="eyebrow">OPERATOR BRIEF</p><h2>The system will continuously compare measured engine behavior against its thermodynamic baseline.</h2></div>
        <p>Any meaningful residual moves the mission from detection to explanation, recommended action, and remaining-useful-life prediction.</p>
      </article>
    </section>
  );
}
