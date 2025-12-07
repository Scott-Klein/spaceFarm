import { Vector3 } from '@babylonjs/core';
import { GameObject } from './GameObject';

export interface ControlInput {
  movement: Vector3;
  rotation?: Vector3;
  action?: string;
}

export abstract class Controller {
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
