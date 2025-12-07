import { Scene } from '@babylonjs/core';

export type KeyCommand =
  | 'forward'
  | 'backward'
  | 'left'
  | 'right'
  | 'up'
  | 'down'
  | 'rollLeft'
  | 'rollRight';

export class InputManager {
  private keysPressed = new Set<string>();
  private keyBindings: Map<string, KeyCommand> = new Map();
  private commandCallbacks: Map<KeyCommand, () => void> = new Map();
  private mouseDelta = { x: 0, y: 0 };
  private lastMousePos = { x: 0, y: 0 };
  private isMouseLocked = false;
  private canvas: HTMLCanvasElement;

  constructor(scene: Scene) {
    // Default WASD + Space/Shift bindings
    this.keyBindings.set('w', 'forward');
    this.keyBindings.set('s', 'backward');
    this.keyBindings.set('a', 'left');
    this.keyBindings.set('d', 'right');
    this.keyBindings.set(' ', 'up');
    this.keyBindings.set('shift', 'down');
    this.keyBindings.set('q', 'rollLeft');
    this.keyBindings.set('e', 'rollRight');

    // Get canvas from scene
    this.canvas = scene.getEngine().getRenderingCanvas() as HTMLCanvasElement;

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

    // Mouse movement tracking
    scene.onPointerObservable.add((pointerInfo) => {
      if (this.isMouseLocked && pointerInfo.event.movementX !== undefined) {
        this.mouseDelta.x = pointerInfo.event.movementX;
        this.mouseDelta.y = pointerInfo.event.movementY;
      }
    });

    // Handle pointer lock
    this.setupPointerLock();
  }

  private setupPointerLock(): void {
    // Request pointer lock on canvas click
    this.canvas.addEventListener('click', () => {
      this.canvas.requestPointerLock();
    });

    // Track pointer lock state
    document.addEventListener('pointerlockchange', () => {
      this.isMouseLocked = document.pointerLockElement === this.canvas;
      if (!this.isMouseLocked) {
        this.mouseDelta.x = 0;
        this.mouseDelta.y = 0;
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

  getMouseDelta(): { x: number; y: number } {
    const delta = { ...this.mouseDelta };
    // Reset delta after reading
    this.mouseDelta.x = 0;
    this.mouseDelta.y = 0;
    return delta;
  }

  isMouseLookEnabled(): boolean {
    return this.isMouseLocked;
  }
}
