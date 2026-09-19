/**
 * EngineTwin.jsx — MALE UAV 3D Digital Twin Stage
 * ===============================================
 * Features the interactive 3D model of the MALE UAV:
 *   - Turkish Aerospace Industries Anka-S high-detail Sketchfab 3D model
 *   - Full 3D orbit, zoom, pan, autospin, and VR/XR spatial tracking
 *   - Dedicated Engine Digital Twin core view for component-level thermal inspection
 *   - Aerospace telemetry overlay and mission context
 */

import React, { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { RotateCw, Plane, Cpu, ExternalLink } from 'lucide-react'
import EngineModel from './EngineModel'
import { ENGINE_COMPONENTS } from './engineComponents'
import DigitalTwin3DView from './DigitalTwin3DView'

export default function EngineTwin({
  telemetry,
  alerts,
  healthIndex,
  connected,
  selectedId,
  isolatedId,
  onSelectComponent,
  missionState,
}) {
  const [viewMode, setViewMode] = useState('uav') // 'uav' | 'engine'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      position: 'relative',
    }}>
      {/* ── TOP WORKSTATION TOOLBAR ──────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: '#FFFFFF',
        border: '1px solid #E2E8F0',
        borderRadius: '6px 6px 0 0',
        borderBottom: 'none',
        flexWrap: 'wrap',
        gap: 12,
      }}>
        {/* View Mode Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex',
            background: '#F1F5F9',
            padding: 3,
            borderRadius: 6,
            border: '1px solid #E2E8F0',
          }}>
            <button
              onClick={() => setViewMode('uav')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                border: 'none',
                borderRadius: 4,
                background: viewMode === 'uav' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'uav' ? '#0F172A' : '#64748B',
                fontSize: 13,
                fontWeight: viewMode === 'uav' ? 700 : 500,
                cursor: 'pointer',
                boxShadow: viewMode === 'uav' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Plane size={14} color={viewMode === 'uav' ? '#D97706' : '#64748B'} />
              MALE UAV Platform (Anka-S 3D)
            </button>

            <button
              onClick={() => setViewMode('engine')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                border: 'none',
                borderRadius: 4,
                background: viewMode === 'engine' ? '#FFFFFF' : 'transparent',
                color: viewMode === 'engine' ? '#0F172A' : '#64748B',
                fontSize: 13,
                fontWeight: viewMode === 'engine' ? 700 : 500,
                cursor: 'pointer',
                boxShadow: viewMode === 'engine' ? '0 1px 3px rgba(15, 23, 42, 0.08)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <Cpu size={14} color={viewMode === 'engine' ? '#0284C7' : '#64748B'} />
              Engine Propulsion Twin
            </button>
          </div>
        </div>

        {/* Right Status Badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            fontSize: 11,
            fontWeight: 700,
            color: '#059669',
            background: '#ECFDF5',
            border: '1px solid #A7F3D0',
            padding: '3px 10px',
            borderRadius: 12,
            letterSpacing: '0.04em',
          }}>
            3D SPATIAL MODEL READY
          </span>
        </div>
      </div>

      {/* ── 3D VIEWPORT CONTAINER ────────────────────────────────── */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: 600,
        minHeight: 560,
        background: '#0F172A',
        border: '1px solid #E2E8F0',
        borderRadius: '0 0 6px 6px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px -4px rgba(15, 23, 42, 0.08)',
      }}>
        {viewMode === 'uav' ? (
          /* Interactive R3F Digital Twin Simulation */
          <DigitalTwin3DView
            telemetry={telemetry}
            healthScore={healthIndex?.score ?? 100}
            onSelectPart={() => {}}
            missionState={missionState}
          />
        ) : (
          /* 3D Engine Component Thermal View */
          <Canvas
            camera={{ position: [2.6, 1.6, 2.6], fov: 42, near: 0.1, far: 100 }}
            gl={{ antialias: true, alpha: false }}
            style={{ width: '100%', height: '100%', background: '#F8FAFC' }}
          >
            <ambientLight intensity={0.8} />
            <directionalLight position={[6, 10, 6]} intensity={1.2} />
            <directionalLight position={[-6, 4, -6]} intensity={0.4} color="#0284C7" />
            <OrbitControls enableDamping dampingFactor={0.06} target={[0, 0, 0]} />
            <Grid
              args={[20, 20]}
              cellSize={1}
              cellThickness={0.5}
              cellColor="#CBD5E1"
              sectionSize={4}
              sectionThickness={1}
              sectionColor="#94A3B8"
              position={[0, -0.9, 0]}
            />
            <EngineModel
              telemetry={telemetry}
              alerts={alerts}
              components={ENGINE_COMPONENTS}
              selectedId={selectedId}
              isolatedId={isolatedId}
              wireframe={false}
              onSelectComponent={onSelectComponent}
            />
          </Canvas>
        )}
      </div>
    </div>
  )
}
