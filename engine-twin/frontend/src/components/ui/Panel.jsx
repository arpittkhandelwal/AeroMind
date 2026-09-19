/**
 * Panel.jsx — Reusable aerospace panel container
 * ================================================
 * Clean white panel with subtle slate border and soft elevation shadow.
 */

import React from 'react'

export default function Panel({ children, elevated = false, style, className, ...props }) {
  return (
    <div
      className={className}
      style={{
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: 6,
        padding: 20,
        boxShadow: elevated
          ? '0 10px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)'
          : '0 1px 3px 0 rgba(15, 23, 42, 0.05), 0 1px 2px -1px rgba(15, 23, 42, 0.05)',
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  )
}
