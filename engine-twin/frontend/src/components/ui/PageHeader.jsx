/**
 * PageHeader.jsx — Standard page-level header
 * =============================================
 * Consistent heading across all pages with icon, title,
 * subtitle and optional status badge.
 *
 *   <PageHeader
 *     icon={Activity}
 *     title="Live Monitor"
 *     subtitle="Real-time engine telemetry stream"
 *     badge="LIVE"
 *     badgeColor="#39D98A"
 *   />
 */

import React from 'react'

export default function PageHeader({
  icon: Icon,
  title,
  subtitle,
  badge,
  badgeColor = '#8FA1A9',
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      paddingBottom: 14,
      marginBottom: 14,
      borderBottom: '1px solid #20343C',
    }}>
      {Icon && (
        <Icon size={18} color="#55C7E8" strokeWidth={1.5} />
      )}
      <div style={{ flex: 1 }}>
        <h1 style={{
          margin: 0,
          fontSize: 15,
          fontWeight: 700,
          color: '#E8EEF0',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          lineHeight: 1.2,
        }}>
          {title}
        </h1>
        {subtitle && (
          <p style={{
            margin: '2px 0 0',
            fontSize: 11,
            color: '#8FA1A9',
            letterSpacing: '0.04em',
          }}>
            {subtitle}
          </p>
        )}
      </div>
      {badge && (
        <span style={{
          padding: '3px 8px',
          background: `${badgeColor}1A`,
          border: `1px solid ${badgeColor}44`,
          borderRadius: 3,
          fontSize: 9,
          fontWeight: 700,
          color: badgeColor,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}>
          {badge}
        </span>
      )}
    </div>
  )
}
