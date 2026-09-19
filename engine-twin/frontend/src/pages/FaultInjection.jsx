/**
 * FaultInjection.jsx — Manual fault injection  (route: /fault-injection)
 * ========================================================================
 * Fire targeted fault scenarios against the running simulator or
 * directly into the ML inference pipeline for testing.
 */

import React from 'react'
import { Zap, AlertTriangle } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import PlaceholderContent from '../components/ui/PlaceholderContent'

const FAULT_TYPES = [
  { id: 'misfire',      label: 'MISFIRE',       severity: 'WARNING',  color: '#F2B84B' },
  { id: 'injector',     label: 'INJECTOR FAIL', severity: 'CRITICAL', color: '#FF5C5C' },
  { id: 'lubrication',  label: 'LUBRICATION',   severity: 'CRITICAL', color: '#FF5C5C' },
  { id: 'sensor_drift', label: 'SENSOR DRIFT',  severity: 'WARNING',  color: '#F2B84B' },
  { id: 'combustion',   label: 'COMBUSTION',    severity: 'CRITICAL', color: '#FF5C5C' },
  { id: 'overheating',  label: 'OVERHEATING',   severity: 'CRITICAL', color: '#FF5C5C' },
]

export default function FaultInjection() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader
        icon={Zap}
        title="Fault Injection"
        subtitle="Manual fault scenarios · ML pipeline testing · alert verification"
        badge="PHASE 2"
        badgeColor="#8FA1A9"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Fault trigger panel */}
        <Panel>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#4A6270',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            paddingBottom: 10, borderBottom: '1px solid #20343C', marginBottom: 12,
          }}>
            Inject Fault
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {FAULT_TYPES.map(ft => (
              <button key={ft.id} disabled style={{
                padding: '10px 8px',
                background: `${ft.color}0A`,
                border: `1px solid ${ft.color}33`,
                borderRadius: 3,
                cursor: 'not-allowed',
                opacity: 0.45,
                textAlign: 'left',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: ft.color, letterSpacing: '0.08em' }}>{ft.label}</div>
                <div style={{ fontSize: 8, color: '#4A6270', letterSpacing: '0.1em', marginTop: 2 }}>{ft.severity}</div>
              </button>
            ))}
          </div>
          <div style={{ marginTop: 12, fontSize: 9, color: '#4A6270', letterSpacing: '0.06em', textAlign: 'center' }}>
            Controls enabled in Phase 2 · requires simulator running
          </div>
        </Panel>

        {/* Injection log */}
        <Panel>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#4A6270',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            paddingBottom: 10, borderBottom: '1px solid #20343C',
          }}>
            Injection Log
          </div>
          <PlaceholderContent
            icon={AlertTriangle}
            moduleId="FI-LOG-01"
            label="Fault Injection History"
            phase="Phase 2"
            height={280}
          />
        </Panel>
      </div>
    </div>
  )
}
