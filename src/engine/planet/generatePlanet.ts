import { HYDRO_SIZE, type Hydrology } from './gen/hydrology';
import type { WorkerRequest, WorkerResponse, WorldRef } from './planet.worker';

export interface PlanetMaps {
  seed: number;
  /** cube face edge length in texels */
  size: number;
  /** 6 faces, layer-major RGBA8 (see gen/bake.ts for the channel layout) */
  albedo: Uint8Array;
  relief: Uint8Array;
  clouds: Uint8Array;
}

/** A fixed set of workers fed from task queues; every phase reuses the same warm workers. */
class Pool {
  private readonly workers: Worker[] = [];

  constructor(size: number) {
    for (let i = 0; i < size; i++) {
      this.workers.push(new Worker(new URL('./planet.worker.ts', import.meta.url), { type: 'module' }));
    }
  }

  /** Sends one message to one worker and resolves with its reply. */
  call(index: number, msg: WorkerRequest, transfer: Transferable[] = []) {
    const worker = this.workers[index]!;
    return new Promise<WorkerResponse>((resolve, reject) => {
      worker.onmessage = (e: MessageEvent<WorkerResponse>) => resolve(e.data);
      worker.onerror = (e) => reject(new Error(`${e.message} (${e.filename}:${e.lineno}:${e.colno})`));
      worker.postMessage(msg, transfer);
    });
  }

  broadcast(msg: WorkerRequest) {
    return Promise.all(this.workers.map((_, i) => this.call(i, msg)));
  }

  /** Runs every task, each worker pulling the next one as it finishes. */
  async run(tasks: WorkerRequest[], onResult: (r: WorkerResponse) => void, signal?: AbortSignal) {
    let next = 0;
    await Promise.all(
      this.workers.map(async (_, i) => {
        while (next < tasks.length) {
          signal?.throwIfAborted();
          onResult(await this.call(i, tasks[next++]!));
        }
      }),
    );
  }

  terminate() {
    for (const w of this.workers) w.terminate();
  }
}

const bands = (size: number, rows: number) => {
  const out: [face: number, j0: number, j1: number][] = [];
  for (let face = 0; face < 6; face++) {
    for (let j0 = 0; j0 < size; j0 += rows) out.push([face, j0, Math.min(size, j0 + rows)]);
  }
  return out;
};

export interface GenerateOptions {
  /** an ocean planet, without land */
  ocean?: boolean;
  signal?: AbortSignal;
  /** called with the fraction of work done, 0..1 */
  onProgress?: (fraction: number) => void;
}

/**
 * Generates every map of the planet: drainage on a coarse grid first (rivers, valleys and
 * lakes need the whole planet at once), then the full-resolution faces in parallel bands.
 */
export async function generatePlanet(seed: number, size: number, options: GenerateOptions = {}): Promise<PlanetMaps> {
  const { signal, onProgress } = options;
  const world: WorldRef = { seed, ocean: !!options.ocean };
  const threads = Math.max(2, Math.min(16, (navigator.hardwareConcurrency || 4) - 1));
  const pool = new Pool(threads);
  try {
    // 1. elevation and rainfall on the drainage grid
    const M = HYDRO_SIZE;
    const elev = new Float32Array(6 * M * M);
    const rain = new Float32Array(6 * M * M);
    const hydroTasks = bands(M, 32).map(([face, j0, j1]): WorkerRequest => ({ type: 'hydroBand', world, M, face, j0, j1 }));
    let done = 0;
    await pool.run(
      hydroTasks,
      (r) => {
        if (r.type !== 'hydroBand') return;
        elev.set(r.elev, (r.face * M + r.j0) * M);
        rain.set(r.rain, (r.face * M + r.j0) * M);
        onProgress?.((0.12 * ++done) / hydroTasks.length);
      },
      signal,
    );

    // 2. drainage: a single pass over the whole planet
    const routed = await pool.call(0, { type: 'route', world, M, N: size, elev, rain }, [elev.buffer, rain.buffer]);
    if (routed.type !== 'route') throw new Error('unexpected worker reply');
    const hydro: Hydrology = routed.hydro;
    await pool.broadcast({ type: 'hydro', hydro });
    onProgress?.(0.2);
    signal?.throwIfAborted();

    // 3. the maps themselves
    const bytes = 6 * size * size * 4;
    const maps: PlanetMaps = {
      seed,
      size,
      albedo: new Uint8Array(bytes),
      relief: new Uint8Array(bytes),
      clouds: new Uint8Array(bytes),
    };
    const bakeTasks = bands(size, 64).map(([face, j0, j1]): WorkerRequest => ({ type: 'bake', world, size, face, j0, j1 }));
    done = 0;
    await pool.run(
      bakeTasks,
      (r) => {
        if (r.type !== 'bake') return;
        const offset = (r.face * size + r.j0) * size * 4;
        maps.albedo.set(r.albedo, offset);
        maps.relief.set(r.relief, offset);
        maps.clouds.set(r.clouds, offset);
        onProgress?.(0.2 + (0.8 * ++done) / bakeTasks.length);
      },
      signal,
    );
    return maps;
  } finally {
    pool.terminate();
  }
}
