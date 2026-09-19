/**
 * Overview.jsx — LIVE OPERATIONS DASHBOARD (Clean Aerospace Light Theme)
 * ======================================================================
 */

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, TrendingUp, TrendingDown, Minus, ArrowRight, ShieldCheck, Box } from 'lucide-react'
import { useTelemetry } from '../context/TelemetryContext'
import { statusColor, trendColor } from '../lib/demoTelemetry'
import HealthGauge from '../components/HealthGauge'
import RULChart from '../components/RULChart'
import FaultAlerts from '../components/FaultAlerts'
import Panel from '../components/ui/Panel'

function SectionLabel({ children, action }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 10,
      marginBottom: 14,
      borderBottom: '1px solid #E2E8F0',
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        color: '#64748B',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
      }}>
        {children}
      </div>
      {action}
    </div>
  )
}

function MetricCard({ label, value, sub, color = '#0F172A', unit, bg = '#FFFFFF', border = '#E2E8F0' }) {
  return (
    <div style={{
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 6,
      padding: '18px 22px',
      flex: 1,
      minWidth: 0,
      boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.05)',
    }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: '#64748B',
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 32, fontWeight: 800, color, fontFamily: 'monospace', lineHeight: 1 }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 14, color: '#64748B', fontWeight: 600 }}>{unit}</span>}
      </div>
      {sub && (
        <div style={{ marginTop: 8, fontSize: 12, color: statusColor(sub), fontWeight: 700, letterSpacing: '0.04em' }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function SensorRow({ label, value, unit, status, trend }) {
  const sc = statusColor(status)
  const tc = trendColor(trend)
  const TrendIcon = trend === 'STABLE' || !trend ? Minus
                  : trend.startsWith('+')       ? TrendingUp
                  :                               TrendingDown
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto auto auto',
      alignItems: 'center',
      gap: 12,
      padding: '10px 0',
      borderBottom: '1px solid #F1F5F9',
    }}>
      <span style={{ fontSize: 13, color: '#0F172A', fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', fontFamily: 'monospace', minWidth: 80, textAlign: 'right' }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span style={{ fontSize: 12, color: '#64748B', minWidth: 32 }}>{unit}</span>
      <span style={{
        fontSize: 11, fontWeight: 700,
        color: sc, background: sc === '#39D98A' || sc === '#059669' ? '#ECFDF5' : '#FFFBEB',
        padding: '2px 8px', borderRadius: 4, minWidth: 64, textAlign: 'center',
      }}>
        {status}
      </span>
    </div>
  )
}

export default function Overview() {
  const navigate = useNavigate()
  const { telemetry, telemetryHistory, alerts, connected, healthIndex, missionId, globalRul } = useTelemetry()

  const healthScore = connected && healthIndex?.score != null ? healthIndex.score : 100
  const healthStatus = connected && healthIndex?.status ? healthIndex.status.toUpperCase() : 'NOMINAL'

  const latestAlert = alerts.length > 0 ? alerts[0] : null
  const displayRul = latestAlert?.rulHours ?? globalRul ?? 50.0

  const sensors = [
    { id: 'rpm', label: 'RPM', value: telemetry?.rpm, unit: 'rpm', status: 'NORMAL' },
    { id: 'egt', label: 'EGT', value: telemetry?.egt, unit: '°C', status: 'NORMAL' },
    { id: 'cht', label: 'CHT', value: telemetry?.cht, unit: '°C', status: 'NORMAL' },
    { id: 'oil_p', label: 'Oil Pressure', value: telemetry?.oilPressure, unit: 'kPa', status: 'NORMAL' },
    { id: 'oil_t', label: 'Oil Temp', value: telemetry?.oilTemp, unit: '°C', status: 'NORMAL' },
    { id: 'fuel', label: 'Fuel Flow', value: telemetry?.fuelFlow, unit: 'L/h', status: 'NORMAL' },
    { id: 'vib', label: 'Vibration', value: telemetry?.vibration, unit: 'g', status: 'NORMAL' },
    { id: 'map', label: 'MAP', value: telemetry?.map, unit: 'bar', status: 'NORMAL' },
  ].map(s => {
    // Dynamic status based on value presence
    if (s.value == null) {
      return { ...s, value: '—', status: 'WAITING' }
    }
    // Very basic dynamic limits for demo UI
    let status = 'NORMAL'
    if (s.id === 'rpm' && (s.value < 2000 || s.value > 6000)) status = 'WARNING'
    if (s.id === 'egt' && (s.value < 200 || s.value > 800)) status = 'WARNING'
    if (s.id === 'cht' && (s.value < 100 || s.value > 250)) status = 'WARNING'
    if (s.id === 'oil_p' && (s.value < 150 || s.value > 450)) status = 'WARNING'
    return { ...s, status }
  })

  const history = telemetryHistory.length > 0 ? telemetryHistory : []
  const displayAlerts = alerts

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ── TOP MISSION & PLATFORM HEADER ──────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: 11, fontWeight: 800, color: '#0284C7',
              background: '#EFF6FF', border: '1px solid #BFDBFE',
              padding: '2px 8px', borderRadius: 4, letterSpacing: '0.08em',
            }}>
              LIVE FLIGHT OPERATIONS
            </span>
            <span style={{ fontSize: 12, color: '#64748B', fontWeight: 500 }}>
              UAV Ground Control Station Workstation
            </span>
          </div>
          <h1 style={{
            margin: 0,
            fontSize: 26,
            fontWeight: 800,
            color: '#0F172A',
            letterSpacing: '-0.02em',
          }}>
            Mission Control Dashboard
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: '#475569' }}>
            Aircraft <strong>UAV-03</strong> · MISSION: <strong style={{ color: '#0284C7' }}>{missionId ? `MTN-${missionId.slice(-6).toUpperCase()}` : 'HOT & HIGH'}</strong> · <span style={{ color: connected ? '#059669' : '#DC2626' }}>● {connected ? 'CONNECTED' : 'DISCONNECTED'}</span>
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Security Status Widget (Flex) */}
          <div style={{
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 6,
            padding: '8px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldCheck size={14} color="#059669" />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#64748B', letterSpacing: '0.05em' }}>SECURE TELEMETRY ENCLAVE</span>
            </div>
            <div style={{ fontSize: 12, color: '#0F172A', fontWeight: 600 }}>AES-256 Encrypted Stream</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669', boxShadow: '0 0 4px #059669' }} />
              <span style={{ fontSize: 10, color: '#059669', fontWeight: 700 }}>EDGE PRE-PROCESSING ACTIVE</span>
            </div>
          </div>

          {/* Action Button: Jump to Digital Twin */}

        <button
          onClick={() => navigate('/digital-twin')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 18px',
            background: '#D97706',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(217, 119, 6, 0.25)',
          }}
        >
          <Box size={16} />
          OPEN 3D DIGITAL TWIN
          <ArrowRight size={16} />
        </button>
      </div>
      </div>

      {/* ── 4 TOP PRIMARY METRICS CARDS ────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        <MetricCard
          label="ENGINE HEALTH"
          value={`${healthScore.toFixed(0)}%`}
          color={healthScore >= 85 ? '#059669' : healthScore >= 50 ? '#D97706' : '#DC2626'}
        />
        <MetricCard
          label="RUL"
          value={displayRul.toFixed(1)}
          unit="hrs"
          color="#0284C7"
        />
        <MetricCard
          label="CURRENT STATUS"
          value={healthStatus}
          color={healthStatus === 'NOMINAL' ? '#059669' : healthStatus === 'WARNING' ? '#D97706' : '#DC2626'}
        />
        <MetricCard
          label="MISSION"
          value="ACTIVE"
          color="#059669"
        />
      </div>

      {/* ── ROW 2: HEALTH GAUGE, RUL CHART, FAULT ALERTS ───────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 1.3fr', gap: 16 }}>
        {/* Left: Health Gauge */}
        <HealthGauge
          telemetry={telemetry}
          score={healthScore}
          status={healthStatus}
          trend={healthScore >= 95 ? 'STABLE' : healthScore >= 80 ? '-0.5%' : '-2.1%'}
        />

        {/* Center: Live Sensor Trends Recharts */}
        <RULChart
          history={history}
          rulValue={displayRul}
          rulTrend={displayRul > 20 ? 'STABLE' : displayRul > 5 ? '-1.5 hrs/flt' : '-4.0 hrs/flt'}
        />

        {/* Right: Fault Alerts */}
        <FaultAlerts
          alerts={displayAlerts}
          onViewAll={() => navigate('/diagnostics')}
        />
      </div>

      {/* ── ROW 3: SENSOR TELEMETRY & SUBSYSTEM HEALTH ─────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}>
        {/* Sensor Telemetry List */}
        <Panel>
          <SectionLabel action={
            <span style={{ fontSize: 12, fontWeight: 600, color: '#059669' }}>
              8 CHANNELS NOMINAL
            </span>
          }>
            ENGINE TELEMETRY — 1 HZ LIVE STREAM
          </SectionLabel>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 24px' }}>
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

        {/* Subsystems Health Grid */}
        <Panel>
          <SectionLabel action={
            <span style={{ fontSize: 12, fontWeight: 600, color: '#0284C7' }}>
              PHYSICS CORRELATION
            </span>
          }>
            PROPULSION SUBSYSTEM INTEGRITY
          </SectionLabel>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { id: 'cyl1', label: 'Cylinder 1', health: telemetry ? Math.max(0, 100 - Math.abs(telemetry.cht - 240) / 10) : 100 },
              { id: 'cyl2', label: 'Cylinder 2', health: telemetry ? Math.max(0, 100 - Math.abs(telemetry.egt - 350) / 20) : 100 },
              { id: 'cyl3', label: 'Cylinder 3', health: telemetry ? Math.max(0, 100 - Math.abs(telemetry.rpm - 5000) / 200) : 100 },
              { id: 'cyl4', label: 'Cylinder 4', health: telemetry ? Math.max(0, 100 - Math.abs(telemetry.cht - 240) / 10) : 100 },
              { id: 'lube', label: 'Lubrication', health: telemetry ? Math.max(0, 100 - Math.abs(telemetry.oilPressure - 350) / 5) : 100 },
              { id: 'cool', label: 'Cooling', health: telemetry ? Math.max(0, 100 - Math.abs(telemetry.oilTemp - 120) / 2) : 100 },
              { id: 'turbo', label: 'Turbo', health: telemetry ? Math.max(0, 100 - Math.abs((telemetry.map || 1.2) - 1.2) * 50) : 100 },
              { id: 'vib', label: 'Vibration', health: telemetry ? Math.max(0, 100 - telemetry.vibration * 10) : 100 },
            ].map((sub) => {
              const h = Math.round(Math.min(100, Math.max(0, sub.health)));
              let status = 'HEALTHY';
              if (h < 85) status = 'MONITOR';
              if (h < 60) status = 'CRITICAL';
              return (
                <div
                  key={sub.id}
                  style={{
                    background: '#F8FAFC',
                    border: '1px solid #E2E8F0',
                    borderRadius: 6,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>{sub.label}</div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{h >= 95 ? 'STABLE' : 'CHANGING'}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, fontFamily: 'monospace', color: h >= 85 ? '#059669' : h >= 60 ? '#D97706' : '#DC2626' }}>
                      {h}%
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: h >= 85 ? '#059669' : h >= 60 ? '#D97706' : '#DC2626', textTransform: 'uppercase' }}>
                      {status}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  )
}
