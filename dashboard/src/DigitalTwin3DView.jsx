import { useState, useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Sparkles, Html, Trail } from '@react-three/drei';
import * as THREE from 'three';
import DroneModel from './DroneModel';
import DebrisExplosion from './DebrisExplosion';

// ── India-palette procedural terrain ──
function Terrain() {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(120, 120, 80, 80);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      const h = Math.sin(x * 0.12) * 1.2 + Math.cos(y * 0.09) * 0.9
              + Math.sin(x * 0.3 + y * 0.25) * 0.5
              + Math.cos(x * 0.05) * Math.sin(y * 0.07) * 2.0;
      pos.setZ(i, h);
    }
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]} receiveShadow geometry={geo}>
      <meshStandardMaterial color="#4a6a2a" roughness={0.85} metalness={0} flatShading />
    </mesh>
  );
}

// ── Altitude-based cloud clusters ──
function Clouds({ altitude }) {
  const opacity = useMemo(() => Math.min(0.7, Math.max(0, (altitude - 2000) / 1500)), [altitude]);
  const groupRef = useRef();
  
  useFrame((state) => {
    if (groupRef.current) {
      // Slowly drift clouds
      groupRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.05) * 3;
    }
  });

  if (opacity < 0.03) return null;
  return (
    <group ref={groupRef}>
      {[[-12,5,-15],[10,6,-10],[-5,7,-22],[18,4,-8],[-18,5.5,-6],[8,8,-25],[-8,4.5,8],[15,6,12]].map(([x,y,z],i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[2.2 + i * 0.3, 8, 8]} />
          <meshStandardMaterial color="#dde5f0" transparent opacity={opacity} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

// ── Speed lines ──
function SpeedLines({ speed }) {
  const ref = useRef();
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.position.z += (speed || 10) * delta;
      if (ref.current.position.z > 20) ref.current.position.z -= 40;
    }
  });
  return (
    <group ref={ref}>
      <Sparkles count={500} scale={[28, 16, 50]} size={1.8} speed={0} opacity={0.18} color="#a8c4ff" />
    </group>
  );
}

// ── Smoke trail from damaged engine ──
function SmokeTrail({ active }) {
  const particles = useRef([]);
  const meshRefs = useRef([]);
  const COUNT = 30;

  useFrame((state, delta) => {
    if (!active) return;
    // Move particles backward + up, respawn at origin
    for (let i = 0; i < COUNT; i++) {
      if (!meshRefs.current[i]) continue;
      const p = meshRefs.current[i];
      p.position.z += 6 * delta;
      p.position.y += 1.5 * delta;
      p.position.x += (Math.random() - 0.5) * 0.3 * delta;
      p.material.opacity = Math.max(0, p.material.opacity - 0.4 * delta);
      p.scale.multiplyScalar(1 + 0.5 * delta);
      
      if (p.position.z > 8 || p.material.opacity < 0.02) {
        p.position.set((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, 2.6);
        p.material.opacity = 0.5 + Math.random() * 0.3;
        p.scale.set(0.2, 0.2, 0.2);
      }
    }
  });

  if (!active) return null;

  return (
    <group>
      {Array.from({ length: COUNT }).map((_, i) => (
        <mesh
          key={i}
          ref={el => meshRefs.current[i] = el}
          position={[(Math.random()-0.5)*0.3, (Math.random()-0.5)*0.3, 2.6 + i * 0.3]}
        >
          <sphereGeometry args={[0.15 + Math.random() * 0.1, 6, 6]} />
          <meshBasicMaterial color="#333" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// ── Flying drone wrapper — adds bobbing, banking, vibration ──
function FlyingDrone({ telemetry, healthScore, selectedPart, onSelectPart, isExploded }) {
  const groupRef = useRef();
  
  useFrame((state) => {
    if (!groupRef.current || isExploded) return;
    const t = state.clock.elapsedTime;
    const vibration = telemetry?.vibration_g || 0;
    const throttle  = telemetry?.throttle_pct || 50;
    
    // Gentle bobbing (altitude feel)
    groupRef.current.position.y = Math.sin(t * 0.8) * 0.15;
    
    // Slight banking oscillation
    groupRef.current.rotation.z = Math.sin(t * 0.4) * 0.04;
    groupRef.current.rotation.x = Math.sin(t * 0.6) * 0.02;
    
    // Engine vibration shake (increases with actual vibration data)
    const shake = vibration * 2;
    groupRef.current.position.x = Math.sin(t * 25) * shake * 0.02;
    groupRef.current.position.z = Math.cos(t * 30) * shake * 0.015;
  });

  if (isExploded) {
    return <DebrisExplosion position={[0, 0, 0]} active={true} />;
  }

  const isDamaged = healthScore < 50;

  return (
    <group ref={groupRef}>
      <DroneModel
        telemetry={telemetry}
        healthScore={healthScore}
        selectedPart={selectedPart}
        onSelectPart={onSelectPart}
      />
      <SmokeTrail active={isDamaged} />
    </group>
  );
}



export default function DigitalTwin3DView({ telemetry, healthScore, onSelectPart }) {
  const [selectedPart, setSelectedPart] = useState(null);
  const [isExploded, setIsExploded] = useState(false);

  // Trigger explosion when health drops to critical
  useEffect(() => {
    if (healthScore <= 5) {
      setIsExploded(true);
    } else {
      setIsExploded(false);
    }
  }, [healthScore]);

  // Day/night
  const dayFactor = useMemo(() => {
    if (!telemetry?.timestamp) return 0.8;
    try {
      const h = new Date(telemetry.timestamp).getHours();
      if (h >= 6 && h < 18) return 1.0;
      if (h >= 18 && h < 20) return 0.5;
      return 0.15;
    } catch { return 0.8; }
  }, [telemetry?.timestamp]);

  const altitude = telemetry?.altitude_m || 0;
  const speed = (telemetry?.throttle_pct || 50) / 5;
  const bgColor = dayFactor > 0.7 ? '#0b1628' : dayFactor > 0.4 ? '#060f1c' : '#020508';
  const isCritical = healthScore < 30;

  return (
    <>
      <Canvas camera={{ position: [6, 3.5, 9], fov: 42 }} shadows>
        <color attach="background" args={[bgColor]} />
        
        {/* Dynamic lighting */}
        <ambientLight intensity={0.25 * dayFactor} />
        <directionalLight
          position={[10, 12, 5]} intensity={dayFactor * 0.9} castShadow
          color={dayFactor > 0.7 ? '#ffeedd' : '#2040a0'}
        />
        <spotLight position={[-8, -6, -8]} intensity={0.35} color="#3b82f6" />
        {isCritical && <pointLight position={[0, 0, 2.5]} intensity={1.5} color="#ff3000" distance={8} />}
        {dayFactor < 0.4 && <pointLight position={[0, 1, 0]} intensity={0.2} color="#ff6030" />}
        <Environment preset={dayFactor > 0.7 ? 'city' : 'night'} />

        {/* The flying drone */}
        <FlyingDrone
          telemetry={telemetry}
          healthScore={healthScore}
          selectedPart={selectedPart}
          onSelectPart={(part) => {
            setSelectedPart(part);
            if (onSelectPart) onSelectPart(part);
          }}
          isExploded={isExploded}
        />

        {/* Environment */}
        <SpeedLines speed={speed} />
        <Terrain />
        <Clouds altitude={altitude} />

        <OrbitControls enablePan={false} minPolarAngle={Math.PI / 5} maxPolarAngle={Math.PI / 1.5} minDistance={4} maxDistance={20} />
      </Canvas>
    </>
  );
}
