// Checks the hard constraints that can be measured rather than eyeballed.
//
//   node tools/starmap/check.mjs
//
// Determinism, a seamless u = 0/1 edge, uniform density on the sphere (no pole pinch),
// the same sky at every size, 8-bit headroom and a background that is never pure black.
import crypto from 'node:crypto';
import { loadGenerator, toImage } from './shim.mjs';
import { downsample } from './img.mjs';

const { makeStarMap } = await loadGenerator();
let failed = 0;
const report = (ok, name, detail) => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(28)} ${detail}`);
};
const sha = (canvas) => crypto.createHash('sha1').update(canvas.pixels).digest('hex').slice(0, 12);

// 1. same seed, same sky
{
  const a = sha(makeStarMap({ size: 1024 }));
  const b = sha(makeStarMap({ size: 1024 }));
  const c = sha(makeStarMap({ size: 1024, seed: 12345 }));
  report(a === b && a !== c, 'deterministic', `${a} == ${b}, other seed ${c}`);
}

// 2. seam: the wrap-around column pair is no more different than its neighbours
const map = toImage(makeStarMap({ size: 2048 }));
{
  const colDiff = (x0, x1) => {
    let s = 0;
    for (let y = 0; y < map.h; y++) {
      for (let k = 0; k < 3; k++) {
        s += Math.abs(map.data[(y * map.w + x0) * 3 + k] - map.data[(y * map.w + x1) * 3 + k]);
      }
    }
    return s / (map.h * 3);
  };
  const seam = colDiff(map.w - 1, 0);
  const inside = [100, 500, 900, 1300, 1700].map((x) => colDiff(x, x + 1));
  const worst = Math.max(...inside);
  report(seam <= worst * 1.15, 'seamless at u = 0/1', `seam ${seam.toFixed(2)} vs interior max ${worst.toFixed(2)}`);
}

// 3. headroom and background
{
  let clipped = 0;
  let black = 0;
  for (let i = 0; i < map.data.length; i += 3) {
    if (map.data[i] === 255 && map.data[i + 1] === 255 && map.data[i + 2] === 255) clipped++;
    if (map.data[i] + map.data[i + 1] + map.data[i + 2] === 0) black++;
  }
  const n = map.w * map.h;
  report(clipped / n < 5e-4, 'headroom', `${((clipped / n) * 100).toFixed(4)}% of texels at pure white`);
  report(black === 0, 'never pure black', `${black} texels at 0,0,0`);
}

// 4. no pole pinch: with only the uniform population, light per unit solid angle is the
//    same in the polar caps as at mid latitudes
{
  const m = toImage(makeStarMap({ size: 4096, stars: { count: 0 }, glow: { alpha: 0 }, nebulosity: { alpha: 0 } }));
  const bg = m.data[1]; // top-left texel, green
  const density = (latA, latB) => {
    let flux = 0;
    let area = 0;
    for (let y = 0; y < m.h; y++) {
      const lat = 90 - ((y + 0.5) / m.h) * 180;
      const a = Math.abs(lat);
      if (a < latA || a >= latB) continue;
      const w = Math.cos((lat * Math.PI) / 180); // solid angle of a texel on this row
      let row = 0;
      for (let x = 0; x < m.w; x++) row += Math.max(0, m.data[(y * m.w + x) * 3 + 1] - bg);
      flux += row * w;
      area += m.w * w;
    }
    return flux / area;
  };
  const cap = density(75, 90);
  const mid = density(30, 50);
  report(Math.abs(cap / mid - 1) < 0.08, 'uniform on the sphere', `polar cap / mid-latitude = ${(cap / mid).toFixed(3)}`);
}

// 5. same sky at any size: a 2x render box-filtered down matches the native one
{
  const meanDiff = (a, b) => {
    let s = 0;
    for (let i = 0; i < a.data.length; i++) s += Math.abs(a.data[i] - b.data[i]);
    return s / a.data.length;
  };
  const small = toImage(makeStarMap({ size: 1024 }));
  const same = meanDiff(small, downsample(map, 1024));
  const other = meanDiff(small, downsample(toImage(makeStarMap({ size: 2048, seed: 12345 })), 1024));
  report(same < other * 0.35, 'same sky at every size', `vs 2x downsampled ${same.toFixed(2)}, vs other seed ${other.toFixed(2)}`);
}

process.exit(failed ? 1 : 0);
