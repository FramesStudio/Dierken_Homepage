/**
 * Materialbibliothek: eine Wandprobe (3,60 × 3,00 m) auf einem Sockel im Spotlicht.
 * Scroll steuert p ∈ [0, N): je Material fährt die Kamera von der Totalen bis an die Fuge und zurück.
 * Beim Wechsel heben sich die alten Fliesen ab, die neuen werden in einer Welle gesetzt,
 * ein Lichtschwenk läuft über die Fläche. Liefert pro Frame die Bildschirmecken einer Referenzfliese
 * für die Maßlinien im HTML.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { createStage, clamp01, lerp, easeInOut, easeOut, range } from './engine';
import { tileMaterial, addTileAttributes, type Kind } from './materials';
import { layoutTiles, cellCorners, type Cell, type TileSpec } from './layouts';

export interface LibMaterial extends TileSpec {
  kind: Kind;
  base?: string;
  joint: number;
}

export interface LibFrame {
  /** Bildschirmecken (px) der Referenzfliese: links oben, rechts oben, rechts unten, links unten */
  dims: [number, number][] | null;
  /** 1 = Totale, 0 = Makro */
  wide: number;
  /** 1 sobald die Fliesen gesetzt sind */
  settled: number;
  index: number;
}

const PW = 3.6;
const PH = 3.0;
const BASE = 0.16;
const FRONT = 0.045;
const MAXN = 1300;
const DUR = 1.0;

export function initLibrary(
  canvas: HTMLCanvasElement,
  mats: LibMaterial[],
  opts: { reduced: boolean; observe?: Element; onFrame?: (f: LibFrame) => void },
) {
  RectAreaLightUniformsLib.init();
  const stage = createStage(canvas, { fov: 30, shadows: true, envIntensity: 0.2, observe: opts.observe });
  const { scene, camera, renderer } = stage;
  const bg = new THREE.Color('#081438');
  scene.background = bg;
  scene.fog = new THREE.Fog(bg, 11, 26);
  renderer.localClippingEnabled = true;
  renderer.toneMappingExposure = 1.0;

  // ---------- Bühne ----------
  const stageMat = new THREE.MeshStandardMaterial({ color: '#0d1c4d', roughness: 0.93 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: '#0c1a48', roughness: 0.55, metalness: 0.1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), stageMat);
  backdrop.position.set(0, 10, -1.6);
  backdrop.receiveShadow = true;
  scene.add(floor, backdrop);

  const exhibit = new THREE.Group();
  scene.add(exhibit);
  const panel = new THREE.Group();
  panel.position.set(0, BASE + PH / 2, 0);
  exhibit.add(panel);
  const substrate = new THREE.Mesh(
    new RoundedBoxGeometry(PW + 0.04, PH + 0.04, 0.09, 2, 0.008),
    new THREE.MeshStandardMaterial({ color: '#17191f', roughness: 0.45, metalness: 0.4 }),
  );
  substrate.castShadow = true;
  substrate.receiveShadow = true;
  panel.add(substrate);
  const plinth = new THREE.Mesh(
    new RoundedBoxGeometry(PW + 0.6, BASE, 0.8, 2, 0.01),
    new THREE.MeshStandardMaterial({ color: '#0a1537', roughness: 0.6, metalness: 0.15 }),
  );
  plinth.position.set(0, BASE / 2, 0.05);
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  exhibit.add(plinth);

  // Beschnitt an der Probenkante
  const clip = [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), PW / 2),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), PW / 2),
    new THREE.Plane(new THREE.Vector3(0, 1, 0), -BASE),
    new THREE.Plane(new THREE.Vector3(0, -1, 0), BASE + PH),
  ];

  // ---------- Materialsätze ----------
  const sets = mats.map((m) => {
    const thick = m.kind === 'glaze' ? 0.012 : 0.014;
    const geo = m.size
      ? new RoundedBoxGeometry(m.size[0] - m.joint, m.size[1] - m.joint, thick, 3, Math.min(0.004, m.joint * 0.9 + 0.0012))
      : new THREE.BoxGeometry(1, 1, 0.008);
    const rest = new Float32Array(MAXN * 3);
    const seeds = new Float32Array(MAXN).map(() => Math.random());
    addTileAttributes(geo, rest, seeds);
    const mat = tileMaterial({
      kind: m.kind,
      base: m.base,
      plane: 0,
      instanced: true,
      tile: m.size ?? [3, 3],
      bump: m.kind === 'glaze' ? 0.011 : m.kind === 'fluted' ? 0.013 : undefined,
    });
    mat.clippingPlanes = clip;
    mat.clipShadows = true;
    const mesh = new THREE.InstancedMesh(geo, mat, MAXN);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.z = FRONT + thick / 2;
    if (m.kind === 'glaze') {
      const c = new THREE.Color();
      for (let i = 0; i < MAXN; i++) mesh.setColorAt(i, c.setScalar(0.8 + Math.random() * 0.36));
    }
    const cells = layoutTiles(m, PW, PH).slice(0, MAXN);
    cells.forEach((c, i) => rest.set([c.x, c.y, 0], i * 3));
    mesh.count = cells.length;
    mesh.visible = false;
    panel.add(mesh);
    // Referenzfliese für Maßlinien & Makro: ganz sichtbar, nahe links-oberhalb der Mitte
    let ref: Cell | null = null;
    if (m.size) {
      const [w, h] = m.size;
      let best = Infinity;
      for (const c of cells) {
        const cs = cellCorners(c, w, h);
        if (cs.some(([x, y]) => Math.abs(x) > PW / 2 - 0.02 || Math.abs(y) > PH / 2 - 0.02)) continue;
        const d = Math.hypot(c.x + 0.35, c.y - 0.15);
        if (d < best) {
          best = d;
          ref = c;
        }
      }
    }
    // Makro-Ziel: eine Fugenkreuzung bzw. Kante der Referenzfliese
    const jp = ref && m.size ? cellCorners(ref, m.size[0], m.size[1])[1] : [0.4, 0.3];
    return { m, mesh, cells, ref, joint: new THREE.Vector3(jp[0], jp[1], FRONT + 0.012) };
  });

  // Lage im Raum: leicht gedreht, damit Dicke, Kante und Schatten sichtbar werden
  const placeExhibit = (mobile: boolean) => {
    exhibit.position.set(mobile ? 0 : 0.9, 0, 0);
    exhibit.rotation.y = mobile ? 0.12 : 0.3;
    exhibit.updateMatrixWorld(true);
    const local = [
      new THREE.Plane(new THREE.Vector3(1, 0, 0), PW / 2),
      new THREE.Plane(new THREE.Vector3(-1, 0, 0), PW / 2),
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -BASE),
      new THREE.Plane(new THREE.Vector3(0, -1, 0), BASE + PH),
    ];
    local.forEach((pl, i) => clip[i].copy(pl).applyMatrix4(exhibit.matrixWorld));
    key.target.position.copy(panel.getWorldPosition(new THREE.Vector3()));
  };

  // ---------- Licht ----------
  scene.add(new THREE.HemisphereLight('#41569a', '#050a1c', 0.4));
  const key = new THREE.SpotLight('#fff1df', 260, 0, 0.36, 0.7, 2);
  key.position.set(-3.4, 7.2, 6.4);
  key.target.position.set(0, BASE + PH / 2, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.bias = -0.0002;
  key.shadow.normalBias = 0.02;
  key.shadow.camera.near = 3;
  key.shadow.camera.far = 22;
  scene.add(key, key.target);
  // sichtbarer Lichtkegel des Spots + schwebende Partikel (Galerie-Atmosphäre)
  const coneMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: { uI: { value: 0.07 } },
    vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ vY = uv.y; vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uI; varying float vY; varying vec3 vN; varying vec3 vV;
      void main(){ float rim = pow(abs(dot(vN, vV)), 1.6); float f = smoothstep(0.0, 0.25, vY) * pow(vY, 0.6);
        gl_FragColor = vec4(vec3(1.0, 0.93, 0.82) * uI * rim * f, 1.0); }`,
  });
  const coneLen = 8.6;
  const coneGeo = new THREE.ConeGeometry(Math.tan(0.36) * coneLen, coneLen, 48, 1, true);
  coneGeo.translate(0, -coneLen / 2, 0);
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.renderOrder = 5;
  scene.add(cone);
  const dustGeo = new THREE.BufferGeometry();
  {
    const pts: number[] = [];
    for (let i = 0; i < 500; i++) pts.push((Math.random() - 0.5) * 6, Math.random() * 5, Math.random() * 3.5 + 0.2);
    dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  }
  const dustMat = new THREE.PointsMaterial({ color: '#ffe9cf', size: 0.012, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  const fill = new THREE.RectAreaLight('#cfdcff', 1.3, 2.4, 3.6);
  fill.position.set(4.6, 2.2, 3.6);
  fill.lookAt(0, BASE + PH / 2, 0);
  scene.add(fill);
  const sweep = new THREE.RectAreaLight('#ffffff', 0, 0.32, 4.2);
  sweep.position.set(-4, BASE + PH / 2, 1.1);
  scene.add(sweep);
  const graze = new THREE.DirectionalLight('#ffe2bd', 0);
  graze.position.set(-7, BASE + PH / 2 + 0.7, 0.55);
  graze.target.position.set(0, BASE + PH / 2, 0);
  scene.add(graze, graze.target);

  // ---------- Kamera ----------
  const widePos = new THREE.Vector3();
  const wideTgt = new THREE.Vector3();
  stage.onResize(() => {
    const m = stage.size.mobile;
    camera.fov = m ? 42 : 30;
    camera.updateProjectionMatrix();
    placeExhibit(m);
    if (m) {
      widePos.set(-0.6, BASE + PH * 0.55, 10.6);
      wideTgt.set(0, BASE + PH * 0.33, 0);
    } else {
      widePos.set(-2.1, BASE + PH * 0.62, 8.6);
      wideTgt.set(-0.75, BASE + PH * 0.48, 0);
    }
    key.shadow.mapSize.setScalar(m ? 1024 : 2048);
  });

  let p = 0;
  let current = 0;
  let previous = -1;
  let switchedAt = -10;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const camTgt = new THREE.Vector3();
  const mPos = new THREE.Vector3();
  const v = new THREE.Vector3();
  const lookOff = new THREE.Vector3(-0.06, 0, 0);

  const place = (idx: number, since: number, leaving: boolean) => {
    const s = sets[idx];
    s.mesh.visible = true;
    const seamless = !s.m.size;
    for (let i = 0; i < s.cells.length; i++) {
      const c = s.cells[i];
      const k = easeOut(clamp01((since - c.d * 0.75 - (leaving ? 0 : 0.22)) / DUR));
      const vis = leaving ? 1 - k : k;
      if (seamless) {
        // fugenlos: die Fläche wird in einem Zug aufgezogen
        const sx = Math.max(0.0001, vis);
        pos.set(-(PW + 0.1) / 2 * (1 - vis), 0, 0);
        e.set(0, 0, 0);
        scl.set((PW + 0.1) * sx, PH + 0.1, 1);
      } else {
        pos.set(c.x, c.y + (leaving ? (1 - vis) * 0.25 : 0), (1 - vis) * (leaving ? 0.35 : 0.8));
        e.set(leaving ? -(1 - vis) * 1.3 : (1 - vis) * 1.1, (1 - vis) * (leaving ? 0.2 : -0.35), c.rot + (1 - vis) * 0.15);
        const sc = vis < 0.002 ? 0 : 0.86 + 0.14 * vis;
        scl.set(sc, sc, sc);
      }
      q.setFromEuler(e);
      m4.compose(pos, q, scl);
      s.mesh.setMatrixAt(i, m4);
    }
    s.mesh.instanceMatrix.needsUpdate = true;
  };

  const setIndex = (i: number) => {
    if (i === current) return;
    previous = current;
    current = i;
    switchedAt = performance.now() / 1000;
  };

  stage.onFrame((t) => {
    const n = sets.length;
    const idx = Math.min(n - 1, Math.max(0, Math.floor(p)));
    if (!opts.reduced) setIndex(idx);
    const u = opts.reduced ? 0 : p - idx;
    const since = opts.reduced ? 99 : t - switchedAt;

    // Fliesen
    sets.forEach((s, i) => {
      if (i === current) place(i, since, false);
      else if (i === previous && since < 2.2) place(i, since, true);
      else s.mesh.visible = false;
    });

    // Kamera: Totale → Makro an die Fuge → Totale
    const macro = opts.reduced ? 0 : easeInOut(range(u, 0.2, 0.46)) * (1 - easeInOut(range(u, 0.64, 0.9)));
    const s = sets[current];
    panel.localToWorld(mPos.copy(s.joint).add(v.set(stage.size.mobile ? 0.28 : 0.46, 0.12, stage.size.mobile ? 0.55 : 0.68)));
    camPos.copy(widePos).lerp(mPos, macro);
    panel.localToWorld(v.copy(s.joint).add(lookOff));
    camTgt.copy(wideTgt).lerp(v, macro);
    camPos.x += Math.sin(t * 0.18) * 0.12 * (1 - macro);
    camPos.y += Math.cos(t * 0.14) * 0.05 * (1 - macro);
    camera.position.copy(camPos);
    camera.lookAt(camTgt);

    // Licht: Schwenk beim Wechsel, Streiflicht im Makro
    const sw = clamp01(since / 1.7);
    sweep.position.x = lerp(-PW / 2 - 1.2, PW / 2 + 1.2, easeInOut(sw));
    sweep.intensity = since < 1.7 && !opts.reduced ? Math.sin(sw * Math.PI) * 16 : 0;
    sweep.lookAt(sweep.position.x, BASE + PH / 2, 0);
    graze.intensity = macro * 2.4;
    // Kegel zeigt vom Spot zur Platte
    cone.position.copy(key.position);
    cone.lookAt(key.target.position);
    cone.rotateX(-Math.PI / 2);
    coneMat.uniforms.uI.value = 0.075 * (1 - macro * 0.8);
    dust.rotation.y = Math.sin(t * 0.05) * 0.05;
    dust.position.y = Math.sin(t * 0.2) * 0.05;
    dustMat.opacity = 0.5 * (1 - macro * 0.6);
    key.intensity = 260 - macro * 120;

    // Maßlinien
    if (opts.onFrame) {
      let dims: [number, number][] | null = null;
      if (s.ref && s.m.size) {
        const cs = cellCorners(s.ref, s.m.size[0], s.m.size[1]);
        dims = cs.map(([x, y]) => {
          panel.localToWorld(v.set(x, y, FRONT + 0.016)).project(camera);
          return [(v.x * 0.5 + 0.5) * stage.size.w, (-v.y * 0.5 + 0.5) * stage.size.h];
        });
      }
      opts.onFrame({ dims, wide: 1 - macro, settled: since > 1.25 ? 1 : 0, index: current });
    }
  });

  if (opts.reduced) stage.onResize(() => stage.renderOnce());
  else stage.start();

  return {
    setProgress(v: number) {
      p = v;
    },
    /** nur für reduzierte Bewegung: direkt wechseln */
    show(i: number) {
      previous = -1;
      current = i;
      switchedAt = -10;
      stage.renderOnce();
    },
  };
}
