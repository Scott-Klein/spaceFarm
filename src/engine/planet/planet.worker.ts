import { bakeBand } from './gen/bake';
import { routeWater, sampleHydroBand, type Hydrology } from './gen/hydrology';
import { createWorld, type World } from './gen/world';

export interface WorldRef {
  seed: number;
  ocean: boolean;
}

export type WorkerRequest =
  | { type: 'hydroBand'; world: WorldRef; M: number; face: number; j0: number; j1: number }
  | { type: 'route'; world: WorldRef; M: number; N: number; elev: Float32Array; rain: Float32Array }
  | { type: 'hydro'; hydro: Hydrology }
  | { type: 'bake'; world: WorldRef; size: number; face: number; j0: number; j1: number };

export type WorkerResponse =
  | { type: 'hydroBand'; face: number; j0: number; elev: Float32Array; rain: Float32Array }
  | { type: 'route'; hydro: Hydrology }
  | { type: 'hydro' }
  | { type: 'bake'; face: number; j0: number; albedo: Uint8Array; relief: Uint8Array; clouds: Uint8Array };

let world: World | undefined;
let hydro: Hydrology | undefined;

const worldFor = (ref: WorldRef) => {
  if (!world || world.seed !== ref.seed || world.ocean !== ref.ocean) world = createWorld(ref.seed, { ocean: ref.ocean });
  return world;
};

const reply = (msg: WorkerResponse, transfer: Transferable[] = []) => self.postMessage(msg, { transfer });

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const m = e.data;
  switch (m.type) {
    case 'hydroBand': {
      const { elev, rain } = sampleHydroBand(worldFor(m.world), m.M, m.face, m.j0, m.j1);
      reply({ type: 'hydroBand', face: m.face, j0: m.j0, elev, rain }, [elev.buffer, rain.buffer]);
      break;
    }
    case 'route': {
      const h = routeWater(worldFor(m.world), m.M, m.N, m.elev, m.rain);
      reply({ type: 'route', hydro: h });
      break;
    }
    case 'hydro':
      hydro = m.hydro;
      reply({ type: 'hydro' });
      break;
    case 'bake': {
      const maps = bakeBand(worldFor(m.world), m.size, m.face, m.j0, m.j1, hydro);
      reply({ type: 'bake', face: m.face, j0: m.j0, ...maps }, [maps.albedo.buffer, maps.relief.buffer, maps.clouds.buffer]);
      break;
    }
  }
};
