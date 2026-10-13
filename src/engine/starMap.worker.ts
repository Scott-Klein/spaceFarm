import { makeStarMap, type StarMapOverrides } from './starMap';

self.onmessage = (e: MessageEvent<StarMapOverrides>) => {
  const bitmap = makeStarMap(e.data).transferToImageBitmap();
  self.postMessage(bitmap, { transfer: [bitmap] });
};
