import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const hero = document.querySelector('#rail-scene');
const stage = hero.querySelector('.scene-stage');
const reticle = hero.querySelector('.scene-reticle');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

function makeRail(points) {
  const vectors = points.map(point => new THREE.Vector3(...point));
  return new THREE.CatmullRomCurve3(vectors);
}

function addRail(scene, rail) {
  const samples = rail.getPoints(100);
  const offset = (point, delta) => point.clone().add(new THREE.Vector3(0, delta, 0));
  const railMaterial = new THREE.LineBasicMaterial({ color: 0x76c7aa, transparent: true, opacity: .48 });
  for (const edge of [-.085, .085]) {
    const geometry = new THREE.BufferGeometry().setFromPoints(samples.map(point => offset(point, edge)));
    scene.add(new THREE.Line(geometry, railMaterial));
  }
  const sleepers = samples.filter((_, i) => i % 4 === 0)
    .flatMap(point => [offset(point, -.14), offset(point, .14)]);
  scene.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(sleepers),
    new THREE.LineBasicMaterial({ color: 0x547767, transparent: true, opacity: .45 }),
  ));
}

function signalTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const context = canvas.getContext('2d');
  const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(.13, 'rgba(255,255,255,.92)');
  glow.addColorStop(.39, 'rgba(255,255,255,.22)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = glow;
  context.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(canvas);
}

async function initialize() {
  const surface = document.createElement('canvas');
  const context = surface.getContext('webgl2', { alpha: true, antialias: true });
  if (!context) return;

  const renderer = new THREE.WebGLRenderer({ canvas: surface, context, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.65));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  stage.prepend(surface);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 60);
  camera.position.set(0, 0, 8.25);

  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const reflection = pmrem.fromScene(environment, .07);
  scene.environment = reflection.texture;
  scene.environmentIntensity = .76;
  environment.dispose();
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xd9e8ff, 2.4);
  key.position.set(-3, 5, 6);
  const rim = new THREE.DirectionalLight(0x5d99ff, 2.0);
  rim.position.set(4, -1, 1);
  scene.add(key, rim, new THREE.HemisphereLight(0xc4d9ff, 0x192444, .8));

  const rail = makeRail([[-6, -2.65, .45], [-3.4, -2.08, -.2], [-1, -.79, -1.4], [2.05, 1.15, -2.2], [5.6, 2.43, -4]]);
  const branch = makeRail([[-5.2, -2.7, -.1], [-2.95, -2.14, -.7], [-.45, -1.42, -2], [2.75, -.45, -2.6], [6.5, 1.12, -4.4]]);
  addRail(scene, rail);
  addRail(scene, branch);

  const glow = signalTexture();
  const signals = [rail, branch, rail].map((route, index) => {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glow, color: index === 1 ? 0xeab267 : 0x92ddbc,
      blending: THREE.AdditiveBlending, depthWrite: false, transparent: true,
    }));
    sprite.scale.setScalar(index === 1 ? .46 : .34);
    scene.add(sprite);
    return { route, sprite, phase: index * .29 };
  });

  const badge = new THREE.Group();
  scene.add(badge);
  try {
    const { scene: medal } = await new GLTFLoader().loadAsync('./assets/badge.glb');
    medal.traverse(part => {
      if (!part.isMesh) return;
      const materials = Array.isArray(part.material) ? part.material : [part.material];
      for (const material of materials) {
        if (material.name.includes('Midnight with UV artwork')) {
          material.color.set('#071630');
          material.roughness = .65;
          material.envMapIntensity = .2;
        }
        if (material.name.includes('Royal blue enamel')) {
          material.color.set('#0443d6');
          material.envMapIntensity = .6;
        }
      }
    });
    // glTF exports Blender Z-up as Y-up. Rotate the badge face toward the camera.
    medal.rotation.x = Math.PI / 2;
    medal.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(medal);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const scale = 3.9 / Math.max(size.x, size.y);
    medal.scale.setScalar(scale);
    medal.position.copy(center).multiplyScalar(-scale);
    badge.add(medal);
  } catch (error) {
    renderer.dispose();
    reflection.dispose();
    surface.remove();
    throw error;
  }

  let frame = 0;
  let visible = true;
  let time = 0;
  let previous = 0;
  const pointer = { x: 0, y: 0 };
  const baseTilt = { x: -.12, y: .18 };
  const motion = () => !document.documentElement.hasAttribute('data-motion-paused') && !reduced.matches;

  function render(now) {
    frame = 0;
    if (previous) time += Math.min((now - previous) / 1000, .05);
    previous = now;
    const active = motion();
    const x = baseTilt.x + (active ? -.34 * pointer.y + Math.cos(time * .8) * .045 : 0);
    const y = baseTilt.y + (active ? .5 * pointer.x + Math.sin(time * .75) * .12 : 0);
    badge.rotation.x = active ? THREE.MathUtils.lerp(badge.rotation.x, x, .13) : baseTilt.x;
    badge.rotation.y = active ? THREE.MathUtils.lerp(badge.rotation.y, y, .13) : baseTilt.y;
    badge.rotation.z = -.045;
    badge.position.y = active ? Math.sin(time * 1.25) * .075 : 0;
    rim.position.x = 4 + pointer.x * 2;
    rim.position.y = -1 - pointer.y * 2;
    for (const { route, sprite, phase } of signals) {
      const t = (phase + .32 + time * .105) % 1;
      sprite.position.copy(route.getPointAt(t));
      sprite.material.opacity = active ? Math.min(1, Math.sin(Math.PI * t) * 1.15) : .48;
    }
    renderer.render(scene, camera);
    if (active && visible && !document.hidden) frame = requestAnimationFrame(render);
  }

  function restart() {
    cancelAnimationFrame(frame);
    previous = 0;
    frame = requestAnimationFrame(render);
  }

  function resize() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.position.z = camera.aspect < 1 ? 8.25 / camera.aspect : 8.25;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    restart();
  }

  function resetPointer() {
    pointer.x = pointer.y = 0;
    delete stage.dataset.tracking;
    delete stage.dataset.lock;
  }

  stage.addEventListener('pointermove', event => {
    if (!motion() || (event.pointerType === 'touch' && !event.buttons)) return;
    const rect = stage.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    pointer.x = THREE.MathUtils.clamp(x / rect.width * 2 - 1, -1, 1);
    pointer.y = THREE.MathUtils.clamp(y / rect.height * 2 - 1, -1, 1);
    if (event.pointerType === 'mouse') {
      reticle.style.transform = `translate(${x - 15}px,${y - 15}px)`;
      stage.dataset.tracking = '';
      stage.toggleAttribute('data-lock', Math.hypot(pointer.x * camera.aspect, pointer.y) < .68);
    }
  });
  for (const event of ['pointerleave', 'pointercancel', 'pointerup']) {
    stage.addEventListener(event, resetPointer);
  }
  window.addEventListener('site-motion-change', () => {
    resetPointer();
    restart();
  });

  const sizes = new ResizeObserver(resize);
  sizes.observe(stage);
  const viewport = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) restart();
    else cancelAnimationFrame(frame);
  });
  viewport.observe(stage);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) cancelAnimationFrame(frame);
    else if (visible) restart();
  });
  surface.addEventListener('webglcontextlost', () => {
    cancelAnimationFrame(frame);
    sizes.disconnect();
    viewport.disconnect();
    delete hero.dataset.ready;
    resetPointer();
  });
  resize();
  requestAnimationFrame(() => { hero.dataset.ready = ''; });
}

initialize().catch(error => console.warn('3D scene unavailable', error));
