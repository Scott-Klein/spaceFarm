import { Controller } from '../Controller';
import type { ControlInput } from '../Controller';
import type { FlightInput } from '../FlightSystem';
import { InputManager } from '../InputManager';

export class HumanController extends Controller {
  private inputManager: InputManager;
  private currentThrottle: number = 0;
  private throttleChangeRate: number = 0.00005; // Throttle changes per frame (at 60fps = 0.6 per second)

  constructor(inputManager: InputManager) {
    super();
    this.inputManager = inputManager;
  }

  update(deltaTime: number): ControlInput | null {
    if (!this.controlledObject) return null;

    const flightInput: FlightInput = {
      thrust: this.currentThrottle,
      pitch: 0,
      roll: 0,
      yaw: 0,
      brake: false,
    };

    // Normalize deltaTime (assuming 60fps baseline = 16.67ms)
    const dt = deltaTime / 16.67;

    // Throttle control - Shift/Ctrl increase/decrease thrust gradually
    if (this.inputManager.isCommandActive('forward')) {
      this.currentThrottle = Math.min(1, this.currentThrottle + this.throttleChangeRate * dt);
    }
    if (this.inputManager.isCommandActive('backward')) {
      this.currentThrottle = Math.max(0, this.currentThrottle - this.throttleChangeRate * dt);
    }

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

    flightInput.thrust = this.currentThrottle;

    // Always return flight input (even if thrust is just maintaining)
    return { flight: flightInput };
  }

  setThrottle(throttle: number): void {
    this.currentThrottle = Math.max(0, Math.min(1, throttle));
  }

  getThrottle(): number {
    return this.currentThrottle;
  }
}
