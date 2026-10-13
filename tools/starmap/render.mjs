// Renders the star map in plain Node and writes the standard inspection views: overview,
// 1:1 crops through the core / at a pole / across the seam, and gnomonic (perspective)
// reprojections, which is how the map is actually seen on the sphere.
//
//   node tools/starmap/render.mjs --tag look [--size 8192] [--out dir]
//        [--set dust.tauMax=2 --set band.tilt=60 ...] [--views core,g_core,g_pole]
//
// Needs Node 22.18+ (it imports the TypeScript module directly).
import fs from 'node:fs';
import path from 'node:path';
import { OUT, args, loadGenerator, toImage } from './shim.mjs';
import { writeViews } from './views.mjs';

const { opt, all, has } = args();
const { makeStarMap, STAR_MAP_DEFAULTS } = await loadGenerator();

// --set a.b.c=1.5 or --set band.color=[1,0.9,0.8]
const overrides = {};
for (const s of all('set')) {
  const [key, raw] = s.split('=');
  const parts = key.split('.');
  let node = overrides;
  let ref = STAR_MAP_DEFAULTS;
  for (const p of parts.slice(0, -1)) {
    node = node[p] ??= {};
    ref = ref?.[p];
  }
  const leaf = parts.at(-1);
  if (ref?.[leaf] === undefined) throw new Error(`unknown option ${key}`);
  node[leaf] = JSON.parse(raw);
}
if (opt('size')) overrides.size = Number(opt('size'));

const t0 = performance.now();
const canvas = makeStarMap(overrides);
const secs = ((performance.now() - t0) / 1000).toFixed(1);

const img = toImage(canvas);
const out = path.join(opt('out', OUT), opt('tag', 'look'));
fs.mkdirSync(out, { recursive: true });
if (has('raw')) fs.writeFileSync(path.join(out, `full_${img.w}x${img.h}.rgb`), img.data);

const views = opt('views');
const report = writeViews(img, out, {
  coreLon: Number(opt('lon', overrides.core?.longitude ?? STAR_MAP_DEFAULTS.core.longitude)),
  which: views ? views.split(',') : undefined,
});
console.log(`${img.w}x${img.h} in ${secs}s  overrides=${JSON.stringify(overrides)}`);
console.log(`views in ${out}`);
console.log(JSON.stringify(report));
