import {
  Scene,
  Mesh,
  Vector3,
  StandardMaterial,
  Color3,
  CreateBox,
} from '@babylonjs/core';
import { GameObject } from './GameObject';

export class Spaceship extends GameObject {
  private color: Color3;
  private velocity: Vector3 = Vector3.Zero();
  private acceleration: number = 1.0;
  private maxSpeed: number = 0.1;
  private friction: number = 0.98;

  constructor(id: string, color: Color3) {
    super(id);
    this.color = color;
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

  protected handleControlInput(input: { movement: Vector3; rotation?: Vector3 }): void {
    // Use the input movement as acceleration
    if (input.movement && !input.movement.equals(Vector3.Zero())) {
      this.accelerate(input.movement);
    }

    if (input.rotation) {
      this.rotation.addInPlace(input.rotation);
    }
  }

  update(deltaTime: number): void {
    // First handle controller input via parent
    super.update(deltaTime);

    // Apply friction to velocity
    this.velocity.scaleInPlace(this.friction);

    // Update position based on velocity
    this.position.addInPlace(this.velocity);
  }

  private accelerate(direction: Vector3): void {
    // Add acceleration in the given direction
    const accel = direction.scale(this.acceleration);
    this.velocity.addInPlace(accel);

    // Clamp to max speed
    const speed = this.velocity.length();
    if (speed > this.maxSpeed) {
      this.velocity.normalize().scaleInPlace(this.maxSpeed);
    }
  }

  getVelocity(): Vector3 {
    return this.velocity;
  }
}
