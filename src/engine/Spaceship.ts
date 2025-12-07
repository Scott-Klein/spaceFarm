import {
  Scene,
  Mesh,
  Vector3,
  StandardMaterial,
  Color3,
  CreateBox,
} from '@babylonjs/core';
import { GameObject } from './GameObject';
import { FlightSystem } from './FlightSystem';

export class Spaceship extends GameObject {
  private color: Color3;
  private flightSystem: FlightSystem;

  constructor(id: string, color: Color3) {
    super(id);
    this.color = color;
    this.flightSystem = new FlightSystem(this.position);
  }

  create(scene: Scene): void {
    // Create a simple spaceship shape (can be replaced with a model later)
    const body = CreateBox(`${this.id}-body`, { width: 1, height: 0.5, depth: 2 });
    const cockpit = CreateBox(`${this.id}-cockpit`, { width: 0.8, height: 0.6, depth: 0.8 });
    cockpit.position.y = 0.5;
    cockpit.position.z = 0.3;

    const leftWing = CreateBox(`${this.id}-leftWing`, { width: 2, height: 0.1, depth: 1 });
    leftWing.position.x = -1.5;
    leftWing.position.z = -0.3;

    const rightWing = CreateBox(`${this.id}-rightWing`, { width: 2, height: 0.1, depth: 1 });
    rightWing.position.x = 1.5;
    rightWing.position.z = -0.3;

    // Merge all parts into one mesh
    this.mesh = Mesh.MergeMeshes(
      [body, cockpit, leftWing, rightWing],
      true,
      false,
      undefined,
      false,
      true,
    );

    if (this.mesh) {
      this.mesh.name = this.id;

      // Apply material
      const material = new StandardMaterial(`${this.id}-material`, scene);
      material.diffuseColor = this.color;
      material.specularColor = new Color3(0.2, 0.2, 0.2);
      this.mesh.material = material;

      // Set initial position
      this.mesh.position = this.position;
      this.mesh.rotation = this.rotation;
    }
  }

  protected handleControlInput(input: {
    movement: Vector3;
    rotation?: Vector3;
    thrust?: Vector3;
    angularInput?: Vector3;
  }): void {
    // Handle thrust input (relative to ship orientation)
    if (input.thrust && !input.thrust.equals(Vector3.Zero())) {
      // Apply thrust in local space directions for each axis
      const axes = [
        { direction: new Vector3(0, 0, input.thrust.z), component: input.thrust.z }, // Forward/back
        { direction: new Vector3(input.thrust.x, 0, 0), component: input.thrust.x }, // Strafe
        { direction: new Vector3(0, input.thrust.y, 0), component: input.thrust.y }, // Up/down
      ];

      for (const axis of axes) {
        if (axis.component !== 0) {
          this.flightSystem.applyThrust(axis.direction, Math.abs(axis.component));
        }
      }
    }

    // Handle rotation input (pitch, yaw, roll)
    if (input.angularInput && !input.angularInput.equals(Vector3.Zero())) {
      this.flightSystem.applyRotation(
        input.angularInput.x, // pitch
        input.angularInput.y, // yaw
        input.angularInput.z, // roll
      );
    }
  }

  update(deltaTime: number): void {
    // First handle controller input via parent
    super.update(deltaTime);

    // Update flight physics
    this.flightSystem.update(deltaTime);

    // Sync position and rotation from flight system
    this.position.copyFrom(this.flightSystem.position);
    this.rotation = this.flightSystem.getEulerAngles();

    // Update mesh if it exists
    if (this.mesh) {
      this.mesh.position.copyFrom(this.position);
      // Use quaternion for rotation to avoid gimbal lock
      this.mesh.rotationQuaternion = this.flightSystem.orientation.clone();
    }
  }

  getVelocity(): Vector3 {
    return this.flightSystem.getVelocity();
  }

  getFlightSystem(): FlightSystem {
    return this.flightSystem;
  }
}
