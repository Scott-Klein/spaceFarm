<template>
  <div class="w-full h-full bg-green-200 flex flex-col">
    <p>Stars</p>
    <canvas ref="canvas" class="w-1/2 h-1/2"></canvas>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

const canvas = ref<HTMLCanvasElement>();
const gaussian = () => {
  const u = 1 - Math.random();
  const v = Math.random();
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
onMounted(() => {
  const stamp = makeStarStamp();
  const height = 2048;
  const width = 4096;
  if (canvas.value) {
    const sigma = 0.4; // band tightness
    canvas.value.width = 4096;
    canvas.value.height = 2048;
    const cv = canvas.value;
    const ctx = cv.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#05060a';
      ctx.fillRect(0, 0, 4096, 2048);
      const glowLayer = makeGlowLayer(canvas.value.width, canvas.value.height, sigma);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.2;
      ctx.drawImage(glowLayer, 0, 0, width, height);

      const W = 4096,
        H = 2048;

      const count = 30000;

      ctx.globalCompositeOperation = 'lighter';

      for (let i = 0; i < count; i++) {
        let y = gaussian() * sigma;
        while (y < -1 || y > 1) y = gaussian() * sigma;

        const px = Math.random() * W;
        const py = (Math.acos(y) / Math.PI) * H;

        const b = Math.random() ** 3; // few bright, many faint
        const r = 1 + b * 6;

        ctx.globalAlpha = 0.1 + b * 0.9;
        ctx.drawImage(stamp, px - r, py - r, r * 2, r * 2);

        if (px < r) ctx.drawImage(stamp, px + W - r, py - r, r * 2, r * 2);
        if (px > W - r) ctx.drawImage(stamp, px - W - r, py - r, r * 2, r * 2);
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }
});

const makeGlowLayer = (W: number, H: number, sigma: number): OffscreenCanvas => {
  const c = new OffscreenCanvas(W, H);
  const ctx = c.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const d = img.data;

  for (let py = 0; py < H; py++) {
    const ys = Math.cos((py / H) * Math.PI); // row → sphere axis
    const w = Math.exp(-(ys * ys) / (2 * sigma * sigma));
    for (let px = 0; px < W; px++) {
      const v = w * Math.random() * 255;
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
</script>
