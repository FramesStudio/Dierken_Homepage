/**
 * Hero: Wand aus glasierten Fliesen (echte Fasen, Glasur im Shader).
 * - Beim Laden werden die Fliesen „gesetzt“ (diagonale Verlegefolge)
 * - Licht folgt dem Zeiger, Fliesen in der Nähe heben sich leicht an
 * - Beim Scrollen drehen sich die Fliesen und geben ein Raumbild frei
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createStage, clamp01, easeInOut, easeOutBack, range } from './engine';
import { tileMaterial, addTileAttributes } from './materials';

// --- Tuning ---------------------------------------------------------------
const PITCH = 1;
const TILE = 0.955;
const DEPTH = 0.14;
const ROWS_DESKTOP = 7;
const ROWS_MOBILE = 9;
const FOV = 20;
const MAX = 16 * 34;
/** Glasurfarben mit Gewichtung – vorwiegend Markenblau */
const PALETTE: [string, number][] = [
  ['#0b1f58', 30],
  ['#0a1747', 18],
  ['#142a6e', 16],
  ['#1d3c8f', 10],
  ['#24489f', 5],
  ['#6eaace', 8],
  ['#bcd4e6', 6],
  ['#e8e4dc', 7],
];

export interface HeroWallOptions {
  progress: () => number; // 0 … 1 (Scroll)
  reduced: boolean;
  observe?: Element;
}

export function initHeroWall(canvas: HTMLCanvasElement, o: HeroWallOptions) {
  const stage = createStage(canvas, { fov: FOV, envIntensity: 0.4, observe: o.observe });
  const { scene, camera } = stage;

  // Geometrie & Materialien
  const geo = new RoundedBoxGeometry(TILE, TILE, DEPTH, 4, 0.05);
  const rest = new Float32Array(MAX * 3);
  const seeds = new Float32Array(MAX);
  addTileAttributes(geo, rest, seeds);
  const mat = tileMaterial({ kind: 'glaze', tile: [TILE, TILE], plane: 0, instanced: true, bump: 0.011 });
  const tiles = new THREE.InstancedMesh(geo, mat, MAX);
  tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(tiles);

  // Rückseiten: warmer Travertin – die Wand dreht sich vom Markenblau ins Material
  const backGeo = new RoundedBoxGeometry(TILE, TILE, 0.02, 3, 0.012);
  backGeo.rotateY(Math.PI);
  backGeo.translate(0, 0, -DEPTH / 2 - 0.004);
  addTileAttributes(backGeo, rest, seeds);
  const backMat = tileMaterial({ kind: 'travertine', base: '#dcc7a6', plane: 0, instanced: true, tile: [TILE, TILE] });
  const backs = new THREE.InstancedMesh(backGeo, backMat, MAX);
  backs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(backs);

  // Fuge
  const grout = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 40),
    new THREE.MeshStandardMaterial({ color: '#d9d2c6', roughness: 0.95 }),
  );
  grout.position.z = -DEPTH / 2 - 0.02;
  scene.add(grout);

  // Licht
  const key = new THREE.DirectionalLight('#fff4e6', 1.1);
  key.position.set(-4, 5, 6);
  scene.add(key);
  const spot = new THREE.PointLight('#ffffff', 26, 0, 2);
  spot.position.set(0, 0, 2.2);
  scene.add(spot);
  const rim = new THREE.PointLight('#9cc2e6', 8, 0, 2);
  rim.position.set(6, -3, 3);
  scene.add(rim);

  // Instanzdaten
  const color = new THREE.Color();
  const weights = PALETTE.reduce((a, [, w]) => a + w, 0);
  const pick = (r: number) => {
    let acc = 0;
    for (const [c, w] of PALETTE) {
      acc += w / weights;
      if (r <= acc) return c;
    }
    return PALETTE[0][0];
  };
  let cols = 0;
  let rows = 0;
  let count = 0;
  const data: { x: number; y: number; delay: number; flip: number; jitter: number }[] = [];

  const layout = () => {
    rows = stage.size.mobile ? ROWS_MOBILE : ROWS_DESKTOP;
    const visibleH = rows * PITCH * 0.97;
    const dist = visibleH / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    cols = Math.ceil(rows * camera.aspect) + 2;
    rows += 1;
    count = Math.min(MAX, cols * rows);
    tiles.count = count;
    backs.count = count;
    data.length = 0;


    let i = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (i >= count) break;
        const x = (c - (cols - 1) / 2) * PITCH;
        const y = (r - (rows - 1) / 2) * PITCH;
        rest[i * 3] = x;
        rest[i * 3 + 1] = y;
        rest[i * 3 + 2] = 0;
        const s = Math.random();
        seeds[i] = s;
        color.set(pick(Math.random()));
        tiles.setColorAt(i, color);
        const diag = (c / cols + (rows - 1 - r) / rows) / 2; // von links oben
        data.push({ x, y, delay: (c + r) * 0.035 + Math.random() * 0.18, flip: diag * 0.55 + Math.random() * 0.08, jitter: (Math.random() - 0.5) * 0.06 });
        i++;
      }
    }
    (geo.getAttribute('aRest') as THREE.BufferAttribute).needsUpdate = true;
    (geo.getAttribute('aSeed') as THREE.BufferAttribute).needsUpdate = true;
    (backGeo.getAttribute('aRest') as THREE.BufferAttribute).needsUpdate = true;
    (backGeo.getAttribute('aSeed') as THREE.BufferAttribute).needsUpdate = true;
    if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
  };
  stage.onResize(layout);

  // Animation
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const hit = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  let t0 = -1;
  let flipP = 0;

  stage.onFrame((t, dt) => {
    if (t0 < 0) t0 = t;
    const since = o.reduced ? 99 : t - t0;
    flipP += (o.progress() - flipP) * (1 - Math.pow(0.86, dt * 60));
    const p = o.reduced ? 0 : flipP;

    // Zeiger → Punkt auf der Wand; ohne Zeiger wandert das Licht langsam
    let px: number;
    let py: number;
    if (stage.pointerActive && !o.reduced) {
      ray.setFromCamera(stage.pointer, camera);
      ray.ray.intersectPlane(plane, hit);
      px = hit.x;
      py = hit.y;
    } else {
      px = Math.sin(t * 0.25) * cols * 0.28;
      py = Math.cos(t * 0.19) * rows * 0.2;
    }
    spot.position.set(px, py, 2.1);
    if (!o.reduced) {
      camera.position.x = stage.pointer.x * 0.18;
      camera.position.y = stage.pointer.y * 0.12;
      camera.lookAt(0, 0, 0);
    }

    for (let i = 0; i < count; i++) {
      const d = data[i];
      const a = easeOutBack(range(since, d.delay, d.delay + 0.95));
      const f = easeInOut(clamp01(p * 1.55 - d.flip));
      const dx = d.x - px;
      const dy = d.y - py;
      const near = Math.exp(-(dx * dx + dy * dy) / 1.6) * (1 - f) * (o.reduced ? 0 : 1);
      pos.set(d.x, d.y, (1 - a) * 1.2 + near * 0.16 + Math.sin(f * Math.PI) * 0.6);
      e.set((1 - a) * 1.25 - dy * near * 0.12, f * Math.PI + dx * near * 0.12, d.jitter * (1 - a) * 8 + d.jitter * 0.04);
      q.setFromEuler(e);
      const s = 0.25 + 0.75 * clamp01(a);
      scl.set(s, s, s);
      m4.compose(pos, q, scl);
      tiles.setMatrixAt(i, m4);
      backs.setMatrixAt(i, m4);
    }
    tiles.instanceMatrix.needsUpdate = true;
    backs.instanceMatrix.needsUpdate = true;
  });

  if (o.reduced) {
    stage.onResize(() => stage.renderOnce());
  } else {
    stage.start();
  }
  return stage;
}
