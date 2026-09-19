/**
 * Sidebar.jsx — ENGINE-TWIN collapsible navigation sidebar (Light Aerospace Theme)
 * ==============================================================================
 */

import React, { useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Activity, Box, LineChart, ScanSearch,
  TrendingUp, Navigation, Sliders, Database, Radio, Brain
} from 'lucide-react'

const NAV_GROUPS = [
  {
    label: 'MISSION CONTROL',
    items: [
      { label: 'Overview',     icon: LayoutDashboard, path: '/',     end: true },
      { label: 'Live Monitor', icon: Activity,         path: '/live' },
      { label: 'Fleet View',         icon: Navigation, path: '/fleet' },
      { label: 'Fleet Intelligence',  icon: Radio,      path: '/fleet-intelligence' },
    ],
  },
  {
    label: 'DIGITAL TWIN',
    items: [
      { label: 'Digital Twin',        icon: Box,       path: '/digital-twin' },
      { label: 'Physics vs Reality',  icon: Sliders,   path: '/physics-reality' },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { label: 'Diagnostics',    icon: ScanSearch, path: '/diagnostics' },
      { label: 'AI Explainer',    icon: Brain,      path: '/explainer' },
      { label: 'Predictions', icon: TrendingUp, path: '/predictions' },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { label: 'Architecture',    icon: Database,   path: '/architecture' },
    ],
  },
]

function NavItem({ label, icon: Icon, path, end = false, collapsed }) {
  const [hovered, setHovered] = useState(false)
  return (
    <NavLink
      to={path}
      end={end}
      title={collapsed ? label : undefined}
      style={({ isActive }) => ({
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: collapsed ? '11px 0' : '10px 18px',
        justifyContent: collapsed ? 'center' : 'flex-start',
        textDecoration: 'none',
        color:      isActive ? '#0F172A' : hovered ? '#0F172A' : '#64748B',
        background: isActive ? '#F1F5F9' : hovered ? '#F8FAFC' : 'transparent',
        borderLeft: isActive ? '3px solid #D97706' : '3px solid transparent',
        fontSize: 14,
        fontWeight: isActive ? 700 : 500,
        letterSpacing: '0.01em',
        transition: 'color 0.12s, background 0.12s',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        flexShrink: 0,
      })}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Icon size={17} strokeWidth={2} style={{ flexShrink: 0, color: '#D97706' }} />
      {!collapsed && (
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </span>
      )}
    </NavLink>
  )
}

export default function Sidebar({ collapsed }) {
  return (
    <nav style={{
      width: collapsed ? 64 : 240,
      minWidth: collapsed ? 64 : 240,
      background: '#FFFFFF',
      borderRight: '1px solid #E2E8F0',
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      overflowX: 'hidden',
      transition: 'width 0.2s ease, min-width 0.2s ease',
      flexShrink: 0,
      boxShadow: '1px 0 3px 0 rgba(15, 23, 42, 0.03)',
    }}>
      {NAV_GROUPS.map((group, gi) => (
        <div key={group.label} style={{ marginBottom: 4 }}>
          {!collapsed ? (
            <div style={{
              padding: '14px 18px 5px',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: '#94A3B8',
              textTransform: 'uppercase',
              userSelect: 'none',
            }}>
              {group.label}
            </div>
          ) : (
            gi > 0 && <div style={{ height: 1, background: '#F1F5F9', margin: '6px 12px' }} />
          )}
          {group.items.map(item => (
            <NavItem key={item.path} {...item} collapsed={collapsed} />
          ))}
        </div>
      ))}

      <div style={{ flex: 1 }} />

      {!collapsed && (
        <div style={{
          padding: '14px 18px',
          borderTop: '1px solid #E2E8F0',
          background: '#F8FAFC',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
              SIH-26054 DT
            </div>
            <div style={{ fontSize: 10, color: '#64748B' }}>
              Propulsion Twin v0.1
            </div>
          </div>
          <span style={{
            fontSize: 9, fontWeight: 700, color: '#059669',
            background: '#ECFDF5', border: '1px solid #A7F3D0',
            padding: '2px 6px', borderRadius: 4,
          }}>
            SECURE
          </span>
        </div>
      )}
    </nav>
  )
}
