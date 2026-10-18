import Spaceship from '@/engine/objects/ships/Spaceship';
import { DRONE_SPECS, type DroneType } from '@/engine/objects/ships/registry';
import { createBox, type Mesh } from '@babylonjs/lite';

/** A small ship launched from, and owned by, another ship's DroneBay. */
export default class Drone extends Spaceship {
  readonly droneType: DroneType;
  health: number;
  cargo = 0;
  private mothership: Spaceship;

  constructor(type: DroneType, mothership: Spaceship) {
    const spec = DRONE_SPECS[type];
    super(spec.model, spec.color);
    this.droneType = type;
    this.health = spec.maxHealth;
    this.mothership = mothership;
  }

  getLabel() {
    return 'Drone';
  }

  getMothership(): Spaceship {
    return this.mothership;
  }

  // used when the spec has no model
  protected createMeshes(): Mesh[] {
    return [createBox($engine, { width: 0.3, height: 0.2, depth: 0.4 })];
  }
}
