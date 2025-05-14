// ===============================
// Let's Race! - 3D Mario Kart-style Game (Three.js// ===============================
// Core 3D scene setup, track, kart, and controls

// --- GLOBALS & GAME STATE ---
let trackCurve; // Make trackCurve accessible everywhere
let keys = {};
window.addEventListener('keydown', (e) => { keys[e.code] = true; });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
let scene, camera, renderer, kart;
let currentMap = 0;
let gameRunning = false;
let start, next; // GLOBAL start/next for track use

// --- GAME CONTROL CONSTANTS ---
const wheelbase = 1.1;
const maxSteer = Math.PI/6 * 1.5; // 45 degrees (increased by 50%)
const steerSpeed = 0.0005; // Slower, more gradual turning
const steerFriction = 0.018; // Slower return to center
const maxFwd = 0.32, maxRev = -0.08, accel = 0.003, brake = 0.025, friction = 0.002; // Slightly faster top speed

// === GLOBAL CONSTANTS ===
const ellipseA = 320; // x-radius (20x larger)
const ellipseB = 200; // z-radius (20x larger)
const ellipseCount = 16;
const groundRadius = ellipseA + 850;

const maps = [
  { name: 'Circuit Plaza', asset: null },
  { name: 'Desert Drift', asset: null },
  { name: 'Mountain Loop', asset: null },
];

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


  camera = new THREE.PerspectiveCamera(75, window.innerWidth / (0.8 * window.innerHeight), 0.1, 1000);
  camera.position.set(0, 5, -12);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, 0.8 * window.innerHeight);
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

  // --- Clouds in the sky ---
  for (let i = 0; i < 18; ++i) {
    const cloud = new THREE.Group();
    const cx = (Math.random()-0.5) * (ellipseA+600);
    const cz = (Math.random()-0.5) * (ellipseB+600);
    const cy = 120 + Math.random()*60;
    const parts = 2 + Math.floor(Math.random()*3);
    for (let j = 0; j < parts; ++j) {
      const sphGeo = new THREE.SphereGeometry(12 + Math.random()*8, 12, 12);
      const sphMat = new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true });
      const sph = new THREE.Mesh(sphGeo, sphMat);
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
  // Add random grass tufts (small, bright green)
  for (let i = 0; i < 60; ++i) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 200 + Math.random() * (groundRadius-250);
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const tuftGeo = new THREE.SphereGeometry(3 + Math.random()*2, 8, 8);
    const tuftMat = new THREE.MeshPhongMaterial({ color: 0x99e550 });
    const tuft = new THREE.Mesh(tuftGeo, tuftMat);
    tuft.position.set(x, 2.2 + Math.random()*2, z);
    scene.add(tuft);
  }
  for (let i = 0; i < 40; ++i) {
    let angle, radius, x, z;
    // Keep bushes off the road: radius must be outside 1.2x road ellipse
    while (true) {
      angle = Math.random() * Math.PI * 2;
      // Minimum bush distance from center: 1.2x road ellipse
      const minA = ellipseA * 1.2;
      const minB = ellipseB * 1.2;
      radius = minA + Math.random() * (groundRadius - minA - 50);
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * (radius * ellipseB / ellipseA);
      // Check if inside forbidden ellipse (road area)
      if ((x*x)/(minA*minA) + (z*z)/(minB*minB) > 1.0) break;
    }
    const bush = new THREE.Group();
    for (let j = 0; j < 2 + Math.floor(Math.random()*3); ++j) {
      const bx = x + (Math.random()-0.5)*12;
      const bz = z + (Math.random()-0.5)*12;
      const bushGeo = new THREE.SphereGeometry(6 + Math.random()*3, 12, 12);
      const bushMat = new THREE.MeshPhongMaterial({ color: 0x267a2a });
      const bushPart = new THREE.Mesh(bushGeo, bushMat);
      bushPart.position.set(bx, 4 + Math.random()*2, bz);
      bush.add(bushPart);
    }
    scene.add(bush);
  }
  // --- Road mesh ---
  const roadWidth = 12;
  const roadMaterial = new THREE.MeshPhongMaterial({ color: 0x888888, side: THREE.DoubleSide }); // Medium gray
  const segmentCount = loopPoints.length * 12;
  const positions = [];
  const uvs = [];

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

  // --- Center dashes (white and even shorter) ---
  const dashCount = loopPoints.length * 6;
  for (let i = 0; i < dashCount; ++i) {
    const t = i / dashCount;
    const p1 = trackCurve.getPointAt(t);
    const p2 = trackCurve.getPointAt((t + 0.003) % 1); // even shorter dash
    const dashLength = p1.distanceTo(p2);
    const dashGeometry = new THREE.BoxGeometry(0.16, 0.07, dashLength);
    const dashMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
    const dash = new THREE.Mesh(dashGeometry, dashMaterial);
    dash.position.set((p1.x + p2.x) / 2, 0.04, (p1.z + p2.z) / 2);
    dash.lookAt(p2.x, 0.04, p2.z);
    scene.add(dash);
  }

  // --- Road white borders as smooth tubes ---
  const borderRadius = 0.09;
  // Sample points for left and right edge curves
  const borderCurvePoints = 200;
  const leftPoints = [], rightPoints = [];
  for (let i = 0; i <= borderCurvePoints; ++i) {
    const t = i / borderCurvePoints;
    const center = trackCurve.getPointAt(t);
    const nextPt = trackCurve.getPointAt((t + 0.001) % 1);
    const tangent = new THREE.Vector3().subVectors(nextPt, center).normalize();
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    leftPoints.push(center.clone().addScaledVector(normal, roadWidth));
    rightPoints.push(center.clone().addScaledVector(normal, -roadWidth));
  }
  const leftCurve = new THREE.CatmullRomCurve3(leftPoints, true);
  const rightCurve = new THREE.CatmullRomCurve3(rightPoints, true);
  const tubeSegments = 400;
  const leftTubeGeo = new THREE.TubeGeometry(leftCurve, tubeSegments, borderRadius, 8, true);
  const rightTubeGeo = new THREE.TubeGeometry(rightCurve, tubeSegments, borderRadius, 8, true);
  const borderMat = new THREE.MeshPhongMaterial({ color: 0xffffff });
  const leftTube = new THREE.Mesh(leftTubeGeo, borderMat);
  const rightTube = new THREE.Mesh(rightTubeGeo, borderMat);
  scene.add(leftTube);
  scene.add(rightTube);


  // ===============================
  // KART (MANGO CAR) CONSTRUCTION
kart = new THREE.Group();
const scale = 1.3;

// Define a quadratic Bezier curve for the banana path (curved upward)
// Both ends high, middle low
const bananaStart = new THREE.Vector3(0, 0.3 * scale, -1.35 * scale);
const bananaEnd = new THREE.Vector3(0, 0.7 * scale, 1.35 * scale);
const bananaControl1 = new THREE.Vector3(0, -0.5 * scale, -0.7 * scale);
const bananaControl2 = new THREE.Vector3(0, -0.5 * scale, 0.7 * scale);
const bananaCurve = new THREE.CubicBezierCurve3(bananaStart, bananaControl1, bananaControl2, bananaEnd);

// TubeGeometry with fixed radius for debug
const bananaSegments = 120;
const bananaGeometry = new THREE.TubeGeometry(bananaCurve, bananaSegments, 0.27 * scale, 64, false); // smoother, more segments

// Color the banana: all yellow
const pos = bananaGeometry.attributes.position;
const colors = [];
for (let i = 0; i < pos.count; i++) {
  // All yellow, no dark brown tips
  const color = new THREE.Color(0xffe066);
  colors.push(color.r, color.g, color.b);
}
bananaGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

// Taper banana by scaling vertices along the curve
for (let i = 0; i < pos.count; ++i) {
  // t from 0 (back) to 1 (front)
  const z = pos.getZ(i);
  const t = (z + 1.35 * scale) / (2.7 * scale);
  // Taper: thick at back, point at front
  let radiusScale = 1.0;
  if (t < 0.09) radiusScale = Math.max(0.18, 0.38 + 0.54 * t/0.09); // back tip, clamp min
  else if (t > 0.93) radiusScale = Math.max(0.18, 0.18 + 0.32 * (1-t)/0.07); // front tip, clamp min
  pos.setY(i, pos.getY(i) * radiusScale);
  pos.setX(i, pos.getX(i) * radiusScale);
}

const bananaMaterial = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 28, specular: 0x665500, side: THREE.DoubleSide });
const bananaBody = new THREE.Mesh(bananaGeometry, bananaMaterial);
bananaBody.position.set(0, 0.62 * scale, 0);
// No rotation needed; curve faces up
kart.add(bananaBody);

// Add brown caps to both ends of the banana
const capSegments = 32;
const capRadiusBack = 0.21 * scale; // even larger for back tip
const capRadiusFront = 0.22 * scale; // keep front as before
const capMaterial = new THREE.MeshPhongMaterial({ color: 0x5c3810 }); // brown

// Brown sphere at back tip (no cap)
const startPt = bananaCurve.getPoint(0);
const backSphere = new THREE.Mesh(
  new THREE.SphereGeometry(0.09 * scale, 18, 12),
  capMaterial
);
backSphere.position.copy(startPt);
bananaBody.add(backSphere);

// (Front cap removed as requested)
const endPt = bananaCurve.getPoint(1);
const endTan = bananaCurve.getTangent(1);

// Add banana handle at front (short brown cylinder)
const handleRadius = 0.09 * scale;
const handleLength = 0.43 * scale;
const handleGeo = new THREE.CylinderGeometry(handleRadius, handleRadius, handleLength, 20);
const handleMat = new THREE.MeshPhongMaterial({ color: 0xffe066 });
const handle = new THREE.Mesh(handleGeo, handleMat);
handle.position.copy(endPt.clone().add(endTan.clone().multiplyScalar(handleLength/2)));
// Orient handle along the tangent
handle.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), endTan.clone().normalize());
bananaBody.add(handle);

  // Only left-to-right axles (no front-to-back chassis bar)
const chassisMat = new THREE.MeshPhongMaterial({ color: 0x111111, shininess: 80, specular: 0x222222 });
  const wheelRadius = 0.32 * scale;
  const axleY = wheelRadius; // Axle at wheel center
  const wheelX = 0.68 * scale;
  const axleLen = 2 * wheelX;
  const axleRadius = 0.09 * scale;
  // Split axles: left and right segments, leaving a gap under the banana
  const axleGap = 0.4 * scale; // width of gap under the banana (narrower)
  const shortAxleLen = wheelX - axleGap / 2;
  // Front left axle segment
  const frontAxleLeftGeo = new THREE.CylinderGeometry(axleRadius, axleRadius, shortAxleLen, 16);
  const frontAxleLeft = new THREE.Mesh(frontAxleLeftGeo, chassisMat);
  frontAxleLeft.position.set(-axleGap/2 - shortAxleLen/2, axleY, 0.68 * scale);
  frontAxleLeft.rotation.z = Math.PI / 2;
  kart.add(frontAxleLeft);
  // Front right axle segment
  const frontAxleRightGeo = new THREE.CylinderGeometry(axleRadius, axleRadius, shortAxleLen, 16);
  const frontAxleRight = new THREE.Mesh(frontAxleRightGeo, chassisMat);
  frontAxleRight.position.set(axleGap/2 + shortAxleLen/2, axleY, 0.68 * scale);
  frontAxleRight.rotation.z = Math.PI / 2;
  kart.add(frontAxleRight);
  // Rear left axle segment
  const rearAxleLeftGeo = new THREE.CylinderGeometry(axleRadius, axleRadius, shortAxleLen, 16);
  const rearAxleLeft = new THREE.Mesh(rearAxleLeftGeo, chassisMat);
  rearAxleLeft.position.set(-axleGap/2 - shortAxleLen/2, axleY, -0.68 * scale);
  rearAxleLeft.rotation.z = Math.PI / 2;
  kart.add(rearAxleLeft);
  // Rear right axle segment
  const rearAxleRightGeo = new THREE.CylinderGeometry(axleRadius, axleRadius, shortAxleLen, 16);
  const rearAxleRight = new THREE.Mesh(rearAxleRightGeo, chassisMat);
  rearAxleRight.position.set(axleGap/2 + shortAxleLen/2, axleY, -0.68 * scale);
  rearAxleRight.rotation.z = Math.PI / 2;
  kart.add(rearAxleRight);


  // Wheels
  const wheelThickness = 0.18 * scale;
  const wheelGeometry = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelThickness, 18);
  const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x222222 });
  const tireMaterial = new THREE.MeshPhongMaterial({ color: 0x111111 });
  const hubcapMaterial = new THREE.MeshPhongMaterial({ color: 0x888888 });
  const wheelPositions = [
    [-0.68 * scale, wheelRadius,  0.68 * scale], // front left
    [ 0.68 * scale, wheelRadius,  0.68 * scale], // front right
    [-0.68 * scale, wheelRadius, -0.68 * scale], // rear left
    [ 0.68 * scale, wheelRadius, -0.68 * scale], // rear right
  ];
  window.kartFrontLeft = null;
  window.kartFrontRight = null;
  wheelPositions.forEach(([x, y, z], idx) => {
    const wheelGroup = new THREE.Group();
    // Main wheel (flat faces perpendicular to Z/car direction)
const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
    wheel.rotation.z = Math.PI / 2;
    wheelGroup.add(wheel);
    // Outer black tire ring (disc)
const tireDiscGeo = new THREE.CircleGeometry(wheelRadius, 32);
    const tireDisc1 = new THREE.Mesh(tireDiscGeo, tireMaterial);
    tireDisc1.position.set(0, wheelThickness/2 + 0.001, 0);
    tireDisc1.rotation.z = Math.PI / 2;
    wheelGroup.add(tireDisc1);
    const tireDisc2 = new THREE.Mesh(tireDiscGeo, tireMaterial);
    tireDisc2.position.set(0, -wheelThickness/2 - 0.001, 0);
    tireDisc2.rotation.z = Math.PI / 2;
    wheelGroup.add(tireDisc2);
    // Inner gray hubcap (smaller disc)
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
    // Position wheel group
    wheelGroup.position.set(x, y, z);
    kart.add(wheelGroup);
    if (idx === 0) window.kartFrontLeft = wheelGroup;
    if (idx === 1) window.kartFrontRight = wheelGroup;
  });

  scene.add(kart);

  // Place car at the start of the track
  kart.position.set(start.x, 0.3 * scale, start.z);
  kart.position.set(start.x, 0.3, start.z);
  // Set kartAngle to match the tangent of the road at the start (car forward = +Z)
  const kartAngle = Math.atan2(next.x - start.x, next.z - start.z); // +Z is forward
  kart.rotation.y = kartAngle;

  // (Removed old checkered start/finish line
  // --- Banner Flag Above Start/Finish ---
  const poleHeight = 7, poleOffset = roadWidth * 0.9;
  const poleGeo = new THREE.CylinderGeometry(0.13, 0.13, poleHeight, 16);
  const poleMat = new THREE.MeshPhongMaterial({ color: 0x222222 });
  // Left pole
  const poleL = new THREE.Mesh(poleGeo, poleMat);
  poleL.position.set(
    start.x - Math.cos(kartAngle) * poleOffset,
    poleHeight / 2,
    start.z + Math.sin(kartAngle) * poleOffset
  );
  scene.add(poleL);
  // Right pole
  const poleR = new THREE.Mesh(poleGeo, poleMat);
  poleR.position.set(
    start.x + Math.cos(kartAngle) * poleOffset,
    poleHeight / 2,
    start.z - Math.sin(kartAngle) * poleOffset
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
    const w = 512, h = 128;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 8;
    ctx.strokeRect(0, 0, w, h);
    ctx.font = 'bold 64px sans-serif';
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("LET'S RACE!", w/2, h/2);
    return new THREE.CanvasTexture(canvas);
  }
  const bannerMat = new THREE.MeshPhongMaterial({ map: makeBannerTexture(), side: THREE.DoubleSide });
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  // Center the banner between the two poles
  const midX = (poleLeftPos.x + poleRightPos.x) / 2;
  const midY = poleHeight - bannerHeight/2 + 0.2;
  const midZ = (poleLeftPos.z + poleRightPos.z) / 2;
  banner.position.set(midX, midY, midZ);
  banner.rotation.y = kartAngle + Math.PI; // flip so text faces player
  scene.add(banner);

  // --- TREES ---
  function addTree(x, z, scale=1) {
    // Randomize trunk and leaves
    const trunkH = (1.5 + Math.random() * 1.7) * scale;
    const trunkR = (0.22 + Math.random() * 0.22) * scale;
    const trunkGeo = new THREE.CylinderGeometry(trunkR, trunkR * 1.15, trunkH, 8);
    const trunkMat = new THREE.MeshPhongMaterial({ color: 0x8B5A2B });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, trunkH/2, z);

    // Randomly use sphere or cone leaves, vary size and color
    const useCone = Math.random() < 0.5;
    const leavesH = (1.2 + Math.random() * 1.6) * scale;
    const leavesR = (0.8 + Math.random() * 0.8) * scale;
    const leafColor = Math.random() < 0.22 ? 0x5fa03c : (Math.random() < 0.5 ? 0x228B22 : 0x2e8b57);
    let leaves;
    if (useCone) {
      const leavesGeo = new THREE.ConeGeometry(leavesR, leavesH, 10);
      const leavesMat = new THREE.MeshPhongMaterial({ color: leafColor });
      leaves = new THREE.Mesh(leavesGeo, leavesMat);
      leaves.position.set(x, trunkH + leavesH/2 - 0.18*scale, z);
    } else {
      const leavesGeo = new THREE.SphereGeometry(leavesR, 12, 12);
      const leavesMat = new THREE.MeshPhongMaterial({ color: leafColor });
      leaves = new THREE.Mesh(leavesGeo, leavesMat);
      leaves.position.set(x, trunkH + leavesR*0.93, z);
    }
    scene.add(trunk);
    scene.add(leaves);
  }
  // Fixed tree positions (relative to center  // Procedurally add 200 random trees in rings around the track
  const treePositions = [
    [200, 210], [-250, 230], [300, -180], [-320, -220], [0, 350], [0, -350], [400, 0], [-400, 0],
    [600, 320], [-600, 320], [650, -330], [-650, -330], [100, 600], [-100, 600], [100, -600], [-100, -600],
    [500, 500], [-500, 500], [500, -500], [-500, -500], [800, 0], [-800, 0], [0, 800], [0, -800]
  ];
  // Add 60 trees just outside the track
  const ellipseA_outer = ellipseA + 100;
  const ellipseB_outer = ellipseB + 100;
  for (let i = 0; i < 60; ++i) {
    const angle = (i / 60) * Math.PI * 2;
    const rA = ellipseA_outer + (Math.random() - 0.5) * 20;
    const rB = ellipseB_outer + (Math.random() - 0.5) * 20;
    const x = Math.cos(angle) * rA;
    const z = Math.sin(angle) * rB;
    treePositions.push([x, z]);
  }
  // Add 40 trees just inside the track
  const ellipseA_inner = ellipseA - 80;
  const ellipseB_inner = ellipseB - 80;
  for (let i = 0; i < 40; ++i) {
    const angle = (i / 40) * Math.PI * 2;
    const rA = ellipseA_inner + (Math.random() - 0.5) * 18;
    const rB = ellipseB_inner + (Math.random() - 0.5) * 18;
    const x = Math.cos(angle) * rA;
    const z = Math.sin(angle) * rB;
    treePositions.push([x, z]);
  }
  for (let i = 0; i < 200; ++i) {
    const angle = Math.random() * Math.PI * 2;
    const ring = 1 + Math.floor(Math.random() * 3); // 1, 2, or 3
    const radius = 500 + ring * 350 + Math.random() * 200;
    const x = Math.cos(angle) * radius + (Math.random()-0.5)*70;
    const z = Math.sin(angle) * radius + (Math.random()-0.5)*70;
    treePositions.push([x, z]);
  }
  treePositions.forEach(([x, z]) => addTree(x, z, 1.7));

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
    // Add snow cap (smaller white cone)
    const snowR = baseR * (0.36 + Math.random()*0.18);
    const snowH = height * (0.19 + Math.random()*0.08);
    const snowGeo = new THREE.ConeGeometry(snowR, snowH, 10);
    const snowMat = new THREE.MeshPhongMaterial({ color: 0xffffff, flatShading: true });
    const snow = new THREE.Mesh(snowGeo, snowMat);
    snow.position.set(x, height - snowH/2 + 0.5, z);
    scene.add(snow);
  }
  // Fixed mountain positions
  const mountainPositions = [
    [800, 0], [-800, 0], [0, 900], [0, -900], [600, 700], [-650, -600]
  ];
  mountainPositions.forEach(([x, z]) => addMountain(x, z, 1));

  // --- Place mango at start ---
  resetMango(trackCurve);
}

window.addEventListener('DOMContentLoaded', () => {
  initThreeJS();
  animate();
});

function resetMango(trackCurve) {
  mangoPos = new THREE.Vector3(start.x, start.y + 0.3, start.z);
  mangoDir = Math.atan2(next.x - start.x, next.z - start.z);
  mangoSpeed = 0;
  steerAngle = 0;
}

function updateMango() {
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

function animate() {
  updateMango();
  // Camera follows behind and above the car
  camera.position.set(
    mangoPos.x - Math.sin(mangoDir) * 12,
    mangoPos.y + 5,
    mangoPos.z - Math.cos(mangoDir) * 12
  );
  camera.lookAt(
    mangoPos.x + Math.sin(mangoDir) * 6,
    mangoPos.y + 2.2,
    mangoPos.z + Math.cos(mangoDir) * 6
  );
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

window.addEventListener('DOMContentLoaded', () => {
  initThreeJS();
  animate();
});

// Responsive resize
window.addEventListener('resize', () => {

  if (renderer && camera) {
    camera.aspect = window.innerWidth / (0.8 * window.innerHeight);
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, 0.8 * window.innerHeight);
  }
});
