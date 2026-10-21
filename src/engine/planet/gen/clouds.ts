// Cloud density per texel. The coarse tier (world.ts) has already traced each point's air back
// along the wind; here the cloud is built from what is read there: moisture for the large
// shapes, convective cells for cumulus and the lumpy texture of cloud decks, and fine fibres,
// drawn out by the flow, for veils and streaks.
import { clamp01, fbm, fbmRange, smoothstep } from './noise';
import {
  C_CELL_X, C_CELL_Y, C_CELL_Z, C_CLOUD_COVER, C_CLOUD_X, C_CLOUD_Y, C_CLOUD_Z, C_FIBRE_X, C_FIBRE_Y, C_FIBRE_Z,
  C_MOIST, C_PUFF_ZONE,
  MOISTURE_COARSE_OCTAVES, MOISTURE_FREQ, MOISTURE_OCTAVES, MOISTURE_SQUEEZE, type World,
} from './world';

const hash = (i: number, j: number, k: number, s: number) => {
  let h = (Math.imul(i, 0x8da6b343) ^ Math.imul(j, 0xd8163841) ^ Math.imul(k, 0xcb1ab31f) ^ s) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b);
  return (h ^ (h >>> 16)) >>> 0;
};

/**
 * Cellular "billow" noise: one jittered sphere per lattice cell, each with its own radius and
 * strength. Their slices through the planet's surface are packed round cells of varied size;
 * returns the strongest, 0..1.
 */
export function cells(x: number, y: number, z: number, seed: number) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  let best = 0;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const cx = xi + dx;
        const cy = yi + dy;
        const cz = zi + dz;
        const h = hash(cx, cy, cz, seed);
        const ox = cx + (h & 1023) / 1024 - x;
        const oy = cy + ((h >>> 10) & 1023) / 1024 - y;
        const oz = cz + ((h >>> 20) & 1023) / 1024 - z;
        const d2 = ox * ox + oy * oy + oz * oz;
        if (d2 >= 0.81) continue;
        const g = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
        const r = 0.5 + (0.4 * (g & 255)) / 255;
        const t = 1 - d2 / (r * r);
        if (t <= 0) continue;
        const v = (0.55 + (0.45 * ((g >>> 8) & 255)) / 255) * t * t * (3 - 2 * t);
        if (v > best) best = v;
      }
    }
  }
  return best;
}

const cyclone = new Float64Array(3);

/**
 * The two cloud layers' fields at p. out[0]: low cloud (cumulus fields, decks, frontal bands)
 * whose convective cells give it crisp, lumpy edges; out[1]: high veils, soft and fibrous;
 * out[2]: the fibre texture; out[3]: the cells; out[4]: how convective the regime is;
 * out[5]: 0 in the eye of a tropical cyclone, else 1; out[6]: a cyclone's central overcast.
 */
export function cloudFields(w: World, x: number, y: number, z: number, c: Float64Array, fine: boolean, out: Float64Array) {
  const qx = c[C_CLOUD_X]!;
  const qy = c[C_CLOUD_Y]!;
  const qz = c[C_CLOUD_Z]!;
  // moisture carried in with the air: the coarse grid's low octaves plus the rest
  const f = MOISTURE_FREQ;
  const moisture =
    c[C_MOIST]! +
    fbmRange(w.noise.cloudCover, qx * f, qy * f * MOISTURE_SQUEEZE, qz * f, MOISTURE_COARSE_OCTAVES, MOISTURE_OCTAVES, MOISTURE_OCTAVES);
  // tropical cyclones
  tropicalCyclones(w, x, y, z, cyclone);
  // regional bias: climate bands, anticyclones, and how cloudy this planet is overall
  const m = moisture + 0.9 * cyclone[0]! + 0.55 * (c[C_CLOUD_COVER]! - 0.5) + 0.26 * (w.cloudCover - 0.5);
  // regime: convective (cumulus fields, lumpy decks) or stratiform (smooth decks, fibrous veils)
  const conv = smoothstep(0.0, 0.45, c[C_PUFF_ZONE]!);
  // mid-scale texture is read only a little way back along the wind: lined up with the flow
  // but not wound into the long spirals the moisture makes
  const sx = c[C_CELL_X]!;
  const sy = c[C_CELL_Y]!;
  const sz = c[C_CELL_Z]!;
  // convection, two octaves of small cells: the fine speckle of stratocumulus and the lumpy
  // tops of cumulus. Short-lived, so not carried by the wind at all: they stay round
  const cf = 150;
  const b = 0.7 * cells(x * cf, y * cf, z * cf, w.seed) + 0.3 * cells(x * cf * 2.3 + 5.3, y * cf * 2.3, z * cf * 2.3, w.seed ^ 0x5f3759df);
  // fibres: fine texture carried a long way along the wind, drawn out into strands wherever
  // the large-scale flow shears (round the storms, along the jets) and plain elsewhere
  const fx = c[C_FIBRE_X]!;
  const fy = c[C_FIBRE_Y]!;
  const fz = c[C_FIBRE_Z]!;
  const detail = fbm(w.noise.cloud, fx * 55, fy * 55, fz * 55, fine ? 4 : 3, 2.1, 0.5);
  // mid-scale break-up: decks tear into broken fields and rafts
  const breakup = fbm(w.noise.cloudDetail, sx * 9, sy * 9, sz * 9, 3);
  // low cloud carries the cells only (its texture is lumpy, not stringy); a cyclone's central
  // overcast is a smooth shield
  const smooth = 1 - cyclone[2]!;
  out[0] = 0.8 * m + 0.22 * breakup + (0.12 + 0.3 * conv) * (b - 0.45) * smooth;
  // high cloud follows the upper winds, only partly the low weather: its own moisture, drawn
  // out along the jets. Its outline is smooth; the fibres only streak it from inside
  const upper = fbm(w.noise.cloudFlow, qx * 2.4 + 4.2, qy * 2.4 * 2.2, qz * 2.4, 4);
  out[1] = 0.45 * m + 0.6 * upper;
  out[2] = detail;
  out[3] = b;
  out[4] = conv;
  out[5] = cyclone[1]!;
  out[6] = cyclone[2]!;
}

// Thresholds of the two layers' fields, set at quantiles of the fields measured over many
// seeds: low cloud covers about 36% of the sky, high veils about 45%.
const LOW_THRESHOLD = 0.078;
const HIGH_THRESHOLD = 0.022;
/** Field range over which low cloud's edge goes from nothing to full: narrow where it is
 *  convective, so cumulus edges are crisp, wide in stratiform cloud, whose edges are diffuse. */
const CRISP_RAMP = 0.18;
const SOFT_RAMP = 0.5;
const HIGH_RAMP = 0.45;
/** Opacity of the high veils at their thickest. */
const VEIL = 0.5;

const field = new Float64Array(7);

export function cloudDensity(w: World, x: number, y: number, z: number, c: Float64Array, fine: boolean) {
  cloudFields(w, x, y, z, c, fine, field);
  const lowField = field[0]!;
  const detail = field[2]!;
  // low cloud: crisp edges, then thicker the moister the air, with the cells still showing as
  // darker lanes; thin parts stay translucent
  const ramp = SOFT_RAMP + (CRISP_RAMP - SOFT_RAMP) * field[4]!;
  const edge = smoothstep(LOW_THRESHOLD - 0.3 * ramp, LOW_THRESHOLD + 0.7 * ramp, lowField);
  const thick = 0.36 + 0.64 * smoothstep(LOW_THRESHOLD + 0.1, LOW_THRESHOLD + 1.0, lowField);
  const grain = 1 - (0.25 - 0.25 * smoothstep(0.15, 0.6, field[3]!)) * (1 - field[6]!);
  let low = edge * thick * grain;

  // fair-weather cumulus over the open ocean, most of it in the convective trade-wind belts:
  // clusters a few dozen kilometres across, each a knot of small cells, gathered in patches;
  // between them a faint speckle of cumulus too small to resolve
  const ex = c[C_CELL_X]!;
  const ey = c[C_CELL_Y]!;
  const ez = c[C_CELL_Z]!;
  const open = smoothstep(LOW_THRESHOLD - 0.95, LOW_THRESHOLD - 0.25, lowField) * (0.3 + 0.7 * field[4]!);
  if (open > 0) {
    const patches = smoothstep(-0.2, 0.35, fbm(w.noise.cloudDetail, ex * 14 + 9.1, ey * 14, ez * 14, 2));
    const amount = open * patches;
    if (amount > 0) {
      const small = cells(ex * 140 + 3.7, ey * 140, ez * 140, w.seed ^ 0x2545f491);
      const speckle = cells(ex * 300 + 1.3, ey * 300, ez * 300, w.seed ^ 0x1b873593);
      const knot = cells(ex * 30 + 2.1, ey * 30, ez * 30, w.seed ^ 0x68e31da4);
      // ragged, cauliflower outlines: the small cells and a little fBm on the threshold
      const rough = 0.3 * (small - 0.5) + 0.18 * fbm(w.noise.cloud, ex * 110 + 4.4, ey * 110, ez * 110, 2);
      const cluster = smoothstep(0.8 - 0.22 * amount, 0.98 - 0.16 * amount, knot + rough);
      const cumulus = amount * cluster * (0.4 + 0.6 * smoothstep(0.2, 0.7, small)) * 0.85;
      const haze = amount * 0.16 * speckle * speckle;
      low = Math.max(low, cumulus, haze);
    }
  }

  // high veils: translucent, soft-edged, streaked by the fibres
  const veil = VEIL * smoothstep(HIGH_THRESHOLD, HIGH_THRESHOLD + HIGH_RAMP, field[1]!) * (0.35 + 0.65 * smoothstep(-0.55, 0.6, detail));
  return clamp01((1 - (1 - low) * (1 - veil)) * field[5]!);
}

/**
 * Tropical cyclones as moisture: a dense central overcast and spiral rain bands winding in
 * toward it, so they take on the same texture as all other cloud. Writes the moisture to
 * out[0], the clear eye's mask (0 in the eye) to out[1] and the central overcast to out[2].
 */
function tropicalCyclones(w: World, x: number, y: number, z: number, out: Float64Array) {
  let moist = 0;
  let eye = 1;
  let overcast = 0;
  for (const v of w.wind.vortices) {
    if (v.kind !== 'tropical') continue;
    const dot = x * v.x + y * v.y + z * v.z;
    if (dot < v.cutoff) continue;
    const d = Math.acos(Math.min(1, dot)) / v.radius;
    const phi = Math.atan2(x * v.nx + y * v.ny + z * v.nz, x * v.ex + z * v.ez);
    // logarithmic spiral phase, wobbled by smooth noise so the bands are irregular
    const wobble = w.noise.cloudFlow(x * 9 + 3, y * 9, z * 9);
    const t = phi * Math.sign(v.spin) + 2.4 * Math.log(d + 0.05) + 0.8 * wobble;
    const arm = 0.5 + 0.5 * Math.cos(2 * t);
    const bands = smoothstep(0.4, 0.9, arm) * smoothstep(2.6, 1.0, d) * smoothstep(0.3, 0.75, d);
    const core = smoothstep(1.0, 0.35, d + 0.12 * wobble);
    moist = Math.max(moist, 2.0 * core, 1.0 * bands);
    overcast = Math.max(overcast, core);
    eye = Math.min(eye, 0.15 + 0.85 * smoothstep(0.02, 0.1, d));
  }
  out[0] = moist;
  out[1] = eye;
  out[2] = overcast;
}

