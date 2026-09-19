/**
 * useTelemetry.js — Hook to consume the TelemetryContext
 * Separated from TelemetryContext.jsx so Vite can Fast Refresh both independently.
 */
import { useContext } from 'react'
import { TelemetryContext } from './TelemetryContext'

export function useTelemetry() {
  const ctx = useContext(TelemetryContext)
  if (!ctx) throw new Error('useTelemetry must be used within TelemetryProvider')
  return ctx
}
