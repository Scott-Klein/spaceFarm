// The planet's winds: zonal jets, weather systems and large eddies. Clouds are read at points
// traced back along them (world.ts), so the moisture comes out wound into spirals round the
// cyclones and the fine fibres drawn out into strands along the jets.
import { makeNoiseD, makeRand, type NoiseD, type Rand } from './noise';

export interface Vortex {
  x: number;
  y: number;
  z: number;
  /** east and north tangents at the centre, for polar coordinates around it */
  ex: number;
  ez: number;
  nx: number;
  ny: number;
  nz: number;
  /** angular radius of the core */
  radius: number;
  /** angular rate at the centre: counter-clockwise seen from outside is positive */
  spin: number;
  /** drift toward the centre (>0) or away from it (<0), relative to the swirl: winds
   *  streamlines into spirals instead of circles */
  inflow: number;
  kind: 'cyclone' | 'anticyclone' | 'tropical';
  /** cosine of the angular distance beyond which the vortex is negligible */
  cutoff: number;
}

export interface Wind {
  vortices: Vortex[];
  /** zonal angular rate by latitude, tabulated over y = sin(latitude) in [-1, 1] */
  zonal: Float64Array;
  eddies: NoiseD;
}

const ZONAL_STEPS = 256;

const vortex = (
  latDeg: number, lon: number, radius: number, spin: number, inflow: number, kind: Vortex['kind'],
): Vortex => {
  const lat = (latDeg * Math.PI) / 180;
  const y = Math.sin(lat);
  const r = Math.cos(lat);
  return {
    x: r * Math.cos(lon),
    y,
    z: r * Math.sin(lon),
    ex: -Math.sin(lon),
    ez: Math.cos(lon),
    nx: -y * Math.cos(lon),
    ny: r,
    nz: -y * Math.sin(lon),
    radius,
    spin,
    inflow,
    kind,
    cutoff: Math.cos(Math.min(Math.PI, radius * 3)),
  };
};

export function createWind(seed: number, rand: Rand): Wind {
  // zonal winds: easterly trades, mid-latitude westerlies, polar easterlies
  const zonal = new Float64Array(ZONAL_STEPS + 1);
  for (let i = 0; i <= ZONAL_STEPS; i++) {
    const lat = Math.abs(Math.asin((i / ZONAL_STEPS) * 2 - 1));
    zonal[i] = -0.5 * Math.sin(6 * lat);
  }

  // weather systems. Cyclones turn counter-clockwise in the north and clockwise in the south
  // (seen from outside), anticyclones the other way.
  const vortices: Vortex[] = [];
  for (const hemi of [1, -1]) {
    const cyclones = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < cyclones; i++) {
      const radius = 0.08 + rand() * 0.1;
      vortices.push(vortex(hemi * (40 + rand() * 25), rand() * 2 * Math.PI, radius, hemi * (10 + rand() * 7), 0.22, 'cyclone'));
    }
    const highs = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < highs; i++) {
      const radius = 0.2 + rand() * 0.12;
      vortices.push(vortex(hemi * (24 + rand() * 12), rand() * 2 * Math.PI, radius, -hemi * (4 + rand() * 3), -0.3, 'anticyclone'));
    }
  }
  // the odd tropical cyclone: most planets have one, a few two
  const tropical = (rand() < 0.65 ? 1 : 0) + (rand() < 0.2 ? 1 : 0);
  for (let i = 0; i < tropical; i++) {
    const hemi = rand() < 0.5 ? 1 : -1;
    vortices.push(vortex(hemi * (12 + rand() * 12), rand() * 2 * Math.PI, 0.06 + rand() * 0.03, hemi * 14, 0.4, 'tropical'));
  }

  return { vortices, zonal, eddies: makeNoiseD(makeRand(`${seed}:eddies`)) };
}

const grad = new Float64Array(3);

/** Wind at unit direction (x, y, z), tangent to the sphere, written into out[0..2]. */
export function velocity(w: Wind, x: number, y: number, z: number, out: Float64Array) {
  // zonal flow: rotation about the polar axis
  const fi = (y + 1) * 0.5 * ZONAL_STEPS;
  const i0 = fi < 0 ? 0 : fi >= ZONAL_STEPS ? ZONAL_STEPS - 1 : Math.floor(fi);
  const u = w.zonal[i0]! + (w.zonal[i0 + 1]! - w.zonal[i0]!) * (fi - i0);
  let vx = u * z;
  let vy = 0;
  let vz = -u * x;

  // vortices: swirl about the centre (c × p) plus a drift along c - (c·p)p
  for (const v of w.vortices) {
    const d = x * v.x + y * v.y + z * v.z;
    if (d < v.cutoff) continue;
    const g = Math.exp(-(2 - 2 * d) / (v.radius * v.radius));
    const s = v.spin * g;
    vx += s * (v.y * z - v.z * y);
    vy += s * (v.z * x - v.x * z);
    vz += s * (v.x * y - v.y * x);
    const q = Math.abs(v.spin) * v.inflow * g;
    vx += q * (v.x - d * x);
    vy += q * (v.y - d * y);
    vz += q * (v.z - d * z);
  }

  // eddies: curl noise p × ∇N, large ones only (small eddies would marble every cloud)
  w.eddies(x * 3.5, y * 3.5, z * 3.5, grad);
  const gx = grad[0]! * 0.03;
  const gy = grad[1]! * 0.03;
  const gz = grad[2]! * 0.03;
  vx += y * gz - z * gy;
  vy += z * gx - x * gz;
  vz += x * gy - y * gx;
  out[0] = vx;
  out[1] = vy;
  out[2] = vz;
}
