/**
 * DigitalTwin3DView.jsx
 * =====================
 * Embeds the exact vanilla Three.js scene from files 2/index.html
 * via an iframe — guaranteed pixel-perfect parity.
 *
 * The iframe loads /uav-scene.html which is the working standalone file
 * served from Vite's public/ directory.
 */
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import Environment from './Environment';
import UAVModel from './UAVModel';
import CameraRig from './CameraRig';
import FlightPath from './FlightPath';
import DebrisExplosion from './DebrisExplosion';
import { MISSION_SEQUENCE } from '../../hooks/useMissionState';

export default function DigitalTwin3DView({
  missionState,
  elapsed,
  faultInjected,
  isExploded,
  cameraMode,
  telemetry,
  thermalMode,
}) {
  // We need to calculate stateIndex from missionState
  const stateIndex = useMemo(() => {
    const idx = MISSION_SEQUENCE.indexOf(missionState);
    return idx === -1 ? 0 : idx;
  }, [missionState]);

  const uavRef = useRef(null);
  const [explosionPos, setExplosionPos] = useState([0, 0, 0]);

  useEffect(() => {
    if (isExploded && uavRef.current) {
      setExplosionPos([uavRef.current.position.x, uavRef.current.position.y, uavRef.current.position.z]);
    }
  }, [isExploded]);

  return (
    <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', background: '#080d13' }}>
      <Canvas camera={{ position: [20, 10, 20], fov: 42 }}>
        <Environment />
        <FlightPath />
        
        {isExploded ? (
          <DebrisExplosion position={explosionPos} active={true} />
        ) : (
          <UAVModel uavRef={uavRef} stateIndex={stateIndex} elapsed={elapsed} faultInjected={faultInjected} telemetry={telemetry} thermalMode={thermalMode} />
        )}
        
        <CameraRig cameraMode={cameraMode} uavRef={isExploded ? null : uavRef} />
      </Canvas>
    </div>
  );
}
