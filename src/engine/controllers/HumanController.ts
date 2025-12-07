import { Vector3 } from '@babylonjs/core';
import { Controller } from '../Controller';
import type { ControlInput } from '../Controller';
import { InputManager } from '../InputManager';

export class HumanController extends Controller {
  private inputManager: InputManager;
  private moveSpeed: number;

  constructor(inputManager: InputManager, moveSpeed = 0.05) {
    super();
    this.inputManager = inputManager;
    this.moveSpeed = moveSpeed;
  }

  update(_deltaTime: number): ControlInput | null {
    if (!this.controlledObject) return null;

    const movement = Vector3.Zero();

    if (this.inputManager.isCommandActive('forward')) {
      movement.z += this.moveSpeed;
    }
    if (this.inputManager.isCommandActive('backward')) {
      movement.z -= this.moveSpeed;
    }
    if (this.inputManager.isCommandActive('left')) {
      movement.x -= this.moveSpeed;
    }
    if (this.inputManager.isCommandActive('right')) {
      movement.x += this.moveSpeed;
    }
    if (this.inputManager.isCommandActive('up')) {
      movement.y += this.moveSpeed;
    }
    if (this.inputManager.isCommandActive('down')) {
      movement.y -= this.moveSpeed;
    }

    // Only return input if there's actual movement
    if (!movement.equals(Vector3.Zero())) {
      return { movement };
    }

    return null;
  }

  setMoveSpeed(speed: number): void {
    this.moveSpeed = speed;
  }
}
