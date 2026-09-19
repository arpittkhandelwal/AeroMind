/**
 * FleetView — Multi-UAV Fleet Commander
 * Shows 3-6 drones on a tactical map. One drone has an injected fault.
 * Clicking a drone focuses into the digital twin view.
 */
import { useState, useEffect } from 'react';

const generateFleet = () => [
  { id: 'UAV-ALPHA-01', lat: 28.6, lon: 77.2, status: 'nominal',   health: 92, alt: 3500, speed: 145, mission: 'ISR PATROL'    },
  { id: 'UAV-BRAVO-02', lat: 29.1, lon: 76.8, status: 'nominal',   health: 87, alt: 4200, speed: 132, mission: 'BORDER WATCH'  },
  { id: 'UAV-CHARLIE-03',lat: 28.2, lon: 77.9, status: 'degrading', health: 54, alt: 3800, speed: 128, mission: 'RECON FOXTROT' },
  { id: 'UAV-DELTA-04', lat: 27.8, lon: 77.5, status: 'nominal',   health: 78, alt: 3200, speed: 155, mission: 'RELAY NODE'    },
  { id: 'UAV-ECHO-05',  lat: 29.4, lon: 77.1, status: 'critical',  health: 23, alt: 3600, speed:  95, mission: 'STRIKE SUPPORT' },
];

const STATUS_COLOR = {
  nominal:   'var(--india-green)',
  degrading: 'var(--amber)',
  critical:  'var(--red)',
};

export default function FleetView({ onSelectUAV }) {
  const [fleet, setFleet]     = useState(generateFleet());
  const [selected, setSelected] = useState(null);
  const [tick, setTick]       = useState(0);

  // Simulate live telemetry changes
  useEffect(() => {
    const id = setInterval(() => {
      setFleet(f => f.map(uav => ({
        ...uav,
        health: uav.status === 'critical'
          ? Math.max(0, uav.health - (Math.random() * 2))
          : uav.status === 'degrading'
          ? Math.max(0, uav.health - (Math.random() * 0.5))
          : Math.min(100, uav.health + (Math.random() * 0.2 - 0.1)),
        speed: uav.speed + (Math.random() * 4 - 2),
        alt:   uav.alt   + (Math.random() * 20 - 10),
      })));
      setTick(t => t + 1);
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const criticalCount  = fleet.filter(u => u.status === 'critical').length;
  const degradingCount = fleet.filter(u => u.status === 'degrading').length;

  // Convert lat/lon to SVG coordinates (simple linear mapping for demo)
  const toXY = (lat, lon) => ({
    x: (lon - 76.5) / 1.5 * 380 + 30,
    y: (29.6 - lat) / 1.8 * 220 + 20,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 14 }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '12px 16px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: 12,
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-1)', letterSpacing: 1 }}>
            🛡️ FLEET COMMANDER — NORTHERN SECTOR
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2, fontFamily: 'JetBrains Mono' }}>
            {fleet.length} UAVs active · {criticalCount} CRITICAL · {degradingCount} DEGRADING
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['NOMINAL', 'var(--india-green)', fleet.filter(u=>u.status==='nominal').length],
            ['DEGRADING', 'var(--amber)', degradingCount],
            ['CRITICAL', 'var(--red)', criticalCount],
          ].map(([label, color, count]) => (
            <div key={label} style={{
              padding: '4px 10px', borderRadius: 8,
              background: `${color}18`, border: `1px solid ${color}44`,
              fontSize: 10, fontWeight: 700, color,
            }}>
              {count} {label}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 14, flex: 1 }}>
        {/* Tactical Map */}
        <div style={{
          background: 'var(--bg-card-2)',
          border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden', position: 'relative',
        }}>
          {/* Grid overlay */}
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border)" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>

          {/* Map label */}
          <div style={{
            position: 'absolute', top: 12, left: 12, zIndex: 10,
            fontSize: 9, color: 'var(--text-3)', letterSpacing: 2, fontFamily: 'JetBrains Mono',
          }}>
            TACTICAL MAP · INDIA NORTHERN SECTOR · UAV SWARM
          </div>
          <div style={{
            position: 'absolute', bottom: 12, right: 12, zIndex: 10,
            fontSize: 9, color: 'var(--text-4)', fontFamily: 'JetBrains Mono',
          }}>
            LAT 27.5°N–29.6°N · LON 76.5°E–78.0°E
          </div>

          {/* UAV Markers */}
          <svg
            viewBox="0 0 440 260"
            style={{ width: '100%', height: '100%', position: 'relative', zIndex: 5 }}
          >
            {fleet.map(uav => {
              const { x, y } = toXY(uav.lat, uav.lon);
              const color = STATUS_COLOR[uav.status];
              const isSel = selected === uav.id;
              return (
                <g
                  key={uav.id}
                  transform={`translate(${x}, ${y})`}
                  style={{ cursor: 'pointer' }}
                  onClick={() => { setSelected(uav.id); if (onSelectUAV) onSelectUAV(uav); }}
                >
                  {/* Pulse ring for critical */}
                  {uav.status === 'critical' && (
                    <circle r="20" fill="none" stroke={color} strokeWidth="1" opacity={0.3 + 0.3 * Math.sin(tick * 0.8)}>
                      <animate attributeName="r" values="12;22;12" dur="1.5s" repeatCount="indefinite"/>
                      <animate attributeName="opacity" values="0.6;0;0.6" dur="1.5s" repeatCount="indefinite"/>
                    </circle>
                  )}
                  {/* Drone icon */}
                  <circle r={isSel ? 12 : 9} fill={color + '22'} stroke={color} strokeWidth={isSel ? 2.5 : 1.5}/>
                  <text textAnchor="middle" dominantBaseline="middle" fontSize="10" fill={color}>✈</text>
                  {/* Label */}
                  <text textAnchor="middle" y={isSel ? 22 : 18} fontSize="7" fill={color} opacity="0.8"
                    style={{ fontFamily: 'JetBrains Mono' }}
                  >
                    {uav.id.split('-').slice(-1)[0]}
                  </text>
                  {/* Health indicator */}
                  <text textAnchor="middle" y={isSel ? 32 : 27} fontSize="7" fill={color}>
                    ♥{uav.health.toFixed(0)}
                  </text>
                  {/* Selection ring */}
                  {isSel && <circle r="16" fill="none" stroke={color} strokeWidth="1" strokeDasharray="3,3"/>}
                </g>
              );
            })}

            {/* Flight path lines (decorative) */}
            {fleet.map((uav, i) => {
              if (i === 0) return null;
              const { x: x1, y: y1 } = toXY(fleet[i-1].lat, fleet[i-1].lon);
              const { x: x2, y: y2 } = toXY(uav.lat, uav.lon);
              return (
                <line key={`path-${i}`} x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="rgba(255,153,51,0.05)" strokeWidth="1" strokeDasharray="4,6"/>
              );
            })}
          </svg>
        </div>

        {/* UAV List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fleet.map(uav => {
            const color = STATUS_COLOR[uav.status];
            const isSel = selected === uav.id;
            return (
              <div
                key={uav.id}
                onClick={() => { setSelected(uav.id); if (onSelectUAV) onSelectUAV(uav); }}
                style={{
                  padding: '10px 12px',
                  background: isSel ? `var(--bg-glass)` : 'var(--bg-card)',
                  border: `1px solid ${isSel ? color : 'var(--border)'}`,
                  borderLeft: `3px solid ${color}`,
                  borderRadius: 8, cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color, fontFamily: 'JetBrains Mono' }}>
                    {uav.id}
                  </div>
                  <div style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: 'var(--bg-input)', color }}>
                    {uav.status.toUpperCase()}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>{uav.mission}</div>
                <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-4)' }}>
                    ♥ <b style={{ color }}>{uav.health.toFixed(0)}</b>
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-4)' }}>
                    ↑ {uav.alt.toFixed(0)}m
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-4)' }}>
                    ⚡ {uav.speed.toFixed(0)}km/h
                  </span>
                </div>

                {uav.status !== 'nominal' && (
                  <button
                    onClick={e => { e.stopPropagation(); if (onSelectUAV) onSelectUAV(uav); }}
                    style={{
                      marginTop: 6, width: '100%', padding: '4px',
                      background: 'var(--bg-input)', border: `1px solid ${color}`,
                      borderRadius: 4, color, fontSize: 9, fontWeight: 700,
                      cursor: 'pointer', letterSpacing: 0.5,
                    }}
                  >
                    ▶ INVESTIGATE ENGINE →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
