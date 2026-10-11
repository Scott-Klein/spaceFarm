/**
 * Renders the star map in a Web Worker so the main thread never blocks on it.
 * The caller owns the returned bitmap and should close() it once uploaded.
 */
export const makeStarMapBitmap = (scale = 1, seed?: number): Promise<ImageBitmap> =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./starMap.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<ImageBitmap>) => {
      resolve(e.data);
      worker.terminate();
    };
    worker.onerror = (e) => {
      reject(e.error ?? new Error(e.message));
      worker.terminate();
    };
    worker.postMessage({ scale, seed });
  });
