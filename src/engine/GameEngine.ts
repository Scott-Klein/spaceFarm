import GameObject from './GameObject';
import CameraController from './CameraController';
import InputManager from './InputManager';
import Spaceship from './ships/Spaceship';
//import type { useGameStore } from '@/stores/gameState';
import { addToScene, createHemisphericLight, onBeforeRender } from '@babylonjs/lite';

//type GameStore = ReturnType<typeof useGameStore>;

// Type for the store update callback
export type StateUpdateCallback = (state: {
  speed: number;
  throttle: number;
  pitch: number;
  roll: number;
  yaw: number;
}) => void;

export default class GameEngine {
  private readonly TICK_RATE = 120; // 120hz phyics rate no matter our fps
  private readonly DELTA_RATE: number;

  private cameraController: CameraController;
  private inputManager: InputManager;
  private gameObjects: GameObject[] = [];
  private player: GameObject | null = null;
  private selectedObject: GameObject | null = null;

  /**
   * Accumulates time from rendering that the physics engine 'pays off'
   * we run through all the ticks that we can until the accumulator is exhausted
   */
  private accumulator: number = 0;
  private stateUpdateCallback: StateUpdateCallback | null = null;

  constructor() {
    this.cameraController = new CameraController();
    this.inputManager = new InputManager();

    this.setupScene();
    this.setupGameLoop();

    this.DELTA_RATE = (1000) / this.TICK_RATE;
  }

  private setupScene(): void {
    // Set space background color (dark blue/black)
    $scene.clearColor =  { r: 0.01, g: 0.04, b: 0.04, a: 1 }

    // Add ambient light
    const light = createHemisphericLight([1, 1, 1], 0.91);
    addToScene($scene, light);
  }

  private setupGameLoop(): void {
    onBeforeRender($scene, (delta: number) => {
      this.update(delta);
    });
  }

  /**
   * Called on every frame to make sure everything ticks
   * @param deltaTime time since last call (certainly the last frame)
   */
  private update(deltaTime: number): void {
    this.accumulator += deltaTime;
    while (this.accumulator >= this.DELTA_RATE) {
      this.updatePhysics();
      this.accumulator -= this.DELTA_RATE;
    }

    this.updateRender(deltaTime);
  }

  private updatePhysics(): void {
    // Update all game objects
    for (const gameObject of this.gameObjects.values()) {
      gameObject.updatePhysics();
    }

    // Push state updates to store if callback is registered (Game → UI)
    if (this.stateUpdateCallback && this.selectedObject instanceof Spaceship) {
      const angles = this.selectedObject.getOrientationAngles();
      this.stateUpdateCallback({
        speed: this.selectedObject.getSpeed(),
        throttle: this.selectedObject.getThrustPercent(),
        pitch: angles.pitch,
        roll: angles.roll,
        yaw: angles.yaw,
      });
    }
  }

  /**
   * call once per frame, handling dispatching calls to all entities that require action on each frame.
   * NOT for physics work. Physics work is to be done in updatePhysics.
   * Anything called update() without specifying is every frame.
   * Systems that require both kinds of handling will have the special handlers.
   * @param deltaTime time since the last frame in ms
   */
  private updateRender(deltaTime: number): void {
    // Read input state every frame, wouldn't do it in physics because we can multiple ticks per frame and it would waste
    this.inputManager.update();

    // Update all game objects
    for (const gameObject of this.gameObjects.values()) {
      gameObject.updateRender(deltaTime);
    }

    // Update camera
    this.cameraController.update();
  }

  addGameObject(gameObject: GameObject): void {
    gameObject.create();
    this.gameObjects.push(gameObject);
  }

  setPlayerObject(player: GameObject): void {
    player.create();
    this.gameObjects.push(player);
    this.player = player;
    this.cameraController.setTarget(player);
  }

  getPlayer(): GameObject {
    if (this.player) {
      return this.player;
    } else {
      throw Error('Scene wasnt set up correctly, cant find a player?');
    }
  }


  getAllGameObjects(): GameObject[] {
    return this.gameObjects;
  }

  getSelectedObject(): GameObject | null {
    return this.selectedObject;
  }

  getInputManager(): InputManager {
    return this.inputManager;
  }

  getCameraController(): CameraController {
    return this.cameraController;
  }

  /**
   * Register a callback to receive state updates every frame
   * This is how the game engine pushes data to the UI store (Game → UI)
   */
  setStateUpdateCallback(callback: StateUpdateCallback): void {
    this.stateUpdateCallback = callback;
  }
}
