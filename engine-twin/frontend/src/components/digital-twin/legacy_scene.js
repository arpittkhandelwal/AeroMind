if(typeof THREE === 'undefined'){
  document.getElementById('canvas-wrap').innerHTML =
    '<div style="color:#f0b39c;padding:24px;font-family:sans-serif">'+
    'The 3D library failed to load from the CDN. Check your network connection and reload.</div>';
}
(function(){
"use strict";
if(typeof THREE === 'undefined'){ return; }

/* ============================================================
   1. SENSOR AND SUBSYSTEM MODEL
   ============================================================ */

// base values are "physics-expected" readings; jitter is normal noise band
var SENSORS = {
  rpm:     {label:'Engine RPM',            unit:'rpm', base:5400, jitter:38,  dp:0},
  cht:     {label:'Cylinder head temp',    unit:'°C',  base:198,  jitter:1.6, dp:0},
  oil:     {label:'Oil pressure',          unit:'bar', base:4.4,  jitter:.05, dp:2},
  vib:     {label:'Engine vibration',      unit:'g',   base:1.15, jitter:.05, dp:2},
  fflow:   {label:'Fuel flow',             unit:'L/h', base:12.6, jitter:.14, dp:1},
  tankp:   {label:'Fuel tank pressure',    unit:'kPa', base:38,   jitter:.6,  dp:0},
  ftemp:   {label:'Fuel temperature',      unit:'°C',  base:31,   jitter:.5,  dp:0},
  frem:    {label:'Fuel remaining',        unit:'%',   base:82,   jitter:.2,  dp:0},
  gimbal:  {label:'Gimbal servo current',  unit:'A',   base:2.2,  jitter:.06, dp:2},
  lens:    {label:'Turret housing temp',   unit:'°C',  base:34,   jitter:.6,  dp:0},
  stab:    {label:'Line-of-sight jitter',  unit:'mrad',base:.18,  jitter:.02, dp:2},
  ailR:    {label:'Fwd fin actuator current',unit:'A', base:1.9,  jitter:.06, dp:2},
  strainR: {label:'Fwd fin root strain',   unit:'µε',  base:410,  jitter:9,   dp:0},
  bus:     {label:'28 V bus',              unit:'V',   base:27.8, jitter:.09, dp:1},
  cpu:     {label:'Mission computer temp', unit:'°C',  base:52,   jitter:.9,  dp:0},
  snr:     {label:'Datalink SNR',          unit:'dB',  base:24,   jitter:.5,  dp:0},
  rud:     {label:'Aft fin actuator current',unit:'A', base:1.6,  jitter:.05, dp:2},
  strainT: {label:'Aft fin root strain',   unit:'µε',  base:360,  jitter:8,   dp:0}
};

// flight condition shifts the expected baseline (mission profile simulator)
var CONDITIONS = {
  std:   {name:'Standard profile', alt:4500, ias:172, shift:{}},
  hot:   {name:'Hot and high',     alt:6000, ias:166, shift:{cht:+22, oil:-0.3, ftemp:+11, cpu:+8, rpm:-140}},
  long:  {name:'Long endurance',   alt:5200, ias:148, shift:{rpm:-620, fflow:-3.1, cht:-14, vib:-0.12}},
  climb: {name:'Max climb',        alt:3100, ias:158, shift:{rpm:+380, cht:+16, fflow:+2.4, strainR:+70, strainT:+60}}
};

var PARTS = {
  engine:  {name:'Engine and propeller',      role:'Tail-mounted powerplant driving the two-blade pusher prop',
            sensors:['rpm','cht','oil','vib','fflow']},
  turret:  {name:'Nose camera and sensor unit',role:'Gyro-stabilised day/night seeker head in the nose',
            sensors:['gimbal','lens','stab']},
  wingFwd: {name:'Forward X-wing set',        role:'Four cruciform lifting panels, forward station',
            sensors:['ailR','strainR']},
  wingAft: {name:'Aft X-wing set',            role:'Four cruciform control panels, aft station',
            sensors:['rud','strainT']},
  avionics:{name:'Avionics bay',              role:'Mission computer, flight control, power bus',
            sensors:['bus','cpu','snr']},
  fuel:    {name:'Fuel and payload bay',      role:'Centre tank, boost pumps and feed lines',
            sensors:['tankp','ftemp','frem']},
  satcom:  {name:'Datalink antenna mast',     role:'Command and control link on the fuselage spine',
            sensors:['snr','bus']}
};

var FAULTS = [
  {id:'overheat', label:'Engine overheat',            part:'engine', rul:78,
   cause:'Cooling airflow loss across the cylinder head jacket',
   fix:'Reduce power to 65% and open cowl flap',
   drivers:[['cht',46],['oil',-1.1],['rpm',-320],['fflow',0.9]]},
  {id:'oil', label:'Oil pressure loss',               part:'engine', rul:54,
   cause:'Scavenge pump wear and progressive oil starvation',
   fix:'Shut down engine and glide to the recovery strip',
   drivers:[['oil',-2.9],['vib',1.3],['cht',26],['rpm',-520]]},
  {id:'misfire', label:'Cylinder misfire',            part:'engine', rul:92,
   cause:'Degraded ignition lead on cylinder 3',
   fix:'Switch to the backup ignition circuit',
   drivers:[['vib',2.8],['rpm',-470],['fflow',1.6],['cht',-11]]},
  {id:'gimbal', label:'EO/IR gimbal servo stall',     part:'turret', rul:104,
   cause:'Azimuth servo bearing seizure inside the turret ball',
   fix:'Stow the turret and cycle the payload servo bus',
   drivers:[['gimbal',3.4],['lens',26],['stab',0.55]]},
  {id:'aileron', label:'Forward fin actuator drift',  part:'wingFwd', rul:86,
   cause:'Forward X-wing actuator losing position feedback',
   fix:'Trim out the roll and cut the bank limit to 12°',
   drivers:[['ailR',2.4],['strainR',180]]},
  {id:'datalink', label:'Datalink degradation',       part:'satcom', rul:72,
   cause:'Water ingress in the SATCOM dome feed connector',
   fix:'Hand over to the backup SATCOM channel',
   drivers:[['snr',-15],['bus',-1.9]]},
  {id:'fuelpump', label:'Fuel pump cavitation',       part:'fuel', rul:66,
   cause:'Vapour lock in the primary boost pump at altitude',
   fix:'Engage the secondary boost pump and descend 600 m',
   drivers:[['tankp',-17],['ftemp',18],['fflow',-2.2]]},
  {id:'tailact', label:'Aft fin actuator jam',        part:'wingAft', rul:62,
   cause:'Contamination in the aft X-wing actuator screw jack',
   fix:'Switch to the redundant actuator channel',
   drivers:[['rud',3.6],['strainT',240]]},
  {id:'busfault', label:'Power bus brownout',         part:'avionics', rul:70,
   cause:'Generator regulator drifting under payload load',
   fix:'Shed payload load and run on battery bus',
   drivers:[['bus',-3.4],['cpu',21],['snr',-7]]}
];

/* ============================================================
   2. RUNTIME STATE
   ============================================================ */
var S = {
  running:false, t:0,
  cond:'std',
  fault:null, p:0, rul:0, rulMax:0,
  recovering:false, destroyed:false,
  selected:null, endurance:18*60,
  status:'STANDBY'
};

/* ============================================================
   3. THREE.JS SCENE
   ============================================================ */
var wrap = document.getElementById('canvas-wrap');
var scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fb4c4, 40, 190);

var camera = new THREE.PerspectiveCamera(42, 1, 0.1, 800);
var renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
wrap.appendChild(renderer.domElement);

// sky
(function(){
  var c = document.createElement('canvas'); c.width=4; c.height=256;
  var g = c.getContext('2d').createLinearGradient(0,0,0,256);
  g.addColorStop(0,'#2f5f8d'); g.addColorStop(.55,'#8fb3cc'); g.addColorStop(1,'#cbd8de');
  var x=c.getContext('2d'); x.fillStyle=g; x.fillRect(0,0,4,256);
  var t = new THREE.CanvasTexture(c);
  var dome = new THREE.Mesh(new THREE.SphereGeometry(400,24,16),
    new THREE.MeshBasicMaterial({map:t, side:THREE.BackSide}));
  scene.add(dome);
})();

scene.add(new THREE.HemisphereLight(0xbcd3e6, 0x4a5340, 0.85));
var sun = new THREE.DirectionalLight(0xfff0d8, 1.05);
sun.position.set(-40,60,30); scene.add(sun);
var fill = new THREE.DirectionalLight(0x93a8bf, .35); fill.position.set(30,-10,-25); scene.add(fill);

/* ---- procedural textures ---- */
function noiseCanvas(w,h,draw){
  var c=document.createElement('canvas'); c.width=w; c.height=h;
  draw(c.getContext('2d'),w,h); return c;
}

function camoTexture(top){
  var c = noiseCanvas(512,512,function(x,w,h){
    x.fillStyle = top ? '#79818a' : '#99a1a9';
    x.fillRect(0,0,w,h);
    // blotches
    var blob = top ? ['#6c747d','#858d96','#5f676f'] : ['#a4acb4','#8b939b'];
    for(var i=0;i<110;i++){
      x.fillStyle = blob[i%blob.length];
      x.globalAlpha = .28;
      x.beginPath();
      x.ellipse(Math.random()*w, Math.random()*h, 14+Math.random()*52, 10+Math.random()*34,
        Math.random()*3.14, 0, 6.3);
      x.fill();
    }
    x.globalAlpha = 1;
    // panel lines
    x.strokeStyle='rgba(0,0,0,.28)'; x.lineWidth=1.4;
    for(var p=0;p<w;p+=64){ x.beginPath(); x.moveTo(p,0); x.lineTo(p,h); x.stroke(); }
    for(var q=0;q<h;q+=86){ x.beginPath(); x.moveTo(0,q); x.lineTo(w,q); x.stroke(); }
    // rivets
    x.fillStyle='rgba(0,0,0,.22)';
    for(var r=0;r<w;r+=64) for(var s=8;s<h;s+=17){ x.fillRect(r-1,s,2,2); }
    // grime
    for(var g=0;g<400;g++){
      x.fillStyle='rgba(0,0,0,'+(Math.random()*.06)+')';
      x.fillRect(Math.random()*w,Math.random()*h,Math.random()*40,Math.random()*4);
    }
  });
  var t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// circular Indian tricolour, matching the uploaded flag disc:
// saffron / white / green horizontal bands with the navy Ashoka Chakra
function roundelTexture(){
  var c = noiseCanvas(256,256,function(x,w,h){
    x.fillStyle='#FF9933'; x.fillRect(0,0,w,h/3);
    x.fillStyle='#FFFFFF'; x.fillRect(0,h/3,w,h/3);
    x.fillStyle='#138808'; x.fillRect(0,2*h/3,w,h/3);
    var cx=128, cy=128, R=46;
    x.strokeStyle='#0a2a8f'; x.fillStyle='#0a2a8f';
    x.lineWidth=3.2; x.beginPath(); x.arc(cx,cy,R,0,6.2832); x.stroke();
    x.lineWidth=1.5;
    for(var i=0;i<24;i++){
      var a = i/24*6.2832;
      x.beginPath();
      x.moveTo(cx+Math.cos(a)*7, cy+Math.sin(a)*7);
      x.lineTo(cx+Math.cos(a)*(R-2), cy+Math.sin(a)*(R-2));
      x.stroke();
      // spoke pin near the rim
      x.beginPath(); x.arc(cx+Math.cos(a+0.06)*(R-9), cy+Math.sin(a+0.06)*(R-9), 2.1, 0, 6.3); x.fill();
    }
    x.beginPath(); x.arc(cx,cy,7,0,6.3); x.fill();
    // light service weathering so the decal sits into the paint
    x.globalAlpha=.10; x.fillStyle='#000';
    for(var k=0;k<260;k++) x.fillRect(Math.random()*w,Math.random()*h,3,2);
  });
  return new THREE.CanvasTexture(c);
}

function stripeTexture(){
  var c = noiseCanvas(64,64,function(x,w,h){
    x.fillStyle='#ff9933'; x.fillRect(0,0,w,h/3);
    x.fillStyle='#f2f2ee'; x.fillRect(0,h/3,w,h/3);
    x.fillStyle='#138808'; x.fillRect(0,2*h/3,w,h/3);
  });
  return new THREE.CanvasTexture(c);
}

var MAT = {
  top:   new THREE.MeshStandardMaterial({map:camoTexture(true),  roughness:.92, metalness:.06}),
  belly: new THREE.MeshStandardMaterial({map:camoTexture(false), roughness:.88, metalness:.08}),
  matte: new THREE.MeshStandardMaterial({color:0x1b1d1e, roughness:.96, metalness:.04}),
  glass: new THREE.MeshStandardMaterial({color:0x0d2430, roughness:.12, metalness:.85}),
  metal: new THREE.MeshStandardMaterial({color:0x6e737a, roughness:.45, metalness:.8}),
  rubber:new THREE.MeshStandardMaterial({color:0x14161a, roughness:1}),
  prop:  new THREE.MeshStandardMaterial({color:0x22242a, roughness:.7, metalness:.2}),
  nacelle:new THREE.MeshStandardMaterial({color:0x5f666d, roughness:.7, metalness:.2,
          emissive:new THREE.Color(0x000000)}),
  decal: new THREE.MeshStandardMaterial({map:roundelTexture(), transparent:true, roughness:.9}),
  stripe:new THREE.MeshStandardMaterial({map:stripeTexture(), roughness:.9})
};

/* ---- airframe ---- */
var uav = new THREE.Group();
scene.add(uav);
var partMeshes = {};   // partId -> [mesh]

function add(parent, geo, mat, partId){
  var m = new THREE.Mesh(geo, mat);
  m.userData.partId = partId || null;
  parent.add(m);
  if(partId){ (partMeshes[partId] = partMeshes[partId] || []).push(m); }
  return m;
}
function markGroup(g, partId){
  g.traverse(function(o){ if(o.isMesh && !o.userData.partId){
    o.userData.partId = partId;
    (partMeshes[partId]=partMeshes[partId]||[]).push(o);
  }});
}

var SPAN = 9.5;            // half-span in scene units
var engineNacelle, propeller, turretBall, uavShell;

(function buildUAV(){
  uavShell = new THREE.Group(); uav.add(uavShell);

  var L = 11.0;   // fuselage length in scene units

  /* ---------- fuselage: slender tube, like the reference airframe ---------- */
  var body = add(uavShell, new THREE.CylinderGeometry(0.62,0.62,4.4,20), MAT.top, 'avionics');
  body.rotation.z = Math.PI/2; body.position.set(2.0,0,0);

  var bodyMid = add(uavShell, new THREE.CylinderGeometry(0.62,0.6,3.6,20), MAT.top, 'fuel');
  bodyMid.rotation.z = Math.PI/2; bodyMid.position.set(-1.9,0,0);

  var bodyAft = add(uavShell, new THREE.CylinderGeometry(0.6,0.44,2.6,20), MAT.top, 'engine');
  bodyAft.rotation.z = Math.PI/2; bodyAft.position.set(-5.0,0,0);

  /* nose: shouldered sensor head with a glass seeker window */
  var noseCol = add(uavShell, new THREE.CylinderGeometry(0.66,0.62,0.5,20), MAT.matte, 'turret');
  noseCol.rotation.z = Math.PI/2; noseCol.position.set(4.3,0,0);
  var noseCap = add(uavShell, new THREE.SphereGeometry(0.64,22,16), MAT.belly, 'turret');
  noseCap.position.set(4.75,0,0); noseCap.scale.set(1.5,1,1);
  turretBall = add(uavShell, new THREE.SphereGeometry(0.42,20,16), MAT.matte, 'turret');
  turretBall.position.set(5.35,-0.08,0);
  var seeker = add(uavShell, new THREE.CylinderGeometry(0.3,0.3,0.12,20), MAT.glass, 'turret');
  seeker.rotation.z = Math.PI/2; seeker.position.set(5.66,-0.08,0);
  var seeker2 = add(uavShell, new THREE.CylinderGeometry(0.13,0.13,0.1,14), MAT.glass, 'turret');
  seeker2.rotation.z = Math.PI/2; seeker2.position.set(5.62,0.16,0.2);

  /* yellow service bands, as on the reference airframe */
  [[3.55,'turret'],[0.1,'avionics'],[-3.5,'fuel']].forEach(function(b){
    var band = add(uavShell, new THREE.CylinderGeometry(0.635,0.635,0.22,22),
      new THREE.MeshStandardMaterial({color:0xd8b323, roughness:.75}), b[1]);
    band.rotation.z = Math.PI/2; band.position.set(b[0],0,0);
  });

  /* fuselage spine detail: access hatch + antenna mast */
  var hatch = add(uavShell, new THREE.BoxGeometry(2.2,0.06,0.7), MAT.belly, 'avionics');
  hatch.position.set(2.2,0.6,0);

  var mast = new THREE.Group();
  var post = new THREE.Mesh(new THREE.CylinderGeometry(0.1,0.13,0.5,10), MAT.matte);
  post.position.set(0.4,0.82,0);
  var blade = new THREE.Mesh(new THREE.BoxGeometry(0.42,0.46,0.07), MAT.matte);
  blade.position.set(0.4,1.2,0);
  var blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.34,0.06), MAT.matte);
  blade2.position.set(-2.6,0.78,0);
  mast.add(post); mast.add(blade); mast.add(blade2);
  markGroup(mast,'satcom');
  uavShell.add(mast);

  /* ---------- X-shaped wing sets ---------- */
  // four cruciform panels at 45° intervals around the tube, two stations.
  // Each panel is a root board plus a narrower, swept tip board — simple boxes,
  // no vertex manipulation, so it can never fail to build.
  function xwing(xPos, chord, span, sweep, partId, decal){
    var set = new THREE.Group();
    set.position.x = xPos;
    for(var i=0;i<4;i++){
      var arm = new THREE.Group();
      arm.rotation.x = Math.PI/4 + i*Math.PI/2;   // 45°, 135°, 225°, 315°

      var root = new THREE.Mesh(new THREE.BoxGeometry(chord,0.1,span*0.55), MAT.top);
      root.position.set(0, 0, 0.45 + span*0.275);
      arm.add(root);

      var tip = new THREE.Mesh(new THREE.BoxGeometry(chord*0.62, 0.09, span*0.5), MAT.top);
      tip.position.set(-sweep*0.5, 0, 0.45 + span*0.55 + span*0.25);
      arm.add(tip);

      // control surface strip on the trailing edge of the root board
      var flap = new THREE.Mesh(new THREE.BoxGeometry(0.3,0.09,span*0.4), MAT.belly);
      flap.position.set(-chord/2-0.1, 0, 0.45 + span*0.32);
      arm.add(flap);

      // flag disc lying flat on the upper two panels
      if(decal && (i===0 || i===3)){
        var d = new THREE.Mesh(new THREE.CircleGeometry(0.5,30), MAT.decal);
        d.rotation.x = -Math.PI/2;
        d.position.set(0.05, 0.07, 0.45 + span*0.32);
        arm.add(d);
      }
      set.add(arm);
    }
    markGroup(set, partId);
    return set;
  }
  uavShell.add(xwing( 1.3, 2.4, 3.5, 0.9, 'wingFwd', true));
  uavShell.add(xwing(-3.9, 1.9, 2.7, 0.7, 'wingAft', false));

  /* ---------- flag discs on both fuselage flanks ---------- */
  [1,-1].forEach(function(sign){
    var r = new THREE.Mesh(new THREE.CircleGeometry(0.5,30), MAT.decal);
    r.position.set(-1.6, 0.06, sign*0.625);
    r.rotation.y = sign>0 ? 0 : Math.PI;
    r.userData.partId = 'fuel';
    uavShell.add(r); partMeshes.fuel.push(r);
  });

  /* ---------- tail powerplant and two-blade pusher prop ---------- */
  engineNacelle = add(uavShell, new THREE.CylinderGeometry(0.44,0.34,0.9,18), MAT.nacelle, 'engine');
  engineNacelle.rotation.z = Math.PI/2; engineNacelle.position.set(-6.5,0,0);
  var mount = add(uavShell, new THREE.CylinderGeometry(0.2,0.2,0.4,12), MAT.metal, 'engine');
  mount.rotation.z = Math.PI/2; mount.position.set(-7.05,0,0);
  var spinner = add(uavShell, new THREE.SphereGeometry(0.2,14,12), MAT.matte, 'engine');
  spinner.position.set(-7.35,0,0); spinner.scale.set(1.4,1,1);

  propeller = new THREE.Group(); propeller.position.set(-7.25,0,0); uavShell.add(propeller);
  for(var b=0;b<2;b++){
    var pb = new THREE.Mesh(new THREE.BoxGeometry(0.07,1.85,0.16), MAT.prop);
    pb.position.y = 0.92;
    var holder = new THREE.Group();
    holder.rotation.x = b*Math.PI;
    holder.rotation.z = 0.24;            // blade pitch
    holder.add(pb);
    propeller.add(holder);
  }
  markGroup(propeller,'engine');

  /* small exhaust / cooling louvres near the powerplant */
  [0.3,-0.3].forEach(function(z){
    var lv = add(uavShell, new THREE.BoxGeometry(0.5,0.12,0.1), MAT.matte, 'engine');
    lv.position.set(-5.6,0.22,z);
  });

  uav.userData.len = L;
})();

uav.scale.setScalar(0.78);

/* ---- ground: scrolling terrain plane ---- */
var groundTex = (function(){
  var c = noiseCanvas(512,512,function(x,w,h){
    x.fillStyle='#6f6a4e'; x.fillRect(0,0,w,h);
    for(var i=0;i<700;i++){
      x.fillStyle = ['#7b765a','#625d45','#857f60','#565440'][i%4];
      x.globalAlpha=.5;
      x.beginPath();
      x.ellipse(Math.random()*w,Math.random()*h,8+Math.random()*40,6+Math.random()*26,0,0,6.3);
      x.fill();
    }
    x.globalAlpha=1;
    x.strokeStyle='rgba(60,58,44,.5)'; x.lineWidth=3;
    x.beginPath(); x.moveTo(0,300); x.bezierCurveTo(160,260,300,360,512,320); x.stroke();
  });
  var t = new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(14,14);
  return t;
})();
var ground = new THREE.Mesh(new THREE.PlaneGeometry(900,900),
  new THREE.MeshStandardMaterial({map:groundTex, roughness:1}));
ground.rotation.x = -Math.PI/2; ground.position.y = -46; scene.add(ground);

/* ---- clouds drifting past ---- */
var clouds = [];
(function(){
  var cTex = (function(){
    var c = noiseCanvas(128,128,function(x,w,h){
      var g = x.createRadialGradient(64,64,4,64,64,62);
      g.addColorStop(0,'rgba(255,255,255,.9)'); g.addColorStop(1,'rgba(255,255,255,0)');
      x.fillStyle=g; x.fillRect(0,0,w,h);
    });
    return new THREE.CanvasTexture(c);
  })();
  var m = new THREE.SpriteMaterial({map:cTex, transparent:true, opacity:.55, depthWrite:false});
  for(var i=0;i<26;i++){
    var s = new THREE.Sprite(m);
    s.position.set(-200+Math.random()*400, -30+Math.random()*34, -140+Math.random()*280);
    s.scale.setScalar(22+Math.random()*44);
    clouds.push(s); scene.add(s);
  }
})();

/* ---- smoke + debris pools ---- */
var smokeTex = (function(){
  var c = noiseCanvas(128,128,function(x,w,h){
    var g = x.createRadialGradient(64,64,2,64,64,62);
    g.addColorStop(0,'rgba(40,36,34,.95)'); g.addColorStop(.5,'rgba(60,54,50,.5)');
    g.addColorStop(1,'rgba(70,64,60,0)');
    x.fillStyle=g; x.fillRect(0,0,w,h);
  });
  return new THREE.CanvasTexture(c);
})();
var smoke = [];
for(var i=0;i<46;i++){
  var sp = new THREE.Sprite(new THREE.SpriteMaterial({map:smokeTex, transparent:true, opacity:0, depthWrite:false}));
  sp.visible = false; scene.add(sp); smoke.push({s:sp, life:0});
}
function puff(pos, scale, dark){
  for(var i=0;i<smoke.length;i++){
    if(smoke[i].life<=0){
      var e = smoke[i];
      e.s.visible = true; e.s.position.copy(pos);
      e.s.position.x += (Math.random()-.5)*.6;
      e.s.position.y += (Math.random()-.5)*.6;
      e.life = 1; e.scale = scale*(0.7+Math.random()*0.7);
      e.s.material.color.setHex(dark?0x2a2724:0x6b655f);
      e.vy = 0.5+Math.random()*1.2; e.vx = -1.2-Math.random();
      return;
    }
  }
}

var debris = [], debrisGeo = null;
var flash = new THREE.Mesh(new THREE.SphereGeometry(1,16,12),
  new THREE.MeshBasicMaterial({color:0xffd9a0, transparent:true, opacity:0}));
scene.add(flash);
var fireLight = new THREE.PointLight(0xff8a3c, 0, 60); scene.add(fireLight);

/* ============================================================
   4. HAND-ROLLED ORBIT CONTROL
   ============================================================ */
var cam = {theta:2.45, phi:1.30, r:21, tr:21};
var drag = null, moved = 0;
function applyCam(){
  cam.phi = Math.max(0.35, Math.min(2.5, cam.phi));
  cam.r += (cam.tr - cam.r)*0.12;
  camera.position.set(
    cam.r*Math.sin(cam.phi)*Math.cos(cam.theta),
    cam.r*Math.cos(cam.phi),
    cam.r*Math.sin(cam.phi)*Math.sin(cam.theta)
  );
  camera.lookAt(0,0,0);
}
var el = renderer.domElement;
el.style.touchAction = 'none';
el.addEventListener('pointerdown', function(e){
  drag = {x:e.clientX, y:e.clientY}; moved = 0;
  el.setPointerCapture(e.pointerId);
});
el.addEventListener('pointermove', function(e){
  if(!drag) return;
  var dx = e.clientX-drag.x, dy = e.clientY-drag.y;
  moved += Math.abs(dx)+Math.abs(dy);
  cam.theta -= dx*0.006; cam.phi -= dy*0.006;
  drag.x = e.clientX; drag.y = e.clientY;
});
el.addEventListener('pointerup', function(e){
  if(drag && moved < 6) pickAt(e.clientX, e.clientY);
  drag = null;
});
el.addEventListener('pointercancel', function(){ drag = null; });
el.addEventListener('wheel', function(e){
  e.preventDefault();
  cam.tr = Math.max(11, Math.min(60, cam.tr + (e.deltaY>0?2.2:-2.2)));
}, {passive:false});

/* pinch zoom */
var pinch = null;
el.addEventListener('touchstart', function(e){
  if(e.touches.length===2){
    pinch = Math.hypot(e.touches[0].clientX-e.touches[1].clientX,
                       e.touches[0].clientY-e.touches[1].clientY);
  }
});
el.addEventListener('touchmove', function(e){
  if(e.touches.length===2 && pinch){
    var d = Math.hypot(e.touches[0].clientX-e.touches[1].clientX,
                       e.touches[0].clientY-e.touches[1].clientY);
    cam.tr = Math.max(11, Math.min(60, cam.tr - (d-pinch)*0.06));
    pinch = d;
  }
});
el.addEventListener('touchend', function(){ pinch = null; });

var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function pickAt(cx, cy){
  if(S.destroyed) return;
  var r = el.getBoundingClientRect();
  ndc.x = ((cx-r.left)/r.width)*2-1;
  ndc.y = -((cy-r.top)/r.height)*2+1;
  ray.setFromCamera(ndc, camera);
  var hits = ray.intersectObject(uav, true);
  for(var i=0;i<hits.length;i++){
    var o = hits[i].object;
    while(o && !o.userData.partId) o = o.parent;
    if(o && o.userData.partId){ select(o.userData.partId); return; }
  }
  closeInspector();
}

/* ============================================================
   5. TELEMETRY MATH
   ============================================================ */
function expected(key){
  var s = SENSORS[key];
  var shift = CONDITIONS[S.cond].shift[key] || 0;
  return s.base + shift;
}
function driverDelta(key){
  if(!S.fault) return 0;
  for(var i=0;i<S.fault.drivers.length;i++){
    if(S.fault.drivers[i][0] === key) return S.fault.drivers[i][1];
  }
  return 0;
}
function reading(key){
  var s = SENSORS[key];
  var v = expected(key) + driverDelta(key)*S.p;
  // running engine sensors stay pegged at zero while parked
  if(!S.running && (key==='rpm'||key==='cht'||key==='oil'||key==='vib'||key==='fflow')){
    v = key==='cht' ? 26 : 0;
  }
  var n = Math.sin(S.t*(1.7+key.length*0.13))*s.jitter*0.6 + (Math.random()-.5)*s.jitter;
  return v + n;
}
function sigma(key){
  var s = SENSORS[key];
  return Math.abs(driverDelta(key)*S.p) / (s.jitter*1.6 || 1);
}
function fmt(key, v){
  var s = SENSORS[key];
  return v.toFixed(s.dp);
}
function partHealth(id){
  if(S.destroyed) return 0;
  if(!S.fault || S.fault.part !== id) return 100;
  return Math.max(0, Math.round(100 - S.p*100));
}

/* ============================================================
   6. UI WIRING
   ============================================================ */
var $ = function(id){ return document.getElementById(id); };
var TELE_KEYS = ['rpm','cht','oil','vib','snr','frem'];

// telemetry rows
var teleRows = {};
TELE_KEYS.forEach(function(k){
  var d = document.createElement('div'); d.className='row';
  d.innerHTML = '<span class="n">'+SENSORS[k].label+'</span>'+
    '<span class="v num">—</span><span class="e num">—</span>';
  $('tele').appendChild(d);
  teleRows[k] = d;
});

// subsystem buttons
var subRows = {};
Object.keys(PARTS).forEach(function(id){
  var b = document.createElement('button');
  b.innerHTML = '<span class="dot"></span><span>'+PARTS[id].name+'</span><span class="pct num">100%</span>';
  b.addEventListener('click', function(){ select(id); });
  $('subs').appendChild(b);
  subRows[id] = b;
});

// fault list
FAULTS.forEach(function(f){
  var o = document.createElement('option'); o.value=f.id; o.textContent=f.label;
  $('fault').appendChild(o);
});
var randOpt = document.createElement('option');
randOpt.value='random'; randOpt.textContent='Random unannounced fault';
$('fault').appendChild(randOpt);

function log(msg, cls){
  var li = document.createElement('li');
  var mm = Math.floor(S.t/60), ss = Math.floor(S.t%60);
  li.className = cls || '';
  li.innerHTML = '<time>T+'+(mm<10?'0':'')+mm+':'+(ss<10?'0':'')+ss+'</time><span>'+msg+'</span>';
  var list = $('log-list');
  list.insertBefore(li, list.firstChild);
  while(list.children.length>26) list.removeChild(list.lastChild);
}

/* ---- inspector ---- */
function select(id){
  S.selected = id;
  var P = PARTS[id];
  $('inspector').classList.add('on');
  $('ins-name').textContent = P.name;
  $('ins-role').textContent = P.role;
  renderInspector();
}
function closeInspector(){ S.selected=null; $('inspector').classList.remove('on'); }
$('ins-close').addEventListener('click', closeInspector);

function renderInspector(){
  var id = S.selected; if(!id) return;
  var P = PARTS[id], h = partHealth(id);
  $('ins-bar').style.width = h+'%';
  $('ins-bar').style.background = h>70 ? 'var(--ok)' : (h>35 ? 'var(--caution)' : 'var(--crit)');
  $('ins-pc').textContent = h+'%';

  var host = $('ins-rows'); host.innerHTML = '';
  P.sensors.forEach(function(k){
    var v = reading(k), e = expected(k), sg = sigma(k);
    var d = document.createElement('div');
    d.className = 'row' + (sg>3 ? ' bad' : (sg>1.2 ? ' dev' : ''));
    d.innerHTML = '<span class="n">'+SENSORS[k].label+'</span>'+
      '<span class="v num">'+fmt(k,v)+' '+SENSORS[k].unit+'</span>'+
      '<span class="e num">exp '+fmt(k,e)+'</span>';
    host.appendChild(d);
  });

  var faulty = S.fault && S.fault.part===id && !S.recovering;
  if(S.destroyed){
    $('ins-note').textContent = 'Airframe lost. Readings are from the final recorded frame.';
    $('ins-fix').classList.remove('on');
  } else if(faulty){
    $('ins-note').innerHTML = '<b style="color:var(--warn)">'+S.fault.label+'</b> — '+S.fault.cause+
      '. Predicted failure in '+Math.ceil(S.rul)+' s if no action is taken.';
    $('ins-fix').textContent = S.fault.fix;
    $('ins-fix').classList.add('on');
  } else if(S.fault && S.recovering && S.fault.part===id){
    $('ins-note').textContent = 'Corrective action applied. Readings are returning to the expected baseline.';
    $('ins-fix').classList.remove('on');
  } else {
    $('ins-note').textContent = S.fault
      ? 'No anomaly on this subsystem. The active alert is on the '+PARTS[S.fault.part].name.toLowerCase()+'.'
      : 'No anomaly detected. All readings sit inside the predicted band.';
    $('ins-fix').classList.remove('on');
  }
}

$('ins-fix').addEventListener('click', function(){
  if(!S.fault || S.recovering) return;
  S.recovering = true;
  setStatus('RECOVERING', S.fault.fix.toLowerCase());
  log('Corrective action: '+S.fault.fix, 'g');
  $('rul').classList.remove('on','hot');
  renderInspector();
});

/* ---- hotspot marker ---- */
var spot = document.createElement('div');
spot.className = 'spot hidden'; spot.textContent = '!';
spot.title = 'Inspect the subsystem the model has flagged';
$('stage').appendChild(spot);
spot.addEventListener('click', function(){ if(S.fault) select(S.fault.part); });

var wv = new THREE.Vector3();
function updateSpot(){
  if(!S.fault || S.recovering || S.destroyed){ spot.classList.add('hidden'); return; }
  var meshes = partMeshes[S.fault.part];
  if(!meshes || !meshes.length){ spot.classList.add('hidden'); return; }
  meshes[0].getWorldPosition(wv);
  var v = wv.clone().project(camera);
  if(v.z > 1){ spot.classList.add('hidden'); return; }
  var r = el.getBoundingClientRect();
  spot.classList.remove('hidden');
  spot.style.left = ((v.x+1)/2*r.width) + 'px';
  spot.style.top  = ((-v.y+1)/2*r.height) + 'px';
}

/* ---- status ---- */
function setStatus(text, sub){
  S.status = text;
  $('state-text').textContent = text;
  $('state-sub').textContent = sub || '';
  var col = text==='WARNING' ? 'var(--warn)'
          : text==='CRITICAL' ? 'var(--crit)'
          : text==='CAUTION' ? 'var(--caution)'
          : text==='AIRFRAME LOST' ? 'var(--crit)'
          : text==='RECOVERING' ? 'var(--ok)'
          : text==='NOMINAL' ? 'var(--ok)' : 'var(--ink-dim)';
  $('state-text').style.color = col;
  $('state').style.borderLeftColor = col;
}

/* ---- why panel ---- */
function renderWhy(){
  if(!S.fault){
    $('why-text').textContent = 'No alert active. Baselines are being tracked against the physics model.';
    $('why-drivers').innerHTML = '';
    return;
  }
  if(S.recovering){
    $('why-text').textContent = 'Alert clearing. Deviation from the expected baseline is shrinking after the corrective action.';
  } else {
    $('why-text').textContent = 'The model flagged the '+PARTS[S.fault.part].name.toLowerCase()+
      ' because these readings are drifting away from what the physics baseline predicts for this flight condition, '+
      'well before any of them reach a redline.';
  }
  var host = $('why-drivers'); host.innerHTML = '';
  S.fault.drivers.forEach(function(d){
    var k = d[0], sg = sigma(k);
    var row = document.createElement('div'); row.className='d';
    row.innerHTML = '<span>'+SENSORS[k].label+'</span><b>'+sg.toFixed(1)+'σ</b>';
    host.appendChild(row);
  });
}

/* ---- mission controls ---- */
$('b-start').addEventListener('click', function(){
  if(S.destroyed) return;
  S.running = !S.running;
  $('b-start').textContent = S.running ? 'Hold mission' : 'Start mission';
  $('b-rtb').disabled = !S.running;
  if(S.running){
    setStatus('NOMINAL', CONDITIONS[S.cond].name.toLowerCase());
    log('Mission started · '+CONDITIONS[S.cond].name);
  } else {
    log('Mission held');
  }
});

$('cond').addEventListener('change', function(){
  S.cond = this.value;
  log('Flight condition set to '+CONDITIONS[S.cond].name);
  if(S.running && !S.fault) setStatus('NOMINAL', CONDITIONS[S.cond].name.toLowerCase());
  renderWhy();
});

$('b-inject').addEventListener('click', function(){
  if(S.destroyed) return;
  if(!S.running){ $('b-start').click(); }
  var pick = $('fault').value;
  var f = pick==='random' ? FAULTS[Math.floor(Math.random()*FAULTS.length)]
                          : FAULTS.filter(function(x){return x.id===pick;})[0];
  S.fault = f; S.p = 0; S.rulMax = f.rul; S.rul = f.rul; S.recovering = false;
  setStatus('CAUTION', 'deviation detected on the '+PARTS[f.part].name.toLowerCase());
  log('Model flagged a deviation on the '+PARTS[f.part].name.toLowerCase(), 'w');
  $('rul').classList.add('on');
  renderWhy();
  if(S.selected) renderInspector();
});

$('b-rtb').addEventListener('click', function(){
  if(S.destroyed) return;
  if(S.fault && !S.recovering){
    S.recovering = true;
    log('Return to base · mission aborted, load reduced', 'g');
    setStatus('RECOVERING', 'returning to base');
    $('rul').classList.remove('on','hot');
  } else {
    log('Return to base · recovery profile');
    setStatus('NOMINAL','returning to base');
  }
  renderInspector();
});

$('l-reset').addEventListener('click', resetAll);

/* ============================================================
   7. DESTRUCTION SEQUENCE
   ============================================================ */
function destroy(){
  S.destroyed = true; S.running = false;
  setStatus('AIRFRAME LOST','catastrophic failure at T+'+Math.floor(S.t)+' s');
  log('CATASTROPHIC FAILURE — '+S.fault.label+' progressed to airframe loss', 'w');
  $('rul').classList.remove('on','hot');
  $('rul-clock').textContent = '00:00';
  spot.classList.add('hidden');

  // fragment the airframe into debris
  var mats = [MAT.top, MAT.belly, MAT.matte, MAT.metal];
  if(!debrisGeo) debrisGeo = new THREE.BoxGeometry(1,1,1);
  for(var i=0;i<120;i++){
    var m = new THREE.Mesh(debrisGeo, mats[i%mats.length]);
    var s1 = 0.12+Math.random()*0.5, s2 = 0.1+Math.random()*0.35;
    m.scale.set(s1, s2, 0.1+Math.random()*0.45);
    m.position.set((Math.random()-.5)*7, (Math.random()-.5)*1.6, (Math.random()-.5)*8);
    var dir = m.position.clone().normalize();
    debris.push({
      m:m,
      v:new THREE.Vector3(dir.x*(6+Math.random()*12)-4, 2+Math.random()*12, dir.z*(6+Math.random()*12)),
      rv:new THREE.Vector3((Math.random()-.5)*9,(Math.random()-.5)*9,(Math.random()-.5)*9),
      burn: Math.random()<0.4
    });
    scene.add(m);
  }
  uavShell.visible = false;

  flash.material.opacity = 1; flash.scale.setScalar(1);
  fireLight.intensity = 12; fireLight.position.set(0,0,0);
  for(var k=0;k<14;k++) puff(new THREE.Vector3((Math.random()-.5)*4,0,(Math.random()-.5)*4), 6, true);

  $('l-cause').textContent = S.fault.cause;
  $('l-part').textContent  = PARTS[S.fault.part].name;
  $('l-warn').textContent  = S.rulMax + ' s before failure';
  $('l-fix').textContent   = S.fault.fix;
  setTimeout(function(){ $('loss').classList.add('on'); }, 2600);
  renderInspector();
}

function resetAll(){
  // clear debris
  debris.forEach(function(d){ scene.remove(d.m); });
  debris.length = 0;
  smoke.forEach(function(e){ e.life=0; e.s.visible=false; e.s.material.opacity=0; });
  flash.material.opacity = 0; fireLight.intensity = 0;
  uavShell.visible = true;
  MAT.nacelle.emissive.setHex(0x000000);
  uav.position.set(0,0,0); uav.rotation.set(0,0,0);

  S.destroyed = false; S.fault = null; S.p = 0; S.rul = 0;
  S.recovering = false; S.running = false; S.t = 0; S.endurance = 18*60;
  $('loss').classList.remove('on');
  $('rul').classList.remove('on','hot');
  $('b-start').textContent = 'Start mission';
  $('b-rtb').disabled = true;
  setStatus('STANDBY','engine off');
  closeInspector();
  renderWhy();
  $('log-list').innerHTML = '';
  log('Airframe reset · digital twin reinitialised');
}

/* ============================================================
   8. ANIMATION LOOP
   ============================================================ */
var last = performance.now(), uiAcc = 0;

function tick(now){
  requestAnimationFrame(tick);
  var dt = Math.min(0.05, (now-last)/1000); last = now;

  if(S.running || S.recovering) S.t += dt;

  /* --- fault progression --- */
  if(S.fault && !S.destroyed){
    if(S.recovering){
      S.p = Math.max(0, S.p - dt/6);
      if(S.p <= 0.001){
        S.p = 0; S.fault = null; S.recovering = false;
        setStatus(S.running ? 'NOMINAL' : 'STANDBY', 'alert cleared, readings back in band');
        log('Alert cleared · subsystem back inside the predicted band', 'g');
        renderWhy();
        renderInspector();
      }
    } else if(S.running){
      S.rul = Math.max(0, S.rul - dt);
      S.p = 1 - S.rul/S.rulMax;
      var frac = S.rul/S.rulMax;
      if(frac <= 0 ){ destroy(); }
      else if(frac < 0.2 && S.status!=='CRITICAL'){
        setStatus('CRITICAL','failure imminent on the '+PARTS[S.fault.part].name.toLowerCase());
        log('Escalated to CRITICAL — act now or the airframe will be lost', 'w');
        $('rul').classList.add('hot');
      } else if(frac < 0.55 && frac >= 0.2 && S.status!=='WARNING' && S.status!=='CRITICAL'){
        setStatus('WARNING','degradation accelerating');
        log('Escalated to WARNING', 'w');
      }
    }
  }

  /* --- flight motion --- */
  if(!S.destroyed){
    var bank = Math.sin(S.t*0.28)*0.12;
    uav.rotation.z = bank;
    uav.rotation.y = Math.sin(S.t*0.2)*0.06;
    uav.position.y = Math.sin(S.t*0.6)*0.25 + (S.running?0:-0.3);
    if(S.p>0.4 && !S.recovering){
      var shake = (S.p-0.4)*0.5;
      uav.position.y += (Math.random()-.5)*shake;
      uav.rotation.x  = (Math.random()-.5)*shake*0.4;
    } else { uav.rotation.x = 0; }
    var rpmN = S.running ? (1 - 0.5*S.p*(S.fault&&!S.recovering?1:0)) : 0;
    propeller.rotation.x += dt*46*rpmN;
    if(S.running){
      groundTex.offset.x += dt*0.035;
      clouds.forEach(function(c){
        c.position.x -= dt*16;
        if(c.position.x < -220) c.position.x = 220;
      });
    }
  } else {
    // debris physics
    for(var i=0;i<debris.length;i++){
      var d = debris[i];
      d.v.y -= 22*dt;
      d.m.position.addScaledVector(d.v, dt);
      d.m.rotation.x += d.rv.x*dt; d.m.rotation.y += d.rv.y*dt; d.m.rotation.z += d.rv.z*dt;
      if(d.m.position.y < -44){ d.m.position.y = -44; d.v.set(0,0,0); d.rv.set(0,0,0); }
      if(d.burn && Math.random()<0.12) puff(d.m.position, 2.4, true);
    }
    flash.scale.setScalar(flash.scale.x + dt*34);
    flash.material.opacity = Math.max(0, flash.material.opacity - dt*1.5);
    fireLight.intensity = Math.max(0, fireLight.intensity - dt*5);
  }

  /* --- engine glow with severity --- */
  if(!S.destroyed){
    var sev = (S.fault && S.fault.part==='engine' && !S.recovering) ? S.p : 0;
    var c = new THREE.Color().setHSL(0.12 - 0.12*sev, 1, 0.5*sev);
    MAT.nacelle.emissive.copy(c);
    if(sev>0.55 && Math.random()<sev*0.35){
      engineNacelle.getWorldPosition(wv);
      puff(wv, 2.2, sev>0.8);
    }
  }

  /* --- smoke --- */
  for(var j=0;j<smoke.length;j++){
    var e = smoke[j];
    if(e.life>0){
      e.life -= dt*0.42;
      e.s.position.y += e.vy*dt*2.2;
      e.s.position.x += e.vx*dt*4;
      e.s.scale.setScalar(e.scale*(2.2-e.life*1.4));
      e.s.material.opacity = Math.max(0, e.life*0.6);
      if(e.life<=0){ e.s.visible=false; }
    }
  }

  /* --- turret slow scan --- */
  if(turretBall && !S.destroyed){
    turretBall.rotation.y = Math.sin(S.t*0.35)*0.7;
  }

  applyCam();
  updateSpot();
  renderer.render(scene, camera);

  /* --- UI at 5 Hz --- */
  uiAcc += dt;
  if(uiAcc > 0.2){
    uiAcc = 0;
    refreshUI();
  }
}

function refreshUI(){
  TELE_KEYS.forEach(function(k){
    var row = teleRows[k], v = reading(k), sg = sigma(k);
    row.className = 'row' + (sg>3 ? ' bad' : (sg>1.2 ? ' dev' : ''));
    row.children[1].textContent = (S.destroyed?'--':fmt(k,v))+' '+SENSORS[k].unit;
    row.children[2].textContent = 'exp '+fmt(k, expected(k));
  });

  Object.keys(PARTS).forEach(function(id){
    var h = partHealth(id), b = subRows[id];
    b.querySelector('.pct').textContent = h+'%';
    b.querySelector('.dot').style.background =
      h>70 ? 'var(--ok)' : (h>35 ? 'var(--caution)' : 'var(--crit)');
  });

  var C = CONDITIONS[S.cond];
  $('f-alt').textContent = S.destroyed ? '0' : (S.running ? C.alt : 0);
  $('f-ias').textContent = S.destroyed ? '0' : (S.running ? Math.round(C.ias + Math.sin(S.t*0.5)*3) : 0);
  if(S.running) S.endurance = Math.max(0, S.endurance - 0.2*3);
  var mm = Math.floor(S.endurance/60), ss = Math.floor(S.endurance%60);
  $('f-end').textContent = (mm<10?'0':'')+mm+':'+(ss<10?'0':'')+ss;

  if(S.fault && !S.recovering && !S.destroyed){
    var r = Math.ceil(S.rul);
    $('rul-clock').textContent = (r<60?'00:':'0'+Math.floor(r/60)+':')+((r%60)<10?'0':'')+(r%60);
  }

  renderWhy();
  if(S.selected) renderInspector();
}

/* ============================================================
   9. BOOT
   ============================================================ */
function resize(){
  var w = wrap.clientWidth, h = wrap.clientHeight;
  renderer.setSize(w,h,false);
  camera.aspect = w/h; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
setStatus('STANDBY','engine off');
log('Digital twin linked · 21 sensor channels streaming');
refreshUI();
requestAnimationFrame(tick);
})();
