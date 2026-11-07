import { createRequire } from 'node:module';
import path from 'node:path';
import { UciEngine, type UciTransport } from '../../src/engine/uci';

const require = createRequire(import.meta.url);

export function nodeEngine(): UciEngine {
  const factory = require(path.resolve(__dirname, '../../public/engine/stockfish-19-lite-single.js'));
  const eng = factory();
  let listener: (l: string) => void = () => {};
  eng.listener = (l: string) => listener(l);
  const t: UciTransport = {
    send: (c) => eng.processCommand(c),
    setListener: (cb) => (listener = cb),
    terminate: () => {
      try {
        eng.terminate();
      } catch {
        /* ignore */
      }
    },
  };
  return new UciEngine(t);
}
