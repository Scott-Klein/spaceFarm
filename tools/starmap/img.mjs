// Image helpers for the star map harness. Everything works on tightly packed RGB8
// buffers ({ w, h, data: Uint8Array of w*h*3 }) so there are no dependencies at all.
import zlib from 'node:zlib';
import fs from 'node:fs';

export const makeImage = (w, h) => ({ w, h, data: new Uint8Array(w * h * 3) });

/** Minimal PNG writer (8-bit RGB, filter 0). */
export const writePng = (path, img) => {
  const { w, h, data } = img;
  const stride = w * 3;
  const raw = Buffer.alloc((stride + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0;
    raw.set(data.subarray(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  fs.writeFileSync(
    path,
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', zlib.deflateSync(raw, { level: 6 })),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
};

/** 1:1 crop. x wraps (the map tiles horizontally), y is clamped. */
export const crop = (src, x0, y0, w, h) => {
  const out = makeImage(w, h);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(src.h - 1, Math.max(0, y0 + y));
    for (let x = 0; x < w; x++) {
      const sx = (((x0 + x) % src.w) + src.w) % src.w;
      const si = (sy * src.w + sx) * 3;
      const di = (y * w + x) * 3;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
    }
  }
  return out;
};

/** Integer nearest-neighbour zoom, for pixel peeping. */
export const zoom = (src, k) => {
  const out = makeImage(src.w * k, src.h * k);
  for (let y = 0; y < out.h; y++) {
    const sy = (y / k) | 0;
    for (let x = 0; x < out.w; x++) {
      const si = (sy * src.w + ((x / k) | 0)) * 3;
      const di = (y * out.w + x) * 3;
      out.data[di] = src.data[si];
      out.data[di + 1] = src.data[si + 1];
      out.data[di + 2] = src.data[si + 2];
    }
  }
  return out;
};

/** Box-filter downsample to a target width (area average, gamma-naive like a browser). */
export const downsample = (src, w) => {
  const h = Math.round((src.h * w) / src.w);
  const out = makeImage(w, h);
  const fx = src.w / w;
  const fy = src.h / h;
  for (let y = 0; y < h; y++) {
    const ya = Math.floor(y * fy);
    const yb = Math.max(ya + 1, Math.floor((y + 1) * fy));
    for (let x = 0; x < w; x++) {
      const xa = Math.floor(x * fx);
      const xb = Math.max(xa + 1, Math.floor((x + 1) * fx));
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = ya; sy < yb; sy++) {
        let si = (sy * src.w + xa) * 3;
        for (let sx = xa; sx < xb; sx++, si += 3) {
          r += src.data[si];
          g += src.data[si + 1];
          b += src.data[si + 2];
        }
      }
      const n = (yb - ya) * (xb - xa);
      const di = (y * w + x) * 3;
      out.data[di] = r / n;
      out.data[di + 1] = g / n;
      out.data[di + 2] = b / n;
    }
  }
  return out;
};

const RAD = Math.PI / 180;

/**
 * Gnomonic (rectilinear perspective) view of an equirectangular map, sampled the way the
 * GPU will: bilinear, no mipmaps, u repeats, v clamps. lon/lat are map coordinates in
 * degrees (lon 0..360 across the width, lat +90 at the top row), fov is horizontal.
 */
export const gnomonic = (src, lonDeg, latDeg, fovDeg, w, h, rollDeg = 0) => {
  const out = makeImage(w, h);
  const phi = lonDeg * RAD;
  const theta = (90 - latDeg) * RAD;
  const st = Math.sin(theta);
  const ct = Math.cos(theta);
  const sp = Math.sin(phi);
  const cp = Math.cos(phi);
  const f = [st * cp, ct, st * sp];
  // right = increasing longitude, up = towards the top row, so the view is not mirrored
  // relative to the flat map
  let r = [-sp, 0, cp];
  let u = [-ct * cp, st, -ct * sp];
  if (rollDeg) {
    const cr = Math.cos(rollDeg * RAD);
    const sr = Math.sin(rollDeg * RAD);
    const r2 = [r[0] * cr + u[0] * sr, r[1] * cr + u[1] * sr, r[2] * cr + u[2] * sr];
    const u2 = [u[0] * cr - r[0] * sr, u[1] * cr - r[1] * sr, u[2] * cr - r[2] * sr];
    r = r2;
    u = u2;
  }
  const tx = Math.tan((fovDeg * RAD) / 2);
  const ty = (tx * h) / w;
  const sw = src.w;
  const sh = src.h;
  const sd = src.data;
  for (let j = 0; j < h; j++) {
    const y = (1 - (2 * (j + 0.5)) / h) * ty;
    for (let i = 0; i < w; i++) {
      const x = ((2 * (i + 0.5)) / w - 1) * tx;
      const dx = f[0] + x * r[0] + y * u[0];
      const dy = f[1] + x * r[1] + y * u[1];
      const dz = f[2] + x * r[2] + y * u[2];
      const len = Math.hypot(dx, dy, dz);
      let lon = Math.atan2(dz, dx);
      if (lon < 0) lon += 2 * Math.PI;
      const pol = Math.acos(dy / len);
      const sx = (lon / (2 * Math.PI)) * sw - 0.5;
      const sy = Math.min(sh - 1, Math.max(0, (pol / Math.PI) * sh - 0.5));
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const ax = sx - x0;
      const ay = sy - y0;
      const xa = ((x0 % sw) + sw) % sw;
      const xb = (xa + 1) % sw;
      const yb = Math.min(sh - 1, y0 + 1);
      const i00 = (y0 * sw + xa) * 3;
      const i10 = (y0 * sw + xb) * 3;
      const i01 = (yb * sw + xa) * 3;
      const i11 = (yb * sw + xb) * 3;
      const di = (j * w + i) * 3;
      for (let c = 0; c < 3; c++) {
        const top = sd[i00 + c] * (1 - ax) + sd[i10 + c] * ax;
        const bot = sd[i01 + c] * (1 - ax) + sd[i11 + c] * ax;
        out.data[di + c] = top * (1 - ay) + bot * ay + 0.5;
      }
    }
  }
  return out;
};

/** Side-by-side (or stacked) montage with a thin separator, for A/B comparison. */
export const montage = (imgs, vertical = false, gap = 6) => {
  const w = vertical
    ? Math.max(...imgs.map((i) => i.w))
    : imgs.reduce((s, i) => s + i.w, 0) + gap * (imgs.length - 1);
  const h = vertical
    ? imgs.reduce((s, i) => s + i.h, 0) + gap * (imgs.length - 1)
    : Math.max(...imgs.map((i) => i.h));
  const out = makeImage(w, h);
  out.data.fill(48);
  let ox = 0;
  let oy = 0;
  for (const im of imgs) {
    for (let y = 0; y < im.h; y++) {
      out.data.set(im.data.subarray(y * im.w * 3, (y + 1) * im.w * 3), ((oy + y) * w + ox) * 3);
    }
    if (vertical) oy += im.h + gap;
    else ox += im.w + gap;
  }
  return out;
};

/** Per-channel mean / percentiles of a region, to put numbers behind "too bright". */
export const stats = (img) => {
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  const n = img.w * img.h;
  for (let i = 0; i < n; i++) {
    hist[0][img.data[i * 3]]++;
    hist[1][img.data[i * 3 + 1]]++;
    hist[2][img.data[i * 3 + 2]]++;
  }
  const pct = (h, p) => {
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += h[v];
      if (acc >= p * n) return v;
    }
    return 255;
  };
  const mean = (h) => {
    let s = 0;
    for (let v = 0; v < 256; v++) s += v * h[v];
    return +(s / n).toFixed(1);
  };
  return {
    mean: hist.map(mean),
    p50: hist.map((h) => pct(h, 0.5)),
    p99: hist.map((h) => pct(h, 0.99)),
    p999: hist.map((h) => pct(h, 0.999)),
    clipped: +((hist[1][255] / n) * 100).toFixed(3),
  };
};
