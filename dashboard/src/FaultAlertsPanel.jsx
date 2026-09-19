import { useState, useEffect, useCallback } from 'react';
import { fetchFaults } from './api';

const SEV_ICON = { info: 'ℹ️', warning: '⚠️', critical: '🚨' };
const FAULT_LABELS = {
  misfire: 'Misfire', injector_fault: 'Injector Fault', sensor_drift: 'Sensor Drift',
  overheating: 'Overheating', combustion_instability: 'Combustion Instability',
  lubrication_issue: 'Lubrication Issue', abnormal_vibration: 'Abnormal Vibration',
};
const fmt = (iso) => { try { return new Date(iso).toLocaleTimeString('en-IN', { hour12: false }); } catch { return iso; } };

export default function FaultAlertsPanel({ missionId, liveAlerts = [] }) {
  const [stored, setStored] = useState([]);
  const [loading, setLoading] = useState(true);

  const poll = useCallback(async () => {
    if (!missionId) return;
    try { setStored(await fetchFaults(missionId) || []); }
    catch {}
    finally { setLoading(false); }
  }, [missionId]);

  useEffect(() => { poll(); const iv = setInterval(poll, 3000); return () => clearInterval(iv); }, [poll]);

  const all = [...liveAlerts, ...stored].reduce((acc, a) => {
    const k = `${a.fault_type}_${a.detected_at}`;
    if (!acc.find(x => `${x.fault_type}_${x.detected_at}` === k)) acc.push(a);
    return acc;
  }, []).sort((a, b) => {
    const s = { critical: 0, warning: 1, info: 2 };
    return ((s[a.severity] ?? 3) - (s[b.severity] ?? 3)) || (b.detected_at || '').localeCompare(a.detected_at || '');
  });

  return (
    <div className="card alert-card" style={{ flex: 1, minHeight: 200, maxHeight: 340, display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <span className="card-title">Fault Alerts</span>
        {all.length > 0 && (
          <span className={`card-badge ${all.some(a => a.severity === 'critical') ? 'badge-warn' : 'badge-warn'}`}
            style={{ color: all.some(a => a.severity === 'critical') ? 'var(--red)' : 'var(--amber)',
              background: all.some(a => a.severity === 'critical') ? 'var(--red-dim)' : 'rgba(245,158,11,0.1)',
              border: `1px solid ${all.some(a => a.severity === 'critical') ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}` }}>
            {all.length} Alert{all.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {loading && all.length === 0 ? (
        <div className="loading-state"><div className="spinner" />Loading…</div>
      ) : all.length === 0 ? (
        <div className="alert-empty">
          <span className="alert-empty-icon">✅</span>
          <span>All systems nominal</span>
        </div>
      ) : (
        <div className="alerts-list">
          {all.map((a, i) => (
            <div key={i} className={`alert-item ${a.severity === 'critical' ? 'alert-critical' : 'alert-warning'}`}>
              <div className="alert-row-1">
                <span className="alert-type" style={{ color: a.severity === 'critical' ? 'var(--red)' : 'var(--amber)' }}>
                  {SEV_ICON[a.severity]} {FAULT_LABELS[a.fault_type] || a.fault_type?.replace(/_/g, ' ')}
                </span>
                <span className={`alert-sev ${a.severity === 'critical' ? 'sev-critical' : 'sev-warning'}`}>
                  {a.severity}
                </span>
              </div>
              {a.message && <div className="alert-msg">{a.message}</div>}
              {a.recommended_action && <div className="alert-action">→ {a.recommended_action}</div>}
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{fmt(a.detected_at)}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
