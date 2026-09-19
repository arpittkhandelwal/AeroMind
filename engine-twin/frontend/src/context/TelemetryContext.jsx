/**
 * TelemetryContext.jsx
 * ====================
 * Global context providing live WebSocket telemetry + health-index
 * to all pages and components. Eliminates prop-drilling across routes.
 *
 * Exposed values:
 *   telemetry        — NormalizedTelemetry | null   (latest, updates every WS message)
 *   telemetryHistory — NormalizedTelemetry[]         (ring buffer, flushed every 1 s)
 *   alerts           — NormalizedAlert[]             (newest first, max 50)
 *   connected        — boolean
 *   lastValidAt      — ISO string | null             (timestamp of last good message)
 *   disconnectedAt   — ISO string | null             (null when connected)
 *   healthIndex      — { score, status, updated_at } (REST polled every 10 s)
 *
 * Usage:
 *   const { telemetry, alerts, connected, lastValidAt, healthIndex } = useTelemetry()
 */

// @refresh reset
import React, { createContext, useContext, useState, useEffect } from 'react'
import { useTelemetryFeed } from '../hooks/useTelemetryFeed'

export const TelemetryContext = createContext(null)

export function TelemetryProvider({ children }) {
  const {
    telemetry,
    telemetryHistory,
    alerts,
    connected,
    lastValidAt,
    disconnectedAt,
    missionId,
  } = useTelemetryFeed()

  const [healthIndex, setHealthIndex] = useState({ score: 100, status: 'nominal', updated_at: null })
  
  // Global Cinematic Explosion State
  const [globalRul, setGlobalRul] = useState(null)
  const [isExploded, setIsExploded] = useState(false)
  const [activeFaultScenario, setActiveFaultScenario] = useState(null)

  // Provide a way to trigger the cinematic countdown globally
  const triggerCinematicFault = (faultId, rulSeconds) => {
    setActiveFaultScenario({ id: faultId, startingRul: rulSeconds })
    setGlobalRul(rulSeconds)
    setIsExploded(false)
  }

  const resetCinematicFault = () => {
    setActiveFaultScenario(null)
    setGlobalRul(null)
    setIsExploded(false)
  }

  // Run the cinematic countdown loop
  useEffect(() => {
    if (globalRul === null || isExploded) return
    let lastTime = performance.now()
    let frameId
    const tick = (now) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000)
      lastTime = now
      setGlobalRul(prev => {
        if (prev === null) return null
        const next = Math.max(0, prev - dt)
        if (next <= 0) {
          setIsExploded(true)
        }
        return next
      })
      frameId = requestAnimationFrame(tick)
    }
    frameId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameId)
  }, [globalRul, isExploded])

  // Health Index arrives with every live SSE telemetry event.
  useEffect(() => {
    if (telemetry?.healthIndex == null) return
    const score = Number(telemetry.healthIndex)
    setHealthIndex({ score, status: score >= 80 ? 'nominal' : score >= 50 ? 'degraded' : 'critical', updated_at: telemetry.timestamp })
  }, [telemetry])


  return (
    <TelemetryContext.Provider value={{
      telemetry,
      telemetryHistory,
      alerts,
      connected,
      lastValidAt,
      disconnectedAt,
      healthIndex,
      missionId,
      globalRul,
      isExploded,
      activeFaultScenario,
      triggerCinematicFault,
      resetCinematicFault,
    }}>
      {children}
    </TelemetryContext.Provider>
  )
}

// Keep backward-compat export so old imports don't break
export function useTelemetry() {
  const ctx = useContext(TelemetryContext)
  if (!ctx) throw new Error('useTelemetry must be used within TelemetryProvider')
  return ctx
}
