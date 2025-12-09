import { ArcRotateCamera, Vector3, Scene, FollowCamera, TransformNode } from '@babylonjs/core';
import { GameObject } from './GameObject';
import type { useGameStore } from '@/stores/gameState';

type GameStore = ReturnType<typeof useGameStore>;

export class CameraController {
  private camera: ArcRotateCamera;
  private followCamera?: FollowCamera;
  private cameraPivot?: TransformNode;
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

    if (this.cameraMode === 'follow' && this.target) {
      const targetMesh = this.target.getMesh();

      // Recreate pivot if mesh changed (e.g., model loaded)
      if (targetMesh && this.cameraPivot && this.cameraPivot.parent !== targetMesh) {
        console.log('Mesh changed, recreating camera pivot');
        this.setFollowMode();
      }

      if (this.cameraPivot && targetMesh) {
        // Follow mode: camera follows pivot (which is parented to ship)
        const targetPos = this.cameraPivot.getAbsolutePosition();
        const shipPos = this.target.position;

        // Lerp camera to pivot position
        this.camera.position = Vector3.Lerp(this.camera.position, targetPos, 0.1);
        this.camera.setTarget(shipPos);

        // Match ship's roll by updating camera's up vector
        this.camera.upVector = targetMesh.up.clone();
      }
    } else if (this.target && this.cameraMode === 'arcRotate') {
      // ArcRotate mode: smoothly follow the target
      this.camera.target = this.target.position;
      // Reset up vector to world up for arc rotate mode
      this.camera.upVector = Vector3.Up();
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
    console.log('Switching to follow mode');
    this.cameraMode = 'follow';

    const targetMesh = this.target?.getMesh();
    if (!targetMesh) {
      console.warn('No target mesh for follow mode');
      return;
    }

    // Recreate pivot each time to handle mesh replacement
    if (this.cameraPivot) {
      this.cameraPivot.dispose();
    }

    this.cameraPivot = new TransformNode('cameraPivot', this.scene);
    this.cameraPivot.parent = targetMesh;
    // In local space: negative Z is forward, so positive Z is behind
    // Y is up, X is right
    this.cameraPivot.position = new Vector3(0, 5, 25); // behind and above in local space

    // Keep using ArcRotateCamera but disable user controls
    this.scene.activeCamera = this.camera;
    this.camera.detachControl();

    console.log('Follow mode active with pivot');
  }

  setArcRotateMode(): void {
    console.log('Switching to arc rotate mode');
    this.cameraMode = 'arcRotate';

    // Make ArcRotateCamera the active camera and enable controls
    this.scene.activeCamera = this.camera;
    this.camera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
  }
}
