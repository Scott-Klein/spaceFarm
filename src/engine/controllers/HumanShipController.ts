import type { FlightInput } from '@/engine/systems/FlightSystem';
import type InputManager from '@/engine/core/InputManager';
import ShipController from './ShipController';

export default class HumanShipController extends ShipController {
  private inputManager: InputManager;

  private currentThrottle: number = 0;
  private throttleChangeRate: number = 0.0005;

  constructor(inputManager: InputManager) {
    super();
    this.inputManager = inputManager;
  }

  protected decide(dt: number): FlightInput | null {
    // Throttle control - Shift/Ctrl increase/decrease thrust gradually
    if (this.inputManager.isCommandActive('forward')) {
      this.currentThrottle = Math.min(1, this.currentThrottle + this.throttleChangeRate * dt);
    }
    if (this.inputManager.isCommandActive('backward')) {
      this.currentThrottle = Math.max(0, this.currentThrottle - this.throttleChangeRate * dt);
    }

    const flightInput: FlightInput = {
      thrust: this.currentThrottle,
      pitch: 0,
      roll: 0,
      yaw: 0,
      brake: false,
    };

    // Pitch control (nose up/down) - Arrow Up/Down
    if (this.inputManager.isCommandActive('pitchUp') || this.inputManager.isCommandActive('up')) {
      flightInput.pitch = 1; // Nose up
    }
    if (
      this.inputManager.isCommandActive('pitchDown') ||
      this.inputManager.isCommandActive('down')
    ) {
      flightInput.pitch = -1; // Nose down
    }

    // Yaw control (turn left/right) - A/D
    if (this.inputManager.isCommandActive('yawLeft') || this.inputManager.isCommandActive('left')) {
      flightInput.yaw = -1; // Turn left
    }
    if (
      this.inputManager.isCommandActive('yawRight') ||
      this.inputManager.isCommandActive('right')
    ) {
      flightInput.yaw = 1; // Turn right
    }

    // Roll control (barrel roll) - Q/E
    if (this.inputManager.isCommandActive('rollLeft')) {
      flightInput.roll = -1; // Roll left
    }
    if (this.inputManager.isCommandActive('rollRight')) {
      flightInput.roll = 1; // Roll right
    }

    return flightInput;
  }
}
