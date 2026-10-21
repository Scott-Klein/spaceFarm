// Cube-sphere conventions shared by the CPU generator and the WGSL sampler (see CUBE_WGSL).
//
// Every planet map is a 6-layer texture array, one layer per cube face. Face f has a forward
// axis F and in-plane axes U, V. Texel (i, j) of an N×N face sits at s = (i + 0.5) / N * 2 - 1,
// t = (j + 0.5) / N * 2 - 1, and maps to the direction normalize(F + tan(s·π/4)·U + tan(t·π/4)·V).
// The tan warp evens out texel density: a plain gnomonic cube packs corner texels ~5× denser
// than face centres, the warped one stays within ~1.4×.

export type Axes = readonly [
  fx: number, fy: number, fz: number,
  ux: number, uy: number, uz: number,
  vx: number, vy: number, vz: number,
];

export const FACES: readonly Axes[] = [
  [1, 0, 0, 0, 0, -1, 0, -1, 0], // +X
  [-1, 0, 0, 0, 0, 1, 0, -1, 0], // -X
  [0, 1, 0, 1, 0, 0, 0, 0, 1], // +Y
  [0, -1, 0, 1, 0, 0, 0, 0, -1], // -Y
  [0, 0, 1, 1, 0, 0, 0, -1, 0], // +Z
  [0, 0, -1, -1, 0, 0, 0, -1, 0], // -Z
];

const QUARTER_PI = Math.PI / 4;

/** Unit direction for face coordinates s, t in [-1, 1] (values just outside are fine: halos). */
export const faceDirection = (face: number, s: number, t: number, out: Float64Array | number[], o = 0) => {
  const A = FACES[face]!;
  const a = Math.tan(s * QUARTER_PI);
  const b = Math.tan(t * QUARTER_PI);
  const x = A[0] + a * A[3] + b * A[6];
  const y = A[1] + a * A[4] + b * A[7];
  const z = A[2] + a * A[5] + b * A[8];
  const k = 1 / Math.sqrt(x * x + y * y + z * z);
  out[o] = x * k;
  out[o + 1] = y * k;
  out[o + 2] = z * k;
};

/** Face coordinates (face, s, t) of a direction. Inverse of faceDirection. */
export const directionToFace = (x: number, y: number, z: number): [face: number, s: number, t: number] => {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  const az = Math.abs(z);
  const face = ax >= ay && ax >= az ? (x > 0 ? 0 : 1) : ay >= az ? (y > 0 ? 2 : 3) : z > 0 ? 4 : 5;
  const A = FACES[face]!;
  const f = x * A[0] + y * A[1] + z * A[2];
  const a = (x * A[3] + y * A[4] + z * A[5]) / f;
  const b = (x * A[6] + y * A[7] + z * A[8]) / f;
  return [face, Math.atan(a) / QUARTER_PI, Math.atan(b) / QUARTER_PI];
};

/** Unit cube-sphere mesh (no pole pinch, even triangles), `segments` quads along each face edge. */
export const createCubeSphereData = (segments: number, radius = 1) => {
  const n = segments + 1;
  const positions = new Float32Array(6 * n * n * 3);
  const normals = new Float32Array(6 * n * n * 3);
  const indices = new Uint32Array(6 * segments * segments * 6);
  const d = [0, 0, 0];
  let v = 0;
  let k = 0;
  for (let face = 0; face < 6; face++) {
    const base = v;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        faceDirection(face, (i / segments) * 2 - 1, (j / segments) * 2 - 1, d);
        normals.set(d, v * 3);
        positions[v * 3] = d[0]! * radius;
        positions[v * 3 + 1] = d[1]! * radius;
        positions[v * 3 + 2] = d[2]! * radius;
        v++;
      }
    }
    for (let j = 0; j < segments; j++) {
      for (let i = 0; i < segments; i++) {
        const a = base + j * n + i;
        const b = a + 1;
        const c = a + n;
        const e = c + 1;
        // counter-clockwise seen from outside, in the engine's left-handed frame
        indices.set([a, b, c, b, e, c], k);
        k += 6;
      }
    }
  }
  return { positions, normals, indices };
};
