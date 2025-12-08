import { Scene, Mesh, Vector3, StandardMaterial, Color3, CreateBox } from '@babylonjs/core';
import { GameObject } from './GameObject';
import { FlightSystem } from './FlightSystem';
import type { FlightInput } from './FlightSystem';

export class Spaceship extends GameObject {
  private color: Color3;
  private flightSystem: FlightSystem;

  constructor(id: string, color: Color3) {
    super(id);
    this.color = color;
    this.flightSystem = new FlightSystem({
      maxThrust: 0.014, // Lower thrust - build momentum slowly
      maxSpeed: 0.1, // Higher max speed
      pitchSpeed: 0.0007, // Slower pitch - takes time to rotate
      rollSpeed: 0.0007, // Slower roll - gradual barrel rolls
      yawSpeed: 0.001, // Slower yaw - heavy turning
      drag: 0.999, // Almost no drag! Pure inertia
      mass: 1.0, // Low mass
      rotationalInertia: 10.0, // Much higher - heavy, weighty rotations
      lateralDrag: 0.999, // Also almost no lateral drag - pure momentum
    });
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
    movement?: Vector3;
    rotation?: Vector3;
    flight?: FlightInput;
  }): void {
    // Handle flight system input if provided
    if (input.flight) {
      const flightUpdate = this.flightSystem.update(16.67, input.flight);
      this.position.addInPlace(flightUpdate.position);
      this.rotation = flightUpdate.rotation;
    }
    // Fallback to simple movement (for backwards compatibility)
    else if (input.movement && !input.movement.equals(Vector3.Zero())) {
      this.position.addInPlace(input.movement);
    }

    if (input.rotation) {
      this.rotation.addInPlace(input.rotation);
    }
  }

  update(deltaTime: number): void {
    // First handle controller input via parent
    super.update(deltaTime);
  }

  getFlightSystem(): FlightSystem {
    return this.flightSystem;
  }

  getVelocity(): Vector3 {
    return this.flightSystem.getVelocity();
  }

  getSpeed(): number {
    return this.flightSystem.getSpeed();
  }

  getThrustPercent(): number {
    return this.flightSystem.getThrustPercent();
  }

  getMaxSpeed(): number {
    return this.flightSystem.getMaxSpeed();
  }

  /**
   * Get orientation angles in degrees
   * @returns { pitch, roll, yaw } in degrees
   */
  getOrientationAngles(): { pitch: number; roll: number; yaw: number } {
    // Convert Babylon rotation vector (in radians) to degrees
    const toDegrees = (rad: number) => (rad * 180) / Math.PI;
    return {
      pitch: toDegrees(this.rotation.x),
      roll: toDegrees(this.rotation.z),
      yaw: toDegrees(this.rotation.y),
    };
  }
}
