// Stockfish 18 lite (single-threaded WASM) in a Web Worker, with a serialised search queue.

const ENGINE_URL = new URL('../vendor/stockfish/stockfish-18-lite-single.js', import.meta.url).href;

class Engine {
  constructor() {
    this.worker = null;
    this.readyP = null;
    this.handler = null;
    this.chain = Promise.resolve();
    this.busy = false;
    this.failed = null;
  }

  start() {
    if (this.readyP) return this.readyP;
    this.readyP = new Promise((resolve, reject) => {
      let w;
      try { w = new Worker(ENGINE_URL); } catch (e) { this.failed = e; reject(e); return; }
      this.worker = w;
      const timer = setTimeout(() => reject(new Error('The engine did not start in time.')), 45000);
      let stage = 0;
      w.onmessage = (e) => {
        const line = typeof e.data === 'string' ? e.data : String(e.data);
        if (stage === 0 && line === 'uciok') { stage = 1; w.postMessage('isready'); return; }
        if (stage === 1 && line === 'readyok') { stage = 2; clearTimeout(timer); resolve(this); return; }
        if (this.handler) this.handler(line);
      };
      w.onerror = (e) => { clearTimeout(timer); this.failed = e; reject(new Error('Engine failed to load: ' + (e.message || 'worker error'))); };
      w.postMessage('uci');
    });
    this.readyP.catch(() => { this.readyP = null; });
    return this.readyP;
  }

  send(cmd) { this.worker.postMessage(cmd); }

  /**
   * search(fen, {depth, movetime, multipv, skill, onInfo}) -> {bestmove, ponder, lines:[{multipv, depth, score:{cp|mate}, pv:[uci]}]}
   * Scores are from the side to move's point of view.
   */
  search(fen, o = {}) {
    const run = async () => {
      await this.start();
      return new Promise((resolve) => {
        const lines = new Map();
        this.busy = true;
        this.handler = (line) => {
          if (line.startsWith('info') && line.includes(' pv ')) {
            const info = parseInfo(line);
            if (!info || info.bound) return;
            lines.set(info.multipv, info);
            if (o.onInfo) o.onInfo(info, [...lines.values()].sort((a, b) => a.multipv - b.multipv));
          } else if (line.startsWith('info') && / score mate 0\b/.test(line)) {
            lines.set(1, { multipv: 1, depth: 0, score: { mate: 0 }, pv: [] });
          } else if (line.startsWith('bestmove')) {
            const [, best, , ponder] = line.split(/\s+/);
            this.handler = null;
            this.busy = false;
            resolve({ bestmove: best && best !== '(none)' ? best : null, ponder: ponder || null,
              lines: [...lines.values()].sort((a, b) => a.multipv - b.multipv) });
          }
        };
        this.send(`setoption name MultiPV value ${o.multipv || 1}`);
        this.send(`setoption name Skill Level value ${o.skill ?? 20}`);
        this.send(`position fen ${fen}`);
        if (o.movetime && !o.depth) this.send(`go movetime ${o.movetime}`);
        else if (o.movetime) this.send(`go depth ${o.depth} movetime ${o.movetime}`);
        else this.send(`go depth ${o.depth || 12}`);
      });
    };
    const p = this.chain.then(run, run);
    this.chain = p.catch(() => {});
    return p;
  }

  stop() { if (this.worker && this.busy) this.send('stop'); }

  newGame() { if (this.worker) { this.send('ucinewgame'); this.send('isready'); } }
}

function parseInfo(line) {
  const t = line.split(/\s+/);
  const out = { multipv: 1, depth: 0, score: null, pv: [], bound: false };
  for (let i = 1; i < t.length; i++) {
    const k = t[i];
    if (k === 'depth') out.depth = Number(t[++i]);
    else if (k === 'multipv') out.multipv = Number(t[++i]);
    else if (k === 'score') {
      const kind = t[++i], v = Number(t[++i]);
      out.score = kind === 'mate' ? { mate: v } : { cp: v };
      if (t[i + 1] === 'lowerbound' || t[i + 1] === 'upperbound') { out.bound = true; i++; }
    } else if (k === 'pv') { out.pv = t.slice(i + 1); break; }
  }
  return out.score ? out : null;
}

export const engine = new Engine();

// Centipawn value for a score (mate mapped to large values), from the same POV.
export function scoreCp(s) {
  if (!s) return 0;
  if (s.mate !== undefined) {
    if (s.mate === 0) return -100000; // side to move is mated
    return s.mate > 0 ? 100000 - s.mate * 100 : -100000 - s.mate * 100;
  }
  return s.cp;
}

export function flip(s) { return s ? (s.mate !== undefined ? { mate: -s.mate } : { cp: -s.cp }) : s; }

export function fmtScore(s) {
  if (!s) return '…';
  if (s.mate !== undefined) return s.mate === 0 ? '#' : (s.mate > 0 ? '#' : '#-') + Math.abs(s.mate);
  const v = s.cp / 100;
  return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
}

// Win probability for the side the score is for (lichess logistic model).
export function winProb(s) {
  if (s && s.mate !== undefined) return s.mate > 0 ? 1 : 0;
  const cp = Math.max(-1500, Math.min(1500, s ? s.cp : 0));
  return 1 / (1 + Math.exp(-0.00368208 * cp));
}

// Opponent levels: honest, relative descriptions (no rating claims).
export const LEVELS = [
  { n: 1, name: 'Beginner', desc: 'Often blunders pieces and misses simple mates. Good for practising checkmates and converting.', skill: 0, depth: 1, multipv: 6, random: 1.0 },
  { n: 2, name: 'Novice', desc: 'Makes frequent mistakes and leaves material loose, but takes free pieces.', skill: 0, depth: 2, multipv: 5, random: 0.7 },
  { n: 3, name: 'Casual', desc: 'Plays sensible moves with regular errors. A fair test for Part One skills.', skill: 2, depth: 4, multipv: 4, random: 0.4 },
  { n: 4, name: 'Improving', desc: 'Sees most one-move tactics; still makes positional and occasional tactical errors.', skill: 5, depth: 6, multipv: 3, random: 0.2 },
  { n: 5, name: 'Club', desc: 'Solid and tactical; punishes loose pieces. Mistakes become rare.', skill: 9, depth: 8 },
  { n: 6, name: 'Strong club', desc: 'Rarely blunders. Expect to lose material you leave undefended.', skill: 13, movetime: 300 },
  { n: 7, name: 'Expert', desc: 'Very strong. Use it to test winning positions and endgame technique.', skill: 17, movetime: 500 },
  { n: 8, name: 'Full strength', desc: 'The lite engine at full strength — far stronger than any human player.', skill: 20, movetime: 1000 },
];

// Choose a move for a level. Lowest levels pick deliberately among MultiPV candidates.
export async function levelMove(fen, n) {
  const L = LEVELS.find((l) => l.n === Number(n)) || LEVELS[2];
  const res = await engine.search(fen, { depth: L.depth, movetime: L.movetime, multipv: L.multipv || 1, skill: L.skill });
  if (L.multipv && res.lines.length > 1 && Math.random() < L.random) {
    const cands = res.lines.filter((l) => l.pv[0]);
    // weighted towards better moves but allowing any candidate
    const weights = cands.map((_, i) => 1 / (i + 1));
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < cands.length; i++) { r -= weights[i]; if (r <= 0) return cands[i].pv[0]; }
  }
  return res.bestmove;
}
