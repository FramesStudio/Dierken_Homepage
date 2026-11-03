/**
 * Leistungen: Schwenkrahmen-Display wie in der Ausstellung.
 * Fünf Rahmen hängen an einer Säule; beim Scrollen werden sie wie Buchseiten umgeblättert.
 * Jede Doppelseite = eine Leistung. Auf der letzten Seite werden die Fliesen einzeln gesetzt.
 * p ∈ [0, 4.3]: Blättern bei k + 0.15 … k + 0.75, Verlegen ab 3.7.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createStage, clamp01, lerp, easeInOut, easeOut, range } from './engine';
import { tileMaterial, addTileAttributes, type Kind } from './materials';

const FW = 0.8; // Fliesenfläche je Seite
const FH = 1.8;
const BOTTOM = 0.2;
const PROFILE = 0.028;
const DEG = Math.PI / 180;

interface FaceDef {
  kind: Kind;
  base?: string;
  size: [number, number];
  glazeVar?: boolean;
  seamless?: boolean;
}

// Seiten: [vorne, hinten] je Rahmen
const FACES: [FaceDef, FaceDef | null][] = [
  [{ kind: 'glaze', base: '#16307a', size: [0.1, 0.3], glazeVar: true }, { kind: 'marble', size: [0.4, 0.9] }],
  [{ kind: 'glaze', base: '#8fa08c', size: [0.1, 0.1], glazeVar: true }, { kind: 'travertine', base: '#d9c4a4', size: [0.8, 1.8] }],
  [{ kind: 'fluted', base: '#dccab0', size: [0.2, 0.6] }, { kind: 'terrazzo', size: [0.4, 0.6] }],
  [{ kind: 'wood', base: '#e2bf95', size: [0.4, 0.15] }, { kind: 'microcement', base: '#cbbfae', size: [0.8, 1.8], seamless: true }],
  [{ kind: 'glaze', base: '#0f2462', size: [0.1, 0.1], glazeVar: true }, null],
];

export function initDisplay(canvas: HTMLCanvasElement, opts: { reduced: boolean; observe?: Element }) {
  const stage = createStage(canvas, { fov: 34, shadows: true, envIntensity: 0.38, observe: opts.observe });
  const { scene, camera, renderer } = stage;
  const cream = new THREE.Color('#efe8dd');
  scene.background = cream;
  scene.fog = new THREE.Fog(cream, 9, 20);
  renderer.toneMappingExposure = 1.0;

  // Studio
  const studio = new THREE.MeshStandardMaterial({ color: '#ece4d7', roughness: 0.95 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), studio);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), studio);
  wall.position.set(0, 10, -1.9);
  wall.receiveShadow = true;
  scene.add(floor, wall);

  // Säule mit Fuß und Kopf (Markenblau, pulverbeschichtet)
  const navy = new THREE.MeshStandardMaterial({ color: '#0b1f58', roughness: 0.42, metalness: 0.35 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.2, 24), navy);
  post.position.set(0, 1.1, 0);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 48), navy);
  foot.position.y = 0.015;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 24), navy);
  cap.position.y = 2.2;
  for (const m of [post, foot, cap]) {
    m.castShadow = true;
    m.receiveShadow = true;
    scene.add(m);
  }

  // Rahmen
  const frames: THREE.Group[] = [];
  const layTiles: { mesh: THREE.InstancedMesh; cells: { x: number; y: number; d: number }[] } = { mesh: null as unknown as THREE.InstancedMesh, cells: [] };
  const profileMat = navy;
  const makeFace = (def: FaceDef, back: boolean, parent: THREE.Object3D, isLay: boolean) => {
    const [w, h] = def.size;
    const nx = Math.round(FW / w);
    const ny = Math.round(FH / h);
    const count = nx * ny;
    const geo = def.seamless ? new THREE.BoxGeometry(FW, FH, 0.006) : new RoundedBoxGeometry(w - 0.002, h - 0.002, 0.012, 2, 0.0025);
    const rest = new Float32Array(count * 3);
    const seeds = new Float32Array(count).map(() => Math.random());
    const cells: { x: number; y: number; d: number }[] = [];
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) {
        const x = -FW / 2 + w / 2 + i * w;
        const y = -FH / 2 + h / 2 + j * h;
        rest.set([x, y, 0], cells.length * 3);
        cells.push({ x, y, d: (j * nx + (j % 2 ? nx - 1 - i : i)) / count });
      }
    addTileAttributes(geo, rest, seeds);
    const mat = tileMaterial({ kind: def.kind, base: def.base, plane: 0, instanced: true, tile: def.size, bump: def.kind === 'glaze' ? 0.009 : def.kind === 'fluted' ? 0.012 : undefined });
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const m4 = new THREE.Matrix4();
    cells.forEach((c, i) => mesh.setMatrixAt(i, m4.makeTranslation(c.x, c.y, 0)));
    if (def.glazeVar) {
      const col = new THREE.Color();
      for (let i = 0; i < count; i++) mesh.setColorAt(i, col.setScalar(0.78 + Math.random() * 0.4));
    }
    const holder = new THREE.Group();
    holder.position.z = back ? -0.012 : 0.012;
    if (back) holder.rotation.y = Math.PI;
    holder.add(mesh);
    parent.add(holder);
    if (isLay) {
      layTiles.mesh = mesh;
      layTiles.cells = cells;
    }
  };

  FACES.forEach(([front, back], k) => {
    const frame = new THREE.Group(); // Drehpunkt = Säule
    const inner = new THREE.Group();
    inner.position.set(0.045 + FW / 2 + PROFILE, BOTTOM + FH / 2, 0);
    frame.add(inner);
    // Profilrahmen
    const W = FW + PROFILE * 2;
    const H = FH + PROFILE * 2;
    const bars = [
      [W, PROFILE, 0, H / 2 - PROFILE / 2],
      [W, PROFILE, 0, -H / 2 + PROFILE / 2],
      [PROFILE, H, -W / 2 + PROFILE / 2, 0],
      [PROFILE, H, W / 2 - PROFILE / 2, 0],
    ];
    for (const [bw, bh, bx, by] of bars) {
      const b = new THREE.Mesh(new RoundedBoxGeometry(bw, bh, 0.036, 2, 0.004), profileMat);
      b.position.set(bx, by, 0);
      b.castShadow = true;
      b.receiveShadow = true;
      inner.add(b);
    }
    // Trägerplatte
    const core = new THREE.Mesh(new THREE.BoxGeometry(FW, FH, 0.012), new THREE.MeshStandardMaterial({ color: '#d9d2c6', roughness: 0.9 }));
    inner.add(core);
    // Scharniere
    for (const hy of [BOTTOM + 0.15, BOTTOM + FH - 0.15]) {
      const hinge = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.02), navy);
      hinge.position.set(0.03, hy, 0);
      frame.add(hinge);
    }
    makeFace(front, false, inner, k === FACES.length - 1);
    if (back) makeFace(back, true, inner, false);
    frame.position.y = k * 0.0006; // gegen Flimmern
    scene.add(frame);
    frames.push(frame);
  });

  // Licht
  scene.add(new THREE.HemisphereLight('#ffffff', '#b9ab93', 0.32));
  const key = new THREE.DirectionalLight('#fff1dd', 2.4);
  key.position.set(-4.5, 4.8, 3.2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4, near: 1, far: 20 });
  scene.add(key);
  const rim = new THREE.DirectionalLight('#dfe8ff', 0.8);
  rim.position.set(4, 3, -2);
  scene.add(rim);

  // Kamera
  const base = new THREE.Vector3();
  const tgt = new THREE.Vector3();
  stage.onResize(() => {
    const m = stage.size.mobile;
    camera.fov = m ? 46 : 34;
    camera.updateProjectionMatrix();
    if (m) {
      base.set(0.1, 1.7, 5.6);
      tgt.set(0.1, 0.85, 0.3);
    } else {
      base.set(-1.55, 1.55, 5.3);
      tgt.set(-1.0, 1.08, 0.25);
    }
    key.shadow.mapSize.setScalar(m ? 1024 : 2048);
  });

  let p = 0;
  const m4 = new THREE.Matrix4();
  const one = new THREE.Vector3(1, 1, 1);
  const zero = new THREE.Vector3(0, 0, 0);
  const q = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  const e = new THREE.Euler();

  stage.onFrame((t) => {
    const n = frames.length;
    frames.forEach((f, k) => {
      if (k === n - 1) {
        f.rotation.y = (36 + 3.5 * k - 90) * DEG;
        return;
      }
      const flip = opts.reduced ? (k < 1 ? 1 : 0) : easeInOut(range(p, k + 0.15, k + 0.75));
      const right = 36 + 3.5 * k;
      const left = -36 - 3.5 * (n - 2 - k);
      // beim Umblättern leicht anheben: Seite „schwebt“
      const phi = lerp(right, left, flip);
      f.rotation.y = (phi - 90) * DEG;
      f.position.y = k * 0.0006 + Math.sin(flip * Math.PI) * 0.03;
    });

    // Letzte Seite: Fliese für Fliese
    const lay = opts.reduced ? 1 : range(p, 3.7, 4.25);
    layTiles.cells.forEach((c, i) => {
      const k = easeOut(clamp01((lay - c.d * 0.85) / 0.15));
      pos.set(c.x, c.y, (1 - k) * 0.12);
      e.set((1 - k) * -0.6, 0, 0);
      q.setFromEuler(e);
      m4.compose(pos, q, k > 0.001 ? one : zero);
      layTiles.mesh.setMatrixAt(i, m4);
    });
    layTiles.mesh.instanceMatrix.needsUpdate = true;

    // Kamera: leichte Fahrt mit dem Blättern
    camera.position.copy(base);
    camera.position.x += Math.sin(p * 0.6) * 0.12 + Math.sin(t * 0.2) * 0.03;
    camera.position.y += Math.cos(t * 0.17) * 0.015;
    camera.lookAt(tgt);
  });

  if (opts.reduced) stage.onResize(() => stage.renderOnce());
  else stage.prepare();

  return {
    setProgress(v: number) {
      p = v;
    },
  };
}
