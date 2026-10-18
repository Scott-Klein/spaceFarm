import Controller, { type ControlInput } from './Controller';
import type { FlightInput } from '@/engine/systems/FlightSystem';
import type Spaceship from '@/engine/objects/ships/Spaceship';
import { normalizeVec3, subtractVec3, type Vec3 } from '@babylonjs/lite';
import { invertQuat, rotateVec3ByQuat } from '@/utils/extensions';
import type { Command } from '@/types/game';
import type GameObject from '@/engine/core/GameObject';
import { COMMAND_HANDLERS } from './commands';
import { clamp1 } from './commands/types';

/** A UI command after the engine has looked its target key up in the object map. */
export type ResolvedCommand = Command & { targetObject: GameObject };

/**
 * Shared base for anything flying a Spaceship. Owns the action slot and the frame loop;
 * subclasses only say what they want this frame via decide().
 */
export default abstract class ShipController extends Controller<Spaceship> {
  private commands: ResolvedCommand[] = [];

  // --- action slot: shared by human + AI ---

  pushCommands(commands: ResolvedCommand[]) {
    this.commands = this.commands.concat(commands); // at the moment overwrites commands.
  }

  clearCommands(): void {
    this.commands = [];
  }

  getAction(): ResolvedCommand[] {
    return this.commands;
  }

  isBusy(): boolean {
    return !!this.commands.length;
  }

  // --- the frame loop: subclasses implement decide(), not this ---

  update(dt: number): ControlInput | null {
    const ship = this.controlledObject;
    if (!ship) return null;

    // subclass goes first: it may cancel or replace commands (sticks touched, AI changed its mind)
    const own = this.decide(dt) ?? {};

    // commands run one at a time, oldest first; two at once would fight over the sticks
    const current = this.commands[0];
    if (!current) return { flight: own };

    const result = COMMAND_HANDLERS[current.command](current, this);

    if (result.done) {
      this.commands.shift();
      this.onCommandDone(current);
    }

    // command steers; anything it leaves undefined falls back to the subclass's input
    return { flight: { ...own, ...stripUndefined(result.flight) } };
  }

  /** The subclass's own input this frame. Human = keyboard, AI = usually nothing. */
  protected abstract decide(dt: number): FlightInput | null;

  /**
   * Called after a command finishes and leaves the queue, so e.g. AI can push the next one.
   * Not called for commands removed by clearCommands().
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected onCommandDone(command: ResolvedCommand): void {}

  // --- steering helpers commands lean on ---

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

const stripUndefined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
