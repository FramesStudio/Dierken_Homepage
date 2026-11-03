/**
 * Prozedurale Fliesenmaterialien – komplett im Shader erzeugt, keine Bilddateien.
 * Die Muster werden in MeshPhysicalMaterial injiziert und erhalten so echtes PBR-Licht,
 * Umgebungsreflexionen und Schatten.
 *
 * Koordinaten:
 *  p  – durchgehende Flächenkoordinate in Metern (Marmoradern laufen über Fugen hinweg)
 *  l  – lokale Fliesenkoordinate −0.5…0.5 (für Glasurkanten)
 *  seed – Zufallswert je Fliese
 */
import * as THREE from 'three';

export type Kind = 'glaze' | 'marble' | 'terrazzo' | 'concrete' | 'wood' | 'clay' | 'travertine' | 'fluted' | 'microcement' | 'mineral';
const KIND_ID: Record<Kind, number> = { glaze: 0, marble: 1, terrazzo: 2, concrete: 3, wood: 4, clay: 5, travertine: 6, fluted: 7, microcement: 8, mineral: 9 };

const GLSL_COMMON = /* glsl */ `
varying vec3 vDkPos;
varying vec3 vDkLocal;
varying float vDkSeed;
uniform vec2 uDkTile;
uniform float uDkBump;
uniform vec3 uDkBase;

float dkHash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 dkHash2(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float dkNoise(vec2 p){
  vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(dkHash(i), dkHash(i+vec2(1,0)), u.x), mix(dkHash(i+vec2(0,1)), dkHash(i+vec2(1,1)), u.x), u.y);
}
float dkFbm(vec2 p){ float a = .5, s = 0.; for(int i = 0; i < 5; i++){ s += a*dkNoise(p); p = p*2.03 + vec2(17.1, 9.2); a *= .5; } return s; }
float dkVoronoi(vec2 p, out float id){
  vec2 n = floor(p), f = fract(p); float md = 8.; vec2 mg = vec2(0.);
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec2 g = vec2(float(i), float(j)); vec2 o = dkHash2(n+g); vec2 r = g + o - f; float d = dot(r,r);
    if(d < md){ md = d; mg = n + g; }
  }
  id = dkHash(mg); return sqrt(md);
}

void dkSurface(out vec3 alb, out float rough, out float h){
#if DK_PLANE == 1
  vec2 p = vDkPos.xz; vec2 l = vDkLocal.xz / uDkTile;
#elif DK_PLANE == 2
  vec2 p = vDkPos.zy; vec2 l = vDkLocal.zy / uDkTile;
#else
  vec2 p = vDkPos.xy; vec2 l = vDkLocal.xy / uDkTile;
#endif
  float s = vDkSeed;
#if DK_KIND == 0
  // Glasur: handgemacht, wellig, an den Kanten dunkler gesammelt
  float m = dkFbm(p * 2.6 + s * 13.0);
  alb = uDkBase * (0.78 + 0.42 * m);
  float e = max(abs(l.x), abs(l.y)) * 2.0;
  alb *= mix(1.0, 0.62, smoothstep(0.5, 1.0, e));
  alb += (dkHash(floor(p * 260.0)) - 0.5) * 0.012;
  rough = 0.1 + 0.12 * dkFbm(p * 5.0 + s);
  // sanfte Welligkeit wie bei handgeformten Fliesen, zur Kante hin leicht abfallend
  h = dkFbm(p * 0.9 + s * 7.0) + 0.06 * dkFbm(p * 8.0 + s) - smoothstep(0.75, 1.0, e) * 0.35;
#elif DK_KIND == 1
  // Marmor: Adern laufen über die Fugen weiter
  // Calacatta: warmweiß, kräftige graue Adern mit Goldschimmer, poliert
  vec2 q = p * 0.5;
  vec2 wq = vec2(dkFbm(q * 1.3 + 1.7), dkFbm(q * 1.3 + 9.2));
  float f = dkFbm(q + wq * 1.9);
  float r = abs(f - 0.5);
  float width = 0.0035 + 0.012 * smoothstep(0.35, 0.8, dkFbm(q * 2.2 + 3.0));
  float vein = 1.0 - smoothstep(0.0, width, r);
  float halo = (1.0 - smoothstep(0.0, 0.045, r)) * 0.16;
  float f2 = dkFbm(q * 2.7 + wq * 2.6 + 4.0);
  float fine = 1.0 - smoothstep(0.0, 0.0028, abs(f2 - 0.5));
  vec3 base = vec3(0.968, 0.96, 0.942) - dkFbm(p * 3.0) * 0.03;
  vec3 vc = mix(vec3(0.3, 0.3, 0.31), vec3(0.7, 0.55, 0.32), smoothstep(0.5, 0.72, dkFbm(q * 0.9 + 5.0)));
  alb = mix(base, mix(base, vc, 0.3), halo);
  alb = mix(alb, vc, clamp(vein + fine * 0.45, 0.0, 1.0));
  rough = 0.045 + vein * 0.05;
  h = vein * 0.02;
#elif DK_KIND == 2
  // Terrazzo mit Körnung in Markenfarben
  // grobe Körnung (wenig, in Markenblau), mittlere Steinkörnung, feiner Zuschlag
  float id; float d = dkVoronoi(p * 34.0, id);
  float chip = 1.0 - smoothstep(0.2, 0.24, d + (dkNoise(p * 90.0) - 0.5) * 0.12);
  chip *= step(0.62, dkHash(vec2(id * 91.7, 3.1)));
  vec3 cc = id < 0.12 ? vec3(0.05, 0.09, 0.22) : id < 0.2 ? vec3(0.45, 0.62, 0.74) : id < 0.7 ? vec3(0.68, 0.655, 0.62) : id < 0.88 ? vec3(0.5, 0.48, 0.45) : vec3(0.3, 0.29, 0.28);
  float id2; float d2 = dkVoronoi(p * 95.0 + 7.0, id2);
  float chip2 = (1.0 - smoothstep(0.24, 0.3, d2)) * step(0.5, dkHash(vec2(id2 * 13.1, 1.7)));
  vec3 cc2 = mix(vec3(0.55, 0.53, 0.5), vec3(0.78, 0.76, 0.72), id2);
  vec3 base = vec3(0.905, 0.89, 0.86) + (dkFbm(p * 9.0) - 0.5) * 0.05;
  float fine = step(0.9, dkNoise(p * 260.0));
  alb = mix(base, cc2, chip2 * 0.8);
  alb = mix(alb, cc, chip);
  alb = mix(alb, vec3(0.35), fine * 0.3);
  rough = 0.22 + chip * 0.08;
  h = chip * 0.05;
#elif DK_KIND == 3
  // Betonoptik: wolkig, mit Poren
  float m = dkFbm(p * 1.2) * 0.6 + dkFbm(p * 6.0) * 0.4;
  vec3 base = mix(vec3(0.5, 0.49, 0.47), vec3(0.69, 0.675, 0.65), m);
  float pores = smoothstep(0.84, 0.92, dkNoise(p * 130.0 + s * 9.0));
  alb = base * (1.0 - pores * 0.4);
  rough = 0.72 - m * 0.18;
  h = m * 0.4 - pores * 0.5;
#elif DK_KIND == 4
  // Holzoptik: Dielen mit Maserung
  vec2 q = p + vec2(s * 7.3, s * 2.1);
  float grain = dkFbm(vec2(q.x * 0.7, q.y * 26.0));
  float rings = sin(q.y * 38.0 + dkFbm(q * vec2(1.4, 5.0)) * 7.0) * 0.5 + 0.5;
  vec3 a = vec3(0.6, 0.43, 0.29), b = vec3(0.34, 0.22, 0.13);
  alb = mix(a, b, rings * 0.4 + grain * 0.6) * (0.88 + dkHash(vec2(s, 1.7)) * 0.24) * uDkBase;
  rough = 0.48 + grain * 0.15;
  h = grain * 0.25;
#elif DK_KIND == 6
  // Travertin, Vein-Cut: warme Sandtöne, horizontale Schichtung, feine Poren, gehont
  float warp = dkFbm(p * vec2(0.5, 1.6)) * 1.4;
  float bands = dkFbm(vec2(p.x * 0.28, p.y * 5.5 + warp));
  float fine = dkFbm(vec2(p.x * 1.6, p.y * 30.0 + warp * 3.0));
  vec3 light = uDkBase * 1.05;
  vec3 dark = uDkBase * vec3(0.8, 0.73, 0.64);
  vec3 c = mix(light, dark, smoothstep(0.32, 0.78, bands));
  c = mix(c, c * vec3(0.93, 0.9, 0.86), fine * 0.55);
  // feine, längliche Poren – nur dezent sichtbar
  float pn = dkNoise(vec2(p.x * 90.0, p.y * 320.0) + s * 20.0) * 0.7 + dkNoise(vec2(p.x * 25.0, p.y * 90.0)) * 0.3;
  float pore = smoothstep(0.8, 0.9, pn) * smoothstep(0.3, 0.7, bands);
  c *= 1.0 - pore * 0.16;
  alb = c;
  rough = 0.38 + bands * 0.1 + pore * 0.2;
  h = fine * 0.05 - pore * 0.18;
#elif DK_KIND == 7
  // Kannelur: halbrunde Rillen im Sandstein-Ton
  float pitch = 0.032;
  float fr = fract(p.x / pitch);
  float prof = sqrt(max(0.0, 1.0 - pow(2.0 * fr - 1.0, 2.0)));
  float m = dkFbm(p * 2.5);
  alb = uDkBase * (0.93 + 0.08 * m) * (0.84 + 0.16 * prof);
  rough = 0.6 - m * 0.1;
  h = prof * 0.9 + m * 0.05;
#elif DK_KIND == 8
  // Mikrozement / fugenlos: weiche Kellenspuren
  float m = dkFbm(p * 0.7 + dkFbm(p * 1.8) * 1.3);
  float trowel = dkFbm(vec2(p.x * 2.2 + p.y * 1.1, p.y * 0.5) * 2.0);
  alb = uDkBase * (0.9 + 0.14 * m - 0.07 * trowel);
  rough = 0.5 + 0.18 * trowel;
  h = trowel * 0.07;
#elif DK_KIND == 9
  // Mineralguss: seidenmatt, feinste Sprenkel
  alb = uDkBase * (0.985 + (dkFbm(p * 6.0) - 0.5) * 0.03);
  alb *= 1.0 - step(0.965, dkNoise(p * 320.0)) * 0.08;
  rough = 0.34;
  h = dkFbm(p * 40.0) * 0.01;
#else
  // Ton/Gips: ruhig, matt
  alb = uDkBase * (0.96 + (dkFbm(p * 3.0) - 0.5) * 0.06);
  rough = 0.92;
  h = dkFbm(p * 20.0) * 0.05;
#endif
}

vec3 dkBump(vec3 n, float h){
  vec3 dpdx = dFdx(-vViewPosition); vec3 dpdy = dFdy(-vViewPosition);
  float hx = dFdx(h), hy = dFdy(h);
  vec3 r1 = cross(dpdy, n), r2 = cross(n, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (hx * r1 + hy * r2);
  return normalize(abs(det) * n - grad * uDkBump);
}
`;

export interface TileMatOptions {
  kind: Kind;
  base?: THREE.ColorRepresentation;
  /** Fliesenmaß in Metern (für Kantenverlauf der Glasur) */
  tile?: [number, number];
  /** 0 = Wand (xy), 1 = Boden (xz), 2 = Seitenwand (zy) */
  plane?: 0 | 1 | 2;
  instanced?: boolean;
  bump?: number;
  clearcoat?: number;
  envMapIntensity?: number;
}

export function tileMaterial(o: TileMatOptions): THREE.MeshPhysicalMaterial {
  const kind = KIND_ID[o.kind];
  const m = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.5,
    metalness: 0,
    clearcoat: o.clearcoat ?? ({ glaze: 1, marble: 0.7, travertine: 0.12, mineral: 0.15 } as Record<string, number>)[o.kind] ?? 0,
    clearcoatRoughness: 0.06,
    envMapIntensity: o.envMapIntensity ?? 1,
  });
  m.defines = { DK_KIND: kind, DK_PLANE: o.plane ?? 0, ...(o.instanced ? { DK_INST: '' } : {}) };
  const uniforms = {
    uDkTile: { value: new THREE.Vector2(...(o.tile ?? [1, 1])) },
    uDkBump: { value: o.bump ?? (o.kind === 'glaze' ? 0.045 : 0.012) },
    uDkBase: { value: new THREE.Color(o.base ?? 0xffffff) },
  };
  m.userData.uniforms = uniforms;
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vDkPos; varying vec3 vDkLocal; varying float vDkSeed;
        #ifdef DK_INST
        attribute vec3 aRest; attribute float aSeed;
        #endif`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef DK_INST
          vDkPos = aRest + position; vDkSeed = aSeed;
        #else
          vDkPos = (modelMatrix * vec4(position, 1.0)).xyz; vDkSeed = 0.0;
        #endif
        vDkLocal = position;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${GLSL_COMMON}`)
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        vec3 dkAlb; float dkRough; float dkH;
        dkSurface(dkAlb, dkRough, dkH);
        diffuseColor.rgb = dkAlb;`,
      )
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = dkRough;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\nnormal = dkBump(normal, dkH);`);
  };
  m.customProgramCacheKey = () => `dk-${kind}-${o.plane ?? 0}-${o.instanced ? 1 : 0}`;
  return m;
}

/** Zufallswerte & Ruhelage je Instanz für die Shader-Attribute */
export function addTileAttributes(geo: THREE.BufferGeometry, rest: Float32Array, seeds: Float32Array) {
  geo.setAttribute('aRest', new THREE.InstancedBufferAttribute(rest, 3));
  geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
}
