import { addVec3InPlace, type Quat, type Vec3 } from '@babylonjs/lite';
import type Controller from './Controller';
import type { ControlInput } from './Controller';
import { multiplyQuatInPlace, normalizeQuat, quatFromEuler } from '@/utils/extensions';

export default abstract class GameObject {
  public position: Vec3;
  public orientation: Quat;   // was rotation: Vector3
  protected disposed = false;
  private controller: Controller | null = null;
  private lastInput: ControlInput | null = null;

  constructor() {
    this.position = { x: 0, y: 0, z: 0};
    this.orientation = { x: 0, y: 0, z: 0, w: 1 }; // identity quaternion, no transforms yet
  }

  abstract create(): void;

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
    if (input.movement) addVec3InPlace(this.position, input.movement); //TODO: input.movement isn't a vec3 find out what it is. this method might not be right
    if (input.rotation) {
      this.orientation = normalizeQuat(multiplyQuatInPlace(this.orientation, quatFromEuler(input.rotation)))
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
