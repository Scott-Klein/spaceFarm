import { Scene } from '@babylonjs/core';

export type KeyCommand = 'forward' | 'backward' | 'left' | 'right' | 'up' | 'down';

export class InputManager {
  private keysPressed = new Set<string>();
  private keyBindings: Map<string, KeyCommand> = new Map();
  private commandCallbacks: Map<KeyCommand, () => void> = new Map();

  constructor(scene: Scene) {
    // Default WASD + Space/Shift bindings
    this.keyBindings.set('w', 'forward');
    this.keyBindings.set('s', 'backward');
    this.keyBindings.set('a', 'left');
    this.keyBindings.set('d', 'right');
    this.keyBindings.set(' ', 'up');
    this.keyBindings.set('shift', 'down');

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
