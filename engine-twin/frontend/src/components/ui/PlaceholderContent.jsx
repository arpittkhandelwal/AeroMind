/**
 * PlaceholderContent.jsx — Structured placeholder for unimplemented pages
 * =========================================================================
 * Shows an aerospace-style "subsystem pending" state instead of a
 * blank page or generic "Coming Soon". Makes demos look intentional.
 *
 *   <PlaceholderContent
 *     icon={Box}
 *     moduleId="DT-RENDER-3D"
 *     label="3D Engine Model"
 *     phase="Phase 3"
 *     specs={[
 *       ['Render Engine', 'Three.js / react-three-fiber'],
 *       ['Model Format', 'GLTF 2.0'],
 *     ]}
 *   />
 */

import React from 'react'
import { Construction } from 'lucide-react'

export default function PlaceholderContent({
  icon: Icon = Construction,
  moduleId,
  label,
  phase = 'Phase 2',
  specs = [],
  height = 260,
}) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: height,
      gap: 16,
      padding: '24px 0',
    }}>
      {/* Icon */}
      <Icon size={44} color="#20343C" strokeWidth={1} />

      {/* Module identifier */}
      <div style={{ textAlign: 'center' }}>
        {moduleId && (
          <div style={{
            fontSize: 9,
            fontWeight: 700,
            color: '#4A6270',
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            marginBottom: 4,
            fontFamily: 'monospace',
          }}>
            {moduleId}
          </div>
        )}
        <div style={{
          fontSize: 11,
          color: '#4A6270',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}>
          {label}
        </div>
        <div style={{
          marginTop: 4,
          fontSize: 10,
          color: '#2A4050',
          letterSpacing: '0.06em',
        }}>
          PENDING_INITIALIZATION · {phase}
        </div>
      </div>

      {/* Spec rows */}
      {specs.length > 0 && (
        <div style={{
          marginTop: 8,
          padding: '10px 16px',
          background: '#071014',
          border: '1px solid #172830',
          borderRadius: 3,
          minWidth: 260,
        }}>
          {specs.map(([k, v]) => (
            <div key={k} style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 24,
              padding: '3px 0',
              borderBottom: '1px solid #0F1B21',
            }}>
              <span style={{ fontSize: 10, color: '#4A6270', fontFamily: 'monospace', letterSpacing: '0.05em' }}>{k}</span>
              <span style={{ fontSize: 10, color: '#2A4050', fontFamily: 'monospace' }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
