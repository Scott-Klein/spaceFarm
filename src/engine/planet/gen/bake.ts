// Bakes rows [j0, j1) of one cube face into the three planet maps:
//   albedo  RGB = sRGB surface colour, A = water coverage
//   relief  RGB = companded object-space surface gradient (exaggerated), A = elevation
//   clouds  R = density, GBA = companded object-space density gradient
import { FACES, faceDirection } from '../cubeSphere';
import { cloudDensity } from './clouds';
import { CoarseGrid } from './coarseGrid';
import { sampleHydroGrid, type Hydrology } from './hydrology';
import { clamp01, fbm, smoothstep } from './noise';
import {
  C_PATCH, C_RAIN_LAT, C_SIZE, C_SOIL, C_TEMP, PLANET_RADIUS_KM,
  Coarse, T_DETAIL, T_ELEV, T_MOUNT, T_SIZE, lodFor, sampleTerrain, type World,
} from './world';

/** Relief exaggeration: real slopes are invisible at planetary scale, maps exaggerate them too. */
export const RELIEF_EXAGGERATION = 120;
/** Gradient magnitude that maps to the end of the 8-bit range. */
export const RELIEF_MAX = 4;
/** Cloud density gradient (per radian) that maps to the end of the 8-bit range. */
export const CLOUD_GRADIENT_MAX = 400;

export interface BandMaps {
  albedo: Uint8Array;
  relief: Uint8Array;
  clouds: Uint8Array;
}

const encodeSigned = (v: number, max: number) => {
  const t = Math.max(-1, Math.min(1, v / max));
  return Math.round(127.5 + 127.5 * Math.sign(t) * Math.sqrt(Math.abs(t)));
};

export function bakeBand(world: World, N: number, face: number, j0: number, j1: number, hydro?: Hydrology): BandMaps {
  const spacing = N >= 512 ? 8 : 4;
  // the finest cloud strands need about a kilotexel per face to resolve
  const fineClouds = N >= 768;
  const lod = lodFor(N);
  const grid = new CoarseGrid(world, N, spacing, face, j0, j1, Coarse.All);
  const rows = j1 - j0;
  const W = N + 2;
  const H = rows + 2;
  const dirs = new Float64Array(W * H * 3);
  const elev = new Float32Array(W * H);
  const mount = new Float32Array(W * H);
  const cloud = new Float32Array(W * H);
  const temp = new Float32Array(W * H);
  const rain = new Float32Array(W * H);
  const patch = new Float32Array(W * H);
  const soil = new Float32Array(W * H);
  const lake = new Float32Array(W * H);
  const salt = new Float32Array(W * H);
  const coarse = new Float64Array(C_SIZE);
  const terrain = new Float64Array(T_SIZE);

  // pass 1: elevation and cloud density on the band plus a one-texel halo (evaluated past the
  // face edge, so gradients have no seams)
  for (let jj = 0; jj < H; jj++) {
    const j = j0 + jj - 1;
    const t = ((j + 0.5) / N) * 2 - 1;
    for (let ii = 0; ii < W; ii++) {
      const i = ii - 1;
      const k = jj * W + ii;
      faceDirection(face, ((i + 0.5) / N) * 2 - 1, t, dirs, k * 3);
      grid.sample(i, j, coarse);
      sampleTerrain(world, dirs[k * 3]!, dirs[k * 3 + 1]!, dirs[k * 3 + 2]!, coarse, lod, terrain);
      let h = terrain[T_ELEV]!;
      if (hydro && h > 0) {
        const s = ((i + 0.5) / N) * 2 - 1;
        const flooded = sampleHydroGrid(hydro.flooded, hydro.M, face, s, t);
        // river valleys: deep in the uplands, fading out over the flood plains and basins
        const carve = sampleHydroGrid(hydro.carve, hydro.M, face, s, t) * smoothstep(0.02, 0.6, h) * (1 - clamp01(flooded));
        h = Math.max(Math.min(h, 0.03), h - carve);
        if (flooded > 0.05) {
          // depressions: the ground levels out at the basin's spill level, under still water
          // where a lake fills the basin (or a salt crust where it has dried out)
          const level = sampleHydroGrid(hydro.fill, hydro.M, face, s, t);
          const below = smoothstep(-0.002, 0.008, level - h);
          const wet = sampleHydroGrid(hydro.lakeMask, hydro.M, face, s, t);
          const dry = sampleHydroGrid(hydro.saltMask, hydro.M, face, s, t);
          const basin = wet + dry;
          if (basin > 0.2) {
            const shore = smoothstep(0.42, 0.58, basin + 0.14 * terrain[T_DETAIL]!) * below;
            const saltShare = dry / Math.max(1e-6, basin);
            lake[k] = shore * (1 - saltShare);
            salt[k] = shore * saltShare;
          }
          if (level > h) h += (level - h) * smoothstep(0.05, 0.6, flooded);
        }
      }
      elev[k] = h;
      mount[k] = terrain[T_MOUNT]!;
      temp[k] = coarse[C_TEMP]!;
      rain[k] = coarse[C_RAIN_LAT]!;
      patch[k] = coarse[C_PATCH]!;
      soil[k] = coarse[C_SOIL]!;
      cloud[k] = cloudDensity(world, dirs[k * 3]!, dirs[k * 3 + 1]!, dirs[k * 3 + 2]!, coarse, fineClouds);
    }
  }

  const river = new Float32Array(W * H);
  const riverNear = new Float32Array(W * H);
  if (hydro) drawRivers(hydro.rivers, face, N, j0, W, H, dirs, river, riverNear);

  const albedo = new Uint8Array(N * rows * 4);
  const relief = new Uint8Array(N * rows * 4);
  const clouds = new Uint8Array(N * rows * 4);
  const rgb = [0, 0, 0];
  const grad = [0, 0, 0];
  const gradScale = RELIEF_EXAGGERATION / PLANET_RADIUS_KM;
  const above = (v: number) => (v > 0 ? v : 0);
  // the Laplacian of a texel-scale bump shrinks with texel size: normalise to N = 1024
  const cavityScale = -1.6 * (N / 1024) * (N / 1024);

  // surface gradient from central differences: solve g·Pu = fu, g·Pv = fv with g ⟂ p
  const gradient = (k: number, fu: number, fv: number, out: number[]) => {
    const kl = (k - 1) * 3;
    const kr = (k + 1) * 3;
    const kd = (k - W) * 3;
    const ku = (k + W) * 3;
    const pux = (dirs[kr]! - dirs[kl]!) * 0.5;
    const puy = (dirs[kr + 1]! - dirs[kl + 1]!) * 0.5;
    const puz = (dirs[kr + 2]! - dirs[kl + 2]!) * 0.5;
    const pvx = (dirs[ku]! - dirs[kd]!) * 0.5;
    const pvy = (dirs[ku + 1]! - dirs[kd + 1]!) * 0.5;
    const pvz = (dirs[ku + 2]! - dirs[kd + 2]!) * 0.5;
    const guu = pux * pux + puy * puy + puz * puz;
    const guv = pux * pvx + puy * pvy + puz * pvz;
    const gvv = pvx * pvx + pvy * pvy + pvz * pvz;
    const det = guu * gvv - guv * guv;
    const a = (gvv * fu - guv * fv) / det;
    const b = (guu * fv - guv * fu) / det;
    out[0] = a * pux + b * pvx;
    out[1] = a * puy + b * pvy;
    out[2] = a * puz + b * pvz;
  };

  for (let jj = 1; jj <= rows; jj++) {
    for (let ii = 1; ii <= N; ii++) {
      const k = jj * W + ii;
      const h = elev[k]!;
      const o = ((jj - 1) * N + (ii - 1)) * 4;

      gradient(k, (above(elev[k + 1]!) - above(elev[k - 1]!)) * 0.5, (above(elev[k + W]!) - above(elev[k - W]!)) * 0.5, grad);
      const slope = Math.sqrt(grad[0]! ** 2 + grad[1]! ** 2 + grad[2]! ** 2) / PLANET_RADIUS_KM;
      // ice sheets bury the relief under smooth domes
      const iceSheet = 1 - 0.9 * smoothstep(-4, -12, temp[k]!);
      relief[o] = encodeSigned(grad[0]! * gradScale * iceSheet, RELIEF_MAX);
      relief[o + 1] = encodeSigned(grad[1]! * gradScale * iceSheet, RELIEF_MAX);
      relief[o + 2] = encodeSigned(grad[2]! * gradScale * iceSheet, RELIEF_MAX);
      relief[o + 3] = Math.round(clamp01(0.5 + h / 16) * 255);

      // anti-aliased coastline: fraction of the texel below sea level, from h and its spread
      const spread = Math.abs(elev[k + 1]! - elev[k - 1]!) * 0.5 + Math.abs(elev[k + W]! - elev[k - W]!) * 0.5 + 1e-4;
      const sea = clamp01(0.5 - h / spread);
      surfaceColour(world, dirs[k * 3]!, dirs[k * 3 + 1]!, dirs[k * 3 + 2]!, h, mount[k]!, slope, sea, temp[k]!, rain[k]! + 0.1 * riverNear[k]!, patch[k]!, soil[k]!, rgb);
      if (salt[k]! > 0) {
        // dry lake beds: pale crust, brightest in the middle where the brine last evaporated
        const crust = salt[k]! * (1 - sea);
        mix(rgb, rgb, SALT_PAN, crust * (0.45 + 0.4 * crust + 0.15 * patch[k]!));
      }
      // rivers: thin grey-blue threads; lakes: dark, still water
      const stream = river[k]! * (1 - salt[k]!) * (1 - sea) * (1 - lake[k]!);
      if (stream > 0) mix(rgb, rgb, temp[k]! < -6 ? SEA_ICE : RIVER_WATER, stream * 0.6);
      const still = lake[k]! * (1 - sea);
      if (still > 0) mix(rgb, rgb, temp[k]! < -6 ? SEA_ICE : FRESH_WATER, still);
      const fresh = Math.max(still, stream * 0.6);
      const water = Math.max(sea, fresh);
      // cavity: valleys (concave) darken, crests (convex) brighten, like a shaded relief map
      const laplacian = above(elev[k + 1]!) + above(elev[k - 1]!) + above(elev[k + W]!) + above(elev[k - W]!) - 4 * above(h);
      const cavity = Math.max(0.62, Math.min(1.25, 1 + laplacian * cavityScale)) * (1 - water) + water;
      albedo[o] = Math.min(255, Math.round(rgb[0]! * cavity));
      albedo[o + 1] = Math.min(255, Math.round(rgb[1]! * cavity));
      albedo[o + 2] = Math.min(255, Math.round(rgb[2]! * cavity));
      albedo[o + 3] = Math.round(water * 255);

      gradient(k, (cloud[k + 1]! - cloud[k - 1]!) * 0.5, (cloud[k + W]! - cloud[k - W]!) * 0.5, grad);
      clouds[o] = Math.round(clamp01(cloud[k]!) * 255);
      clouds[o + 1] = encodeSigned(grad[0]!, CLOUD_GRADIENT_MAX);
      clouds[o + 2] = encodeSigned(grad[1]!, CLOUD_GRADIENT_MAX);
      clouds[o + 3] = encodeSigned(grad[2]!, CLOUD_GRADIENT_MAX);
    }
  }
  return { albedo, relief, clouds };
}

// ---- rivers ----------------------------------------------------------------------------------

/** Rasterises river segments that touch this band: anti-aliased channel coverage, plus a soft
 *  falloff a few texels wide for the greener land along the banks. */
function drawRivers(
  rivers: Float32Array, face: number, N: number, j0: number, W: number, H: number, dirs: Float64Array,
  mask: Float32Array, near: Float32Array,
) {
  const A = FACES[face]!;
  const texel = Math.PI / 2 / N;
  const toTexel = (x: number, y: number, z: number, out: number[]) => {
    const f = x * A[0] + y * A[1] + z * A[2];
    if (f < 0.2) return false;
    out[0] = ((Math.atan((x * A[3] + y * A[4] + z * A[5]) / f) / (Math.PI / 4) + 1) / 2) * N - 0.5;
    out[1] = ((Math.atan((x * A[6] + y * A[7] + z * A[8]) / f) / (Math.PI / 4) + 1) / 2) * N - 0.5;
    return true;
  };
  const a = [0, 0];
  const b = [0, 0];
  const bankReach = 1.5;
  for (let r = 0; r < rivers.length; r += 7) {
    const x0 = rivers[r]!, y0 = rivers[r + 1]!, z0 = rivers[r + 2]!;
    const x1 = rivers[r + 3]!, y1 = rivers[r + 4]!, z1 = rivers[r + 5]!;
    const hw = rivers[r + 6]!;
    if (!toTexel(x0, y0, z0, a) || !toTexel(x1, y1, z1, b)) continue;
    const reach = hw / texel + bankReach;
    const jMin = Math.max(j0 - 1, Math.floor(Math.min(a[1]!, b[1]!) - reach));
    const jMax = Math.min(j0 + H - 2, Math.ceil(Math.max(a[1]!, b[1]!) + reach));
    if (jMin > jMax) continue;
    const iMin = Math.max(-1, Math.floor(Math.min(a[0]!, b[0]!) - reach));
    const iMax = Math.min(N, Math.ceil(Math.max(a[0]!, b[0]!) + reach));
    const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
    const len2 = sx * sx + sy * sy + sz * sz || 1e-12;
    for (let j = jMin; j <= jMax; j++) {
      for (let i = iMin; i <= iMax; i++) {
        const k = (j - j0 + 1) * W + i + 1;
        const px = dirs[k * 3]! - x0, py = dirs[k * 3 + 1]! - y0, pz = dirs[k * 3 + 2]! - z0;
        const t = Math.max(0, Math.min(1, (px * sx + py * sy + pz * sz) / len2));
        const dx = px - sx * t, dy = py - sy * t, dz = pz - sz * t;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const cover = (hw - dist) / texel + 0.5;
        if (cover > mask[k]!) mask[k] = Math.min(1, cover);
        const bank = smoothstep(bankReach * texel, hw, dist);
        if (bank > near[k]!) near[k] = bank;
      }
    }
  }
}

// ---- surface colour ------------------------------------------------------------------------

type RGB = readonly [number, number, number];
const OCEAN_DEEP: RGB = [24, 52, 80];
const OCEAN_MID: RGB = [26, 60, 96];
const OCEAN_SHELF: RGB = [30, 80, 114];
const OCEAN_SHALLOW: RGB = [46, 116, 132];
const SAND: RGB = [234, 208, 160];
const SAND_ORANGE: RGB = [214, 170, 114];
const DRY_SOIL: RGB = [178, 142, 98];
const STEPPE: RGB = [166, 156, 100];
const GRASS: RGB = [124, 138, 66];
const FOREST_TEMPERATE: RGB = [42, 78, 32];
const FOREST_TROPICAL: RGB = [27, 60, 23];
const FOREST_BOREAL: RGB = [32, 54, 34];
const TUNDRA: RGB = [124, 118, 98];
const ROCK: RGB = [104, 98, 92];
const SNOW: RGB = [236, 240, 246];
const SEA_ICE: RGB = [218, 228, 238];
const FRESH_WATER: RGB = [16, 40, 58];
const RIVER_WATER: RGB = [58, 82, 96];
const SALT_PAN: RGB = [214, 204, 182];

const mix = (out: number[], a: RGB | number[], b: RGB | number[], t: number) => {
  out[0] = a[0]! + (b[0]! - a[0]!) * t;
  out[1] = a[1]! + (b[1]! - a[1]!) * t;
  out[2] = a[2]! + (b[2]! - a[2]!) * t;
};

const land = [0, 0, 0];
const veg = [0, 0, 0];
const soil = [0, 0, 0];
const sea = [0, 0, 0];

function surfaceColour(
  w: World, x: number, y: number, z: number, h: number, mount: number,
  slope: number, water: number, tSea: number, rainLat: number, patch: number, soilTint: number, out: number[],
) {
  const n = w.noise;
  const hl = h > 0 ? h : 0;
  const temp = tSea - 6.5 * hl;

  if (water < 1) {
    // precipitation: general circulation, wetter on mountains; patchy at the regional scale so
    // biome edges break up instead of following smooth climate contours
    const rain = clamp01(rainLat + 0.3 * mount + 0.12 * patch);

    // vegetation needs more rain where it is hot (evaporation)
    const need = 0.22 + 0.01 * Math.max(0, temp - 5);
    const vegetation = smoothstep(need - 0.06, need + 0.12, rain) * smoothstep(-9, 3, temp);

    // soils: sand where hot and dry, browner where cooler or damper
    mix(soil, SAND, SAND_ORANGE, clamp01(0.5 + 0.9 * soilTint));
    mix(soil, soil, DRY_SOIL, smoothstep(22, 8, temp) * 0.6 + 0.4 * smoothstep(0.08, 0.3, rain));
    mix(soil, soil, STEPPE, smoothstep(0.12, 0.3, rain) * 0.55);

    // vegetation colour by climate: tropical → temperate → boreal; grassland where drier
    if (temp > 17) mix(veg, FOREST_TEMPERATE, FOREST_TROPICAL, smoothstep(17, 25, temp));
    else mix(veg, FOREST_BOREAL, FOREST_TEMPERATE, smoothstep(1, 12, temp));
    const grassy = smoothstep(need + 0.22, need + 0.04, rain) + 0.35 * patch;
    mix(veg, veg, GRASS, clamp01(grassy) * 0.8);

    mix(land, soil, veg, vegetation);

    // cold: tundra, then permanent snow and ice
    mix(land, land, TUNDRA, smoothstep(3, -3, temp) * 0.85);
    // bare rock in the mountain belts, on steep slopes and on high ground
    const rock = clamp01(smoothstep(0.12, 0.55, mount) * 0.85 + smoothstep(0.02, 0.08, slope) * 0.6 + smoothstep(2.0, 3.6, hl) * 0.6);
    mix(land, land, ROCK, rock);
    // snow where it is cold enough, at altitude or toward the poles; patchy at its edge
    if (temp < 3.5) {
      // snow lies on crests and gentle ground; the steepest faces shed it and show rock
      const shed = 1 - 0.75 * smoothstep(0.1, 0.35, slope) * smoothstep(-25, -5, temp);
      const snow = smoothstep(0.5, -4.5, temp + 3 * fbm(n.colour, x * 30, y * 30, z * 30, 3)) * shed;
      mix(land, land, SNOW, snow);
    }

    // fine mottling: canopy, fields, rock outcrops
    const mottle = 1 + 0.16 * fbm(n.colour, x * 90, y * 90, z * 90, 2);
    land[0] *= mottle;
    land[1] *= mottle;
    land[2] *= mottle;
  }

  if (water > 0) {
    // ocean by depth, frozen near the poles
    const depth = h < 0 ? -h : 0;
    mix(sea, OCEAN_SHALLOW, OCEAN_SHELF, smoothstep(0.02, 0.14, depth));
    mix(sea, sea, OCEAN_MID, smoothstep(0.18, 1.2, depth));
    mix(sea, sea, OCEAN_DEEP, smoothstep(1.6, 4.4, depth));
    if (tSea < -1) {
      // pack ice, ragged where it thins out and cracked by a few long leads
      const ice = smoothstep(-5, -9, tSea + 3 * fbm(n.colour, x * 22, y * 22, z * 22, 3));
      if (ice > 0) {
        const lead = 1 - Math.abs(fbm(n.colour2, x * 14, y * 14, z * 14, 2));
        mix(sea, sea, SEA_ICE, ice * (1 - 0.18 * smoothstep(0.95, 0.995, lead)));
      }
    }
  }

  mix(out, land, sea, water);
  out[0] = Math.min(255, Math.round(out[0]!));
  out[1] = Math.min(255, Math.round(out[1]!));
  out[2] = Math.min(255, Math.round(out[2]!));
}
