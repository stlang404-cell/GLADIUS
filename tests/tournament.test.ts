import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import {
  createTournament,
  pendingPairings,
  recordResult,
  standings,
  withdraw,
  matchOutcome,
  totalRoundsEstimate,
  describeFormat,
  bracketSeedOrder,
  type Format,
  type TournamentState,
  type Pairing,
} from '../src/tournament/formats';

function field(n: number): { ids: string[]; ratings: Record<string, number> } {
  const ids: string[] = [];
  const ratings: Record<string, number> = {};
  for (let i = 1; i <= n; i++) {
    const id = `s${String(i).padStart(2, '0')}`;
    ids.push(id);
    ratings[id] = 2800 - i * 10; // s01 strongest
  }
  // Shuffle insertion order to prove seeding sorts by rating.
  return { ids: [...ids].reverse(), ratings };
}

function playAll(t: TournamentState, scorer: (p: Pairing) => number, maxSteps = 5000): TournamentState {
  let steps = 0;
  while (!t.complete) {
    const pend = pendingPairings(t);
    expect(pend.length).toBeGreaterThan(0);
    for (const p of pend) recordResult(t, p.id, scorer(p));
    if (++steps > maxSteps) throw new Error('did not finish');
  }
  return t;
}

const allPairings = (t: TournamentState) => t.rounds.flat();
const higherSeedWins = (t: TournamentState) => (p: Pairing) =>
  t.entrants.indexOf(p.white) < t.entrants.indexOf(p.black!) ? 1 : 0;

describe('seeding', () => {
  it('seed order recursion', () => {
    expect(bracketSeedOrder(8)).toEqual([0, 7, 3, 4, 1, 6, 2, 5]);
  });

  it('single-elim 8 players: 1v8, 4v5, 2v7, 3v6', () => {
    const { ids, ratings } = field(8);
    const t = createTournament('single-elim', ids, ratings);
    expect(t.entrants).toEqual(['s01', 's02', 's03', 's04', 's05', 's06', 's07', 's08']);
    const pairs = t.rounds[0].map((p) => [p.white, p.black].sort());
    expect(pairs).toEqual([
      ['s01', 's08'],
      ['s04', 's05'],
      ['s02', 's07'],
      ['s03', 's06'],
    ]);
    expect(pendingPairings(t)).toHaveLength(4);
  });

  it('single-elim 13 players: byes to top 3 seeds, top seeds meet late', () => {
    const { ids, ratings } = field(13);
    const t = createTournament('single-elim', ids, ratings);
    const byes = t.rounds[0].filter((p) => p.black === null).map((p) => p.white);
    expect(byes.sort()).toEqual(['s01', 's02', 's03']);
    expect(t.rounds[0].filter((p) => p.black === null).every((p) => p.result === 1)).toBe(true);
    expect(pendingPairings(t)).toHaveLength(5);
    // Higher seed always wins -> semis 1v4, 2v3; final 1v2.
    playAll(t, higherSeedWins(t));
    expect(t.winner).toBe('s01');
    expect(t.runnerUp).toBe('s02');
    const semis = t.rounds[2].map((p) => [p.white, p.black].sort());
    expect(semis).toEqual([
      ['s01', 's04'],
      ['s02', 's03'],
    ]);
    expect(t.rounds).toHaveLength(4);
    const st = standings(t);
    expect(st[0].id).toBe('s01');
    expect(st[1].id).toBe('s02');
    expect(st.slice(2).every((r) => r.eliminated)).toBe(true);
  });
});

describe('tiebreaks', () => {
  it('draw spawns reversed-colour tiebreak, then armageddon', () => {
    const { ids, ratings } = field(2);
    const t = createTournament('single-elim', ids, ratings);
    const [g1] = pendingPairings(t);
    recordResult(t, g1.id, 0.5);
    const [g2] = pendingPairings(t);
    expect(g2.tiebreakOf).toBe(g1.id);
    expect(g2.white).toBe(g1.black);
    expect(g2.black).toBe(g1.white);
    expect(g2.round).toBe(0);
    expect(g2.armageddon).toBeFalsy();
    recordResult(t, g2.id, 0.5);
    const [g3] = pendingPairings(t);
    expect(g3.armageddon).toBe(true);
    expect(g3.tiebreakOf).toBe(g2.id);
    expect(matchOutcome({ ...g3, result: 0.5 })).toBe('black');
    recordResult(t, g3.id, 0.5);
    expect(t.complete).toBe(true);
    expect(t.winner).toBe(g3.black);
    expect(t.runnerUp).toBe(g3.white);
  });

  it('matchOutcome basics', () => {
    const p: Pairing = { id: 'x', round: 0, white: 'a', black: 'b', result: null };
    expect(matchOutcome(p)).toBeNull();
    expect(matchOutcome({ ...p, result: 1 })).toBe('white');
    expect(matchOutcome({ ...p, result: 0 })).toBe('black');
    expect(matchOutcome({ ...p, result: 0.5 })).toBe('draw');
    expect(matchOutcome({ ...p, black: null, result: 1 })).toBe('white');
  });

  it('validates results', () => {
    const { ids, ratings } = field(4);
    const t = createTournament('single-elim', ids, ratings);
    const [p] = pendingPairings(t);
    expect(() => recordResult(t, p.id, 0.7)).toThrow();
    expect(() => recordResult(t, 'nope', 1)).toThrow();
    recordResult(t, p.id, 1);
    expect(() => recordResult(t, p.id, 1)).toThrow();
  });
});

describe('double elimination', () => {
  for (const n of [2, 3, 5, 8, 13, 16]) {
    it(`loss counts are sane for n=${n}`, () => {
      const { ids, ratings } = field(n);
      const t = createTournament('double-elim', ids, ratings);
      const rng = createRng(1000 + n);
      playAll(t, () => rng.pick([1, 0, 0.5]));
      expect(t.winner).not.toBeNull();
      const reset = allPairings(t).some((p) => p.bracket === 'GF2');
      for (const e of t.entrants) {
        if (e === t.winner) expect(t.losses[e]).toBeLessThanOrEqual(1);
        else expect(t.losses[e]).toBe(2);
      }
      if (!reset) expect(t.losses[t.winner!]).toBe(0);
    });
  }

  it('grand final reset when LB champion wins', () => {
    const { ids, ratings } = field(4);
    const t = createTournament('double-elim', ids, ratings);
    // Top seed always wins until grand final, then loses the GF, then wins GF2.
    let gfLost = false;
    playAll(t, (p) => {
      if (p.bracket === 'GF') {
        gfLost = true;
        return p.white === 's01' ? 0 : 1;
      }
      return higherSeedWins(t)(p);
    });
    expect(gfLost).toBe(true);
    const gf2 = allPairings(t).filter((p) => p.bracket === 'GF2');
    expect(gf2).toHaveLength(1);
    expect(t.winner).toBe('s01');
    expect(t.runnerUp).toBe('s02');
    expect(t.losses['s01']).toBe(1);
    expect(t.losses['s02']).toBe(2);
  });

  it('no reset when WB champion wins the grand final', () => {
    const { ids, ratings } = field(4);
    const t = createTournament('double-elim', ids, ratings);
    playAll(t, higherSeedWins(t));
    expect(allPairings(t).some((p) => p.bracket === 'GF')).toBe(true);
    expect(allPairings(t).some((p) => p.bracket === 'GF2')).toBe(false);
    expect(t.winner).toBe('s01');
    expect(t.runnerUp).toBe('s02');
  });
});

describe('swiss', () => {
  it('default rounds', () => {
    expect(createTournament('swiss', field(16).ids, field(16).ratings).config.rounds).toBe(5);
    expect(createTournament('swiss', field(4).ids, field(4).ratings).config.rounds).toBe(3);
    expect(createTournament('swiss', field(7).ids, field(7).ratings).config.rounds).toBe(4);
  });

  for (const seed of [1, 2, 3, 4, 5]) {
    it(`16 players 5 rounds: no rematches, colour balance (seed ${seed})`, () => {
      const { ids, ratings } = field(16);
      const t = createTournament('swiss', ids, ratings, { rounds: 5 });
      const rng = createRng(seed);
      playAll(t, () => rng.pick([1, 0, 0.5, 1, 0]));
      expect(t.rounds).toHaveLength(5);
      const seen = new Set<string>();
      const diff: Record<string, number> = {};
      for (const p of allPairings(t)) {
        if (p.black === null) continue;
        const k = [p.white, p.black].sort().join('|');
        expect(seen.has(k)).toBe(false);
        seen.add(k);
        diff[p.white] = (diff[p.white] ?? 0) + 1;
        diff[p.black] = (diff[p.black] ?? 0) - 1;
      }
      for (const v of Object.values(diff)) expect(Math.abs(v)).toBeLessThanOrEqual(2);
      expect(t.winner).toBe(standings(t)[0].id);
    });
  }

  it('7 players: at most one bye each, bye worth 1 point', () => {
    const { ids, ratings } = field(7);
    const t = createTournament('swiss', ids, ratings, { rounds: 6 });
    const rng = createRng(77);
    playAll(t, () => rng.pick([1, 0, 0.5]));
    const byes: Record<string, number> = {};
    for (const p of allPairings(t)) if (p.black === null) byes[p.white] = (byes[p.white] ?? 0) + 1;
    expect(Object.values(byes).reduce((a, b) => a + b, 0)).toBe(6);
    for (const v of Object.values(byes)) expect(v).toBe(1);
    const st = standings(t);
    const total = st.reduce((a, r) => a + r.points, 0);
    expect(total).toBe(6 * 3 + 6); // 3 games/round + 1 bye point/round
    for (const r of st) expect(r.byes).toBeLessThanOrEqual(1);
  });

  it('first-round bye goes to the lowest seed', () => {
    const { ids, ratings } = field(7);
    const t = createTournament('swiss', ids, ratings);
    const bye = t.rounds[0].find((p) => p.black === null)!;
    expect(bye.white).toBe('s07');
    // Round 1: top half vs bottom half.
    const pairs = t.rounds[0].filter((p) => p.black).map((p) => [p.white, p.black].sort());
    expect(pairs).toEqual([
      ['s01', 's04'],
      ['s02', 's05'],
      ['s03', 's06'],
    ]);
  });

  it('standings sorted with buchholz tiebreak fields', () => {
    const { ids, ratings } = field(8);
    const t = createTournament('swiss', ids, ratings);
    playAll(t, higherSeedWins(t));
    const st = standings(t);
    expect(st[0].id).toBe('s01');
    expect(st[0].points).toBe(4);
    for (let i = 1; i < st.length; i++) {
      expect(st[i - 1].points).toBeGreaterThanOrEqual(st[i].points);
      expect(st[i].place).toBe(i + 1);
    }
    expect(st.some((r) => r.buchholz > 0)).toBe(true);
  });
});

describe('round robin & league', () => {
  for (const n of [5, 6, 8]) {
    it(`round-robin n=${n}: each pair meets exactly once`, () => {
      const { ids, ratings } = field(n);
      const t = createTournament('round-robin', ids, ratings);
      const rng = createRng(n);
      playAll(t, () => rng.pick([1, 0, 0.5]));
      expect(t.rounds).toHaveLength(n % 2 ? n : n - 1);
      const count: Record<string, number> = {};
      for (const p of allPairings(t)) {
        if (!p.black) continue;
        const k = [p.white, p.black].sort().join('|');
        count[k] = (count[k] ?? 0) + 1;
      }
      expect(Object.keys(count)).toHaveLength((n * (n - 1)) / 2);
      expect(Object.values(count).every((c) => c === 1)).toBe(true);
      // Byes: each player exactly one for odd n.
      const byes = allPairings(t).filter((p) => !p.black);
      expect(byes).toHaveLength(n % 2 ? n : 0);
      // Colour balance within 1 for even n... allow 2 generally.
      const diff: Record<string, number> = {};
      for (const p of allPairings(t)) {
        if (!p.black) continue;
        diff[p.white] = (diff[p.white] ?? 0) + 1;
        diff[p.black] = (diff[p.black] ?? 0) - 1;
      }
      for (const v of Object.values(diff)) expect(Math.abs(v)).toBeLessThanOrEqual(2);
    });

    it(`league n=${n}: each pair meets twice with swapped colours`, () => {
      const { ids, ratings } = field(n);
      const t = createTournament('league', ids, ratings);
      const rng = createRng(100 + n);
      playAll(t, () => rng.pick([1, 0, 0.5]));
      expect(t.rounds).toHaveLength(2 * (n % 2 ? n : n - 1));
      const meet: Record<string, string[]> = {};
      for (const p of allPairings(t)) {
        if (!p.black) continue;
        const k = [p.white, p.black].sort().join('|');
        (meet[k] ??= []).push(p.white);
      }
      expect(Object.keys(meet)).toHaveLength((n * (n - 1)) / 2);
      for (const whites of Object.values(meet)) {
        expect(whites).toHaveLength(2);
        expect(whites[0]).not.toBe(whites[1]);
      }
    });
  }

  it('tiebreak: Sonneborn-Berger orders equal points', () => {
    const { ids, ratings } = field(4);
    const t = createTournament('round-robin', ids, ratings);
    playAll(t, higherSeedWins(t));
    const st = standings(t);
    expect(st.map((r) => r.id)).toEqual(['s01', 's02', 's03', 's04']);
    expect(st.map((r) => r.points)).toEqual([3, 2, 1, 0]);
    expect(t.winner).toBe('s01');
    expect(t.runnerUp).toBe('s02');
  });
});

describe('match series', () => {
  it('ends early when someone passes half', () => {
    const t = createTournament('match-series', ['a', 'b'], { a: 2000, b: 2100 });
    expect(t.entrants).toEqual(['b', 'a']);
    playAll(t, (p) => (p.white === 'b' ? 1 : 0));
    expect(t.complete).toBe(true);
    expect(t.winner).toBe('b');
    expect(t.runnerUp).toBe('a');
    expect(t.rounds).toHaveLength(4); // 4-0 > 3
    const games = allPairings(t);
    expect(games.map((g) => g.white)).toEqual(['b', 'a', 'b', 'a']);
    expect(games.map((g) => g.game)).toEqual([1, 2, 3, 4]);
  });

  it('tied match goes to rapid tiebreaks then armageddon', () => {
    const t = createTournament('match-series', ['a', 'b'], { a: 2000, b: 2100 }, { matchGames: 4 });
    playAll(t, () => 0.5);
    const games = allPairings(t);
    expect(games).toHaveLength(7);
    expect(games.slice(4, 6).every((g) => g.tiebreakOf && !g.armageddon)).toBe(true);
    const arm = games[6];
    expect(arm.armageddon).toBe(true);
    expect(t.winner).toBe(arm.black);
  });

  it('rapid tiebreak can decide', () => {
    const t = createTournament('match-series', ['a', 'b'], { a: 2000, b: 2100 }, { matchGames: 2 });
    playAll(t, (p) => (p.tiebreakOf ? (p.white === 'a' ? 1 : 0.5) : 0.5));
    expect(t.winner).toBe('a');
    expect(allPairings(t).some((p) => p.armageddon)).toBe(false);
  });

  it('describe and estimates', () => {
    const t = createTournament('match-series', ['a', 'b'], { a: 1, b: 2 });
    expect(describeFormat('match-series', t)).toBe('Match · 6 games');
    expect(totalRoundsEstimate(t)).toBe(6);
    const s = createTournament('swiss', field(16).ids, field(16).ratings);
    expect(describeFormat('swiss', s)).toBe('Swiss · 5 rounds');
    expect(describeFormat('swiss', { rounds: 7 })).toBe('Swiss · 7 rounds');
    expect(describeFormat('league')).toBe('League');
    expect(totalRoundsEstimate(createTournament('single-elim', field(13).ids, field(13).ratings))).toBe(4);
    expect(totalRoundsEstimate(createTournament('round-robin', field(5).ids, field(5).ratings))).toBe(5);
    expect(totalRoundsEstimate(createTournament('league', field(6).ids, field(6).ratings))).toBe(10);
  });

  it('requires exactly two entrants', () => {
    expect(() => createTournament('match-series', ['a', 'b', 'c'], {})).toThrow();
  });
});

describe('withdrawal', () => {
  it('round robin: future games forfeited to the opponent', () => {
    const { ids, ratings } = field(6);
    const t = createTournament('round-robin', ids, ratings);
    for (const p of pendingPairings(t)) recordResult(t, p.id, 0.5);
    withdraw(t, 's03');
    playAll(t, () => 0.5);
    const games = allPairings(t).filter((p) => p.black && (p.white === 's03' || p.black === 's03'));
    expect(games).toHaveLength(5);
    const forfeits = games.filter((g) => g.forfeit);
    expect(forfeits).toHaveLength(4);
    for (const g of forfeits) expect(g.white === 's03' ? g.result : 1 - g.result!).toBe(0);
    const st = standings(t);
    expect(st.find((r) => r.id === 's03')!.points).toBe(0.5);
  });

  it('swiss: withdrawn player is not paired again and pending game is forfeited', () => {
    const { ids, ratings } = field(8);
    const t = createTournament('swiss', ids, ratings);
    const p = pendingPairings(t).find((x) => x.white === 's01' || x.black === 's01')!;
    withdraw(t, 's01');
    expect(p.result).toBe(p.white === 's01' ? 0 : 1);
    playAll(t, () => 1);
    for (const r of t.rounds.slice(1))
      for (const q of r) expect(q.white === 's01' || q.black === 's01').toBe(false);
    expect(t.winner).not.toBe('s01');
  });

  it('single-elim: opponent advances; withdrawn winner gives next opponent a walkover', () => {
    const { ids, ratings } = field(8);
    const t = createTournament('single-elim', ids, ratings);
    withdraw(t, 's08');
    expect(pendingPairings(t)).toHaveLength(3);
    // s04 wins its game then withdraws before round 2.
    for (const p of pendingPairings(t)) recordResult(t, p.id, higherSeedWins(t)(p));
    expect(t.rounds).toHaveLength(2);
    withdraw(t, 's04');
    playAll(t, higherSeedWins(t));
    expect(t.winner).toBe('s01');
    expect(t.runnerUp).toBe('s02');
  });

  it('double-elim: withdrawal mid-event still completes', () => {
    const { ids, ratings } = field(8);
    const t = createTournament('double-elim', ids, ratings);
    for (const p of pendingPairings(t)) recordResult(t, p.id, higherSeedWins(t)(p));
    withdraw(t, 's01');
    withdraw(t, 's08');
    playAll(t, higherSeedWins(t));
    expect(t.winner).toBe('s02');
    for (const e of t.entrants) expect(t.losses[e]).toBeLessThanOrEqual(2);
  });

  it('match-series: withdrawal ends the match', () => {
    const t = createTournament('match-series', ['a', 'b'], { a: 1, b: 2 });
    withdraw(t, 'b');
    expect(t.complete).toBe(true);
    expect(t.winner).toBe('a');
  });
});

describe('persistence', () => {
  const formats: Format[] = ['single-elim', 'double-elim', 'swiss', 'round-robin', 'league', 'match-series'];
  for (const f of formats) {
    it(`${f}: JSON round-trip mid-tournament continues identically`, () => {
      const n = f === 'match-series' ? 2 : 9;
      const { ids, ratings } = field(n);
      const a = createTournament(f, ids, ratings);
      const rng1 = createRng(5);
      // play two batches
      for (let k = 0; k < 2 && !a.complete; k++)
        for (const p of pendingPairings(a)) recordResult(a, p.id, rng1.pick([1, 0, 0.5]));
      const b: TournamentState = JSON.parse(JSON.stringify(a));
      expect(b).toEqual(a);
      const rng2 = createRng(9);
      const rng3 = createRng(9);
      playAll(a, () => rng2.pick([1, 0, 0.5]));
      playAll(b, () => rng3.pick([1, 0, 0.5]));
      expect(JSON.parse(JSON.stringify(b))).toEqual(JSON.parse(JSON.stringify(a)));
      expect(b.winner).toBe(a.winner);
    });
  }
});

describe('fuzz', () => {
  const formats: Format[] = ['single-elim', 'double-elim', 'swiss', 'round-robin', 'league', 'match-series'];
  const sizes = [2, 3, 5, 8, 13, 16, 32];
  for (const f of formats) {
    for (const n of f === 'match-series' ? [2] : sizes) {
      for (const seed of [1, 2, 3]) {
        it(`${f} n=${n} seed=${seed}`, () => {
          const { ids, ratings } = field(n);
          const t = createTournament(f, ids, ratings);
          const rng = createRng(seed * 7919 + n);
          playAll(t, () => rng.pick([1, 0, 0.5]));
          expect(t.complete).toBe(true);
          expect(t.winner).not.toBeNull();
          expect(t.entrants).toContain(t.winner);
          if (n > 1) expect(t.runnerUp).not.toBe(t.winner);
          const log = Math.ceil(Math.log2(n));
          const bound: Record<Format, number> = {
            'single-elim': log,
            'double-elim': 3 * log + 3,
            swiss: Math.max(3, log + 1),
            'round-robin': n,
            league: 2 * n,
            'match-series': 6 + 3,
          };
          expect(t.rounds.length).toBeLessThanOrEqual(bound[f]);
          const ids2 = new Set<string>();
          for (const [r, round] of t.rounds.entries()) {
            const seen = new Set<string>();
            for (const p of round) {
              expect(p.round).toBe(r);
              expect(p.result).not.toBeNull();
              expect(ids2.has(p.id)).toBe(false);
              ids2.add(p.id);
              if (p.tiebreakOf) continue;
              for (const x of [p.white, p.black]) {
                if (x === null) continue;
                expect(seen.has(x)).toBe(false);
                seen.add(x);
              }
            }
          }
          const st = standings(t);
          expect(st).toHaveLength(n);
          expect(st.map((r) => r.place)).toEqual(st.map((_, i) => i + 1));
          if (f !== 'round-robin' && f !== 'league' && f !== 'swiss') expect(st[0].id).toBe(t.winner);
          expect(JSON.parse(JSON.stringify(t))).toEqual(t);
        });
      }
    }
  }
});
