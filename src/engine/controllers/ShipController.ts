import Controller, { type ControlInput } from '@/engine/Controller';
import type { FlightInput } from '@/engine/FlightSystem';
import type Spaceship from '@/engine/ships/Spaceship';
import { normalizeVec3, subtractVec3, type Vec3 } from '@babylonjs/lite';
import { invertQuat, rotateVec3ByQuat } from '@/utils/extensions';
import type { CommandType } from '@/types/game';

/** A multi-frame thing the ship is doing: Align, Approach, Follow, Patrol... */
export interface ShipAction {
  readonly name: CommandType;
  /**
   * Called every frame. Returns this frame's stick input and whether it's finished.
   * Leave a field undefined (e.g. thrust) to let the controller's own input fill it.
   */
  update(ship: Spaceship, controller: ShipController, dt: number): { flight: FlightInput; done: boolean };
}

/**
 * Shared base for anything flying a Spaceship. Owns the action slot and the frame loop;
 * subclasses only say what they want this frame via decide().
 */
export default abstract class ShipController extends Controller<Spaceship> {
  private action: ShipAction | null = null;

  // --- action slot: shared by human + AI ---

  setAction(action: ShipAction | null): void {
    this.action = action;
  }

  clearAction(): void {
    this.action = null;
  }

  getAction(): ShipAction | null {
    return this.action;
  }

  isBusy(): boolean {
    return this.action !== null;
  }

  // --- the frame loop: subclasses implement decide(), not this ---

  update(dt: number): ControlInput | null {
    const ship = this.controlledObject;
    if (!ship) return null;

    // subclass goes first: it may cancel or replace the action (sticks touched, AI changed its mind)
    const own = this.decide(dt) ?? {};

    const action = this.action;
    if (!action) return { flight: own };

    const result = action.update(ship, this, dt);
    if (result.done) {
      this.action = null;
      this.onActionDone(action);
    }

    // action steers; anything it leaves undefined falls back to the subclass's input
    return { flight: { ...own, ...stripUndefined(result.flight) } };
  }

  /** The subclass's own input this frame. Human = keyboard, AI = usually nothing. */
  protected abstract decide(dt: number): FlightInput | null;

  /** Called when an action finishes, so e.g. AI can pick the next one. */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onActionDone(action: ShipAction): void {}

  // --- steering helpers actions lean on ---

  /** World point -> normalized ship-local direction (x = right, y = up, z = forward). */
  directionInShipSpace(worldPoint: Vec3): Vec3 {
    const ship = this.controlledObject!;
    const toTarget = normalizeVec3(subtractVec3(worldPoint, ship.position));
    return rotateVec3ByQuat(invertQuat(ship.orientation), toTarget);
  }

  /** Angle in radians between the nose and a world point. */
  angleTo(worldPoint: Vec3): number {
    const local = this.directionInShipSpace(worldPoint);
    return Math.acos(Math.max(-1, Math.min(1, local.z)));
  }

  /** P-controller: local direction -> clamped pitch/yaw that turn the nose toward it. */
  steerToward(localDir: Vec3, gain = 2): Pick<FlightInput, 'pitch' | 'yaw'> {
    // same sign conventions as AIController.computeSteering
    const yaw = Math.atan2(localDir.x, localDir.z);
    const pitch = -Math.atan2(localDir.y, Math.hypot(localDir.x, localDir.z));
    return { yaw: clamp1(yaw * gain), pitch: clamp1(pitch * gain) };
  }
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

const stripUndefined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
