import { useMemo } from 'react';

// Dramatic Time-To-Failure countdown + warning overlay
export default function TTFCountdown({ healthScore, rul }) {
  const ttfMinutes = rul?.rul_hours ? (rul.rul_hours * 60) : null;
  const isCritical  = healthScore < 30;
  const isWarning   = healthScore < 60;
  const isExploded  = healthScore <= 5;

  const countdownStr = useMemo(() => {
    if (!ttfMinutes || ttfMinutes > 9999) return null;
    const h = Math.floor(ttfMinutes / 60);
    const m = Math.floor(ttfMinutes % 60);
    const s = Math.floor((ttfMinutes % 1) * 60);
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }, [ttfMinutes]);

  if (!isWarning && !countdownStr) return null;

  return (
    <>
      {/* Full screen red pulse on critical */}
      {isCritical && !isExploded && (
        <div className="ttf-danger-pulse" />
      )}
      
      {/* Exploded overlay */}
      {isExploded && (
        <div className="ttf-exploded-overlay">
          <div className="ttf-exploded-text">⚠ ENGINE FAILURE ⚠</div>
          <div className="ttf-exploded-sub">CATASTROPHIC FAILURE DETECTED — MISSION TERMINATED</div>
          <div className="ttf-exploded-sub" style={{marginTop: 8}}>All telemetry feeds lost</div>
        </div>
      )}

      {/* TTF Countdown panel */}
      {!isExploded && (
        <div className={`ttf-panel ${isCritical ? 'ttf-critical' : isWarning ? 'ttf-warning' : ''}`}>
          <div className="ttf-header">
            <span className="ttf-indicator" />
            TIME TO FAILURE
          </div>
          
          {countdownStr && (
            <div className={`ttf-countdown ${isCritical ? 'ttf-countdown-critical' : ''}`}>
              {countdownStr}
            </div>
          )}
          
          <div className="ttf-details">
            <div className="ttf-detail-row">
              <span>RUL</span>
              <span>{rul?.rul_hours?.toFixed(1) || '—'} hrs</span>
            </div>
            <div className="ttf-detail-row">
              <span>Confidence</span>
              <span>{((rul?.confidence || 0) * 100).toFixed(0)}%</span>
            </div>
            <div className="ttf-detail-row">
              <span>Trend</span>
              <span className={`ttf-trend-${rul?.degradation_trend || 'stable'}`}>
                {rul?.degradation_trend === 'critical' ? '🔴 CRITICAL' :
                 rul?.degradation_trend === 'degrading' ? '🟡 DEGRADING' : '🟢 STABLE'}
              </span>
            </div>
          </div>

          {isCritical && (
            <div className="ttf-action-banner">
              ⚠ IMMEDIATE ACTION REQUIRED — INITIATE EMERGENCY LANDING
            </div>
          )}
        </div>
      )}
    </>
  );
}
