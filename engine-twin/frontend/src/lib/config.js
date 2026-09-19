/**
 * config.js — centralised environment / URL constants
 * =====================================================
 * Wired to the UAV Digital Twin backend on port 8000.
 * The engine-twin frontend uses Server-Sent Events (SSE) for live telemetry.
 *
 * API Auth: X-API-Key header is required on all backend endpoints.
 * Set VITE_API_KEY in .env for production. Dev default: 'uav-dev-key-2026'
 */

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
export const API_KEY = import.meta.env.VITE_API_KEY  || 'uav-dev-key-2026'

// Helper: returns headers object with API key included
export function apiHeaders(extra = {}) {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY,
    ...extra,
  }
}
