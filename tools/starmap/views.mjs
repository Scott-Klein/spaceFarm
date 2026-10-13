// Standard set of inspection views cut from an equirectangular RGB8 map. Used for both
// generator output and the reference photograph so the two are judged on equal terms.
import fs from 'node:fs';
import path from 'node:path';
import { crop, downsample, gnomonic, zoom, writePng, stats } from './img.mjs';

/**
 * @param src   { w, h, data } equirect map
 * @param out   output directory
 * @param o     { coreLon (deg), which: string[] | undefined, gw, gh }
 */
export const writeViews = (src, out, o = {}) => {
  fs.mkdirSync(out, { recursive: true });
  const coreLon = o.coreLon ?? 180;
  const gw = o.gw ?? 1344;
  const gh = o.gh ?? 756;
  const want = (name) => !o.which || o.which.includes(name);
  const save = (name, img) => {
    writePng(path.join(out, `${name}.png`), img);
    return img;
  };
  const cu = Math.round((coreLon / 360) * src.w);
  const cv = src.h >> 1;
  const report = {};

  if (want('overview')) save('overview', downsample(src, 1400));
  // 1:1, unscaled
  if (want('core')) report.core = stats(save('core_1to1', crop(src, cu - 600, cv - 400, 1200, 800)));
  if (want('pole')) save('pole_1to1', crop(src, cu - 600, 0, 1200, 640));
  if (want('offband')) save('offband_1to1', crop(src, cu - 600, Math.round(src.h * 0.22), 1200, 640));
  if (want('seam')) save('seam_1to1', crop(src, -600, cv - 320, 1200, 640));
  if (want('zoom')) save('core_zoom4x', zoom(crop(src, cu - 160, cv - 100, 320, 200), 4));
  // perspective: how it is actually seen on the sphere
  if (want('g_core')) report.g_core = stats(save('gnom_core_60', gnomonic(src, coreLon, 0, 60, gw, gh)));
  if (want('g_core_roll')) save('gnom_core_60_roll', gnomonic(src, coreLon + 8, 6, 60, gw, gh, 35));
  if (want('g_arm')) save('gnom_arm_60', gnomonic(src, coreLon + 70, 0, 60, gw, gh));
  if (want('g_anti')) save('gnom_anticentre_60', gnomonic(src, coreLon + 180, 0, 60, gw, gh));
  if (want('g_pole')) save('gnom_pole_60', gnomonic(src, coreLon, 90, 60, gw, gh));
  if (want('g_spole')) save('gnom_southpole_60', gnomonic(src, coreLon, -90, 60, gw, gh));
  if (want('g_mid')) save('gnom_midlat_60', gnomonic(src, coreLon + 30, 40, 60, gw, gh));
  if (want('g_seam')) save('gnom_seam_60', gnomonic(src, 0, 0, 60, gw, gh));
  if (want('g_wide')) save('gnom_core_100', gnomonic(src, coreLon, 0, 100, gw, gh));
  if (want('g_tele')) save('gnom_core_25', gnomonic(src, coreLon - 6, 2, 25, gw, gh));
  return report;
};
