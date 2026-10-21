import alea from 'alea';
import { createNoise3D, type NoiseFunction3D } from 'simplex-noise';

export type Rand = () => number;
export type Noise = NoiseFunction3D;

export const makeRand = (seed: number | string): Rand => alea(seed);
export const makeNoise = (rand: Rand): Noise => createNoise3D(rand);

// Per-octave offsets: keep successive octaves' lattices from lining up (and from all
// meeting at the origin), which otherwise shows as faint axis-aligned structure.
const OX = [0, 17.31, -9.17, 31.7, -23.3, 5.71, 47.1, -38.9, 13.3, -61.7, 71.9, -7.3];
const OY = [0, -5.13, 27.7, -14.9, 9.41, -33.1, 21.3, 12.7, -45.1, 3.9, -19.6, 55.1];
const OZ = [0, 11.9, 3.37, -27.1, 39.7, -17.9, -6.1, 29.3, 7.7, -36.2, 16.4, -52.8];

/** Fractal Brownian motion, normalised so the result stays roughly in [-1, 1]. */
export const fbm = (n: Noise, x: number, y: number, z: number, octaves: number, lac = 2.03, gain = 0.5) => {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * n(x * f + OX[i]!, y * f + OY[i]!, z * f + OZ[i]!);
    norm += amp;
    amp *= gain;
    f *= lac;
  }
  return sum / norm;
};

/** fBm over a frequency range: octaves [from, to) of the series fbm() would produce. Lets a
 *  coarse grid carry the low octaves while the fine pass adds only the high ones. */
export const fbmRange = (
  n: Noise, x: number, y: number, z: number, from: number, to: number, total: number, lac = 2.03, gain = 0.5,
) => {
  let sum = 0;
  let amp = Math.pow(gain, from);
  let f = Math.pow(lac, from);
  let norm = 0;
  for (let i = 0, a = 1; i < total; i++, a *= gain) norm += a;
  for (let i = from; i < to; i++) {
    sum += amp * n(x * f + OX[i]!, y * f + OY[i]!, z * f + OZ[i]!);
    amp *= gain;
    f *= lac;
  }
  return sum / norm;
};

/** Ridged multifractal (Musgrave): sharp crests, smooth valleys, detail concentrated on ridges. */
export const ridged = (n: Noise, x: number, y: number, z: number, octaves: number, lac = 2.1, gain = 0.5) => {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let weight = 1;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    let s = 1 - Math.abs(n(x * f + OX[i]!, y * f + OY[i]!, z * f + OZ[i]!));
    s *= s * weight;
    weight = s * 2 > 1 ? 1 : s * 2;
    sum += s * amp;
    norm += amp;
    amp *= gain;
    f *= lac;
  }
  return sum / norm;
};

/** fBm octaves from `base` frequency before features drop below ~1.5 texels of an N-texel
 *  cube face: finer octaves cost time and only alias. */
export const octavesFor = (base: number, lacunarity: number, N: number) =>
  Math.max(1, Math.floor(Math.log((N * 0.42) / base) / Math.log(lacunarity)) + 1);

// ---- simplex noise with analytic gradient --------------------------------------------------

/** Noise value at (x, y, z); writes its gradient into out[0..2]. */
export type NoiseD = (x: number, y: number, z: number, out: Float64Array) => number;

const F3 = 1 / 3;
const G3 = 1 / 6;
const GRAD3 = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];

/** 3D simplex noise (Gustavson) that also returns its derivatives, for slope-aware fBm. */
export const makeNoiseD = (rand: Rand): NoiseD => {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const r = Math.floor(rand() * (i + 1));
    const t = p[i]!;
    p[i] = p[r]!;
    p[r] = t;
  }
  const gx = new Float64Array(512);
  const gy = new Float64Array(512);
  const gz = new Float64Array(512);
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) {
    perm[i] = p[i & 255]!;
    const g = (perm[i]! % 12) * 3;
    gx[i] = GRAD3[g]!;
    gy[i] = GRAD3[g + 1]!;
    gz[i] = GRAD3[g + 2]!;
  }
  return (x, y, z, out) => {
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const x0 = x - i + t;
    const y0 = y - j + t;
    const z0 = z - k + t;
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
    else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
    else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    const ii = i & 255;
    const jj = j & 255;
    const kk = k & 255;
    let n = 0;
    let dx = 0;
    let dy = 0;
    let dz = 0;
    // four corners, unrolled: n += t⁴(g·d), ∇ += t⁴g - 8t³(g·d)d
    {
      const cx = x0;
      const cy = y0;
      const cz = z0;
      const tt = 0.6 - cx * cx - cy * cy - cz * cz;
      if (tt > 0) {
        const h = ii + perm[jj + perm[kk]!]!;
        const t2 = tt * tt;
        const t4 = t2 * t2;
        const g = gx[h]! * cx + gy[h]! * cy + gz[h]! * cz;
        const q = -8 * t2 * tt * g;
        n += t4 * g;
        dx += t4 * gx[h]! + q * cx;
        dy += t4 * gy[h]! + q * cy;
        dz += t4 * gz[h]! + q * cz;
      }
    }
    {
      const cx = x0 - i1 + G3;
      const cy = y0 - j1 + G3;
      const cz = z0 - k1 + G3;
      const tt = 0.6 - cx * cx - cy * cy - cz * cz;
      if (tt > 0) {
        const h = ii + i1 + perm[jj + j1 + perm[kk + k1]!]!;
        const t2 = tt * tt;
        const t4 = t2 * t2;
        const g = gx[h]! * cx + gy[h]! * cy + gz[h]! * cz;
        const q = -8 * t2 * tt * g;
        n += t4 * g;
        dx += t4 * gx[h]! + q * cx;
        dy += t4 * gy[h]! + q * cy;
        dz += t4 * gz[h]! + q * cz;
      }
    }
    {
      const cx = x0 - i2 + 2 * G3;
      const cy = y0 - j2 + 2 * G3;
      const cz = z0 - k2 + 2 * G3;
      const tt = 0.6 - cx * cx - cy * cy - cz * cz;
      if (tt > 0) {
        const h = ii + i2 + perm[jj + j2 + perm[kk + k2]!]!;
        const t2 = tt * tt;
        const t4 = t2 * t2;
        const g = gx[h]! * cx + gy[h]! * cy + gz[h]! * cz;
        const q = -8 * t2 * tt * g;
        n += t4 * g;
        dx += t4 * gx[h]! + q * cx;
        dy += t4 * gy[h]! + q * cy;
        dz += t4 * gz[h]! + q * cz;
      }
    }
    {
      const cx = x0 - 1 + 3 * G3;
      const cy = y0 - 1 + 3 * G3;
      const cz = z0 - 1 + 3 * G3;
      const tt = 0.6 - cx * cx - cy * cy - cz * cz;
      if (tt > 0) {
        const h = ii + 1 + perm[jj + 1 + perm[kk + 1]!]!;
        const t2 = tt * tt;
        const t4 = t2 * t2;
        const g = gx[h]! * cx + gy[h]! * cy + gz[h]! * cz;
        const q = -8 * t2 * tt * g;
        n += t4 * g;
        dx += t4 * gx[h]! + q * cx;
        dy += t4 * gy[h]! + q * cy;
        dz += t4 * gz[h]! + q * cz;
      }
    }
    out[0] = 32 * dx;
    out[1] = 32 * dy;
    out[2] = 32 * dz;
    return 32 * n;
  };
};

const grad = new Float64Array(3);

/**
 * "Eroded" fBm on the unit sphere (after Iñigo Quilez): each octave is damped by the slope the
 * octaves before it have built up, so detail piles onto crests while valleys and plains stay
 * smooth. The slope is measured in the tangent plane at (x, y, z).
 */
export const erodedFbm = (
  n: NoiseD, x: number, y: number, z: number, freq: number, octaves: number, lac = 2.03, gain = 0.5, damping = 1,
) => {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  let f = freq;
  let sx = 0;
  let sy = 0;
  let sz = 0;
  for (let i = 0; i < octaves; i++) {
    const v = n(x * f + OX[i]!, y * f + OY[i]!, z * f + OZ[i]!, grad);
    const along = grad[0]! * x + grad[1]! * y + grad[2]! * z;
    sx += grad[0]! - along * x;
    sy += grad[1]! - along * y;
    sz += grad[2]! - along * z;
    sum += (amp * v) / (1 + damping * (sx * sx + sy * sy + sz * sz));
    norm += amp;
    amp *= gain;
    f *= lac;
  }
  return sum / norm;
};

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const smoothstep = (e0: number, e1: number, v: number) => {
  const t = clamp01((v - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
