import type { FlightInput } from '@/engine/systems/FlightSystem';
import type ShipController from '@/engine/controllers/ShipController';
import type { ResolvedCommand } from '@/engine/controllers/ShipController';

/** This frame's stick input from a command, and whether it's finished. */
export type CommandResult = { flight: FlightInput; done: boolean };

/**
 * Runs one frame of a command. Leave a flight field undefined (e.g. thrust) to let the
 * controller's own input fill it. The ship is controller.getControlledObject().
 */
export type CommandHandler = (command: ResolvedCommand, controller: ShipController) => CommandResult;

export const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));
