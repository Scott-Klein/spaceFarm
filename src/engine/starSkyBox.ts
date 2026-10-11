type Rand = () => number;

// mulberry32: small seeded PRNG, so the same seed gives the same sky at every scale
const makeRand = (seed: number): Rand => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const gaussian = (rand: Rand) => {
  const u = 1 - rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const makeStarStamp = (): OffscreenCanvas => {
  const size = 256;
  const stamp = new OffscreenCanvas(size, size);
  const ctx = stamp.getContext('2d')!;

  const c = size / 2;
  const g = ctx.createRadialGradient(c, c, 0, c, c, c);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.01, 'rgba(255,255,255,1)');
  g.addColorStop(0.09, 'rgba(255,255,255,0.2)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.05)');
  g.addColorStop(1, 'rgba(255,255,255,0)');

  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(c, c);
  ctx.rotate(Math.PI / 12);
  for (let i = 0; i < 3; i++) {
    ctx.rotate(Math.PI / 3);
    const lg = ctx.createLinearGradient(-c, 0, c, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(0.35, 'rgba(255,255,255,0.60)');
    lg.addColorStop(0.5, 'rgba(255,255,255,0.95)');
    lg.addColorStop(0.65, 'rgba(255,255,255,0.60)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(-c, -0.1, size, 1);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  return stamp;
};

// Longitude of the galactic centre, as a fraction of the map width.
const CORE_U = 0.5;

// Shortest wrapped distance from longitude u to the galactic centre, in map-width units.
const coreDist = (u: number) => {
  const du = Math.abs(u - CORE_U);
  return du > 0.5 ? 1 - du : du;
};

const makeGlowLayer = (W: number, H: number, sigma: number, rand: Rand): OffscreenCanvas => {
  const c = new OffscreenCanvas(W, H);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const d = img.data;

  const coreW = 0.07; // bulge extent along the band, in u
  const coreH = sigma * 1.25; // bulge extent across the band: taller than the band, so it's a lens
  const wideW = 0.25; // broad Sagittarius-side brightening along the band
  const anticentre = 0.5; // how bright the far side of the band is relative to the centre

  for (let py = 0; py < H; py++) {
    const ys = Math.cos((py / H) * Math.PI); // row → sphere axis
    const band = Math.exp(-(ys * ys) / (2 * sigma * sigma));
    const coreV = (ys * ys) / (2 * coreH * coreH);

    for (let px = 0; px < W; px++) {
      const du = coreDist(px / W);

      // wide gradient: whole band is dimmer away from the centre
      const wide = Math.exp(-(du * du) / (2 * wideW * wideW));
      const gradient = anticentre + (1 - anticentre) * wide;

      // tight bulge on top; the 0.3 base leaves headroom so the core doesn't clip flat
      const core = Math.exp(-(du * du) / (2 * coreW * coreW) - coreV);
      const amp = Math.min(1, 0.3 * band * gradient + core);

      const v = amp * rand() * 255;
      const i = (py * W + px) * 4;
      d[i] = v;
      d[i + 1] = v;
      d[i + 2] = v;
      d[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return c;
};

// Horizontally tileable value noise. u wraps in [0,1), v is clamped to [0,1].
const hash2 = (x: number, y: number, seed: number) => {
  let h = Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(seed + 1, 83492791);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);

const periodicNoise = (u: number, v: number, nx: number, ny: number, seed: number) => {
  const x = u * nx;
  const y = v * ny;
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = fade(x - x0);
  const fy = fade(y - y0);
  const xa = ((x0 % nx) + nx) % nx;
  const xb = (xa + 1) % nx;
  const top = hash2(xa, y0, seed) * (1 - fx) + hash2(xb, y0, seed) * fx;
  const bot = hash2(xa, y0 + 1, seed) * (1 - fx) + hash2(xb, y0 + 1, seed) * fx;
  return top * (1 - fy) + bot * fy;
};

// Ridged fractal noise: each octave is folded into sharp creases, so the sum reads as
// filament networks rather than clouds. Coarse octaves are stretched along the band
// (cells `stretch` times wider than tall) and relax to isotropic at the finest scale.
// (u, v) is the raw coordinate and (wu, wv) the domain-warped one: coarse octaves follow
// the full warp, fine ones fade back toward raw because a heavily warped fine lattice
// shows up as moiré rings.
const ridgedFbm = (
  u: number,
  v: number,
  wu: number,
  wv: number,
  octaves: number,
  stretch: number,
  seed: number
) => {
  let sum = 0;
  let amp = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const nx = 4 * 2 ** o;
    const s = stretch + (1 - stretch) * (o / (octaves - 1));
    const ny = Math.max(2, Math.round((nx * s) / 2));
    const k = o < 5 ? 1 : Math.max(0.15, 1 - (o - 4) * 0.2);
    const r = 1 - Math.abs(2 * periodicNoise(u + (wu - u) * k, v + (wv - v) * k, nx, ny, seed + o) - 1);
    sum += amp * r * r;
    norm += amp;
    amp *= 0.68;
  }
  return sum / norm;
};

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Per-pixel transmission (RGB, opaque) to be composited with 'multiply'.
const makeDustLayer = (W: number, H: number): OffscreenCanvas => {
  const c = new OffscreenCanvas(W, H);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const d = img.data;

  const bandSigma = 0.25; // dust hugs the band more tightly than the glow
  const tauMax = 1.8;
  // extinction per channel: blue is scattered more than red, so thin dust reddens
  const kR = 0.6;
  const kG = 0.9;
  const kB = 1.4;

  // the rift only depends on longitude, so compute it once per column. It also thickens
  // toward the galactic centre, so the dark lanes cut hardest where the glow is brightest.
  const riftY = new Float32Array(W);
  const riftPatchy = new Float32Array(W);
  for (let px = 0; px < W; px++) {
    const u = px / W;
    riftY[px] = 0.04 + 0.12 * (periodicNoise(u, 0.5, 5, 2, 303) - 0.5);
    const cd = coreDist(u);
    const nearCore = 1 + Math.exp(-(cd * cd) / (2 * 0.12 * 0.12));
    riftPatchy[px] =
      (0.55 + 0.45 * smoothstep(0.3, 0.6, periodicNoise(u, 0.5, 9, 2, 404))) * nearCore;
  }

  for (let py = 0; py < H; py++) {
    const v = py / H;
    const ys = Math.cos(v * Math.PI);
    const band = Math.exp(-(ys * ys) / (2 * bandSigma * bandSigma));

    for (let px = 0; px < W; px++) {
      const i = (py * W + px) * 4;
      d[i + 3] = 255;

      if (band < 0.01) {
        d[i] = d[i + 1] = d[i + 2] = 255;
        continue;
      }

      const u = px / W;

      // two-pass domain warp: warping the warped coordinate gives curling, swirled filaments
      const u1 = u + 0.25 * (periodicNoise(u, v, 4, 3, 101) - 0.5);
      const v1 = v + 0.12 * (periodicNoise(u, v, 8, 4, 202) - 0.5);
      const u2 = u1 + 0.2 * (periodicNoise(u1, v1, 10, 6, 505) - 0.5);
      const v2 = v1 + 0.1 * (periodicNoise(u1, v1, 16, 8, 606) - 0.5);
      const n = ridgedFbm(u, v, u2, v2, 10, 3.5, 7);

      // Great Rift: a long lane just off the band axis, wandering and patchy
      const lane = Math.exp(-((ys - riftY[px]) ** 2) / (2 * 0.07 * 0.07));

      // Coalsack: one compact dense blob
      let du = Math.abs(u - 0.62);
      if (du > 0.5) du = 1 - du;
      const coal = Math.exp(-(du * du) / (2 * 0.009 * 0.009) - ((ys + 0.18) ** 2) / (2 * 0.05 * 0.05));

      // grit: fine ridged noise, only lightly warped, folded into the field *before*
      // thresholding so edges crumble instead of fading smoothly
      const gu = u + 0.2 * (u2 - u);
      const gv = v + 0.2 * (v2 - v);
      const ridge = (x: number) => 1 - Math.abs(2 * x - 1);
      const grit =
        0.6 * ridge(periodicNoise(gu, gv, 1024, 640, 31)) +
        0.4 * ridge(periodicNoise(gu, gv, 2048, 1280, 32));

      const field = n + 0.35 * lane * riftPatchy[px] + 0.5 * coal * (0.5 + n) + 0.2 * (grit - 0.5);
      // veil → opaque gradient; only the densest cores go near-black
      let dens = smoothstep(0.36, 0.7, field);

      // second layer: thin, sharp filaments at mid frequency. Raising the ridge to a high
      // power leaves only the crease itself, and the wide `veil` mask lets them reach out
      // past the cloud edges as tendrils (skipped where there's no dust nearby)
      const veil = smoothstep(0.2, 0.5, field);
      if (veil > 0) {
        const fu = u + 0.7 * (u2 - u);
        const fv = v + 0.7 * (v2 - v);
        const crease = (x: number) => (1 - Math.abs(2 * x - 1)) ** 6;
        const fil = Math.min(
          1,
          0.55 * crease(periodicNoise(fu, fv, 48, 84, 41)) +
            0.4 * crease(periodicNoise(fu, fv, 112, 150, 42)) +
            0.3 * crease(periodicNoise(fu, fv, 256, 256, 43))
        );
        dens = Math.min(1, dens + 0.7 * fil * veil);
      }
      const tau = tauMax * band * (dens + 1.5 * dens ** 4);

      d[i] = 255 * Math.exp(-tau * kR);
      d[i + 1] = 255 * Math.exp(-tau * kG);
      d[i + 2] = 255 * Math.exp(-tau * kB);
    }
  }

  ctx.putImageData(img, 0, 0);
  return c;
};

/**
 * Renders an equirectangular star map (Milky Way band, dust lanes, stars) into an
 * offscreen canvas and returns it. The map tiles horizontally.
 *
 * `scale` is the resolution as a fraction of 4096x2048. The same `seed` produces the
 * same sky at any scale, only sharper, so a low-res map can be swapped for a higher-res
 * one without the stars jumping.
 */
export const makeStarMap = (
  scale = 0.1,
  seed = (Math.random() * 4294967296) >>> 0
): OffscreenCanvas => {
  const W = Math.round(4096 * scale);
  const H = Math.round(2048 * scale);
  const sigma = 0.15; // band tightness
  const count = 30000;

  const starRand = makeRand(seed);
  const glowRand = makeRand(seed ^ 0x9e3779b9);

  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d')!;
  const stamp = makeStarStamp();

  ctx.fillStyle = '#05060a';
  ctx.fillRect(0, 0, W, H);

  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.2;
  ctx.drawImage(makeGlowLayer(W, H, sigma, glowRand), 0, 0, W, H);

  const drawStar = (px: number, py: number, r: number, alpha: number) => {
    ctx.globalAlpha = alpha;
    ctx.drawImage(stamp, px - r, py - r, r * 2, r * 2);

    if (px < r) ctx.drawImage(stamp, px + W - r, py - r, r * 2, r * 2);
    if (px > W - r) ctx.drawImage(stamp, px - W - r, py - r, r * 2, r * 2);
  };

  // bright stars are nearby, so they sit in front of the dust
  const foreground: [number, number, number, number][] = [];

  for (let i = 0; i < count; i++) {
    let y = gaussian(starRand) * sigma *1.5;
    while (y < -1 || y > 1) y = gaussian(starRand) * sigma *1.5;

    const px = starRand() * W;
    const py = (Math.acos(y) / Math.PI) * H;

    const b = starRand() ** 3; // few bright, many faint
    const r = (1 + b * 6) * scale; // px radius tracks resolution, so stars keep their angular size
    const alpha = 0.1 + b * 0.9;

    if (b > 0.7) foreground.push([px, py, r, alpha]);
    else drawStar(px, py, r, alpha);
  }

  // dark nebulae: multiply over the glow and background stars
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'multiply';
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(makeDustLayer(W, H), 0, 0, W, H);

  ctx.globalCompositeOperation = 'lighter';
  for (const [px, py, r, alpha] of foreground) drawStar(px, py, r, alpha);

  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';

  return canvas;
};
