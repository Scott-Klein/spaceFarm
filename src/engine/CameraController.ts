import { ArcRotateCamera, Vector3, Scene } from '@babylonjs/core';
import { GameObject } from './GameObject';

export type CameraMode = 'free' | 'follow';

export class CameraController {
  private camera: ArcRotateCamera;
  private target: GameObject | null = null;
  private offset: Vector3;
  private mode: CameraMode = 'free';
  private canvas: HTMLCanvasElement;
  private scene: Scene;

  // Spring damping properties for smooth follow camera
  private springStiffness: number = 0.15; // How quickly camera catches up (0-1)
  private springDamping: number = 0.8; // Reduces oscillation (0-1)
  private velocity: Vector3 = Vector3.Zero();
  private desiredPosition: Vector3 = Vector3.Zero();

  constructor(scene: Scene, canvas: HTMLCanvasElement) {
    this.scene = scene;
    this.canvas = canvas;
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

  setMode(mode: CameraMode): void {
    this.mode = mode;

    if (mode === 'free') {
      // Free mode: camera orbits freely around ship
      // Unparent camera from ship mesh
      this.camera.parent = null;

      // Re-enable user control
      this.camera.inputs.addPointers();
      this.camera.inputs.addKeyboard();
      this.camera.inputs.addMouseWheel();
      this.camera.attachControl(this.canvas, true);

      // Reset spring velocity
      this.velocity = Vector3.Zero();
    } else if (mode === 'follow') {
      // Follow mode: spring-damped third-person camera
      if (this.target) {
        // Detach all input controls
        this.camera.detachControl();
        this.camera.inputs.clear();

        // UNPARENT camera - we'll manually update position with spring physics
        this.camera.parent = null;

        // Initialize spring system - start camera at current position
        this.velocity = Vector3.Zero();

        // Calculate initial desired position behind ship
        const shipMesh = this.target.getMesh();
        if (shipMesh) {
          const offset = new Vector3(0, 3, -10);
          const rotation = shipMesh.rotationQuaternion || shipMesh.rotation.toQuaternion();
          this.desiredPosition = this.target.position.add(offset.applyRotationQuaternion(rotation));

          // Snap camera to initial position (no spring on first frame)
          this.camera.position = this.desiredPosition.clone();
          this.camera.setTarget(this.target.position);
        }
      }
    }
  }

  getMode(): CameraMode {
    return this.mode;
  }

  update(): void {
    if (this.target) {
      if (this.mode === 'free') {
        // Free mode: camera target follows ship position in world space
        // User controls camera orbit
        this.camera.target = this.target.position;
      } else if (this.mode === 'follow') {
        // Follow mode: spring-damped third-person camera
        const shipMesh = this.target.getMesh();
        if (shipMesh) {
          // Calculate desired camera position in world space
          // Position behind and above the ship based on its rotation
          const offset = new Vector3(0, 3, -10);
          const rotatedOffset = offset.applyRotationQuaternion(
            shipMesh.rotationQuaternion || shipMesh.rotation.toQuaternion(),
          );
          this.desiredPosition = this.target.position.add(rotatedOffset);

          // Spring physics: smooth interpolation with velocity
          // Force = stiffness * (desired - current) - damping * velocity
          const displacement = this.desiredPosition.subtract(this.camera.position);
          const springForce = displacement.scale(this.springStiffness);
          const dampingForce = this.velocity.scale(-this.springDamping);

          // Update velocity and position
          this.velocity.addInPlace(springForce.add(dampingForce));
          this.camera.position.addInPlace(this.velocity);

          // Camera always looks at ship center
          this.camera.setTarget(this.target.position);
        }
      }
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
