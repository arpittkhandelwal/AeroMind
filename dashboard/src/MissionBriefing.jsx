const PROFILES = ['nominal', 'high_altitude', 'endurance', 'hot_weather', 'rapid_throttle'];
const FAULTS = ['none', 'misfire', 'injector_fault', 'sensor_drift', 'overheating',
                'combustion_instability', 'lubrication_issue', 'abnormal_vibration'];

const PROFILE_RISK = {
  nominal: 'LOW', high_altitude: 'MEDIUM', endurance: 'MEDIUM',
  hot_weather: 'HIGH', rapid_throttle: 'HIGH'
};

export default function MissionBriefing({ profile, fault, speedup, onAuthorise, onBack }) {
  const risk = fault !== 'none' ? 'CRITICAL' : (PROFILE_RISK[profile] || 'LOW');
  const riskColor = risk === 'CRITICAL' ? '#ef4444' : risk === 'HIGH' ? '#f59e0b' : risk === 'MEDIUM' ? '#3b82f6' : '#22c55e';
  const ts = new Date().toISOString();

  return (
    <div className="briefing-overlay">
      <div className="briefing-terminal">
        <div className="briefing-header">
          <div className="briefing-banner">⬛ DRDO — CLASSIFIED MISSION BRIEFING ⬛</div>
          <div className="briefing-subheader">DEFENCE RESEARCH & DEVELOPMENT ORGANISATION · MINISTRY OF DEFENCE</div>
        </div>

        <div className="briefing-body">
          <pre className="briefing-pre">{`
┌─────────────────────────────────────────────────────┐
│  MISSION AUTHORISATION REQUEST                      │
│  Classification: TOP SECRET                         │
│  Reference: DRDO/SIH2026/PS-26054                  │
│  Timestamp: ${ts}    │
└─────────────────────────────────────────────────────┘

MISSION PARAMETERS:
  ► Profile        : ${profile.toUpperCase().replace(/_/g,' ')}
  ► Fault Injection: ${fault === 'none' ? 'NONE (Nominal Run)' : fault.toUpperCase().replace(/_/g,' ')}
  ► Sim Speedup    : ${speedup}x real-time
  ► Est. Duration  : ~${Math.round(60 / speedup)} minutes

THREAT ASSESSMENT:
  ► Risk Level     : `}<span style={{color:riskColor, fontWeight:'bold'}}>{risk}</span>{`
  ► Engine Stress  : ${'█'.repeat(fault !== 'none' ? 7 : 3)}${'░'.repeat(10 - (fault !== 'none' ? 7 : 3))}
  ► Fault Ramp     : Gradual onset at T+40% mission time

AI SYSTEMS ACTIVE:
  ✓ Edge Preprocessor    — Signal filtering + anomaly detection
  ✓ Physics Model        — Thermodynamic baseline engine model
  ✓ Fault Classifier     — Random Forest multi-class (7 faults)
  ✓ RUL Estimator        — Gradient Boosted regressor
  ✓ Health Index Engine  — Composite scoring [0–100]

AUTHORISATION REQUIRED:
  By proceeding, you acknowledge this mission will stream
  synthetic telemetry into the DRDO Digital Twin system.
`}</pre>
        </div>

        <div className="briefing-actions">
          <button className="briefing-back" onClick={onBack}>◄ ABORT / MODIFY</button>
          <button className="briefing-authorise" onClick={onAuthorise}>
            ✓ AUTHORISE MISSION — LAUNCH
          </button>
        </div>

        <div className="briefing-footer">
          DRDO · भारत सरकार · Government of India · रक्षा अनुसंधान एवं विकास संगठन
        </div>
      </div>
    </div>
  );
}
