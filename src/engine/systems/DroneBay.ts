import Drone from '@/engine/objects/ships/Drone';
import type Spaceship from '@/engine/objects/ships/Spaceship';
import AIShipController from '../controllers/AIShipController';

/** Hangar for a ship's drones: owns the list, launches and recalls them. */
export default class DroneBay {
  // keyed by the engine's object key, so the UI can point at one
  private drones = new Map<string, Drone>();
  private launched = new Map<string, Drone>();

  private owner: Spaceship;
  private capacity: number;

  constructor(owner: Spaceship, capacity: number) {
    this.owner = owner;
    this.capacity = capacity;

    for (let i = 0; i < capacity; i++) {
      // lets make a drone
      const id = crypto.randomUUID();
      const d = new Drone('mining', this.owner, id);
      this.drones.set(id, d);
    }
  }

  /** Spawn a drone at the owner and hand it to an AI. Null if the bay is full. */
  async launch(id: string): Promise<Drone | null> {
    const d = this.drones.get(id);
    if (d === undefined) return null;
    // TODO: launch from a bay node on the owner's model rather than its centre
    d.position = { ...this.owner.position };
    d.orientation = { ...this.owner.orientation };
  
    d.possess(new AIShipController());
    await $game.addGameObject(d, id);
    this.launched.set(id, d);
    const deleted = this.drones.delete(id);
    if (!deleted) {
      throw new Error('Consistency error with the drone bay, attempted to remove a drone during launch that does not exist');
    }
    return d;
  }

  /** TODO: fly back and dock. Needs a GameEngine.removeGameObject to despawn on arrival. */
  recall(drone: Drone): void {
    void drone;
  }

  /** Every drone this ship owns, docked first, then launched. */
  getDrones(): ReadonlyMap<string, Drone> {
    const m = new Map([...this.drones, ...this.launched])
    return m;
  }

  getCapacity(): number {
    return this.capacity;
  }
}
