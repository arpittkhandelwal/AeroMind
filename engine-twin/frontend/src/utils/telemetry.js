/**
 * telemetry.js — Display formatting utilities
 * ============================================
 * Pure functions for formatting telemetry values for display.
 * No state, no React imports, fully testable.
 *
 * These helpers live separately from telemetryService.js so that
 * components can use formatting without importing normalization logic.
 */

/**
 * Format an ISO timestamp for display.
 * @param {string|null} ts
 * @param {'time'|'datetime'|'relative'} mode
 */
export function formatTimestamp(ts, mode = 'time') {
  if (!ts) return '—'
  const d = new Date(ts)
  if (isNaN(d)) return ts

  if (mode === 'time') {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }
  if (mode === 'datetime') {
    return d.toLocaleString([], {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  }
  if (mode === 'relative') {
    const diffMs = Date.now() - d.getTime()
    const secs = Math.round(diffMs / 1000)
    if (secs < 60)  return `${secs}s ago`
    if (secs < 3600) return `${Math.round(secs / 60)}m ago`
    return `${Math.round(secs / 3600)}h ago`
  }
  return d.toISOString()
}

/**
 * Format UTC time string HH:MM:SS from current time.
 */
export function utcTimeString() {
  const now = new Date()
  return [now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':')
}

/**
 * Colour token for a status string.
 * Works for NORMAL/WARNING/CRITICAL and HEALTHY/MONITOR etc.
 */
export function colorForStatus(status) {
  switch (status?.toUpperCase()) {
    case 'NORMAL':   case 'HEALTHY': case 'NOMINAL': case 'ONLINE': return '#39D98A'
    case 'WARNING':  case 'MONITOR': case 'DEGRADED':               return '#F2B84B'
    case 'CRITICAL':                                                 return '#FF5C5C'
    case 'NO DATA':                                                  return '#4A6270'
    default:                                                         return '#8FA1A9'
  }
}

/**
 * Colour token for a deviation direction.
 */
export function colorForDeviation(direction) {
  if (direction === 'above') return '#F2B84B'
  if (direction === 'below') return '#FF5C5C'
  return '#39D98A'
}

/**
 * Format a deviation as a display string.
 * @param {{ delta, pct, direction }|null} dev
 */
export function formatDeviation(dev) {
  if (!dev) return '—'
  const sign = dev.delta >= 0 ? '+' : ''
  return `${sign}${dev.pct.toFixed(1)}%`
}

/**
 * Truncate a fault type string for display labels.
 */
export function formatFaultType(ft) {
  if (!ft) return 'NORMAL'
  return ft.replace(/_/g, ' ').toUpperCase()
}

/**
 * Clamp a 0–100 health score to a display-safe integer.
 */
export function formatHealthScore(score) {
  if (score == null || isNaN(score)) return '—'
  return `${Math.round(Math.max(0, Math.min(100, score)))}%`
}
