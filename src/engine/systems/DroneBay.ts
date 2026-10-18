import Drone from '@/engine/objects/ships/Drone';
import type { DroneType } from '@/engine/objects/ships/registry';
import type Spaceship from '@/engine/objects/ships/Spaceship';
import type GameEngine from '@/engine/core/GameEngine';
import AIShipController from '@/engine/controllers/AIShipController';

/** Hangar for a ship's drones: owns the list, launches and recalls them. */
export default class DroneBay {
  // keyed by the engine's object key, so the UI can point at one
  private drones = new Map<string, Drone>();
  private owner: Spaceship;
  private capacity: number;

  constructor(owner: Spaceship, capacity: number) {
    this.owner = owner;
    this.capacity = capacity;
  }

  /** Spawn a drone at the owner and hand it to an AI. Null if the bay is full. */
  async launch(engine: GameEngine, type: DroneType): Promise<Drone | null> {
    if (this.drones.size >= this.capacity) return null;

    const drone = new Drone(type, this.owner);
    // TODO: launch from a bay node on the owner's model rather than its centre
    drone.position = { ...this.owner.position };
    drone.orientation = { ...this.owner.orientation };

    drone.possess(new AIShipController());
    const key = await engine.addGameObject(drone);
    this.drones.set(key, drone);
    return drone;
  }

  /** TODO: fly back and dock. Needs a GameEngine.removeGameObject to despawn on arrival. */
  recall(drone: Drone): void {
    void drone;
  }

  getDrones(): ReadonlyMap<string, Drone> {
    return this.drones;
  }

  getCapacity(): number {
    return this.capacity;
  }
}
