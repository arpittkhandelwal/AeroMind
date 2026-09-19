/**
 * FaultAlerts.jsx — Active Faults & Anomaly Alerts (Light Aerospace Theme)
 * =======================================================================
 */

import React from 'react'
import { AlertTriangle, ShieldAlert, CheckCircle2, ChevronRight } from 'lucide-react'

const SEVERITY_CONFIG = {
  CRITICAL: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' },
  WARNING:  { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  MONITOR:  { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  NORMAL:   { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0' },
}

function AlertRow({ alert }) {
  const conf = alert.confidence ?? 0.7
  const severityKey = alert.severity?.toUpperCase() ?? (conf >= 0.85 ? 'CRITICAL' : 'WARNING')
  const cfg = SEVERITY_CONFIG[severityKey] || SEVERITY_CONFIG.WARNING

  const time = (() => {
    try { return new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }
    catch { return alert.timestamp }
  })()

  return (
    <div style={{
      padding: '12px 14px',
      marginBottom: 10,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      borderRadius: 6,
    }}>
      {/* Top Row: Type & Time */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <AlertTriangle size={15} color={cfg.color} />
          <span style={{ fontSize: 13, fontWeight: 800, color: cfg.color, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            {(alert.fault_type ?? 'FAULT').replace(/_/g, ' ')}
          </span>
        </div>
        <span style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace', fontWeight: 600 }}>
          {time}
        </span>
      </div>

      {/* Description message */}
      {alert.message && (
        <div style={{ fontSize: 13, color: '#0F172A', fontWeight: 500, marginBottom: 6, lineHeight: 1.4 }}>
          {alert.message}
        </div>
      )}

      {/* Metadata strip: Confidence, Subsystem, RUL impact */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, flexWrap: 'wrap' }}>
        <span style={{ color: '#64748B' }}>
          AI Confidence: <strong style={{ color: '#0F172A' }}>{(conf * 100).toFixed(0)}%</strong>
        </span>
        {alert.subsystem && (
          <span style={{ color: '#64748B' }}>
            Subsystem: <strong style={{ color: '#0F172A' }}>{alert.subsystem}</strong>
          </span>
        )}
        {alert.rul_hours != null && (
          <span style={{ color: '#64748B' }}>
            Est. RUL: <strong style={{ color: cfg.color }}>{alert.rul_hours.toFixed(1)} hrs</strong>
          </span>
        )}
      </div>

      {/* SHAP top contributory features */}
      {alert.shap_top_features?.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
            ROOT CAUSES:
          </span>
          {alert.shap_top_features.map((feat) => (
            <span
              key={feat}
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: '#475569',
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                padding: '1px 6px',
                borderRadius: 4,
                fontFamily: 'monospace',
              }}
            >
              {feat}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function FaultAlerts({ alerts = [], maxHeight = '340px', onViewAll }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: '1px solid #E2E8F0',
      borderRadius: 6,
      padding: 20,
      boxShadow: '0 1px 3px 0 rgba(15, 23, 42, 0.05)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 14,
        paddingBottom: 10,
        borderBottom: '1px solid #F1F5F9',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#64748B',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            ANOMALY & FAULT ALERTS
          </div>
          {alerts.length > 0 && (
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: '#DC2626',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              padding: '1px 6px',
              borderRadius: 10,
            }}>
              {alerts.length} ACTIVE
            </span>
          )}
        </div>

        {onViewAll && (
          <button
            onClick={onViewAll}
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: '#0284C7',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            VIEW ALL <ChevronRight size={14} />
          </button>
        )}
      </div>

      <div style={{ maxHeight, overflowY: 'auto', paddingRight: 4 }}>
        {alerts.length > 0 ? (
          alerts.map((a, i) => <AlertRow key={a.id || i} alert={a} />)
        ) : (
          <div style={{
            padding: '30px 0',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}>
            <CheckCircle2 size={24} color="#059669" />
            <span style={{ fontSize: 13, color: '#475569', fontWeight: 600 }}>
              Zero propulsion faults detected
            </span>
            <span style={{ fontSize: 12, color: '#94A3B8' }}>
              All engine subsystems operating within normal bounds
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
