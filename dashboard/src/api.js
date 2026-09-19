/**
 * API client for the UAV Digital Twin backend.
 * Base URL defaults to http://localhost:8000.
 * Set VITE_API_URL env var to override (e.g., for different port).
 */

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const API_KEY = import.meta.env.VITE_API_KEY || 'uav-dev-key-2026';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY, ...options.headers },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${path} → ${res.status}: ${text}`);
  }
  return res.json();
}

// GET /telemetry/latest?mission_id=
export async function fetchLatest(missionId) {
  return apiFetch(`/telemetry/latest?mission_id=${encodeURIComponent(missionId)}`);
}

// GET /rul/{mission_id}
export async function fetchRUL(missionId) {
  return apiFetch(`/rul/${encodeURIComponent(missionId)}`);
}

// GET /faults/{mission_id}
export async function fetchFaults(missionId) {
  return apiFetch(`/faults/${encodeURIComponent(missionId)}`);
}

// GET /missions
export async function fetchMissions() {
  return apiFetch('/missions');
}

// GET /missions/{mission_id}/replay
export async function fetchReplay(missionId) {
  return apiFetch(`/missions/${encodeURIComponent(missionId)}/replay`);
}

export async function startSimulation(params) {
  const res = await fetch(`${BASE_URL}/simulation/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  return res.json();
}

// GET /health
export async function checkHealth() {
  return apiFetch('/health');
}

export function openTelemetryStream(missionId, onTelemetry, onError) {
  const url = `${BASE_URL}/telemetry/stream?mission_id=${encodeURIComponent(missionId)}&api_key=${encodeURIComponent(API_KEY)}`;
  const source = new EventSource(url);
  source.addEventListener('telemetry', (event) => onTelemetry(JSON.parse(event.data)));
  source.onerror = () => onError?.();
  return source;
}

export async function fetchMissionReport(missionId) {
  return apiFetch(`/missions/${encodeURIComponent(missionId)}/report`);
}

// POST /simulation/override
export async function applyOverride(missionId, action, value = 0) {
  return apiFetch('/simulation/override', {
    method: 'POST',
    body: JSON.stringify({ mission_id: missionId, action, value }),
  });
}

// POST /chat
export async function sendChat(question, missionId = null) {
  return apiFetch('/chat', {
    method: 'POST',
    body: JSON.stringify({ question, mission_id: missionId }),
  });
}
