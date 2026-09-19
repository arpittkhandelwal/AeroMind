/**
 * Maintenance.jsx — Maintenance scheduling  (route: /maintenance)
 * ================================================================
 * Maintenance window forecasting based on RUL predictions.
 * Work order management. Phase 2.
 */

import React from 'react'
import { Wrench, Calendar, CheckSquare } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import PlaceholderContent from '../components/ui/PlaceholderContent'

/* Mock maintenance items */
const MOCK_ITEMS = [
  { id: 'M-001', component: 'Oil Filter',        due: '2026-09-25', priority: 'ROUTINE',  rul: '180h' },
  { id: 'M-002', component: 'Spark Plugs (x4)',   due: '2026-10-02', priority: 'ROUTINE',  rul: '250h' },
  { id: 'M-003', component: 'Fuel Injector #2',   due: '2026-09-20', priority: 'URGENT',   rul: '48h'  },
  { id: 'M-004', component: 'Cylinder Head Gasket',due: '2026-10-15',priority: 'SCHEDULED',rul: '400h' },
]

const PRIORITY_COLOR = { URGENT: '#FF5C5C', ROUTINE: '#F2B84B', SCHEDULED: '#55C7E8' }

export default function Maintenance() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader
        icon={Wrench}
        title="Maintenance"
        subtitle="Scheduled maintenance · work orders · RUL-driven scheduling"
        badge={`${MOCK_ITEMS.filter(m => m.priority === 'URGENT').length} URGENT`}
        badgeColor="#FF5C5C"
      />

      <Panel>
        <div style={{
          fontSize: 9, fontWeight: 700, color: '#4A6270',
          letterSpacing: '0.14em', textTransform: 'uppercase',
          paddingBottom: 10, borderBottom: '1px solid #20343C', marginBottom: 4,
        }}>
          Maintenance Schedule
        </div>

        {/* Header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '80px 1fr 110px 90px 80px',
          padding: '6px 8px', borderBottom: '1px solid #172830',
        }}>
          {['WO #','COMPONENT','DUE DATE','PRIORITY','RUL EST.'].map(h => (
            <span key={h} style={{ fontSize: 9, color: '#4A6270', letterSpacing: '0.12em', fontWeight: 700 }}>{h}</span>
          ))}
        </div>

        {MOCK_ITEMS.map((m, i) => (
          <div key={m.id} style={{
            display: 'grid', gridTemplateColumns: '80px 1fr 110px 90px 80px',
            padding: '8px 8px', borderBottom: '1px solid #0D1A22',
            background: i % 2 === 0 ? 'transparent' : '#071014',
          }}>
            <span style={{ fontSize: 10, color: '#8FA1A9', fontFamily: 'monospace' }}>{m.id}</span>
            <span style={{ fontSize: 11, color: '#E8EEF0' }}>{m.component}</span>
            <span style={{ fontSize: 10, color: '#8FA1A9', fontFamily: 'monospace' }}>{m.due}</span>
            <span style={{ fontSize: 10, color: PRIORITY_COLOR[m.priority], fontWeight: 600, letterSpacing: '0.08em' }}>{m.priority}</span>
            <span style={{ fontSize: 10, color: m.priority === 'URGENT' ? '#FF5C5C' : '#8FA1A9', fontFamily: 'monospace' }}>{m.rul}</span>
          </div>
        ))}

        <div style={{ marginTop: 12, fontSize: 10, color: '#4A6270' }}>
          Schedule auto-generated from RUL predictions · Full work order system in Phase 2
        </div>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <Panel>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#4A6270',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            paddingBottom: 10, borderBottom: '1px solid #20343C',
          }}>
            Maintenance Calendar
          </div>
          <PlaceholderContent icon={Calendar} moduleId="MNT-CALENDAR" label="Scheduled Events" phase="Phase 2" height={200} />
        </Panel>
        <Panel>
          <div style={{
            fontSize: 9, fontWeight: 700, color: '#4A6270',
            letterSpacing: '0.14em', textTransform: 'uppercase',
            paddingBottom: 10, borderBottom: '1px solid #20343C',
          }}>
            Completed Work Orders
          </div>
          <PlaceholderContent icon={CheckSquare} moduleId="MNT-COMPLETED" label="Work Order History" phase="Phase 2" height={200} />
        </Panel>
      </div>
    </div>
  )
}
