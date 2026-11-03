/**
 * Kleine Laufzeit für alle WebGL-Szenen: Renderer, Umgebungslicht, Größenanpassung,
 * Rendern nur wenn sichtbar, Zeiger in normalisierten Koordinaten.
 */
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export interface Stage {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  size: { w: number; h: number; mobile: boolean };
  pointer: THREE.Vector2; // −1…1, geglättet
  pointerRaw: THREE.Vector2;
  pointerActive: boolean;
  onResize: (fn: () => void) => void;
  onFrame: (fn: (t: number, dt: number) => void) => void;
  renderOnce: () => void;
  /** eigener Render-Schritt (z. B. Postprocessing) */
  setRender: (fn: () => void) => void;
  start: () => void;
  stop: () => void;
  dispose: () => void;
}

export { webglAvailable } from './support';

export function createStage(
  canvas: HTMLCanvasElement,
  opts: { fov?: number; shadows?: boolean; maxDpr?: number; envIntensity?: number; observe?: Element } = {},
): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  if (opts.shadows) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = opts.envIntensity ?? 1;

  const camera = new THREE.PerspectiveCamera(opts.fov ?? 35, 1, 0.05, 100);
  const size = { w: 1, h: 1, mobile: false };
  const resizeFns: (() => void)[] = [];
  const frameFns: ((t: number, dt: number) => void)[] = [];

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    size.w = Math.max(1, Math.round(r.width));
    size.h = Math.max(1, Math.round(r.height));
    size.mobile = innerWidth <= 900;
    renderer.setPixelRatio(Math.min(devicePixelRatio, opts.maxDpr ?? (size.mobile ? 1.6 : 1.75)));
    renderer.setSize(size.w, size.h, false);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
    resizeFns.forEach((f) => f());
    if (!running) renderFn();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // Zeiger (global, damit Licht auch über Text hinweg folgt)
  const pointer = new THREE.Vector2();
  const pointerRaw = new THREE.Vector2();
  let pointerActive = false;
  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    pointerRaw.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    pointerActive = true;
    stage.pointerActive = true;
  };
  addEventListener('pointermove', onMove, { passive: true });

  let running = false;
  let renderFn = () => renderer.render(scene, camera);
  let visible = true;
  let last = performance.now();
  let raf = 0;
  const loop = (now: number) => {
    if (!running) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    pointer.lerp(pointerRaw, 1 - Math.pow(0.001, dt));
    frameFns.forEach((f) => f(now / 1000, dt));
    renderFn();
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (running || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };
  const io = new IntersectionObserver(
    ([e]) => {
      visible = e.isIntersecting;
      visible ? start() : stop();
    },
    { rootMargin: '10% 0px' },
  );
  io.observe(opts.observe ?? canvas);
  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);

  const stage: Stage = {
    renderer,
    scene,
    camera,
    size,
    pointer,
    pointerRaw,
    pointerActive,
    onResize: (fn) => resizeFns.push(fn),
    onFrame: (fn) => frameFns.push(fn),
    renderOnce: () => {
      frameFns.forEach((f) => f(performance.now() / 1000, 0));
      renderFn();
    },
    setRender: (fn) => {
      renderFn = fn;
    },
    start,
    stop,
    dispose: () => {
      stop();
      ro.disconnect();
      io.disconnect();
      removeEventListener('pointermove', onMove);
      document.removeEventListener('visibilitychange', onVis);
      renderer.dispose();
    },
  };
  queueMicrotask(resize);
  return stage;
}

export const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeOutBack = (t: number) => {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
/** Teilfortschritt von t im Bereich [a, b] */
export const range = (t: number, a: number, b: number) => clamp01((t - a) / (b - a));
