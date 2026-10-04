import { initialise } from '@/globals';
import {
  createEngine,
  createSceneContext,
  startEngine,
  disposeEngine,
  disposeScene,
  registerSceneWithShadowSupport
} from '@babylonjs/lite';
export interface BabylonSceneOptions {
  canvas: HTMLCanvasElement;
  onSceneReady?: () => void;
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
  // Call the setup callback
  if (onSceneReady) {
    onSceneReady();
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