/**
 * EmergencyOverridePanel — Closed-loop control panel.
 * Operator can intervene during a live simulation to prevent engine failure.
 */
import { useState } from 'react';
import { applyOverride } from './api';

const ACTIONS = [
  {
    id: 'reduce_throttle',
    label: 'Reduce Throttle 20%',
    icon: '⬇️',
    color: '#f59e0b',
    desc: 'Cuts power output to reduce thermal stress on CHT/EGT.',
  },
  {
    id: 'engage_cooling',
    label: 'Engage Backup Cooling',
    icon: '❄️',
    color: '#3b82f6',
    desc: 'Activates secondary radiator flow to lower cylinder head temp.',
  },
  {
    id: 'reduce_rpm',
    label: 'Reduce RPM to Safe Idle',
    icon: '🔽',
    color: '#8b5cf6',
    desc: 'Drops RPM from cruise to minimum safe idle. Extends engine life.',
  },
];

export default function EmergencyOverridePanel({ missionId, health, visible }) {
  const [sent, setSent]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog]         = useState([]);

  if (!visible) return null;

  const handleAction = async (action) => {
    if (!missionId || loading) return;
    setLoading(true);
    try {
      const res = await applyOverride(missionId, action.id);
      const entry = {
        time: new Date().toLocaleTimeString(),
        action: action.label,
        msg: res.message,
        color: action.color,
      };
      setSent(action.id);
      setLog(l => [entry, ...l.slice(0, 4)]);
      setTimeout(() => setSent(null), 3000);
    } catch (e) {
      console.error('Override failed:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      background: 'rgba(239, 68, 68, 0.04)',
      border: '1px solid rgba(239, 68, 68, 0.3)',
      borderRadius: 12,
      padding: 14,
      marginTop: 12,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: '#ef4444', letterSpacing: 2,
        marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ animation: 'blink 1s step-end infinite' }}>●</span>
        EMERGENCY OVERRIDE PANEL
      </div>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {ACTIONS.map(action => (
          <button
            key={action.id}
            onClick={() => handleAction(action)}
            disabled={loading}
            style={{
              background: sent === action.id
                ? `rgba(${action.color === '#f59e0b' ? '245,158,11' : action.color === '#3b82f6' ? '59,130,246' : '139,92,246'}, 0.3)`
                : 'rgba(15, 23, 42, 0.6)',
              border: `1px solid ${action.color}44`,
              borderLeft: `3px solid ${action.color}`,
              borderRadius: 6,
              padding: '8px 10px',
              cursor: loading ? 'not-allowed' : 'pointer',
              textAlign: 'left',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: action.color, marginBottom: 2 }}>
              {action.icon} {action.label}
            </div>
            <div style={{ fontSize: 10, color: '#64748b' }}>{action.desc}</div>
          </button>
        ))}
      </div>

      {log.length > 0 && (
        <div style={{ borderTop: '1px solid rgba(239,68,68,0.1)', paddingTop: 8 }}>
          <div style={{ fontSize: 9, color: '#475569', letterSpacing: 1, marginBottom: 4 }}>INTERVENTION LOG</div>
          {log.map((entry, i) => (
            <div key={i} style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>
              <span style={{ color: entry.color }}>[{entry.time}]</span> {entry.action}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
