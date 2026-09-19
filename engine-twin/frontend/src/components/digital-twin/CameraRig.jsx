import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

export default function CameraRig({ cameraMode, uavRef }) {
  const orbitRef = useRef();
  
  useFrame((state, delta) => {
    if (!uavRef.current) return;
    
    const uavPos = uavRef.current.position;

    if (cameraMode === 'follow') {
      if (orbitRef.current) orbitRef.current.enabled = false;
      
      // Chase camera: behind and slightly above the UAV
      // Assuming UAV flies forward along -Z in local space, or we can just use the velocity vector.
      // For simplicity, since the UAV rotates, we can calculate a position behind it.
      const offset = new THREE.Vector3(0, 3, 10);
      offset.applyQuaternion(uavRef.current.quaternion);
      const targetCamPos = uavPos.clone().add(offset);
      
      state.camera.position.lerp(targetCamPos, delta * 3);
      state.camera.lookAt(uavPos);
    } 
    else if (cameraMode === 'overview' || cameraMode === 'mission') {
      if (orbitRef.current) orbitRef.current.enabled = false;
      
      // Static overview looking down at the entire scene
      const overviewPos = new THREE.Vector3(-40, 30, 20);
      state.camera.position.lerp(overviewPos, delta * 2);
      
      // Look at the center of the mission area or the UAV
      const lookTarget = new THREE.Vector3(0, 5, -10);
      state.camera.lookAt(lookTarget);
    }
    else {
      // 'orbit' mode
      if (orbitRef.current) {
        orbitRef.current.enabled = true;
        // Orbit around the UAV
        orbitRef.current.target.lerp(uavPos, delta * 5);
      }
    }
  });

  return (
    <>
      <OrbitControls 
        ref={orbitRef} 
        makeDefault 
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2 - 0.05} // Prevent going below ground
        minDistance={5}
        maxDistance={50}
      />
    </>
  );
}
