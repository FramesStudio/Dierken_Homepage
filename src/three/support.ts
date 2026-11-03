/** Leichte Hilfen ohne Three.js-Import (dürfen sofort geladen werden) */
export function webglAvailable(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

/** Schrittbereiche der Raumreise in p (Start, Ende) – gemeinsam für Szene und Bildunterschriften */
export const RANGES: [number, number][] = [
  [0.0, 0.1],
  [0.1, 0.22],
  [0.22, 0.33],
  [0.33, 0.48],
  [0.48, 0.58],
  [0.58, 0.7],
  [0.7, 0.85],
  [0.87, 0.98],
];
