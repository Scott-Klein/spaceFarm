import type { Vec3Tuple } from "@babylonjs/lite";

export interface ShipSpec {
  model: string;
  color: Vec3Tuple;
  mass: number;
  maxThrust: number;
}


export const SHIP_SPECS = {
  'capital': { model: '/models/MilCap2.glb', color:[0.2, 0.6, 1], mass: 5000, maxThrust: 400 },
  'debug': { model: '/models/Int1.glb', color: [1, 0.2, 0.2], mass: 200, maxThrust: 900 },
} as const satisfies Record<string, ShipSpec>;

export type ShipType = keyof typeof SHIP_SPECS;
