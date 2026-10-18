
import type GameObject from '@/engine/core/GameObject';
import type { FlightInput } from '@/engine/systems/FlightSystem';
import type { Vec3 } from '@babylonjs/lite';

export interface ControlInput {
  movement?: Vec3;
  rotation?: Vec3;
  flight?: FlightInput;
  action?: string;
}

export default abstract class Controller<T extends GameObject = GameObject> {
  protected controlledObject: T | null = null;

  possess(gameObject: T): void {
    this.controlledObject = gameObject;
  }

  unpossess(): void {
    this.controlledObject = null;
  }

  getControlledObject(): T | null {
    return this.controlledObject;
  }

  abstract update(deltaTime: number): ControlInput | null;
}
