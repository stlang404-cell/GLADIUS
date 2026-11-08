/// <reference lib="webworker" />
import { createWorld } from './world';

self.onmessage = (e: MessageEvent<{ seed: number }>) => {
  const w = createWorld(e.data.seed, undefined, (f) => (self as unknown as Worker).postMessage({ progress: f }));
  (self as unknown as Worker).postMessage({ world: w });
};
