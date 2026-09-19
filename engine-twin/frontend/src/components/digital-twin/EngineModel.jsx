/**
 * EngineModel.jsx — High-Detail 3D Aircraft Engine Digital Twin
 * ==============================================================
 * Renders a 4-cylinder turbocharged aerospace powerplant:
 *   - 4 Cylinders with cooling fins and live EGT/CHT thermal heatmap
 *   - Crankcase with live RPM crankshaft motion
 *   - Turbocharger compressor & turbine housing
 *   - Lubrication sump & oil pump rail
 *   - Liquid cooling manifolds
 *   - Sensor probes with telemetry status indicators
 *   - Interactive raycast selection & component isolation
 */

import React, { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { componentHealthStatus } from './engineComponents'

// ── Materials ─────────────────────────────────────────────────────
const BASE_MAT = {
  block: new THREE.MeshStandardMaterial({
    color: '#334155',
    roughness: 0.45,
    metalness: 0.75,
  }),
  crankcase: new THREE.MeshStandardMaterial({
    color: '#1E293B',
    roughness: 0.35,
    metalness: 0.85,
  }),
  crankshaft: new THREE.MeshStandardMaterial({
    color: '#D97706',
    roughness: 0.25,
    metalness: 0.9,
  }),
  turbo: new THREE.MeshStandardMaterial({
    color: '#475569',
    roughness: 0.3,
    metalness: 0.8,
  }),
  turboHot: new THREE.MeshStandardMaterial({
    color: '#B45309',
    roughness: 0.4,
    metalness: 0.6,
    emissive: '#D97706',
    emissiveIntensity: 0.25,
  }),
  oilSump: new THREE.MeshStandardMaterial({
    color: '#0F172A',
    roughness: 0.5,
    metalness: 0.7,
  }),
  coolingManifold: new THREE.MeshStandardMaterial({
    color: '#0284C7',
    roughness: 0.3,
    metalness: 0.6,
  }),
  sensorProbe: new THREE.MeshStandardMaterial({
    color: '#10B981',
    roughness: 0.2,
    metalness: 0.9,
    emissive: '#10B981',
    emissiveIntensity: 0.4,
  }),
}

export default function EngineModel({
  telemetry,
  alerts,
  components,
  selectedId,
  isolatedId,
  wireframe = false,
  onSelectComponent,
}) {
  const crankRef = useRef()
  const rpm = telemetry?.rpm ?? 2840
  const egt = telemetry?.egt ?? 684
  const cht = telemetry?.cht ?? 172

  // Rotate crankshaft and pistons with real RPM
  useFrame((state, delta) => {
    if (crankRef.current) {
      const rotSpeed = (rpm / 60) * Math.PI * 2 * 0.1
      crankRef.current.rotation.x += rotSpeed * delta
    }
  })

  // Thermal heat glow calculation based on live EGT/CHT
  const thermalColor = useMemo(() => {
    if (egt > 780 || cht > 220) return '#DC2626' // critical red
    if (egt > 700 || cht > 190) return '#D97706' // warning amber
    return '#475569' // nominal metallic
  }, [egt, cht])

  const cylinderMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: thermalColor,
      roughness: 0.4,
      metalness: 0.7,
      emissive: thermalColor === '#475569' ? '#000000' : thermalColor,
      emissiveIntensity: thermalColor === '#475569' ? 0 : 0.35,
      wireframe,
    })
  }, [thermalColor, wireframe])

  const isDimmed = (id) => isolatedId && isolatedId !== id

  return (
    <group scale={[1.1, 1.1, 1.1]} position={[0, 0, 0]}>
      {/* ── CRANKCASE MAIN BLOCK ──────────────────────────────── */}
      <mesh
        position={[0, 0, 0]}
        material={BASE_MAT.crankcase}
        onClick={(e) => { e.stopPropagation(); onSelectComponent?.('crankshaft') }}
      >
        <boxGeometry args={[1.4, 0.9, 3.2]} />
      </mesh>

      {/* ── ROTATING CRANKSHAFT ──────────────────────────────── */}
      <group
        ref={crankRef}
        position={[0, -0.15, 0]}
        onClick={(e) => { e.stopPropagation(); onSelectComponent?.('crankshaft') }}
      >
        <mesh rotation={[Math.PI / 2, 0, 0]} material={BASE_MAT.crankshaft}>
          <cylinderGeometry args={[0.12, 0.12, 3.6, 24]} />
        </mesh>
        {/* Flywheel */}
        <mesh position={[0, 0, 1.8]} rotation={[Math.PI / 2, 0, 0]} material={BASE_MAT.crankshaft}>
          <cylinderGeometry args={[0.55, 0.55, 0.14, 32]} />
        </mesh>
      </group>

      {/* ── 4 CYLINDERS (HORIZONTALLY OPPOSED AERO ENGINE) ─────── */}
      {/* Cyl 1 (Port Forward) */}
      <group
        position={[-1.0, 0.1, 0.9]}
        onClick={(e) => { e.stopPropagation(); onSelectComponent?.('cyl1') }}
        opacity={isDimmed('cyl1') ? 0.2 : 1}
      >
        {/* Cylinder Barrel */}
        <mesh rotation={[0, 0, Math.PI / 2]} material={cylinderMaterial}>
          <cylinderGeometry args={[0.34, 0.34, 0.9, 24]} />
        </mesh>
        {/* Cooling Fins */}
        {[-0.3, -0.15, 0, 0.15, 0.3].map((off, idx) => (
          <mesh key={idx} position={[off, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={cylinderMaterial}>
            <cylinderGeometry args={[0.42, 0.42, 0.04, 24]} />
          </mesh>
        ))}
        {/* Cylinder Head */}
        <mesh position={[-0.55, 0, 0]} material={BASE_MAT.block}>
          <boxGeometry args={[0.25, 0.65, 0.65]} />
        </mesh>
        {/* Spark Plug / Temp Sensor */}
        <mesh position={[-0.55, 0.36, 0]} material={BASE_MAT.sensorProbe}>
          <cylinderGeometry args={[0.04, 0.04, 0.14, 12]} />
        </mesh>
        {selectedId === 'cyl1' && (
          <Html position={[-0.6, 0.5, 0]} center>
            <div style={{
              background: '#FFFFFF', border: '2px solid #D97706', borderRadius: 4,
              padding: '2px 8px', fontSize: 11, fontWeight: 700, color: '#0F172A',
              boxShadow: '0 4px 10px rgba(0,0,0,0.15)', whiteSpace: 'nowrap',
            }}>
              CYLINDER 1 · EGT {Math.round(egt)}°C
            </div>
          </Html>
        )}
      </group>

      {/* Cyl 2 (Starboard Forward) */}
      <group
        position={[1.0, 0.1, 0.9]}
        onClick={(e) => { e.stopPropagation(); onSelectComponent?.('cyl2') }}
        opacity={isDimmed('cyl2') ? 0.2 : 1}
      >
        <mesh rotation={[0, 0, -Math.PI / 2]} material={cylinderMaterial}>
          <cylinderGeometry args={[0.34, 0.34, 0.9, 24]} />
        </mesh>
        {[-0.3, -0.15, 0, 0.15, 0.3].map((off, idx) => (
          <mesh key={idx} position={[off, 0, 0]} rotation={[0, 0, -Math.PI / 2]} material={cylinderMaterial}>
            <cylinderGeometry args={[0.42, 0.42, 0.04, 24]} />
          </mesh>
        ))}
        <mesh position={[0.55, 0, 0]} material={BASE_MAT.block}>
          <boxGeometry args={[0.25, 0.65, 0.65]} />
        </mesh>
        <mesh position={[0.55, 0.36, 0]} material={BASE_MAT.sensorProbe}>
          <cylinderGeometry args={[0.04, 0.04, 0.14, 12]} />
        </mesh>
      </group>

      {/* Cyl 3 (Port Aft) */}
      <group
        position={[-1.0, 0.1, -0.9]}
        onClick={(e) => { e.stopPropagation(); onSelectComponent?.('cyl3') }}
        opacity={isDimmed('cyl3') ? 0.2 : 1}
      >
        <mesh rotation={[0, 0, Math.PI / 2]} material={cylinderMaterial}>
          <cylinderGeometry args={[0.34, 0.34, 0.9, 24]} />
        </mesh>
        {[-0.3, -0.15, 0, 0.15, 0.3].map((off, idx) => (
          <mesh key={idx} position={[off, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={cylinderMaterial}>
            <cylinderGeometry args={[0.42, 0.42, 0.04, 24]} />
          </mesh>
        ))}
        <mesh position={[-0.55, 0, 0]} material={BASE_MAT.block}>
          <boxGeometry args={[0.25, 0.65, 0.65]} />
        </mesh>
        <mesh position={[-0.55, 0.36, 0]} material={BASE_MAT.sensorProbe}>
          <cylinderGeometry args={[0.04, 0.04, 0.14, 12]} />
        </mesh>
      </group>

      {/* Cyl 4 (Starboard Aft) */}
      <group
        position={[1.0, 0.1, -0.9]}
        onClick={(e) => { e.stopPropagation(); onSelectComponent?.('cyl4') }}
        opacity={isDimmed('cyl4') ? 0.2 : 1}
      >
        <mesh rotation={[0, 0, -Math.PI / 2]} material={cylinderMaterial}>
          <cylinderGeometry args={[0.34, 0.34, 0.9, 24]} />
        </mesh>
        {[-0.3, -0.15, 0, 0.15, 0.3].map((off, idx) => (
          <mesh key={idx} position={[off, 0, 0]} rotation={[0, 0, -Math.PI / 2]} material={cylinderMaterial}>
            <cylinderGeometry args={[0.42, 0.42, 0.04, 24]} />
          </mesh>
        ))}
        <mesh position={[0.55, 0, 0]} material={BASE_MAT.block}>
          <boxGeometry args={[0.25, 0.65, 0.65]} />
        </mesh>
        <mesh position={[0.55, 0.36, 0]} material={BASE_MAT.sensorProbe}>
          <cylinderGeometry args={[0.04, 0.04, 0.14, 12]} />
        </mesh>
      </group>

      {/* ── TURBOCHARGER ASSEMBLY ────────────────────────────── */}
      <group
        position={[0, 0.65, -1.2]}
        onClick={(e) => { e.stopPropagation(); onSelectComponent?.('turbo') }}
        opacity={isDimmed('turbo') ? 0.2 : 1}
      >
        {/* Turbine Scroll (Hot Side) */}
        <mesh rotation={[0, Math.PI / 2, 0]} material={BASE_MAT.turboHot}>
          <torusGeometry args={[0.32, 0.15, 16, 32]} />
        </mesh>
        {/* Compressor Scroll (Cold Side) */}
        <mesh position={[0, 0, -0.32]} rotation={[0, Math.PI / 2, 0]} material={BASE_MAT.turbo}>
          <torusGeometry args={[0.32, 0.14, 16, 32]} />
        </mesh>
        {/* Center Bearing Housing */}
        <mesh position={[0, 0, -0.16]} rotation={[Math.PI / 2, 0, 0]} material={BASE_MAT.block}>
          <cylinderGeometry args={[0.18, 0.18, 0.24, 20]} />
        </mesh>
      </group>

      {/* ── LUBRICATION OIL SUMP & PUMP (BOTTOM) ─────────────── */}
      <group
        position={[0, -0.65, 0]}
        onClick={(e) => { e.stopPropagation(); onSelectComponent?.('lubrication') }}
        opacity={isDimmed('lubrication') ? 0.2 : 1}
      >
        {/* Oil Pan Reservoir */}
        <mesh material={BASE_MAT.oilSump}>
          <boxGeometry args={[1.2, 0.4, 2.8]} />
        </mesh>
        {/* Oil Filter Canister */}
        <mesh position={[0.5, -0.1, 0.8]} rotation={[0, 0, 0]} material={BASE_MAT.crankcase}>
          <cylinderGeometry args={[0.16, 0.16, 0.45, 20]} />
        </mesh>
      </group>

      {/* ── COOLING MANIFOLDS & RAILS ─────────────────────────── */}
      <group
        position={[0, 0.55, 0]}
        onClick={(e) => { e.stopPropagation(); onSelectComponent?.('cooling') }}
        opacity={isDimmed('cooling') ? 0.2 : 1}
      >
        {/* Coolant Distribution Pipe */}
        <mesh rotation={[Math.PI / 2, 0, 0]} material={BASE_MAT.coolingManifold}>
          <cylinderGeometry args={[0.08, 0.08, 2.6, 16]} />
        </mesh>
      </group>
    </group>
  )
}
