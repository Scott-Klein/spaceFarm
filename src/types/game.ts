// Types shared by the engine and the UI. Kept out of the stores so engine code never imports pinia.

import type { GameObject } from "@/engine";

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
  targetObject?: GameObject;
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
