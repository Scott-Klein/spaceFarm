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
  | 'yawRight'
  | 'toggleCamera';

export default class InputManager {
  private keysPressed = new Set<string>();
  private keyBindings: Map<string, KeyCommand> = new Map();
  private commandCallbacks: Map<KeyCommand, () => void> = new Map();
  private keyJustPressed = new Set<string>();
  private lastPressedKeys = new Set<string>();

  constructor() {
    // LEFT-HAND ONLY flight control scheme

    // Throttle control - z/x
    this.keyBindings.set('x', 'forward'); // Increase thrust
    this.keyBindings.set('z', 'backward'); // Decrease thrust

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

    // Camera toggle - C
    this.keyBindings.set('c', 'toggleCamera');

    
    // attach listeners, disposed of in dispose!
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp)
  }

  isCommandActive(command: KeyCommand): boolean {
    for (const [key, cmd] of this.keyBindings.entries()) {
      if (cmd === command && this.keysPressed.has(key)) {
        return true;
      }
    }
    return false;
  }

  wasCommandJustPressed(command: KeyCommand): boolean {
    for (const [key, cmd] of this.keyBindings.entries()) {
      if (cmd === command && this.keyJustPressed.has(key)) {
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

  /**
   * Call every frame, not physics tick
   */
  update(): void {
    // Execute callbacks for active commands (held keys)
    for (const [command, callback] of this.commandCallbacks.entries()) {
      if (this.isCommandActive(command)) {
        callback();
      }
    }

    // Update key press tracking
    this.lastPressedKeys = new Set(this.keysPressed);
    this.keyJustPressed.clear();
  }

  handleKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    this.keysPressed.add(key);

    if (!this.lastPressedKeys.has(key)) {
      this.keyJustPressed.add(key);
    }
  };

  handleKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    this.keysPressed.delete(key);
    this.lastPressedKeys.delete(key);
  };

  dispose(): void {
    window.removeEventListener('keydown', this.handleKeyUp);
    window.removeEventListener('keyup', this.handleKeyUp)
  }
}
