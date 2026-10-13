// A/B tool: renders several option variants in parallel processes and tiles the same
// 1:1 crop and/or perspective view from each into one image (left to right, then down).
//
//   node tools/starmap/variants.mjs --tag warp --size 8192 --cols 2 \
//        --gnom 180,0,60,660,372 --crop 180,0,660,400 \
//        --base '{"stars":{"count":0}}' \
//        --var '{"dust":{"warp":0}}' --var '{"dust":{"warp":0.2}}'
//
//   --crop lon,lat,w,h        1:1 crop centred on a map coordinate (degrees)
//   --gnom lon,lat,fov,w,h    perspective view
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { OUT, args, deepMerge, loadGenerator, toImage } from './shim.mjs';
import { crop, gnomonic, montage, writePng } from './img.mjs';

if (process.argv[2] === '--child') {
  const { makeStarMap } = await loadGenerator();
  fs.writeFileSync(process.argv[4], toImage(makeStarMap(JSON.parse(process.argv[3]))).data);
  process.exit(0);
}

const { opt, all } = args();
const size = Number(opt('size', 4096));
const base = deepMerge({ size }, JSON.parse(opt('base', '{}')));
const vars = all('var').map((v) => JSON.parse(v));
if (!vars.length) vars.push({});
const tag = opt('tag', 'variants');
const outDir = opt('out', OUT);
fs.mkdirSync(outDir, { recursive: true });
const cols = Number(opt('cols', 2));

const t0 = performance.now();
const tiles = await Promise.all(
  vars.map(
    (v, i) =>
      new Promise((resolve, reject) => {
        const o = deepMerge(base, v);
        const raw = path.join(outDir, `_${tag}_${i}.rgb`);
        const child = spawn(process.execPath, [import.meta.filename, '--child', JSON.stringify(o), raw], {
          stdio: ['ignore', 'inherit', 'inherit'],
        });
        child.on('exit', (code) => {
          if (code !== 0) return reject(new Error(`variant ${i} failed`));
          const src = { w: o.size, h: o.size / 2, data: new Uint8Array(fs.readFileSync(raw)) };
          fs.unlinkSync(raw);
          const tile = {};
          if (opt('gnom')) {
            const [lon, lat, fov, gw, gh] = opt('gnom').split(',').map(Number);
            tile.gnom = gnomonic(src, lon, lat, fov, gw, gh);
          }
          if (opt('crop') || !opt('gnom')) {
            const [lon, lat, cw, ch] = opt('crop', '180,0,640,400').split(',').map(Number);
            const cx = Math.round((lon / 360) * src.w);
            const cy = Math.round(((90 - lat) / 180) * src.h);
            tile.crop = crop(src, cx - (cw >> 1), cy - (ch >> 1), cw, ch);
          }
          resolve(tile);
        });
      }),
  ),
);
for (const kind of ['crop', 'gnom']) {
  if (!tiles[0][kind]) continue;
  const rows = [];
  for (let i = 0; i < tiles.length; i += cols) {
    rows.push(montage(tiles.slice(i, i + cols).map((t) => t[kind])));
  }
  const out = path.join(outDir, `${tag}_${kind}.png`);
  writePng(out, rows.length > 1 ? montage(rows, true) : rows[0]);
  console.log(out);
}
console.log(`${vars.length} variants in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
vars.forEach((v, i) => console.log(`  [${i}] ${JSON.stringify(v)}`));
