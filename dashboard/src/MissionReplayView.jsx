/**
 * MissionReplayView — Mission picker + scrubbable recharts time-series chart.
 * Loads all missions, lets operator pick one, fetches full replay, and
 * displays a multi-line chart with a scrubber for post-flight analysis.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { fetchMissions, fetchReplay } from './api';

// Chart series config
const SERIES = [
  { key: 'cht_c',            name: 'CHT',         color: '#ef4444', unit: '°C'  },
  { key: 'egt_c',            name: 'EGT',         color: '#f97316', unit: '°C'  },
  { key: 'oil_temp_c',       name: 'Oil Temp',    color: '#f59e0b', unit: '°C'  },
  { key: 'oil_pressure_kpa', name: 'Oil Press',   color: '#3b82f6', unit: 'kPa' },
  { key: 'rpm',              name: 'RPM',         color: '#8b5cf6', unit: 'rpm' },
  { key: 'vibration_g',      name: 'Vibration',   color: '#10b981', unit: 'g'   },
];

const SERIES_SCALE = {
  cht_c:            1,
  egt_c:            0.5,   // scale down to share Y axis: 800°C → 400
  oil_temp_c:       1,
  oil_pressure_kpa: 0.5,   // 400 kPa → 200
  rpm:              0.04,  // 6000 rpm → 240
  vibration_g:      100,   // 0-1g → 0-100
};

const SERIES_LABELS = SERIES.map(s => ({
  ...s,
  scaledName: `${s.name}${SERIES_SCALE[s.key] !== 1 ? ` (×${SERIES_SCALE[s.key]})` : ''}`,
}));

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="custom-tooltip">
      <div className="label">t = {label}s</div>
      {payload.map(p => (
        <div key={p.dataKey} className="value" style={{ color: p.color }}>
          {p.name}: {p.value != null ? p.value.toFixed(2) : '—'}
        </div>
      ))}
    </div>
  );
}

function formatTs(ts, startTs) {
  try {
    const t = (new Date(ts) - new Date(startTs)) / 1000;
    return t.toFixed(0);
  } catch {
    return '?';
  }
}

export default function MissionReplayView() {
  const [missions, setMissions] = useState([]);
  const [selectedMission, setSelectedMission] = useState('');
  const [frames, setFrames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [scrubIndex, setScrubIndex] = useState(0);
  const [visibleSeries, setVisibleSeries] = useState(
    Object.fromEntries(SERIES.map(s => [s.key, true]))
  );

  // Load mission list
  useEffect(() => {
    fetchMissions()
      .then(list => {
        setMissions(list || []);
        if (list?.length > 0) setSelectedMission(list[0].mission_id);
      })
      .catch(() => {});
  }, []);

  // Load replay when mission changes
  const loadReplay = useCallback(async (missionId) => {
    if (!missionId) return;
    setLoading(true);
    setFrames([]);
    setScrubIndex(0);
    try {
      const result = await fetchReplay(missionId);
      setFrames(result || []);
    } catch (e) {
      console.error('Replay load failed:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedMission) loadReplay(selectedMission);
  }, [selectedMission, loadReplay]);

  // Build chart data (normalised for shared Y axis)
  const chartData = useMemo(() => {
    if (!frames.length) return [];
    const startTs = frames[0]?.timestamp;
    return frames.map((f, i) => {
      const point = { t: formatTs(f.timestamp, startTs), idx: i };
      SERIES.forEach(s => {
        const raw = f[s.key];
        point[s.key] = raw != null ? Number(raw) * SERIES_SCALE[s.key] : null;
      });
      // Fault annotation
      point.fault_label = f.fault_label;
      return point;
    });
  }, [frames]);

  // Scrubber frame info
  const scrubFrame = frames[scrubIndex] ?? null;
  const selectedMeta = missions.find(m => m.mission_id === selectedMission);

  // Fault region for reference line
  const firstFaultIdx = frames.findIndex(f => f.fault_label && f.fault_label !== 'none');
  const faultStartT = firstFaultIdx > 0 ? chartData[firstFaultIdx]?.t : null;

  const toggleSeries = (key) => {
    setVisibleSeries(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="replay-layout">
      {/* Mission picker */}
      <div className="card">
        <div className="card-header" style={{ marginBottom: 0 }}>
          <span className="card-title">Mission Replay</span>
        </div>
        <div className="replay-controls" style={{ marginTop: 14 }}>
          <label className="replay-select-label">Mission</label>
          <select
            id="mission-picker"
            className="replay-select"
            value={selectedMission}
            onChange={e => setSelectedMission(e.target.value)}
          >
            {missions.length === 0 && (
              <option value="">No missions available</option>
            )}
            {missions.map(m => (
              <option key={m.mission_id} value={m.mission_id}>
                {m.mission_id} — {m.profile} ({m.duration_min?.toFixed(1) ?? '?'} min)
              </option>
            ))}
          </select>

          {selectedMeta && (
            <div className="replay-meta">
              <div className="replay-meta-item">
                Profile: <span>{selectedMeta.profile}</span>
              </div>
              <div className="replay-meta-item">
                Frames: <span>{frames.length.toLocaleString()}</span>
              </div>
              {selectedMeta.started_at && (
                <div className="replay-meta-item">
                  Started: <span>{new Date(selectedMeta.started_at).toLocaleString()}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Chart */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Time-Series Analysis</span>
          {faultStartT && (
            <span className="card-badge" style={{
              background: 'rgba(239,68,68,0.15)', color: '#ef4444',
              borderRadius: 12, padding: '3px 10px', fontSize: 11,
            }}>
              ⚠️ Fault onset @ {faultStartT}s
            </span>
          )}
        </div>

        {/* Series toggles */}
        <div className="chart-legend" style={{ marginBottom: 12 }}>
          {SERIES_LABELS.map(s => (
            <div
              key={s.key}
              className="legend-item"
              onClick={() => toggleSeries(s.key)}
              style={{ opacity: visibleSeries[s.key] ? 1 : 0.35 }}
            >
              <div className="legend-dot" style={{ background: s.color }} />
              <span>{s.scaledName}</span>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="loading-state" style={{ height: 320 }}>
            <div className="spinner" />Loading replay data…
          </div>
        ) : frames.length === 0 ? (
          <div className="loading-state" style={{ height: 320, color: '#475569' }}>
            Select a mission to load replay data
          </div>
        ) : (
          <>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e2740" vertical={false} />
                  <XAxis
                    dataKey="t"
                    tick={{ fill: '#475569', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    tickLine={false}
                    axisLine={{ stroke: '#2a3650' }}
                    label={{ value: 'Time (s)', position: 'insideBottom', fill: '#475569', fontSize: 10, dy: 8 }}
                  />
                  <YAxis
                    tick={{ fill: '#475569', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    tickLine={false}
                    axisLine={false}
                    width={35}
                  />
                  <Tooltip content={<CustomTooltip />} />

                  {/* Fault onset reference line */}
                  {faultStartT && (
                    <ReferenceLine
                      x={faultStartT}
                      stroke="#ef4444"
                      strokeDasharray="4 4"
                      label={{ value: 'Fault', fill: '#ef4444', fontSize: 10, position: 'top' }}
                    />
                  )}

                  {/* Scrubber reference line */}
                  {scrubIndex > 0 && chartData[scrubIndex] && (
                    <ReferenceLine
                      x={chartData[scrubIndex].t}
                      stroke="#3b82f6"
                      strokeWidth={2}
                      label={{ value: '◀', fill: '#3b82f6', fontSize: 12 }}
                    />
                  )}

                  {SERIES.map(s => (
                    visibleSeries[s.key] && (
                      <Line
                        key={s.key}
                        type="monotone"
                        dataKey={s.key}
                        name={s.name}
                        stroke={s.color}
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 4, fill: s.color }}
                        connectNulls
                      />
                    )
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Scrubber */}
            <div className="scrubber-wrap" style={{ position: 'relative', marginTop: 12 }}>
              <span className="scrubber-label" style={{ minWidth: 40 }}>
                t={chartData[scrubIndex]?.t ?? 0}s
              </span>
              
              <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
                {/* Visual fault markers track behind the native range input */}
                <div style={{ position: 'absolute', left: 0, right: 0, height: 6, pointerEvents: 'none' }}>
                  {frames.map((f, i) => {
                    if (f.fault_label && f.fault_label !== 'none') {
                      return (
                        <div key={`marker-${i}`} style={{
                          position: 'absolute',
                          left: `${(i / Math.max(1, frames.length - 1)) * 100}%`,
                          width: 2,
                          height: '100%',
                          background: 'rgba(239, 68, 68, 0.4)',
                          zIndex: 1
                        }} />
                      );
                    }
                    return null;
                  })}
                </div>

                <input
                  id="replay-scrubber"
                  className="scrubber"
                  type="range"
                  min={0}
                  max={frames.length - 1}
                  value={scrubIndex}
                  onChange={e => setScrubIndex(Number(e.target.value))}
                  style={{ width: '100%', zIndex: 2, position: 'relative' }}
                />
              </div>

              <span className="scrubber-label" style={{ textAlign: 'right', minWidth: 40 }}>
                {frames.length}s
              </span>
            </div>

            {/* Scrubber frame info */}
            {scrubFrame && (
              <div style={{
                marginTop: 12,
                padding: '10px 14px',
                background: '#111620',
                borderRadius: 8,
                border: '1px solid #2a3650',
                fontSize: 12,
                display: 'flex',
                gap: 20,
                flexWrap: 'wrap',
                fontFamily: 'JetBrains Mono, monospace',
              }}>
                <span style={{ color: '#475569' }}>{scrubFrame.timestamp}</span>
                <span>RPM: <b style={{ color: '#8b5cf6' }}>{scrubFrame.rpm?.toFixed(0)}</b></span>
                <span>CHT: <b style={{ color: '#ef4444' }}>{scrubFrame.cht_c?.toFixed(1)}°C</b></span>
                <span>EGT: <b style={{ color: '#f97316' }}>{scrubFrame.egt_c?.toFixed(1)}°C</b></span>
                <span>Oil P: <b style={{ color: '#3b82f6' }}>{scrubFrame.oil_pressure_kpa?.toFixed(0)} kPa</b></span>
                {scrubFrame.fault_label && scrubFrame.fault_label !== 'none' && (
                  <span style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', padding: '2px 8px', borderRadius: 4 }}>
                    ⚠️ {scrubFrame.fault_label?.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
