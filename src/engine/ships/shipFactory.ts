import CapitalShip from "./CapitalShip";
import { SHIP_SPECS, type ShipSpec, type ShipType } from "./registry";
import Spaceship from "./Spaceship";

// ships/ShipFactory.ts
export function createShip(id: string, type: ShipType, overrides: Partial<ShipSpec> = {}): Spaceship {
  const spec = { ...SHIP_SPECS[type], ...overrides };
  return spec.mass > 2000 ? new CapitalShip(id, spec) : new Spaceship(id, spec);
}
