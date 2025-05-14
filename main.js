// ===============================
// Let's Race! - 3D Mario Kart-style Game (Three.js// ===============================
// Core 3D scene setup, track, kart, and controls

// ===============================
// GLOBALS & GAME STATE
// ===============================

// Helper: check if (x, z) is on the road
function isPointOnRoad(x, z, roadWidth) {
  let onRoad = false;
  for (let t = 0; t <= 1; t += 0.01) {
    const pt = trackCurve.getPointAt(t);
    const tangent = trackCurve.getTangentAt(t);
    // normal in XZ plane
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    // Vector from center to (x, z)
    const v = new THREE.Vector3(x - pt.x, 0, z - pt.z);
    // Project v onto normal
    const d = v.dot(normal);
    if (Math.abs(d) < roadWidth/2) {
      onRoad = true;
      break;
    }
  }
  return onRoad;
}
let trackCurve; // Track spline
let keys = {};
let scene, camera, renderer;
let players = [];
let rings = [], currentMap = 0;

// Player class
class Player {
  constructor(startPos, startDir, controls) {
    this.kart = createKart();
    this.pos = startPos.clone();
    this.dir = startDir;
    this.speed = 0;
    this.steerAngle = 0;
    this.ringCount = 0;
    this.controls = controls; // { left, right, up, down }
    scene.add(this.kart);
    console.log('Kart added to scene for player:', controls, this.kart);
  }
}

// Function to create a banana kart
function createKart() {
  const kart = new THREE.Group();
  const scale = 1.3;
  // Banana body (copy from original code)
  const bananaStart = new THREE.Vector3(0, 0.7 * scale, -1.35 * scale); // back, up
  const bananaEnd = new THREE.Vector3(0, 0.7 * scale, 1.35 * scale);   // front, up
  // Smile: both control points up, but the midpoint dips down
  const bananaControl1 = new THREE.Vector3(0, -0.6 * scale, -0.7 * scale); // pulls curve down in the middle
  const bananaControl2 = new THREE.Vector3(0, -0.6 * scale, 0.7 * scale);  // pulls curve down in the middle
  const bananaCurve = new THREE.CubicBezierCurve3(bananaStart, bananaControl1, bananaControl2, bananaEnd);
  const bananaSegments = 120;
  const bananaGeometry = new THREE.TubeGeometry(bananaCurve, bananaSegments, 0.27 * scale, 64, false);
  const pos = bananaGeometry.attributes.position;
  const colors = [];
  for (let i = 0; i < pos.count; i++) {
    const color = new THREE.Color(0xffe066);
    colors.push(color.r, color.g, color.b);
  }
  bananaGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  for (let i = 0; i < pos.count; ++i) {
    const z = pos.getZ(i);
    const t = (z + 1.35 * scale) / (2.7 * scale);
    let radiusScale = 1.0;
    if (t < 0.09) radiusScale = Math.max(0.18, 0.38 + 0.54 * t/0.09);
    else if (t > 0.93) radiusScale = Math.max(0.18, 0.18 + 0.32 * (1-t)/0.07);
    pos.setY(i, pos.getY(i) * radiusScale);
    pos.setX(i, pos.getX(i) * radiusScale);
  }
  const bananaMaterial = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 28, specular: 0x665500, side: THREE.DoubleSide });
  const bananaBody = new THREE.Mesh(bananaGeometry, bananaMaterial);
  bananaBody.position.set(0, 0.62 * scale, 0);
  kart.add(bananaBody);
  // Brown cap (back)
  const capMaterial = new THREE.MeshPhongMaterial({ color: 0x5c3810 });
  const startPt = bananaCurve.getPoint(0);
  const backSphere = new THREE.Mesh(new THREE.SphereGeometry(0.09 * scale, 18, 12), capMaterial);
  backSphere.position.copy(startPt);
  bananaBody.add(backSphere);
  // Yellow cap (front)
  const frontCapMaterial = new THREE.MeshPhongMaterial({ color: 0xffe066 });
  const endPt = bananaCurve.getPoint(1);
  const frontSphere = new THREE.Mesh(new THREE.SphereGeometry(0.09 * scale, 18, 12), frontCapMaterial);
  frontSphere.position.copy(endPt);
  bananaBody.add(frontSphere);
  // Handle (front)
  const endTan = bananaCurve.getTangent(1);
  const handleRadius = 0.09 * scale;
  const handleLength = 0.43 * 1.5 * scale; // increased by 50%
  const handleGeo = new THREE.CylinderGeometry(handleRadius, handleRadius, handleLength, 20);
  const handleMat = new THREE.MeshPhongMaterial({ color: 0xffe066 });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.copy(endPt.clone().add(endTan.clone().multiplyScalar(handleLength/2)));
  handle.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), endTan.clone().normalize()); // follow curve tangent
  bananaBody.add(handle);
  // Chassis and wheels (same as original)
  const chassisMat = new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 80, specular: 0x222222 });
  const wheelRadius = 0.32 * scale;
  const axleY = wheelRadius;
  const wheelX = 0.68 * scale;
  const axleLen = 2 * wheelX;
  const axleRadius = 0.09 * scale;
  const axleGap = 0.4 * scale;
  const shortAxleLen = wheelX - axleGap / 2;
  // Front/rear axles
  [[-axleGap/2-shortAxleLen/2, axleY, 0.68*scale], [axleGap/2+shortAxleLen/2, axleY, 0.68*scale],
   [-axleGap/2-shortAxleLen/2, axleY, -0.68*scale], [axleGap/2+shortAxleLen/2, axleY, -0.68*scale]]
    .forEach(([x,y,z]) => {
      const axleGeo = new THREE.CylinderGeometry(axleRadius, axleRadius, shortAxleLen, 16);
      const axle = new THREE.Mesh(axleGeo, chassisMat);
      axle.position.set(x, y, z);
      axle.rotation.z = Math.PI / 2;
      kart.add(axle);
    });
  // Wheels
  const wheelThickness = 0.18 * scale;
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 18);
  const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });
  const tireMaterial = new THREE.MeshPhongMaterial({ color: 0x111111 });
  const hubcapMaterial = new THREE.MeshPhongMaterial({ color: 0x888888 });
  const wheelPositions = [
    [-0.68 * scale, wheelRadius,  0.68 * scale],
    [ 0.68 * scale, wheelRadius,  0.68 * scale],
    [-0.68 * scale, wheelRadius, -0.68 * scale],
    [ 0.68 * scale, wheelRadius, -0.68 * scale],
  ];
  wheelPositions.forEach(([x, y, z], idx) => {
    const wheelGroup = new THREE.Group();
    const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheelGroup.add(wheel);
    const tireDiscGeo = new THREE.CircleGeometry(wheelRadius, 32);
    const tireDisc1 = new THREE.Mesh(tireDiscGeo, tireMaterial);
    tireDisc1.position.set(0, wheelThickness/2 + 0.001, 0);
    tireDisc1.rotation.z = Math.PI / 2;
    wheelGroup.add(tireDisc1);
    const tireDisc2 = new THREE.Mesh(tireDiscGeo, tireMaterial);
    tireDisc2.position.set(0, -wheelThickness/2 - 0.001, 0);
    tireDisc2.rotation.z = Math.PI / 2;
    wheelGroup.add(tireDisc2);
    const hubcapRadius = wheelRadius * 0.8;
    const hubcapDiscGeo = new THREE.CircleGeometry(hubcapRadius, 24);
    const hubcap1 = new THREE.Mesh(hubcapDiscGeo, hubcapMaterial);
    hubcap1.position.set(0, wheelThickness/2 + 0.015, 0);
    hubcap1.rotation.z = Math.PI / 2;
    wheelGroup.add(hubcap1);
    const hubcap2 = new THREE.Mesh(hubcapDiscGeo, hubcapMaterial);
    hubcap2.position.set(0, -wheelThickness/2 - 0.015, 0);
    hubcap2.rotation.z = Math.PI / 2;
    wheelGroup.add(hubcap2);
    wheelGroup.position.set(x, y, z);
    kart.add(wheelGroup);
  });
  return kart;
}


let allowDrive = false;
let gameRunning = false;
let start, next;
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });

// ===============================
// GAME CONSTANTS
// ===============================
const wheelbase = 1.1;
const maxSteer = Math.PI/6 * 1.5; // 45 degrees
const steerSpeed = 0.0005;
const steerFriction = 0.018;
const maxFwd = 0.32 * 2.4, maxRev = -0.08 * 2.4, accel = 0.0039, brake = 0.025, friction = 0.0026;

// Track/scene constants
const ellipseA = 320, ellipseB = 200, ellipseCount = 16;
const roadWidth = 12; // Width of the road for player placement and rendering (now 50% more narrow)
const groundRadius = ellipseA + 850;
const maps = [
  { name: 'Circuit Plaza', asset: null },
  { name: 'Desert Drift', asset: null },
  { name: 'Mountain Loop', asset: null },
];

/**
 * Initializes the Three.js scene, camera, renderer, lighting, and environment.
 */
function initThreeJS() {
  // ===============================
  // SCENE, CAMERA, RENDERER
  // ===============================
  // Remove any previous renderer(s)
const container = document.getElementById('threejs-container');
while (container.firstChild) {
  container.removeChild(container.firstChild);
}
scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Sky blue

  // Cameras for split screen
  window.camera1 = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  window.camera2 = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('threejs-container').appendChild(renderer.domElement);


  // --- Lighting ---
  const ambient = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(10, 20, 10);
  scene.add(dir);

  // ===============================
  // TRACK/ROAD GENERATION
  // ===============================

  // Generate flat loop points (no hills)
function hillY(t) { return 0; }
  // --- SIMPLE ELLIPSE TRACK CONTROL POINTS ---
  const ellipseCount = 16;
  const loopPoints = [];
  for (let i = 0; i < ellipseCount; ++i) {
    const angle = (i / ellipseCount) * Math.PI * 2;
    const x = Math.cos(angle) * ellipseA;
    const z = Math.sin(angle) * ellipseB;
    loopPoints.push(new THREE.Vector3(x, 0, z));
  }
  // No duplicate closing point!
  // --- Track curve ---
  trackCurve = new THREE.CatmullRomCurve3(loopPoints, true, 'catmullrom', 0.8);

  // Instantiate two players at the same starting position  // Both players start near center, but offset left/right
  start = trackCurve.getPointAt(0).clone();
  const angle = Math.atan2(
    trackCurve.getPointAt(0.01).x - start.x,
    trackCurve.getPointAt(0.01).z - start.z
  );

  // Offset from center to halfway to each side
  const leftOffset = -roadWidth / 4;
  const rightOffset = roadWidth / 4;
  // Calculate left/right positions in local track direction
  const tangent = trackCurve.getTangentAt(0);
  // Compute left direction as cross(up, tangent)
  const up = new THREE.Vector3(0,1,0);
  const leftDir = new THREE.Vector3().crossVectors(up, tangent).normalize();
  const offset = roadWidth / 4;
  const left = start.clone().add(leftDir.clone().multiplyScalar(offset));
  const right = start.clone().add(leftDir.clone().multiplyScalar(-offset));
  // Player 1 (WASD) is always on the left, Player 2 (arrows) is always on the right
  players = [
    new Player(left, angle, { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS' }), // Player 1 (left)
    new Player(right, angle, { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' }) // Player 2 (right)
  ];
  // Ensure karts are visibly positioned at the start
  players.forEach((player, idx) => {
    player.kart.position.copy(player.pos);
    player.kart.rotation.y = player.dir;
    console.log('Player', idx, 'kart position at start:', player.kart.position, 'rotation:', player.kart.rotation.y);
  });
  // Ensure cameras are looking at the start
  updateCameraForPlayer(window.camera1, players[0]);
  updateCameraForPlayer(window.camera2, players[1]);


  // --- Clouds in the sky ---
  for (let i = 0; i < 18; ++i) {
    const cloud = new THREE.Group();
    const cx = (Math.random()-0.5) * (ellipseA+600);
    const cz = (Math.random()-0.5) * (ellipseB+600);
    const cy = 120 + Math.random()*60;
    const parts = 5 + Math.floor(Math.random()*3); // 5-7 spheres
    for (let j = 0; j < parts; ++j) {
      const sphGeo = new THREE.SphereGeometry(12 + Math.random()*8, 12, 12);
      const sphMat = new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true });
      const sph = new THREE.Mesh(sphGeo, sphMat);
      // Scale to wide ellipse
      const sx = 1.7 + Math.random()*0.5;
      const sy = 0.7 + Math.random()*0.4;
      const sz = 1.3 + Math.random()*0.4;
      sph.scale.set(sx, sy, sz);
      sph.position.set(cx + (Math.random()-0.5)*18, cy + (Math.random()-0.5)*6, cz + (Math.random()-0.5)*14);
      cloud.add(sph);
    }
    scene.add(cloud);
  }
  // --- Ground mesh (large, mostly green, some brown dirt patches) ---
  const groundGeometry = new THREE.CircleGeometry(groundRadius, 120);
  const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x7bb661 }); // Grass green
  const ground = new THREE.Mesh(groundGeometry, groundMaterial);
  ground.rotation.x = -Math.PI/2;
  ground.position.y = -0.01;
  scene.add(ground);
  // Add dirt patches
  for (let i = 0; i < 30; ++i) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 180 + Math.random() * (groundRadius-200);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const dirtGeo = new THREE.CircleGeometry(18 + Math.random()*20, 18);
    const dirtMat = new THREE.MeshPhongMaterial({ color: 0xb4936c });
    const dirt = new THREE.Mesh(dirtGeo, dirtMat);
    dirt.rotation.x = -Math.PI/2;
    dirt.position.set(x, -0.009, z);
    scene.add(dirt);
  }

  for (let i = 0; i < 40; ++i) {
    let x, z, valid = false, tries = 0;
    while (!valid && tries < 50) {
      tries++;
      const angle = Math.random() * Math.PI * 2;
      const radius = ellipseA + 0.5 * roadWidth + 8 + Math.random() * 22; // just outside road
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * (radius * ellipseB / ellipseA);
      // Find closest point on track
      let minDist = Infinity;
      for (let t = 0; t <= 1; t += 0.01) {
        const pt = trackCurve.getPointAt(t);
        const dx = x - pt.x;
        const dz = z - pt.z;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < minDist) minDist = dist;
      }
      if (minDist > roadWidth/2 + 3 && minDist < roadWidth/2 + 30) valid = true;
    }
    if (!valid) continue;
    const bush = new THREE.Group();
    for (let j = 0; j < 2 + Math.floor(Math.random()*2); ++j) {
      const bx = x + (Math.random()-0.5)*7; // tighter cluster
      const bz = z + (Math.random()-0.5)*7;
      // Use dodecahedron, wider than tall, but always smaller than a tree
      const bushGeo = new THREE.DodecahedronGeometry(1, 0);
      const bushMat = new THREE.MeshPhongMaterial({ color: 0x888888, flatShading: true });
      const width = 1.8 + Math.random()*1.2; // much smaller
      const height = 1.0 + Math.random()*0.7; // much shorter
      const bushPart = new THREE.Mesh(bushGeo, bushMat);
      bushPart.scale.set(width, height, width * (0.93 + Math.random()*0.13));
      bushPart.position.set(bx, height/2, bz);
      bush.add(bushPart);
      // Register bushPart as obstacle
      if (!window.obstacles) window.obstacles = [];
      window.obstacles.push({type: 'boulder', x: bx, z: bz, radius: width * 0.6});
    }
    scene.add(bush);
  }

// --- Shared random off-road placement for trees and bushes ---
function getRandomOffRoadPositions(count, mode='outside', roadMargin=2) {
  // mode: 'inside' or 'outside'
  const positions = [];
  let attempts = 0;
  const minX = -ellipseA - 100, maxX = ellipseA + 100;
  const minZ = -ellipseB - 100, maxZ = ellipseB + 100;
  while (positions.length < count && attempts < count * 100) {
    attempts++;
    const x = minX + Math.random() * (maxX - minX);
    const z = minZ + Math.random() * (maxZ - minZ);
    // Find closest point on track
    let minDist = Infinity;
    for (let t = 0; t <= 1; t += 0.01) {
      const pt = trackCurve.getPointAt(t);
      const dx = x - pt.x;
      const dz = z - pt.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDist) minDist = dist;
    }
    // Compute distance to ellipse center
    const norm = (x/ellipseA)*(x/ellipseA) + (z/ellipseB)*(z/ellipseB);
    // Inside: only if well inside inner edge
    if (mode === 'inside') {
      if (norm > 1 - ((roadWidth/2 + roadMargin)/ellipseA)) continue;
      if (minDist < roadWidth/2 + roadMargin) continue;
      positions.push([x, z]);
    } else {
      // Outside: only if well outside outer edge
      if (norm < 1 + ((roadWidth/2 + roadMargin)/ellipseA)) continue;
      if (minDist < roadWidth/2 + roadMargin) continue;
      positions.push([x, z]);
    }
  }
  return positions;
}

// Place boulders (outside)
const bushPositionsOuter = getRandomOffRoadPositions(80, 'outside', 2);
bushPositionsOuter.forEach(([x, z]) => {
  const bush = new THREE.Group();
  let accepted = false;
  let tries = 0;
  while (!accepted && tries < 30) {
    tries++;
    const width = 1.8 + Math.random()*1.2;
    const height = 1.0 + Math.random()*0.7;
    const margin = roadWidth + width*0.6;
    // Find closest point on track
    let minDist = Infinity;
    for (let t = 0; t <= 1; t += 0.01) {
      const pt = trackCurve.getPointAt(t);
      const dx = x - pt.x;
      const dz = z - pt.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDist) minDist = dist;
    }
    if (!isPointOnRoad(x, z, roadWidth)) {
      for (let j = 0; j < 2 + Math.floor(Math.random()*2); ++j) {
        const bx = x + (Math.random()-0.5)*7;
        const bz = z + (Math.random()-0.5)*7;
        const bushGeo = new THREE.DodecahedronGeometry(1, 0);
        const bushMat = new THREE.MeshPhongMaterial({ color: 0x888888, flatShading: true });
        const bushPart = new THREE.Mesh(bushGeo, bushMat);
        bushPart.scale.set(width, height, width * (0.93 + Math.random()*0.13));
        bushPart.position.set(bx, height/2, bz);
        bush.add(bushPart);
        if (!window.obstacles) window.obstacles = [];
        window.obstacles.push({type: 'boulder', x: bx, z: bz, radius: width * 0.6});
      }
      accepted = true;
      scene.add(bush);
    }
  }
});
// Place boulders (inside)
const bushPositionsInner = getRandomOffRoadPositions(30, 'inside', 2);
bushPositionsInner.forEach(([x, z]) => {
  const bush = new THREE.Group();
  let accepted = false;
  let tries = 0;
  while (!accepted && tries < 30) {
    tries++;
    const width = 1.8 + Math.random()*1.2;
    const height = 1.0 + Math.random()*0.7;
    const margin = roadWidth + width*0.6;
    // Find closest point on track
    let minDist = Infinity;
    for (let t = 0; t <= 1; t += 0.01) {
      const pt = trackCurve.getPointAt(t);
      const dx = x - pt.x;
      const dz = z - pt.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDist) minDist = dist;
    }
    if (!isPointOnRoad(x, z, roadWidth)) {
      for (let j = 0; j < 2 + Math.floor(Math.random()*2); ++j) {
        const bx = x + (Math.random()-0.5)*7;
        const bz = z + (Math.random()-0.5)*7;
        const bushGeo = new THREE.DodecahedronGeometry(1, 0);
        const bushMat = new THREE.MeshPhongMaterial({ color: 0x888888, flatShading: true });
        const bushPart = new THREE.Mesh(bushGeo, bushMat);
        bushPart.scale.set(width, height, width * (0.93 + Math.random()*0.13));
        bushPart.position.set(bx, height/2, bz);
        bush.add(bushPart);
        if (!window.obstacles) window.obstacles = [];
        window.obstacles.push({type: 'boulder', x: bx, z: bz, radius: width * 0.6});
      }
      accepted = true;
      scene.add(bush);
    }
  }
});

// Place trees (outside)
const treePositionsOuter = getRandomOffRoadPositions(Math.floor(120 * 1.5), 'outside', 2);
treePositionsOuter.forEach(([x, z]) => {
  let accepted = false;
  let tries = 0;
  while (!accepted && tries < 30) {
    tries++;
    // Randomize tree scale
    const scale = 1.7;
    const leavesR = (0.9 + Math.random() * 0.7) * scale;
    const margin = roadWidth + leavesR * 1.1;
    // Find closest point on track
    let minDist = Infinity;
    for (let t = 0; t <= 1; t += 0.01) {
      const pt = trackCurve.getPointAt(t);
      const dx = x - pt.x;
      const dz = z - pt.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDist) minDist = dist;
    }
    if (!isPointOnRoad(x, z, roadWidth)) {
      addTree(x, z, scale);
      accepted = true;
    }
  }
});
// Place trees (inside)
const treePositionsInner = getRandomOffRoadPositions(50, 'inside', 2);
treePositionsInner.forEach(([x, z]) => {
  let accepted = false;
  let tries = 0;
  while (!accepted && tries < 30) {
    tries++;
    // Randomize tree scale
    const scale = 1.7;
    const leavesR = (0.9 + Math.random() * 0.7) * scale;
    const margin = roadWidth + leavesR * 1.1;
    // Find closest point on track
    let minDist = Infinity;
    for (let t = 0; t <= 1; t += 0.01) {
      const pt = trackCurve.getPointAt(t);
      const dx = x - pt.x;
      const dz = z - pt.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      if (dist < minDist) minDist = dist;
    }
    if (!isPointOnRoad(x, z, roadWidth)) {
      addTree(x, z, scale);
      accepted = true;
    }
  }
});

  // --- Road mesh ---

  const roadMaterial = new THREE.MeshPhongMaterial({ color: 0xd2b48c, side: THREE.DoubleSide }); // Light brown dirt
  const segmentCount = loopPoints.length * 12;
  let positions = [];
  let uvs = [];

  // Define start and next ONCE for all uses
  start = trackCurve.getPointAt(0);
  next = trackCurve.getPointAt(0.01);

  for (let i = 0; i <= segmentCount; ++i) {
    const t = i / segmentCount;
    const center = trackCurve.getPointAt(t);
    // Tangent direction
    const nextSeg = trackCurve.getPointAt((t + 0.001) % 1); // renamed, not conflicting with global 'next'
    const dx = nextSeg.x - center.x;
    const dz = nextSeg.z - center.z;
    const len = Math.sqrt(dx*dx + dz*dz);
    const nx = -dz / len, nz = dx / len; // normal vector (perp to tangent)
    // Left and right edge points
    positions.push(center.x + nx * roadWidth, 0, center.z + nz * roadWidth); // left
    positions.push(center.x - nx * roadWidth, 0, center.z - nz * roadWidth); // right
    uvs.push(0, t*10); // left
    uvs.push(1, t*10); // right
  }
  const indices = [];
  for (let i = 0; i < segmentCount; ++i) {
    const a = i*2, b = i*2+1, c = i*2+2, d = i*2+3;
    indices.push(a, b, c, b, d, c);
  }
  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  roadGeo.setIndex(indices);
  roadGeo.computeVertexNormals();
  const roadMesh = new THREE.Mesh(roadGeo, roadMaterial);
  scene.add(roadMesh);

  // ===============================
  // --- Banner Flag Above Start/Finish ---
  const poleHeight = 7, poleOffset = roadWidth * 0.9;
  const poleGeo = new THREE.CylinderGeometry(0.13, 0.13, poleHeight, 16);
  const poleMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
  // Use the same angle as the player start direction
  const angle1 = Math.atan2(next.x - start.x, next.z - start.z);
  // Left pole
  const poleL = new THREE.Mesh(poleGeo, poleMat);
  poleL.position.set(
    start.x - Math.cos(angle1) * poleOffset,
    poleHeight / 2,
    start.z + Math.sin(angle1) * poleOffset
  );
  scene.add(poleL);
  // Right pole
  const poleR = new THREE.Mesh(poleGeo, poleMat);
  poleR.position.set(
    start.x + Math.cos(angle1) * poleOffset,
    poleHeight / 2,
    start.z - Math.sin(angle1) * poleOffset
  );
  scene.add(poleR);
  // Banner
  // Compute banner width as the distance between the two poles
  const poleLeftPos = poleL.position;
  const poleRightPos = poleR.position;
  const bannerWidth = poleLeftPos.distanceTo(poleRightPos);
  const bannerHeight = 1.5;
  const bannerGeo = new THREE.PlaneGeometry(bannerWidth, bannerHeight);
  // Banner texture with text
  function makeBannerTexture() {
    const w = 2048, h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 32;
    ctx.strokeRect(0, 0, w, h);
    // Draw checkerboard pattern
    const squaresPerCol = 4;
    const squareSize = h / squaresPerCol;
    const squaresPerRow = Math.floor(w / squareSize);
    for (let y = 0; y < squaresPerCol; ++y) {
      for (let x = 0; x < squaresPerRow; ++x) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#fff' : '#000';
        ctx.fillRect(x * squareSize, y * squareSize, squareSize, squareSize);
      }
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
  }
  const bannerMat = new THREE.MeshPhongMaterial({ map: makeBannerTexture(), side: THREE.DoubleSide });
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  // Center the banner between the two poles
  const midX = (poleLeftPos.x + poleRightPos.x) / 2;
  const midY = poleHeight - bannerHeight/2 + 0.2;
  const midZ = (poleLeftPos.z + poleRightPos.z) / 2;
  banner.position.set(midX, midY, midZ);
  banner.rotation.y = angle1 + Math.PI; // flip so text faces player
  scene.add(banner);

  // --- Rainbow line on the road connecting the two poles ---
  // Calculate the start and end points at ground level
  const rainbowY = 0.13; // slightly above road
  const rainbowStart = new THREE.Vector3(poleLeftPos.x, rainbowY, poleLeftPos.z);
  const rainbowEnd = new THREE.Vector3(poleRightPos.x, rainbowY, poleRightPos.z);
  const rainbowLength = rainbowStart.distanceTo(rainbowEnd);
  const rainbowWidth = 0.5; // thickness of the line

  // Create a canvas texture with a horizontal rainbow gradient
  const rainbowCanvas = document.createElement('canvas');
  rainbowCanvas.width = 512; rainbowCanvas.height = 16;
  const rainbowCtx = rainbowCanvas.getContext('2d');
  const grad = rainbowCtx.createLinearGradient(0, 0, rainbowCanvas.width, 0);
  grad.addColorStop(0.00, '#ff0000'); // red
  grad.addColorStop(0.17, '#ff9900'); // orange
  grad.addColorStop(0.33, '#ffff00'); // yellow
  grad.addColorStop(0.50, '#00ff00'); // green
  grad.addColorStop(0.67, '#00bfff'); // blue
  grad.addColorStop(0.83, '#8f00ff'); // purple
  grad.addColorStop(1.00, '#ff00aa'); // magenta
  rainbowCtx.fillStyle = grad;
  rainbowCtx.fillRect(0, 0, rainbowCanvas.width, rainbowCanvas.height);
  const rainbowTexture = new THREE.CanvasTexture(rainbowCanvas);
  rainbowTexture.wrapS = THREE.ClampToEdgeWrapping;
  rainbowTexture.wrapT = THREE.ClampToEdgeWrapping;
  rainbowTexture.minFilter = THREE.LinearFilter;
  rainbowTexture.magFilter = THREE.LinearFilter;

  // Plane for the rainbow line
  const rainbowGeo = new THREE.PlaneGeometry(rainbowLength, rainbowWidth);
  const rainbowMat = new THREE.MeshBasicMaterial({ map: rainbowTexture, transparent: true, side: THREE.DoubleSide });
  const rainbowMesh = new THREE.Mesh(rainbowGeo, rainbowMat);
  // Position at midpoint, rotate to align with poles, and lay flat
  rainbowMesh.position.set((rainbowStart.x + rainbowEnd.x)/2, rainbowY, (rainbowStart.z + rainbowEnd.z)/2);
  rainbowMesh.rotation.y = angle1 + Math.PI;
  rainbowMesh.rotation.x = -Math.PI/2;
  scene.add(rainbowMesh);

// --- TREES ---
function addTree(x, z, scale=1) {
// Randomize trunk and leaves
const trunkH = Math.max(0.6 * scale, (1.5 + Math.random() * 1.7) * scale);
const trunkR = (0.11 + Math.random() * 0.13) * scale; // SKINNIER trunk
const trunkGeo = new THREE.CylinderGeometry(trunkR, trunkR * 1.08, trunkH, 8);
const trunkMat = new THREE.MeshPhongMaterial({ color: 0x8B5A2B });
const trunk = new THREE.Mesh(trunkGeo, trunkMat);
trunk.position.set(x, trunkH/2, z);

// Randomly pick geometry for tree leaves
const leavesR = (0.9 + Math.random() * 0.7) * scale;
const leavesH = (0.7 + Math.random() * 0.4) * scale;
const leafColor = Math.random() < 0.22 ? 0x5fa03c : (Math.random() < 0.5 ? 0x228B22 : 0x2e8b57);
let leavesGeo, leaves;
const type = Math.floor(Math.random() * 4); // 0=sphere, 1=dodeca, 2=ellipsoid, 3=cone
if (type === 0) { // Sphere
leavesGeo = new THREE.SphereGeometry(1, 14, 14);
leaves = new THREE.Mesh(leavesGeo, new THREE.MeshPhongMaterial({ color: leafColor }));
leaves.scale.set(leavesR, leavesR, leavesR);
} else if (type === 1) { // Dodecahedron
leavesGeo = new THREE.DodecahedronGeometry(1, 0);
leaves = new THREE.Mesh(leavesGeo, new THREE.MeshPhongMaterial({ color: leafColor, flatShading: true }));
leaves.scale.set(leavesR, leavesH, leavesR * (0.95 + Math.random()*0.15));
} else if (type === 2) { // Ellipsoid
leavesGeo = new THREE.SphereGeometry(1, 12, 12);
leaves = new THREE.Mesh(leavesGeo, new THREE.MeshPhongMaterial({ color: leafColor }));
// Ellipsoid: make it tall
const ellipXZ = leavesR * (1.05 + Math.random()*0.18);
const ellipY = ellipXZ * (1.5 + Math.random()*0.3);
leaves.scale.set(ellipXZ, ellipY, ellipXZ);
} else { // Cone
// Cone: make it tall
const coneHeight = leavesR * (2.2 + Math.random()*0.3);
leavesGeo = new THREE.ConeGeometry(leavesR, coneHeight, 10);
leaves = new THREE.Mesh(leavesGeo, new THREE.MeshPhongMaterial({ color: leafColor }));
// Optionally scale y a bit more for extra tallness
leaves.scale.y = 1.3 + Math.random()*0.2;
}
// Place leaves directly on top of trunk, no gap
if (type === 0) { // Sphere
  leaves.position.set(x, trunkH + leavesR, z);
} else if (type === 1) { // Dodecahedron
  leaves.position.set(x, trunkH + leavesH/2, z);
} else if (type === 2) { // Ellipsoid
  leaves.position.set(x, trunkH + leaves.scale.y/2, z);
} else { // Cone
  // Cone height = geometry height * scale.y
  const coneHeight = leaves.geometry.parameters.height * leaves.scale.y;
  leaves.position.set(x, trunkH + coneHeight/2, z);
}
scene.add(trunk);
scene.add(leaves);
    if (!window.obstacles) window.obstacles = [];
    // Use leavesR as approx radius
    window.obstacles.push({type: 'tree', x, z, radius: leavesR * 1.1});
  }
  // Fixed tree positions (relative to center  // Procedurally add 200 random trees in rings around the track

  // --- MOUNTAINS ---
  function addMountain(x, z, scale=1) {
    // Vary base and height
    const baseR = (12 + Math.random() * 16) * scale;
    const height = (55 + Math.random() * 40) * scale;
    const geo = new THREE.ConeGeometry(baseR, height, 8 + Math.floor(Math.random()*3));
    const mat = new THREE.MeshPhongMaterial({ color: 0x888888, flatShading: true });
    const mountain = new THREE.Mesh(geo, mat);
    mountain.position.set(x, height/2, z);
    scene.add(mountain);
    // Register mountain as obstacle
    if (!window.obstacles) window.obstacles = [];
    window.obstacles.push({type: 'mountain', x, z, radius: baseR * 0.9});
    // Add snow cap (white cone) with matching base diameter
    const snowH = height * (0.19 + Math.random()*0.08);
    // Compute mountain radius at the snow base using similar triangles
    // Mountain tapers from baseR at y=0 to 0 at y=height
    const snowBaseY = height - snowH + 0.6; // slightly higher to prevent flicker
    const snowR = baseR * ((height - snowBaseY) / height);
    const snowGeo = new THREE.ConeGeometry(snowR, snowH, 10);
    const snowMat = new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true });
    const snow = new THREE.Mesh(snowGeo, snowMat);
    snow.position.set(x, height - snowH/2 + 0.6, z);
    scene.add(snow);
  }
  // Fixed mountain positions
  // Mountain clusters
  const numClusters = 6 + Math.floor(Math.random()*5); // 6-10 clusters
  for (let c = 0; c < numClusters; ++c) {
    // Pick a random cluster center, far from track
    let clusterAngle = Math.random() * Math.PI * 2;
    let clusterRadius = ellipseA + 400 + Math.random()*400;
    let cx = Math.cos(clusterAngle) * clusterRadius;
    let cz = Math.sin(clusterAngle) * (clusterRadius * ellipseB / ellipseA);
    // Number of mountains in this cluster
    let count = 3 + Math.floor(Math.random()*18); // 3-20
    for (let m = 0; m < count; ++m) {
      // Offset from cluster center
      let theta = Math.random() * Math.PI * 2;
      let r = 18 + Math.random()*60;
      let mx = cx + Math.cos(theta) * r;
      let mz = cz + Math.sin(theta) * r * (ellipseB/ellipseA);
      // Random scale for base diameter
      let scale = 0.6 + Math.random()*1.2;
      addMountain(mx, mz, scale);
    }
  }

  // --- Place mango at start ---
  resetMango(trackCurve);

  // --- Golden Rings ---
  rings = []; // clear previous rings
  const numRings = 20;
  const ringRadius = 2.2;
  const tubeRadius = 0.35;
  let placedRings = 0;
  let attempts = 0;
  while (placedRings < numRings && attempts < numRings * 10) {
    const t = Math.random();
    attempts++;
    // Exclude rings near start/finish (first 8% and last 8% of track)
    if (t < 0.08 || t > 0.92) continue;
    const pt = trackCurve.getPointAt(t);
    const tangent = trackCurve.getTangentAt(t);
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    // Random offset within road border
    const lateralMax = roadWidth/2 - ringRadius - 0.3;
    const lateral = (Math.random() * 2 - 1) * lateralMax;
    const ringPos = pt.clone().add(normal.clone().multiplyScalar(lateral));
    const ringGeo = new THREE.TorusGeometry(ringRadius, tubeRadius, 16, 64);
    const ringMat = new THREE.MeshPhongMaterial({ color: 0xffd700, shininess: 80 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(ringPos.x, ringPos.y + 3.2, ringPos.z); // floating above road
    // No rotation.x: keep vertical
    scene.add(ring);
    rings.push(ring);
    placedRings++;
  }
}
// <-- This closes the main Three.js setup function

function resetMango(trackCurve) {
  mangoPos = new THREE.Vector3(start.x, start.y + 0.3, start.z);
  mangoDir = Math.atan2(next.x - start.x, next.z - start.z);
  mangoSpeed = 0;
  steerAngle = 0;
}

/**
 * Updates the kart's position and steering based on input and physics.
 */
function updateMango() {
  if (!allowDrive) return;
  if (!trackCurve) return;
  // Steering
  if (keys['ArrowLeft'] || keys['KeyA']) steerAngle += steerSpeed;
  if (keys['ArrowRight'] || keys['KeyD']) steerAngle -= steerSpeed;
  steerAngle = Math.max(-maxSteer, Math.min(maxSteer, steerAngle));
  if (!(keys['ArrowLeft'] || keys['KeyA'] || keys['ArrowRight'] || keys['KeyD'])) {
    if (steerAngle > 0) steerAngle = Math.max(0, steerAngle - steerFriction);
    else if (steerAngle < 0) steerAngle = Math.min(0, steerAngle + steerFriction);
  }

  // Acceleration/braking
  let accelerating = false;
  if (keys['ArrowUp'] || keys['KeyW']) {
    mangoSpeed += accel;
    accelerating = true;
  }
  if (keys['ArrowDown'] || keys['KeyS']) {
    mangoSpeed -= brake;
    accelerating = true;
  }
  mangoSpeed = Math.max(maxRev, Math.min(maxFwd, mangoSpeed));
  if (!accelerating) {
    if (mangoSpeed > 0) mangoSpeed = Math.max(0, mangoSpeed - friction);
    else if (mangoSpeed < 0) mangoSpeed = Math.min(0, mangoSpeed + friction * 0.7);
  }

  // --- Bicycle model: only turn when moving ---
  if (Math.abs(mangoSpeed) > 0.0001) {
    mangoDir += (mangoSpeed / wheelbase) * Math.tan(steerAngle);
    const moveAngle = mangoDir;
    mangoPos.x += Math.sin(moveAngle) * mangoSpeed;
    mangoPos.z += Math.cos(moveAngle) * mangoSpeed;
  }


  // Project onto track for y
  let minDist = Infinity, bestT = 0;
  for (let ti = 0; ti <= 100; ++ti) {
    let t = ti / 100;
    let pt = trackCurve.getPointAt(t);
    if (!pt) {
      console.error('trackCurve.getPointAt returned undefined in loop for t=', t);
      continue;
    }
    let dx = mangoPos.x - pt.x, dz = mangoPos.z - pt.z;
    let d = dx*dx + dz*dz;
    if (d < minDist) { minDist = d; bestT = t; }
  }
  let roadPt = trackCurve.getPointAt(bestT);
  if (!roadPt) {
    console.error('trackCurve.getPointAt returned undefined for bestT=', bestT);
    return;
  }
  mangoPos.y = roadPt.y + 0.3;

  // Update kart group position & rotation
  kart.position.copy(mangoPos);
  kart.rotation.y = mangoDir;

  // Front wheels visually turn with steerAngle
  if (window.kartFrontLeft)  window.kartFrontLeft.rotation.y = steerAngle;
  if (window.kartFrontRight) window.kartFrontRight.rotation.y = steerAngle;
}

/**
 * Main animation loop: updates game state and renders the scene.
 */
function animate() {
  console.log('Rendering frame');
  // Update both players (movement only if allowed)
  players.forEach((player, idx) => {
    updatePlayer(player); // updatePlayer already checks allowDrive for movement
  });
  // Animate golden rings and handle collision for both players
  if (Array.isArray(rings)) {
    for (let i = rings.length - 1; i >= 0; --i) {
      const ring = rings[i];
      ring.rotation.y -= 0.045;
      let collected = false;
      players.forEach((player, idx) => {
        const dx = ring.position.x - player.kart.position.x;
        const dz = ring.position.z - player.kart.position.z;
        const horizDist = Math.sqrt(dx * dx + dz * dz);
        const ringOuterRadius = 2.2 + 0.35;
        if (horizDist < ringOuterRadius && !collected) {
          sparkleAt(ring.position);
          scene.remove(ring);
          rings.splice(i, 1);
          player.ringCount++;
          // Update the correct counter
          const counterElem = document.getElementById(idx === 0 ? 'ring-count-1' : 'ring-count-2');
          if (counterElem) counterElem.textContent = player.ringCount;
          collected = true;
        }
      });
    }
  }
  // Split-screen render
  renderer.setScissorTest(true);
  // Left (Player 1)
  window.camera1.aspect = (window.innerWidth/2) / window.innerHeight;
  window.camera1.updateProjectionMatrix();
  renderer.setViewport(0, 0, window.innerWidth/2, window.innerHeight);
  renderer.setScissor(0, 0, window.innerWidth/2, window.innerHeight);
  updateCameraForPlayer(window.camera1, players[0]);
  renderer.render(scene, window.camera1);
  // Right (Player 2)
  window.camera2.aspect = (window.innerWidth/2) / window.innerHeight;
  window.camera2.updateProjectionMatrix();
  renderer.setViewport(window.innerWidth/2, 0, window.innerWidth/2, window.innerHeight);
  renderer.setScissor(window.innerWidth/2, 0, window.innerWidth/2, window.innerHeight);
  updateCameraForPlayer(window.camera2, players[1]);
  renderer.render(scene, window.camera2);
  renderer.setScissorTest(false);
  // Animate dust particles
  if (window.dustParticles) {
    for (let i = window.dustParticles.length - 1; i >= 0; --i) {
      const p = window.dustParticles[i];
      p.userData.t += 0.03 + Math.random()*0.03;
      p.material.opacity = Math.max(0, 0.5 - p.userData.t*1.1);
      p.position.y += 0.04 + Math.random()*0.03;
      p.position.x += (Math.random()-0.5)*0.012;
      p.position.z += (Math.random()-0.5)*0.012;
      p.scale.multiplyScalar(0.97);
      if (p.material.opacity <= 0.01 || p.scale.x < 0.05) {
        scene.remove(p);
        window.dustParticles.splice(i, 1);
      }
    }
  }
  requestAnimationFrame(animate);
}

function updatePlayer(player) {
  if (!allowDrive) return;
  // Controls
  const controls = player.controls;
  if (keys[controls.left]) player.steerAngle += steerSpeed;
  if (keys[controls.right]) player.steerAngle -= steerSpeed;
  player.steerAngle = Math.max(-maxSteer, Math.min(maxSteer, player.steerAngle));
  if (!(keys[controls.left] || keys[controls.right])) {
    if (player.steerAngle > 0) player.steerAngle = Math.max(0, player.steerAngle - steerFriction);
    else if (player.steerAngle < 0) player.steerAngle = Math.min(0, player.steerAngle + steerFriction);
  }
  // Acceleration/brake
  if (keys[controls.up]) player.speed += accel;
  if (keys[controls.down]) player.speed -= brake;
  // Clamp speed
  player.speed = Math.max(maxRev, Math.min(maxFwd, player.speed));
  // Friction
  if (!(keys[controls.up] || keys[controls.down])) {
    if (player.speed > 0) player.speed = Math.max(0, player.speed - friction);
    else if (player.speed < 0) player.speed = Math.min(0, player.speed + friction);
  }
  // Move along track
  const moveDist = player.speed;
  // Find closest point on track
  let minDist = Infinity, bestT = 0;
  for (let t = 0; t < 1; t += 0.002) {
    const pt = trackCurve.getPointAt(t);
    const dx = pt.x - player.pos.x;
    const dz = pt.z - player.pos.z;
    let d = dx*dx + dz*dz;
    if (d < minDist) { minDist = d; bestT = t; }
  }
  let roadPt = trackCurve.getPointAt(bestT);
  if (!roadPt) return;
  // Move forward/backward
  const tangent = trackCurve.getTangentAt(bestT);
  player.dir += player.steerAngle;
  player.pos.x += Math.sin(player.dir) * moveDist;
  player.pos.z += Math.cos(player.dir) * moveDist;
  player.pos.y = roadPt.y + 0.3;
  // --- Obstacle collision check (for Player) ---
  if (window.obstacles) {
    for (const obs of window.obstacles) {
      const dx = player.pos.x - obs.x;
      const dz = player.pos.z - obs.z;
      const dist = Math.sqrt(dx*dx + dz*dz);
      const minDist = 1.1 + obs.radius; // 1.1: kart body radius approx
      if (dist < minDist) {
        // Bounce back: push out and reduce speed
        const overlap = minDist - dist + 0.01;
        const pushX = (dx/dist) * overlap;
        const pushZ = (dz/dist) * overlap;
        player.pos.x += pushX;
        player.pos.z += pushZ;
        if (player.speed !== undefined) player.speed *= -0.25;
        break;
      }
    }
  }
  // Update kart position
  player.kart.position.copy(player.pos);
  player.kart.rotation.y = player.dir;

  // --- Dust effect ---
  if (!window.dustParticles) window.dustParticles = [];
  // Only emit dust if moving
  if (Math.abs(player.speed) > 0.07) {
    const rearOffset = -1.0; // rear of kart
    const dustPos = new THREE.Vector3(
      player.pos.x + Math.sin(player.dir) * rearOffset,
      player.pos.y + 0.23 + Math.random()*0.11,
      player.pos.z + Math.cos(player.dir) * rearOffset
    );
    for (let i = 0; i < 2; ++i) {
      const geo = new THREE.SphereGeometry(0.17 + Math.random()*0.09, 6, 6);
      const mat = new THREE.MeshPhongMaterial({ color: 0xd2b48c, transparent: true, opacity: 0.5 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(dustPos);
      mesh.position.x += (Math.random()-0.5)*0.28;
      mesh.position.z += (Math.random()-0.5)*0.28;
      mesh.userData = { t: 0 };
      scene.add(mesh);
      window.dustParticles.push(mesh);
    }
  }
}

function updateCameraForPlayer(cam, player) {
  cam.position.set(
    player.pos.x - Math.sin(player.dir) * 12,
    player.pos.y + 5,
    player.pos.z - Math.cos(player.dir) * 12
  );
  cam.lookAt(
    player.pos.x + Math.sin(player.dir) * 6,
    player.pos.y + 2.2,
    player.pos.z + Math.cos(player.dir) * 6
  );
}


// Simple sparkle effect: spawn a few quick particles
/**
 * Shows a sparkle effect at the given position.
 */
function sparkleAt(pos) {
  const group = new THREE.Group();
  // Main bright particles
  for (let i = 0; i < 34; ++i) {
    const geo = new THREE.SphereGeometry(0.22 + Math.random()*0.16, 10, 10);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffe0, emissive: 0xfff880, emissiveIntensity: 1.3, metalness: 0.8, roughness: 0.18, transparent: true, opacity: 0.97 });
    const mesh = new THREE.Mesh(geo, mat);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    mesh.position.set(
      Math.sin(phi)*Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi)*Math.sin(theta)
    );
    mesh.position.multiplyScalar(0.55 + Math.random()*0.77);
    group.add(mesh);
  }
  // Add shiny highlight particles
  for (let i = 0; i < 8; ++i) {
    const geo = new THREE.SphereGeometry(0.15 + Math.random()*0.22, 16, 16);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffcc, emissiveIntensity: 2.5, metalness: 1.0, roughness: 0.09, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(
      (Math.random()-0.5)*1.2,
      (Math.random()-0.5)*1.2,
      (Math.random()-0.5)*1.2
    );
    group.add(mesh);
  }
  group.position.copy(pos);
  scene.add(group);
  let t = 0;
  function animateSparkle() {
    t += 0.021; // slower for longer effect
    group.children.forEach((m, idx) => {
      m.material.opacity = Math.max(0, m.material.opacity - t*0.43); // fade slower
      m.material.emissiveIntensity = Math.max(0, (m.material.emissiveIntensity || 1.3) * (1.025 - t*0.6));
      m.position.multiplyScalar(1.07 + 0.023*Math.sin(idx + t*8));
      m.scale.multiplyScalar(1.01 - t*0.11);
    });
    if (t < 1.15) {
      requestAnimationFrame(animateSparkle);
    } else {
      scene.remove(group);
    }
  }
  animateSparkle();
}


/**
 * Shows a countdown overlay and enables driving after "Go!!!".
 */
function startCountdown() {
  allowDrive = false;
  const countdownElem = document.getElementById('countdown');
  let count = 3;
  function show(val) {
    countdownElem.innerHTML = '<span>' + val + '</span>';
    let span = countdownElem.querySelector('span');
    if (span) {
      span.style.background = '';
      span.style.backgroundColor = '';
    }
    // Ensure overlay is visible
    countdownElem.style.display = 'flex';
    countdownElem.style.opacity = 1;
    countdownElem.style.visibility = 'visible';
    console.log('CountdownElem after set (innerHTML):', countdownElem, countdownElem.innerHTML);
    countdownElem.style.display = 'flex';
    countdownElem.style.opacity = 1;
    // For debugging, force visibility
    countdownElem.style.visibility = 'visible';
    console.log('Countdown show:', val);
    countdownElem.style.background = 'rgba(0,0,0,0.2)'; // Debug: see overlay area
    countdownElem.style.opacity = 1;
    countdownElem.style.display = 'flex';
    countdownElem.style.position = 'absolute';
    countdownElem.style.top = '0';
    countdownElem.style.left = '0';
    countdownElem.style.width = '100vw';
    countdownElem.style.height = '80vh'; // 20% less height for rectangle
    countdownElem.style.justifyContent = 'center';
    countdownElem.style.alignItems = 'center';
    countdownElem.style.fontSize = '7vw';
    countdownElem.style.color = '#fff';
    countdownElem.style.textShadow = '0 0 20px #000, 0 0 40px #000';
    countdownElem.style.pointerEvents = 'none';
    countdownElem.style.background = 'transparent';
  }
  function hide() {
    countdownElem.style.opacity = 0;
    setTimeout(() => { countdownElem.style.display = 'none'; }, 400);
  }
  function tick() {
    if (count > 0) {
      show(count);
      count--;
      setTimeout(tick, 1000);
    } else if (count === 0) {
      show('Go!!!');
      allowDrive = true;
      setTimeout(() => {
        hide();
      }, 900);
      count--;
    }
  }
  show(count);
  tick();
}

window.addEventListener('DOMContentLoaded', () => {
  initThreeJS();
  let countdownElem = document.getElementById('countdown');
  if (!countdownElem) {
    countdownElem = document.createElement('div');
    countdownElem.id = 'countdown';
    document.body.appendChild(countdownElem);
  }
  startCountdown();
  animate();
});
// Responsive resize
window.addEventListener('resize', () => {
  if (renderer && window.camera1 && window.camera2) {
    window.camera1.aspect = window.innerWidth / window.innerHeight;
    window.camera2.aspect = window.innerWidth / window.innerHeight;
    window.camera1.updateProjectionMatrix();
    window.camera2.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
});
