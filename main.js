// ===============================
// Let's Race! - 3D Mario Kart-style Game (Three.js// ===============================
// Core 3D scene setup, track, kart, and controls

// ===============================
// GLOBALS & GAME STATE
// ===============================
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
  const bananaStart = new THREE.Vector3(0, 0.3 * scale, -1.35 * scale);
  const bananaEnd = new THREE.Vector3(0, 0.7 * scale, 1.35 * scale);
  const bananaControl1 = new THREE.Vector3(0, -0.5 * scale, -0.7 * scale);
  const bananaControl2 = new THREE.Vector3(0, -0.5 * scale, 0.7 * scale);
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
  // Handle (front)
  const endPt = bananaCurve.getPoint(1);
  const endTan = bananaCurve.getTangent(1);
  const handleRadius = 0.09 * scale;
  const handleLength = 0.43 * scale;
  const handleGeo = new THREE.CylinderGeometry(handleRadius, handleRadius, handleLength, 20);
  const handleMat = new THREE.MeshPhongMaterial({ color: 0xffe066 });
  const handle = new THREE.Mesh(handleGeo, handleMat);
  handle.position.copy(endPt.clone().add(endTan.clone().multiplyScalar(handleLength/2)));
  handle.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), endTan.clone().normalize());
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
const roadWidth = 60; // Width of the road for player placement and rendering
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
  const left = start.clone().add(new THREE.Vector3(-tangent.z, 0, tangent.x).normalize().multiplyScalar(roadWidth/4));
  const right = start.clone().add(new THREE.Vector3(tangent.z, 0, -tangent.x).normalize().multiplyScalar(roadWidth/4));
  players = [
    new Player(left, angle, { left: 'KeyA', right: 'KeyD', up: 'KeyW', down: 'KeyS' }),
    new Player(right, angle, { left: 'ArrowLeft', right: 'ArrowRight', up: 'ArrowUp', down: 'ArrowDown' })
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
    // Keep bushes well off the road: radius must be outside 1.35x road ellipse
    while (true) {
      angle = Math.random() * Math.PI * 2;
      // Minimum bush distance from center: 1.35x road ellipse
      const minA = ellipseA * 1.35;
      const minB = ellipseB * 1.35;
      radius = minA + Math.random() * (groundRadius - minA - 50);
      x = Math.cos(angle) * radius;
      z = Math.sin(angle) * (radius * ellipseB / ellipseA);
      // Check if inside forbidden ellipse (road area)
      if ((x*x)/(minA*minA) + (z*z)/(minB*minB) > 1.0) break;
    }
    const bush = new THREE.Group();
    for (let j = 0; j < 2 + Math.floor(Math.random()*2); ++j) {
      const bx = x + (Math.random()-0.5)*7; // tighter cluster
      const bz = z + (Math.random()-0.5)*7;
      const bushGeo = new THREE.SphereGeometry(3 + Math.random()*1.5, 12, 12); // smaller
      const bushMat = new THREE.MeshPhongMaterial({ color: 0x267a2a });
      const bushPart = new THREE.Mesh(bushGeo, bushMat);
      bushPart.position.set(bx, 3 + Math.random()*1.2, bz);
      bush.add(bushPart);
    }
    scene.add(bush);
  }
  // --- Road mesh ---

  const roadMaterial = new THREE.MeshPhongMaterial({ color: 0x888888, side: THREE.DoubleSide }); // Medium gray
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
    ctx.font = 'bold 260px sans-serif';
    ctx.fillStyle = '#000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText("LET'S RACE!", w/2, h/2);
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

  // --- Golden Rings ---
  rings = []; // clear previous rings
  const numRings = 18;
  const ringRadius = 2.2;
  const tubeRadius = 0.35;
  for (let i = 0; i < numRings; ++i) {
    const t = Math.random();
    const pt = trackCurve.getPointAt(t);
    const ringGeo = new THREE.TorusGeometry(ringRadius, tubeRadius, 16, 64);
    const ringMat = new THREE.MeshPhongMaterial({ color: 0xffd700, shininess: 80 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(pt.x, pt.y + 3.2, pt.z); // floating above road
    // No rotation.x: keep vertical
    scene.add(ring);
    rings.push(ring);

  }
}

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
      ring.rotation.y -= 0.015;
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
  renderer.setViewport(0, 0, window.innerWidth/2, window.innerHeight);
  renderer.setScissor(0, 0, window.innerWidth/2, window.innerHeight);
  updateCameraForPlayer(window.camera1, players[0]);
  renderer.render(scene, window.camera1);
  // Right (Player 2)
  renderer.setViewport(window.innerWidth/2, 0, window.innerWidth/2, window.innerHeight);
  renderer.setScissor(window.innerWidth/2, 0, window.innerWidth/2, window.innerHeight);
  updateCameraForPlayer(window.camera2, players[1]);
  renderer.render(scene, window.camera2);
  renderer.setScissorTest(false);
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
  // Update kart position
  player.kart.position.copy(player.pos);
  player.kart.rotation.y = player.dir;
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
  for (let i = 0; i < 14; ++i) {
    const geo = new THREE.SphereGeometry(0.11 + Math.random()*0.07, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffcc, transparent: true, opacity: 0.85 });
    const mesh = new THREE.Mesh(geo, mat);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.random() * Math.PI;
    mesh.position.set(
      Math.sin(phi)*Math.cos(theta),
      Math.cos(phi),
      Math.sin(phi)*Math.sin(theta)
    );
    mesh.position.multiplyScalar(0.3 + Math.random()*0.5);
    group.add(mesh);
  }
  group.position.copy(pos);
  scene.add(group);
  let t = 0;
  function animateSparkle() {
    t += 0.06;
    group.children.forEach((m, idx) => {
      m.material.opacity = Math.max(0, 0.85 - t*1.2);
      m.position.multiplyScalar(1.11 + 0.03*Math.sin(idx + t*8));
    });
    if (t < 0.5) {
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
    countdownElem.style.height = '100vh';
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
