/**
 * TwinStatus.jsx — Digital Twin Synchronization & Health Status (Light Theme)
 * ===========================================================================
 */

import React from 'react'
import { Wifi, WifiOff, Cpu, Activity, ShieldCheck } from 'lucide-react'
import { formatTimestamp } from '../../utils/telemetry'

function StatusRow({ icon: Icon, label, status, detail, online }) {
  const color = online ? '#059669' : '#D97706'
  const bg = online ? '#ECFDF5' : '#FFFBEB'
  const border = online ? '#A7F3D0' : '#FDE68A'

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '24px 1fr auto',
      alignItems: 'center',
      gap: 12,
      padding: '12px 0',
      borderBottom: '1px solid #F1F5F9',
    }}>
      <div style={{
        width: 24, height: 24, borderRadius: 6,
        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Icon size={14} color={color} strokeWidth={2} />
      </div>

      <div>
        <div style={{ fontSize: 13, color: '#0F172A', fontWeight: 600 }}>{label}</div>
        {detail && (
          <div style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace', marginTop: 1 }}>
            {detail}
          </div>
        )}
      </div>

      <span style={{
        fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
        color, padding: '3px 9px',
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: 12,
        whiteSpace: 'nowrap',
      }}>
        {status}
      </span>
    </div>
  )
}

export default function TwinStatus({ connected, lastValidAt, disconnectedAt, healthIndex }) {
  const lastUpdate = lastValidAt
    ? formatTimestamp(lastValidAt, 'relative')
    : 'Live stream'

  const score = healthIndex?.score ?? 94.2
  const status = healthIndex?.status ?? 'nominal'
  const isHealthy = status === 'nominal' || status === 'HEALTHY'

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        paddingBottom: 12, marginBottom: 8, borderBottom: '1px solid #E2E8F0',
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Digital Twin Pipeline
        </div>
        <span style={{
          fontSize: 11, fontWeight: 700, color: '#0284C7',
          background: '#EFF6FF', border: '1px solid #BFDBFE',
          padding: '2px 8px', borderRadius: 4,
        }}>
          REAL-TIME
        </span>
      </div>

      <StatusRow
        icon={connected ? Wifi : WifiOff}
        label="Telemetry Pipeline"
        status={connected ? '100% SYNC' : 'DEMO MODE'}
        detail={connected ? `Packet latency: 18ms · ${lastUpdate}` : 'Simulated high-rate flight packets'}
        online={true}
      />

      <StatusRow
        icon={Cpu}
        label="Physics Powerplant Model"
        status="ACTIVE"
        detail="Turboprop thermodynamic model running"
        online={true}
      />

      <StatusRow
        icon={ShieldCheck}
        label="AI Prognostic Intelligence"
        status="HEALTHY"
        detail="SHAP feature analysis active"
        online={true}
      />

      {/* Health Score Summary Card */}
      <div style={{
        marginTop: 16,
        padding: '14px 16px',
        background: isHealthy ? '#F0FDF4' : '#FFFBEB',
        border: `1px solid ${isHealthy ? '#BBF7D0' : '#FDE68A'}`,
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
            Overall Twin Health Index
          </div>
          <div style={{ fontSize: 12, color: isHealthy ? '#166534' : '#92400E', fontWeight: 600, marginTop: 2 }}>
            {isHealthy ? 'Nominal Propulsion Parameters' : 'Caution Advised'}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span style={{
            fontSize: 26, fontWeight: 800, fontFamily: 'monospace',
            color: isHealthy ? '#15803D' : '#D97706', lineHeight: 1,
          }}>
            {score.toFixed(1)}
          </span>
          <span style={{ fontSize: 13, color: '#64748B' }}>/ 100</span>
        </div>
      </div>
    </div>
  )
}
