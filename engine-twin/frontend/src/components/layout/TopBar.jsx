/**
 * TopBar.jsx — ENGINE-TWIN application top bar
 * Fixed: shows real missionId, real connection state with animated loading,
 *        and live data from TelemetryContext
 */

import React, { useState, useEffect } from 'react'
import { Menu, Bell } from 'lucide-react'
import { useTelemetry } from '../../context/TelemetryContext'

function useUTCClock() {
  const [time, setTime] = useState('')
  useEffect(() => {
    const tick = () => {
      const n = new Date()
      setTime([n.getUTCHours(), n.getUTCMinutes(), n.getUTCSeconds()]
        .map(v => String(v).padStart(2, '0')).join(':'))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return time
}

// Pulsing dot for loading state
function PulseDot({ color, pulse }) {
  return (
    <span style={{
      width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
      background: color,
      boxShadow: pulse ? `0 0 6px ${color}80` : 'none',
      animation: pulse === 'blink' ? 'topbar-blink 1s ease-in-out infinite' : 'none',
    }} />
  )
}

function StatusPill({ label, value, state }) {
  // state: 'online' | 'offline' | 'loading'
  const cfg = {
    online:  { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', pulse: true },
    offline: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', pulse: false },
    loading: { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', pulse: 'blink' },
  }
  const { color, bg, border, pulse } = cfg[state] || cfg.loading

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '0 16px', borderRight: '1px solid #E2E8F0', height: '100%',
    }}>
      <PulseDot color={color} pulse={pulse} />
      <span style={{ fontSize: 11, color: '#64748B', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>
        {label}
      </span>
      <span style={{
        fontSize: 11, fontWeight: 700, color,
        background: bg, border: `1px solid ${border}`,
        padding: '2px 8px', borderRadius: 12, whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
    </div>
  )
}

export default function TopBar({ collapsed, onToggleSidebar }) {
  const { connected, alerts, missionId, lastValidAt, disconnectedAt } = useTelemetry()
  const utcTime = useUTCClock()
  const alertCount = alerts.length

  // Determine connection state: loading (never connected), online, offline (was connected then lost)
  const [everConnected, setEverConnected] = useState(false)
  useEffect(() => {
    if (connected) setEverConnected(true)
  }, [connected])

  const telemetryState = connected ? 'online' : everConnected ? 'offline' : 'loading'
  const telemetryValue = connected ? 'LIVE' : everConnected ? 'OFFLINE' : 'CONNECTING…'
  const streamState    = connected ? 'online' : everConnected ? 'offline' : 'loading'
  const streamValue    = connected ? 'ACTIVE' : everConnected ? 'LOST' : 'STARTING…'

  // Format mission ID nicely
  const displayMissionId = missionId
    ? `MTN-${missionId.slice(-6).toUpperCase()}`
    : 'MTN-----'

  return (
    <>
      <style>{`
        @keyframes topbar-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
      <header style={{
        height: 56, minHeight: 56,
        background: '#FFFFFF',
        borderBottom: '1px solid #E2E8F0',
        boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.05)',
        display: 'flex', alignItems: 'stretch',
        flexShrink: 0, zIndex: 200, userSelect: 'none',
      }}>
        {/* Brand & Toggle */}
        <div style={{
          width: collapsed ? 64 : 240, flexShrink: 0,
          display: 'flex', alignItems: 'center',
          borderRight: '1px solid #E2E8F0',
          transition: 'width 0.2s ease', overflow: 'hidden',
        }}>
          <button
            onClick={onToggleSidebar}
            style={{
              width: 56, minWidth: 56, height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: '#64748B', flexShrink: 0, transition: 'color 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#0F172A')}
            onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Menu size={20} />
          </button>
          {!collapsed && (
            <div style={{ paddingRight: 14, overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A', letterSpacing: '0.08em', lineHeight: 1.2 }}>
                  ENGINE<span style={{ color: '#D97706' }}>TWIN</span>
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#0284C7', background: '#E0F2FE', padding: '1px 6px', borderRadius: 4 }}>
                  UAV GCS
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#64748B', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 500 }}>
                Propulsion Intelligence
              </div>
            </div>
          )}
        </div>

        {/* Aircraft & Mission Badges */}
        <div style={{ display: 'flex', alignItems: 'center', borderRight: '1px solid #E2E8F0', background: '#F8FAFC' }}>
          <div style={{ padding: '0 18px' }}>
            <div style={{ fontSize: 10, color: '#64748B', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>PLATFORM</div>
            <div style={{ fontSize: 13, color: '#0F172A', fontWeight: 700, fontFamily: 'monospace' }}>
              TAPAS-BH-201 <span style={{ color: '#D97706', fontWeight: 600 }}>(UAV-07)</span>
            </div>
          </div>
          <div style={{ width: 1, height: 28, background: '#E2E8F0' }} />
          <div style={{ padding: '0 18px' }}>
            <div style={{ fontSize: 10, color: '#64748B', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>MISSION</div>
            <div style={{ fontSize: 13, color: '#0F172A', fontWeight: 700, fontFamily: 'monospace' }}>
              {displayMissionId}
            </div>
          </div>
        </div>

        {/* Status Pills */}
        <div style={{ display: 'flex', alignItems: 'stretch', flex: 1, overflowX: 'auto', overflowY: 'hidden' }}>
          <StatusPill label="Telemetry"     value={telemetryValue} state={telemetryState} />
          <StatusPill label="Live Stream"   value={streamValue}    state={streamState} />
          <StatusPill label="AI Prognostics" value="ONLINE"        state="online" />
          <StatusPill label="Digital Twin"  value={connected ? 'SYNCED' : 'WAITING'} state={connected ? 'online' : 'loading'} />
        </div>

        {/* Right Tools */}
        <div style={{ display: 'flex', alignItems: 'stretch', borderLeft: '1px solid #E2E8F0', flexShrink: 0 }}>
          {/* Live Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 18px', borderRight: '1px solid #E2E8F0' }}>
            <span
              className={connected ? 'dt-live-pulse' : ''}
              style={{
                width: 9, height: 9, borderRadius: '50%',
                background: connected ? '#059669' : telemetryState === 'loading' ? '#D97706' : '#DC2626',
                boxShadow: connected ? '0 0 8px #059669' : 'none',
                flexShrink: 0,
                animation: !connected && !everConnected ? 'topbar-blink 1s ease-in-out infinite' : 'none',
              }}
            />
            <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', color: connected ? '#059669' : telemetryState === 'loading' ? '#D97706' : '#DC2626' }}>
              {connected ? 'LIVE TELEMETRY' : everConnected ? 'STREAM LOST' : 'CONNECTING…'}
            </span>
          </div>

          {/* UTC Clock */}
          <div style={{ padding: '0 18px', borderRight: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: 10, color: '#64748B', letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600 }}>UTC TIME</div>
            <div style={{ fontSize: 15, color: '#0F172A', fontFamily: 'monospace', fontWeight: 700, letterSpacing: '0.05em' }}>
              {utcTime || '--:--:--'}
            </div>
          </div>

          {/* Alerts */}
          <div
            style={{
              padding: '0 18px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              color: alertCount > 0 ? '#DC2626' : '#64748B', transition: 'color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            title={`${alertCount} active alerts`}
          >
            <Bell size={18} />
            {alertCount > 0 && (
              <span style={{
                fontSize: 11, fontWeight: 700,
                background: '#DC2626', color: '#FFFFFF',
                borderRadius: 10, padding: '1px 7px', minWidth: 20, textAlign: 'center',
              }}>
                {alertCount > 99 ? '99+' : alertCount}
              </span>
            )}
          </div>
        </div>
      </header>
    </>
  )
}
