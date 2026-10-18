import type { FlightInput } from '@/engine/systems/FlightSystem';
import ShipController from './ShipController';

/**
 * AI pilot. Drives the ship the same way the player's UI does: by pushing commands.
 * decide() is the brain; ShipController's command loop does the flying.
 */
export default class AIShipController extends ShipController {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected decide(dt: number): FlightInput | null {
    // TODO: when !this.isBusy(), plan the next commands (approach rock, mine, return, dock)
    return { thrust: 0 };
  }
}
