/**
 * RULPanel — Remaining Useful Life display with trend badge and SHAP contributing factors.
 * Polls /rul/{mission_id} every 3 seconds.
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchRUL } from './api';
import './index.css';

const TREND_ICON = {
  stable:    '🟢',
  degrading: '⚠️',
  critical:  '🛑',
};

const TREND_DESC = {
  stable:    'Operating normally',
  degrading: 'Progressive wear detected',
  critical:  'Immediate attention required',
};

export default function RULPanel({ missionId }) {
  const [rul, setRul] = useState(null);
  const [loading, setLoading] = useState(true);

  const poll = useCallback(async () => {
    if (!missionId) return;
    try {
      const result = await fetchRUL(missionId);
      setRul(result);
    } catch {
      // silently degrade
    } finally {
      setLoading(false);
    }
  }, [missionId]);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [poll]);

  const trend = rul?.degradation_trend ?? 'stable';
  // Max RUL is 200h in our new aggressive simulation scaling
  const hours = rul?.rul_hours ?? 200;
  const confidence = rul?.confidence ?? 0.5;
  const factors = rul?.contributing_factors ?? [];

  // RUL bar: fraction of 200h TBO
  const rulFraction = Math.max(0, Math.min(1, hours / 200));
  const barColor = rulFraction > 0.4 ? '#10b981' : rulFraction > 0.1 ? '#f59e0b' : '#ef4444';

  return (
    <div className="card rul-card" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="card-header">
        <span className="card-title">Remaining Useful Life (RUL)</span>
      </div>

      {loading ? (
        <div className="loading-state"><div className="spinner" />Computing RUL…</div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
          <div className="rul-main">
            <span className="rul-hours">{hours.toFixed(0)}</span>
            <span className="rul-unit">hours</span>
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: 12 }}>
            <div className="health-bar-track" style={{ height: 6 }}>
              <div
                className="health-bar-fill"
                style={{
                  width: `${rulFraction * 100}%`,
                  background: barColor,
                  boxShadow: `0 0 6px ${barColor}`,
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#475569', marginTop: 4 }}>
              <span>0h</span>
              <span>TBO: 200h</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <div className={`rul-trend-badge ${trend}`} style={{ flex: 1, padding: '8px 12px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>{TREND_ICON[trend]}</span>
                {trend.charAt(0).toUpperCase() + trend.slice(1)}
              </div>
              <div style={{ fontSize: 11, color: 'inherit', opacity: 0.8, marginTop: 4 }}>
                {TREND_DESC[trend]}
              </div>
            </div>
            
            <div className="card" style={{ flex: 1, padding: '8px 12px', background: 'rgba(30, 41, 59, 0.5)' }}>
              <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                AI Confidence
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#e2e8f0', marginTop: 2 }}>
                {(confidence * 100).toFixed(0)}%
              </div>
              <div style={{
                marginTop: 6,
                width: '100%',
                height: 4,
                background: `linear-gradient(to right, #3b82f6 ${confidence * 100}%, #1e2740 0%)`,
                borderRadius: 2,
              }} />
            </div>
          </div>

          {factors.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div className="rul-factors-title" style={{ marginBottom: 8, fontSize: 12, fontWeight: 600, color: '#cbd5e1' }}>
                AI EXPLAINABILITY: CONTRIBUTING FACTORS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {factors.map((f, i) => (
                  <div key={i} className="insight-card">
                    <span style={{ color: '#3b82f6', marginRight: 6 }}>❖</span>
                    <span style={{ fontSize: 12, lineHeight: 1.4, color: '#e2e8f0' }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {trend !== 'stable' && (
            <div className="maintenance-rec-block">
              <div className="maintenance-rec-title">MAINTENANCE RECOMMENDATION</div>
              <div className="maintenance-rec-text">
                {trend === 'critical' 
                  ? "ABORT MISSION OR LAND IMMEDIATELY. Engine failure imminent. Complete teardown and inspection required."
                  : "Schedule maintenance at next available window. Inspect affected subsystems."}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
