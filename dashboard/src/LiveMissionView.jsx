/**
 * LiveMissionView — Real-time engine health overview.
 * Shows health gauge, key telemetry params, and mission status.
 * Polls /telemetry/latest every 2 seconds.
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchLatest, fetchRUL, openTelemetryStream } from './api';
import HealthGauge from './HealthGauge';
import DigitalTwin3DView from './DigitalTwin3DView';
import TTFCountdown from './TTFCountdown';

const KEY_METRICS = [
  { key: 'rpm',              label: 'RPM',         unit: 'rpm',  icon: '⚙️',  decimals: 0, warnHigh: 6500 },
  { key: 'cht_c',            label: 'CHT',          unit: '°C',   icon: '🌡️',  decimals: 1, warnHigh: 240 },
  { key: 'egt_c',            label: 'EGT',          unit: '°C',   icon: '🔥',  decimals: 1, warnHigh: 800 },
  { key: 'oil_pressure_kpa', label: 'Oil Press',    unit: 'kPa',  icon: '🫧',  decimals: 0, warnLow: 150 },
  { key: 'oil_temp_c',       label: 'Oil Temp',     unit: '°C',   icon: '💧',  decimals: 1, warnHigh: 120 },
  { key: 'fuel_flow_lph',    label: 'Fuel Flow',    unit: 'L/h',  icon: '⛽',  decimals: 2 },
  { key: 'vibration_g',      label: 'Vibration',    unit: 'g',    icon: '📳',  decimals: 3, warnHigh: 0.8 },
  { key: 'throttle_pct',     label: 'Throttle',     unit: '%',    icon: '🎚️',  decimals: 1 },
  { key: 'altitude_m',       label: 'Altitude',     unit: 'm',    icon: '🛫',  decimals: 0 },
];

function getMetricStatus(metric, value) {
  if (value === null || value === undefined) return '';
  if (metric.warnHigh && value > metric.warnHigh) return 'alert-metric';
  if (metric.warnLow  && value < metric.warnLow)  return 'alert-metric';
  return '';
}

export default function LiveMissionView({ missionId, onAlertsUpdate, onTelemetryUpdate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [rul, setRul] = useState(null);

  const poll = useCallback(async () => {
    if (!missionId) return;
    try {
      const result = await fetchLatest(missionId);
      setData(result);
      setError(null);
      setLastUpdate(new Date());
      if (onAlertsUpdate && result.active_alerts) {
        onAlertsUpdate(result.active_alerts);
      }
      // Fetch RUL data
      fetchRUL(missionId).then(r => setRul(r)).catch(() => {});
      if (onTelemetryUpdate) {
        onTelemetryUpdate(result.frame, result.health_index ?? 100);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [missionId, onAlertsUpdate]);

  useEffect(() => {
    poll();
    const source = openTelemetryStream(missionId, (result) => {
      setData(result); setError(null); setLoading(false); setLastUpdate(new Date());
      if (result.active_alerts) onAlertsUpdate?.(result.active_alerts);
      onTelemetryUpdate?.(result.frame, result.health_index ?? 100);
      fetchRUL(missionId).then(setRul).catch(() => {});
    });
    return () => source.close();
  }, [poll]);

  const frame = data?.frame ?? {};
  const hi = data?.health_index ?? 100;
  const efficiency = data?.engine_efficiency_pct;

  return (
    <div style={{ display: 'contents' }}>
      {/* 3D Digital Twin View */}
      <DigitalTwin3DView telemetry={frame} healthScore={hi} />

      {/* Time To Failure Countdown */}
      <TTFCountdown healthScore={hi} rul={rul} />

      {/* Health Index Card */}
      <div className="card health-card">
        <div className="card-header">
          <span className="card-title">Engine Health</span>
          {missionId && (
            <span className="mission-id-badge">📡 {missionId.slice(0, 20)}</span>
          )}
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            Waiting for telemetry…
          </div>
        ) : error ? (
          <div className="loading-state" style={{ color: '#ef4444', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 24 }}>⚠️</span>
            <span>{error.includes('404') ? 'No telemetry yet' : 'Connection error'}</span>
            <span style={{ fontSize: 11 }}>{error}</span>
          </div>
        ) : (
          <>
            <HealthGauge value={hi} />
            {lastUpdate && (
              <div style={{ textAlign: 'center', fontSize: 10, color: '#475569', marginTop: 8 }}>
                Updated {lastUpdate.toLocaleTimeString()}
              </div>
            )}
          </>
        )}
      </div>

      {/* Live Metrics Card */}
      <div className="card metrics-card">
        <div className="card-header">
          <span className="card-title">Live Engine Parameters</span>
          {!loading && !error && (
            <span className="card-badge" style={{
              background: 'rgba(16,185,129,0.15)',
              color: '#10b981',
              fontSize: 11,
              border: '1px solid rgba(16,185,129,0.3)',
              borderRadius: 12,
              padding: '3px 10px',
            }}>● LIVE</span>
          )}
        </div>

        {loading ? (
          <div className="loading-state"><div className="spinner" />Loading…</div>
        ) : (
          <div className="metrics-grid">
            {KEY_METRICS.map(metric => {
              const rawVal = frame[metric.key];
              const val = rawVal != null ? Number(rawVal) : null;
              const status = getMetricStatus(metric, val);
              return (
                <div key={metric.key} className={`metric-item ${status}`}>
                  <span className="metric-icon">{metric.icon}</span>
                  <span className="metric-name">{metric.label}</span>
                  <div>
                    <span className="metric-value">
                      {val != null ? val.toFixed(metric.decimals) : '—'}
                    </span>
                    <span className="metric-unit"> {metric.unit}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card" style={{ minHeight: 126 }}>
        <div className="card-header"><span className="card-title">Estimated Engine Efficiency</span><span className="card-badge badge-live">PHYSICS-INFORMED</span></div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}><strong style={{ fontSize: 34, fontFamily: 'JetBrains Mono, monospace' }}>{efficiency ?? '—'}</strong><span style={{ color: '#64748b' }}>%</span></div>
        <p style={{ color: '#64748b', fontSize: 10, marginTop: 8 }}>Fuel-to-propulsion proxy corrected for load, thermal residuals and vibration. Not a certified brake-efficiency measurement.</p>
      </div>
    </div>
  );
}
