import { ArcRotateCamera, Vector3, Scene } from '@babylonjs/core';
import { GameObject } from './GameObject';

export class CameraController {
  private camera: ArcRotateCamera;
  private target: GameObject | null = null;
  private offset: Vector3;

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
    this.offset = new Vector3(0, 5, -10);
  }

  setTarget(gameObject: GameObject | null): void {
    this.target = gameObject;
  }

  getTarget(): GameObject | null {
    return this.target;
  }

  update(): void {
    if (this.target) {
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
}
