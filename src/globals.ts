/* eslint-disable @typescript-eslint/no-unused-vars */
import type { EngineContext, SceneContext } from '@babylonjs/lite';
import useLogStore from './stores/logs';

declare global {
  var $engine: EngineContext;
  var $scene: SceneContext;
  var $canvas: HTMLCanvasElement;
  var $log: ReturnType<typeof useLogStore>;
}

const initialise = (eng: EngineContext, scene: SceneContext, canvas: HTMLCanvasElement) => {
  globalThis.$engine = eng;
  globalThis.$scene = scene;
  globalThis.$canvas = canvas;
  globalThis.$log = useLogStore();
};
export { initialise };
