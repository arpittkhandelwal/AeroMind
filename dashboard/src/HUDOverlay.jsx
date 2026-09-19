export default function HUDOverlay({ telemetry, onClose }) {
  const rpm        = telemetry?.rpm || 0;
  const cht        = telemetry?.cht_c || 0;
  const alt        = telemetry?.altitude_m || 0;
  const throttle   = telemetry?.throttle_pct || 0;
  const vibration  = telemetry?.vibration_g || 0;
  const oilPress   = telemetry?.oil_pressure_kpa || 0;
  const battery    = telemetry?.battery_voltage_v || 0;

  const rpmPct     = Math.min(100, (rpm / 7000) * 100);
  const chtCrit    = cht > 240;
  const altFt      = (alt * 3.281).toFixed(0);

  // Artificial horizon pitch/roll from vibration/throttle (simulated)
  const pitchDeg   = (throttle - 50) * 0.3;
  const rollDeg    = vibration * 8;

  return (
    <div className="hud-overlay">
      <button className="hud-close" onClick={onClose}>✕ EXIT HUD</button>

      {/* Top strip */}
      <div className="hud-top">
        <span className="hud-label">DRDO UAV DIGITAL TWIN</span>
        <span className="hud-label" style={{color:'#ef4444'}}>{chtCrit ? '⚠ ENGINE OVERHEAT' : ''}</span>
        <span className="hud-label">{new Date().toLocaleTimeString()}</span>
      </div>

      {/* Artificial Horizon */}
      <div className="hud-horizon-wrap">
        <div className="hud-horizon" style={{ transform: `rotate(${rollDeg}deg) translateY(${pitchDeg}px)` }}>
          <div className="hud-sky" />
          <div className="hud-ground" />
          <div className="hud-horizon-line" />
        </div>
        <div className="hud-crosshair">✛</div>
        <div className="hud-pitch-labels">
          {[10, 5, 0, -5, -10].map(p => (
            <span key={p} className="hud-pitch-tick" style={{ top: `${50 - p * 2}%` }}>{p}°</span>
          ))}
        </div>
      </div>

      {/* Left column */}
      <div className="hud-left">
        <div className="hud-gauge-label">ALTITUDE</div>
        <div className="hud-gauge-value">{altFt} <small>ft</small></div>
        <div className="hud-gauge-value" style={{fontSize:14}}>{alt.toFixed(0)} <small>m</small></div>
        <div className="hud-divider" />
        <div className="hud-gauge-label">OIL PRESS</div>
        <div className="hud-gauge-value">{oilPress.toFixed(0)} <small>kPa</small></div>
        <div className="hud-divider" />
        <div className="hud-gauge-label">BATTERY</div>
        <div className="hud-gauge-value">{battery.toFixed(1)} <small>V</small></div>
      </div>

      {/* Right column */}
      <div className="hud-right">
        <div className="hud-gauge-label">RPM</div>
        <div className="hud-arc-wrap">
          <svg width="100" height="60" viewBox="0 0 100 60">
            <path d="M10 55 A45 45 0 0 1 90 55" fill="none" stroke="#1a3a1a" strokeWidth="6"/>
            <path
              d={`M10 55 A45 45 0 0 1 ${10 + rpmPct * 0.8} ${55 - rpmPct * 0.45}`}
              fill="none" stroke="#39ff14" strokeWidth="6" strokeLinecap="round"
            />
          </svg>
          <div className="hud-gauge-value">{rpm.toFixed(0)}</div>
        </div>

        <div className="hud-divider" />
        <div className="hud-gauge-label">CHT</div>
        <div className="hud-gauge-value" style={{color: chtCrit ? '#ef4444' : '#39ff14'}}>
          {cht.toFixed(1)} <small>°C</small>
        </div>
        <div className="hud-divider" />
        <div className="hud-gauge-label">THROTTLE</div>
        <div className="hud-throttle-bar">
          <div className="hud-throttle-fill" style={{height:`${throttle}%`}} />
        </div>
        <div className="hud-gauge-value">{throttle.toFixed(0)}%</div>
      </div>

      {/* Bottom strip */}
      <div className="hud-bottom">
        <span>VIBRATION: {vibration.toFixed(3)}g</span>
        <span>MISSION STATUS: {chtCrit ? '⚠ FAULT' : '✓ NOMINAL'}</span>
        <span>FUEL FLOW: {telemetry?.fuel_flow_lph?.toFixed(1)} L/h</span>
      </div>

      {/* Scan-line overlay */}
      <div className="hud-scanlines" />
    </div>
  );
}
