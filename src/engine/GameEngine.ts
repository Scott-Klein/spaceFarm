import { Scene, HemisphericLight, Vector3, Color3 } from '@babylonjs/core';
import { GameObject } from './GameObject';
import { CameraController } from './CameraController';
import { InputManager } from './InputManager';
import { Spaceship } from './Spaceship';

// Type for the store update callback
export type StateUpdateCallback = (state: {
  speed: number;
  maxSpeed: number;
  throttle: number;
  pitch: number;
  roll: number;
  yaw: number;
}) => void;

export class GameEngine {
  private scene: Scene;
  private cameraController: CameraController;
  private inputManager: InputManager;
  private gameObjects: Map<string, GameObject> = new Map();
  private selectedObject: GameObject | null = null;
  private lastTime: number = performance.now();
  private stateUpdateCallback: StateUpdateCallback | null = null;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.cameraController = new CameraController(scene, canvas);
    this.inputManager = new InputManager(scene);

    this.setupScene();
    this.setupGameLoop();
  }

  private setupScene(): void {
    // Set space background color (dark blue/black)
    this.scene.clearColor = new Color3(0.05, 0.05, 0.15).toColor4();

    // Add ambient light
    const light = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene);
    light.intensity = 0.7;
  }

  private setupGameLoop(): void {
    this.scene.onBeforeRenderObservable.add(() => {
      const currentTime = performance.now();
      const deltaTime = currentTime - this.lastTime;
      this.lastTime = currentTime;

      this.update(deltaTime);
    });
  }

  private update(deltaTime: number): void {
    // Update input
    this.inputManager.update();

    // Update all game objects
    for (const gameObject of this.gameObjects.values()) {
      gameObject.update(deltaTime);
    }

    // Update camera
    this.cameraController.update();

    // Push state updates to store if callback is registered (Game → UI)
    if (this.stateUpdateCallback && this.selectedObject instanceof Spaceship) {
      const angles = this.selectedObject.getOrientationAngles();
      this.stateUpdateCallback({
        speed: this.selectedObject.getSpeed(),
        maxSpeed: this.selectedObject.getMaxSpeed(),
        throttle: this.selectedObject.getThrustPercent(),
        pitch: angles.pitch,
        roll: angles.roll,
        yaw: angles.yaw,
      });
    }
  }

  addGameObject(gameObject: GameObject): void {
    gameObject.create(this.scene);
    this.gameObjects.set(gameObject.id, gameObject);
  }

  removeGameObject(id: string): void {
    const gameObject = this.gameObjects.get(id);
    if (gameObject) {
      gameObject.dispose();
      this.gameObjects.delete(id);
    }
  }

  getGameObject(id: string): GameObject | undefined {
    return this.gameObjects.get(id);
  }

  getAllGameObjects(): GameObject[] {
    return Array.from(this.gameObjects.values());
  }

  selectGameObject(id: string): void {
    const gameObject = this.gameObjects.get(id);
    if (gameObject) {
      this.selectedObject = gameObject;
      this.cameraController.setTarget(gameObject);
    }
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

  getScene(): Scene {
    return this.scene;
  }

  /**
   * Register a callback to receive state updates every frame
   * This is how the game engine pushes data to the UI store (Game → UI)
   */
  setStateUpdateCallback(callback: StateUpdateCallback): void {
    this.stateUpdateCallback = callback;
  }
}
