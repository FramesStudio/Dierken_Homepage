/**
 * Raumreise: Ein Luxusbad entsteht – vollständig im Code.
 * 01 Rohbau im Abendlicht · 02 Linienlaser & Aufmaß · 03 XXL-Muster · 04 Wand (raumhohe Travertin-Platten)
 * 05 Boden · 06 Einrichtung · 07 Licht & Stimmung · 08 Makro auf die Fuge
 * Alle Zustände werden aus p (0…1, Scroll) berechnet.
 *
 * Performance: ein einziger Render-Durchgang ohne Postprocessing. Leuchten (Laser, LED, Halo, Kerzen)
 * entsteht über additive Glow-Flächen, der Spiegel über eine Cube-Map, die nur bei Änderungen
 * Seite für Seite neu gerendert wird, die Schattenkarte nur wenn sich die Szene bewegt.
 * Alle Shader – auch die Varianten für die Cube-Map – werden vor dem Start im Hintergrund kompiliert.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { createStage, clamp01, lerp, easeInOut, easeOut, range } from './engine';
import { tileMaterial, addTileAttributes } from './materials';
import { RANGES } from './support';
export { RANGES };

// ---------- Maße (Meter) ----------
const X0 = -2.1, X1 = 2.1, Z0 = -1.8, Z1 = 1.8, H = 2.9;
const WIN = { z0: -1.15, z1: 0.45, y0: 0.25, y1: 2.65 };
const SAND = '#d9c4a4';
const SAND_FLOOR = '#c3a982';
const SLAB_W = (X1 - X0) / 4; // 1,05 m – raumhoch
const JOINT = 0.002;
const PRE = 0.12; // Vorwand Dusche
const NICHE = { z0: -1.38, z1: -0.58, y0: 1.02, y1: 1.32 };

/** Weicher Verlauf als Textur für Glow-Flächen: radial (Punkt), Ring oder quer zu einer Linie */
function glowTexture(kind: 'dot' | 'ring' | 'line' | 'wash'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = kind === 'line' || kind === 'wash' ? 4 : 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  const stops: [number, number][] =
    kind === 'dot' ? [[0, 1], [0.2, 0.55], [0.5, 0.12], [1, 0]]
    : kind === 'ring' ? [[0, 0], [0.5, 0], [0.6, 0.85], [0.66, 0.5], [0.8, 0.12], [1, 0]]
    : kind === 'line' ? [[0, 0], [0.35, 0.12], [0.5, 1], [0.65, 0.12], [1, 0]]
    : [[0, 1], [0.25, 0.4], [1, 0]];
  const grd = kind === 'dot' || kind === 'ring' ? g.createRadialGradient(64, 64, 0, 64, 64, 64) : g.createLinearGradient(0, 0, 0, 128);
  for (const [o, a] of stops) grd.addColorStop(o, `rgba(255,255,255,${a})`);
  g.fillStyle = grd;
  g.fillRect(0, 0, c.width, c.height);
  return new THREE.CanvasTexture(c);
}
const glowMat = (map: THREE.Texture, color: THREE.ColorRepresentation) =>
  new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });

// Kamerapfad [p, Position, Ziel]
const CAM: [number, [number, number, number], [number, number, number]][] = [
  [0.0, [1.95, 1.55, 4.7], [-0.6, 1.2, -0.7]],
  [0.1, [1.6, 1.5, 3.95], [-0.45, 1.15, -0.9]],
  [0.22, [0.85, 1.35, 3.1], [0.0, 1.0, -1.1]],
  [0.33, [0.25, 1.28, 3.15], [0.0, 0.95, 0.35]],
  [0.48, [1.85, 1.65, 3.6], [-0.3, 1.35, -1.2]],
  [0.58, [1.7, 2.25, 3.05], [-0.4, 0.2, -0.7]],
  [0.7, [1.85, 1.45, 3.4], [-0.5, 1.0, -0.8]],
  [0.85, [1.7, 1.32, 3.05], [-0.55, 0.98, -0.95]],
  [0.98, [-0.5, 1.24, Z0 + 0.2], [-1.15, 1.34, Z0 + 0.005]],
];

export interface RoomHandle {
  setProgress: (p: number) => void;
  labels: () => { x: number; y: number; o: number }[];
}

export function initRoom(canvas: HTMLCanvasElement, opts: { observe?: Element; staticP?: number }): RoomHandle {
  RectAreaLightUniformsLib.init();
  const stage = createStage(canvas, { fov: 40, shadows: true, envIntensity: 0.35, observe: opts.observe });
  const { scene, camera, renderer } = stage;
  // Schattenkarte nur neu rechnen, wenn sich etwas bewegt (siehe update)
  renderer.shadowMap.autoUpdate = false;
  let shadowP = -1;
  const hq = !stage.size.mobile && innerWidth > 900;
  scene.background = new THREE.Color('#15110d');
  renderer.toneMappingExposure = 1.0;
  let p = opts.staticP ?? 0;

  // ---------- Materialien ----------
  const raw = tileMaterial({ kind: 'clay', base: '#a9a49c', plane: 0 });
  const rawSide = tileMaterial({ kind: 'clay', base: '#a29d95', plane: 2 });
  const screed = tileMaterial({ kind: 'concrete', plane: 1 });
  const ceilingMat = tileMaterial({ kind: 'clay', base: '#ece6dc', plane: 1 });
  const travWall = tileMaterial({ kind: 'travertine', base: SAND, plane: 0, instanced: true, tile: [SLAB_W, H], clearcoat: 0 });
  const travSide = tileMaterial({ kind: 'travertine', base: SAND, plane: 2, clearcoat: 0 });
  const travTop = tileMaterial({ kind: 'travertine', base: SAND, plane: 1, clearcoat: 0 });
  const travFloor = tileMaterial({ kind: 'travertine', base: SAND_FLOOR, plane: 1, instanced: true, tile: [SLAB_W, 1.2], clearcoat: 0 });
  const fluted = tileMaterial({ kind: 'fluted', base: '#dccab0', plane: 2, bump: 0.012 });
  const walnut = tileMaterial({ kind: 'wood', base: '#8a6a52', plane: 0 });
  const mineral = tileMaterial({ kind: 'mineral', base: '#f1ece4', plane: 0, clearcoat: 0 });
  const brass = new THREE.MeshStandardMaterial({ color: '#c7a26b', metalness: 1, roughness: 0.28 });
  const black = new THREE.MeshStandardMaterial({ color: '#16161a', metalness: 0.6, roughness: 0.4 });

  const add = (m: THREE.Object3D, parent: THREE.Object3D = scene) => {
    m.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    parent.add(m);
    return m;
  };
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material, parent?: THREE.Object3D) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z);
    return add(mesh, parent) as THREE.Mesh;
  };

  // ---------- Rohbau ----------
  box(X1 - X0 + 0.4, 0.1, Z1 - Z0 + 0.4, 0, -0.05, 0, screed);
  box(X1 - X0 + 0.4, H, 0.2, 0, H / 2, Z0 - 0.1, raw);
  box(0.2, H, Z1 - Z0 + 0.2, X1 + 0.1, H / 2, 0, rawSide);
  // linke Wand mit Fensteröffnung
  box(0.2, H, WIN.z0 - Z0, X0 - 0.1, H / 2, (Z0 + WIN.z0) / 2, rawSide);
  box(0.2, H, Z1 + 0.2 - WIN.z1, X0 - 0.1, H / 2, (WIN.z1 + Z1 + 0.2) / 2, rawSide);
  box(0.2, WIN.y0, WIN.z1 - WIN.z0, X0 - 0.1, WIN.y0 / 2, (WIN.z0 + WIN.z1) / 2, rawSide);
  box(0.2, H - WIN.y1, WIN.z1 - WIN.z0, X0 - 0.1, (WIN.y1 + H) / 2, (WIN.z0 + WIN.z1) / 2, rawSide);
  // Fensterrahmen (schmal, schwarz) und Glas
  const frame = new THREE.Group();
  box(0.05, WIN.y1 - WIN.y0, 0.035, X0 - 0.06, (WIN.y0 + WIN.y1) / 2, WIN.z0 + 0.018, black, frame);
  box(0.05, WIN.y1 - WIN.y0, 0.035, X0 - 0.06, (WIN.y0 + WIN.y1) / 2, WIN.z1 - 0.018, black, frame);
  box(0.05, 0.035, WIN.z1 - WIN.z0, X0 - 0.06, WIN.y0 + 0.018, (WIN.z0 + WIN.z1) / 2, black, frame);
  box(0.05, 0.035, WIN.z1 - WIN.z0, X0 - 0.06, WIN.y1 - 0.018, (WIN.z0 + WIN.z1) / 2, black, frame);
  box(0.05, WIN.y1 - WIN.y0, 0.025, X0 - 0.06, (WIN.y0 + WIN.y1) / 2, (WIN.z0 + WIN.z1) / 2, black, frame);
  scene.add(frame);
  // Decke mit Einbauleuchten
  box(X1 - X0 + 0.4, 0.1, Z1 - Z0 + 0.4, 0, H + 0.05, 0, ceilingMat);

  // Himmel vor dem Fenster (Abendlicht)
  {
    const g = new THREE.PlaneGeometry(9, 6, 1, 24);
    const pa = g.getAttribute('position');
    const cols: number[] = [];
    for (let i = 0; i < pa.count; i++) {
      const k = (pa.getY(i) + 3) / 6;
      const c = new THREE.Color('#ffd9a8').lerp(new THREE.Color('#f2b47c'), clamp01(1 - k * 2.2)).lerp(new THREE.Color('#8fa9c8'), clamp01((k - 0.45) * 1.6));
      cols.push(c.r * 1.6, c.g * 1.6, c.b * 1.6);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const sky = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: true }));
    sky.rotation.y = Math.PI / 2;
    sky.position.set(X0 - 3.5, 1.4, -0.3);
    scene.add(sky);
  }

  // ---------- Lichtstrahl & Staub ----------
  const sunDir = new THREE.Vector3(6.6, -3.1, -0.9).normalize();
  let beam: THREE.Mesh;
  const beamMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uI: { value: 0.0 }, uT: { value: 0 } },
    vertexShader: `varying vec3 vP; varying float vA; attribute float aAlong;
      void main(){ vP = position; vA = aAlong; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform float uI; uniform float uT; varying vec3 vP; varying float vA;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
      void main(){
        float fade = pow(1.0 - vA, 1.4) * smoothstep(0.0, 0.08, vA);
        float streak = 0.75 + 0.25 * n(vec2(vP.y * 6.0 + vP.z * 4.0, uT * 0.05));
        gl_FragColor = vec4(vec3(1.0, 0.78, 0.52) * uI * fade * streak, 1.0);
      }`,
  });
  {
    const L = 5.2;
    const corners = [
      [X0, WIN.y0, WIN.z0], [X0, WIN.y0, WIN.z1], [X0, WIN.y1, WIN.z1], [X0, WIN.y1, WIN.z0],
    ].map((c) => new THREE.Vector3(...(c as [number, number, number])));
    const pos: number[] = [];
    const along: number[] = [];
    const quad = (a: THREE.Vector3, b: THREE.Vector3) => {
      const a2 = a.clone().addScaledVector(sunDir, L);
      const b2 = b.clone().addScaledVector(sunDir, L);
      for (const [v, t] of [[a, 0], [b, 0], [b2, 1], [a, 0], [b2, 1], [a2, 1]] as [THREE.Vector3, number][]) {
        pos.push(v.x, v.y, v.z);
        along.push(t);
      }
    };
    for (let i = 0; i < 4; i++) quad(corners[i], corners[(i + 1) % 4]);
    // zusätzliche Mittelebenen für Volumen
    for (const f of [0.33, 0.66]) {
      const a = new THREE.Vector3(X0, WIN.y0, lerp(WIN.z0, WIN.z1, f));
      const b = new THREE.Vector3(X0, WIN.y1, lerp(WIN.z0, WIN.z1, f));
      quad(a, b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
    beam = new THREE.Mesh(g, beamMat);
    beam.renderOrder = 10;
    scene.add(beam);
  }
  const dustN = hq ? 900 : 400;
  const dustGeo = new THREE.BufferGeometry();
  {
    const pts: number[] = [];
    const seeds: number[] = [];
    for (let i = 0; i < dustN; i++) {
      const t = Math.random() * 4.2;
      const base = new THREE.Vector3(X0, lerp(WIN.y0, WIN.y1, Math.random()), lerp(WIN.z0, WIN.z1, Math.random()));
      base.addScaledVector(sunDir, t);
      pts.push(base.x, base.y, base.z);
      seeds.push(Math.random());
    }
    dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    dustGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  }
  const dustMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uI: { value: 0 }, uScale: { value: 1 } },
    vertexShader: `attribute float aSeed; uniform float uT; uniform float uScale; varying float vS;
      void main(){ vS = aSeed; vec3 p = position;
        p.x += sin(uT * 0.15 + aSeed * 40.0) * 0.08; p.y += sin(uT * 0.11 + aSeed * 17.0) * 0.06 - mod(uT * 0.01 + aSeed, 1.0) * 0.05; p.z += cos(uT * 0.13 + aSeed * 23.0) * 0.08;
        vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = max(1.0, (1.0 + aSeed * 2.5) * uScale / -mv.z); }`,
    fragmentShader: `uniform float uI; varying float vS;
      void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(1.0, 0.86, 0.66) * a * uI * (0.4 + vS), 1.0); }`,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.renderOrder = 11;
  scene.add(dust);

  // ---------- Baustelle (Rohbau) ----------
  const site = new THREE.Group();
  {
    const card = new THREE.MeshStandardMaterial({ color: '#a9845a', roughness: 0.92 });
    const stackAt = (x: number, z: number, n: number, rot: number) => {
      for (let i = 0; i < n; i++) {
        const b = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.09, 0.32, 2, 0.006), card);
        b.position.set(x + (Math.random() - 0.5) * 0.02, 0.045 + i * 0.09, z + (Math.random() - 0.5) * 0.02);
        b.rotation.y = rot + (Math.random() - 0.5) * 0.06;
        site.add(b);
      }
    };
    stackAt(1.35, -1.35, 5, 0.1);
    stackAt(1.35, -0.95, 3, -0.05);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.14, 0.34, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#e9e5dc', roughness: 0.55, side: THREE.DoubleSide }));
    bucket.position.set(0.65, 0.17, -1.25);
    const mortar = new THREE.Mesh(new THREE.CircleGeometry(0.15, 32), new THREE.MeshStandardMaterial({ color: '#8f8b84', roughness: 1 }));
    mortar.rotation.x = -Math.PI / 2;
    mortar.position.set(0.65, 0.28, -1.25);
    const paddle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.75, 8), black);
    paddle.position.set(0.68, 0.55, -1.22);
    paddle.rotation.z = -0.25;
    site.add(bucket, mortar, paddle);
    // Plattenbock mit angelehnten XXL-Platten
    const rack = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.3, 0.05), new THREE.MeshStandardMaterial({ color: '#2b5aa6', roughness: 0.5, metalness: 0.3 }));
    rack.position.set(-0.2, 0.62, -1.62);
    rack.rotation.x = -0.18;
    site.add(rack);
    for (let i = 0; i < 3; i++) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.012), i === 2 ? tileMaterial({ kind: 'travertine', base: SAND, plane: 0, clearcoat: 0 }) : new THREE.MeshStandardMaterial({ color: '#d8d3ca', roughness: 0.9 }));
      slab.position.set(-0.2 + (i - 1) * 0.04, 0.8, -1.5 + i * 0.03);
      slab.rotation.x = -0.18;
      site.add(slab);
    }
  }
  add(site);

  // ---------- Linienlaser (Planung) ----------
  const laserMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#38ff6a').multiplyScalar(3), toneMapped: false, transparent: true });
  const laserGlowMat = glowMat(glowTexture('line'), '#38ff6a');
  const laserLines: { mesh: THREE.Mesh; glow: THREE.Mesh; axis: 'x' | 'y' | 'z'; d: number }[] = [];
  /** Linie + Lichtschein auf der Fläche, auf die sie fällt (Rotation legt die Glow-Fläche dorthin) */
  const laser = (w: number, h: number, d: number, x: number, y: number, z: number, axis: 'x' | 'y' | 'z', delay: number, rot: [number, number, number]) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), laserMat);
    m.position.set(x, y, z);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(w, h, d), 0.07), laserGlowMat);
    glow.position.set(x, y, z);
    glow.rotation.set(...rot);
    glow.renderOrder = 12;
    scene.add(m, glow);
    laserLines.push({ mesh: m, glow, axis, d: delay });
  };
  const LY = 1.0;
  const T = 0.004;
  laser(X1 - X0, T, T, 0, LY, Z0 + 0.004, 'x', 0.1, [0, 0, 0]);
  laser(T, T, Z1 - Z0, X0 + 0.004, LY, 0, 'z', 0.2, [0, Math.PI / 2, 0]);
  laser(T, T, Z1 - Z0, X1 - 0.004, LY, 0, 'z', 0.2, [0, -Math.PI / 2, 0]);
  laser(T, H, T, 0, H / 2, Z0 + 0.004, 'y', 0.35, [0, 0, Math.PI / 2]);
  laser(T, T, Z1 - Z0, 0, 0.004, 0, 'z', 0.45, [-Math.PI / 2, 0, Math.PI / 2]);
  // Gerät auf Stativ
  const tripod = new THREE.Group();
  {
    const leg = new THREE.CylinderGeometry(0.008, 0.008, 1.0, 8);
    for (let i = 0; i < 3; i++) {
      const l = new THREE.Mesh(leg, black);
      const a = (i / 3) * Math.PI * 2;
      l.position.set(Math.cos(a) * 0.16, 0.48, Math.sin(a) * 0.16);
      l.rotation.set(Math.sin(a) * 0.32, 0, -Math.cos(a) * 0.32);
      tripod.add(l);
    }
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.11, 0.13, 0.11, 2, 0.015), new THREE.MeshStandardMaterial({ color: '#e7c42b', roughness: 0.45 }));
    body.position.y = LY;
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), laserMat);
    lens.position.set(0, LY, -0.056);
    tripod.add(body, lens);
    tripod.position.set(0, 0, 0.7);
    add(tripod);
  }
  const labelAnchors = [
    new THREE.Vector3(-1.3, LY + 0.06, Z0),
    new THREE.Vector3(0.6, 0.06, Z0 + 0.05),
    new THREE.Vector3(0.12, 2.2, Z0),
  ];

  // ---------- XXL-Muster ----------
  const sampleGeo = new RoundedBoxGeometry(0.6, 1.2, 0.02, 3, 0.004);
  addTileAttributes(sampleGeo, new Float32Array(3), new Float32Array([0.41]));
  const sampleDefs = [
    { m: tileMaterial({ kind: 'marble', plane: 0, instanced: true, tile: [0.6, 1.2] }), x: -0.72 },
    { m: tileMaterial({ kind: 'travertine', base: SAND, plane: 0, instanced: true, tile: [0.6, 1.2], clearcoat: 0 }), x: 0 },
    { m: tileMaterial({ kind: 'fluted', base: '#dccab0', plane: 0, instanced: true, tile: [0.6, 1.2], bump: 0.012 }), x: 0.72 },
  ];
  const samples = sampleDefs.map((d) => {
    const mesh = new THREE.InstancedMesh(sampleGeo, d.m, 1);
    mesh.setMatrixAt(0, new THREE.Matrix4());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return { mesh, x: d.x };
  });

  // ---------- Wand: raumhohe Travertin-Platten ----------
  const wallGeo = new RoundedBoxGeometry(SLAB_W - JOINT, H - JOINT, 0.014, 2, 0.002);
  const wallRest = new Float32Array(4 * 3);
  const wallSeed = new Float32Array(4).map(() => Math.random());
  for (let i = 0; i < 4; i++) wallRest.set([X0 + SLAB_W / 2 + i * SLAB_W, H / 2, Z0 + 0.007], i * 3);
  addTileAttributes(wallGeo, wallRest, wallSeed);
  const wallSlabs = new THREE.InstancedMesh(wallGeo, travWall, 4);
  wallSlabs.castShadow = true;
  wallSlabs.receiveShadow = true;
  wallSlabs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(wallSlabs);

  // Vorwand Dusche mit Nische (rechts)
  const preWall = new THREE.Group();
  {
    const x = X1 - PRE / 2;
    const zA = Z0, zB = 0.3;
    box(PRE, NICHE.y0, zB - zA, x, NICHE.y0 / 2, (zA + zB) / 2, travSide, preWall);
    box(PRE, H - NICHE.y1, zB - zA, x, (NICHE.y1 + H) / 2, (zA + zB) / 2, travSide, preWall);
    box(PRE, NICHE.y1 - NICHE.y0, NICHE.z0 - zA, x, (NICHE.y0 + NICHE.y1) / 2, (zA + NICHE.z0) / 2, travSide, preWall);
    box(PRE, NICHE.y1 - NICHE.y0, zB - NICHE.z1, x, (NICHE.y0 + NICHE.y1) / 2, (NICHE.z1 + zB) / 2, travSide, preWall);
    box(0.02, NICHE.y1 - NICHE.y0, NICHE.z1 - NICHE.z0, X1 - 0.01, (NICHE.y0 + NICHE.y1) / 2, (NICHE.z0 + NICHE.z1) / 2, travSide, preWall);
  }
  const ledMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd7a0'), toneMapped: false });
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, NICHE.z1 - NICHE.z0 - 0.02), ledMat);
  led.position.set(X1 - PRE + 0.03, NICHE.y1 - 0.008, (NICHE.z0 + NICHE.z1) / 2);
  preWall.add(led);
  // Licht liegt direkt in der Szene: Lichter in ausgeblendeten Gruppen ändern die Lichtanzahl
  // und würden alle Shader neu kompilieren
  const nicheLight = new THREE.PointLight('#ffcf94', 0, 1.1, 2);
  nicheLight.position.set(X1 - PRE - 0.02, NICHE.y1 - 0.05, (NICHE.z0 + NICHE.z1) / 2);
  scene.add(nicheLight);
  // Lichtschein der LED auf der Nischenrückwand (oben hell, nach unten auslaufend)
  const nicheWash = new THREE.Mesh(new THREE.PlaneGeometry(NICHE.z1 - NICHE.z0 - 0.01, NICHE.y1 - NICHE.y0), glowMat(glowTexture('wash'), '#ffcf94'));
  nicheWash.position.set(X1 - 0.0215, (NICHE.y0 + NICHE.y1) / 2, (NICHE.z0 + NICHE.z1) / 2);
  nicheWash.rotation.y = -Math.PI / 2;
  preWall.add(nicheWash);
  scene.add(preWall);

  // Rillenpaneele links neben dem Fenster
  const flutes = new THREE.Group();
  box(0.03, H, WIN.z0 - Z0, X0 + 0.015, H / 2, (Z0 + WIN.z0) / 2, fluted, flutes);
  box(0.03, H, Z1 - WIN.z1, X0 + 0.015, H / 2, (WIN.z1 + Z1) / 2, fluted, flutes);
  box(0.03, WIN.y0, WIN.z1 - WIN.z0, X0 + 0.015, WIN.y0 / 2, (WIN.z0 + WIN.z1) / 2, fluted, flutes);
  box(0.03, H - WIN.y1, WIN.z1 - WIN.z0, X0 + 0.015, (WIN.y1 + H) / 2, (WIN.z0 + WIN.z1) / 2, fluted, flutes);
  scene.add(flutes);

  // ---------- Boden: XXL-Platten ----------
  const FW = SLAB_W, FD = 1.2;
  const nx = 4, nz = 3;
  const floorGeo = new RoundedBoxGeometry(FW - JOINT, 0.014, FD - JOINT, 2, 0.002);
  const floorRest = new Float32Array(nx * nz * 3);
  const floorSeed = new Float32Array(nx * nz).map(() => Math.random());
  const floorData: { x: number; z: number; d: number }[] = [];
  for (let r = 0; r < nz; r++)
    for (let c = 0; c < nx; c++) {
      const i = r * nx + c;
      const x = X0 + FW / 2 + c * FW;
      const z = Z0 + FD / 2 + r * FD;
      floorRest.set([x, 0.007, z], i * 3);
      floorData.push({ x, z, d: (c + r) / (nx + nz - 2) });
    }
  addTileAttributes(floorGeo, floorRest, floorSeed);
  const floorSlabs = new THREE.InstancedMesh(floorGeo, travFloor, nx * nz);
  floorSlabs.receiveShadow = true;
  floorSlabs.castShadow = true;
  floorSlabs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(floorSlabs);
  // Duschrinne
  const drain = box(0.06, 0.004, 1.7, X1 - PRE - 0.12, 0.016, -0.75, brass);

  // ---------- Einrichtung ----------
  const furniture: { obj: THREE.Object3D; delay: number; base: THREE.Vector3; from: THREE.Vector3; s: THREE.Vector3 }[] = [];
  const addF = (obj: THREE.Object3D, delay: number, from = new THREE.Vector3(0, -0.15, 0)) => {
    add(obj);
    furniture.push({ obj, delay, base: obj.position.clone(), from, s: obj.scale.clone() });
  };

  // Freistehende Wanne (Mineralguss) mit Wasser
  const tub = new THREE.Group();
  {
    const prof = [
      [0.0, 0.0], [0.8, 0.0], [0.9, 0.03], [0.96, 0.2], [0.995, 0.48], [1.0, 0.56], [0.985, 0.585], [0.94, 0.585],
      [0.925, 0.55], [0.88, 0.25], [0.78, 0.12], [0.0, 0.1],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    const shell = new THREE.Mesh(new THREE.LatheGeometry(prof, 96), mineral);
    tub.add(shell);
    const water = new THREE.Mesh(
      new THREE.CircleGeometry(0.93, 64),
      new THREE.MeshStandardMaterial({ color: '#b9c6c4', roughness: 0.02, metalness: 0, transparent: true, opacity: 0.82 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.44;
    tub.add(water);
    tub.scale.set(0.42, 1, 0.88);
    tub.position.set(-1.05, 0.014, -0.3);
  }
  addF(tub, 0.0);
  // Standarmatur mit Schwanenhals
  const filler = new THREE.Group();
  {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.75, 0), new THREE.Vector3(0, 0.98, 0), new THREE.Vector3(0.08, 1.04, 0), new THREE.Vector3(0.2, 0.98, 0), new THREE.Vector3(0.23, 0.9, 0),
    ]);
    filler.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 64, 0.013, 16), brass));
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.02, 32), brass);
    base.position.y = 0.01;
    filler.add(base);
    filler.position.set(-0.5, 0.014, -0.95);
    filler.rotation.y = Math.PI * 0.62;
  }
  addF(filler, 0.12);
  // Schwebender Waschtisch (Nussbaum, Travertin-Platte, Aufsatzbecken)
  const vanity = new THREE.Group();
  {
    const cab = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.34, 0.48, 3, 0.01), walnut);
    cab.position.set(0, 0.62, 0);
    const top = new THREE.Mesh(new RoundedBoxGeometry(1.46, 0.04, 0.52, 2, 0.006), travTop);
    top.position.set(0, 0.81, 0.01);
    const bowlProf = [[0, 0], [0.16, 0], [0.2, 0.03], [0.215, 0.13], [0.2, 0.135], [0.185, 0.04], [0.0, 0.03]].map(([x, y]) => new THREE.Vector2(x, y));
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlProf, 64), mineral);
    bowl.position.set(0.18, 0.83, 0.03);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.2, 16), brass);
    spout.rotation.x = Math.PI / 2;
    spout.position.set(0.18, 1.1, -0.14);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.01, 32), brass);
    plate.rotation.x = Math.PI / 2;
    plate.position.set(0.18, 1.1, -0.235);
    vanity.add(cab, top, bowl, spout, plate);
    vanity.position.set(0.05, 0, Z0 + 0.255);
  }
  addF(vanity, 0.08, new THREE.Vector3(0, 0, 0.25));
  // Spiegel mit warmem Hinterlicht
  const mirror = new THREE.Group();
  const halo = new THREE.Mesh(new THREE.RingGeometry(0.36, 0.47, 96), new THREE.MeshBasicMaterial({ color: '#ffcf96', toneMapped: false, transparent: true, opacity: 0 }));
  halo.position.z = 0.012;
  const haloGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), glowMat(glowTexture('ring'), '#ffc68a'));
  haloGlow.position.z = 0.006;
  mirror.add(halo, haloGlow);
  const cubeRT = new THREE.WebGLCubeRenderTarget(hq ? 256 : 128, { type: THREE.HalfFloatType, generateMipmaps: false });
  const cubeCam = new THREE.CubeCamera(0.05, 12, cubeRT);
  scene.add(cubeCam);
  // polierter Spiegel: direkte Cube-Map-Abfrage (kein PMREM nötig, keine Vorfilterung beim Aktualisieren)
  const glass = new THREE.Mesh(
    new THREE.CircleGeometry(0.4, 96),
    new THREE.ShaderMaterial({
      uniforms: { uEnv: { value: cubeRT.texture }, uTint: { value: new THREE.Color('#c9c4bc') } },
      vertexShader: `varying vec3 vW; varying vec3 vN;
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform samplerCube uEnv; uniform vec3 uTint; varying vec3 vW; varying vec3 vN;
        void main(){ vec3 r = reflect(normalize(vW - cameraPosition), normalize(vN));
          gl_FragColor = vec4(textureCube(uEnv, r).rgb * uTint, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  glass.position.z = 0.035;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.03, 96), black);
  disc.rotation.x = Math.PI / 2;
  disc.position.z = 0.018;
  mirror.add(disc, glass);
  mirror.position.set(0.05, 1.72, Z0 + 0.014);
  addF(mirror, 0.22, new THREE.Vector3(0, 0, 0.2));
  // Glasduschwand mit Messingprofil, Regendusche
  const shower = new THREE.Group();
  {
    const glassMat = new THREE.MeshStandardMaterial({ color: '#e4ecea', roughness: 0.04, transparent: true, opacity: 0.16, depthWrite: false });
    const pane = new THREE.Mesh(new THREE.BoxGeometry(0.008, 2.05, 1.3), glassMat);
    pane.position.set(0.95, 1.04, Z0 + 0.66);
    pane.castShadow = false;
    shower.add(pane);
    const prof = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 1.3), brass);
    prof.position.set(0.95, 2.07, Z0 + 0.66);
    const wallProf = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.07, 0.02), brass);
    wallProf.position.set(0.95, 1.04, Z0 + 0.024);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 16), brass);
    arm.rotation.z = Math.PI / 2;
    arm.position.set(X1 - PRE - 0.21, 2.5, -1.0);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.012, 64), brass);
    head.position.set(X1 - PRE - 0.42, 2.49, -1.0);
    const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.02, 48), brass);
    valve.rotation.z = Math.PI / 2;
    valve.position.set(X1 - PRE - 0.01, 1.15, -0.2);
    shower.add(prof, wallProf, arm, head, valve);
  }
  addF(shower, 0.3, new THREE.Vector3(0, 0.25, 0));
  // Olivenbaum im Steintopf (Vordergrund)
  const tree = new THREE.Group();
  {
    const potProf = [[0, 0], [0.2, 0], [0.26, 0.08], [0.28, 0.42], [0.25, 0.44], [0.24, 0.4], [0, 0.38]].map(([x, y]) => new THREE.Vector2(x, y));
    tree.add(new THREE.Mesh(new THREE.LatheGeometry(potProf, 48), tileMaterial({ kind: 'mineral', base: '#b5a792', plane: 0 })));
    const bark = new THREE.MeshStandardMaterial({ color: '#5d5146', roughness: 0.9 });
    const tips: THREE.Vector3[] = [];
    const branch = (pts: [number, number, number][]) => {
      const c = new THREE.CatmullRomCurve3(pts.map((q) => new THREE.Vector3(...q)));
      tree.add(new THREE.Mesh(new THREE.TubeGeometry(c, 24, 0.018, 8), bark));
      tips.push(new THREE.Vector3(...pts[pts.length - 1]));
    };
    branch([[0, 0.38, 0], [0.02, 0.9, 0.01], [-0.05, 1.3, 0.04], [-0.18, 1.6, 0.02]]);
    branch([[0.02, 0.9, 0.01], [0.12, 1.2, -0.02], [0.24, 1.5, 0.05]]);
    branch([[-0.02, 1.15, 0.03], [-0.04, 1.45, -0.12], [0.02, 1.78, -0.1]]);
    const leafGeo = new THREE.SphereGeometry(0.026, 8, 4);
    leafGeo.scale(1, 0.12, 0.22);
    const leaves = new THREE.InstancedMesh(leafGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.55, side: THREE.DoubleSide }), 1400);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    for (let i = 0; i < 1400; i++) {
      const tip = tips[i % tips.length];
      const v = new THREE.Vector3().randomDirection().multiplyScalar(Math.cbrt(Math.random()) * 0.32);
      v.y *= 0.8;
      q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3));
      m4.compose(tip.clone().add(v), q, new THREE.Vector3(1, 1, 1).multiplyScalar(0.8 + Math.random() * 0.6));
      leaves.setMatrixAt(i, m4);
      leaves.setColorAt(i, col.set(['#5c6a4b', '#6d7a5a', '#8f9a80', '#a7b19a'][Math.floor(Math.random() * 4)]));
    }
    leaves.castShadow = true;
    tree.add(leaves);
    tree.position.set(1.72, 0.014, 1.15);
  }
  addF(tree, 0.4);
  // Hocker mit Handtüchern und Kerzen
  const stool = new THREE.Group();
  const flameMat = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffb35c').multiplyScalar(2.5), toneMapped: false });
  const flameGlow = new THREE.SpriteMaterial({ map: glowTexture('dot'), color: '#ffa552', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const flameSprites: THREE.Sprite[] = [];
  {
    const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.42, 48), walnut);
    seat.position.y = 0.21;
    const cloth = new THREE.MeshStandardMaterial({ color: '#efe8dd', roughness: 0.97 });
    const t1 = new THREE.Mesh(new RoundedBoxGeometry(0.3, 0.05, 0.22, 3, 0.022), cloth);
    t1.position.y = 0.445;
    const t2 = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.05, 0.2, 3, 0.022), new THREE.MeshStandardMaterial({ color: '#cdbfa9', roughness: 0.97 }));
    t2.position.set(0.01, 0.495, 0);
    t2.rotation.y = 0.12;
    stool.add(seat, t1, t2);
    for (const [cx, cz, ch] of [[0.11, 0.08, 0.11], [0.15, -0.02, 0.07]] as [number, number, number][]) {
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, ch, 24), new THREE.MeshStandardMaterial({ color: '#f3ede2', roughness: 0.6 }));
      candle.position.set(cx - 0.06, 0.52 + ch / 2, cz);
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 8), flameMat);
      flame.scale.set(1, 2.2, 1);
      flame.position.set(cx - 0.06, 0.52 + ch + 0.016, cz);
      const sprite = new THREE.Sprite(flameGlow);
      sprite.position.copy(flame.position);
      sprite.scale.setScalar(0.12);
      flameSprites.push(sprite);
      stool.add(candle, flame, sprite);
    }
    stool.position.set(-1.55, 0.014, 0.8);
  }
  addF(stool, 0.5);

  // ---------- Licht ----------
  const hemi = new THREE.HemisphereLight('#c9d4e4', '#7d6b57', 0.18);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffcd94', 4);
  sun.position.copy(new THREE.Vector3(-0.2, 0.2, -0.4).addScaledVector(sunDir, -10));
  sun.target.position.set(-0.2, 0.2, -0.4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(hq ? 2048 : 1024, hq ? 2048 : 1024);
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.015;
  sun.shadow.radius = 4;
  Object.assign(sun.shadow.camera, { left: -5.5, right: 5.5, top: 5.5, bottom: -5.5, near: 1, far: 24 });
  scene.add(sun, sun.target);
  const windowLight = new THREE.RectAreaLight('#ffdcb4', 2, WIN.z1 - WIN.z0, WIN.y1 - WIN.y0);
  windowLight.position.set(X0 + 0.02, (WIN.y0 + WIN.y1) / 2, (WIN.z0 + WIN.z1) / 2);
  windowLight.lookAt(0, (WIN.y0 + WIN.y1) / 2, (WIN.z0 + WIN.z1) / 2);
  scene.add(windowLight);
  // Wandfluter: streifen über die Travertin-Wand
  const washers: THREE.SpotLight[] = [];
  for (const wx of [-1.3, 1.25]) {
    const s = new THREE.SpotLight('#ffd6a0', 0, 5, 0.55, 0.95, 1.6);
    s.position.set(wx, H - 0.06, Z0 + 0.32);
    s.target.position.set(wx, 0.3, Z0 + 0.02);
    scene.add(s, s.target);
    washers.push(s);
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 24), new THREE.MeshBasicMaterial({ color: '#2a2622' }));
    can.position.set(wx, H - 0.004, Z0 + 0.32);
    scene.add(can);
  }

  // ---------- Rendern ----------
  // Spiegel: nach einer Änderung werden die sechs Cube-Seiten auf sechs Bilder verteilt neu gerendert
  let cubeFaces = 0;
  let cubeP = -1;
  let cubeT = -1;
  const cubeFace = (i: number) => {
    glass.visible = false;
    renderer.setRenderTarget(cubeRT, i);
    renderer.render(scene, cubeCam.children[i] as THREE.Camera);
    renderer.setRenderTarget(null);
    glass.visible = true;
  };
  const isStatic = opts.staticP !== undefined;
  stage.setRender(() => {
    if (isStatic) while (cubeFaces > 0) cubeFace(--cubeFaces);
    renderer.render(scene, camera);
    if (!isStatic && cubeFaces > 0) cubeFace(--cubeFaces);
  });
  stage.onResize(() => {
    const dpr = renderer.getPixelRatio();
    camera.fov = stage.size.mobile ? 58 : 40;
    camera.updateProjectionMatrix();
    dustMat.uniforms.uScale.value = stage.size.h * dpr * 0.0022;
  });

  // ---------- Kamera ----------
  const posCurve = new THREE.CatmullRomCurve3(CAM.map((k) => new THREE.Vector3(...k[1])), false, 'centripetal');
  const tgtCurve = new THREE.CatmullRomCurve3(CAM.map((k) => new THREE.Vector3(...k[2])), false, 'centripetal');
  const camU = (pp: number) => {
    for (let i = 0; i < CAM.length - 1; i++) {
      if (pp <= CAM[i + 1][0]) return (i + easeInOut(clamp01((pp - CAM[i][0]) / (CAM[i + 1][0] - CAM[i][0])))) / (CAM.length - 1);
    }
    return 1;
  };
  const vPos = new THREE.Vector3();
  const vTgt = new THREE.Vector3();
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  const tmp = new THREE.Vector3();

  const update = (t: number) => {
    const s = RANGES.map(([a, b]) => range(p, a, b));
    const [s1, s2, s3, s4, s5, s6, s7, s8] = s;
    void s1;

    // Kamera
    const u = camU(p);
    posCurve.getPoint(u, vPos);
    tgtCurve.getPoint(u, vTgt);
    if (stage.size.mobile && p < 0.87) vPos.sub(vTgt).multiplyScalar(1.12).add(vTgt);
    vPos.x += Math.sin(t * 0.21) * 0.025 * (1 - s8);
    vPos.y += Math.cos(t * 0.17) * 0.015 * (1 - s8);
    camera.position.copy(vPos);
    camera.lookAt(vTgt);

    // Lichtstimmung: Abendsonne → warmes Finale
    const golden = easeInOut(s7);
    sun.intensity = lerp(2.8, 3.6, golden);
    sun.color.setRGB(1, lerp(0.8, 0.74, golden), lerp(0.58, 0.48, golden));
    windowLight.intensity = lerp(2.2, 3.6, golden);
    beamMat.uniforms.uI.value = lerp(0.028, 0.036, golden) * (1 - s8);
    beamMat.uniforms.uT.value = t;
    dustMat.uniforms.uT.value = t;
    dustMat.uniforms.uI.value = 0.6 * (1 - s8);
    for (const w of washers) w.intensity = lerp(0, 5, easeOut(range(s7, 0, 0.6)));
    nicheLight.intensity = lerp(0, 0.35, easeOut(range(s7, 0.1, 0.7)));
    ledMat.color.setRGB(1, 0.84, 0.63).multiplyScalar(lerp(0.15, 1.6, easeOut(range(s7, 0.1, 0.7))));
    (halo.material as THREE.MeshBasicMaterial).opacity = easeOut(range(s7, 0.2, 0.8));
    (halo.material as THREE.MeshBasicMaterial).color.setRGB(1, 0.81, 0.59).multiplyScalar(1.4);
    (haloGlow.material as THREE.MeshBasicMaterial).opacity = 0.75 * easeOut(range(s7, 0.2, 0.8));
    (nicheWash.material as THREE.MeshBasicMaterial).opacity = 0.55 * easeOut(range(s7, 0.1, 0.7));
    const candle = range(s7, 0.3, 0.9);
    flameGlow.opacity = 0.75 * candle;
    flameSprites.forEach((sp, i) => sp.scale.setScalar(0.12 * (0.9 + Math.sin(t * 9 + i * 3) * 0.06 + Math.sin(t * 23 + i) * 0.04)));
    flameMat.visible = s7 > 0.3;
    hemi.intensity = lerp(0.14, 0.22, s4);
    scene.environmentIntensity = lerp(0.22, 0.38, s4);
    renderer.toneMappingExposure = lerp(0.9, 0.98, golden);

    // Linienlaser
    const laserOn = easeOut(range(s2, 0, 0.6)) * (1 - easeInOut(range(s4, 0, 0.35)));
    laserMat.opacity = laserOn;
    laserGlowMat.opacity = laserOn * 0.6;
    for (const l of laserLines) {
      const k = Math.max(0.0001, easeOut(range(s2, l.d, l.d + 0.4)));
      l.mesh.visible = l.glow.visible = laserOn > 0.01;
      l.mesh.scale.set(l.axis === 'x' ? k : 1, l.axis === 'y' ? k : 1, l.axis === 'z' ? k : 1);
      l.glow.scale.x = k;
    }
    const tri = easeOut(range(s2, 0, 0.3)) * (1 - easeInOut(range(s3, 0, 0.35)));
    tripod.visible = tri > 0.01;
    tripod.position.y = (1 - tri) * -1.2;

    // Muster: stehen nebeneinander, das gewählte (Travertin) tritt vor
    samples.forEach((sm, i) => {
      const inK = easeOut(range(s3, i * 0.1, 0.4 + i * 0.1));
      const chosen = i === 1;
      const out = easeInOut(range(s4, 0, 0.3));
      const pick = chosen ? easeInOut(range(s3, 0.6, 1)) : 0;
      const fade = chosen ? 0 : easeInOut(range(s3, 0.65, 1));
      sm.mesh.visible = inK > 0.001 && out < 0.999 && fade < 0.999;
      pos.set(sm.x * (1 + fade * 1.5), 0.62 + pick * 0.04 - out * 1.4, 0.75 + (1 - inK) * 0.6 + pick * 0.25);
      e.set(-0.06 + (1 - inK) * 0.6, (chosen ? 0 : sm.x * -0.35) + Math.sin(t * 0.5 + i) * 0.03, 0);
      q.setFromEuler(e);
      m4.compose(pos, q, one);
      sm.mesh.setMatrixAt(0, m4);
      sm.mesh.instanceMatrix.needsUpdate = true;
    });

    // Baustelle räumt sich, bevor die Platten kommen
    const clear = easeInOut(range(s4, 0, 0.18));
    site.visible = clear < 0.999;
    site.position.y = -clear * 1.5;

    // Wandplatten gleiten nacheinander an ihren Platz
    for (let i = 0; i < 4; i++) {
      const k = easeOut(range(s4, 0.12 + i * 0.13, 0.48 + i * 0.13));
      const o = 1 - k;
      pos.set(wallRest[i * 3], wallRest[i * 3 + 1] + o * 0.12, wallRest[i * 3 + 2] + o * 0.9);
      e.set(-o * 0.25, o * 0.15, 0);
      q.setFromEuler(e);
      m4.compose(pos, q, k > 0.001 ? one : tmp.set(0, 0, 0));
      wallSlabs.setMatrixAt(i, m4);
    }
    wallSlabs.instanceMatrix.needsUpdate = true;
    const pre = easeOut(range(s4, 0.55, 0.95));
    preWall.visible = pre > 0.001;
    preWall.position.x = (1 - pre) * 0.5;
    const fl = easeOut(range(s4, 0.7, 1));
    flutes.visible = fl > 0.001;
    flutes.position.x = (1 - fl) * -0.35;

    // Bodenplatten
    for (let i = 0; i < floorData.length; i++) {
      const fd = floorData[i];
      const k = easeOut(range(s5, fd.d * 0.6, fd.d * 0.6 + 0.4));
      const o = 1 - k;
      pos.set(fd.x + o * 0.3, 0.007 + o * 0.35, fd.z + o * 0.4);
      e.set(o * 0.2, 0, -o * 0.12);
      q.setFromEuler(e);
      m4.compose(pos, q, k > 0.001 ? one : tmp.set(0, 0, 0));
      floorSlabs.setMatrixAt(i, m4);
    }
    floorSlabs.instanceMatrix.needsUpdate = true;
    drain.visible = s5 > 0.9;

    // Einrichtung
    for (const f of furniture) {
      const k = easeOut(range(s6, f.delay, f.delay + 0.45));
      f.obj.visible = k > 0.001;
      f.obj.position.copy(f.base).addScaledVector(f.from, 1 - k);
      f.obj.scale.copy(f.s).multiplyScalar(lerp(0.92, 1, k));
    }

    // Schatten nur bei Bewegung, Spiegel nur bei sichtbarer Änderung neu rechnen
    if (p !== shadowP) {
      renderer.shadowMap.needsUpdate = true;
      shadowP = p;
    }
    if (mirror.visible && Math.abs(p - cubeP) > 0.002 && (t - cubeT > 0.2 || isStatic)) {
      mirror.getWorldPosition(cubeCam.position).z += 0.06;
      cubeFaces = 6;
      cubeP = p;
      cubeT = t;
    }
  };
  stage.onFrame((t) => update(t));

  const labels = () => {
    const s2 = range(p, RANGES[1][0], RANGES[1][1]);
    const s3 = range(p, RANGES[2][0], RANGES[2][1]);
    const o = clamp01((s2 - 0.45) * 3) * (1 - clamp01(s3 * 3));
    return labelAnchors.map((a) => {
      tmp.copy(a).project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * stage.size.w, y: (-tmp.y * 0.5 + 0.5) * stage.size.h, o: tmp.z < 1 ? o : 0 };
    });
  };

  if (isStatic) stage.onResize(() => stage.renderOnce());
  else {
    // Shader-Varianten für das Rendern in die Cube-Map (linear, ohne Tonemapping) gleich mitkompilieren
    stage.prepare([{ camera: cubeCam.children[0] as THREE.Camera, target: cubeRT }]);
  }

  return {
    setProgress: (v) => {
      p = v;
    },
    labels,
  };
}
