/**
 * App.jsx — ENGINE-TWIN Application Root
 * ========================================
 * Wires together:
 *   TelemetryProvider  — global WebSocket + health-index context
 *   BrowserRouter      — client-side routing
 *   AppShell           — TopBar + Sidebar + page outlet
 *
 * DigitalTwin is lazy-loaded so Three.js (~1 MB) is code-split into
 * its own chunk and does NOT bloat the initial bundle.
 */

import React, { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import { TelemetryProvider } from './context/TelemetryContext'
import AppShell     from './components/layout/AppShell'

/* ── Pages — eager (small) ──────────────────────────────────────── */
import Overview       from './pages/Overview'
import LiveMonitor    from './pages/LiveMonitor'
import FleetView      from './pages/FleetView'
import TelemetryPage  from './pages/TelemetryPage'
import Diagnostics    from './pages/Diagnostics'
import Predictions    from './pages/Predictions'
import Missions       from './pages/Missions'
import MissionDetail  from './pages/MissionDetail'
import Replay         from './pages/Replay'
import Simulator      from './pages/Simulator'
import FaultInjection from './pages/FaultInjection'
import Maintenance    from './pages/Maintenance'
import Reports        from './pages/Reports'
import Settings       from './pages/Settings'
import PhysicsVsReality from './pages/PhysicsVsReality'
import Architecture     from './pages/Architecture'

/* ── DigitalTwin — lazy (Three.js chunk) ───────────────────────── */
const DigitalTwin = lazy(() => import('./pages/DigitalTwin'))

/** Minimal loading state matching the dark theme */
function ThreeLoading() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: 400, flexDirection: 'column', gap: 12,
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        border: '2px solid #20343C', borderTopColor: '#55C7E8',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: 12, color: '#4A6270', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
        Initialising 3D Engine
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

export default function App() {
  return (
    <TelemetryProvider>
      <BrowserRouter>
        <Routes>
          {/* AppShell provides TopBar + Sidebar + <Outlet> */}
          <Route path="/" element={<AppShell />}>
            {/* OPERATIONS */}
            <Route index             element={<Overview />} />
            <Route path="live"       element={<LiveMonitor />} />
            <Route path="fleet"      element={<FleetView />} />

            {/* DIGITAL TWIN — code-split */}
            <Route path="digital-twin" element={
              <Suspense fallback={<ThreeLoading />}>
                <DigitalTwin />
              </Suspense>
            } />
            <Route path="physics-reality" element={<PhysicsVsReality />} />
            <Route path="telemetry"    element={<TelemetryPage />} />

            {/* INTELLIGENCE */}
            <Route path="diagnostics" element={<Diagnostics />} />
            <Route path="predictions" element={<Predictions />} />

            {/* MISSIONS */}
            <Route path="missions"     element={<Missions />} />
            <Route path="missions/:id" element={<MissionDetail />} />
            <Route path="replay"       element={<Replay />} />
            <Route path="replay/:id"   element={<Replay />} />

            {/* SIMULATION */}
            <Route path="simulator"      element={<Simulator />} />
            <Route path="fault-injection" element={<FaultInjection />} />

            {/* MAINTENANCE */}
            <Route path="maintenance" element={<Maintenance />} />
            <Route path="reports"     element={<Reports />} />

            {/* SYSTEM */}
            <Route path="settings"     element={<Settings />} />
            <Route path="architecture" element={<Architecture />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TelemetryProvider>
  )
}

