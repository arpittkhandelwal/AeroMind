/**
 * Architecture.jsx — System Architecture Page
 * Explains the full pipeline from data-sim → edge → ML → API → Frontend
 */

import React from 'react'
import { Database, Cpu, Activity, Server, Monitor, Layers } from 'lucide-react'
import Panel from '../components/ui/Panel'

function PipelineStep({ icon: Icon, title, subtitle, bullets, color = '#0284C7', tech }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: `1px solid ${color}33`,
      borderLeft: `4px solid ${color}`,
      borderRadius: 8,
      padding: '20px 24px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <div style={{ background: `${color}15`, borderRadius: 8, padding: 10 }}>
          <Icon size={22} style={{ color }} />
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#0F172A' }}>{title}</div>
          <div style={{ fontSize: 12, color: '#64748B' }}>{subtitle}</div>
        </div>
      </div>
      <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>{b}</li>
        ))}
      </ul>
      {tech && (
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {tech.map(t => (
            <span key={t} style={{
              fontSize: 11, fontWeight: 700,
              background: `${color}15`, color,
              border: `1px solid ${color}30`,
              padding: '2px 8px', borderRadius: 4
            }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function Arrow() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '4px 0' }}>
      <div style={{ width: 2, height: 24, background: '#CBD5E1' }} />
      <div style={{ position: 'absolute', width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderTop: '8px solid #CBD5E1', marginTop: 24 }} />
    </div>
  )
}

const PIPELINE = [
  {
    icon: Activity,
    title: 'Data Simulator (data-sim)',
    subtitle: 'Physics-based synthetic telemetry generation',
    color: '#8B5CF6',
    bullets: [
      'Generates synthetic engine telemetry at 1 Hz for 7 fault classes + nominal',
      'Uses parametric noise models tuned to MALE UAV engine characteristics',
      'Streams to backend via POST /telemetry/ingest',
    ],
    tech: ['Python', 'NumPy', 'configparser'],
  },
  {
    icon: Layers,
    title: 'Edge Preprocessing (edge-preprocessing)',
    subtitle: 'Signal conditioning & feature engineering',
    color: '#0891B2',
    bullets: [
      'Applies range validation, rolling statistics (mean/min/max over 5-frame windows)',
      'Computes physics residuals: actual − expected (from thermodynamic model)',
      'Produces 58-feature vector used by ML models',
    ],
    tech: ['Python', 'Pandas', 'scikit-learn (StandardScaler)'],
  },
  {
    icon: Cpu,
    title: 'Physics Model (physics-model)',
    subtitle: 'Thermodynamic baseline calculator',
    color: '#D97706',
    bullets: [
      'Computes expected EGT, CHT, oil pressure, fuel flow from RPM + throttle + altitude + ambient temp',
      'Uses semi-empirical aero-piston relationships (e.g. density ratio at altitude)',
      'Residuals feed directly into ML feature vector and the "Physics vs Reality" UI',
    ],
    tech: ['Python', 'thermodynamic equations'],
  },
  {
    icon: Database,
    title: 'ML Service (ml-fault-rul)',
    subtitle: 'Fault classification & RUL estimation',
    color: '#DC2626',
    bullets: [
      'Random Forest classifier: 8 classes, 92% accuracy on held-out test set (264,600 frames)',
      'Gradient Boosting regressor: RUL estimation from continuous features',
      'Trained on 928,800 frames of synthetic telemetry',
      'Feature importance (Gini) surfaced to UI for transparency',
    ],
    tech: ['scikit-learn', 'Random Forest', 'Gradient Boosting', 'joblib'],
  },
  {
    icon: Server,
    title: 'Backend API (backend-api)',
    subtitle: 'REST API gateway with SQLite persistence',
    color: '#059669',
    bullets: [
      'FastAPI with API-key authentication (X-API-Key header)',
      'SQLite: missions, telemetry_frames, alerts, rul_estimates tables',
      'Endpoints: /telemetry/ingest, /telemetry/latest, /rul/{id}, /faults/{id}, /missions/{id}/replay, /ai/query',
    ],
    tech: ['FastAPI', 'SQLite', 'Python', 'uvicorn'],
  },
  {
    icon: Monitor,
    title: 'Frontend (engine-twin)',
    subtitle: 'Ground Control Station UI',
    color: '#0284C7',
    bullets: [
      'React SPA with React Router — 9 pages: Overview, Live Monitor, Fleet View, Digital Twin, Physics vs Reality, Diagnostics, Predictions, Simulator, Replay',
      '3D engine model rendered with Three.js / React Three Fiber with fault injection visualisation',
      'Polls backend at ~1 Hz (REST) — live SSE stream is a documented roadmap item',
      'DRDO AI Commander chat interface with context-aware responses',
    ],
    tech: ['React', 'Three.js', 'React Three Fiber', 'Recharts', 'Lucide Icons'],
  },
]

export default function Architecture() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>
          System Architecture
        </h1>
        <p style={{ margin: '6px 0 0', fontSize: 14, color: '#475569' }}>
          DRDO PS 26054 · SIH 2026 · AI-Enabled Real-Time Digital Twin for MALE UAV Aero Piston Engines
        </p>
      </div>

      {/* Pipeline diagram */}
      <Panel>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20, borderBottom: '1px solid #E2E8F0', paddingBottom: 10 }}>
          Processing Pipeline
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {PIPELINE.map((step, idx) => (
            <div key={step.title}>
              <PipelineStep {...step} />
              {idx < PIPELINE.length - 1 && <Arrow />}
            </div>
          ))}
        </div>
      </Panel>

      {/* Data & model facts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[
          { label: 'Training Samples', value: '928,800', unit: 'frames', color: '#8B5CF6' },
          { label: 'Test Samples', value: '264,600', unit: 'frames', color: '#0284C7' },
          { label: 'Fault Classes', value: '8', unit: 'classes', color: '#D97706' },
          { label: 'Classifier Accuracy', value: '92.0%', unit: 'on test set', color: '#059669' },
          { label: 'Pipeline Latency', value: '<50ms', unit: 'ingest → alert', color: '#DC2626' },
          { label: 'Feature Vector', value: '58', unit: 'features', color: '#0891B2' },
        ].map(item => (
          <div key={item.label} style={{
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 8,
            padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{item.label}</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: item.color, fontFamily: 'monospace' }}>{item.value}</div>
            <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>{item.unit}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
