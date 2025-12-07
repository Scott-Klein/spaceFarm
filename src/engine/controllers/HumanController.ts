import { Vector3 } from '@babylonjs/core';
import { Controller } from '../Controller';
import type { ControlInput } from '../Controller';
import { InputManager } from '../InputManager';

export class HumanController extends Controller {
  private inputManager: InputManager;
  private thrustStrength: number;
  private rotationSensitivity: number;
  private mouseSensitivity: number;

  constructor(inputManager: InputManager, thrustStrength = 1.0) {
    super();
    this.inputManager = inputManager;
    this.thrustStrength = thrustStrength;
    this.rotationSensitivity = 1.0;
    this.mouseSensitivity = 0.002;
  }

  update(_deltaTime: number): ControlInput | null {
    if (!this.controlledObject) return null;

    let hasInput = false;
    const thrust = Vector3.Zero();
    const angularInput = Vector3.Zero();

    // Thrust controls (WASD + Space/Shift)
    if (this.inputManager.isCommandActive('forward')) {
      thrust.z += this.thrustStrength; // Forward thrust
      hasInput = true;
    }
    if (this.inputManager.isCommandActive('backward')) {
      thrust.z -= this.thrustStrength * 0.5; // Backward thrust (weaker)
      hasInput = true;
    }
    if (this.inputManager.isCommandActive('left')) {
      thrust.x -= this.thrustStrength * 0.7; // Strafe left
      hasInput = true;
    }
    if (this.inputManager.isCommandActive('right')) {
      thrust.x += this.thrustStrength * 0.7; // Strafe right
      hasInput = true;
    }
    if (this.inputManager.isCommandActive('up')) {
      thrust.y += this.thrustStrength * 0.7; // Thrust up
      hasInput = true;
    }
    if (this.inputManager.isCommandActive('down')) {
      thrust.y -= this.thrustStrength * 0.7; // Thrust down
      hasInput = true;
    }

    // Roll controls (Q/E)
    if (this.inputManager.isCommandActive('rollLeft')) {
      angularInput.z -= this.rotationSensitivity; // Roll left
      hasInput = true;
    }
    if (this.inputManager.isCommandActive('rollRight')) {
      angularInput.z += this.rotationSensitivity; // Roll right
      hasInput = true;
    }

    // Mouse look for pitch and yaw
    if (this.inputManager.isMouseLookEnabled()) {
      const mouseDelta = this.inputManager.getMouseDelta();
      if (mouseDelta.x !== 0 || mouseDelta.y !== 0) {
        // Yaw (left/right rotation)
        angularInput.y -= mouseDelta.x * this.mouseSensitivity;
        // Pitch (up/down rotation)
        angularInput.x -= mouseDelta.y * this.mouseSensitivity;
        hasInput = true;
      }
    }

    // Only return input if there's actual input
    if (hasInput) {
      return { movement: Vector3.Zero(), thrust, angularInput };
    }

    return null;
  }

  setThrustStrength(strength: number): void {
    this.thrustStrength = strength;
  }

  setRotationSensitivity(sensitivity: number): void {
    this.rotationSensitivity = sensitivity;
  }

  setMouseSensitivity(sensitivity: number): void {
    this.mouseSensitivity = sensitivity;
  }
}
