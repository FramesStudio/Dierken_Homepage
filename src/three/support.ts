/** Leichte Hilfen ohne Three.js-Import (dürfen sofort geladen werden) */
let gl: boolean | undefined;
export function webglAvailable(): boolean {
  if (gl !== undefined) return gl;
  try {
    const ctx = document.createElement('canvas').getContext('webgl2');
    gl = !!ctx;
    // Testkontext sofort freigeben (Browser begrenzen die Zahl gleichzeitiger WebGL-Kontexte)
    ctx?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    gl = false;
  }
  return gl;
}

const idle = (fn: () => void, timeout: number) =>
  'requestIdleCallback' in window ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 50);

/**
 * Startet eine 3D-Szene, sobald sie in die Nähe kommt. Auf dem Desktop zusätzlich schon kurz nach dem
 * Laden im Leerlauf, gestaffelt nach `order` – so ist der Aufbau meist fertig, bevor gescrollt wird.
 */
export function bootWhenNear(el: Element, order: number, boot: () => unknown) {
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    io.disconnect();
    boot();
  };
  const io = new IntersectionObserver(([e]) => e.isIntersecting && idle(go, 400), { rootMargin: '45% 0px' });
  io.observe(el);
  if (matchMedia('(min-width: 901px)').matches) {
    const later = () => setTimeout(() => idle(go, 1500), 900 + order * 1100);
    document.readyState === 'complete' ? later() : addEventListener('load', later, { once: true });
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
