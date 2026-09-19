import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Fragments the airframe into flying debris like files 2 prototype
export default function DebrisExplosion({ position = [0, 0, 0], active }) {
  const debrisRef = useRef();
  const startTime = useRef(null);
  const COUNT = 120;

  const { positions, velocities, rotations, rotVelocities, colors, scales } = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    const vel = new Float32Array(COUNT * 3);
    const rot = new Float32Array(COUNT * 3);
    const rVel = new Float32Array(COUNT * 3);
    const col = new Float32Array(COUNT * 3);
    const sc = new Float32Array(COUNT * 3);
    
    // MAT.top, MAT.belly, MAT.matte, MAT.metal from files 2
    const mats = [
      new THREE.Color('#99a1a9'), // top camo
      new THREE.Color('#8b939b'), // belly
      new THREE.Color('#1b1d1e'), // matte
      new THREE.Color('#6e737a'), // metal
    ];

    for (let i = 0; i < COUNT; i++) {
      // initial spread: m.position.set((Math.random()-.5)*7, (Math.random()-.5)*1.6, (Math.random()-.5)*8)
      pos[i * 3]     = (Math.random() - 0.5) * 7;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 1.6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 8;
      
      // var dir = m.position.clone().normalize();
      const len = Math.hypot(pos[i*3], pos[i*3+1], pos[i*3+2]) || 1;
      const dx = pos[i*3]/len;
      const dz = pos[i*3+2]/len;

      // v:new THREE.Vector3(dir.x*(6+Math.random()*12)-4, 2+Math.random()*12, dir.z*(6+Math.random()*12))
      vel[i * 3]     = dx * (6 + Math.random() * 12) - 4;
      vel[i * 3 + 1] = 2 + Math.random() * 12;
      vel[i * 3 + 2] = dz * (6 + Math.random() * 12);
      
      // rv:new THREE.Vector3((Math.random()-.5)*9,(Math.random()-.5)*9,(Math.random()-.5)*9)
      rVel[i * 3]     = (Math.random() - 0.5) * 9;
      rVel[i * 3 + 1] = (Math.random() - 0.5) * 9;
      rVel[i * 3 + 2] = (Math.random() - 0.5) * 9;

      // scale
      sc[i * 3]     = 0.12 + Math.random() * 0.5;
      sc[i * 3 + 1] = 0.1 + Math.random() * 0.35;
      sc[i * 3 + 2] = 0.1 + Math.random() * 0.45;

      const c = mats[i % mats.length];
      col[i * 3]     = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return { positions: pos, velocities: vel, rotations: rot, rotVelocities: rVel, colors: col, scales: sc };
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const flashMat = useRef();

  useFrame((state, delta) => {
    if (!active || !debrisRef.current) return;
    if (!startTime.current) startTime.current = state.clock.elapsedTime;
    
    const elapsed = state.clock.elapsedTime - startTime.current;
    if (elapsed > 10) return; // Stop animating after 10s
    
    for (let i = 0; i < COUNT; i++) {
      // update position
      positions[i * 3]     += velocities[i * 3] * delta;
      positions[i * 3 + 1] += velocities[i * 3 + 1] * delta;
      positions[i * 3 + 2] += velocities[i * 3 + 2] * delta;

      // gravity
      velocities[i * 3 + 1] -= 9.8 * delta;

      // ground collision (y = -1.5)
      if (positions[i * 3 + 1] < -1.5) {
        positions[i * 3 + 1] = -1.5;
        velocities[i * 3] *= 0.5; // friction
        velocities[i * 3 + 1] *= -0.3; // bounce
        velocities[i * 3 + 2] *= 0.5;
        rotVelocities[i*3] *= 0.5;
        rotVelocities[i*3+1] *= 0.5;
        rotVelocities[i*3+2] *= 0.5;
      }

      // update rotation
      rotations[i * 3]     += rotVelocities[i * 3] * delta;
      rotations[i * 3 + 1] += rotVelocities[i * 3 + 1] * delta;
      rotations[i * 3 + 2] += rotVelocities[i * 3 + 2] * delta;

      // set matrix
      dummy.position.set(positions[i*3], positions[i*3+1], positions[i*3+2]);
      dummy.rotation.set(rotations[i*3], rotations[i*3+1], rotations[i*3+2]);
      dummy.scale.set(scales[i*3], scales[i*3+1], scales[i*3+2]);
      dummy.updateMatrix();
      debrisRef.current.setMatrixAt(i, dummy.matrix);
    }
    
    debrisRef.current.instanceMatrix.needsUpdate = true;
    
    // fade out the flash
    if (flashMat.current) {
      flashMat.current.opacity = Math.max(0, 0.8 - elapsed * 2);
    }
  });

  if (!active) { startTime.current = null; return null; }

  return (
    <group position={position}>
      {/* Central flash */}
      <mesh>
        <sphereGeometry args={[2.5, 16, 16]} />
        <meshBasicMaterial ref={flashMat} color="#ff5500" transparent opacity={0.8} depthWrite={false} />
      </mesh>
      <pointLight intensity={30} distance={50} color="#ff3000" decay={2} />
      
      {/* Debris instanced mesh */}
      <instancedMesh ref={debrisRef} args={[null, null, COUNT]}>
        <boxGeometry args={[1, 1, 1]}>
          <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
        </boxGeometry>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </instancedMesh>
    </group>
  );
}
