/**
 * Diagnostics.jsx — Live Fault Diagnostics & AI Explainability
 * ============================================================
 * Consumes real alerts from the ML backend.
 */

import React, { useState, useEffect } from 'react'
import { ScanSearch, AlertTriangle, BarChart2, Layers, Clock } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import { useTelemetry } from '../context/TelemetryContext'
import { API_URL, apiHeaders } from '../lib/config'

function FeatureImportanceBar({ label, value, maxVal }) {
  const pct = (value / maxVal) * 100
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 40px', gap: 12, alignItems: 'center', marginBottom: 8 }}>
      <span style={{ fontSize: 11, color: '#64748B', textAlign: 'right' }}>{label}</span>
      <div style={{ height: 6, background: '#F1F5F9', borderRadius: 3 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: '#0284C7', borderRadius: 3, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>+{value.toFixed(2)}</span>
    </div>
  )
}

export default function Diagnostics() {
  const { alerts, healthIndex, telemetryHistory, missionId } = useTelemetry()
  const [timeline, setTimeline] = useState([])

  useEffect(() => {
    if (!missionId) return
    const fetchTimeline = async () => {
      try {
        const res = await fetch(`${API_URL}/missions/${missionId}/timeline`, { headers: apiHeaders() })
        if (res.ok) {
          const data = await res.json()
          setTimeline(data.events || [])
        }
      } catch (e) { console.error('Failed to fetch timeline', e) }
    }
    fetchTimeline()
    const id = setInterval(fetchTimeline, 5000)
    return () => clearInterval(id)
  }, [missionId])

  const activeAlert = alerts[0]
  const hasAlert = activeAlert && activeAlert.severity !== 'CAUTION'
  const shapFeatures = activeAlert?.shapFeatures || []
  const maxShap = shapFeatures.length > 0 ? Math.max(...shapFeatures.map(f => f.value)) : 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader
        icon={ScanSearch}
        title="AI Diagnostic Explanation"
        subtitle="Live Random Forest fault classification · Model Feature Importance"
        badge={hasAlert ? 'ACTIVE FAULT' : 'NOMINAL'}
        badgeColor={hasAlert ? '#EF4444' : '#10B981'}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        {/* Active fault classification */}
        <Panel style={{ gridColumn: 'span 2' }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#0F172A',
            letterSpacing: '0.04em', textTransform: 'uppercase',
            paddingBottom: 10, borderBottom: '1px solid #E2E8F0', marginBottom: 16
          }}>
            <AlertTriangle size={14} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: '#64748B' }}/>
            Current Engine Status
          </div>
          
          {hasAlert ? (
            <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
              <div style={{ padding: '24px 32px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#B91C1C', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>Detected Fault</div>
                <div style={{ fontSize: 24, fontWeight: 900, color: '#991B1B' }}>{activeAlert.faultType}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Confidence Score</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>{(activeAlert.confidence * 100).toFixed(1)}%</div>
                <div style={{ fontSize: 12, color: '#64748B', marginTop: 12, marginBottom: 4 }}>Predicted RUL</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#D97706', fontFamily: 'monospace' }}>{activeAlert.rulHours != null ? `${activeAlert.rulHours.toFixed(1)} hours` : 'N/A'}</div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '32px', textAlign: 'center', color: '#059669', background: '#ECFDF5', borderRadius: 8, border: '1px solid #A7F3D0' }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Engine operating nominally</div>
              <div style={{ fontSize: 13, marginTop: 4 }}>No active faults detected by the ML classifier.</div>
            </div>
          )}
        </Panel>

        {/* Feature explainability */}
        <Panel>
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#0F172A',
            letterSpacing: '0.04em', textTransform: 'uppercase',
            paddingBottom: 10, borderBottom: '1px solid #E2E8F0', marginBottom: 16
          }}>
            <BarChart2 size={14} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: '#64748B' }}/>
            Model Feature Importance
          </div>
          
          {hasAlert && shapFeatures.length > 0 ? (
            <div>
              <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16 }}>
                Top contributing features for the <strong>{activeAlert.faultType}</strong> classification
                (Random Forest Gini Feature Importance):
              </div>
              {shapFeatures.map((f, i) => (
                <FeatureImportanceBar key={i} label={f.feature} value={f.value} maxVal={maxShap} />
              ))}
              <div style={{ fontSize: 11, color: '#64748B', marginTop: 12 }}>
                *These values represent model-level feature importance for the classifier.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', height: 160, alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 13 }}>
              Feature importance data available when a fault is detected
            </div>
          )}
        </Panel>

        {/* Anomaly score */}
        <Panel>
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#0F172A',
            letterSpacing: '0.04em', textTransform: 'uppercase',
            paddingBottom: 10, borderBottom: '1px solid #E2E8F0', marginBottom: 16
          }}>
            <Layers size={14} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: '#64748B' }}/>
            Health Index Trend
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Current Health</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: healthIndex?.score >= 80 ? '#059669' : healthIndex?.score >= 50 ? '#D97706' : '#DC2626', fontFamily: 'monospace' }}>
                  {healthIndex?.score?.toFixed(1) ?? 100}
                </div>
              </div>
              <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: 6, border: '1px solid #E2E8F0' }}>
                <div style={{ fontSize: 11, color: '#64748B', textTransform: 'uppercase', fontWeight: 700, marginBottom: 4 }}>Telemetry Packets</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                  {telemetryHistory.length}
                </div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.5 }}>
              The Health Index (HI) continuously evaluates physics residuals, fault severity, and RUL depletion to formulate an aggregate engine integrity score.
            </div>
          </div>
        </Panel>

        {/* Fault Timeline */}
        <Panel style={{ gridColumn: 'span 2' }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#0F172A',
            letterSpacing: '0.04em', textTransform: 'uppercase',
            paddingBottom: 10, borderBottom: '1px solid #E2E8F0', marginBottom: 16
          }}>
            <Clock size={14} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: '#64748B' }}/>
            Mission Fault Timeline
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {timeline.length > 0 ? timeline.map((evt, idx) => (
              <div key={idx} style={{ display: 'flex', gap: 12 }}>
                <div style={{ fontSize: 12, color: '#64748B', minWidth: 60 }}>
                  {new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: evt.severity === 'critical' ? '#DC2626' : evt.severity === 'warning' ? '#D97706' : '#059669', zIndex: 2 }} />
                  {idx !== timeline.length - 1 && <div style={{ width: 2, flex: 1, background: '#E2E8F0', marginTop: 4, marginBottom: 4 }} />}
                </div>
                <div style={{ paddingBottom: idx !== timeline.length - 1 ? 16 : 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
                    {evt.type === 'mission_started' ? 'Normal Operation' : evt.type === 'alert' ? 'Fault Classified' : evt.type}
                  </div>
                  <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>
                    {evt.message}
                  </div>
                </div>
              </div>
            )) : (
              <div style={{ fontSize: 13, color: '#64748B' }}>No events recorded for this mission yet.</div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  )
}
