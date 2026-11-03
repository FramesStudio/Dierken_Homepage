/**
 * Verlegemuster in Metern: Raster (zentriert, damit ganze Fliesen im Bild liegen),
 * Fischgrät (rechnerisch geprüfte 45°-Bänder) und fugenlos.
 */
export interface TileSpec {
  /** Format [Breite, Höhe] in Metern; null = fugenlos */
  size: [number, number] | null;
  pattern: 'grid' | 'herringbone' | 'seamless';
}

export interface Cell {
  x: number;
  y: number;
  rot: number;
  /** Verlegefolge 0…1 (diagonal von links unten) */
  d: number;
}

export function layoutTiles(spec: TileSpec, pw: number, ph: number, jitter = 0.04): Cell[] {
  const cells: Cell[] = [];
  const order = (x: number, y: number) =>
    Math.min(1, ((x + pw / 2) / pw) * 0.6 + ((y + ph / 2) / ph) * 0.4 + Math.random() * jitter);
  if (spec.pattern === 'seamless' || !spec.size) {
    cells.push({ x: 0, y: 0, rot: 0, d: 0 });
    return cells;
  }
  const [w, h] = spec.size;
  if (spec.pattern === 'grid') {
    const nx = Math.ceil(pw / w) + 1;
    const ny = Math.ceil(ph / h) + 1;
    // zentriert: eine Fuge bzw. Fliesenmitte liegt in der Bildmitte
    const ox = -(nx * w) / 2;
    const oy = -((ny * h) / 2);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const cx = ox + w / 2 + i * w;
        const cy = oy + h / 2 + j * h;
        if (cx + w / 2 < -pw / 2 || cx - w / 2 > pw / 2 || cy + h / 2 < -ph / 2 || cy - h / 2 > ph / 2) continue;
        cells.push({ x: cx, y: cy, rot: 0, d: order(cx, cy) });
      }
    }
    return cells;
  }
  // Fischgrät
  const L = w;
  const W = h;
  const k = Math.round(L / W);
  const c = Math.SQRT1_2;
  const toWorld = (u: number, v: number) => ({ x: (u - v) * c, y: (u + v) * c });
  const R = Math.ceil(Math.hypot(pw, ph) / W) + k;
  for (let mi = -R; mi <= R; mi++) {
    for (let n = -R * 2; n <= R * 2; n++) {
      const bu = n * W + mi * k * W;
      const bv = n * W - mi * k * W;
      const hc = toWorld(bu + L / 2, bv + W / 2);
      const vc = toWorld(bu - W / 2, bv + L / 2);
      for (const [p, rot] of [
        [hc, Math.PI / 4],
        [vc, Math.PI / 4 + Math.PI / 2],
      ] as const) {
        if (Math.abs(p.x) > pw / 2 + L * 0.6 || Math.abs(p.y) > ph / 2 + L * 0.6) continue;
        cells.push({ x: p.x, y: p.y, rot, d: order(p.x, p.y) });
      }
    }
  }
  return cells;
}

/** Ecken einer Zelle (lokal, gegen den Uhrzeigersinn ab links oben) */
export function cellCorners(c: Cell, w: number, h: number): [number, number][] {
  const cs = Math.cos(c.rot);
  const sn = Math.sin(c.rot);
  return (
    [
      [-w / 2, h / 2],
      [w / 2, h / 2],
      [w / 2, -h / 2],
      [-w / 2, -h / 2],
    ] as [number, number][]
  ).map(([x, y]) => [c.x + x * cs - y * sn, c.y + x * sn + y * cs]);
}
