/**
 * Tournament formats: single/double elimination, Swiss, round robin, league
 * (double round robin) and head-to-head match series.
 *
 * Everything here is pure and deterministic. The state is a plain
 * JSON-serialisable object (persisted to IndexedDB); functions mutate the
 * state passed in and return it for convenience.
 */

export type Format = 'single-elim' | 'double-elim' | 'swiss' | 'round-robin' | 'league' | 'match-series';
export type EntrantId = string;

export type Pairing = {
  id: string; // unique within tournament
  round: number; // 0-based round index
  white: EntrantId;
  black: EntrantId | null; // null = bye (white gets the bye / advances)
  result: number | null; // white's score 1 | 0.5 | 0 ; null = not played
  bracket?: 'W' | 'L' | 'GF' | 'GF2'; // double elimination
  tiebreakOf?: string; // id of the drawn game this tiebreak resolves
  armageddon?: boolean; // draw counts as a BLACK win
  game?: number; // game number inside a match-series
  /** Set when the game was not played because of a withdrawal: who forfeited. */
  forfeit?: 'white' | 'black' | 'both';
};

export type TournamentConfig = {
  rounds?: number;
  matchGames?: number;
  /** Entrants seeded first, in this order, ahead of rating order (e.g. reigning title holders). */
  topSeeds?: EntrantId[];
};

type Stage = 'bracket' | 'gf' | 'gf2' | 'done';

export type TournamentState = {
  format: Format;
  entrants: EntrantId[]; // seed order: index 0 = top seed
  ratings: Record<EntrantId, number>;
  config: TournamentConfig;
  rounds: Pairing[][];
  withdrawn: EntrantId[];
  complete: boolean;
  winner: EntrantId | null;
  runnerUp: EntrantId | null;
  nextPairingNo: number;
  /** Match (not game) losses, elimination formats. */
  losses: Record<EntrantId, number>;
  /** Round index in which a player was knocked out / removed (elimination formats). */
  eliminatedAt: Record<EntrantId, number>;
  /** Single-elim bracket slots / double-elim winners-bracket slots of the current round. */
  wb: (EntrantId | null)[];
  /** Double-elim losers-bracket pool (players with exactly one loss still alive). */
  lb: EntrantId[];
  /** Number of losers-bracket byes per player. */
  lbByes: Record<EntrantId, number>;
  /** Double-elim stage. */
  stage: Stage;
  /** Double-elim grand final participants: [WB champion, LB champion]. */
  gf: [EntrantId, EntrantId] | null;
  /** Round-robin / league schedule: [white, black|null] per round. */
  schedule: [EntrantId, EntrantId | null][][];
};

export type StandingRow = {
  id: EntrantId;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  byes: number;
  buchholz: number;
  sonnebornBerger: number;
  place: number;
  eliminated?: boolean;
};

const ELIM: Format[] = ['single-elim', 'double-elim'];
const isElim = (f: Format) => ELIM.includes(f);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nextPow2(n: number): number {
  let s = 1;
  while (s < n) s *= 2;
  return s;
}

/** Classic recursive bracket seed order (0-based seed indices), e.g. 8 -> 0,7,3,4,1,6,2,5. */
export function bracketSeedOrder(size: number): number[] {
  let order = [0];
  while (order.length < size) {
    const m = order.length * 2;
    order = order.flatMap((s) => [s, m - 1 - s]);
  }
  return order;
}

function currentRound(t: TournamentState): Pairing[] {
  return t.rounds[t.rounds.length - 1] ?? [];
}

function roundResolved(round: Pairing[]): boolean {
  return round.every((p) => p.result !== null);
}

function seedIndex(t: TournamentState): Record<EntrantId, number> {
  const idx: Record<EntrantId, number> = {};
  t.entrants.forEach((e, i) => (idx[e] = i));
  return idx;
}

function isWithdrawn(t: TournamentState, id: EntrantId): boolean {
  return t.withdrawn.includes(id);
}

function newPairing(
  t: TournamentState,
  round: number,
  white: EntrantId,
  black: EntrantId | null,
  extra: Partial<Pairing> = {},
): Pairing {
  const p: Pairing = { id: `p${t.nextPairingNo++}`, round, white, black, result: black === null ? 1 : null, ...extra };
  return p;
}

type ColourStats = { diff: Record<EntrantId, number>; last: Record<EntrantId, 'W' | 'B'> };

function colourStats(t: TournamentState): ColourStats {
  const diff: Record<EntrantId, number> = {};
  const last: Record<EntrantId, 'W' | 'B'> = {};
  for (const e of t.entrants) diff[e] = 0;
  for (const round of t.rounds) {
    for (const p of round) {
      if (p.black === null || p.forfeit) continue;
      diff[p.white] = (diff[p.white] ?? 0) + 1;
      diff[p.black] = (diff[p.black] ?? 0) - 1;
      last[p.white] = 'W';
      last[p.black] = 'B';
    }
  }
  return { diff, last };
}

/** Returns [white, black]. `a` is assumed to be the higher-ranked player. */
function allocateColours(cs: ColourStats, a: EntrantId, b: EntrantId, parity: number): [EntrantId, EntrantId] {
  const da = cs.diff[a] ?? 0;
  const db = cs.diff[b] ?? 0;
  if (da < db) return [a, b];
  if (db < da) return [b, a];
  const la = cs.last[a];
  const lb = cs.last[b];
  if (la === 'B' && lb !== 'B') return [a, b];
  if (lb === 'B' && la !== 'B') return [b, a];
  if (la === 'W' && lb !== 'W') return [b, a];
  if (lb === 'W' && la !== 'W') return [a, b];
  return parity % 2 === 0 ? [a, b] : [b, a];
}

function applyColours(cs: ColourStats, w: EntrantId, b: EntrantId): void {
  cs.diff[w] = (cs.diff[w] ?? 0) + 1;
  cs.diff[b] = (cs.diff[b] ?? 0) - 1;
  cs.last[w] = 'W';
  cs.last[b] = 'B';
}

export function matchOutcome(p: Pairing): 'white' | 'black' | 'draw' | null {
  if (p.result === null) return null;
  if (p.black === null) return 'white';
  if (p.armageddon) return p.result === 1 ? 'white' : 'black';
  if (p.result === 1) return 'white';
  if (p.result === 0) return 'black';
  return 'draw';
}

/** Winner of a mini-match rooted at `root` (following tiebreak children), or null if unresolved. */
function matchWinner(round: Pairing[], root: Pairing): EntrantId | null {
  let p: Pairing | undefined = root;
  while (p) {
    const o = matchOutcome(p);
    if (o === 'white') return p.white;
    if (o === 'black') return p.black;
    if (o === null) return null;
    const id: string = p.id;
    p = round.find((c) => c.tiebreakOf === id);
  }
  return null;
}

function findRoot(round: Pairing[], id: EntrantId): Pairing | undefined {
  return round.find((p) => !p.tiebreakOf && (p.white === id || p.black === id));
}

function otherOf(p: Pairing, id: EntrantId | null): EntrantId | null {
  if (id === null) return null;
  return p.white === id ? p.black : p.white;
}

function lastEliminated(t: TournamentState, exclude: EntrantId | null): EntrantId | null {
  let best: EntrantId | null = null;
  let bestRound = -1;
  for (const e of t.entrants) {
    if (e === exclude) continue;
    const r = t.eliminatedAt[e];
    if (r === undefined) continue;
    if (r > bestRound) {
      bestRound = r;
      best = e;
    }
  }
  return best;
}

function finish(t: TournamentState, winner: EntrantId | null, runnerUp: EntrantId | null): void {
  t.complete = true;
  t.winner = winner;
  t.runnerUp = runnerUp;
  t.stage = 'done';
}

function finishByStandings(t: TournamentState): void {
  const s = standings(t);
  finish(t, s[0]?.id ?? null, s[1]?.id ?? null);
}

// ---------------------------------------------------------------------------
// Creation
// ---------------------------------------------------------------------------

export function createTournament(
  format: Format,
  entrants: EntrantId[],
  ratings: Record<EntrantId, number>,
  config: TournamentConfig = {},
): TournamentState {
  if (new Set(entrants).size !== entrants.length) throw new Error('Duplicate entrants');
  if (entrants.length < 2) throw new Error('A tournament needs at least 2 entrants');
  if (format === 'match-series' && entrants.length !== 2) throw new Error('A match series needs exactly 2 entrants');
  const top = (config.topSeeds ?? []).filter((x) => entrants.includes(x));
  const seeded = [...entrants].sort((a, b) => {
    const ta = top.indexOf(a);
    const tb = top.indexOf(b);
    if (ta !== tb) return (ta < 0 ? Infinity : ta) - (tb < 0 ? Infinity : tb);
    const d = (ratings[b] ?? 0) - (ratings[a] ?? 0);
    if (d !== 0) return d;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  const n = seeded.length;
  const cfg: TournamentConfig = { ...config };
  if (format === 'swiss') cfg.rounds = cfg.rounds ?? Math.max(3, Math.ceil(Math.log2(n)) + 1);
  if (format === 'match-series') cfg.matchGames = Math.max(1, cfg.matchGames ?? 6);

  const t: TournamentState = {
    format,
    entrants: seeded,
    ratings: { ...ratings },
    config: cfg,
    rounds: [],
    withdrawn: [],
    complete: false,
    winner: null,
    runnerUp: null,
    nextPairingNo: 1,
    losses: {},
    eliminatedAt: {},
    wb: [],
    lb: [],
    lbByes: {},
    stage: 'bracket',
    gf: null,
    schedule: [],
  };
  for (const e of seeded) t.losses[e] = 0;

  switch (format) {
    case 'single-elim':
    case 'double-elim': {
      const size = nextPow2(n);
      t.wb = bracketSeedOrder(size).map((s) => (s < n ? seeded[s] : null));
      if (format === 'single-elim') generateSingle(t);
      else generateDouble(t);
      break;
    }
    case 'swiss':
      generateSwiss(t);
      break;
    case 'round-robin':
    case 'league':
      t.schedule = bergerSchedule(seeded, format === 'league');
      generateRoundRobin(t);
      break;
    case 'match-series':
      generateMatch(t);
      break;
  }
  autoAdvance(t);
  return t;
}

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

function autoAdvance(t: TournamentState): void {
  let guard = 0;
  while (!t.complete && roundResolved(currentRound(t))) {
    if (++guard > 10000) throw new Error('Tournament failed to progress');
    switch (t.format) {
      case 'single-elim':
        advanceSingle(t);
        break;
      case 'double-elim':
        advanceDouble(t);
        break;
      case 'swiss':
        if (t.rounds.length >= (t.config.rounds ?? 0)) finishByStandings(t);
        else generateSwiss(t);
        break;
      case 'round-robin':
      case 'league':
        if (t.rounds.length >= t.schedule.length) finishByStandings(t);
        else generateRoundRobin(t);
        break;
      case 'match-series':
        generateMatch(t);
        break;
    }
  }
}

export function pendingPairings(t: TournamentState): Pairing[] {
  if (t.complete) return [];
  return currentRound(t).filter((p) => p.result === null && p.black !== null);
}

export function recordResult(t: TournamentState, pairingId: string, whiteScore: number): TournamentState {
  if (t.complete) throw new Error('Tournament is already complete');
  if (whiteScore !== 1 && whiteScore !== 0.5 && whiteScore !== 0) throw new Error(`Invalid score ${whiteScore}`);
  const round = currentRound(t);
  const p = round.find((x) => x.id === pairingId);
  if (!p) throw new Error(`Pairing ${pairingId} is not in the current round`);
  if (p.black === null) throw new Error('Cannot record a result for a bye');
  if (p.result !== null) throw new Error(`Pairing ${pairingId} already has a result`);
  p.result = whiteScore;
  if (isElim(t.format) && whiteScore === 0.5 && !p.armageddon) {
    // Drawn knockout game: tiebreak with colours reversed, then Armageddon.
    const extra: Partial<Pairing> = { tiebreakOf: p.id };
    if (p.bracket) extra.bracket = p.bracket;
    if (p.tiebreakOf) extra.armageddon = true;
    round.push(newPairing(t, p.round, p.black, p.white, extra));
  }
  autoAdvance(t);
  return t;
}

export function withdraw(t: TournamentState, id: EntrantId): TournamentState {
  if (!t.entrants.includes(id)) throw new Error(`Unknown entrant ${id}`);
  if (isWithdrawn(t, id)) return t;
  t.withdrawn.push(id);
  if (t.complete) return t;
  const r = t.rounds.length - 1;
  for (const p of currentRound(t)) {
    if (p.result !== null) continue;
    if (p.white !== id && p.black !== id) continue;
    if (p.black === null) continue;
    const other = p.white === id ? p.black : p.white;
    if (isWithdrawn(t, other)) {
      p.result = 0;
      p.forfeit = 'both';
    } else if (p.white === id) {
      p.result = 0;
      p.forfeit = 'white';
    } else {
      p.result = 1;
      p.forfeit = 'black';
    }
  }
  if (isElim(t.format) && t.eliminatedAt[id] === undefined) {
    // A withdrawn player whose pending game was forfeited is eliminated now; others when the round closes.
    t.eliminatedAt[id] = Math.max(0, r);
  }
  if (t.format === 'match-series') {
    const other = t.entrants.find((e) => e !== id)!;
    finish(t, isWithdrawn(t, other) ? null : other, isWithdrawn(t, other) ? null : id);
    return t;
  }
  autoAdvance(t);
  return t;
}

// ---------------------------------------------------------------------------
// Single elimination
// ---------------------------------------------------------------------------

function generateSingle(t: TournamentState): void {
  const r = t.rounds.length;
  const cs = colourStats(t);
  const idx = seedIndex(t);
  const round: Pairing[] = [];
  for (let i = 0; i + 1 < t.wb.length; i += 2) {
    const a = t.wb[i];
    const b = t.wb[i + 1];
    if (a && b) {
      const [hi, lo] = idx[a] < idx[b] ? [a, b] : [b, a];
      const [w, bl] = allocateColours(cs, hi, lo, r);
      round.push(newPairing(t, r, w, bl));
    } else if (a || b) {
      round.push(newPairing(t, r, (a ?? b)!, null));
    }
  }
  t.rounds.push(round);
}

function advanceSingle(t: TournamentState): void {
  const r = t.rounds.length - 1;
  const round = currentRound(t);
  const next: (EntrantId | null)[] = [];
  let finalLoser: EntrantId | null = null;
  for (let i = 0; i + 1 < t.wb.length; i += 2) {
    const a = t.wb[i];
    const b = t.wb[i + 1];
    if (!a && !b) {
      next.push(null);
      continue;
    }
    const root = findRoot(round, (a ?? b)!);
    if (!root) {
      next.push(null);
      continue;
    }
    const w = matchWinner(round, root);
    const l = otherOf(root, w);
    if (l) {
      t.losses[l] = (t.losses[l] ?? 0) + 1;
      if (t.eliminatedAt[l] === undefined || isWithdrawn(t, l)) t.eliminatedAt[l] = r;
      finalLoser = l;
    }
    next.push(w);
  }
  if (next.length === 1) {
    const w = next[0];
    finish(t, w, finalLoser ?? lastEliminated(t, w));
    return;
  }
  t.wb = next.map((x) => {
    if (x && isWithdrawn(t, x)) {
      t.eliminatedAt[x] = r + 1;
      return null;
    }
    return x;
  });
  const alive = t.wb.filter((x): x is EntrantId => x !== null);
  if (alive.length <= 1) {
    const w = alive[0] ?? null;
    finish(t, w, lastEliminated(t, w));
    return;
  }
  generateSingle(t);
}

// ---------------------------------------------------------------------------
// Double elimination
// ---------------------------------------------------------------------------

function generateDouble(t: TournamentState): void {
  const r = t.rounds.length;
  // Remove withdrawn players.
  t.wb = t.wb.map((x) => {
    if (x && isWithdrawn(t, x)) {
      if (t.eliminatedAt[x] === undefined || t.eliminatedAt[x] < r - 1) t.eliminatedAt[x] = Math.max(0, r - 1);
      return null;
    }
    return x;
  });
  t.lb = t.lb.filter((x) => {
    if (isWithdrawn(t, x)) {
      if (t.eliminatedAt[x] === undefined) t.eliminatedAt[x] = Math.max(0, r - 1);
      return false;
    }
    return true;
  });
  const wbAlive = t.wb.filter((x): x is EntrantId => x !== null);
  if (wbAlive.length <= 1) t.wb = wbAlive;
  const alive = wbAlive.length + t.lb.length;
  if (alive <= 1) {
    const w = wbAlive[0] ?? t.lb[0] ?? null;
    finish(t, w, lastEliminated(t, w));
    return;
  }
  const cs = colourStats(t);
  const idx = seedIndex(t);
  const round: Pairing[] = [];
  if (t.wb.length === 1 && t.lb.length === 1) {
    t.stage = 'gf';
    t.gf = [t.wb[0]!, t.lb[0]];
    round.push(newPairing(t, r, t.wb[0]!, t.lb[0], { bracket: 'GF' }));
    t.rounds.push(round);
    return;
  }
  if (t.wb.length > 1) {
    for (let i = 0; i + 1 < t.wb.length; i += 2) {
      const a = t.wb[i];
      const b = t.wb[i + 1];
      if (a && b) {
        const [hi, lo] = idx[a] < idx[b] ? [a, b] : [b, a];
        const [w, bl] = allocateColours(cs, hi, lo, r);
        round.push(newPairing(t, r, w, bl, { bracket: 'W' }));
      } else if (a || b) {
        round.push(newPairing(t, r, (a ?? b)!, null, { bracket: 'W' }));
      }
    }
  }
  if (t.lb.length >= 2) {
    let pool = [...t.lb];
    if (pool.length % 2 === 1) {
      // Bye to the player with the fewest losers-bracket byes, then the best seed.
      let bye = pool[0];
      for (const x of pool) {
        const bx = t.lbByes[x] ?? 0;
        const bb = t.lbByes[bye] ?? 0;
        if (bx < bb || (bx === bb && idx[x] < idx[bye])) bye = x;
      }
      t.lbByes[bye] = (t.lbByes[bye] ?? 0) + 1;
      round.push(newPairing(t, r, bye, null, { bracket: 'L' }));
      pool = pool.filter((x) => x !== bye);
    }
    for (let i = 0; i < pool.length / 2; i++) {
      const a = pool[i];
      const b = pool[pool.length - 1 - i];
      const [hi, lo] = idx[a] < idx[b] ? [a, b] : [b, a];
      const [w, bl] = allocateColours(cs, hi, lo, r);
      applyColours(cs, w, bl);
      round.push(newPairing(t, r, w, bl, { bracket: 'L' }));
    }
  }
  t.rounds.push(round);
}

function advanceDouble(t: TournamentState): void {
  const r = t.rounds.length - 1;
  const round = currentRound(t);
  if (t.stage === 'gf' || t.stage === 'gf2') {
    const root = round.find((p) => !p.tiebreakOf)!;
    const w = matchWinner(round, root)!;
    const l = otherOf(root, w)!;
    t.losses[l] = (t.losses[l] ?? 0) + 1;
    const [wbChamp, lbChamp] = t.gf!;
    if (t.stage === 'gf2' || w === wbChamp) {
      t.eliminatedAt[l] = r;
      finish(t, w, l);
      return;
    }
    // LB champion beat the WB champion: bracket reset.
    if (isWithdrawn(t, wbChamp)) {
      t.eliminatedAt[wbChamp] = r;
      finish(t, lbChamp, wbChamp);
      return;
    }
    t.stage = 'gf2';
    const cs = colourStats(t);
    const [wc, bc] = allocateColours(cs, wbChamp, lbChamp, r + 1);
    t.rounds.push([newPairing(t, r + 1, wc, bc, { bracket: 'GF2' })]);
    return;
  }

  const newWB: (EntrantId | null)[] = [];
  const dropouts: EntrantId[] = [];
  if (t.wb.length > 1) {
    for (let i = 0; i + 1 < t.wb.length; i += 2) {
      const a = t.wb[i];
      const b = t.wb[i + 1];
      if (!a && !b) {
        newWB.push(null);
        continue;
      }
      const root = findRoot(round, (a ?? b)!);
      if (!root) {
        newWB.push(null);
        continue;
      }
      const w = matchWinner(round, root);
      const l = otherOf(root, w);
      newWB.push(w);
      if (l) {
        t.losses[l] = (t.losses[l] ?? 0) + 1;
        dropouts.push(l);
      }
    }
  } else {
    newWB.push(...t.wb);
  }
  const survivors: EntrantId[] = [];
  for (const id of t.lb) {
    const root = findRoot(round, id);
    if (!root) {
      survivors.push(id); // waited this round
      continue;
    }
    const w = matchWinner(round, root);
    if (w === id) survivors.push(id);
    else {
      t.losses[id] = (t.losses[id] ?? 0) + 1;
      t.eliminatedAt[id] = r;
    }
  }
  t.wb = newWB;
  t.lb = [...survivors, ...dropouts];
  generateDouble(t);
}

// ---------------------------------------------------------------------------
// Swiss
// ---------------------------------------------------------------------------

function swissPoints(t: TournamentState): Record<EntrantId, number> {
  const pts: Record<EntrantId, number> = {};
  for (const e of t.entrants) pts[e] = 0;
  for (const round of t.rounds) {
    for (const p of round) {
      if (p.result === null) continue;
      const [ws, bs] = gameScores(p);
      pts[p.white] += ws;
      if (p.black !== null) pts[p.black] += bs;
    }
  }
  return pts;
}

const pairKey = (a: EntrantId, b: EntrantId) => (a < b ? `${a}|${b}` : `${b}|${a}`);

function generateSwiss(t: TournamentState): void {
  const r = t.rounds.length;
  const idx = seedIndex(t);
  const pts = swissPoints(t);
  const played = new Set<string>();
  const hadBye = new Set<EntrantId>();
  for (const round of t.rounds)
    for (const p of round) {
      if (p.black === null) hadBye.add(p.white);
      else played.add(pairKey(p.white, p.black));
    }
  const cs = colourStats(t);
  const ranked = t.entrants
    .filter((e) => !isWithdrawn(t, e))
    .sort((a, b) => pts[b] - pts[a] || idx[a] - idx[b]);

  if (ranked.length === 0) {
    finishByStandings(t);
    return;
  }

  const colourOk = (a: EntrantId, b: EntrantId) => {
    const da = cs.diff[a] ?? 0;
    const db = cs.diff[b] ?? 0;
    return !((da >= 2 && db >= 2) || (da <= -2 && db <= -2));
  };

  let budget = 0;
  const dfs = (list: EntrantId[], level: number): [EntrantId, EntrantId][] | null => {
    if (list.length === 0) return [];
    if (--budget < 0) return null;
    const p = list[0];
    const rest = list.slice(1);
    // Score group of p within the remaining list.
    let g = 1;
    while (g < list.length && pts[list[g]] === pts[p]) g++;
    const h = Math.floor(g / 2);
    const order: number[] = [];
    if (h > 0) {
      for (let i = h; i < g; i++) order.push(i);
      for (let i = h - 1; i >= 1; i--) order.push(i);
    }
    for (let i = g; i < list.length; i++) order.push(i);
    for (const i of order) {
      const c = list[i];
      if (level < 2 && played.has(pairKey(p, c))) continue;
      if (level < 1 && !colourOk(p, c)) continue;
      const sub = dfs(
        rest.filter((x) => x !== c),
        level,
      );
      if (sub) return [[p, c], ...sub];
      if (budget < 0) return null;
    }
    return null;
  };

  let pairs: [EntrantId, EntrantId][] | null = null;
  let bye: EntrantId | null = null;
  const odd = ranked.length % 2 === 1;
  const byeEligible = [...ranked].reverse().filter((e) => !hadBye.has(e));
  const byeAll = [...ranked].reverse();
  const attempts: [number, EntrantId[]][] = odd
    ? [
        [0, byeEligible],
        [1, byeEligible],
        [1, byeAll],
        [2, byeEligible],
        [2, byeAll],
      ]
    : [
        [0, []],
        [1, []],
        [2, []],
      ];
  outer: for (const [level, byes] of attempts) {
    const cands: (EntrantId | null)[] = odd ? byes : [null];
    for (const b of cands) {
      budget = 20000;
      const list = b === null ? ranked : ranked.filter((x) => x !== b);
      const res = dfs(list, level);
      if (res) {
        pairs = res;
        bye = b;
        break outer;
      }
    }
  }
  if (!pairs) throw new Error('Swiss pairing failed');

  const rank: Record<EntrantId, number> = {};
  ranked.forEach((e, i) => (rank[e] = i));
  const round: Pairing[] = [];
  for (const [a, b] of pairs) {
    const [w, bl] = allocateColours(cs, a, b, r + rank[a]);
    round.push(newPairing(t, r, w, bl));
  }
  if (bye !== null) round.push(newPairing(t, r, bye, null));
  t.rounds.push(round);
}

// ---------------------------------------------------------------------------
// Round robin / league
// ---------------------------------------------------------------------------

function bergerSchedule(ids: EntrantId[], double: boolean): [EntrantId, EntrantId | null][][] {
  const players: (EntrantId | null)[] = [...ids];
  if (players.length % 2 === 1) players.push(null);
  const m = players.length;
  let arr = players.map((_, i) => i);
  const cs: ColourStats = { diff: {}, last: {} };
  const seed: Record<EntrantId, number> = {};
  ids.forEach((e, i) => (seed[e] = i));
  const rounds: [EntrantId, EntrantId | null][][] = [];
  for (let r = 0; r < m - 1; r++) {
    const pairs: [EntrantId, EntrantId | null][] = [];
    for (let i = 0; i < m / 2; i++) {
      const a = players[arr[i]];
      const b = players[arr[m - 1 - i]];
      if (a === null && b === null) continue;
      if (a === null || b === null) {
        pairs.push([(a ?? b)!, null]);
        continue;
      }
      const [hi, lo] = seed[a] < seed[b] ? [a, b] : [b, a];
      const [w, bl] = allocateColours(cs, hi, lo, r + i);
      applyColours(cs, w, bl);
      pairs.push([w, bl]);
    }
    rounds.push(pairs);
    arr = [arr[0], arr[m - 1], ...arr.slice(1, m - 1)];
  }
  if (double) {
    const second = rounds.map((rd) =>
      rd.map(([w, b]) => (b === null ? ([w, null] as [EntrantId, null]) : ([b, w] as [EntrantId, EntrantId]))),
    );
    rounds.push(...second);
  }
  return rounds;
}

function generateRoundRobin(t: TournamentState): void {
  const r = t.rounds.length;
  const round: Pairing[] = [];
  for (const [w, b] of t.schedule[r]) {
    const p = newPairing(t, r, w, b);
    if (b === null) {
      if (isWithdrawn(t, w)) {
        p.result = 0;
        p.forfeit = 'white';
      }
    } else {
      const ww = isWithdrawn(t, w);
      const bw = isWithdrawn(t, b);
      if (ww && bw) {
        p.result = 0;
        p.forfeit = 'both';
      } else if (ww) {
        p.result = 0;
        p.forfeit = 'white';
      } else if (bw) {
        p.result = 1;
        p.forfeit = 'black';
      }
    }
    round.push(p);
  }
  t.rounds.push(round);
}

// ---------------------------------------------------------------------------
// Match series
// ---------------------------------------------------------------------------

function generateMatch(t: TournamentState): void {
  const [A, B] = t.entrants;
  const G = t.config.matchGames ?? 6;
  const all = t.rounds.flat();
  const r = t.rounds.length;
  const total = all.length;
  const scoreOf = (games: Pairing[]) => {
    let a = 0;
    let b = 0;
    for (const p of games) {
      const [ws, bs] = gameScores(p);
      if (p.white === A) {
        a += ws;
        b += bs;
      } else {
        b += ws;
        a += bs;
      }
    }
    return [a, b];
  };
  const classical = all.filter((p) => !p.tiebreakOf && !p.armageddon);
  const rapid = all.filter((p) => p.tiebreakOf && !p.armageddon);
  const arm = all.find((p) => p.armageddon);
  const colourFor = (k: number): [EntrantId, EntrantId] => (k % 2 === 0 ? [A, B] : [B, A]);

  const [ca, cb] = scoreOf(classical);
  if (ca > G / 2) return finish(t, A, B);
  if (cb > G / 2) return finish(t, B, A);
  if (classical.length < G) {
    const [w, b] = colourFor(total);
    t.rounds.push([newPairing(t, r, w, b, { game: total + 1 })]);
    return;
  }
  const [ra, rb] = scoreOf(rapid);
  if (ra > 1) return finish(t, A, B);
  if (rb > 1) return finish(t, B, A);
  const lastClassical = classical[classical.length - 1];
  if (rapid.length < 2) {
    const [w, b] = colourFor(total);
    t.rounds.push([newPairing(t, r, w, b, { game: total + 1, tiebreakOf: lastClassical.id })]);
    return;
  }
  if (arm) {
    const o = matchOutcome(arm)!;
    const w = o === 'white' ? arm.white : arm.black!;
    return finish(t, w, w === A ? B : A);
  }
  const lastRapid = rapid[rapid.length - 1];
  // Armageddon: the top seed has white, black has draw odds.
  t.rounds.push([newPairing(t, r, A, B, { game: total + 1, tiebreakOf: lastRapid.id, armageddon: true })]);
}

// ---------------------------------------------------------------------------
// Standings
// ---------------------------------------------------------------------------

/** [white score, black score] of a finished game (forfeits respected). */
export function gameScores(p: Pairing): [number, number] {
  if (p.result === null) return [0, 0];
  if (p.black === null) return [p.result, 0];
  if (p.forfeit === 'both') return [0, 0];
  return [p.result, 1 - p.result];
}

export function standings(t: TournamentState): StandingRow[] {
  const idx = seedIndex(t);
  const rows: Record<EntrantId, StandingRow> = {};
  for (const e of t.entrants)
    rows[e] = { id: e, points: 0, wins: 0, draws: 0, losses: 0, byes: 0, buchholz: 0, sonnebornBerger: 0, place: 0 };
  const games: Pairing[] = [];
  for (const round of t.rounds)
    for (const p of round) {
      if (p.result === null) continue;
      if (p.black === null) {
        rows[p.white].byes++;
        if (t.format === 'swiss') rows[p.white].points += p.result;
        continue;
      }
      games.push(p);
      const [ws, bs] = gameScores(p);
      const tally = (row: StandingRow, s: number) => {
        row.points += s;
        if (s === 1) row.wins++;
        else if (s === 0.5) row.draws++;
        else row.losses++;
      };
      tally(rows[p.white], ws);
      tally(rows[p.black], bs);
    }
  for (const p of games) {
    const [ws, bs] = gameScores(p);
    const w = rows[p.white];
    const b = rows[p.black!];
    w.buchholz += b.points;
    b.buchholz += w.points;
    w.sonnebornBerger += ws * b.points;
    b.sonnebornBerger += bs * w.points;
  }
  let list = Object.values(rows);

  if (isElim(t.format)) {
    for (const r of list) r.eliminated = t.eliminatedAt[r.id] !== undefined || isWithdrawn(t, r.id);
    const rank = (r: StandingRow) => (r.id === t.winner ? 0 : r.id === t.runnerUp ? 1 : 2);
    list.sort(
      (a, b) =>
        rank(a) - rank(b) ||
        Number(!!a.eliminated) - Number(!!b.eliminated) ||
        (t.eliminatedAt[b.id] ?? Infinity) - (t.eliminatedAt[a.id] ?? Infinity) ||
        b.points - a.points ||
        idx[a.id] - idx[b.id],
    );
  } else if (t.format === 'swiss') {
    list.sort(
      (a, b) =>
        b.points - a.points ||
        b.buchholz - a.buchholz ||
        b.sonnebornBerger - a.sonnebornBerger ||
        b.wins - a.wins ||
        idx[a.id] - idx[b.id],
    );
  } else if (t.format === 'match-series') {
    const rank = (r: StandingRow) => (r.id === t.winner ? 0 : 1);
    list.sort((a, b) => rank(a) - rank(b) || b.points - a.points || idx[a.id] - idx[b.id]);
  } else {
    // Round robin / league: points, Sonneborn-Berger, head-to-head, wins, seed.
    list.sort((a, b) => b.points - a.points || b.sonnebornBerger - a.sonnebornBerger);
    const out: StandingRow[] = [];
    for (let i = 0; i < list.length; ) {
      let j = i + 1;
      while (j < list.length && list[j].points === list[i].points && list[j].sonnebornBerger === list[i].sonnebornBerger)
        j++;
      const group = list.slice(i, j);
      if (group.length > 1) {
        const ids = new Set(group.map((g) => g.id));
        const h2h: Record<EntrantId, number> = {};
        for (const g of group) h2h[g.id] = 0;
        for (const p of games) {
          if (!ids.has(p.white) || !ids.has(p.black!)) continue;
          const [ws, bs] = gameScores(p);
          h2h[p.white] += ws;
          h2h[p.black!] += bs;
        }
        group.sort((a, b) => h2h[b.id] - h2h[a.id] || b.wins - a.wins || idx[a.id] - idx[b.id]);
      }
      out.push(...group);
      i = j;
    }
    list = out;
  }
  list.forEach((r, i) => (r.place = i + 1));
  return list;
}

// ---------------------------------------------------------------------------
// Descriptions
// ---------------------------------------------------------------------------

export function totalRoundsEstimate(t: TournamentState): number {
  if (t.complete) return t.rounds.length;
  const n = t.entrants.length;
  let est: number;
  switch (t.format) {
    case 'single-elim':
      est = Math.log2(nextPow2(n));
      break;
    case 'double-elim':
      est = 2 * Math.log2(nextPow2(n)) + 1;
      break;
    case 'swiss':
      est = t.config.rounds ?? 0;
      break;
    case 'round-robin':
    case 'league':
      est = t.schedule.length;
      break;
    case 'match-series':
      est = t.config.matchGames ?? 6;
      break;
  }
  return Math.max(est, t.rounds.length);
}

const FORMAT_LABEL: Record<Format, string> = {
  'single-elim': 'Single elimination',
  'double-elim': 'Double elimination',
  swiss: 'Swiss',
  'round-robin': 'Round robin',
  league: 'League',
  'match-series': 'Match',
};

/**
 * Short human label, e.g. "Swiss · 5 rounds". Pass a tournament (or explicit
 * round/game counts) to include the length.
 */
export function describeFormat(f: Format, detail?: TournamentState | { rounds?: number; matchGames?: number }): string {
  const label = FORMAT_LABEL[f];
  if (!detail) return label;
  if (f === 'match-series') {
    const g = 'format' in detail ? detail.config.matchGames : detail.matchGames;
    return g ? `${label} · ${g} games` : label;
  }
  const rounds = 'format' in detail ? totalRoundsEstimate(detail) : detail.rounds;
  if (!rounds) return label;
  return `${label} · ${rounds} round${rounds === 1 ? '' : 's'}`;
}
