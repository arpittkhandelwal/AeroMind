/**
 * Settings.jsx — System configuration  (route: /settings)
 * =========================================================
 * Backend connection settings, alert thresholds, display preferences.
 */

import React from 'react'
import { Settings as SettingsIcon } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import { API_URL } from '../lib/config'

function SettingRow({ label, value, note }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0', borderBottom: '1px solid #0D1A22', gap: 16,
    }}>
      <div>
        <div style={{ fontSize: 11, color: '#E8EEF0', fontWeight: 500 }}>{label}</div>
        {note && <div style={{ fontSize: 9, color: '#4A6270', marginTop: 1 }}>{note}</div>}
      </div>
      <span style={{
        fontSize: 11, color: '#55C7E8', fontFamily: 'monospace',
        background: '#071014', border: '1px solid #172830',
        padding: '3px 8px', borderRadius: 3, whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 9, fontWeight: 700, color: '#4A6270',
      letterSpacing: '0.14em', textTransform: 'uppercase',
      paddingBottom: 10, borderBottom: '1px solid #20343C', marginBottom: 4,
    }}>
      {children}
    </div>
  )
}

export default function Settings() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader
        icon={SettingsIcon}
        title="Settings"
        subtitle="System configuration · connection endpoints · display preferences"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Connection settings */}
        <Panel>
          <SectionTitle>Connection</SectionTitle>
          <SettingRow label="Backend API URL"  value={API_URL}  note="VITE_API_URL env var" />
          <SettingRow label="WebSocket URL"    value={WS_URL}   note="VITE_WS_URL env var" />
          <SettingRow label="Health Poll Rate" value="10 s"     note="REST /api/alerts/health-index" />
          <SettingRow label="WS Reconnect"     value="3 000 ms" note="Auto-reconnect delay" />
          <SettingRow label="Telemetry Buffer" value="120 pts"  note="~2 min ring buffer" />
        </Panel>

        {/* Aircraft / mission */}
        <Panel>
          <SectionTitle>Aircraft / Mission</SectionTitle>
          <SettingRow label="Aircraft ID"   value="UAV-07"    note="Read-only in Phase 1" />
          <SettingRow label="Engine"        value="ENGINE-A"  note="MALE UAV Aero Piston" />
          <SettingRow label="Active Mission"value="MTN-2047"  note="Read-only in Phase 1" />
          <SettingRow label="Timezone"      value="UTC"       note="All timestamps in UTC" />
        </Panel>

        {/* Alert thresholds */}
        <Panel>
          <SectionTitle>Alert Thresholds (Read-only · Phase 2)</SectionTitle>
          <SettingRow label="High Confidence Fault"   value="≥ 0.85" note="→ CRITICAL severity" />
          <SettingRow label="Medium Confidence Fault" value="≥ 0.60" note="→ WARNING severity" />
          <SettingRow label="Health Index — Nominal"  value="≥ 80"   note="" />
          <SettingRow label="Health Index — Degraded" value="50 – 79" note="" />
          <SettingRow label="Health Index — Critical"  value="< 50"   note="" />
          <SettingRow label="Alert History Limit"      value="50"     note="Most recent alerts" />
        </Panel>

        {/* UI preferences */}
        <Panel>
          <SectionTitle>Display (Phase 2)</SectionTitle>
          <SettingRow label="Theme"          value="Dark"             note="Light mode in Phase 2" />
          <SettingRow label="Chart Update"   value="Real-time"        note="" />
          <SettingRow label="Date Format"    value="ISO 8601"         note="" />
          <SettingRow label="Sidebar State"  value="Persisted"        note="localStorage dt-sidebar-collapsed" />
          <div style={{ marginTop: 12, fontSize: 9, color: '#4A6270', letterSpacing: '0.06em' }}>
            Editable configuration UI planned for Phase 2.
          </div>
        </Panel>
      </div>
    </div>
  )
}
