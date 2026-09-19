import { useState, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import DroneModel from './DroneModel';

const FORMATION = [
  { id: 'lead',  pos: [0, 0, 0],    label: 'LEAD — UAV-01' },
  { id: 'left',  pos: [-6, 0, 3],   label: 'WING-L — UAV-02' },
  { id: 'right', pos: [6, 0, 3],    label: 'WING-R — UAV-03' },
];

function FormationDrone({ position, label, telemetry, healthScore, isSelected, onClick }) {
  return (
    <group position={position} onClick={onClick}>
      <DroneModel
        telemetry={telemetry}
        healthScore={healthScore}
        selectedPart={null}
        onSelectPart={() => {}}
      />
      {/* Label */}
      <mesh position={[0, 2, 0]}>
        <planeGeometry args={[0.01, 0.01]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </group>
  );
}

export default function FormationView({ telemetry }) {
  const [selected, setSelected] = useState('lead');

  // Simulate slightly different telemetry per drone
  const droneTelemetry = {
    lead:  telemetry,
    left:  telemetry ? { ...telemetry, rpm: (telemetry.rpm || 0) * 0.97, cht_c: (telemetry.cht_c || 0) * 0.95 } : null,
    right: telemetry ? { ...telemetry, rpm: (telemetry.rpm || 0) * 0.99, cht_c: (telemetry.cht_c || 0) * 0.92 } : null,
  };

  const droneHealth = {
    lead:  Math.max(0, 100 - ((telemetry?.cht_c || 0) - 150) * 0.5),
    left:  Math.max(0, 100 - ((telemetry?.cht_c || 0) - 150) * 0.45),
    right: Math.max(0, 100 - ((telemetry?.cht_c || 0) - 150) * 0.4),
  };

  const sel = FORMATION.find(f => f.id === selected);
  const selTelem = droneTelemetry[selected];
  const selHealth = droneHealth[selected];

  return (
    <div className="card" style={{ gridColumn: '1 / -1' }}>
      <h3 style={{ marginBottom: 12 }}>🛡️ Multi-UAV Formation View — V-Formation</h3>

      {/* Formation Selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {FORMATION.map(f => (
          <button
            key={f.id}
            onClick={() => setSelected(f.id)}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12,
              background: selected === f.id ? '#3b82f6' : '#1e2740',
              color: selected === f.id ? '#fff' : '#94a3b8',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 3D Canvas */}
      <div style={{ height: 380, borderRadius: 8, overflow: 'hidden' }}>
        <Canvas camera={{ position: [0, 8, 18], fov: 50 }}>
          <color attach="background" args={['#060a12']} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
          <spotLight position={[0, 20, 0]} intensity={0.6} color="#3b82f6" />
          <Environment preset="city" />

          <Suspense fallback={null}>
            {FORMATION.map(f => (
              <FormationDrone
                key={f.id}
                position={f.pos}
                label={f.label}
                telemetry={droneTelemetry[f.id]}
                healthScore={droneHealth[f.id]}
                isSelected={selected === f.id}
                onClick={() => setSelected(f.id)}
              />
            ))}
          </Suspense>

          <OrbitControls enablePan={false} minDistance={8} maxDistance={35} />
        </Canvas>
      </div>

      {/* Selected drone telemetry strip */}
      {selTelem && (
        <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
          <span style={{ color: '#94a3b8', fontSize: 12 }}>{sel?.label}</span>
          {[
            ['Health', `${(selHealth || 0).toFixed(0)}%`, selHealth < 50 ? '#ef4444' : selHealth < 75 ? '#f59e0b' : '#22c55e'],
            ['RPM', selTelem.rpm?.toFixed(0), null],
            ['CHT', `${selTelem.cht_c?.toFixed(1)}°C`, selTelem.cht_c > 240 ? '#ef4444' : null],
            ['Alt', `${selTelem.altitude_m?.toFixed(0)}m`, null],
            ['Oil', `${selTelem.oil_pressure_kpa?.toFixed(0)}kPa`, null],
          ].map(([label, val, col]) => (
            <div key={label} style={{ background: '#1e2740', padding: '4px 10px', borderRadius: 6 }}>
              <span style={{ fontSize: 10, color: '#64748b' }}>{label} </span>
              <span style={{ fontSize: 13, color: col || '#e2e8f0', fontWeight: 600 }}>{val}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
