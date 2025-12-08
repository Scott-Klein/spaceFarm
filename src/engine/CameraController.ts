import { ArcRotateCamera, Vector3, Scene, FollowCamera } from '@babylonjs/core';
import { GameObject } from './GameObject';

export class CameraController {
  private camera: ArcRotateCamera;
  private followCamera?: FollowCamera;
  private cameraMode: 'arcRotate' | 'follow' = 'arcRotate';
  private target: GameObject | null = null;
  private scene: Scene;
  private offset: Vector3;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
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
    if (this.target && this.cameraMode === 'arcRotate') {
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
    this.followCamera.maxCameraSpeed = 0.05;
    this.followCamera.cameraAcceleration = 0.001;
    this.followCamera.lockedTarget = this.target ? this.target.Mesh : null;
  }

  setArcRotateMode(): void {
    this.cameraMode = 'arcRotate';
    this.camera.attachControl(this.scene.getEngine().getRenderingCanvas(), true);
  }
}
