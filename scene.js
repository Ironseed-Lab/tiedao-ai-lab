import * as THREE from 'three';

const SPEED_AXIS = new THREE.Vector3(0, 1, 0);
const COLORS = [0xdcfc65, 0x66e9da, 0xff765b];
const SWITCH = .38;

function trackPoint(route, progress, side = 0) {
  const t = THREE.MathUtils.clamp(progress, -.08, 1.06);
  const branch = THREE.MathUtils.smoothstep(t, SWITCH, .9);
  return new THREE.Vector3((route - 1) * 25 * branch + side, .28, 9 - t * 88);
}

function addBox(parent, width, height, depth, material, x, y, z) {
  const object = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}

function textureForGlow() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(.14, 'rgba(255,255,255,.85)');
  gradient.addColorStop(.45, 'rgba(255,255,255,.19)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

function sprite(map, color, size, opacity = 1) {
  const mat = new THREE.SpriteMaterial({ map, color, opacity, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const light = new THREE.Sprite(mat);
  light.scale.set(size, size, 1);
  return light;
}

function addTrack(scene, route, start, end, metal, sleepers) {
  const steps = Math.ceil((end - start) * 95);
  const bed = new THREE.InstancedMesh(new THREE.BoxGeometry(2.45, .17, .28), sleepers, steps + 1);
  const dummy = new THREE.Object3D();
  for (let i = 0; i <= steps; i++) {
    const t = THREE.MathUtils.lerp(start, end, i / steps);
    const p = trackPoint(route, t);
    const delta = trackPoint(route, t + .001).sub(p);
    dummy.position.set(p.x, .09, p.z);
    dummy.rotation.y = Math.atan2(-delta.x, -delta.z);
    dummy.updateMatrix();
    bed.setMatrixAt(i, dummy.matrix);
  }
  scene.add(bed);

  const railGlow = new THREE.MeshBasicMaterial({ color: COLORS[route], toneMapped: false,
    transparent: true, opacity: .28, depthWrite: false });
  for (const side of [-.82, .82]) {
    const points = Array.from({ length: steps + 1 }, (_, i) =>
      trackPoint(route, THREE.MathUtils.lerp(start, end, i / steps), side));
    const curve = new THREE.CatmullRomCurve3(points);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, steps, .073, 5, false), metal));
    for (const point of points) point.y += .08;
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), steps, .018, 4, false), railGlow));
  }
  return railGlow;
}

function addLandscape(scene, glow) {
  const soil = new THREE.Mesh(new THREE.PlaneGeometry(270, 250),
    new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: .96 }));
  soil.rotation.x = -Math.PI / 2;
  soil.position.z = -48;
  scene.add(soil);
  const grid = new THREE.GridHelper(180, 68, 0x6d614b, 0x453d34);
  grid.position.set(0, .015, -40);
  grid.material.transparent = true;
  grid.material.opacity = .33;
  scene.add(grid);

  const shade = new THREE.MeshStandardMaterial({ color: 0x2b332d, roughness: .8, metalness: .25 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1a1d1a, roughness: .92 });
  const trim = new THREE.MeshStandardMaterial({ color: 0xa19a6d, roughness: .62, metalness: .3 });
  const led = new THREE.MeshBasicMaterial({ color: 0xdbf777, toneMapped: false });
  for (const z of [5, -12, -27, -47, -67]) {
    const x = z < -35 ? 6.8 : 3.55;
    for (const side of [-1, 1]) {
      addBox(scene, .28, 5.4, .3, shade, side * x, 2.7, z);
      addBox(scene, .53, .45, .55, black, side * x, .225, z);
      addBox(scene, .48, .12, .51, trim, side * x, 4.95, z);
    }
    addBox(scene, 2*x + .8, .22, .27, shade, 0, 5.17, z);
    addBox(scene, .96, .36, .46, black, 0, 4.93, z);
    addBox(scene, .51, .076, .468, led, 0, 4.93, z);
  }
  const rand = index => {
    const n = Math.sin(index * 19.19 + .09) * 43758.5453;
    return n - Math.floor(n);
  };
  for (let i = 0; i < 48; i++) {
    const side = i % 2 ? -1 : 1;
    const z = 14 - i * 2.15;
    const x = side * (7.8 + rand(i) * 24 + Math.max(0, -z - 21) * .34);
    const h = 1.4 + rand(i + 33) * 8;
    const width = 1.7 + rand(i + 93) * 3.8;
    addBox(scene, width, h, 1.6 + rand(i + 10) * 3.5, i % 4 ? shade : black, x, h / 2, z);
    if (i % 3 === 0) {
      addBox(scene, width * .8, .08, .09, i % 2 ? trim : led, x, h * .69, z + .83);
      addBox(scene, .09, 1.4, .09, trim, x + width * .31, h + .7, z);
    }
  }
  const sun = sprite(glow, 0xff803c, 34, .78);
  sun.position.set(-17, 8.5, -105);
  scene.add(sun);
  const core = new THREE.Mesh(new THREE.SphereGeometry(3.1, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xffc586, toneMapped: false, fog: false }));
  core.position.copy(sun.position);
  scene.add(core);

  // Floating junctions connect the rail network to a second, abstract data grid.
  const points = [];
  const signalMaterial = new THREE.MeshBasicMaterial({ color: 0xffb86b, toneMapped: false });
  const nodeGeometry = new THREE.OctahedronGeometry(.19);
  let lastNode;
  for (let i = 0; i < 17; i++) {
    const p = new THREE.Vector3((rand(i + 3) - .5) * 56, 7 + rand(i + 7) * 12, -21 - i * 3.6);
    const node = new THREE.Mesh(nodeGeometry, signalMaterial);
    node.position.copy(p);
    scene.add(node);
    if (i) points.push(lastNode, p);
    lastNode = p;
  }
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0xdb8d50, transparent: true, opacity: .26 })));
}

function makeTrain(scene, glow) {
  const train = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: 0xbad54d, roughness: .32, metalness: .36 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x3b4637, roughness: .39, metalness: .32 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x111c19, roughness: .17, metalness: .23 });
  const stripe = new THREE.MeshBasicMaterial({ color: 0xeeffc2, toneMapped: false });
  const tail = new THREE.MeshBasicMaterial({ color: 0xff553c, toneMapped: false });
  addBox(train, 1.8, 1.35, 4.15, body, 0, 1.09, 0);
  addBox(train, 1.52, .23, 3.63, roof, 0, 1.88, .12);
  addBox(train, 1.64, .3, 3.75, roof, 0, .39, 0);
  addBox(train, 1.68, .51, .16, glass, 0, 1.35, -2.12);
  addBox(train, 1.38, .39, .045, glass, 0, 1.33, 2.09);
  addBox(train, 1.4, .11, .06, stripe, 0, .85, -2.22);
  for (const x of [-.918, .918]) {
    addBox(train, .036, .12, 3.8, stripe, x, .86, .12);
    for (const z of [-1.35, -.46, .43, 1.32]) addBox(train, .05, .37, .57, glass, x, 1.36, z);
  }
  for (const x of [-.59, .59]) {
    addBox(train, .29, .11, .055, tail, x, .79, 2.1);
    const lamp = sprite(glow, 0xff5332, .8, .75);
    lamp.position.set(x, .79, 2.17);
    train.add(lamp);
  }
  scene.add(train);
  return train;
}

export function createYard(windowEl, reduceMotion, onUnavailable) {
  const stage = windowEl.querySelector('.webgl');
  const reticle = windowEl.querySelector('.reticle');
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', { alpha: false, antialias: true });
  if (!context) return null;
  const renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.45));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  stage.append(canvas);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x644234);
  scene.fog = new THREE.FogExp2(0x694638, .013);
  const camera = new THREE.PerspectiveCamera(46, 1, .3, 230);
  const sun = new THREE.DirectionalLight(0xffc891, 2.85);
  sun.position.set(-12, 9, -21);
  const fill = new THREE.DirectionalLight(0xb3e4f0, 1.0);
  fill.position.set(5, 5, 15);
  scene.add(sun, fill, new THREE.HemisphereLight(0xf7bb86, 0x4a5a53, 1.35));
  const glow = textureForGlow();
  addLandscape(scene, glow);
  const railMetal = new THREE.MeshStandardMaterial({ color: 0xbdb58a, roughness: .43, metalness: .32 });
  const sleeper = new THREE.MeshStandardMaterial({ color: 0x615449, roughness: .92 });
  addTrack(scene, 1, -.065, SWITCH, railMetal, sleeper);
  const branches = COLORS.map((_, route) => addTrack(scene, route, SWITCH, 1.055, railMetal, sleeper));
  const train = makeTrain(scene, glow);
  const beacon = COLORS.map((color, route) => {
    const terminal = trackPoint(route, .968);
    const sign = sprite(glow, color, 5.7, .75);
    sign.position.set(terminal.x, 2.2, terminal.z - 4.2);
    scene.add(sign);
    return sign;
  });
  const light = sprite(glow, COLORS[0], 1.45);
  scene.add(light);
  const eye = new THREE.Vector3(), aim = new THREE.Vector3();
  const pointer = new THREE.Vector2();
  let inView = true;
  let lastDraw = -Infinity;
  let lastFrame;
  let stopped = false;

  function resize() {
    if (!stage.clientWidth || !stage.clientHeight) return;
    camera.aspect = stage.clientWidth / stage.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(stage.clientWidth, stage.clientHeight, false);
    lastDraw = -Infinity;
    if (lastFrame) render(lastFrame, performance.now());
  }
  const size = new ResizeObserver(resize);
  size.observe(stage);
  const visibility = new IntersectionObserver(([entry]) => { inView = entry.isIntersecting; });
  visibility.observe(windowEl);
  function resetPointer() {
    pointer.set(0, 0);
    delete windowEl.dataset.tracking;
    delete windowEl.dataset.locked;
  }
  stage.addEventListener('pointerleave', resetPointer);
  stage.addEventListener('pointermove', event => {
    if (reduceMotion() || event.pointerType !== 'mouse') return;
    const rect = stage.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    pointer.set(x / rect.width * 2 - 1, y / rect.height * 2 - 1);
    reticle.style.transform = `translate(${x - 16}px,${y - 16}px)`;
    windowEl.dataset.tracking = '';
    windowEl.toggleAttribute('data-locked', Math.abs(pointer.x) < .32 && Math.abs(pointer.y) < .45);
  });
  canvas.addEventListener('webglcontextlost', () => {
    stopped = true;
    resetPointer();
    size.disconnect();
    visibility.disconnect();
    delete windowEl.dataset.webgl;
    onUnavailable();
  });

  function render(frame, now) {
    lastFrame = frame;
    const still = reduceMotion();
    const changed = frame.progress !== render.progress || frame.route !== render.route || still !== render.still;
    if (stopped || !inView || document.hidden || now - lastDraw < 32 || (still && !changed && lastDraw !== -Infinity)) return;
    lastDraw = now;
    render.progress = frame.progress;
    render.route = frame.route;
    render.still = still;

    const p = trackPoint(frame.route, frame.progress);
    const forward = trackPoint(frame.route, frame.progress + .015).sub(p).normalize();
    train.position.copy(p);
    train.quaternion.setFromAxisAngle(SPEED_AXIS, Math.atan2(-forward.x, -forward.z));
    const mobile = camera.aspect < 1.25;
    const offsetX = (mobile ? 3.55 : 5.5) + (still ? 0 : pointer.x * 2.15);
    eye.set(p.x + offsetX, p.y + (mobile ? 4.5 : 4.35) + (still ? 0 : -pointer.y * .87), p.z + (mobile ? 10.2 : 11.9));
    aim.set(p.x - (mobile ? .3 : 1.8), 1.2, p.z - (mobile ? 4.7 : 7.4));
    camera.position.copy(eye);
    camera.lookAt(aim);
    branches.forEach((mat, index) => { mat.opacity = index === frame.route ? .95 : .17; });
    beacon.forEach((node, index) => { node.material.opacity = index === frame.route ? .85 : .24; });
    light.position.copy(trackPoint(frame.route, still ? .48 : (frame.progress + .22 + (now * .000065 % .28)) % 1));
    light.position.y += .27;
    light.material.color.setHex(COLORS[frame.route]);
    renderer.render(scene, camera);
    windowEl.dataset.webgl = '';
  }
  resize();
  return { render, resetPointer };
}
