/**
 * JuryDemoButton.jsx — Floating Jury Demo Sequence Launcher
 * ==========================================================
 * A sticky floating button that walks the jury through the demo sequence.
 * Sequence: Fleet View → UAV select → Digital Twin → Mission Start
 *           → Normal → Fault Inject → Residuals → AI Detection → RUL Drop → Catastrophic
 *
 * Located in AppShell so it appears on every page.
 */

import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Presentation, X, ChevronRight, ChevronLeft } from 'lucide-react'

const DEMO_STEPS = [
  {
    step: 1,
    title: 'Fleet Overview',
    description: 'Show the 3-UAV fleet with independent health monitoring',
    action: 'Go to Fleet View',
    route: '/fleet',
  },
  {
    step: 2,
    title: 'Live Monitor',
    description: 'Show real-time 1 Hz telemetry stream with live sensor charts',
    action: 'Go to Live Monitor',
    route: '/live',
  },
  {
    step: 3,
    title: 'Digital Twin',
    description: 'Open the 3D engine model — point to the engine components',
    action: 'Open Digital Twin',
    route: '/digital-twin',
  },
  {
    step: 4,
    title: 'Physics vs Reality',
    description: 'Show physics residuals — explain actual vs expected values',
    action: 'Physics vs Reality',
    route: '/physics-reality',
  },
  {
    step: 5,
    title: 'Mission Simulator',
    description: 'Inject a fault (e.g. Overheating) and start the mission',
    action: 'Go to Simulator',
    route: '/simulator',
  },
  {
    step: 6,
    title: 'AI Diagnostics',
    description: 'AI detects the fault — show Random Forest classification + feature importance',
    action: 'Go to Diagnostics',
    route: '/diagnostics',
  },
  {
    step: 7,
    title: 'RUL Predictions',
    description: 'Show RUL drop — Gradient Boosting prognosis chart',
    action: 'Go to Predictions',
    route: '/predictions',
  },
  {
    step: 8,
    title: 'Mission Replay',
    description: 'Scrub the mission timeline — show full fault progression',
    action: 'Go to Replay',
    route: '/replay',
  },
  {
    step: 9,
    title: 'System Architecture',
    description: 'Explain the full pipeline: data-sim → edge → ML → API → UI',
    action: 'View Architecture',
    route: '/architecture',
  },
]

export default function JuryDemoButton() {
  const [open, setOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const navigate = useNavigate()

  const step = DEMO_STEPS[currentStep]

  const handleGo = () => {
    navigate(step.route)
    setOpen(false)
  }

  const handleNext = () => {
    if (currentStep < DEMO_STEPS.length - 1) setCurrentStep(s => s + 1)
  }

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1)
  }

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        id="jury-demo-btn"
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 18px',
          background: open ? '#0F172A' : '#D97706',
          color: '#FFFFFF',
          border: 'none',
          borderRadius: 32,
          fontSize: 13,
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          transition: 'background 0.2s',
          letterSpacing: '0.04em',
        }}
        title="Jury Demo Mode"
      >
        {open ? <X size={16} /> : <Presentation size={16} />}
        {open ? 'CLOSE' : 'JURY DEMO'}
      </button>

      {/* Demo Panel */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 80,
          right: 28,
          zIndex: 999,
          width: 340,
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 12,
          boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            background: '#0F172A',
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#D97706', letterSpacing: '0.12em' }}>
                JURY DEMO SEQUENCE
              </div>
              <div style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
                SIH 2026 · DRDO PS 26054
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#64748B', fontFamily: 'monospace' }}>
              {currentStep + 1}/{DEMO_STEPS.length}
            </div>
          </div>

          {/* Step Progress */}
          <div style={{ height: 3, background: '#F1F5F9' }}>
            <div style={{
              height: '100%',
              width: `${((currentStep + 1) / DEMO_STEPS.length) * 100}%`,
              background: '#D97706',
              transition: 'width 0.3s ease'
            }} />
          </div>

          {/* Step Content */}
          <div style={{ padding: '20px 18px' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#EFF6FF', color: '#0284C7',
              border: '1px solid #BFDBFE',
              borderRadius: 4, padding: '2px 8px',
              fontSize: 11, fontWeight: 800,
              marginBottom: 10
            }}>
              STEP {step.step}
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
              {step.title}
            </div>
            <div style={{ fontSize: 13, color: '#475569', lineHeight: 1.6, marginBottom: 18 }}>
              {step.description}
            </div>
            <button
              id={`jury-go-step-${step.step}`}
              onClick={handleGo}
              style={{
                width: '100%',
                padding: '10px',
                background: '#D97706',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              {step.action} <ChevronRight size={16} />
            </button>
          </div>

          {/* Navigation */}
          <div style={{
            borderTop: '1px solid #E2E8F0',
            padding: '12px 18px',
            display: 'flex',
            justifyContent: 'space-between',
          }}>
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'none', border: '1px solid #E2E8F0',
                borderRadius: 6, padding: '6px 12px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                color: currentStep === 0 ? '#CBD5E1' : '#475569',
              }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <div style={{ display: 'flex', gap: 4 }}>
              {DEMO_STEPS.map((_, i) => (
                <div
                  key={i}
                  onClick={() => setCurrentStep(i)}
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: i === currentStep ? '#D97706' : '#E2E8F0',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                />
              ))}
            </div>
            <button
              onClick={handleNext}
              disabled={currentStep === DEMO_STEPS.length - 1}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: currentStep < DEMO_STEPS.length - 1 ? '#0F172A' : 'none',
                border: '1px solid #E2E8F0',
                borderRadius: 6, padding: '6px 12px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                color: currentStep === DEMO_STEPS.length - 1 ? '#CBD5E1' : '#FFFFFF',
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
