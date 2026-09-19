/**
 * RULChart.jsx — Sensor Trends and RUL Forecast (Light Theme)
 * ============================================================
 */

import React from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

const SENSOR_LINES = [
  { key: 'rpm',       color: '#0284C7', name: 'RPM',       yAxis: 'right' },
  { key: 'egt',       color: '#D97706', name: 'EGT (°C)',  yAxis: 'left'  },
  { key: 'cht',       color: '#DC2626', name: 'CHT (°C)',  yAxis: 'left'  },
  { key: 'vibration', color: '#059669', name: 'Vibration', yAxis: 'right' },
]

function formatTime(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function RULChart({ history = [], rulValue = 21.4, rulTrend = 'STABLE' }) {
  const data = history.map((d) => ({
    ...d,
    time: formatTime(d.timestamp),
  }))

  const latestRul = history.length > 0 ? history[history.length - 1]?.rul_hours : null
  const displayRul = latestRul ?? rulValue

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
      {/* Header with RUL Forecast */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        paddingBottom: 12,
        borderBottom: '1px solid #F1F5F9',
      }}>
        <div>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#64748B',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            LIVE MULTI-CHANNEL SENSOR TRENDS
          </div>
          <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
            Correlated real-time flight telemetry
          </div>
        </div>

        {/* Inline RUL Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          padding: '6px 14px',
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: 6,
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1E40AF', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            RUL ESTIMATE
          </span>
          <span style={{ fontSize: 24, fontWeight: 800, color: '#0284C7', fontFamily: 'monospace', lineHeight: 1 }}>
            {displayRul != null ? displayRul.toFixed(1) : '—'}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>hrs</span>
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#059669',
            background: '#ECFDF5', padding: '1px 6px', borderRadius: 4,
          }}>
            {rulTrend || 'STABLE'}
          </span>
        </div>
      </div>

      {/* Recharts Line Chart */}
      <div style={{ flex: 1, minHeight: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="time"
              stroke="#64748B"
              tick={{ fontSize: 11, fill: '#64748B' }}
              tickLine={false}
              axisLine={{ stroke: '#E2E8F0' }}
            />
            <YAxis
              yAxisId="left"
              stroke="#64748B"
              tick={{ fontSize: 11, fill: '#64748B' }}
              tickLine={false}
              axisLine={{ stroke: '#E2E8F0' }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#64748B"
              tick={{ fontSize: 11, fill: '#64748B' }}
              tickLine={false}
              axisLine={{ stroke: '#E2E8F0' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: 6,
                boxShadow: '0 4px 12px rgba(15, 23, 42, 0.1)',
                fontSize: 12,
                color: '#0F172A',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 12, paddingTop: 10 }}
              iconType="circle"
            />
            {SENSOR_LINES.map((l) => (
              <Line
                key={l.key}
                type="monotone"
                dataKey={l.key}
                name={l.name}
                stroke={l.color}
                strokeWidth={2}
                dot={false}
                yAxisId={l.yAxis}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
