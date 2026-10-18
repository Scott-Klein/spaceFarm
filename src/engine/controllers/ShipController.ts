import Controller, { type ControlInput } from './Controller';
import type { FlightInput } from '@/engine/systems/FlightSystem';
import type Spaceship from '@/engine/objects/ships/Spaceship';
import { normalizeVec3, subtractVec3, type Vec3 } from '@babylonjs/lite';
import { invertQuat, rotateVec3ByQuat } from '@/utils/extensions';
import type { Command } from '@/types/game';
import type GameObject from '@/engine/core/GameObject';

/** A UI command after the engine has looked its target key up in the object map. */
export type ResolvedCommand = Command & { targetObject: GameObject };

/** A multi-frame thing the ship is doing: Align, Approach, Follow, Patrol... */
export interface ShipAction {
  readonly command: Command;
  /**
   * Called every frame. Returns this frame's stick input and whether it's finished.
   * Leave a field undefined (e.g. thrust) to let the controller's own input fill it.
   */
  update(
    ship: Spaceship,
    controller: ShipController,
    dt: number,
  ): { flight: FlightInput; done: boolean };
}

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

    let result: CommandResult;
    switch (current.command) {
      case 'Align':
        result = this.align(current);
        break;
    }

    if (result.done) this.commands.shift();

    // command steers; anything it leaves undefined falls back to the subclass's input
    return { flight: { ...own, ...stripUndefined(result.flight) } };
  }

  /** Turn the nose onto the target. Leaves thrust and roll to the subclass. */
  protected align(command: ResolvedCommand): CommandResult {
    const target = command.targetObject;

    const local = this.directionInShipSpace(target.position);
    const { pitch, yaw } = this.steerToward(local);

    // the ship carries angular momentum, so brake the turn rate or it sails past the target
    const spin = this.controlledObject!.getFlightSystem().getAngularVelocity();
    const flight: FlightInput = {
      pitch: clamp1(pitch! - spin.x * ALIGN_DAMPING),
      yaw: clamp1(yaw! - spin.y * ALIGN_DAMPING),
    };

    const onTarget = this.angleTo(target.position) < ALIGN_TOLERANCE;
    const settled = Math.hypot(spin.x, spin.y) < ALIGN_SETTLED_SPIN;
    return { flight, done: onTarget && settled };
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

type CommandResult = { flight: FlightInput; done: boolean };

// align tuning: damping is in stick units per (radian per tick) of spin
const ALIGN_DAMPING = 30;
const ALIGN_TOLERANCE = 0.02 * (Math.PI / 180);
const ALIGN_SETTLED_SPIN = 0.0005;

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

const stripUndefined = <T extends object>(o: T): Partial<T> =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
