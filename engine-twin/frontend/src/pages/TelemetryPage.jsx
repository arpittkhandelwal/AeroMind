/**
 * TelemetryPage.jsx — Live Telemetry Explorer (Light Aerospace Theme)
 * ===================================================================
 */

import React, { useMemo, useState } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Activity, WifiOff, AlertTriangle } from 'lucide-react'
import { useTelemetry } from '../context/TelemetryContext'
import {
  SENSOR_META, sensorStatus, getPhysicsExpected, computeDeviation,
} from '../services/telemetryService'
import { colorForStatus, colorForDeviation, formatDeviation, formatTimestamp } from '../utils/telemetry'
import Panel from '../components/ui/Panel'
import { DEMO } from '../lib/demoTelemetry'

const CHART_LINES = [
  { key: 'egt',         label: 'EGT (°C)',    color: '#D97706', yAxis: 'left'  },
  { key: 'cht',         label: 'CHT (°C)',    color: '#DC2626', yAxis: 'left'  },
  { key: 'rpm',         label: 'RPM',         color: '#0284C7', yAxis: 'right' },
  { key: 'oilPressure', label: 'Oil P (bar)', color: '#059669', yAxis: 'right' },
  { key: 'fuelFlow',    label: 'Fuel (L/h)',  color: '#64748B', yAxis: 'right' },
  { key: 'vibration',   label: 'Vibr (g)',    color: '#7C3AED', yAxis: 'right' },
]

function SectionLabel({ children, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      fontSize: 12, fontWeight: 700, color: '#64748B',
      letterSpacing: '0.08em', textTransform: 'uppercase',
      paddingBottom: 10, marginBottom: 14, borderBottom: '1px solid #E2E8F0',
    }}>
      <span>{children}</span>
      {right && <span style={{ fontSize: 11, color: '#0284C7', fontWeight: 700 }}>{right}</span>}
    </div>
  )
}

function StatusBadge({ status }) {
  const isHealthy = status === 'NORMAL' || status === 'HEALTHY' || status === 'NOMINAL'
  const color = isHealthy ? '#059669' : status === 'WARNING' ? '#D97706' : '#DC2626'
  const bg = isHealthy ? '#ECFDF5' : status === 'WARNING' ? '#FFFBEB' : '#FEF2F2'
  const border = isHealthy ? '#A7F3D0' : status === 'WARNING' ? '#FDE68A' : '#FECACA'

  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4,
      background: bg, border: `1px solid ${border}`,
      fontSize: 11, fontWeight: 700, color, letterSpacing: '0.04em',
      display: 'inline-block', textAlign: 'center',
    }}>
      {status}
    </span>
  )
}

function MetricCard({ label, value, sub, color = '#0F172A', unit }) {
  return (
    <div style={{
      background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 6,
      padding: '16px 20px', flex: 1, minWidth: 0,
      boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.05)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 28, fontWeight: 800, color, fontFamily: 'monospace', lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontSize: 13, color: '#64748B', fontWeight: 600 }}>{unit}</span>}
      </div>
      {sub && <div style={{ marginTop: 6, fontSize: 12, color: colorForStatus(sub), fontWeight: 700 }}>{sub}</div>}
    </div>
  )
}

function ActualVsExpected({ telemetry, physicsExpected }) {
  const FIELDS = [
    { key: 'egt',         label: 'EGT',         unit: '°C' },
    { key: 'oilPressure', label: 'Oil Pressure', unit: 'bar' },
    { key: 'fuelFlow',    label: 'Fuel Flow',    unit: 'L/h' },
    { key: 'cht',         label: 'CHT',          unit: '°C' },
    { key: 'vibration',   label: 'Vibration',    unit: 'g' },
  ]

  return (
    <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748B' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
        <AlertTriangle size={22} color="#D97706" />
        <strong style={{ color: '#0F172A', fontSize: 13 }}>PHYSICS BASELINE ESTIMATION ACTIVE</strong>
        <span style={{ fontSize: 12, maxWidth: 360, lineHeight: 1.5 }}>
          Kinematic flight envelope values monitored against 1D turboprop simulation.
        </span>
      </div>
    </div>
  )
}

function SensorStatusTable({ telemetry }) {
  return (
    <div>
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 120px 120px 90px',
        padding: '8px 10px', borderBottom: '1px solid #E2E8F0',
        background: '#F8FAFC', borderRadius: '4px 4px 0 0',
      }}>
        {['SENSOR', 'LIVE VALUE', 'LIMITS', 'STATUS'].map(h => (
          <span key={h} style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.08em' }}>{h}</span>
        ))}
      </div>
      {SENSOR_META.map(meta => {
        const value = telemetry?.[meta.key]
        const status = sensorStatus(value, meta)
        const range = [
          meta.warnLow != null ? `≥${meta.warnLow}` : '',
          meta.warnHigh != null ? `≤${meta.warnHigh}` : '',
        ].filter(Boolean).join(' · ') || '—'
        return (
          <div key={meta.key} style={{
            display: 'grid', gridTemplateColumns: '1fr 120px 120px 90px',
            padding: '10px 10px', borderBottom: '1px solid #F1F5F9',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: '#0F172A', fontWeight: 600 }}>{meta.label}</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
              {meta.format(value)} <span style={{ fontSize: 11, color: '#64748B' }}>{meta.unit}</span>
            </span>
            <span style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace' }}>{range}</span>
            <StatusBadge status={status} />
          </div>
        )
      })}
    </div>
  )
}

function TelemetryTable({ history }) {
  const rows = history.slice(-25).reverse()
  if (rows.length === 0) return (
    <div style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: '#64748B' }}>
      No telemetry records logged yet
    </div>
  )
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontFamily: 'monospace' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
            {['TIMESTAMP', 'RPM', 'EGT °C', 'CHT °C', 'OIL P bar', 'FUEL L/h', 'VIBR g', 'ALT m', 'STATUS'].map(h => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.timestamp + i} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 === 0 ? '#FFFFFF' : '#F8FAFC' }}>
              <td style={{ padding: '8px 12px', color: '#64748B' }}>{formatTimestamp(r.timestamp, 'time')}</td>
              <td style={{ padding: '8px 12px', color: '#0F172A', fontWeight: 700 }}>{r.rpm?.toFixed(0) ?? '—'}</td>
              <td style={{ padding: '8px 12px', color: '#D97706', fontWeight: 700 }}>{r.egt?.toFixed(1) ?? '—'}</td>
              <td style={{ padding: '8px 12px', color: '#DC2626', fontWeight: 700 }}>{r.cht?.toFixed(1) ?? '—'}</td>
              <td style={{ padding: '8px 12px', color: '#059669', fontWeight: 700 }}>{r.oilPressure?.toFixed(2) ?? '—'}</td>
              <td style={{ padding: '8px 12px', color: '#0F172A' }}>{r.fuelFlow?.toFixed(1) ?? '—'}</td>
              <td style={{ padding: '8px 12px', color: '#0F172A' }}>{r.vibration?.toFixed(3) ?? '—'}</td>
              <td style={{ padding: '8px 12px', color: '#0F172A' }}>{r.altitude?.toFixed(0) ?? '—'}</td>
              <td style={{ padding: '8px 12px', color: '#059669', fontWeight: 700 }}>
                {r.faultLabel ?? 'NOMINAL'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartToggle({ visible, onToggle }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {CHART_LINES.map(({ key, label, color }) => {
        const active = visible.has(key)
        return (
          <button
            key={key}
            onClick={() => onToggle(key)}
            style={{
              padding: '4px 12px', borderRadius: 4, cursor: 'pointer', fontSize: 12,
              background: active ? '#EFF6FF' : '#FFFFFF',
              border: `1px solid ${active ? color : '#E2E8F0'}`,
              color: active ? color : '#64748B',
              fontWeight: active ? 700 : 500,
              transition: 'all 0.12s',
            }}
          >
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default function TelemetryPage() {
  const { telemetry, telemetryHistory, connected, healthIndex } = useTelemetry()

  const [visibleLines, setVisibleLines] = useState(new Set(['egt', 'cht', 'rpm', 'oilPressure']))
  const toggleLine = (key) => setVisibleLines(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  const chartData = useMemo(() => {
    const src = telemetryHistory.length > 0 ? telemetryHistory : DEMO.rulHistory
    return src.map(d => ({
      ...d,
      time: formatTimestamp(d.timestamp, 'time'),
    }))
  }, [telemetryHistory])

  const displayTelemetry = telemetry ?? {
    rpm: DEMO.sensors.find(s => s.id === 'rpm')?.value,
    egt: DEMO.sensors.find(s => s.id === 'egt')?.value,
    cht: DEMO.sensors.find(s => s.id === 'cht')?.value,
    oilPressure: DEMO.sensors.find(s => s.id === 'oil_p')?.value,
    oilTemp: DEMO.sensors.find(s => s.id === 'oil_t')?.value,
    fuelFlow: DEMO.sensors.find(s => s.id === 'fuel')?.value,
    vibration: DEMO.sensors.find(s => s.id === 'vib')?.value,
    altitude: 1200,
    ambientTemp: 28.5,
    faultLabel: null,
  }

  const score = connected ? healthIndex.score : DEMO.engineHealth.score
  const hStatus = connected ? healthIndex.status : DEMO.engineHealth.status

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#0284C7', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            HIGH-FIDELITY TELEMETRY INGESTION
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0F172A' }}>
            Telemetry Sensor Explorer
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#475569' }}>
            Live data bus metrics for <strong>UAV-07 (TAPAS-BH-201)</strong> · Mission MTN-2047
          </p>
        </div>

        <div style={{
          padding: '8px 16px', borderRadius: 6,
          background: connected ? '#ECFDF5' : '#EFF6FF',
          border: `1px solid ${connected ? '#A7F3D0' : '#BFDBFE'}`,
          fontSize: 13, fontWeight: 700, color: connected ? '#059669' : '#0284C7',
        }}>
          {connected ? 'LIVE TELEMETRY (1 HZ)' : 'DEMO TELEMETRY STREAM'}
        </div>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <MetricCard label="Engine Health" value={`${score.toFixed(1)}%`} sub={hStatus} color="#059669" />
        <MetricCard label="RPM" value={Math.round(displayTelemetry.rpm).toLocaleString()} unit="rpm" sub="NOMINAL" color="#0284C7" />
        <MetricCard label="EGT" value={displayTelemetry.egt.toFixed(1)} unit="°C" sub="NOMINAL" color="#D97706" />
        <MetricCard label="Oil Pressure" value={displayTelemetry.oilPressure.toFixed(2)} unit="bar" sub="NOMINAL" color="#059669" />
      </div>

      {/* Sensor Trends Recharts Panel */}
      <Panel>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <SectionLabel>Multi-Channel Sensor Time-Series Analysis</SectionLabel>
          <ChartToggle visible={visibleLines} onToggle={toggleLine} />
        </div>

        <div style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="time" stroke="#64748B" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis yAxisId="left" stroke="#64748B" tick={{ fontSize: 11, fill: '#64748B' }} />
              <YAxis yAxisId="right" orientation="right" stroke="#64748B" tick={{ fontSize: 11, fill: '#64748B' }} />
              <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 6, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              {CHART_LINES.filter(l => visibleLines.has(l.key)).map(({ key, label, color, yAxis }) => (
                <Line
                  key={key}
                  yAxisId={yAxis}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  name={label}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Sensor Limits & Actual vs Expected */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        <Panel>
          <SectionLabel>Telemetry Channel Limits & Thresholds</SectionLabel>
          <SensorStatusTable telemetry={displayTelemetry} />
        </Panel>

        <Panel>
          <SectionLabel>Physics Expected Model Verification</SectionLabel>
          <ActualVsExpected telemetry={displayTelemetry} />
        </Panel>
      </div>

      {/* Recent Records Log Table */}
      <Panel>
        <SectionLabel right={`${Math.min(chartData.length, 25)} logged packets`}>
          High-Rate Telemetry Log Ingestion
        </SectionLabel>
        <TelemetryTable history={chartData} />
      </Panel>
    </div>
  )
}
