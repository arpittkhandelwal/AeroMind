/**
 * HealthGauge.jsx — Clean Light Aerospace Health Gauge
 * =====================================================
 * Circular health gauge showing engine health index (0–100).
 */

import React from 'react'

const STATUS_COLORS = {
  nominal:  '#059669',
  degraded: '#D97706',
  critical: '#DC2626',
  healthy:  '#059669',
  monitor:  '#D97706',
}

export default function HealthGauge({ telemetry, score = 94.2, status = 'nominal', trend = '+0.8%', compact = false }) {
  const color = STATUS_COLORS[status?.toLowerCase()] ?? '#059669'

  // Half-circle arc
  const pct = Math.max(0, Math.min(100, score)) / 100
  const r = 70
  const cx = 95
  const cy = 95
  const startAngle = -Math.PI
  const endAngle   = 0
  const angle = startAngle + pct * (endAngle - startAngle)
  const x1 = cx + r * Math.cos(startAngle)
  const y1 = cy + r * Math.sin(startAngle)
  const x2 = cx + r * Math.cos(angle)
  const y2 = cy + r * Math.sin(angle)
  const largeArc = pct > 0.5 ? 1 : 0

  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: 6,
      padding: 22,
      boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.05)',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: '#64748B',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}>
          ENGINE HEALTH INDEX
        </div>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: '#059669',
          background: '#ECFDF5',
          border: '1px solid #A7F3D0',
          padding: '2px 8px',
          borderRadius: 12,
        }}>
          {trend || 'STABLE'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: 'auto 0' }}>
        <svg width="190" height="110" viewBox="0 0 190 110">
          {/* Background Track Arc */}
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="#E2E8F0"
            strokeWidth="14"
            strokeLinecap="round"
          />
          {/* Foreground Progress Arc */}
          {pct > 0 && (
            <path
              d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
              fill="none"
              stroke={color}
              strokeWidth="14"
              strokeLinecap="round"
            />
          )}
          {/* Main Score Value */}
          <text
            x={cx}
            y={cy - 8}
            textAnchor="middle"
            fill="#0F172A"
            fontSize="32"
            fontWeight="800"
            fontFamily="monospace"
          >
            {Math.round(score)}%
          </text>
          <text
            x={cx}
            y={cy + 14}
            textAnchor="middle"
            fill="#64748B"
            fontSize="12"
            fontWeight="600"
          >
            PROGNOSIS SCORE
          </text>
        </svg>

        {/* Status Badge */}
        <div style={{ marginTop: 12, textAlign: 'center' }}>
          <span style={{
            fontSize: 12,
            fontWeight: 800,
            color,
            background: color === '#059669' ? '#ECFDF5' : '#FFFBEB',
            border: `1px solid ${color === '#059669' ? '#A7F3D0' : '#FDE68A'}`,
            padding: '4px 16px',
            borderRadius: 16,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            {status}
          </span>
        </div>
      </div>
    </div>
  )
}
