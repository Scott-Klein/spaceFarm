import { Quaternion, Scene, Vector3 } from '@babylonjs/core';
import type Controller from './Controller';
import type { ControlInput } from './Controller';

export default abstract class GameObject {
  public position: Vector3;
  public orientation: Quaternion;   // was rotation: Vector3
  public id: string;
  protected disposed = false;
  private controller: Controller | null = null;
  private lastInput: ControlInput | null = null;

  constructor(id: string) {
    this.id = id;
    this.position = Vector3.Zero();
    this.orientation = Quaternion.Identity();
  }

  abstract create(scene: Scene): void;

  updateRender(deltaTime: number): void {
    if (this.controller) {
      this.lastInput = this.controller.update(deltaTime);
    }
  }

  updatePhysics(): void {
    // Get input from controller if possessed
    if (this.controller) {
      if (this.lastInput) {
        this.handleControlInput(this.lastInput);
      }
    }
  }

  // Override this method in subclasses to handle control input differently
  protected handleControlInput(input: ControlInput): void {
    if (input.movement) this.position.addInPlace(input.movement);
    if (input.rotation) {
      // body-local delta, applied on the right
      this.orientation.multiplyInPlace(
        Quaternion.FromEulerVector(input.rotation)
      );
      this.orientation.normalize();   // fight float drift
    }
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

  // very strong suggestion: I'll make this abstract some day, maybe??? Maybe not. But maybe!
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    // nothing to do here yet, but if game objects need to hold resources
    // they'll get disposed of here, sub classes should implement dispose and call super.dispose()
  }
}
