import type { StarMapOverrides } from './starMap';

/**
 * Renders the star map in a Web Worker so the main thread never blocks on it.
 * Pass only the options to change, e.g. the overrides copied out of the star preview.
 * The caller owns the returned bitmap and should close() it once uploaded.
 */
export const makeStarMapBitmap = (opts: StarMapOverrides = {}): Promise<ImageBitmap> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./starMap.worker.ts', import.meta.url), { type: 'module' });
    // the bitmap arrives first; the worker may keep going to write its cache, then says 'done'
    worker.onmessage = (e: MessageEvent<ImageBitmap | 'done'>) => {
      if (e.data === 'done') worker.terminate();
      else resolve(e.data);
    };
    worker.onerror = (e) => {
      reject(e.error ?? new Error(e.message));
      worker.terminate();
    };
    worker.postMessage(opts);
  });
