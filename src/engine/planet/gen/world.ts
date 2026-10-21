// The planet "recipe": everything derived from the seed that every bake worker needs.
// Deterministic, so each worker rebuilds it from the seed instead of receiving it.
//
// Fields come in two frequency tiers. `sampleCoarse` evaluates everything smooth (domain
// warps, plates, the low continent octaves, climate, cloud flow) and is called on a sparse
// grid that the baker interpolates; `sampleTerrain` adds the high-frequency detail per texel.
import {
  erodedFbm, fbm, fbmRange, makeNoise, makeNoiseD, makeRand, octavesFor, ridged, smoothstep, type Noise, type NoiseD, type Rand,
} from './noise';
import { createWind, velocity, type Wind } from './wind';

export const PLANET_RADIUS_KM = 6371;

const NOISES = [
  'warpX', 'warpY', 'warpZ', 'warp2X', 'warp2Y', 'warp2Z',
  'plateWarp',
  'continent', 'coast', 'mountain', 'segment', 'orogen', 'hills', 'detail', 'shelf',
  'temperature', 'moisture', 'colour', 'colour2',
  'cloud', 'cloudCover', 'cloudFlow', 'cloudDetail', 'front',
] as const;
type NoiseName = (typeof NOISES)[number];

export interface World {
  seed: number;
  noise: Record<NoiseName, Noise>;
  /** gradient noise for slope-aware (eroded) terrain */
  erosion: NoiseD;
  /** per plate: centre xyz, angular velocity xyz, crust bias, size weight */
  plates: Float64Array;
  plateCount: number;
  wind: Wind;
  /** an ocean world: no land rises above the sea */
  ocean: boolean;
  /** low continent octaves at which the fine octaves start fading out (deep interior) */
  interiorLevel: number;
  /** continent field value at sea level */
  landThreshold: number;
  oceanFraction: number;
  /** how cloudy this planet is, 0 (clear skies) to 1 (stormy) */
  cloudCover: number;
}

const PLATE_STRIDE = 8;

const randomUnit = (rand: Rand) => {
  const u = rand() * 2 - 1;
  const phi = rand() * Math.PI * 2;
  const r = Math.sqrt(1 - u * u);
  return [r * Math.cos(phi), u, r * Math.sin(phi)] as const;
};

export interface WorldOptions {
  /** drown every continent: an ocean planet */
  ocean?: boolean;
}

export const createWorld = (seed: number, options: WorldOptions = {}): World => {
  const rand = makeRand(seed);
  const noise = {} as Record<NoiseName, Noise>;
  for (const name of NOISES) noise[name] = makeNoise(makeRand(`${seed}:${name}`));

  // plates: best-candidate sampling keeps centres spread out without a regular look
  const plateCount = 10 + Math.floor(rand() * 9);
  const plates = new Float64Array(plateCount * PLATE_STRIDE);
  for (let k = 0; k < plateCount; k++) {
    let best = randomUnit(rand);
    let bestScore = -Infinity;
    for (let c = 0; c < 12; c++) {
      const cand = randomUnit(rand);
      let nearest = Infinity;
      for (let j = 0; j < k; j++) {
        const o = j * PLATE_STRIDE;
        nearest = Math.min(nearest, Math.acos(Math.min(1, cand[0] * plates[o]! + cand[1] * plates[o + 1]! + cand[2] * plates[o + 2]!)));
      }
      if (nearest > bestScore) {
        bestScore = nearest;
        best = cand;
      }
    }
    // rotation about a random Euler pole
    const pole = randomUnit(rand);
    const speed = 0.4 + rand() * 1.1;
    const o = k * PLATE_STRIDE;
    plates.set(best, o);
    plates[o + 3] = pole[0] * speed;
    plates[o + 4] = pole[1] * speed;
    plates[o + 5] = pole[2] * speed;
    plates[o + 6] = rand() * 2 - 1; // crust bias: >0 tends continental
    plates[o + 7] = (rand() - 0.5) * 0.12; // size weight
  }

  const world: World = {
    seed,
    noise,
    erosion: makeNoiseD(makeRand(`${seed}:erosion`)),
    plates,
    plateCount,
    wind: createWind(seed, makeRand(`${seed}:wind`)),
    ocean: !!options.ocean,
    interiorLevel: 0,
    landThreshold: 0,
    oceanFraction: 0.6 + rand() * 0.08,
    cloudCover: rand(),
  };

  // sea level: the continent-field quantile that floods the chosen fraction of the sphere.
  // Two passes, because how the fine octaves fade inland depends on the coarse level.
  const samples = 6000;
  const low = new Float64Array(samples);
  const full = new Float64Array(samples);
  const coarse = new Float64Array(C_SIZE);
  for (let i = 0; i < samples; i++) {
    const y = 1 - (2 * (i + 0.5)) / samples;
    const r = Math.sqrt(1 - y * y);
    const phi = i * 2.399963229728653;
    sampleCoarse(world, r * Math.cos(phi), y, r * Math.sin(phi), coarse, Coarse.Continent);
    low[i] = coarse[C_CONT_LOW]!;
  }
  low.sort();
  world.interiorLevel = low[Math.floor(world.oceanFraction * samples)]!;
  for (let i = 0; i < samples; i++) {
    const y = 1 - (2 * (i + 0.5)) / samples;
    const r = Math.sqrt(1 - y * y);
    const phi = i * 2.399963229728653;
    sampleCoarse(world, r * Math.cos(phi), y, r * Math.sin(phi), coarse, Coarse.Continent);
    full[i] = continentField(world, coarse, r * Math.cos(phi), y, r * Math.sin(phi));
  }
  full.sort();
  world.landThreshold = full[Math.floor(world.oceanFraction * samples)]!;
  return world;
};

// ---- coarse tier --------------------------------------------------------------------------

export const C_QX = 0; // warped continent-space point
export const C_QY = 1;
export const C_QZ = 2;
export const C_CONT_LOW = 3; // low continent octaves + plate crust bias (raw)
export const C_COLLISION = 4; // collision-belt uplift
export const C_SPREAD_SEA = 5; // mid-ocean ridge uplift (before the sea mask)
export const C_RIFT = 6; // rift depth (before the land mask)
export const C_OROGEN = 7; // uplift of the old mountain chains inside the continents
export const C_SHELF = 8; // continental shelf width
export const C_TEMP = 9; // sea-level temperature, °C
export const C_RAIN_LAT = 10; // precipitation from the general circulation + regional noise
export const C_CLOUD_X = 11; // where the air came from: the point traced back along the wind
export const C_CLOUD_Y = 12;
export const C_CLOUD_Z = 13;
export const C_CLOUD_COVER = 14; // local cloud amount
export const C_MOIST = 15; // moisture carried in with the air (low octaves)
export const C_PATCH = 16; // regional patchiness of vegetation and rainfall
export const C_SOIL = 17; // soil tint variation
export const C_PUFF_ZONE = 18; // where fair-weather cumulus gathers
export const C_CELL_X = 19; // the point traced back a little way, for short-lived convection
export const C_CELL_Y = 20;
export const C_CELL_Z = 21;
// t̂t̂ᵀ for the normal t̂ across the dominant mountain belt (sign-free, so it interpolates
// across plate boundaries), weighted by how strongly the belt is folding: lets ridges run
// along their ranges
export const C_BELT_XX = 22;
export const C_BELT_XY = 23;
export const C_BELT_XZ = 24;
export const C_BELT_YY = 25;
export const C_BELT_YZ = 26;
export const C_BELT_ZZ = 27;
export const C_FIBRE_X = 28; // the point traced furthest back, for fibres drawn out by the flow
export const C_FIBRE_Y = 29;
export const C_FIBRE_Z = 30;
export const C_SIZE = 31;

// annual mean surface temperature (°C) and precipitation (0..1) by latitude, every 10°
const TEMP_BY_LAT = [27, 26.5, 23.5, 18.5, 12, 5, -2.5, -10, -19, -26];
const RAIN_BY_LAT = [1.0, 0.82, 0.42, 0.3, 0.55, 0.72, 0.68, 0.48, 0.32, 0.25];
// cloudiness by latitude: ITCZ, dry subtropics, stormy mid-latitudes
const CLOUD_BY_LAT = [0.62, 0.45, 0.22, 0.25, 0.45, 0.6, 0.6, 0.45, 0.35, 0.3];
const byLat = (table: readonly number[], latDeg: number) => {
  const f = Math.min(8.999, latDeg / 10);
  const i = Math.floor(f);
  const t = f - i;
  const a = table[i]!;
  const b = table[i + 1]!;
  return a + (b - a) * t * t * (3 - 2 * t);
};

/** Continent field (before the sea-level threshold) from coarse values plus the fine octaves. */
export function continentField(w: World, c: Float64Array, x: number, y: number, z: number, octaves = 11) {
  const low = c[C_CONT_LOW]!;
  // the fine octaves see only a quarter of the warp: the broad shapes keep their organic
  // folds, while coastline detail stays fractal instead of being combed into concentric streaks
  const qx = x + 0.25 * (c[C_QX]! - x);
  const qy = y + 0.25 * (c[C_QY]! - y);
  const qz = z + 0.25 * (c[C_QZ]! - z);
  const fine = fbmRange(w.noise.continent, qx, qy, qz, 3, octaves, 11, 2.03, 0.56);
  // the fine octaves fade deep inside continents: fractal coasts, but few holes far inland
  let v = low + fine * (1 - 0.65 * smoothstep(w.interiorLevel + 0.06, w.interiorLevel + 0.3, low));
  // archipelagos: noise peaks raised out of the shallow seas just off the coasts
  const off = low - w.interiorLevel;
  const shoal = smoothstep(-0.3, -0.04, off) * smoothstep(0.12, -0.02, off);
  if (shoal > 0) {
    const isl = w.noise.coast(qx * 15, qy * 15, qz * 15) + 0.5 * w.noise.coast(qx * 37 + 3, qy * 37, qz * 37);
    v += shoal * 0.22 * Math.max(0, isl - 0.35);
  }
  return v;
}

/** How much of the coarse tier to evaluate: sea-level calibration needs only the continent
 *  inputs, the drainage grid also terrain and climate, the map bake everything. */
export const enum Coarse {
  Continent,
  Terrain,
  All,
}

/** Smooth fields at unit direction (x, y, z), up to the given level. */
export function sampleCoarse(w: World, x: number, y: number, z: number, out: Float64Array, level = Coarse.All) {
  const n = w.noise;

  // continents: fBm on a twice-warped domain. The broad warp bends continents into organic
  // shapes, the finer one pulls out peninsulas, bays and inland seas.
  const wf = 1.1;
  let qx = x + 0.42 * fbm(n.warpX, x * wf, y * wf, z * wf, 3);
  let qy = y + 0.42 * fbm(n.warpY, x * wf, y * wf, z * wf, 3);
  let qz = z + 0.42 * fbm(n.warpZ, x * wf, y * wf, z * wf, 3);
  const wf2 = 3.0;
  const ax = fbm(n.warp2X, qx * wf2, qy * wf2, qz * wf2, 3);
  const ay = fbm(n.warp2Y, qx * wf2, qy * wf2, qz * wf2, 3);
  const az = fbm(n.warp2Z, qx * wf2, qy * wf2, qz * wf2, 3);
  qx += 0.07 * ax;
  qy += 0.07 * ay;
  qz += 0.07 * az;
  out[C_QX] = qx;
  out[C_QY] = qy;
  out[C_QZ] = qz;

  // plates: weighted nearest centres on a separately warped point
  const pf = 2.2;
  const px = x + 0.15 * fbm(n.plateWarp, x * pf, y * pf, z * pf, 4);
  const py = y + 0.15 * fbm(n.plateWarp, x * pf + 31, y * pf, z * pf, 4);
  const pz = z + 0.15 * fbm(n.plateWarp, x * pf, y * pf + 57, z * pf, 4);
  const P = w.plates;
  let b1 = -Infinity;
  let b2 = -Infinity;
  let i1 = 0;
  let i2 = 0;
  for (let k = 0, o = 0; k < w.plateCount; k++, o += PLATE_STRIDE) {
    const d = px * P[o]! + py * P[o + 1]! + pz * P[o + 2]! + P[o + 7]!;
    if (d > b1) {
      b2 = b1;
      i2 = i1;
      b1 = d;
      i1 = o;
    } else if (d > b2) {
      b2 = d;
      i2 = o;
    }
  }
  const sx = P[i1]! - P[i2]!;
  const sy = P[i1 + 1]! - P[i2 + 1]!;
  const sz = P[i1 + 2]! - P[i2 + 2]!;
  const sl = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
  const dist = (b1 - b2) / sl; // ~angular distance to the plate boundary

  // crust bias blends across the boundary
  const blend = 0.5 + 0.5 * smoothstep(0, 0.15, dist);
  const crust = P[i1 + 6]! * blend + P[i2 + 6]! * (1 - blend);
  out[C_CONT_LOW] = fbmRange(n.continent, qx, qy, qz, 0, 3, 11) + 0.3 * crust;
  if (level === Coarse.Continent) return;

  // boundary normal pointing from plate 1 into plate 2 (tangent to the sphere at p)
  const nx = -sx / sl;
  const ny = -sy / sl;
  const nz = -sz / sl;
  const nd = nx * x + ny * y + nz * z;
  const tx = nx - nd * x;
  const ty = ny - nd * y;
  const tz = nz - nd * z;
  // relative plate velocity (v = ω × p) along that normal: >0 converging
  const wx = P[i1 + 3]! - P[i2 + 3]!;
  const wy = P[i1 + 4]! - P[i2 + 4]!;
  const wz = P[i1 + 5]! - P[i2 + 5]!;
  const conv = (wy * z - wz * y) * tx + (wz * x - wx * z) * ty + (wx * y - wy * x) * tz;

  // collision belts along convergent boundaries, broken into segments of varying width
  const seg = smoothstep(-0.55, 0.25, fbm(n.segment, x * 2.7, y * 2.7, z * 2.7, 3));
  const width = 0.055 * (0.7 + 0.6 * smoothstep(-0.5, 0.5, fbm(n.segment, x * 4.9 + 7, y * 4.9, z * 4.9, 2)));
  const collision = Math.min(1.4, Math.max(0, conv) * 1.8) * seg * Math.exp(-(dist * dist) / (width * width));
  out[C_COLLISION] = collision;
  const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
  const ux = tx / tl;
  const uy = ty / tl;
  const uz = tz / tl;

  // old orogens: long sinuous chains inside the continents, along the zero line of a smooth
  // field and broken into segments; their normal is that field's gradient
  const of = 1.25;
  const e = 0.01;
  const ov = fbm(n.orogen, qx * of, qy * of, qz * of, 3);
  const gx = (fbm(n.orogen, (qx + e) * of, qy * of, qz * of, 3) - ov) / e;
  const gy = (fbm(n.orogen, qx * of, (qy + e) * of, qz * of, 3) - ov) / e;
  const gz = (fbm(n.orogen, qx * of, qy * of, (qz + e) * of, 3) - ov) / e;
  const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
  // distance to the zero line ≈ |value| / |gradient|, so the belts keep an even width
  const line = 1 - smoothstep(0.012, 0.04, Math.abs(ov) / gl);
  const segments = smoothstep(-0.05, 0.4, fbm(n.orogen, x * 1.9 + 11, y * 1.9, z * 1.9, 2));
  const onLand = smoothstep(0.02, 0.2, out[C_CONT_LOW]! - w.interiorLevel);
  const orogen = 0.85 * line * segments * onLand;
  out[C_OROGEN] = orogen;

  // belt normal tensor: collision belts and orogens, whichever dominates
  const ga = (gx * x + gy * y + gz * z) / gl;
  let ox = gx / gl - ga * x;
  let oy = gy / gl - ga * y;
  let oz = gz / gl - ga * z;
  const ol = Math.sqrt(ox * ox + oy * oy + oz * oz) || 1;
  ox /= ol;
  oy /= ol;
  oz /= ol;
  const fold = smoothstep(0.02, 0.35, collision);
  const fold2 = smoothstep(0.02, 0.35, orogen) * (1 - fold);
  out[C_BELT_XX] = ux * ux * fold + ox * ox * fold2;
  out[C_BELT_XY] = ux * uy * fold + ox * oy * fold2;
  out[C_BELT_XZ] = ux * uz * fold + ox * oz * fold2;
  out[C_BELT_YY] = uy * uy * fold + oy * oy * fold2;
  out[C_BELT_YZ] = uy * uz * fold + oy * oz * fold2;
  out[C_BELT_ZZ] = uz * uz * fold + oz * oz * fold2;
  const spread = Math.max(0, -conv);
  out[C_SPREAD_SEA] = spread * 1.4 * Math.exp(-(dist * dist) / 0.005);
  out[C_RIFT] = -Math.min(1, spread) * 0.15 * Math.exp(-(dist * dist) / 0.0007);
  out[C_SHELF] = 0.025 + 0.05 * smoothstep(-0.4, 0.6, fbm(n.shelf, x * 3, y * 3, z * 3, 3));

  // climate from latitude, softened by regional noise; drier deep inside continents
  const latDeg = (Math.abs(Math.asin(y)) * 180) / Math.PI;
  out[C_TEMP] = byLat(TEMP_BY_LAT, latDeg) + 4 * fbm(n.temperature, x * 2.2, y * 2.2, z * 2.2, 4);
  const inland = smoothstep(0.06, 0.5, out[C_CONT_LOW]! - w.interiorLevel);
  out[C_RAIN_LAT] = byLat(RAIN_BY_LAT, latDeg) * (1 - 0.5 * inland) + 0.3 * fbm(n.moisture, x * 2.4, y * 2.4, z * 2.4, 5);
  if (level === Coarse.Terrain) return;

  out[C_PATCH] = fbm(n.colour2, x * 11, y * 11, z * 11, 3);
  out[C_SOIL] = fbm(n.colour, x * 6, y * 6, z * 6, 4);
  out[C_PUFF_ZONE] = fbm(n.cloudDetail, x * 9, y * 9, z * 9, 2);
  const high = cloudFlow(w, x, y, z, out);
  out[C_CLOUD_COVER] =
    byLat(CLOUD_BY_LAT, latDeg) + 0.3 * fbm(n.cloudCover, x * 1.8, y * 1.8, z * 1.8, 3) + 0.25 * (out[C_RAIN_LAT]! - 0.5) - 0.35 * high;
}

/** How far back along the wind the cloud field is traced, in how many steps, and after how
 *  many of them the short-lived convective cells are read. */
const CLOUD_TRACE_TIME = 0.32;
const CLOUD_TRACE_STEPS = 16;
const CELL_TRACE_STEPS = 3;
/** Fibres are traced on, much further: long-lived high cloud drawn out into long strands. */
const FIBRE_TRACE_STEPS = 40;
/** The moisture field: fBm of this many octaves from this frequency, the low octaves on the
 *  coarse grid and the rest per texel at the same traced point. Weather systems are drawn
 *  out along the jets, so the field is squeezed north–south. */
export const MOISTURE_FREQ = 1.9;
export const MOISTURE_SQUEEZE = 1.5;
export const MOISTURE_OCTAVES = 4;
export const MOISTURE_COARSE_OCTAVES = 3;

const vel = new Float64Array(3);

/**
 * The large-scale weather that shapes the cloud. The air at the sample point is traced back
 * along the wind to where it came from, so whatever is read there comes out wound into
 * spirals round the cyclones and drawn out along the jets and eddies. Moisture (and the fine
 * fibres, per texel) are read at the far end; the short-lived convective cells after a few
 * steps only, so they keep their shape but line up into streets along the wind.
 * Returns how strongly an anticyclone clears the sky here.
 */
function cloudFlow(w: World, x: number, y: number, z: number, out: Float64Array) {
  const dt = CLOUD_TRACE_TIME / CLOUD_TRACE_STEPS;
  let px = x;
  let py = y;
  let pz = z;
  for (let s = 1; s <= CLOUD_TRACE_STEPS; s++) {
    velocity(w.wind, px, py, pz, vel);
    px -= vel[0]! * dt;
    py -= vel[1]! * dt;
    pz -= vel[2]! * dt;
    const l = 1 / Math.sqrt(px * px + py * py + pz * pz);
    px *= l;
    py *= l;
    pz *= l;
    if (s === CELL_TRACE_STEPS) {
      out[C_CELL_X] = px;
      out[C_CELL_Y] = py;
      out[C_CELL_Z] = pz;
    }
  }
  out[C_CLOUD_X] = px;
  out[C_CLOUD_Y] = py;
  out[C_CLOUD_Z] = pz;
  let fx = px;
  let fy = py;
  let fz = pz;
  for (let s = CLOUD_TRACE_STEPS; s < FIBRE_TRACE_STEPS; s++) {
    velocity(w.wind, fx, fy, fz, vel);
    fx -= vel[0]! * dt;
    fy -= vel[1]! * dt;
    fz -= vel[2]! * dt;
    const l = 1 / Math.sqrt(fx * fx + fy * fy + fz * fz);
    fx *= l;
    fy *= l;
    fz *= l;
  }
  out[C_FIBRE_X] = fx;
  out[C_FIBRE_Y] = fy;
  out[C_FIBRE_Z] = fz;

  // moisture: broad weather patterns, fronts and the moist cores of the storms, read where the
  // air came from, so cores and fronts come out wound into spiral arms and comma clouds
  const f = MOISTURE_FREQ;
  let m = fbmRange(w.noise.cloudCover, px * f, py * f * MOISTURE_SQUEEZE, pz * f, 0, MOISTURE_COARSE_OCTAVES, MOISTURE_OCTAVES);
  // fronts: the zero lines of a smooth field, sharpened into long bands and broken into
  // pieces; continuous in the storm belts, rarer toward the tropics
  const latDeg = (Math.abs(Math.asin(py)) * 180) / Math.PI;
  const fr = fbm(w.noise.front, px * 1.2, py * 1.6, pz * 1.2, 3);
  const band = Math.max(0, 1 - Math.abs(fr) * 3.2);
  const belt = 0.25 + 0.75 * smoothstep(20, 36, latDeg) * smoothstep(78, 58, latDeg);
  const pieces = smoothstep(-0.4, 0.2, fbm(w.noise.front, px * 1.7 + 7, py * 1.7, pz * 1.7, 2));
  m += 0.5 * band * band * belt * pieces;
  let high = 0;
  for (const v of w.wind.vortices) {
    if (v.kind === 'anticyclone') {
      const d2 = (2 - 2 * (x * v.x + y * v.y + z * v.z)) / (v.radius * v.radius);
      high = Math.max(high, Math.exp(-d2 * 0.9));
    } else {
      const d2 = (2 - 2 * (px * v.x + py * v.y + pz * v.z)) / (v.radius * v.radius);
      if (d2 < 12) m += (v.kind === 'tropical' ? 0.2 : 0.4) * Math.exp(-d2 * 0.3);
    }
  }
  out[C_MOIST] = m;
  return high;
}

// ---- fine tier ----------------------------------------------------------------------------

export const T_ELEV = 0; // km relative to sea level
export const T_MOUNT = 1; // mountain-ness 0..~1
export const T_DETAIL = 2; // a fine noise value in about [-1, 1], for roughening edges
export const T_SIZE = 3;

/** Octave counts for the fine terrain noise at a given face resolution. */
export interface TerrainLod {
  continent: number;
  ridge: number;
  hills: number;
  rugged: number;
}
export const lodFor = (N: number): TerrainLod => ({
  continent: Math.min(11, octavesFor(1, 2.03, N)),
  ridge: octavesFor(14, 2.05, N),
  hills: octavesFor(8, 2.03, N),
  rugged: octavesFor(22, 2.05, N),
});

/** Elevation at (x, y, z) given the interpolated coarse fields there. */
export function sampleTerrain(w: World, x: number, y: number, z: number, c: Float64Array, lod: TerrainLod, out: Float64Array) {
  const n = w.noise;
  const cl = continentField(w, c, x, y, z, lod.continent) - w.landThreshold;
  const landness = smoothstep(-0.03, 0.05, cl);
  // how far inland, from the smooth low octaves only: the warped fine octaves are streaky
  // and would comb the relief into parallel ridges
  const interior = smoothstep(0.0, 0.3, c[C_CONT_LOW]! - w.landThreshold);

  // base relief: coastal plains rising to interior plateaus; shelf, slope and abyss offshore
  let h: number;
  if (cl >= 0) {
    h = 0.015 + 0.08 * smoothstep(0, 0.18, cl) + 0.9 * interior * interior;
  } else {
    const shelf = c[C_SHELF]!;
    h = -0.05 - 0.12 * smoothstep(0, shelf, -cl) - 4.1 * smoothstep(shelf, shelf + 0.16, -cl);
  }

  // mountains: collision belts and old chains, carved by ridged multifractal noise
  const uplift = Math.max(c[C_COLLISION]!, c[C_OROGEN]!);
  out[T_MOUNT] = uplift;
  if (uplift > 0.004) {
    // squeeze the noise across the belt so crests and valleys run along the range
    const squeeze = 2.6;
    const bx = c[C_BELT_XX]! * x + c[C_BELT_XY]! * y + c[C_BELT_XZ]! * z;
    const by = c[C_BELT_XY]! * x + c[C_BELT_YY]! * y + c[C_BELT_YZ]! * z;
    const bz = c[C_BELT_XZ]! * x + c[C_BELT_YZ]! * y + c[C_BELT_ZZ]! * z;
    const mf = 11;
    const rx = (x + squeeze * bx) * mf;
    const ry = (y + squeeze * by) * mf;
    const rz = (z + squeeze * bz) * mf;
    const ridge = ridged(n.mountain, rx, ry, rz, lod.ridge, 2.05, 0.55);
    h += uplift * (1.4 + 4.4 * landness) * (0.15 + 1.25 * ridge * ridge);
  }

  // divergent boundaries: mid-ocean ridges at sea, rift valleys on land
  h += c[C_SPREAD_SEA]! * (1 - landness) + c[C_RIFT]! * interior;

  // hills (only ever raise land, so they never punch lakes into the lowlands), then eroded
  // ruggedness that grows with height and uplift: calm lowlands, weathered uplands
  out[T_DETAIL] = 0;
  if (landness > 0) {
    const hillAmp = landness * (0.02 + 0.22 * interior);
    const hills = fbm(n.hills, x * 8, y * 8, z * 8, lod.hills);
    out[T_DETAIL] = hills;
    h += hillAmp * (0.5 + 0.5 * hills);
    const rugged = landness * (0.02 + 0.28 * smoothstep(0.35, 1.5, h) + 0.7 * uplift);
    h += rugged * (0.5 + 0.8 * erodedFbm(w.erosion, x, y, z, 22, lod.rugged, 2.05, 0.5, 0.35));
  }
  // an ocean world keeps only a faint echo of its sea floor, everywhere deep
  out[T_ELEV] = w.ocean ? -3.6 + 0.2 * Math.max(-3, Math.min(3, h)) : h;
}
