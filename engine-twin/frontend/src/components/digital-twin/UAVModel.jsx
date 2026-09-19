import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import { WAYPOINTS, MISSION_SEQUENCE } from '../../hooks/useMissionState';

// Texture generators
function noiseCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

function camoTexture(top) {
  const c = noiseCanvas(512, 512, (x, w, h) => {
    x.fillStyle = top ? '#79818a' : '#99a1a9';
    x.fillRect(0, 0, w, h);
    const blob = top ? ['#6c747d', '#858d96', '#5f676f'] : ['#a4acb4', '#8b939b'];
    for (let i = 0; i < 110; i++) {
      x.fillStyle = blob[i % blob.length];
      x.globalAlpha = 0.28;
      x.beginPath();
      x.ellipse(Math.random() * w, Math.random() * h, 14 + Math.random() * 52, 10 + Math.random() * 34, Math.random() * Math.PI, 0, 6.3);
      x.fill();
    }
    x.globalAlpha = 1;
    x.strokeStyle = 'rgba(0,0,0,.28)'; x.lineWidth = 1.4;
    for (let p = 0; p < w; p += 64) { x.beginPath(); x.moveTo(p, 0); x.lineTo(p, h); x.stroke(); }
    for (let q = 0; q < h; q += 86) { x.beginPath(); x.moveTo(0, q); x.lineTo(w, q); x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,.22)';
    for (let r = 0; r < w; r += 64) for (let s = 8; s < h; s += 17) { x.fillRect(r - 1, s, 2, 2); }
    for (let g = 0; g < 400; g++) {
      x.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
      x.fillRect(Math.random() * w, Math.random() * h, Math.random() * 40, Math.random() * 4);
    }
  });
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function roundelTexture() {
  const c = noiseCanvas(256, 256, (x, w, h) => {
    x.fillStyle = '#FF9933'; x.fillRect(0, 0, w, h / 3);
    x.fillStyle = '#FFFFFF'; x.fillRect(0, h / 3, w, h / 3);
    x.fillStyle = '#138808'; x.fillRect(0, 2 * h / 3, w, h / 3);
    const cx = 128, cy = 128, R = 46;
    x.strokeStyle = '#0a2a8f'; x.fillStyle = '#0a2a8f';
    x.lineWidth = 3.2; x.beginPath(); x.arc(cx, cy, R, 0, 6.2832); x.stroke();
    x.lineWidth = 1.5;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * 6.2832;
      x.beginPath();
      x.moveTo(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7);
      x.lineTo(cx + Math.cos(a) * (R - 2), cy + Math.sin(a) * (R - 2));
      x.stroke();
      x.beginPath(); x.arc(cx + Math.cos(a + 0.06) * (R - 9), cy + Math.sin(a + 0.06) * (R - 9), 2.1, 0, 6.3); x.fill();
    }
    x.beginPath(); x.arc(cx, cy, 7, 0, 6.3); x.fill();
    x.globalAlpha = 0.10; x.fillStyle = '#000';
    for (let k = 0; k < 260; k++) x.fillRect(Math.random() * w, Math.random() * h, 3, 2);
  });
  return new THREE.CanvasTexture(c);
}

// Wings sub-component
function XWing({ xPos, chord, span, sweep, isFwd }) {
  const matTop = useMemo(() => new THREE.MeshStandardMaterial({ map: camoTexture(true), roughness: 0.92, metalness: 0.06 }), []);
  const matBelly = useMemo(() => new THREE.MeshStandardMaterial({ map: camoTexture(false), roughness: 0.88, metalness: 0.08 }), []);
  const matDecal = useMemo(() => new THREE.MeshStandardMaterial({ map: roundelTexture(), transparent: true, roughness: 0.9 }), []);
  return (
    <group position={[xPos, 0, 0]}>
      {[0, 1, 2, 3].map(i => {
        const isUpper = (i === 0 || i === 3);
        return (
          <group key={i} rotation={[Math.PI / 4 + i * Math.PI / 2, 0, 0]}>
            <mesh position={[0, 0, 0.45 + span * 0.275]} material={matTop}>
              <boxGeometry args={[chord, 0.1, span * 0.55]} />
            </mesh>
            <mesh position={[-sweep * 0.5, 0, 0.45 + span * 0.55 + span * 0.25]} material={matTop}>
              <boxGeometry args={[chord * 0.62, 0.09, span * 0.5]} />
            </mesh>
            <mesh position={[-chord / 2 - 0.1, 0, 0.45 + span * 0.32]} material={matBelly}>
              <boxGeometry args={[0.3, 0.09, span * 0.4]} />
            </mesh>
            {isFwd && isUpper && (
              <mesh position={[0.05, 0.07, 0.45 + span * 0.32]} rotation={[-Math.PI / 2, 0, 0]} material={matDecal}>
                <circleGeometry args={[0.5, 30]} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}

// Contrail particle system
function Contrail({ active, uavRef }) {
  const particles = useRef([]);
  const groupRef = useRef();
  const MAX_PARTICLES = 60;

  useFrame((state, delta) => {
    if (!groupRef.current || !uavRef?.current) return;

    // Add new particle if active
    if (active && particles.current.length < MAX_PARTICLES) {
      const pos = uavRef.current.position.clone();
      particles.current.push({ pos, age: 0, maxAge: 2.5 + Math.random() });
    }

    // Update existing particles
    particles.current = particles.current.filter(p => p.age < p.maxAge);
    particles.current.forEach(p => { p.age += delta; });

    // Update mesh visibility
    groupRef.current.children.forEach((mesh, i) => {
      if (i < particles.current.length) {
        const p = particles.current[i];
        mesh.position.copy(p.pos);
        const t = p.age / p.maxAge;
        mesh.material.opacity = (1 - t) * 0.35;
        mesh.scale.setScalar(0.15 + t * 0.6);
        mesh.visible = true;
      } else {
        mesh.visible = false;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {Array.from({ length: MAX_PARTICLES }).map((_, i) => (
        <mesh key={i} visible={false}>
          <sphereGeometry args={[0.3, 6, 6]} />
          <meshBasicMaterial color={0xffffff} transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

// Landing gear
function LandingGear({ deployed }) {
  const gearRef = useRef();
  useFrame((state, delta) => {
    if (!gearRef.current) return;
    const target = deployed ? Math.PI / 4 : 0;
    gearRef.current.rotation.x = THREE.MathUtils.lerp(gearRef.current.rotation.x, target, delta * 3);
  });
  return (
    <group position={[0, -0.5, 0.5]}>
      <group ref={gearRef}>
        <mesh position={[0, -0.3, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.6, 6]} />
          <meshStandardMaterial color={0x555555} roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh position={[0, -0.65, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.08, 10]} />
          <meshStandardMaterial color={0x333333} roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

export default function UAVModel({ stateIndex, elapsed, faultInjected, uavRef, telemetry, thermalMode }) {
  const propRef = useRef();
  const smokeRef = useRef();
  const engineGlowRef = useRef();
  const engineGlowMatRef = useRef();

  const matTop = useMemo(() => new THREE.MeshStandardMaterial({ map: camoTexture(true), roughness: 0.92, metalness: 0.06 }), []);
  const matBelly = useMemo(() => new THREE.MeshStandardMaterial({ map: camoTexture(false), roughness: 0.88, metalness: 0.08 }), []);
  const matMatte = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x1b1d1e, roughness: 0.96, metalness: 0.04 }), []);
  const matGlass = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x0d2430, roughness: 0.12, metalness: 0.85 }), []);
  const matMetal = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x6e737a, roughness: 0.45, metalness: 0.8 }), []);
  const matProp = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.7, metalness: 0.2 }), []);
  const matNacelle = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x5f666d, roughness: 0.7, metalness: 0.2 }), []);
  const thermalMat = useMemo(() => new THREE.MeshStandardMaterial({ color: 0x07101d, roughness: 0.65, metalness: 0.1, emissive: 0x000000 }), []);
  const matDecal = useMemo(() => new THREE.MeshStandardMaterial({ map: roundelTexture(), transparent: true, roughness: 0.9 }), []);
  const matGlow = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0 });
    engineGlowMatRef.current = m;
    return m;
  }, []);

  const movementRef = useRef({
    stateName: 'IDLE',
    progress: 0,
    duration: 1,
    startPos: new THREE.Vector3(WAYPOINTS.BASE.x, WAYPOINTS.BASE.y, WAYPOINTS.BASE.z),
    targetPos: new THREE.Vector3(WAYPOINTS.BASE.x, WAYPOINTS.BASE.y, WAYPOINTS.BASE.z),
    startRot: new THREE.Euler(0, 0, 0, 'YXZ'),
    targetRot: new THREE.Euler(0, 0, 0, 'YXZ'),
  });

  useFrame((state, delta) => {
    // ── Propeller ──
    if (propRef.current) {
      const stateName = MISSION_SEQUENCE[stateIndex] || 'IDLE';
      let speed = 0;
      if (stateIndex > 0) speed = 20;
      if (stateName === 'IDLE' || stateName === 'COMPLETED') speed = 0;
      propRef.current.rotation.x += speed * delta;
    }

    // ── Engine glow (fault) ──
    if (engineGlowMatRef.current) {
      const cht = Number(telemetry?.cht ?? 0)
      const targetOpacity = thermalMode ? 0.35 + Math.min(0.65, Math.max(0, (cht - 100) / 160)) : (faultInjected ? 0.55 + Math.sin(state.clock.elapsedTime * 4) * 0.25 : 0)
      engineGlowMatRef.current.opacity = THREE.MathUtils.lerp(engineGlowMatRef.current.opacity, targetOpacity, delta * 4);
    }
    if (thermalMode) {
      const heat = THREE.MathUtils.clamp((Number(telemetry?.cht ?? 0) - 80) / 190, 0, 1)
      thermalMat.color.setHSL((1 - heat) * 0.62, 1, 0.12 + heat * 0.58)
      thermalMat.emissive.setHSL((1 - heat) * 0.16, 1, 0.08 + heat * 0.65)
      thermalMat.emissiveIntensity = 0.5 + heat * 2.2
    }

    // ── Smoke ──
    if (smokeRef.current) {
      smokeRef.current.visible = faultInjected;
      if (faultInjected) smokeRef.current.rotation.y += delta * 0.5;
    }

    // ── UAV movement state machine ──
    if (uavRef.current) {
      const stateName = MISSION_SEQUENCE[stateIndex] || 'IDLE';
      const m = movementRef.current;

      if (m.stateName !== stateName) {
        m.stateName = stateName;
        m.progress = 0;
        m.startPos.copy(uavRef.current.position);
        m.startRot.copy(uavRef.current.rotation);

        switch (stateName) {
          case 'PRE_FLIGHT':
          case 'ENGINE_START':
            m.targetPos.set(WAYPOINTS.BASE.x, WAYPOINTS.BASE.y, WAYPOINTS.BASE.z);
            m.targetRot.set(0, 0, 0, 'YXZ');
            m.duration = 1;
            break;
          case 'TAKEOFF':
            m.targetPos.set(WAYPOINTS.TAKEOFF.x, WAYPOINTS.TAKEOFF.y, WAYPOINTS.TAKEOFF.z);
            m.targetRot.set(0.2, 0, 0, 'YXZ');
            m.duration = 7;
            break;
          case 'CLIMB':
            m.targetPos.set(WAYPOINTS.CLIMB.x, WAYPOINTS.CLIMB.y, WAYPOINTS.CLIMB.z);
            m.targetRot.set(0.15, 0, 0.1, 'YXZ');
            m.duration = 9;
            break;
          case 'CRUISE':
            m.targetPos.set(WAYPOINTS.CRUISE.x, WAYPOINTS.CRUISE.y, WAYPOINTS.CRUISE.z);
            m.targetRot.set(0, 0, 0, 'YXZ');
            m.duration = 11;
            break;
          case 'MISSION':
          case 'DEGRADATION':
          case 'WARNING':
            m.targetPos.set(WAYPOINTS.MISSION.x, WAYPOINTS.MISSION.y, WAYPOINTS.MISSION.z);
            m.targetRot.set(0, 0, 0, 'YXZ');
            m.duration = 10;
            break;
          case 'RTB': {
            m.targetPos.set(WAYPOINTS.RTB_MID.x, WAYPOINTS.RTB_MID.y, WAYPOINTS.RTB_MID.z);
            const dir = new THREE.Vector3().subVectors(m.targetPos, m.startPos).normalize();
            m.targetRot.set(0, Math.atan2(dir.x, -dir.z), 0, 'YXZ');
            m.startRot.copy(m.targetRot); // Snap instantly to face base
            m.duration = 14;
            break;
          }
          case 'APPROACH': {
            m.targetPos.set(WAYPOINTS.APPROACH.x, WAYPOINTS.APPROACH.y, WAYPOINTS.APPROACH.z);
            const dir = new THREE.Vector3().subVectors(m.targetPos, m.startPos).normalize();
            m.targetRot.set(-0.1, Math.atan2(dir.x, -dir.z), 0, 'YXZ');
            m.duration = 8;
            break;
          }
          case 'LANDING': {
            m.targetPos.set(WAYPOINTS.LANDED.x, WAYPOINTS.LANDED.y, WAYPOINTS.LANDED.z);
            const dir = new THREE.Vector3().subVectors(m.targetPos, m.startPos).normalize();
            m.targetRot.set(0, Math.atan2(dir.x, -dir.z), 0, 'YXZ');
            m.duration = 7;
            break;
          }
          case 'COMPLETED':
            m.targetPos.set(WAYPOINTS.LANDED.x, WAYPOINTS.LANDED.y, WAYPOINTS.LANDED.z);
            m.targetRot.set(0, 0, 0, 'YXZ');
            m.duration = 1;
            break;
        }
      }

      if (m.duration > 0 && m.progress < 1) {
        m.progress += delta / m.duration;
        if (m.progress > 1) m.progress = 1;
        const t = m.progress;
        uavRef.current.position.lerpVectors(m.startPos, m.targetPos, t);
        const qStart = new THREE.Quaternion().setFromEuler(m.startRot);
        const qEnd = new THREE.Quaternion().setFromEuler(m.targetRot);
        uavRef.current.quaternion.slerpQuaternions(qStart, qEnd, t);
      }
    }
  });

  const stateName = MISSION_SEQUENCE[stateIndex] || 'IDLE';
  const isGrounded = ['IDLE', 'PRE_FLIGHT', 'ENGINE_START', 'LANDING', 'COMPLETED'].includes(stateName);
  const isApproach = ['APPROACH', 'LANDING', 'COMPLETED'].includes(stateName);

  return (
    <>
      {/* Contrail — visible during airborne cruise/mission */}
      <Contrail active={['CLIMB', 'CRUISE', 'MISSION', 'DEGRADATION', 'RTB'].includes(stateName)} uavRef={uavRef} />

      {/* Engine point light — pulses red on fault */}
      <pointLight
        ref={engineGlowRef}
        color={0xff4400}
        intensity={faultInjected ? 3 : 0}
        distance={8}
        decay={2}
        position={uavRef?.current?.position ?? [0, 0, 0]}
      />

      <group ref={uavRef} scale={0.78}>
        <group position={[0, 0.62, 0]} rotation={[0, Math.PI / 2, 0]}>
          {/* Fuselage */}
          <mesh position={[2.0, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={matTop}>
            <cylinderGeometry args={[0.62, 0.62, 4.4, 20]} />
          </mesh>
          <mesh position={[-1.9, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={matTop}>
            <cylinderGeometry args={[0.62, 0.6, 3.6, 20]} />
          </mesh>
          <mesh position={[-5.0, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={matTop}>
            <cylinderGeometry args={[0.6, 0.44, 2.6, 20]} />
          </mesh>

          {/* Nose & Turret */}
          <mesh position={[4.3, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={matMatte}>
            <cylinderGeometry args={[0.66, 0.62, 0.5, 20]} />
          </mesh>
          <mesh position={[4.75, 0, 0]} scale={[1.5, 1, 1]} material={matBelly}>
            <sphereGeometry args={[0.64, 22, 16]} />
          </mesh>
          <mesh position={[5.35, -0.08, 0]} material={matMatte}>
            <sphereGeometry args={[0.42, 20, 16]} />
          </mesh>
          <mesh position={[5.66, -0.08, 0]} rotation={[0, 0, Math.PI / 2]} material={matGlass}>
            <cylinderGeometry args={[0.3, 0.3, 0.12, 20]} />
          </mesh>

          {/* Yellow Bands */}
          <mesh position={[3.55, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.635, 0.635, 0.22, 22]} />
            <meshStandardMaterial color={0xd8b323} roughness={0.75} />
          </mesh>
          <mesh position={[0.1, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.635, 0.635, 0.22, 22]} />
            <meshStandardMaterial color={0xd8b323} roughness={0.75} />
          </mesh>
          <mesh position={[-3.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.635, 0.635, 0.22, 22]} />
            <meshStandardMaterial color={0xd8b323} roughness={0.75} />
          </mesh>

          {/* Mast */}
          <group>
            <mesh position={[0.4, 0.82, 0]} material={matMatte}>
              <cylinderGeometry args={[0.1, 0.13, 0.5, 10]} />
            </mesh>
            <mesh position={[0.4, 1.2, 0]} material={matMatte}>
              <boxGeometry args={[0.42, 0.46, 0.07]} />
            </mesh>
          </group>

          {/* Wings */}
          <XWing xPos={1.3} chord={2.4} span={3.5} sweep={0.9} isFwd={true} />
          <XWing xPos={-3.9} chord={1.9} span={2.7} sweep={0.7} isFwd={false} />

          {/* Decals */}
          <mesh position={[-1.6, 0.06, 0.625]} material={matDecal}>
            <circleGeometry args={[0.5, 30]} />
          </mesh>
          <mesh position={[-1.6, 0.06, -0.625]} rotation={[0, Math.PI, 0]} material={matDecal}>
            <circleGeometry args={[0.5, 30]} />
          </mesh>

          {/* Engine & Propeller */}
          <mesh position={[-6.5, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={thermalMode ? thermalMat : matNacelle}>
            <cylinderGeometry args={[0.44, 0.34, 0.9, 18]} />
          </mesh>
          <mesh position={[-7.05, 0, 0]} rotation={[0, 0, Math.PI / 2]} material={matMetal}>
            <cylinderGeometry args={[0.2, 0.2, 0.4, 12]} />
          </mesh>
          <mesh position={[-7.35, 0, 0]} scale={[1.4, 1, 1]} material={matMatte}>
            <sphereGeometry args={[0.2, 14, 12]} />
          </mesh>

          {/* Engine glow sphere — brightens red on fault */}
          <mesh ref={engineGlowRef} position={[-6.5, 0, 0]}>
            <sphereGeometry args={[0.55, 12, 12]} />
            <primitive object={matGlow} attach="material" />
          </mesh>

          {/* Propeller */}
          <group ref={propRef} position={[-7.25, 0, 0]}>
            <group rotation={[0, 0, 0.24]}>
              <mesh position={[0, 0.92, 0]} material={matProp}>
                <boxGeometry args={[0.07, 1.85, 0.16]} />
              </mesh>
            </group>
            <group rotation={[Math.PI, 0, 0.24]}>
              <mesh position={[0, 0.92, 0]} material={matProp}>
                <boxGeometry args={[0.07, 1.85, 0.16]} />
              </mesh>
            </group>
          </group>

          {/* Landing gear */}
          <LandingGear deployed={isGrounded} />
          <group position={[1.2, -0.5, 0.5]}>
            <LandingGear deployed={isGrounded} />
          </group>
          <group position={[-1.2, -0.5, 0.5]}>
            <LandingGear deployed={isGrounded} />
          </group>

          {/* Fault Smoke */}
          <group ref={smokeRef} position={[-6.5, 0.5, 0]} visible={false}>
            <mesh>
              <sphereGeometry args={[0.4, 8, 8]} />
              <meshBasicMaterial color={0xcc2222} transparent opacity={0.8} />
            </mesh>
            <mesh position={[-0.8, 0.2, 0]} scale={1.2}>
              <sphereGeometry args={[0.4, 8, 8]} />
              <meshBasicMaterial color={0xff5500} transparent opacity={0.6} />
            </mesh>
            <mesh position={[-1.5, 0.5, 0]} scale={1.8}>
              <sphereGeometry args={[0.5, 8, 8]} />
              <meshBasicMaterial color={0x222222} transparent opacity={0.4} />
            </mesh>
            <mesh position={[-2.5, 0.8, 0]} scale={2.5}>
              <sphereGeometry args={[0.6, 8, 8]} />
              <meshBasicMaterial color={0x111111} transparent opacity={0.2} />
            </mesh>
          </group>
        </group>
      </group>
    </>
  );
}
