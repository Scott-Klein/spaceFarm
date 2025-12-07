import { ArcRotateCamera, Vector3, Scene } from '@babylonjs/core';
import { GameObject } from './GameObject';

export class CameraController {
  private camera: ArcRotateCamera;
  private target: GameObject | null = null;
  private offset: Vector3;
  private smoothing: number = 0.1;

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.camera = new ArcRotateCamera(
      'GameCamera',
      Math.PI / 2,
      Math.PI / 4,
      15,
      Vector3.Zero(),
      scene,
    );
    this.camera.attachControl(canvas, true);
    // Allow more camera freedom
    this.camera.lowerRadiusLimit = 5;
    this.camera.upperRadiusLimit = 50;
    this.offset = new Vector3(0, 5, -10);
  }

  setTarget(gameObject: GameObject | null): void {
    this.target = gameObject;
    if (gameObject) {
      // Immediately set target position
      this.camera.target = gameObject.position.clone();
    }
  }

  getTarget(): GameObject | null {
    return this.target;
  }

  update(): void {
    if (this.target) {
      // Smoothly follow the target position
      const targetPos = this.target.position;
      this.camera.target = Vector3.Lerp(this.camera.target, targetPos, this.smoothing);
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
}
