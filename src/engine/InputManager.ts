import { Scene } from '@babylonjs/core';

export type KeyCommand =
  | 'forward'
  | 'backward'
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'rollLeft'
  | 'rollRight'
  | 'pitchUp'
  | 'pitchDown'
  | 'yawLeft'
  | 'yawRight';

export class InputManager {
  private keysPressed = new Set<string>();
  private keyBindings: Map<string, KeyCommand> = new Map();
  private commandCallbacks: Map<KeyCommand, () => void> = new Map();

  constructor(scene: Scene) {
    // LEFT-HAND ONLY flight control scheme

    // Throttle control - Shift/Ctrl (pinky finger)
    this.keyBindings.set('shift', 'forward'); // Increase thrust
    this.keyBindings.set('control', 'backward'); // Decrease thrust

    // Pitch (nose up/down) - W/S (middle/ring finger)
    this.keyBindings.set('w', 'pitchUp'); // Pitch up
    this.keyBindings.set('w', 'up'); // Alternative
    this.keyBindings.set('s', 'pitchDown'); // Pitch down
    this.keyBindings.set('s', 'down'); // Alternative

    // Yaw (turn left/right) - A/D (ring/index finger)
    this.keyBindings.set('a', 'yawLeft'); // Yaw left
    this.keyBindings.set('a', 'left'); // Alternative
    this.keyBindings.set('d', 'yawRight'); // Yaw right
    this.keyBindings.set('d', 'right'); // Alternative

    // Roll (barrel roll) - Q/E (pinky/index finger)
    this.keyBindings.set('q', 'rollRight'); // Roll right
    this.keyBindings.set('e', 'rollLeft'); // Roll left

    // Listen for keyboard events
    scene.onKeyboardObservable.add((kbInfo) => {
      const key = kbInfo.event.key.toLowerCase();

      if (kbInfo.type === 1) {
        // KEYDOWN
        this.keysPressed.add(key);
      } else if (kbInfo.type === 2) {
        // KEYUP
        this.keysPressed.delete(key);
      }
    });
  }

  isCommandActive(command: KeyCommand): boolean {
    for (const [key, cmd] of this.keyBindings.entries()) {
      if (cmd === command && this.keysPressed.has(key)) {
        return true;
      }
    }
    return false;
  }

  bindKey(key: string, command: KeyCommand): void {
    this.keyBindings.set(key.toLowerCase(), command);
  }

  onCommand(command: KeyCommand, callback: () => void): void {
    this.commandCallbacks.set(command, callback);
  }

  update(): void {
    // Execute callbacks for active commands
    for (const [command, callback] of this.commandCallbacks.entries()) {
      if (this.isCommandActive(command)) {
        callback();
      }
    }
  }
}
