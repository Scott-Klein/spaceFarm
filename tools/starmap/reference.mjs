// Cuts the same inspection views out of a reference photograph, so the generator and the
// real thing are judged on equal terms. The photo must be a 2:1 equirectangular panorama
// in galactic coordinates (the ESO/S. Brunier Milky Way panorama eso0932a is one:
// https://www.eso.org/public/images/eso0932a/). Decoding is done by ffmpeg.
//
//   node tools/starmap/reference.mjs <image> [--tag ref] [--out dir] [--lon 180]
//
// --lon is the longitude of the galactic centre in the image (180 = centred).
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { OUT, args } from './shim.mjs';
import { writeViews } from './views.mjs';

const file = process.argv[2];
const { opt } = args(process.argv.slice(3));
const [w, h] = execFileSync('ffprobe', [
  '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file,
])
  .toString()
  .trim()
  .split(',')
  .map(Number);
const data = execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], {
  maxBuffer: w * h * 3 + 1024,
});
const out = path.join(opt('out', OUT), opt('tag', 'ref'));
const report = writeViews({ w, h, data: new Uint8Array(data.buffer, data.byteOffset, data.length) }, out, {
  coreLon: Number(opt('lon', 180)),
});
console.log(`reference ${w}x${h}, views in ${out}`);
console.log(JSON.stringify(report));
