import type { CommandType } from '@/types/game';
import type { CommandHandler } from './types';
import align from './align';

// Record over CommandType: adding a command to the union is a type error until it has a handler here
export const COMMAND_HANDLERS: Record<CommandType, CommandHandler> = {
  Align: align,
};

export type { CommandHandler, CommandResult } from './types';
