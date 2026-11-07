import type { UciTransport } from '../../src/engine/uci';

/**
 * Scriptable fake UCI engine for robustness/scheduler tests (no WASM).
 *  - `searchMs`: how long a `go` takes unless stopped (default 30 ms)
 *  - `failOnGo`: number of `go` commands after which the transport "crashes"
 *  - `hangOnGo`: number of `go` commands that never answer (not even to stop)
 *  - `bootFails`: the first N instances never answer `uci`
 */
export type FakeScript = { searchMs?: number; failOnGo?: number; hangOnGo?: number; bootFails?: number; bestmove?: string };

export type FakeStats = { instances: number; gos: number; stops: number; log: string[]; active: number; maxActive: number };

export function fakeFactory(script: FakeScript = {}, stats: FakeStats = { instances: 0, gos: 0, stops: 0, log: [], active: 0, maxActive: 0 }) {
  let failBudget = script.failOnGo ?? 0;
  let hangBudget = script.hangOnGo ?? 0;
  let bootFails = script.bootFails ?? 0;
  const make = (): UciTransport => {
    stats.instances++;
    const silent = bootFails-- > 0;
    let listener: (l: string) => void = () => {};
    let onErr: (e: Error) => void = () => {};
    let timer: ReturnType<typeof setTimeout> | null = null;
    let searching = false;
    let hanging = false;
    let dead = false;
    const emit = (l: string) => setTimeout(() => !dead && listener(l), 0);
    const finish = () => {
      if (!searching) return;
      searching = false;
      stats.active--;
      if (timer) clearTimeout(timer);
      timer = null;
      emit('info depth 5 multipv 1 score cp 12 nodes 100 pv ' + (script.bestmove ?? 'e2e4'));
      emit('bestmove ' + (script.bestmove ?? 'e2e4'));
    };
    return {
      send(cmd: string) {
        if (dead) return;
        stats.log.push(cmd);
        if (silent) return;
        if (cmd === 'uci') {
          emit('id name FakeFish');
          emit('uciok');
        } else if (cmd === 'isready') emit('readyok');
        else if (cmd.startsWith('go')) {
          stats.gos++;
          if (failBudget > 0) {
            failBudget--;
            setTimeout(() => {
              dead = true;
              onErr(new Error('simulated worker crash'));
            }, 5);
            return;
          }
          if (hangBudget > 0) {
            hangBudget--;
            hanging = true;
            return;
          }
          searching = true;
          stats.active++;
          stats.maxActive = Math.max(stats.maxActive, stats.active);
          const mt = /movetime (\d+)/.exec(cmd);
          timer = setTimeout(finish, mt ? Number(mt[1]) : (script.searchMs ?? 30));
        } else if (cmd === 'stop') {
          stats.stops++;
          if (!hanging) finish();
        }
      },
      setListener: (cb) => (listener = cb),
      setErrorListener: (cb) => (onErr = cb),
      terminate() {
        if (searching) stats.active--;
        searching = false;
        dead = true;
        if (timer) clearTimeout(timer);
      },
    };
  };
  return { make, stats };
}
