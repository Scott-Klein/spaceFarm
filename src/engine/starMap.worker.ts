import { makeStarMap } from './starSkyBox';

self.onmessage = (e: MessageEvent<{ scale: number; seed?: number }>) => {
  const bitmap = makeStarMap(e.data.scale, e.data.seed).transferToImageBitmap();
  self.postMessage(bitmap, { transfer: [bitmap] });
};
