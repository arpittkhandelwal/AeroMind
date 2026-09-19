/**
 * LiveMonitor.jsx — LIVE STREAM TELEMETRY MONITOR (Light Aerospace Theme)
 * =======================================================================
 */

import React from 'react'
import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, Minus, Box, ShieldCheck } from 'lucide-react'
import { useTelemetry } from '../context/TelemetryContext'
import { DEMO, statusColor, trendColor } from '../lib/demoTelemetry'
import HealthGauge from '../components/HealthGauge'
import RULChart from '../components/RULChart'
import FaultAlerts from '../components/FaultAlerts'
import Panel from '../components/ui/Panel'

function SensorRow({ label, value, unit, status, trend }) {
  const sc = statusColor(status)
  const TrendIcon = trend === 'STABLE' || !trend ? Minus
                  : trend.startsWith('+')       ? TrendingUp
                  :                               TrendingDown
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1.4fr 1fr auto auto',
      alignItems: 'center',
      gap: 14,
      padding: '12px 0',
      borderBottom: '1px solid #F1F5F9',
    }}>
      <span style={{ fontSize: 14, color: '#0F172A', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', fontFamily: 'monospace', textAlign: 'right' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span style={{ fontSize: 13, color: '#64748B', minWidth: 36 }}>{unit}</span>
      <span style={{
        fontSize: 11, fontWeight: 700,
        color: sc, background: sc === '#39D98A' || sc === '#059669' ? '#ECFDF5' : '#FFFBEB',
        padding: '3px 10px', borderRadius: 4, minWidth: 70, textAlign: 'center',
      }}>
        {status}
      </span>
    </div>
  )
}

export default function LiveMonitor() {
  const navigate = useNavigate()
  const { telemetry, telemetryHistory, alerts, connected, healthIndex } = useTelemetry()

  const healthScore = connected && healthIndex?.score != null ? healthIndex.score : DEMO.engineHealth.score
  const healthStatus = connected && healthIndex?.status ? healthIndex.status.toUpperCase() : DEMO.engineHealth.status

  const latestAlert = alerts.length > 0 ? alerts[0] : null
  const displayRul = latestAlert?.rul_hours ?? DEMO.rul.value

  const sensors = DEMO.sensors.map((s) => {
    if (!telemetry) return s
    const valMap = {
      rpm:      telemetry.rpm,
      egt:      telemetry.egt,
      cht:      telemetry.cht,
      oil_p:    telemetry.oilPressure,
      oil_t:    telemetry.oilTemp,
      fuel:     telemetry.fuelFlow,
      vib:      telemetry.vibration,
      map:      telemetry.map,
    }
    const liveVal = valMap[s.id]
    return liveVal != null ? { ...s, value: liveVal } : s
  })

  const history = telemetryHistory.length > 0 ? telemetryHistory : DEMO.rulHistory
  const displayAlerts = alerts.length > 0 ? alerts : DEMO.alerts

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#0284C7', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            LIVE ENGINE TELEMETRY FEED
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0F172A' }}>
            Live Telemetry & Flight Health Monitor
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#475569' }}>
            Live avionics &amp; engine telemetry from <strong>UAV-07 (TAPAS-BH-201)</strong> via 1 Hz polling
          </p>
        </div>

        <button
          onClick={() => navigate('/digital-twin')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', background: '#D97706', color: '#FFFFFF',
            border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}
        >
          <Box size={16} />
          VIEW 3D DIGITAL TWIN
        </button>
      </div>

      {/* Row 1: Health Gauge + Recharts Sensor Trends */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: 16 }}>
        <HealthGauge
          telemetry={telemetry}
          score={healthScore}
          status={healthStatus}
          trend={DEMO.engineHealth.trend}
        />
        <RULChart
          history={history}
          rulValue={displayRul}
          rulTrend={DEMO.rul.trend}
        />
      </div>

      {/* Row 2: Detailed Sensor Stream Table + Fault Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr', gap: 16 }}>
        <Panel>
          <div style={{
            fontSize: 13, fontWeight: 700, color: '#0F172A', textTransform: 'uppercase',
            paddingBottom: 12, marginBottom: 14, borderBottom: '1px solid #E2E8F0',
          }}>
            Live Sensor Data (~1 Hz polling via REST)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 32px' }}>
            {sensors.map((s) => (
              <SensorRow
                key={s.id}
                label={s.label}
                value={s.value}
                unit={s.unit}
                status={s.status}
                trend={s.trend}
              />
            ))}
          </div>
        </Panel>

        <FaultAlerts
          alerts={displayAlerts}
          onViewAll={() => navigate('/diagnostics')}
        />
      </div>
    </div>
  )
}
