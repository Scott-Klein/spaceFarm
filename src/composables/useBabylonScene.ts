import { initialise } from '@/globals';
import {
  createEngine,
  createSceneContext,
  startEngine,
  disposeEngine,
  disposeScene,
  registerSceneWithShadowSupport,
  setGpuTimingEnabled
} from '@babylonjs/lite';
export interface BabylonSceneOptions {
  canvas: HTMLCanvasElement;
  onSceneReady?: () => void | Promise<void>;
}

async function setupBabylonScene(options: BabylonSceneOptions) {
  const { canvas, onSceneReady } = options;

  if (!canvas) {
    throw Error('Canvas! Where is the canvas? YOU NEED A CANVAS')
  }

  // Create WebGPU engine
  const engine = await createEngine(canvas);

  // Create scene
  const scene = createSceneContext(engine);
  initialise(engine, scene, canvas)

  // turing on some debugging, can disable this later
  setGpuTimingEnabled($engine, true)
  // Call the setup callback
  // must finish before registerSceneWithShadowSupport: shadow lights/casters have to exist by then
  if (onSceneReady) {
    await onSceneReady();
  }

  await registerSceneWithShadowSupport(scene);
  // Start render loop
  await startEngine(engine);

  const dispose = () => {
    disposeScene(scene);
    disposeEngine(engine);
  }

  return {
    engine,
    scene,
    dispose
  };
}

export default setupBabylonScene;