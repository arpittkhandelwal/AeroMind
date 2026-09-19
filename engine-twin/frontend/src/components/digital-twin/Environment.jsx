import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Procedural texture generators
function createSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, '#2f5f8d');
  g.addColorStop(0.55, '#8fb3cc');
  g.addColorStop(1, '#cbd8de');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  return new THREE.CanvasTexture(canvas);
}

function createGroundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#6f6a4e';
  ctx.fillRect(0, 0, 512, 512);
  const colors = ['#7b765a', '#625d45', '#857f60', '#565440'];
  for (let i = 0; i < 700; i++) {
    ctx.fillStyle = colors[i % 4];
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * 512,
      Math.random() * 512,
      8 + Math.random() * 40,
      6 + Math.random() * 26,
      0, 0, Math.PI * 2
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(60,58,44,.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, 300);
  ctx.bezierCurveTo(160, 260, 300, 360, 512, 320);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  return tex;
}

function createCloudTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(canvas);
}

export default function Environment() {
  const skyTex = useMemo(() => createSkyTexture(), []);
  const groundTex = useMemo(() => createGroundTexture(), []);
  const cloudTex = useMemo(() => createCloudTexture(), []);

  // Create static clouds
  const cloudData = useMemo(() => {
    const data = [];
    for (let i = 0; i < 40; i++) {
      data.push({
        pos: new THREE.Vector3(
          -400 + Math.random() * 800,
          -20 + Math.random() * 150,
          -400 + Math.random() * 800
        ),
        scale: 22 + Math.random() * 44,
        speed: new THREE.Vector3(
          -0.5 - Math.random() * 0.5,
          0,
          0
        )
      });
    }
    return data;
  }, []);

  const cloudGroupRef = useRef();

  useFrame((state, delta) => {
    if (cloudGroupRef.current) {
      cloudGroupRef.current.children.forEach((cloud, i) => {
        cloud.position.addScaledVector(cloudData[i].speed, delta * 10);
        if (cloud.position.x < -400) {
          cloud.position.x = 400;
        }
      });
    }
  });

  return (
    <>
      <fog attach="fog" args={[0x9fb4c4, 40, 190]} />
      
      {/* Sky Dome */}
      <mesh>
        <sphereGeometry args={[400, 24, 16]} />
        <meshBasicMaterial map={skyTex} side={THREE.BackSide} />
      </mesh>

      {/* Lights */}
      <hemisphereLight args={[0xbcd3e6, 0x4a5340, 0.85]} />
      <directionalLight position={[-40, 60, 30]} args={[0xfff0d8, 1.05]} />
      <directionalLight position={[30, -10, -25]} args={[0x93a8bf, 0.35]} />

      {/* Ground Plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.8, 0]}>
        <planeGeometry args={[1800, 1800]} />
        <meshStandardMaterial map={groundTex} roughness={1} />
      </mesh>

      {/* Runway Marker */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.78, 0]}>
        <planeGeometry args={[20, 100]} />
        <meshBasicMaterial color={0x444444} />
      </mesh>

      {/* Clouds */}
      <group ref={cloudGroupRef}>
        {cloudData.map((data, i) => (
          <sprite key={i} position={data.pos} scale={data.scale}>
            <spriteMaterial map={cloudTex} transparent opacity={0.55} depthWrite={false} />
          </sprite>
        ))}
      </group>
    </>
  );
}
