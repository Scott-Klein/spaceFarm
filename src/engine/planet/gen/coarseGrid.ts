import { faceDirection } from '../cubeSphere';
import { C_SIZE, sampleCoarse, type Coarse, type World } from './world';

/** Smooth fields on a sparse grid over one face band, Catmull-Rom interpolated per texel.
 *  (Bilinear is not enough: its kinks every few texels get stretched into visible ripples
 *  wherever detail noise is sampled at an interpolated, warped point.) */
export class CoarseGrid {
  readonly cols: number;
  readonly row0: number;
  readonly rows: number;
  readonly data: Float64Array;

  constructor(
    world: World,
    readonly N: number,
    readonly spacing: number,
    face: number,
    j0: number,
    j1: number,
    level: Coarse,
  ) {
    // grid point k sits at texel-edge coordinate (k - 2) * spacing: one texel of halo on every
    // side plus the 4×4 interpolation footprint
    this.cols = N / spacing + 5;
    this.row0 = Math.floor((j0 - 0.5) / spacing + 2) - 1;
    this.rows = Math.floor((j1 + 0.5) / spacing + 2) + 3 - this.row0;
    this.data = new Float64Array(this.cols * this.rows * C_SIZE);
    const dir = [0, 0, 0];
    const out = new Float64Array(C_SIZE);
    for (let r = 0; r < this.rows; r++) {
      const t = (((this.row0 + r - 2) * spacing) / N) * 2 - 1;
      for (let k = 0; k < this.cols; k++) {
        faceDirection(face, (((k - 2) * spacing) / N) * 2 - 1, t, dir);
        sampleCoarse(world, dir[0]!, dir[1]!, dir[2]!, out, level);
        this.data.set(out, (r * this.cols + k) * C_SIZE);
      }
    }
  }

  private rowCache = new Float64Array(0);
  private cachedRow = NaN;

  /** Interpolated fields at the centre of texel (i, j); i, j may be -1 or N (halo). The
   *  vertical pass is cached per row, so walking a row costs one 4-tap pass per texel. */
  sample(i: number, j: number, out: Float64Array) {
    if (j !== this.cachedRow) this.cacheRow(j);
    const fu = (i + 0.5) / this.spacing + 2;
    const k = Math.floor(fu) - 1;
    const u = fu - k - 1;
    const u2 = u * u;
    const u3 = u2 * u;
    const a0 = (-u3 + 2 * u2 - u) * 0.5;
    const a1 = (3 * u3 - 5 * u2 + 2) * 0.5;
    const a2 = (-3 * u3 + 4 * u2 + u) * 0.5;
    const a3 = (u3 - u2) * 0.5;
    const d = this.rowCache;
    const base = k * C_SIZE;
    for (let f = 0; f < C_SIZE; f++) {
      const o = base + f;
      out[f] = d[o]! * a0 + d[o + C_SIZE]! * a1 + d[o + 2 * C_SIZE]! * a2 + d[o + 3 * C_SIZE]! * a3;
    }
  }

  private cacheRow(j: number) {
    const fv = (j + 0.5) / this.spacing + 2 - this.row0;
    const r = Math.floor(fv) - 1;
    const v = fv - r - 1;
    const v2 = v * v;
    const v3 = v2 * v;
    const b0 = (-v3 + 2 * v2 - v) * 0.5;
    const b1 = (3 * v3 - 5 * v2 + 2) * 0.5;
    const b2 = (-3 * v3 + 4 * v2 + v) * 0.5;
    const b3 = (v3 - v2) * 0.5;
    const n = this.cols * C_SIZE;
    if (this.rowCache.length !== n) this.rowCache = new Float64Array(n);
    const d = this.data;
    const r0 = r * n;
    for (let o = 0; o < n; o++) {
      this.rowCache[o] = d[r0 + o]! * b0 + d[r0 + n + o]! * b1 + d[r0 + 2 * n + o]! * b2 + d[r0 + 3 * n + o]! * b3;
    }
    this.cachedRow = j;
  }
}
