/**
 * Kleine Laufzeit für alle WebGL-Szenen: Renderer, Umgebungslicht, Größenanpassung,
 * Rendern nur wenn sichtbar, Zeiger in normalisierten Koordinaten.
 * Shader werden vorab im Hintergrund kompiliert (prepare), die Auflösung passt sich der Bildrate an.
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
  /** eigener Render-Schritt (z. B. zusätzliche Durchgänge) */
  setRender: (fn: () => void) => void;
  /** bereitet die Szene in kleinen Portionen vor (Umgebungslicht, Shader, deren Erstnutzung) und startet danach;
   *  Varianten: dieselben Objekte zusätzlich für ein Render-Target oder mit Schnittebenen kompilieren */
  prepare: (variants?: CompileVariant[]) => Promise<void>;
  start: () => void;
  stop: () => void;
  dispose: () => void;
}

export { webglAvailable } from './support';

export interface CompileVariant {
  camera?: THREE.Camera;
  target?: THREE.WebGLRenderTarget | null;
  /** Schnittebenen: three.js kennt lokale Ebenen beim Vorab-Kompilieren nicht, daher als globale gleicher Anzahl */
  clipping?: THREE.Plane[];
  root?: THREE.Object3D;
}

/** Zeitbudget je Bild für Vorbereitungsarbeit (ms) – darunter bleibt das Scrollen flüssig */
const BUDGET = 6;
const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * Gemeinsame Qualitätsstufe aller Szenen (Faktor auf die Pixeldichte). Hält ein Gerät die Bildrate
 * nicht, sinkt sie stufenweise – und gilt dann auch für die folgenden Szenen.
 */
let quality = 1;
const QUALITY_MIN = 0.45;

export function createStage(
  canvas: HTMLCanvasElement,
  opts: { fov?: number; shadows?: boolean; maxDpr?: number; envIntensity?: number; observe?: Element; antialias?: boolean } = {},
): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: opts.antialias ?? true, alpha: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  // Shader-Fehlerprüfung liest bei jeder Erstnutzung synchron das Protokoll – nur in der Entwicklung
  renderer.debug.checkShaderErrors = import.meta.env.DEV;
  if (opts.shadows) {
    renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap stellt three.js beim ersten Schattenwurf auf PCFShadowMap um – das würde
    // alle vorab kompilierten Shader ungültig machen
    renderer.shadowMap.type = THREE.PCFShadowMap;
  }
  const scene = new THREE.Scene();
  scene.environmentIntensity = opts.envIntensity ?? 1;
  // Umgebungslicht (vorgefiltert); entsteht erst in prepare bzw. vor dem ersten Standbild
  const makeEnv = () => {
    if (scene.environment) return;
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
  };

  const camera = new THREE.PerspectiveCamera(opts.fov ?? 35, 1, 0.05, 100);
  const size = { w: 1, h: 1, mobile: false };
  const resizeFns: (() => void)[] = [];
  const frameFns: ((t: number, dt: number) => void)[] = [];

  const resize = () => {
    const r = canvas.getBoundingClientRect();
    size.w = Math.max(1, Math.round(r.width));
    size.h = Math.max(1, Math.round(r.height));
    size.mobile = innerWidth <= 900;
    const cap = Math.min(devicePixelRatio, opts.maxDpr ?? (size.mobile ? 1.6 : 1.75));
    renderer.setPixelRatio(Math.min(cap, Math.max(0.75, cap * quality)));
    renderer.setSize(size.w, size.h, false);
    camera.aspect = size.w / size.h;
    camera.updateProjectionMatrix();
    resizeFns.forEach((f) => f());
    // erst rendern, wenn die Shader bereit sind – sonst kompiliert der erste Frame alles synchron
    if (!running && ready) renderFn();
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
  let ready = true;
  let renderFn = () => renderer.render(scene, camera);
  let visible = true;
  let last = performance.now();
  let raf = 0;

  // Adaptive Auflösung: liegt die Bildzeit über ~30 Bilder im Mittel deutlich unter 50 fps,
  // sinkt die Pixeldichte um eine Stufe. Die ersten Bilder nach dem Start zählen nicht.
  let skip = 20;
  let sum = 0;
  let n = 0;
  const adapt = (ms: number) => {
    if (skip > 0 || ms > 250) {
      skip = Math.max(0, skip - 1);
      return;
    }
    sum += ms;
    if (++n < 30) return;
    const avg = sum / n;
    sum = 0;
    n = 0;
    if (avg > 21 && quality > QUALITY_MIN) {
      quality = Math.max(QUALITY_MIN, quality * 0.8);
      skip = 30;
      resize();
    }
  };

  const loop = (now: number) => {
    if (!running) return;
    adapt(now - last);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    pointer.lerp(pointerRaw, 1 - Math.pow(0.001, dt));
    frameFns.forEach((f) => f(now / 1000, dt));
    renderFn();
    raf = requestAnimationFrame(loop);
  };
  const start = () => {
    if (running || !ready || !visible || document.hidden) return;
    running = true;
    skip = 20;
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
      makeEnv();
      frameFns.forEach((f) => f(performance.now() / 1000, 0));
      renderFn();
    },
    setRender: (fn) => {
      renderFn = fn;
    },
    prepare: async (variants = []) => {
      ready = false;
      await nextFrame();
      makeEnv();
      // Shader portionsweise anlegen; der Treiber kompiliert sie parallel im Hintergrund
      // (KHR_parallel_shader_compile), die Seite scrollt währenddessen weiter
      for (const v of [{ camera } as CompileVariant, ...variants]) {
        const objs: THREE.Object3D[] = [];
        (v.root ?? scene).traverse((o) => (o as THREE.Mesh).material && objs.push(o));
        for (let i = 0; i < objs.length; ) {
          await nextFrame();
          const t0 = performance.now();
          renderer.setRenderTarget(v.target ?? null);
          renderer.clippingPlanes = v.clipping ?? [];
          while (i < objs.length && performance.now() - t0 < BUDGET) renderer.compile(objs[i++], v.camera ?? camera, scene);
          renderer.clippingPlanes = [];
          renderer.setRenderTarget(null);
        }
      }
      const programs = renderer.info.programs ?? [];
      while (!programs.every((pr) => pr.isReady())) await nextFrame();
      // Erstnutzung (Abfrage der Uniforms und Attribute) ebenfalls portionsweise statt im ersten Bild
      for (let i = 0; i < programs.length; ) {
        await nextFrame();
        const t0 = performance.now();
        while (i < programs.length && performance.now() - t0 < BUDGET) {
          programs[i].getUniforms();
          programs[i++].getAttributes();
        }
      }
      ready = true;
      start();
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
