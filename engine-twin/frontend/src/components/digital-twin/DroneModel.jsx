/**
 * DroneModel.jsx
 * Procedural X-wing MALE UAV — ported from files 2/index.html buildUAV()
 * Camo textures, Indian tricolour roundels with Ashoka Chakra, X-wing sets, pusher prop.
 */
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

function makeCamoTexture(top) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = top ? '#79818a' : '#99a1a9';
  x.fillRect(0, 0, 512, 512);
  const blobs = top ? ['#6c747d','#858d96','#5f676f'] : ['#a4acb4','#8b939b'];
  for (let i = 0; i < 110; i++) {
    x.fillStyle = blobs[i % blobs.length];
    x.globalAlpha = 0.28;
    x.beginPath();
    x.ellipse(Math.random()*512, Math.random()*512, 14+Math.random()*52, 10+Math.random()*34, Math.random()*Math.PI, 0, Math.PI*2);
    x.fill();
  }
  x.globalAlpha = 1;
  x.strokeStyle = 'rgba(0,0,0,0.28)'; x.lineWidth = 1.4;
  for (let p=0; p<512; p+=64) { x.beginPath(); x.moveTo(p,0); x.lineTo(p,512); x.stroke(); }
  for (let q=0; q<512; q+=86) { x.beginPath(); x.moveTo(0,q); x.lineTo(512,q); x.stroke(); }
  x.fillStyle='rgba(0,0,0,0.22)';
  for (let r=0; r<512; r+=64) for (let s=8; s<512; s+=17) x.fillRect(r-1,s,2,2);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function makeRoundelTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle='#FF9933'; x.fillRect(0,0,256,85);
  x.fillStyle='#FFFFFF';  x.fillRect(0,85,256,85);
  x.fillStyle='#138808';  x.fillRect(0,170,256,86);
  const cx=128, cy=128, R=46;
  x.strokeStyle='#0a2a8f'; x.fillStyle='#0a2a8f';
  x.lineWidth=3.2;
  x.beginPath(); x.arc(cx,cy,R,0,Math.PI*2); x.stroke();
  x.lineWidth=1.5;
  for (let i=0; i<24; i++) {
    const a = (i/24)*Math.PI*2;
    x.beginPath();
    x.moveTo(cx+Math.cos(a)*7, cy+Math.sin(a)*7);
    x.lineTo(cx+Math.cos(a)*(R-2), cy+Math.sin(a)*(R-2));
    x.stroke();
    x.beginPath();
    x.arc(cx+Math.cos(a+0.06)*(R-9), cy+Math.sin(a+0.06)*(R-9), 2.1, 0, Math.PI*2);
    x.fill();
  }
  x.beginPath(); x.arc(cx,cy,7,0,Math.PI*2); x.fill();
  x.globalAlpha=0.10; x.fillStyle='#000';
  for (let k=0; k<260; k++) x.fillRect(Math.random()*256, Math.random()*256, 3, 2);
  return new THREE.CanvasTexture(c);
}

function useMaterials() {
  return useMemo(() => ({
    top:   new THREE.MeshStandardMaterial({ map: makeCamoTexture(true),  roughness:0.92, metalness:0.06 }),
    belly: new THREE.MeshStandardMaterial({ map: makeCamoTexture(false), roughness:0.88, metalness:0.08 }),
    matte: new THREE.MeshStandardMaterial({ color:0x1b1d1e, roughness:0.96, metalness:0.04 }),
    glass: new THREE.MeshStandardMaterial({ color:0x0d2430, roughness:0.12, metalness:0.85 }),
    metal: new THREE.MeshStandardMaterial({ color:0x6e737a, roughness:0.45, metalness:0.8  }),
    prop:  new THREE.MeshStandardMaterial({ color:0x22242a, roughness:0.7,  metalness:0.2  }),
    decal: new THREE.MeshStandardMaterial({ map: makeRoundelTexture(), transparent:true, roughness:0.9 }),
    band:  new THREE.MeshStandardMaterial({ color:0xd8b323, roughness:0.75 }),
  }), []);
}

function XWing({ xPos, chord, span, sweep, mat, hasDecal, onPointerDown, sel, isFailing }) {
  const topMat = isFailing 
    ? new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.9 })
    : sel 
      ? new THREE.MeshStandardMaterial({ color:'#FF9933', roughness:0.9 }) 
      : mat.top;
  const arms = [0,1,2,3].map(i => i*Math.PI/2 + Math.PI/4);
  return (
    <group position={[xPos, 0, 0]}>
      {arms.map((angle, i) => (
        <group key={i} rotation={[angle, 0, 0]}>
          <mesh castShadow position={[0, 0.45+span*0.275, 0]} onPointerDown={onPointerDown}>
            <boxGeometry args={[chord, span*0.55, 0.1]} />
            <primitive object={topMat} attach="material" />
          </mesh>
          <mesh castShadow position={[-sweep*0.5, 0.45+span*0.55+span*0.25, 0]}>
            <boxGeometry args={[chord*0.62, span*0.5, 0.09]} />
            <primitive object={topMat} attach="material" />
          </mesh>
          <mesh position={[-chord/2-0.1, 0.45+span*0.32, 0]}>
            <boxGeometry args={[0.3, span*0.4, 0.09]} />
            <primitive object={mat.belly} attach="material" />
          </mesh>
          {hasDecal && (i===0||i===3) && (
            <mesh rotation={[Math.PI/2,0,0]} position={[0.05, 0.45+span*0.32, 0.08]}>
              <circleGeometry args={[0.5, 30]} />
              <primitive object={mat.decal} attach="material" />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
}

function UAVBody({ mat, telemetry, healthScore, selectedPart, onSelectPart }) {
  const propRef = useRef();

  useFrame((_, delta) => {
    if (propRef.current) {
      const rpm = telemetry?.rpm || 0;
      propRef.current.rotation.x -= Math.min((rpm/60)*Math.PI*2, 80)*delta;
    }
  });

  const isSel = (p) => selectedPart === p;
  const handle = (e, part) => { e.stopPropagation(); onSelectPart(part===selectedPart?null:part); };

  const engineEmissive = useMemo(() => {
    const cht = telemetry?.cht || 0;
    if (cht > 240) return new THREE.Color('#ef4444');
    if (cht > 200) return new THREE.Color('#f59e0b');
    return new THREE.Color('#000');
  }, [telemetry?.cht]);

  const fault = telemetry?.faultLabel;
  const isFailing = (part) => {
    if (!fault || fault === 'none') return false;
    if (part === 'engine' && ['overheating', 'misfire', 'injector', 'spark_plug'].includes(fault)) return true;
    if (part === 'fuel' && fault === 'lubrication') return true;
    if ((part === 'turret' || part === 'wingFwd' || part === 'wingAft') && fault === 'vibration') return true;
    return false;
  };

  const nacelleMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: isFailing('engine') ? 0xef4444 : 0x5f666d, 
    roughness: 0.7, metalness: 0.2,
    emissive: engineEmissive,
    emissiveIntensity: telemetry?.cht > 240 ? 1.0 : telemetry?.cht > 200 ? 0.4 : 0.05,
  }), [engineEmissive, telemetry?.cht, fault]);

  const getBodyMat = (part) => isFailing(part) 
    ? new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.9 })
    : isSel(part)
      ? new THREE.MeshStandardMaterial({ color: '#FF9933', roughness: 0.9 })
      : mat.top;

  return (
    <group>
      {/* Fwd fuselage */}
      <mesh castShadow rotation={[0,0,Math.PI/2]} position={[2.0,0,0]} onPointerDown={e=>handle(e,'avionics')}>
        <cylinderGeometry args={[0.62,0.62,4.4,20]} />
        <primitive object={getBodyMat('avionics')} attach="material" />
        {isSel('avionics') && (
          <Html center distanceFactor={10} position={[0,1.4,0]}>
            <div className="tooltip3d"><div className="title">Avionics Bay {isFailing('avionics') && <span style={{color: '#f87171'}}>[⚠ FAILING]</span>}</div>
              <div>Battery: {telemetry?.batteryVoltage?.toFixed(1)??'—'} V</div>
              <div>Health: {healthScore.toFixed(0)}%</div></div>
          </Html>
        )}
      </mesh>
      {/* Mid fuselage */}
      <mesh castShadow rotation={[0,0,Math.PI/2]} position={[-1.9,0,0]} onPointerDown={e=>handle(e,'fuel')}>
        <cylinderGeometry args={[0.62,0.6,3.6,20]} />
        <primitive object={getBodyMat('fuel')} attach="material" />
        {(isSel('fuel') || isFailing('fuel')) && (
          <Html center distanceFactor={10} position={[0,1.2,0]}>
            <div className={`tooltip3d ${isFailing('fuel') ? 'failing' : ''}`}>
              <div className="title">Fuel & Lubrication {isFailing('fuel') && <span style={{color: '#f87171'}}>[⚠ FAILING]</span>}</div>
              <div>Fuel Flow: {telemetry?.fuelFlow?.toFixed(2)??'—'} L/h</div></div>
          </Html>
        )}
      </mesh>
      {/* Aft fuselage */}
      <mesh castShadow rotation={[0,0,Math.PI/2]} position={[-5.0,0,0]} onPointerDown={e=>handle(e,'engine')}>
        <cylinderGeometry args={[0.6,0.44,2.6,20]} />
        <primitive object={getBodyMat('engine')} attach="material" />
      </mesh>

      {/* Nose */}
      <mesh castShadow rotation={[0,0,Math.PI/2]} position={[4.3,0,0]} onPointerDown={e=>handle(e,'turret')}>
        <cylinderGeometry args={[0.66,0.62,0.5,20]} />
        <primitive object={mat.matte} attach="material" />
      </mesh>
      <mesh castShadow position={[4.75,0,0]} scale={[1.5,1,1]} onPointerDown={e=>handle(e,'turret')}>
        <sphereGeometry args={[0.64,22,16]} />
        <primitive object={mat.belly} attach="material" />
      </mesh>
      {/* Turret ball */}
      <mesh castShadow position={[5.35,-0.08,0]} onPointerDown={e=>handle(e,'turret')}>
        <sphereGeometry args={[0.42,20,16]} />
        <primitive object={mat.matte} attach="material" />
        {(isSel('turret') || isFailing('turret')) && (
          <Html center distanceFactor={10} position={[0,1,0]}>
            <div className={`tooltip3d ${isFailing('turret') ? 'failing' : ''}`}>
              <div className="title">Nose Sensor Turret {isFailing('turret') && <span style={{color: '#f87171'}}>[⚠ FAILING]</span>}</div>
              <div style={{color: isFailing('turret') ? '#f87171' : 'inherit'}}>Vibration: {telemetry?.vibration?.toFixed(3)??'—'} g</div>
              <div>Alt: {telemetry?.altitude?.toFixed(0)??'—'} m</div></div>
          </Html>
        )}
      </mesh>
      <mesh rotation={[0,0,Math.PI/2]} position={[5.66,-0.08,0]}>
        <cylinderGeometry args={[0.3,0.3,0.12,20]} />
        <primitive object={mat.glass} attach="material" />
      </mesh>
      <mesh rotation={[0,0,Math.PI/2]} position={[5.62,0.16,0.2]}>
        <cylinderGeometry args={[0.13,0.13,0.1,14]} />
        <primitive object={mat.glass} attach="material" />
      </mesh>

      {/* Service bands */}
      {[[3.55],[0.1],[-3.5]].map(([px]) => (
        <mesh key={px} rotation={[0,0,Math.PI/2]} position={[px,0,0]}>
          <cylinderGeometry args={[0.635,0.635,0.22,22]} />
          <primitive object={mat.band} attach="material" />
        </mesh>
      ))}

      {/* Fuselage roundels */}
      {[1,-1].map(sign => (
        <mesh key={sign} position={[-1.6,0.06,sign*0.625]} rotation={[0,sign>0?0:Math.PI,0]}>
          <circleGeometry args={[0.5,30]} />
          <primitive object={mat.decal} attach="material" />
        </mesh>
      ))}

      {/* Access hatch */}
      <mesh position={[2.2,0.62,0]}>
        <boxGeometry args={[2.2,0.06,0.7]} />
        <primitive object={mat.belly} attach="material" />
      </mesh>

      {/* SATCOM mast */}
      <mesh position={[0.4,0.82,0]}><cylinderGeometry args={[0.1,0.13,0.5,10]} /><primitive object={mat.matte} attach="material" /></mesh>
      <mesh position={[0.4,1.2,0]}><boxGeometry args={[0.42,0.46,0.07]} /><primitive object={mat.matte} attach="material" /></mesh>
      <mesh position={[-2.6,0.78,0]}><boxGeometry args={[0.3,0.34,0.06]} /><primitive object={mat.matte} attach="material" /></mesh>

      {/* Forward X-wing */}
      <XWing xPos={1.3} chord={2.4} span={3.5} sweep={0.9} mat={mat} hasDecal
        onPointerDown={e=>handle(e,'wingFwd')} sel={isSel('wingFwd')} isFailing={isFailing('wingFwd')} />
      {(isSel('wingFwd') || isFailing('wingFwd')) && (
        <Html center distanceFactor={10} position={[1.3,4.5,0]}>
          <div className={`tooltip3d ${isFailing('wingFwd') ? 'failing' : ''}`}>
            <div className="title">Forward X-Wing {isFailing('wingFwd') && <span style={{color: '#f87171'}}>[⚠ FAILING]</span>}</div>
            <div style={{color: isFailing('wingFwd') ? '#f87171' : 'inherit'}}>Vibration: {telemetry?.vibration?.toFixed(3)??'—'} g</div></div>
        </Html>
      )}

      {/* Aft X-wing */}
      <XWing xPos={-3.9} chord={1.9} span={2.7} sweep={0.7} mat={mat} hasDecal={false}
        onPointerDown={e=>handle(e,'wingAft')} sel={isSel('wingAft')} isFailing={isFailing('wingAft')} />
      {(isSel('wingAft') || isFailing('wingAft')) && (
        <Html center distanceFactor={10} position={[-3.9,3.5,0]}>
          <div className={`tooltip3d ${isFailing('wingAft') ? 'failing' : ''}`}>
            <div className="title">Aft X-Wing {isFailing('wingAft') && <span style={{color: '#f87171'}}>[⚠ FAILING]</span>}</div>
            <div>Throttle: {telemetry?.throttle?.toFixed(1)??'—'}%</div></div>
        </Html>
      )}

      {/* Engine nacelle */}
      <mesh castShadow rotation={[0,0,Math.PI/2]} position={[-6.5,0,0]} onPointerDown={e=>handle(e,'engine')}>
        <cylinderGeometry args={[0.44,0.34,0.9,18]} />
        <primitive object={nacelleMat} attach="material" />
        {(isSel('engine') || isFailing('engine')) && (
          <Html center distanceFactor={10} position={[0,1.5,0]}>
            <div className={`tooltip3d engine ${isFailing('engine') ? 'failing' : ''}`}>
              <div className="title">Engine &amp; Propeller {isFailing('engine') && <span style={{color: '#f87171'}}>[⚠ FAILING]</span>}</div>
              <div>RPM: {telemetry?.rpm?.toFixed(0)??'—'}</div>
              <div style={{color:telemetry?.cht>240?'#ef4444':'inherit'}}>CHT: {telemetry?.cht?.toFixed(1)??'—'}°C</div>
              <div>EGT: {telemetry?.egt?.toFixed(1)??'—'}°C</div>
              <div>Oil P: {telemetry?.oilPressure?.toFixed(0)??'—'} kPa</div>
            </div>
          </Html>
        )}
      </mesh>
      <mesh castShadow rotation={[0,0,Math.PI/2]} position={[-7.05,0,0]}>
        <cylinderGeometry args={[0.2,0.2,0.4,12]} />
        <primitive object={mat.metal} attach="material" />
      </mesh>
      <mesh castShadow position={[-7.35,0,0]} scale={[1.4,1,1]}>
        <sphereGeometry args={[0.2,14,12]} />
        <primitive object={mat.matte} attach="material" />
      </mesh>

      {/* Two-blade pusher propeller */}
      <group ref={propRef} position={[-7.25,0,0]}>
        {[0, Math.PI].map((rot,i) => (
          <group key={i} rotation={[rot,0,0.24]}>
            <mesh castShadow position={[0,0.92,0]}>
              <boxGeometry args={[0.07,1.85,0.16]} />
              <primitive object={mat.prop} attach="material" />
            </mesh>
          </group>
        ))}
      </group>

      {/* Exhaust louvres */}
      {[0.3,-0.3].map(z => (
        <mesh key={z} position={[-5.6,0.22,z]}>
          <boxGeometry args={[0.5,0.12,0.1]} />
          <primitive object={mat.matte} attach="material" />
        </mesh>
      ))}
    </group>
  );
}

export default function DroneModel({ telemetry, healthScore=100, selectedPart, onSelectPart = () => {} }) {
  const groupRef = useRef();
  const mat = useMaterials();

  useFrame((state) => {
    if (!groupRef.current) return;
    const t = state.clock.elapsedTime;
    const vib = telemetry?.vibration ?? 0;

    // Only apply LOCAL micro-animations (bob, roll, vibration)
    // Position X/Z/Y are controlled by the PARENT FlyingDrone group
    groupRef.current.position.y = Math.sin(t * 0.9) * 0.08;
    groupRef.current.rotation.z = Math.sin(t * 0.45) * 0.015;
    if (vib > 2.5) {
      const shake = (vib - 2.5) * 0.01;
      groupRef.current.position.x = Math.sin(t * 28) * shake;
    } else {
      groupRef.current.position.x = 0;
    }
  });

  return (
    <group ref={groupRef} scale={0.78}>
      <UAVBody mat={mat} telemetry={telemetry} healthScore={healthScore}
        selectedPart={selectedPart} onSelectPart={onSelectPart} />
    </group>
  );
}
