import { Mesh, Scene, Vector3 } from '@babylonjs/core';
import type { Controller } from './Controller';
import type { FlightInput } from './FlightSystem';

export abstract class GameObject {
  protected mesh: Mesh | null = null;
  public position: Vector3;
  public rotation: Vector3;
  public id: string;
  private controller: Controller | null = null;

  constructor(id: string) {
    this.id = id;
    this.position = Vector3.Zero();
    this.rotation = Vector3.Zero();
  }

  abstract create(scene: Scene): void;



  public get Mesh() : Mesh | null {
    return this.mesh;
  }

  update(deltaTime: number): void {
    // Get input from controller if possessed
    if (this.controller) {
      const input = this.controller.update(deltaTime);
      if (input) {
        this.handleControlInput(input);
      }
    }

    // Update mesh position/rotation
    if (this.mesh) {
      this.mesh.position = this.position;
      this.mesh.rotation = this.rotation;
    }
  }

  // Override this method in subclasses to handle control input differently
  protected handleControlInput(input: {
    movement?: Vector3;
    rotation?: Vector3;
    flight?: FlightInput;
    action?: string;
  }): void {
    if (input.movement) {
      this.position.addInPlace(input.movement);
    }
    if (input.rotation) {
      this.rotation.addInPlace(input.rotation);
    }
  }

  move(direction: Vector3, speed: number): void {
    this.position.addInPlace(direction.scale(speed));
  }

  // Controller possession system
  possess(controller: Controller): void {
    this.controller = controller;
    controller.possess(this);
  }

  unpossess(): void {
    if (this.controller) {
      this.controller.unpossess();
      this.controller = null;
    }
  }

  getController(): Controller | null {
    return this.controller;
  }

  isPossessed(): boolean {
    return this.controller !== null;
  }

  getMesh(): Mesh | null {
    return this.mesh;
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.dispose();
    }
  }
}
