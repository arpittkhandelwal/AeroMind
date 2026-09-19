import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Explosion particle system — bursts outward then fades
export default function ExplosionEffect({ position = [0, 0, 0], active }) {
  const particlesRef = useRef();
  const startTime = useRef(null);
  const PARTICLE_COUNT = 200;

  const { positions, velocities, colors } = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const vel = new Float32Array(PARTICLE_COUNT * 3);
    const col = new Float32Array(PARTICLE_COUNT * 3);
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      // Start at center
      pos[i * 3] = 0;
      pos[i * 3 + 1] = 0;
      pos[i * 3 + 2] = 0;
      
      // Random outward velocity
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 3 + Math.random() * 12;
      vel[i * 3]     = Math.sin(phi) * Math.cos(theta) * speed;
      vel[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed + Math.random() * 4;
      vel[i * 3 + 2] = Math.cos(phi) * speed;
      
      // Fire colors: yellow → orange → red
      const t = Math.random();
      col[i * 3]     = 1;                      // R
      col[i * 3 + 1] = 0.3 + t * 0.7;         // G  
      col[i * 3 + 2] = t < 0.3 ? 0 : t * 0.1; // B
    }
    return { positions: pos, velocities: vel, colors: col };
  }, []);

  useFrame((state, delta) => {
    if (!active || !particlesRef.current) return;
    
    if (!startTime.current) startTime.current = state.clock.elapsedTime;
    const elapsed = state.clock.elapsedTime - startTime.current;
    
    if (elapsed > 4) return; // Animation done after 4s
    
    const posAttr = particlesRef.current.geometry.attributes.position;
    
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      posAttr.array[i * 3]     += velocities[i * 3] * delta;
      posAttr.array[i * 3 + 1] += velocities[i * 3 + 1] * delta - 4.9 * delta * elapsed; // gravity
      posAttr.array[i * 3 + 2] += velocities[i * 3 + 2] * delta;
    }
    posAttr.needsUpdate = true;
    
    // Fade out
    particlesRef.current.material.opacity = Math.max(0, 1 - elapsed / 3.5);
    particlesRef.current.material.size = Math.max(0.05, 0.4 - elapsed * 0.08);
  });

  if (!active) { startTime.current = null; return null; }

  return (
    <group position={position}>
      {/* Central flash */}
      <mesh>
        <sphereGeometry args={[1.5, 16, 16]} />
        <meshBasicMaterial color="#ff6600" transparent opacity={0.8} />
      </mesh>
      
      {/* Particles */}
      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={PARTICLE_COUNT} array={positions} itemSize={3} />
          <bufferAttribute attach="attributes-color" count={PARTICLE_COUNT} array={colors} itemSize={3} />
        </bufferGeometry>
        <pointsMaterial size={0.4} vertexColors transparent opacity={1} sizeAttenuation depthWrite={false} />
      </points>
    </group>
  );
}
