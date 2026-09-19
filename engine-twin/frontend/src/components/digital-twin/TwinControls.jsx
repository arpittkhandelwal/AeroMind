/**
 * TwinControls.jsx — Camera control toolbar
 * ==========================================
 * Props:
 *   onReset     () => void
 *   onPreset    ('iso'|'front'|'side'|'top') => void
 *   wireframe   boolean
 *   onWireframe () => void
 */

import React from 'react'
import { RotateCcw, Grid3x3 } from 'lucide-react'

const PRESETS = [
  { key: 'iso',   label: 'ISO' },
  { key: 'front', label: 'Front' },
  { key: 'side',  label: 'Side' },
  { key: 'top',   label: 'Top' },
]

function Btn({ label, icon: Icon, onClick, active }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '4px 9px',
        background: active ? '#E9F0EA' : 'transparent',
        border: `1px solid ${active ? '#3F5A45' : '#C9C7BE'}`,
        borderRadius: 2, cursor: 'pointer',
        color: active ? '#3F5A45' : '#5F625B',
        fontSize: 12, fontWeight: active ? 700 : 400,
        letterSpacing: '0.08em', textTransform: 'uppercase',
        fontFamily: '"IBM Plex Mono", monospace',
        transition: 'all 0.1s',
      }}
      onMouseEnter={e => {
        if (!active) {
          e.currentTarget.style.borderColor = '#9AA99D'
          e.currentTarget.style.color = '#2E5138'
        }
      }}
      onMouseLeave={e => {
        if (!active) {
          e.currentTarget.style.borderColor = '#C9C7BE'
          e.currentTarget.style.color = '#5F625B'
        }
      }}
    >
      {Icon && <Icon size={10} strokeWidth={1.5} />}
      {label}
    </button>
  )
}

export default function TwinControls({ onReset, onPreset, wireframe, onWireframe }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      {PRESETS.map(p => (
        <Btn key={p.key} label={p.label} onClick={() => onPreset?.(p.key)} />
      ))}
      <div style={{ width: 1, height: 16, background: '#C9C7BE', margin: '0 2px' }} />
      <Btn label="Reset" icon={RotateCcw} onClick={onReset} />
      <Btn label="Wire" icon={Grid3x3} onClick={onWireframe} active={wireframe} />
    </div>
  )
}
