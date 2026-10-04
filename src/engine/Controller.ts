
import type GameObject from './GameObject';
import type { FlightInput } from './FlightSystem';
import type { Vec3 } from '@babylonjs/lite';

export interface ControlInput {
  movement?: Vec3;
  rotation?: Vec3;
  flight?: FlightInput;
  action?: string;
}

export default abstract class Controller {
  protected controlledObject: GameObject | null = null;

  possess(gameObject: GameObject): void {
    this.controlledObject = gameObject;
  }

  unpossess(): void {
    this.controlledObject = null;
  }

  getControlledObject(): GameObject | null {
    return this.controlledObject;
  }

  abstract update(deltaTime: number): ControlInput | null;
}
