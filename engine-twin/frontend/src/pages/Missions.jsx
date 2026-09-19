/**
 * Missions.jsx — Mission list  (route: /missions)
 * =================================================
 * Browse, filter, and select recorded flight missions.
 */

import React from 'react'
import { Navigation } from 'lucide-react'
import PageHeader from '../components/ui/PageHeader'
import Panel from '../components/ui/Panel'
import PlaceholderContent from '../components/ui/PlaceholderContent'

/* Mock mission rows — will be replaced by API data */
const MOCK_MISSIONS = [
  { id: 'MTN-2047', status: 'ACTIVE',    duration: '—',      date: new Date().toISOString().slice(0,10), faults: 0 },
  { id: 'MTN-2046', status: 'COMPLETED', duration: '4h 12m', date: '2026-09-16', faults: 1 },
  { id: 'MTN-2045', status: 'COMPLETED', duration: '6h 44m', date: '2026-09-15', faults: 0 },
  { id: 'MTN-2044', status: 'ABORTED',   duration: '1h 03m', date: '2026-09-14', faults: 3 },
]

const STATUS_COLOR = {
  ACTIVE:    '#39D98A',
  COMPLETED: '#55C7E8',
  ABORTED:   '#FF5C5C',
}

export default function Missions() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <PageHeader
        icon={Navigation}
        title="Missions"
        subtitle="Flight mission log · UAV-07 / ENGINE-A"
        badge={`${MOCK_MISSIONS.length} RECORDS`}
        badgeColor="#8FA1A9"
      />

      <Panel>
        <div style={{
          fontSize: 9, fontWeight: 700, color: '#4A6270',
          letterSpacing: '0.14em', textTransform: 'uppercase',
          paddingBottom: 10, borderBottom: '1px solid #20343C', marginBottom: 4,
        }}>
          Mission Log
        </div>

        {/* Table header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '120px 100px 100px 1fr 80px',
          gap: 0,
          padding: '6px 8px',
          borderBottom: '1px solid #172830',
        }}>
          {['MISSION ID','STATUS','DATE','DURATION','FAULTS'].map(h => (
            <span key={h} style={{ fontSize: 9, color: '#4A6270', letterSpacing: '0.12em', fontWeight: 700 }}>{h}</span>
          ))}
        </div>

        {/* Table rows */}
        {MOCK_MISSIONS.map((m, i) => (
          <div key={m.id} style={{
            display: 'grid',
            gridTemplateColumns: '120px 100px 100px 1fr 80px',
            gap: 0,
            padding: '8px 8px',
            borderBottom: '1px solid #0D1A22',
            background: i % 2 === 0 ? 'transparent' : '#071014',
            cursor: 'pointer',
            transition: 'background 0.1s',
          }}
            onMouseEnter={e => (e.currentTarget.style.background = '#0D1E26')}
            onMouseLeave={e => (e.currentTarget.style.background = i % 2 === 0 ? 'transparent' : '#071014')}
          >
            <span style={{ fontSize: 11, color: '#55C7E8', fontFamily: 'monospace', fontWeight: 600 }}>{m.id}</span>
            <span style={{ fontSize: 10, color: STATUS_COLOR[m.status] ?? '#8FA1A9', fontWeight: 600, letterSpacing: '0.08em' }}>{m.status}</span>
            <span style={{ fontSize: 10, color: '#8FA1A9', fontFamily: 'monospace' }}>{m.date}</span>
            <span style={{ fontSize: 10, color: '#8FA1A9', fontFamily: 'monospace' }}>{m.duration}</span>
            <span style={{
              fontSize: 10, fontFamily: 'monospace',
              color: m.faults > 0 ? '#FF5C5C' : '#39D98A',
              fontWeight: m.faults > 0 ? 600 : 400,
            }}>
              {m.faults} {m.faults !== 1 ? 'faults' : 'fault'}
            </span>
          </div>
        ))}

        <div style={{ marginTop: 12, fontSize: 10, color: '#4A6270', letterSpacing: '0.06em' }}>
          Showing {MOCK_MISSIONS.length} records · Full mission database integration in Phase 2
        </div>
      </Panel>
    </div>
  )
}
