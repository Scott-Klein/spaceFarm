import { Color3 } from "@babylonjs/core";

export interface ShipSpec {
  model: string;
  color: Color3;
  mass: number;
  maxThrust: number;
}


export const SHIP_SPECS = {
  'capital': { model: '/models/MilCap2.glb', color: new Color3(0.2, 0.6, 1), mass: 5000, maxThrust: 400 },
  'debug': { model: '/models/Int1.glb', color: new Color3(1, 0.2, 0.2), mass: 200, maxThrust: 900 },
} as const satisfies Record<string, ShipSpec>;

export type ShipType = keyof typeof SHIP_SPECS;
