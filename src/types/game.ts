// Types shared by the engine and the UI. Kept out of the stores so engine code never imports pinia.
import type { DroneType } from '@/engine/objects/ships/registry';

export interface PlayerState {
  speed: number;
  maxSpeed: number;
  throttle: number;
  pitch: number;
  roll: number;
  yaw: number;
}


export type CommandType = 'Align';
export interface Command {
  target?: string;
  command:  CommandType // more commands here as needed when the ui ideas come through
}

export type CameraMode = 'free' | 'follow';
export interface Marker {
  x: number;
  y: number;
  label: string;
  distance: number;
  key: string
}

/** Snapshot of one of the player's drones, written by the engine every frame. */
export interface DroneState {
  key: string;
  type: DroneType;
  health: number;
  cargo: number;
}
