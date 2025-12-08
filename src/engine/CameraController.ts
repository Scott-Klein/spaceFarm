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

    if (this.target && this.cameraMode === 'arcRotate') {
      // ArcRotate mode: smoothly follow the target
      this.camera.target = this.target.position;
    }
    // FollowCamera updates automatically via Babylon's scene graph
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
    console.log('Switching to follow mode');
    this.camera.detachControl();
    this.cameraMode = 'follow';

    // Create or reuse FollowCamera
    if (!this.followCamera) {
      this.followCamera = new FollowCamera(
        'FollowCamera',
        this.target ? this.target.position.add(this.offset) : new Vector3(0, 5, -10),
        this.scene,
      );
    }

    // Configure FollowCamera
    const targetMesh = this.target?.getMesh();
    console.log('Target mesh:', targetMesh);

    this.followCamera.heightOffset = 3;
    this.followCamera.radius = 50;
    this.followCamera.rotationOffset = 180;
    this.followCamera.cameraAcceleration = 0.05;
    this.followCamera.maxCameraSpeed = 0.5;

    if (targetMesh) {
      this.followCamera.lockedTarget = targetMesh;
    }

    // Make FollowCamera the active camera
    this.scene.activeCamera = this.followCamera;
    console.log('Active camera is now:', this.scene.activeCamera?.name);
  }

  setArcRotateMode(): void {
    console.log('Switching to arc rotate mode');
    this.cameraMode = 'arcRotate';

    // Make ArcRotateCamera the active camera
    this.scene.activeCamera = this.camera;
    this.camera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
  }
}
