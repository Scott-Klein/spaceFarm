/* eslint-disable @typescript-eslint/no-unused-vars */
import type { EngineContext, SceneContext } from '@babylonjs/lite';

declare global {
  var $engine: EngineContext;
  var $scene: SceneContext;
  var $canvas: HTMLCanvasElement;
}

const initialise = (eng: EngineContext, scene: SceneContext, canvas: HTMLCanvasElement) => {
  globalThis.$engine = eng;
  globalThis.$scene = scene;
};
export { initialise };
