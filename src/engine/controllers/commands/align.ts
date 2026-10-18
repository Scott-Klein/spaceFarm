import type { FlightInput } from '@/engine/systems/FlightSystem';
import { clamp1, type CommandHandler } from './types';

// damping is in stick units per (radian per tick) of spin
const ALIGN_DAMPING = 30;
const ALIGN_TOLERANCE = 0.02 * (Math.PI / 180);
const ALIGN_SETTLED_SPIN = 0.0005;

/** Turn the nose onto the target. Leaves thrust and roll to the controller. */
const align: CommandHandler = (command, controller) => {
  const target = command.targetObject;

  const local = controller.directionInShipSpace(target.position);
  const { pitch, yaw } = controller.steerToward(local);

  // the ship carries angular momentum, so brake the turn rate or it sails past the target
  const spin = controller.getControlledObject()!.getFlightSystem().getAngularVelocity();
  const flight: FlightInput = {
    pitch: clamp1(pitch! - spin.x * ALIGN_DAMPING),
    yaw: clamp1(yaw! - spin.y * ALIGN_DAMPING),
  };

  const onTarget = controller.angleTo(target.position) < ALIGN_TOLERANCE;
  const settled = Math.hypot(spin.x, spin.y) < ALIGN_SETTLED_SPIN;
  return { flight, done: onTarget && settled };
};

export default align;
