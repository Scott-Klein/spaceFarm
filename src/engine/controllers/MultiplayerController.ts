import { Vector3 } from '@babylonjs/core';
import { Controller } from '../Controller';
import type { ControlInput } from '../Controller';

export interface NetworkInput {
  movement: Vector3;
  rotation?: Vector3;
  timestamp: number;
}

export class MultiplayerController extends Controller {
  private inputBuffer: NetworkInput[] = [];
  private interpolationDelay = 100; // ms
  private lastInput: NetworkInput | null = null;

  update(_deltaTime: number): ControlInput | null {
    if (!this.controlledObject) return null;

    // Process buffered inputs (simulating network delay)
    const now = performance.now();
    const targetTime = now - this.interpolationDelay;

    // Find the appropriate input to use
    while (
      this.inputBuffer.length > 0 &&
      this.inputBuffer[0] &&
      this.inputBuffer[0].timestamp < targetTime
    ) {
      this.lastInput = this.inputBuffer.shift()!;
    }

    if (this.lastInput) {
      return {
        movement: this.lastInput.movement,
        rotation: this.lastInput.rotation,
      };
    }

    return null;
  }

  // Called when receiving input from the network
  receiveInput(input: NetworkInput): void {
    this.inputBuffer.push(input);
    // Keep buffer size reasonable
    if (this.inputBuffer.length > 10) {
      this.inputBuffer.shift();
    }
  }

  // Simulate sending input to network
  sendInput(movement: Vector3, rotation?: Vector3): void {
    // In a real implementation, this would send to a server
    console.log('Sending input to network:', { movement, rotation });
  }

  setInterpolationDelay(delay: number): void {
    this.interpolationDelay = delay;
  }
}
