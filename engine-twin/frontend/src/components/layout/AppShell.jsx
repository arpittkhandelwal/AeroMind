/**
 * AppShell.jsx — Primary layout wrapper (Clean Aerospace Light Theme)
 * ==================================================================
 */

import React, { useState } from 'react'
import { Outlet } from 'react-router-dom'
import TopBar from './TopBar'
import Sidebar from './Sidebar'

function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('dt-sidebar-collapsed') === 'true' } catch { return false }
  })
  const toggle = () => setCollapsed(prev => {
    const next = !prev
    try { localStorage.setItem('dt-sidebar-collapsed', String(next)) } catch {}
    return next
  })
  return [collapsed, toggle]
}

export default function AppShell() {
  const [collapsed, toggleCollapsed] = useSidebarCollapsed()

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: '#F8FAFC',
      overflow: 'hidden',
    }}>
      <TopBar collapsed={collapsed} onToggleSidebar={toggleCollapsed} />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar collapsed={collapsed} />

        <main style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '24px 28px',
          background: '#F8FAFC',
        }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
