import { useState } from 'react';
import { startSimulation } from './api';
import MissionBriefing from './MissionBriefing';

const PROFILES = ['nominal', 'high_altitude', 'endurance', 'hot_weather', 'rapid_throttle'];
const FAULTS = ['none', 'misfire', 'injector_fault', 'sensor_drift', 'overheating',
                'cooling_degradation', 'combustion_instability', 'lubrication_issue', 'abnormal_vibration'];

export default function StartMissionDialog({ onClose, onStarted }) {
  const [profile,  setProfile]  = useState('nominal');
  const [fault,    setFault]    = useState('none');
  const [speedup,  setSpeedup]  = useState(20);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [briefing, setBriefing] = useState(false); // show briefing before launch

  const handleBriefingAuthorise = async () => {
    setBriefing(false);
    setLoading(true);
    setError(null);
    try {
      const res = await startSimulation({ profile, fault, speedup: Number(speedup) });
      onStarted(res.mission_id);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (briefing) {
    return (
      <MissionBriefing
        profile={profile}
        fault={fault}
        speedup={speedup}
        onAuthorise={handleBriefingAuthorise}
        onBack={() => setBriefing(false)}
      />
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.75)',
      backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000,
    }}>
      <div className="card" style={{ width: 420, border: '1px solid var(--border-bright)', boxShadow: '0 24px 48px rgba(0,0,0,0.6)' }}>
        <h2 style={{ fontSize: 16, marginBottom: 6, letterSpacing: 1 }}>🚀 Launch New Mission</h2>
        <p style={{ fontSize: 11, color: '#64748b', marginBottom: 20 }}>DRDO UAV Engine Digital Twin · SIH 2026</p>

        {error && <div style={{ color: '#ef4444', marginBottom: 14, fontSize: 12, background: '#ef444411', padding: '8px 12px', borderRadius: 6 }}>{error}</div>}

        <label style={{ display: 'block', marginBottom: 6, fontSize: 11, color: '#94a3b8', letterSpacing: 1 }}>MISSION PROFILE</label>
        <select value={profile} onChange={e => setProfile(e.target.value)} style={{ width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #1e2740', color: '#e2e8f0', borderRadius: 6, marginBottom: 16 }}>
          {PROFILES.map(p => <option key={p} value={p}>{p.replace(/_/g,' ').toUpperCase()}</option>)}
        </select>

        <label style={{ display: 'block', marginBottom: 6, fontSize: 11, color: '#94a3b8', letterSpacing: 1 }}>FAULT INJECTION</label>
        <select value={fault} onChange={e => setFault(e.target.value)} style={{ width: '100%', padding: '9px 12px', background: '#0f172a', border: '1px solid #1e2740', color: fault !== 'none' ? '#f59e0b' : '#e2e8f0', borderRadius: 6, marginBottom: 16 }}>
          {FAULTS.map(f => <option key={f} value={f}>{f === 'none' ? 'NONE (Nominal)' : f.replace(/_/g,' ').toUpperCase()}</option>)}
        </select>

        <label style={{ display: 'block', marginBottom: 8, fontSize: 11, color: '#94a3b8', letterSpacing: 1 }}>
          SIMULATION SPEEDUP — <span style={{ color: '#3b82f6' }}>{speedup}x</span>
        </label>
        <input type="range" min="1" max="100" value={speedup} onChange={e => setSpeedup(e.target.value)}
          style={{ width: '100%', marginBottom: 24, accentColor: '#3b82f6' }} />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #1e2740', color: '#94a3b8', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
          <button
            onClick={() => setBriefing(true)}
            disabled={loading}
            style={{ padding: '9px 20px', background: '#1d4ed8', border: 'none', color: '#fff', borderRadius: 6, cursor: loading ? 'wait' : 'pointer', fontWeight: 600, letterSpacing: 0.5 }}
          >
            {loading ? 'Launching…' : 'Review Briefing →'}
          </button>
        </div>
      </div>
    </div>
  );
}
