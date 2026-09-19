import React, { useMemo } from 'react';
import * as THREE from 'three';
import { WAYPOINTS } from '../../hooks/useMissionState';
import { Line } from '@react-three/drei';

export default function FlightPath() {
  const points = useMemo(() => {
    // Order of waypoints to draw the continuous path
    const order = ['BASE', 'TAKEOFF', 'CLIMB', 'CRUISE', 'MISSION', 'RTB_MID', 'APPROACH', 'LANDED'];
    return order.map(k => new THREE.Vector3(WAYPOINTS[k].x, WAYPOINTS[k].y, WAYPOINTS[k].z));
  }, []);

  return (
    <group>
      <Line
        points={points}
        color="#3fb9a4" // var(--ok) matching theme
        lineWidth={2}
        dashed={true}
        dashSize={1}
        gapSize={0.5}
        opacity={0.6}
        transparent
      />
      {points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.3, 8, 8]} />
          <meshBasicMaterial color="#3fb9a4" transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  );
}
