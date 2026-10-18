import { makeStarMap, type StarMapOverrides } from './starMap';

const CACHE_NAME = 'star-map';

// The sky is deterministic for a given set of opts, so the PNG is cached across loads.
// The worker's own URL is content-hashed in production builds, so any change to the
// generator invalidates old entries. Dev URLs aren't hashed, so dev skips the cache.
const useCache = !import.meta.env.DEV && 'caches' in self;

const cacheKey = (opts: StarMapOverrides) =>
  new URL(`__star-map?w=${encodeURIComponent(self.location.href)}&o=${encodeURIComponent(JSON.stringify(opts))}`, self.location.href).href;

const readCached = async (key: string): Promise<ImageBitmap | null> => {
  try {
    const hit = await (await caches.open(CACHE_NAME)).match(key);
    return hit ? await createImageBitmap(await hit.blob()) : null;
  } catch {
    return null;
  }
};

const writeCached = async (key: string, canvas: OffscreenCanvas) => {
  try {
    const cache = await caches.open(CACHE_NAME);
    // only keep the current sky; these are large
    for (const req of await cache.keys()) if (req.url !== key) await cache.delete(req);
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    await cache.put(key, new Response(blob, { headers: { 'Content-Type': 'image/png' } }));
  } catch {
    // caching is best-effort
  }
};

self.onmessage = async (e: MessageEvent<StarMapOverrides>) => {
  const key = cacheKey(e.data);
  const cached = useCache ? await readCached(key) : null;
  if (cached) {
    self.postMessage(cached, { transfer: [cached] });
    self.postMessage('done');
    return;
  }

  const canvas = makeStarMap(e.data);
  if (!useCache) {
    const bitmap = canvas.transferToImageBitmap();
    self.postMessage(bitmap, { transfer: [bitmap] });
    self.postMessage('done');
    return;
  }
  // copy rather than transfer so the canvas survives for encoding after the sky is sent
  const bitmap = await createImageBitmap(canvas);
  self.postMessage(bitmap, { transfer: [bitmap] });
  await writeCached(key, canvas);
  self.postMessage('done');
};
