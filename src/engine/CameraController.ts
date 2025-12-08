import { ArcRotateCamera, Vector3, Scene, FollowCamera } from '@babylonjs/core';
import { GameObject } from './GameObject';
import type { useGameStore } from '@/stores/gameState';

type GameStore = ReturnType<typeof useGameStore>;

export class CameraController {
  private camera: ArcRotateCamera;
  private followCamera?: FollowCamera;
  private cameraMode: 'arcRotate' | 'follow' = 'arcRotate';
  private target: GameObject | null = null;
  private scene: Scene;
  private offset: Vector3;
  private gameStore: GameStore;

  constructor(scene: Scene, canvas: HTMLCanvasElement, gameStore: GameStore) {
    this.scene = scene;
    this.gameStore = gameStore;
    this.camera = new ArcRotateCamera(
      'GameCamera',
      Math.PI / 2,
      Math.PI / 4,
      15,
      Vector3.Zero(),
      scene,
    );
    this.camera.attachControl(canvas, true);
    this.offset = new Vector3(0, 5, -10);
  }

  setTarget(gameObject: GameObject | null): void {
    this.target = gameObject;
  }

  getTarget(): GameObject | null {
    return this.target;
  }

  update(): void {
    // Auto-detect mode changes from store
    const desiredMode = this.gameStore.cameraMode === 'free' ? 'arcRotate' : 'follow';
    if (desiredMode !== this.cameraMode) {
      if (desiredMode === 'arcRotate') {
        this.setArcRotateMode();
      } else {
        this.setFollowMode();
      }
    }

    if (this.target ) {
      // Smoothly follow the target
      this.camera.target = this.target.position;
    }
  }

  getCamera(): ArcRotateCamera {
    return this.camera;
  }

  setDistance(distance: number): void {
    this.camera.radius = distance;
  }

  setAngle(alpha: number, beta: number): void {
    this.camera.alpha = alpha;
    this.camera.beta = beta;
  }

  setFollowMode(): void {
    this.camera.detachControl();
    this.cameraMode = 'follow';
    this.followCamera = new FollowCamera(
      'FollowCamera',
      this.target ? this.target.position.add(this.offset) : new Vector3(0, 5, -10),
      this.scene,
    );
    this.followCamera.maxCameraSpeed = 0.1;
    this.followCamera.cameraAcceleration = 0.1;
    this.followCamera.lockedTarget = this.target ? this.target.Mesh : null;
  }

  setArcRotateMode(): void {
    this.cameraMode = 'arcRotate';
    this.camera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
  }
}
