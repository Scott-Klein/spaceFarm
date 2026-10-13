import { makeStarMap } from './starSkyBox';

// The old generator, kept only so the star preview can compare it with the new one.
self.onmessage = (e: MessageEvent<{ scale: number; seed?: number }>) => {
  const bitmap = makeStarMap(e.data.scale, e.data.seed).transferToImageBitmap();
  self.postMessage(bitmap, { transfer: [bitmap] });
};
