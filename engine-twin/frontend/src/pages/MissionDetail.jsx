/**
 * MissionDetail.jsx — Individual mission view  (route: /missions/:id)
 * =====================================================================
 */

import React from 'react'
import { useParams } from 'react-router-dom'
import { Navigation, Map, BarChart2, AlertTriangle } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import PlaceholderContent from '../components/ui/PlaceholderContent'

export default function MissionDetail() {
  const { id } = useParams()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader
        icon={Navigation}
        title={`Mission ${id ?? '—'}`}
        subtitle="Detailed mission analysis · telemetry replay · fault timeline"
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Panel>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#4A6270',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            paddingBottom: 10, borderBottom: '1px solid #20343C',
          }}>
            Mission Summary
          </div>
          <PlaceholderContent
            icon={Map}
            moduleId="MSN-DETAIL-SUMMARY"
            label="Mission Metadata"
            phase="Phase 2"
            height={180}
            specs={[
              ['Mission ID',  id ?? '—'],
              ['Aircraft',    'UAV-07 / ENGINE-A'],
              ['Duration',    '—'],
              ['Total Faults','—'],
              ['Data Points', '—'],
            ]}
          />
        </Panel>

        <Panel>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#4A6270',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            paddingBottom: 10, borderBottom: '1px solid #20343C',
          }}>
            Fault Timeline
          </div>
          <PlaceholderContent
            icon={AlertTriangle}
            moduleId="MSN-FAULT-TIMELINE"
            label="Fault Event Markers"
            phase="Phase 2"
            height={180}
          />
        </Panel>

        <Panel style={{ gridColumn: 'span 2' }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#4A6270',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            paddingBottom: 10, borderBottom: '1px solid #20343C',
          }}>
            Telemetry Overview
          </div>
          <PlaceholderContent
            icon={BarChart2}
            moduleId="MSN-TLM-OVERVIEW"
            label="Mission Telemetry Charts"
            phase="Phase 2"
            height={220}
          />
        </Panel>
      </div>
    </div>
  )
}
