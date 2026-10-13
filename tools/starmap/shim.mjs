// OffscreenCanvas does not exist in Node. The generator only ever asks its canvas for
// createImageData / putImageData, so the harness (and only the harness) supplies this
// stand-in that captures the pixels. src/engine/starMap.ts itself stays dependency free,
// and browser.mjs checks that the result is byte-identical to real Chromium.
import os from 'node:os';
import path from 'node:path';

class FakeCanvas {
  constructor(w, h) {
    this.width = w;
    this.height = h;
    this.pixels = new Uint8ClampedArray(w * h * 4);
  }
  getContext() {
    const c = this;
    return {
      createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: (img, dx, dy) => c.pixels.set(img.data, (dy * c.width + dx) * 4),
    };
  }
}

export const MODULE = path.resolve(import.meta.dirname, '../../src/engine/starMap.ts');
/** Rendered images go here unless --out says otherwise: never into the repo. */
export const OUT = path.join(os.tmpdir(), 'spacefarm-starmap');

export const loadGenerator = async (modulePath = MODULE) => {
  globalThis.OffscreenCanvas = FakeCanvas;
  return import(modulePath);
};

/** RGBA canvas pixels -> packed RGB image for img.mjs. */
export const toImage = (canvas) => {
  const { width: w, height: h, pixels } = canvas;
  const data = new Uint8Array(w * h * 3);
  for (let i = 0, j = 0; i < w * h * 4; i += 4, j += 3) {
    data[j] = pixels[i];
    data[j + 1] = pixels[i + 1];
    data[j + 2] = pixels[i + 2];
  }
  return { w, h, data };
};

/** Tiny argv helper: opt('size', 8192), all('set'), has('raw'). */
export const args = (argv = process.argv.slice(2)) => ({
  opt: (name, dflt) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : dflt;
  },
  all: (name) => argv.flatMap((a, i) => (a === `--${name}` ? [argv[i + 1]] : [])),
  has: (name) => argv.includes(`--${name}`),
});

export const deepMerge = (a, b) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b ?? {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) ? deepMerge(a?.[k] ?? {}, v) : v;
  }
  return out;
};
