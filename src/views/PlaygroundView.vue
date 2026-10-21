<template>
  <div class="relative flex flex-1 min-h-0 w-full select-none bg-black" :data-planet-state="state">
    <canvas
      ref="canvasRef"
      touch-action="none"
      class="absolute inset-0 h-full w-full min-h-0 min-w-0 outline-none"
    ></canvas>

    <Transition leave-active-class="transition-opacity duration-1000" leave-to-class="opacity-0">
      <div
        v-if="state === 'loading'"
        class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 text-[11px] uppercase tracking-[0.35em] text-white/50"
      >
        <span>Forming planet</span>
        <div class="h-px w-40 bg-white/15">
          <div class="h-px bg-white/70 transition-[width] duration-200" :style="{ width: `${progress * 100}%` }"></div>
        </div>
      </div>
    </Transition>

    <p v-if="state === 'error'" class="absolute inset-0 flex items-center justify-center text-sm text-white/60">
      {{ hasWebGpu ? 'The planet could not be created; see the console for details.' : 'This view needs a browser with WebGPU.' }}
    </p>

    <span v-if="seed !== undefined" class="pointer-events-none absolute bottom-3 left-4 font-mono text-[11px] text-white/25">
      seed {{ seed }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import {
  addToScene,
  attachControl,
  createArcRotateCamera,
  createEngine,
  createSceneContext,
  disposeEngine,
  disposeScene,
  enableSurfaceResizeObserver,
  onBeforeRender,
  onSceneDispose,
  registerScene,
  setCameraLimits,
  startEngine,
  type EngineContext,
  type SceneContext,
} from '@babylonjs/lite';
import { generatePlanet } from '@/engine/planet/generatePlanet';
import { createPlanetView, type PlanetView } from '@/engine/planet/planetRenderer';

const canvasRef = ref<HTMLCanvasElement | null>(null);
const state = ref<'loading' | 'ready' | 'error'>('loading');
const progress = ref(0);
const seed = ref<number>();
const hasWebGpu = 'gpu' in navigator;
let engine: EngineContext | undefined;
let scene: SceneContext | undefined;
let planet: PlanetView | undefined;
let stopResizeObserver: (() => void) | undefined;
const abort = new AbortController();
let unmounted = false;

/** Cube-face resolution of the planet's maps. */
const MAP_SIZE = 1024;
const FADE_MS = 1600;
const CAMERA_DISTANCE = 4.2;

/** A fresh planet on every visit; ?seed=N brings a particular one back, ?ocean drowns the land. */
const params = new URLSearchParams(location.search);
const seedFromUrl = () => {
  const s = Number(params.get('seed'));
  return Number.isInteger(s) && s > 0 ? s >>> 0 : (Math.random() * 2 ** 32) >>> 0;
};

async function setup(canvas: HTMLCanvasElement) {
  seed.value = seedFromUrl();
  const started = performance.now();
  const maps = generatePlanet(seed.value, MAP_SIZE, {
    ocean: params.has('ocean'),
    signal: abort.signal,
    onProgress: (f) => (progress.value = f),
  });

  // no MSAA: the planet's limb is anti-aliased analytically in its shader
  engine = await createEngine(canvas, { msaaSamples: 1, maxDevicePixelRatio: 2 });
  stopResizeObserver = enableSurfaceResizeObserver(engine);
  scene = createSceneContext(engine);
  scene.clearColor = { r: 0, g: 0, b: 0, a: 1 };
  const camera = createArcRotateCamera(-Math.PI / 2, Math.PI / 2, CAMERA_DISTANCE, { x: 0, y: 0, z: 0 });
  camera.nearPlane = 0.05;
  camera.farPlane = 100;
  camera.angularSensibility = 2000;
  camera.wheelPrecision = 8;
  scene.camera = camera;
  // orbit and zoom; the right button orbits too, so the planet always stays centred
  setCameraLimits(camera, { lowerRadiusLimit: 2, upperRadiusLimit: 14, lowerBetaLimit: 0.1, upperBetaLimit: Math.PI - 0.1 }, scene);
  onSceneDispose(scene, attachControl(camera, canvas, scene, { pointerMappings: { primaryButton: 'rotate', secondaryButton: 'rotate' } }));

  planet = createPlanetView(engine, await maps, {
    // toward the sun: from the left, a little above and in front of the planet
    sunDirection: [-0.75, 0.28, -0.6],
    tilt: (23 * Math.PI) / 180,
    spinPeriod: 240,
    cloudDriftPeriod: 900,
  });
  if (unmounted) return;
  console.info(`planet ${seed.value}: generated in ${((performance.now() - started) / 1000).toFixed(2)}s`);
  planet.setExposure(0);
  addToScene(scene, planet.mesh);

  // frame the planet (plus its glow) in the shorter side of the view
  const halfAngle = Math.asin(1 / CAMERA_DISTANCE) * 1.17;
  let fade = 0;
  onBeforeRender(scene, (dt) => {
    const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
    camera.fov = 2 * Math.atan(Math.tan(halfAngle) / Math.min(1, aspect));
    planet!.update(dt);
    if (fade < 1) {
      fade = Math.min(1, fade + dt / FADE_MS);
      planet!.setExposure(fade * fade * (3 - 2 * fade));
    }
  });

  await registerScene(scene);
  if (unmounted) return;
  await startEngine(engine);
  state.value = 'ready';
}

function dispose() {
  abort.abort();
  stopResizeObserver?.();
  if (scene) disposeScene(scene);
  planet?.dispose();
  if (engine) disposeEngine(engine);
  stopResizeObserver = undefined;
  scene = undefined;
  planet = undefined;
  engine = undefined;
}

onMounted(async () => {
  if (!canvasRef.value) return;
  try {
    await setup(canvasRef.value);
  } catch (err) {
    if (!unmounted) {
      state.value = 'error';
      console.error(err);
    }
  } finally {
    // anything created after an early unmount is released here
    if (unmounted) dispose();
  }
});

onUnmounted(() => {
  unmounted = true;
  dispose();
});
</script>
