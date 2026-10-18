<template>
  <div class="flex min-h-0 flex-1 bg-neutral-900 text-xs text-neutral-200">
    <aside class="flex w-80 shrink-0 flex-col border-r border-neutral-700">
      <div class="space-y-2 border-b border-neutral-700 p-2">
        <div class="flex items-center gap-1">
          <button
            v-for="g in generators"
            :key="g"
            class="flex-1 rounded px-2 py-1"
            :class="generator === g ? 'bg-sky-600 text-white' : 'bg-neutral-700'"
            @click="generator = g"
          >
            {{ g === 'new' ? 'New generator' : 'Old generator' }}
          </button>
        </div>
        <div class="flex items-center gap-2">
          <button class="rounded bg-emerald-600 px-3 py-1 font-bold text-white" @click="generate">
            Regenerate
          </button>
          <label class="flex items-center gap-1"
            ><input v-model="auto" type="checkbox" />auto</label
          >
          <label class="ml-auto flex items-center gap-1">
            size
            <select v-model.number="size" class="rounded bg-neutral-700 px-1 py-0.5">
              <option v-for="s in sizes" :key="s" :value="s">{{ s }}</option>
            </select>
          </label>
        </div>
        <p class="text-neutral-400">{{ status }}</p>
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto p-2">
        <p v-if="generator === 'old'" class="text-neutral-400">
          The old generator only takes a size and a seed (below). Switch back to tune.
        </p>
        <details
          v-for="section in sections"
          v-show="generator === 'new' || section.title === 'general'"
          :key="section.title"
          class="mb-1 rounded bg-neutral-800"
          :open="section.title === 'general'"
        >
          <summary class="cursor-pointer px-2 py-1 font-bold">
            {{ section.title }}
            <span v-if="changedIn(section)" class="text-amber-400">({{ changedIn(section) }})</span>
          </summary>
          <div
            v-for="f in section.fields"
            :key="f.id"
            class="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-1 px-2 py-0.5"
          >
            <button
              class="truncate text-left"
              :class="isChanged(f) ? 'text-amber-400' : ''"
              :title="`${f.id} — default ${JSON.stringify(f.range.value)}, range ${f.range.min}–${f.range.max}. Click to reset.`"
              @click="reset(f)"
            >
              {{ f.name }}
            </button>
            <template v-if="!f.vec">
              <input
                type="range"
                class="w-full min-w-0"
                :min="f.range.min"
                :max="f.range.max"
                :step="f.range.step"
                :value="num(f)"
                @input="setNum(f, $event)"
              />
              <input
                type="number"
                class="w-full rounded bg-neutral-700 px-1"
                :step="f.range.step"
                :value="num(f)"
                @change="setNum(f, $event)"
              />
            </template>
            <div v-else class="col-span-2 flex gap-1">
              <input
                v-for="i in 3"
                :key="i"
                type="number"
                class="w-full rounded bg-neutral-700 px-1"
                :min="f.range.min"
                :max="f.range.max"
                :step="f.range.step"
                :value="vec(f)[i - 1]"
                @change="setVec(f, i - 1, $event)"
              />
            </div>
          </div>
        </details>
      </div>

      <div class="space-y-1 border-t border-neutral-700 p-2">
        <div class="flex items-center gap-1">
          <span class="font-bold">Overrides</span>
          <button class="ml-auto rounded bg-neutral-700 px-2 py-0.5" @click="copyOverrides">
            Copy
          </button>
          <button class="rounded bg-neutral-700 px-2 py-0.5" @click="applyText">Apply</button>
          <button class="rounded bg-neutral-700 px-2 py-0.5" @click="resetAll">Reset all</button>
        </div>
        <textarea
          v-model="overridesText"
          class="h-24 w-full rounded bg-neutral-800 p-1 font-mono"
          spellcheck="false"
        ></textarea>
      </div>
    </aside>

    <main class="flex min-w-0 flex-1 flex-col bg-black">
      <!-- fit to window: the whole map. Click to centre the detail view below on a point. -->
      <canvas
        ref="fitCanvas"
        class="mx-auto block aspect-[2/1] w-full max-w-3xl shrink-0 cursor-crosshair"
        @click="lookAt"
      ></canvas>
      <div class="flex items-center gap-1 border-y border-neutral-700 bg-neutral-900 p-1">
        <button
          v-for="m in modes"
          :key="m"
          class="rounded px-2 py-0.5"
          :class="mode === m ? 'bg-sky-600 text-white' : 'bg-neutral-700'"
          @click="mode = m"
        >
          {{ m === 'actual' ? '1:1' : 'On the sphere' }}
        </button>
        <span v-if="mode === 'sphere'" class="text-neutral-400">
          drag to look around, wheel to zoom — {{ view.fov.toFixed(0) }}° field of view
        </span>
      </div>
      <!-- 1:1: every texel is one screen pixel -->
      <div v-show="mode === 'actual'" ref="scroller" class="min-h-0 flex-1 overflow-auto">
        <canvas ref="mapCanvas" class="block max-w-none"></canvas>
      </div>
      <!-- perspective: sampled the way the GPU will, bilinear with no mipmaps -->
      <div v-show="mode === 'sphere'" ref="sphereBox" class="min-h-0 flex-1 overflow-hidden">
        <canvas
          ref="sphereCanvas"
          class="block h-full w-full cursor-grab touch-none"
          @pointerdown="dragStart"
          @pointermove="dragMove"
          @wheel.prevent="zoom"
        ></canvas>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import {
  STAR_MAP_DEFAULTS,
  STAR_MAP_RANGES,
  type StarMapOverrides,
  type StarMapRange,
} from '@/engine/stars/starMap';

type Tree = { [key: string]: Tree | number | number[] };
type Range = StarMapRange<number | number[]>;
interface Field {
  id: string;
  name: string;
  path: string[];
  range: Range;
  vec: boolean;
}
interface Section {
  title: string;
  fields: Field[];
}

const STORAGE_KEY = 'starPreview.overrides';
const generators = ['new', 'old'] as const;
const modes = ['actual', 'sphere'] as const;
const sizes = [1024, 2048, 4096, 8192, 16384];

// --- controls, built from the module's own range table --------------------------------
const isRange = (x: object): x is Range => 'min' in x && 'value' in x;
const sections: Section[] = [];
const walk = (node: object, path: string[]) => {
  const section: Section = { title: path.join('.') || 'general', fields: [] };
  sections.push(section);
  for (const [name, v] of Object.entries(node)) {
    if (!isRange(v)) continue;
    // size is the preview resolution, chosen above, not part of the look
    if (!path.length && name === 'size') continue;
    const p = [...path, name];
    section.fields.push({ id: p.join('.'), name, path: p, range: v, vec: Array.isArray(v.value) });
  }
  for (const [name, v] of Object.entries(node)) if (!isRange(v)) walk(v, [...path, name]);
};
walk(STAR_MAP_RANGES, []);
const fields = sections.flatMap((s) => s.fields);

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const opts = reactive(clone(STAR_MAP_DEFAULTS)) as unknown as Tree;
const defaults = STAR_MAP_DEFAULTS as unknown as Tree;

const read = (root: Tree | undefined, path: string[]): unknown =>
  path.reduce<unknown>((o, k) => (o as Tree | undefined)?.[k], root);
const write = (root: Tree, path: string[], value: number | number[]) => {
  let node = root;
  for (const k of path.slice(0, -1)) node = (node[k] ??= {}) as Tree;
  node[path[path.length - 1]!] = value;
};

const num = (f: Field) => read(opts, f.path) as number;
const vec = (f: Field) => read(opts, f.path) as number[];
const inputValue = (e: Event) => Number((e.target as HTMLInputElement).value);
const setNum = (f: Field, e: Event) => {
  const v = inputValue(e);
  if (Number.isFinite(v)) write(opts, f.path, v);
};
const setVec = (f: Field, i: number, e: Event) => {
  const v = inputValue(e);
  if (Number.isFinite(v)) vec(f)[i] = v;
};
const isChanged = (f: Field) =>
  JSON.stringify(read(opts, f.path)) !== JSON.stringify(read(defaults, f.path));
const changedIn = (s: Section) => s.fields.filter(isChanged).length;
const reset = (f: Field) => write(opts, f.path, clone(read(defaults, f.path) as number | number[]));

/** Only the fields that differ from the defaults: paste it straight into makeStarMapBitmap(). */
const overrides = (): Tree => {
  const out: Tree = {};
  for (const f of fields) {
    if (isChanged(f)) write(out, f.path, clone(read(opts, f.path) as number | number[]));
  }
  return out;
};
const apply = (o: Tree) => {
  for (const f of fields) {
    const v = read(o, f.path);
    const d = read(defaults, f.path) as number | number[];
    const ok = Array.isArray(d)
      ? Array.isArray(v) && v.length === d.length && v.every((x) => typeof x === 'number')
      : typeof v === 'number';
    write(opts, f.path, clone(ok ? (v as number | number[]) : d));
  }
};

const overridesText = ref('{}');
const copyOverrides = () => navigator.clipboard?.writeText(overridesText.value);
const applyText = () => {
  try {
    apply(JSON.parse(overridesText.value));
  } catch (err) {
    status.value = `Overrides are not valid JSON: ${err}`;
  }
};
const resetAll = () => apply({});

// --- generation ------------------------------------------------------------------------
const generator = ref<(typeof generators)[number]>('new');
const mode = ref<(typeof modes)[number]>('actual');
const size = ref(2048);
const auto = ref(true);
const status = ref('');

const fitCanvas = ref<HTMLCanvasElement>();
const mapCanvas = ref<HTMLCanvasElement>();
const sphereCanvas = ref<HTMLCanvasElement>();
const scroller = ref<HTMLDivElement>();
const sphereBox = ref<HTMLDivElement>();

let worker: Worker | undefined;
let run = 0;
let pixels: ImageData | undefined; // the finished map, for the sphere view

// The new generator runs in the worker the game itself uses; the old one has its own, kept
// only for this comparison. A fresh worker per render means a stale one can just be killed.
const spawn = {
  new: () =>
    new Worker(new URL('../engine/stars/starMap.worker.ts', import.meta.url), { type: 'module' }),
  old: () =>
    new Worker(new URL('../engine/stars/starSkyBox.worker.ts', import.meta.url), { type: 'module' }),
};
const render = (
  which: (typeof generators)[number],
  message: StarMapOverrides | { scale: number; seed: number },
) =>
  new Promise<ImageBitmap>((resolve, reject) => {
    const w = spawn[which]();
    worker = w;
    w.onmessage = (e: MessageEvent<ImageBitmap>) => {
      resolve(e.data);
      w.terminate();
    };
    w.onerror = (e) => {
      reject(e.error ?? new Error(e.message));
      w.terminate();
    };
    w.postMessage(message);
  });

const generate = async () => {
  const id = ++run;
  worker?.terminate(); // whatever was still rendering is stale now
  const which = generator.value;
  status.value = `Generating ${size.value}x${size.value / 2} (${which})…`;
  const t0 = performance.now();
  let bitmap: ImageBitmap;
  try {
    bitmap = await render(
      which,
      which === 'old'
        ? { scale: size.value / 4096, seed: opts.seed as number }
        : { ...(overrides() as StarMapOverrides), size: size.value },
    );
  } catch (err) {
    if (id === run) status.value = `Failed: ${err}`;
    return;
  }
  if (id !== run) return bitmap.close();

  const map = mapCanvas.value!;
  const resized = map.width !== bitmap.width;
  map.width = bitmap.width;
  map.height = bitmap.height;
  const ctx = map.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  pixels = ctx.getImageData(0, 0, map.width, map.height);

  const fit = fitCanvas.value!;
  fit.width = Math.min(map.width, 1536);
  fit.height = fit.width / 2;
  const fctx = fit.getContext('2d')!;
  fctx.imageSmoothingQuality = 'high';
  fctx.drawImage(map, 0, 0, fit.width, fit.height);

  status.value = `${map.width}x${map.height} (${which}) in ${((performance.now() - t0) / 1000).toFixed(1)}s`;
  // a new size moves every texel, so put the 1:1 pane back on what it was showing
  if (resized) scrollToView();
  drawSphere();
};

let timer: ReturnType<typeof setTimeout> | undefined;
const schedule = () => {
  clearTimeout(timer);
  timer = setTimeout(generate, 250);
};
watch(
  opts,
  () => {
    const o = overrides();
    overridesText.value = JSON.stringify(o, null, 1);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
    if (auto.value) schedule();
  },
  { deep: true },
);
watch([generator, size], schedule);

// --- views -----------------------------------------------------------------------------
const view = reactive({ lon: 180, lat: 0, fov: 60 });

/** Centre the 1:1 view on the map coordinate the sphere view is looking at. */
const scrollToView = () => {
  const box = scroller.value;
  const map = mapCanvas.value;
  if (!box || !map) return;
  box.scrollLeft = (view.lon / 360) * map.width - box.clientWidth / 2;
  box.scrollTop = ((90 - view.lat) / 180) * map.height - box.clientHeight / 2;
};

/** Centre both detail views on the point clicked in the overview. */
const lookAt = (e: MouseEvent) => {
  const el = e.currentTarget as HTMLCanvasElement;
  view.lon = (e.offsetX / el.clientWidth) * 360;
  view.lat = 90 - (e.offsetY / el.clientHeight) * 180;
  scrollToView();
};

/** Gnomonic view of the map, sampled bilinearly with u wrapping and v clamped. */
const drawSphere = () => {
  const cv = sphereCanvas.value;
  const box = sphereBox.value;
  if (mode.value !== 'sphere' || !cv || !box || !pixels) return;
  const w = Math.max(2, box.clientWidth);
  const h = Math.max(2, box.clientHeight);
  if (cv.width !== w || cv.height !== h) {
    cv.width = w;
    cv.height = h;
  }
  const ctx = cv.getContext('2d')!;
  const out = ctx.createImageData(w, h);
  const src = pixels.data;
  const sw = pixels.width;
  const sh = pixels.height;
  const rad = Math.PI / 180;
  const theta = (90 - view.lat) * rad;
  const phi = view.lon * rad;
  const st = Math.sin(theta);
  const ct = Math.cos(theta);
  const sp = Math.sin(phi);
  const cp = Math.cos(phi);
  const tx = Math.tan((view.fov * rad) / 2);
  const ty = (tx * h) / w;
  for (let j = 0, k = 0; j < h; j++) {
    const y = (1 - (2 * (j + 0.5)) / h) * ty;
    for (let i = 0; i < w; i++, k += 4) {
      const x = ((2 * (i + 0.5)) / w - 1) * tx;
      // forward + x * east + y * north
      const dx = st * cp - x * sp - y * ct * cp;
      const dy = ct + y * st;
      const dz = st * sp + x * cp - y * ct * sp;
      let lon = Math.atan2(dz, dx);
      if (lon < 0) lon += 2 * Math.PI;
      const fx = (lon / (2 * Math.PI)) * sw - 0.5;
      const fy = Math.min(
        sh - 1,
        Math.max(0, (Math.acos(dy / Math.hypot(dx, dy, dz)) / Math.PI) * sh - 0.5),
      );
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const ax = fx - x0;
      const ay = fy - y0;
      const xa = ((x0 % sw) + sw) % sw;
      const xb = (xa + 1) % sw;
      const yb = Math.min(sh - 1, y0 + 1);
      for (let c = 0; c < 3; c++) {
        const top = src[(y0 * sw + xa) * 4 + c]! * (1 - ax) + src[(y0 * sw + xb) * 4 + c]! * ax;
        const bot = src[(yb * sw + xa) * 4 + c]! * (1 - ax) + src[(yb * sw + xb) * 4 + c]! * ax;
        out.data[k + c] = top * (1 - ay) + bot * ay;
      }
      out.data[k + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
};

let frame = 0;
const redraw = () => {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(drawSphere);
};
watch(view, redraw);
watch(mode, () => nextTick(drawSphere));

let last: { x: number; y: number } | undefined;
const dragStart = (e: PointerEvent) => {
  last = { x: e.clientX, y: e.clientY };
  (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
};
const dragMove = (e: PointerEvent) => {
  if (!last || !e.buttons) return;
  const perPx = view.fov / (sphereCanvas.value?.clientWidth || 1);
  view.lon = (view.lon - (e.clientX - last.x) * perPx + 360) % 360;
  view.lat = Math.max(-90, Math.min(90, view.lat + (e.clientY - last.y) * perPx));
  last = { x: e.clientX, y: e.clientY };
};
const zoom = (e: WheelEvent) => {
  view.fov = Math.max(10, Math.min(120, view.fov * (e.deltaY > 0 ? 1.1 : 1 / 1.1)));
};

onMounted(() => {
  window.addEventListener('resize', redraw);
  try {
    apply(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}'));
  } catch {
    // stale or hand-edited storage: start from the defaults
  }
  generate();
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', redraw);
  clearTimeout(timer);
  cancelAnimationFrame(frame);
  run++;
  worker?.terminate();
});
</script>
