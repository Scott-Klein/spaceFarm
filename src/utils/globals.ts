import type { EngineContext, SceneContext } from '@babylonjs/lite';
import useLogStore from '@/stores/logs';
import type { GameEngine } from '@/engine';

declare global {
  var $engine: EngineContext;
  var $scene: SceneContext;
  var $canvas: HTMLCanvasElement;
  var $log: ReturnType<typeof useLogStore>;
  var $game: GameEngine;
}

const initialise = (eng: EngineContext, scene: SceneContext, canvas: HTMLCanvasElement) => {
  globalThis.$engine = eng;
  globalThis.$scene = scene;
  globalThis.$canvas = canvas;
  globalThis.$log = useLogStore();
};

const setGameEngine = (game: GameEngine) => {
  globalThis.$game = game;
}
export { initialise, setGameEngine };
