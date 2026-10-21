// Rivers, valleys and lakes from a global drainage simulation on a coarse cube grid.
//
// 1. sampleHydroBand: elevation and rainfall per grid cell (run in parallel bands).
// 2. routeWater: priority-flood from the sea fills every depression to its spill level and
//    yields, for free, a drainage direction for every land cell plus a topological order;
//    rain-weighted flow accumulation in reverse order gives river discharge, which sets valley
//    depth and picks out the river network as smoothed, meandering polylines. The largest,
//    deepest basins hold lakes, or salt pans where the climate is dry.
// The band baker then carves the valleys, levels the basins and draws the water.
import { directionToFace, faceDirection } from '../cubeSphere';
import { smoothstep } from './noise';
import { CoarseGrid } from './coarseGrid';
import { C_RAIN_LAT, C_SIZE, Coarse, T_ELEV, T_SIZE, lodFor, sampleTerrain, type World } from './world';

/** Cells along each cube-face edge of the drainage grid. */
export const HYDRO_SIZE = 256;
/** Halo cells kept around each face of the carve/lake grids, for seamless interpolation. */
export const HYDRO_HALO = 2;

export interface Hydrology {
  M: number;
  /** valley depth (km) per cell, faces of (M + 2·halo)², halo filled from neighbouring faces */
  carve: Float32Array;
  /** level (km) the depressions fill to: the land surface with every hollow flooded */
  fill: Float32Array;
  /** 1 where a cell lies in a depression, else 0: there the ground levels out to `fill` */
  flooded: Float32Array;
  /** 1 in the cells of a lake basin, else 0: its smoothed outline bounds the water */
  lakeMask: Float32Array;
  /** 1 where an arid basin holds a dry salt pan instead of a lake; same layout */
  saltMask: Float32Array;
  /** river segments: x0 y0 z0 x1 y1 z1 halfWidth(rad), 7 floats each */
  rivers: Float32Array;
}

/** Elevation (km) and rainfall (0..1) for rows [j0, j1) of one face of the drainage grid. */
export function sampleHydroBand(world: World, M: number, face: number, j0: number, j1: number) {
  const elev = new Float32Array((j1 - j0) * M);
  const rain = new Float32Array((j1 - j0) * M);
  const lod = lodFor(M);
  const grid = new CoarseGrid(world, M, 4, face, j0, j1, Coarse.Terrain);
  const coarse = new Float64Array(C_SIZE);
  const terrain = new Float64Array(T_SIZE);
  const d = [0, 0, 0];
  for (let j = j0; j < j1; j++) {
    for (let i = 0; i < M; i++) {
      faceDirection(face, ((i + 0.5) / M) * 2 - 1, ((j + 0.5) / M) * 2 - 1, d);
      grid.sample(i, j, coarse);
      sampleTerrain(world, d[0]!, d[1]!, d[2]!, coarse, lod, terrain);
      elev[(j - j0) * M + i] = terrain[T_ELEV]!;
      rain[(j - j0) * M + i] = coarse[C_RAIN_LAT]!;
    }
  }
  return { elev, rain };
}

/** Index of the cell under a direction. */
const cellOf = (M: number, x: number, y: number, z: number) => {
  const [f, s, t] = directionToFace(x, y, z);
  const i = Math.min(M - 1, Math.max(0, Math.floor(((s + 1) / 2) * M)));
  const j = Math.min(M - 1, Math.max(0, Math.floor(((t + 1) / 2) * M)));
  return (f * M + j) * M + i;
};

/** 8-neighbour table across face edges (corner cells may list a neighbour twice). */
function neighbours(M: number) {
  const nb = new Int32Array(6 * M * M * 8);
  const d = [0, 0, 0];
  for (let f = 0; f < 6; f++) {
    for (let j = 0; j < M; j++) {
      for (let i = 0; i < M; i++) {
        const c = (f * M + j) * M + i;
        let k = 0;
        for (let dj = -1; dj <= 1; dj++) {
          for (let di = -1; di <= 1; di++) {
            if (!di && !dj) continue;
            const ii = i + di;
            const jj = j + dj;
            if (ii >= 0 && ii < M && jj >= 0 && jj < M) {
              nb[c * 8 + k++] = (f * M + jj) * M + ii;
            } else {
              faceDirection(f, ((ii + 0.5) / M) * 2 - 1, ((jj + 0.5) / M) * 2 - 1, d);
              nb[c * 8 + k++] = cellOf(M, d[0]!, d[1]!, d[2]!);
            }
          }
        }
      }
    }
  }
  return nb;
}

/** Binary min-heap of cell indices keyed by elevation. */
class Heap {
  private keys: Float64Array;
  private vals: Int32Array;
  size = 0;
  constructor(capacity: number) {
    this.keys = new Float64Array(capacity);
    this.vals = new Int32Array(capacity);
  }
  push(key: number, val: number) {
    let i = this.size++;
    const keys = this.keys;
    const vals = this.vals;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p]! <= key) break;
      keys[i] = keys[p]!;
      vals[i] = vals[p]!;
      i = p;
    }
    keys[i] = key;
    vals[i] = val;
  }
  pop(): number {
    const keys = this.keys;
    const vals = this.vals;
    const top = vals[0]!;
    const n = --this.size;
    const key = keys[n]!;
    const val = vals[n]!;
    let i = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= n) break;
      if (c + 1 < n && keys[c + 1]! < keys[c]!) c++;
      if (keys[c]! >= key) break;
      keys[i] = keys[c]!;
      vals[i] = vals[c]!;
      i = c;
    }
    keys[i] = key;
    vals[i] = val;
    return top;
  }
}

/**
 * Drainage from the sampled grid. `N` is the face size of the final maps, which sets how
 * wide rivers are drawn.
 */
export function routeWater(world: World, M: number, N: number, elev: Float32Array, rain: Float32Array): Hydrology {
  const cells = 6 * M * M;
  const nb = neighbours(M);
  const filled = new Float64Array(elev);
  const receiver = new Int32Array(cells).fill(-1);
  const order = new Int32Array(cells);
  const done = new Uint8Array(cells);
  let ordered = 0;

  // priority-flood from the sea: every land cell is reached through its lowest route to the
  // ocean, and the cell it was reached from is where it drains
  const heap = new Heap(cells);
  for (let c = 0; c < cells; c++) {
    if (elev[c]! < 0) {
      done[c] = 1;
      heap.push(elev[c]!, c);
    }
  }
  const eps = 1e-5;
  while (heap.size) {
    const c = heap.pop();
    order[ordered++] = c;
    for (let k = 0; k < 8; k++) {
      const n = nb[c * 8 + k]!;
      if (done[n]) continue;
      done[n] = 1;
      receiver[n] = c;
      filled[n] = Math.max(elev[n]!, filled[c]! + eps);
      heap.push(filled[n]!, n);
    }
  }

  // discharge: each cell's rain plus everything upstream, accumulated downstream
  const acc = new Float64Array(cells);
  for (let k = ordered - 1; k >= 0; k--) {
    const c = order[k]!;
    if (elev[c]! < 0) continue;
    acc[c] += 0.15 + rain[c]!;
    const r = receiver[c]!;
    if (r >= 0) acc[r] += acc[c]!;
  }

  // depressions fill with sediment to their spill level: flat basin floors, no pits
  const fill = new Float32Array(cells);
  const floodedMask = new Float32Array(cells);
  for (let c = 0; c < cells; c++) {
    fill[c] = Math.max(0, filled[c]!);
    if (elev[c]! >= 0 && filled[c]! - elev[c]! > 0.01) floodedMask[c] = 1;
  }

  // lakes: only the largest, deepest depressions hold water (small hollows are noise that
  // real erosion would have drained). In dry country the water is gone, leaving a salt pan.
  const saltMask = new Float32Array(cells);
  const lakeMask = new Float32Array(cells);
  const basin = new Int32Array(cells).fill(-1);
  const flooded = (c: number) => elev[c]! >= 0 && filled[c]! - elev[c]! > 0.02;
  const lakes: { members: number[]; salt: boolean }[] = [];
  const stack: number[] = [];
  for (let c = 0; c < cells; c++) {
    if (basin[c]! >= 0 || !flooded(c)) continue;
    const members: number[] = [];
    stack.push(c);
    basin[c] = c;
    let deepest = 0;
    let wet = 0;
    while (stack.length) {
      const m = stack.pop()!;
      members.push(m);
      deepest = Math.max(deepest, filled[m]! - elev[m]!);
      wet += rain[m]!;
      for (let k = 0; k < 8; k++) {
        const n = nb[m * 8 + k]!;
        if (basin[n]! < 0 && flooded(n)) {
          basin[n] = c;
          stack.push(n);
        }
      }
    }
    if (members.length >= 8 && deepest >= 0.12) lakes.push({ members, salt: wet / members.length < 0.3 });
  }
  lakes.sort((a, b) => b.members.length - a.members.length);
  for (const lake of lakes.slice(0, 30)) {
    for (const m of lake.members) (lake.salt ? saltMask : lakeMask)[m] = 1;
  }

  // valleys: depth grows with the square root of discharge
  const carve = new Float32Array(cells);
  for (let c = 0; c < cells; c++) {
    if (elev[c]! < 0) continue;
    const coast = smoothstep(0, 0.25, elev[c]!);
    carve[c] = Math.min(0.12, 0.008 * Math.sqrt(acc[c]!)) * (0.3 + 0.7 * coast);
  }
  const carveSmooth = blur(carve, nb, cells);

  const basins = new Float32Array(cells);
  for (let c = 0; c < cells; c++) basins[c] = Math.max(lakeMask[c]!, saltMask[c]!);
  const rivers = traceRivers(world, M, N, elev, acc, receiver, basins);
  return {
    M,
    carve: withHalo(M, carveSmooth),
    fill: withHalo(M, fill),
    flooded: withHalo(M, floodedMask),
    lakeMask: withHalo(M, lakeMask),
    saltMask: withHalo(M, saltMask),
    rivers,
  };
}

/** One pass of neighbour averaging, so valley troughs are smooth rather than cell-shaped. */
function blur(v: Float32Array, nb: Int32Array, cells: number) {
  const out = new Float32Array(cells);
  for (let c = 0; c < cells; c++) {
    let s = v[c]! * 2;
    for (let k = 0; k < 8; k++) s += v[nb[c * 8 + k]!]!;
    out[c] = s / 10;
  }
  return out;
}

/** Per-face grids padded with a halo copied from the neighbouring faces. */
function withHalo(M: number, v: Float32Array) {
  const P = M + 2 * HYDRO_HALO;
  const out = new Float32Array(6 * P * P);
  const d = [0, 0, 0];
  for (let f = 0; f < 6; f++) {
    for (let j = -HYDRO_HALO; j < M + HYDRO_HALO; j++) {
      for (let i = -HYDRO_HALO; i < M + HYDRO_HALO; i++) {
        let c: number;
        if (i >= 0 && i < M && j >= 0 && j < M) c = (f * M + j) * M + i;
        else {
          faceDirection(f, ((i + 0.5) / M) * 2 - 1, ((j + 0.5) / M) * 2 - 1, d);
          c = cellOf(M, d[0]!, d[1]!, d[2]!);
        }
        out[(f * P + j + HYDRO_HALO) * P + i + HYDRO_HALO] = v[c]!;
      }
    }
  }
  return out;
}

/**
 * The river network as drawable segments: channels whose discharge passes a threshold,
 * followed downstream from each source, smoothed (Chaikin) and given gentle meanders.
 */
function traceRivers(
  world: World, M: number, N: number, elev: Float32Array, acc: Float64Array, receiver: Int32Array, lake: Float32Array,
) {
  const cells = 6 * M * M;
  const minFlow = 45;
  const inLake = (c: number) => lake[c]! > 0;
  const isRiver = (c: number) => elev[c]! >= 0 && acc[c]! >= minFlow && !inLake(c);
  // a source is a river cell no other river cell drains into
  const fed = new Uint8Array(cells);
  for (let c = 0; c < cells; c++) {
    if (isRiver(c) && receiver[c]! >= 0) fed[receiver[c]!] = 1;
  }
  const visited = new Uint8Array(cells);
  const out: number[] = [];
  const centre = (c: number, o: number[]) => {
    const f = Math.floor(c / (M * M));
    const r = c - f * M * M;
    const j = Math.floor(r / M);
    const i = r - j * M;
    faceDirection(f, ((i + 0.5) / M) * 2 - 1, ((j + 0.5) / M) * 2 - 1, o);
  };
  const texel = Math.PI / 2 / N;
  const meander = world.noise.detail;
  const p = [0, 0, 0];

  for (let s = 0; s < cells; s++) {
    if (!isRiver(s) || fed[s]) continue;
    // walk downstream until the sea, a lake, or a river already drawn
    const pts: number[] = [];
    const flow: number[] = [];
    let c = s;
    for (;;) {
      centre(c, p);
      pts.push(p[0]!, p[1]!, p[2]!);
      flow.push(acc[c]!);
      if (visited[c]) break;
      visited[c] = 1;
      const r = receiver[c]!;
      if (r < 0) break;
      if (elev[r]! < 0 || inLake(r)) {
        // finish at the shore, halfway into the water cell
        centre(r, p);
        const n = pts.length;
        pts.push((pts[n - 3]! + p[0]!) / 2, (pts[n - 2]! + p[1]!) / 2, (pts[n - 1]! + p[2]!) / 2);
        flow.push(acc[c]!);
        break;
      }
      c = r;
    }
    if (pts.length < 6) continue;

    // Chaikin corner cutting, endpoints pinned, so D8 zig-zags become smooth bends
    let P = pts;
    let F = flow;
    for (let it = 0; it < 3; it++) {
      const np: number[] = [P[0]!, P[1]!, P[2]!];
      const nf: number[] = [F[0]!];
      for (let k = 0; k + 1 < F.length; k++) {
        for (const t of [0.25, 0.75]) {
          np.push(P[k * 3]! + (P[k * 3 + 3]! - P[k * 3]!) * t, P[k * 3 + 1]! + (P[k * 3 + 4]! - P[k * 3 + 1]!) * t, P[k * 3 + 2]! + (P[k * 3 + 5]! - P[k * 3 + 2]!) * t);
          nf.push(F[k]! + (F[k + 1]! - F[k]!) * t);
        }
      }
      const n = P.length;
      np.push(P[n - 3]!, P[n - 2]!, P[n - 1]!);
      nf.push(F[F.length - 1]!);
      P = np;
      F = nf;
    }

    // meanders: nudge points sideways (along p × tangent) by low-frequency noise
    const count = F.length;
    for (let k = 1; k + 1 < count; k++) {
      const x = P[k * 3]!;
      const y = P[k * 3 + 1]!;
      const z = P[k * 3 + 2]!;
      const tx = P[k * 3 + 3]! - P[k * 3 - 3]!;
      const ty = P[k * 3 + 4]! - P[k * 3 - 2]!;
      const tz = P[k * 3 + 5]! - P[k * 3 - 1]!;
      let sx = y * tz - z * ty;
      let sy = z * tx - x * tz;
      let sz = x * ty - y * tx;
      const sl = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
      const m = meander(x * 90, y * 90, z * 90) * (Math.PI / 2 / M) * 0.45;
      sx *= m / sl;
      sy *= m / sl;
      sz *= m / sl;
      const nx = x + sx;
      const ny = y + sy;
      const nz = z + sz;
      const l = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      P[k * 3] = nx * l;
      P[k * 3 + 1] = ny * l;
      P[k * 3 + 2] = nz * l;
    }

    for (let k = 0; k + 1 < count; k++) {
      // width: sub-texel for streams, a couple of texels for great rivers
      const w = Math.min(0.9, 0.25 + 0.12 * Math.sqrt(F[k]! / minFlow)) * texel * 0.5;
      out.push(P[k * 3]!, P[k * 3 + 1]!, P[k * 3 + 2]!, P[k * 3 + 3]!, P[k * 3 + 4]!, P[k * 3 + 5]!, w);
    }
  }
  return Float32Array.from(out);
}

/** Catmull-Rom sample of a haloed hydrology grid at face coordinates (s, t). */
export function sampleHydroGrid(grid: Float32Array, M: number, face: number, s: number, t: number) {
  const P = M + 2 * HYDRO_HALO;
  const fu = ((s + 1) / 2) * M - 0.5 + HYDRO_HALO;
  const fv = ((t + 1) / 2) * M - 0.5 + HYDRO_HALO;
  const i = Math.max(1, Math.min(P - 3, Math.floor(fu)));
  const j = Math.max(1, Math.min(P - 3, Math.floor(fv)));
  catmull(fu - i, wu);
  catmull(fv - j, wv);
  const base = face * P * P;
  let sum = 0;
  for (let b = 0; b < 4; b++) {
    const row = base + (j - 1 + b) * P + i - 1;
    sum += wv[b]! * (grid[row]! * wu[0]! + grid[row + 1]! * wu[1]! + grid[row + 2]! * wu[2]! + grid[row + 3]! * wu[3]!);
  }
  return sum;
}

const wu = [0, 0, 0, 0];
const wv = [0, 0, 0, 0];
const catmull = (t: number, w: number[]) => {
  const t2 = t * t;
  const t3 = t2 * t;
  w[0] = (-t3 + 2 * t2 - t) * 0.5;
  w[1] = (3 * t3 - 5 * t2 + 2) * 0.5;
  w[2] = (-3 * t3 + 4 * t2 + t) * 0.5;
  w[3] = (t3 - t2) * 0.5;
};
