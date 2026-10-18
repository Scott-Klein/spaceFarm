import GameObject from './GameObject';
import CameraController from './CameraController';
import InputManager from './InputManager';
import useGameStore from '@/stores/gameState';
import { onBeforeRender, vec3 } from '@babylonjs/lite';
import LightSystem from './LightSystem';
import { distance } from '@/utils/extensions';
import Spaceship from './ships/Spaceship';
type GameStore = ReturnType<typeof useGameStore>;

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

  public lightSystem: LightSystem;
  private cameraController: CameraController;
  private inputManager: InputManager;
  private gameObjects: Map<string, GameObject> = new Map<string, GameObject>();
  private player: Spaceship | null = null;
  private selectedObject: GameObject | null = null;
  private gameUi: GameStore = useGameStore();
  private frameTimeAccumulator: number = 0;
  private frameCountAccumulator: number = 0;

  /**
   * Accumulates time from rendering that the physics engine 'pays off'
   * we run through all the ticks that we can until the accumulator is exhausted
   */
  private accumulator: number = 0;
  private stateUpdateCallback: StateUpdateCallback | null = null;

  constructor() {
    this.cameraController = new CameraController();
    this.inputManager = new InputManager();
    this.lightSystem = new LightSystem();
    this.setupGameLoop();

    this.DELTA_RATE = 1000 / this.TICK_RATE;
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
    this.frameTimeAccumulator += deltaTime;
    this.frameCountAccumulator++;
    while (this.accumulator >= this.DELTA_RATE) {
      this.updatePhysics();
      this.accumulator -= this.DELTA_RATE;
    }

    this.updateRender(deltaTime);

    if (this.frameTimeAccumulator > 1000) {
      const gputime = $engine.gpuFrameTimeMs;
      this.gameUi.frameRate = `${this.frameCountAccumulator} || gpu ${gputime}`.toString();
      this.frameCountAccumulator = 0;
      this.frameTimeAccumulator = 0;
    }

    // Push state updates to store if callback is registered (Game → UI)
    if (this.stateUpdateCallback && this.player) {
      const angles = this.player.getOrientationAngles();
      this.stateUpdateCallback({
        speed: this.player.getSpeed(),
        throttle: this.player.getThrustPercent(),
        pitch: angles.pitch,
        roll: angles.roll,
        yaw: angles.yaw,
      });
    }

    this.gameUi.markers = [];
    for (const [key, x] of this.gameObjects) {
      const w2s = this.cameraController.world2Screen(x.position);
      if (w2s.behindCamera) continue;
      const dist = distance(x.position, this.player?.position || vec3(0, 0, 0));
      this.gameUi.markers.push({ x: w2s.x, y: w2s.y, label: x.getLabel(), distance: dist, key: key });
    }
  }

  private updatePhysics(): void {
    // Update all game objects
    for (const gameObject of this.gameObjects.values()) {
      gameObject.updatePhysics();
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
    const commands = this.gameUi.drainCommandQueue();

    commands.forEach(x => {
      if (x.target && this.gameObjects.has(x.target)) {
        x.targetObject = this.gameObjects.get(x.target);
      }
    })

    const playerController = this.player?.getController();
    if (playerController) {
      // have the controller swallow the commands.
      playerController.pushCommands(commands);
    }

    // Update all game objects
    for (const gameObject of this.gameObjects.values()) {
      gameObject.updateRender(deltaTime);
    }

    // Update camera
    this.cameraController.update();

    this.lightSystem.update();
  }

  async addGameObject(gameObject: GameObject, player?: boolean): Promise<void> {
    const k = await gameObject.create();
    this.gameObjects.set(k, gameObject);

    if (player && gameObject instanceof Spaceship) {
      this.player = gameObject;
      this.player.isPlayer = true;
      this.cameraController.setTarget(gameObject);
    }
  }

  getPlayer(): GameObject {
    if (this.player) {
      return this.player;
    } else {
      throw Error('Scene wasnt set up correctly, cant find a player?');
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

  /**
   * Register a callback to receive state updates every frame
   * This is how the game engine pushes data to the UI store (Game → UI)
   */
  setStateUpdateCallback(callback: StateUpdateCallback): void {
    this.stateUpdateCallback = callback;
  }
}
