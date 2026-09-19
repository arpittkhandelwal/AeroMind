/**
 * Reports.jsx — Automated report generation  (route: /reports)
 * =============================================================
 * Mission reports, health summaries, fault analysis PDFs. Phase 2.
 */

import React, { useState } from 'react'
import { FileBarChart, FileText, Download, CheckCircle, Loader } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'

const REPORT_TYPES = [
  { id: 'mission-summary',   label: 'Mission Summary Report',     desc: 'Full telemetry + fault log per mission' },
  { id: 'health-weekly',     label: 'Weekly Health Report',       desc: 'Engine health trends over 7 days' },
  { id: 'rul-estimate',      label: 'RUL Estimation Report',      desc: 'Component remaining life analysis' },
  { id: 'fault-analysis',    label: 'Fault Analysis Report',      desc: 'ML diagnostics + SHAP breakdown' },
  { id: 'maintenance-due',   label: 'Maintenance Due Report',     desc: 'Scheduled items & work orders' },
]

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState('mission-summary')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)

  const handleGenerate = () => {
    setGenerating(true)
    setGenerated(false)
    setTimeout(() => {
      setGenerating(false)
      setGenerated(true)
    }, 2000)
  }

  const activeReport = REPORT_TYPES.find(r => r.id === selectedReport)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader
        icon={FileBarChart}
        title="Reports"
        subtitle="Automated report generation · mission summaries · health analytics"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
        {/* Report type list */}
        <Panel>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#4A6270',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            paddingBottom: 10, borderBottom: '1px solid #20343C', marginBottom: 12,
          }}>
            Report Templates
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {REPORT_TYPES.map(rt => (
              <div
                key={rt.id}
                onClick={() => { setSelectedReport(rt.id); setGenerated(false) }}
                style={{
                  padding: '9px 10px',
                  background: selectedReport === rt.id ? '#0F172A' : '#FFFFFF',
                  border: `1px solid ${selectedReport === rt.id ? '#D97706' : '#E2E8F0'}`,
                  borderRadius: 3,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 2,
                }}>
                  <span style={{ fontSize: 11, color: selectedReport === rt.id ? '#FFFFFF' : '#0F172A', fontWeight: 500 }}>{rt.label}</span>
                </div>
                <span style={{ fontSize: 9, color: selectedReport === rt.id ? '#94A3B8' : '#64748B', letterSpacing: '0.04em' }}>{rt.desc}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Preview pane */}
        <Panel>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#4A6270',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            paddingBottom: 10, borderBottom: '1px solid #20343C', marginBottom: 16
          }}>
            Report Generation Configuration
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0F172A' }}>{activeReport?.label}</div>
              <div style={{ fontSize: 13, color: '#64748B' }}>{activeReport?.desc}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Date Range</label>
                <select style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                  <option>Last 24 Hours</option>
                  <option>Last 7 Days</option>
                  <option>Last 30 Days</option>
                  <option>All Time</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748B', marginBottom: 4 }}>Format</label>
                <select style={{ width: '100%', padding: '8px', borderRadius: 4, border: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                  <option>PDF Document (.pdf)</option>
                  <option>Excel Spreadsheet (.xlsx)</option>
                  <option>CSV Data (.csv)</option>
                </select>
              </div>
            </div>

            <div style={{ padding: '16px', background: '#F1F5F9', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Ready to Generate</div>
                <div style={{ fontSize: 11, color: '#64748B' }}>Estimated size: ~1.2 MB</div>
              </div>
              <button
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 16px', background: '#D97706', color: '#FFF',
                  border: 'none', borderRadius: 6, fontWeight: 600, cursor: generating ? 'not-allowed' : 'pointer',
                  opacity: generating ? 0.7 : 1
                }}
              >
                {generating ? <><Loader className="spin" size={16} /> Generating...</> : 'Generate Report'}
              </button>
            </div>

            {generated && (
              <div style={{ padding: '16px', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <CheckCircle color="#059669" size={24} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#065F46' }}>Generation Complete</div>
                    <div style={{ fontSize: 11, color: '#047857' }}>{activeReport?.id}_export_2026.pdf</div>
                  </div>
                </div>
                <button
                  onClick={() => window.print()}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 16px', background: '#10B981', color: '#FFF',
                    border: 'none', borderRadius: 6, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  <Download size={16} /> Download
                </button>
              </div>
            )}
            
            <style>{`
              .spin { animation: spin 1s linear infinite; }
              @keyframes spin { 100% { transform: rotate(360deg); } }
            `}</style>
          </div>
        </Panel>
      </div>
    </div>
  )
}
