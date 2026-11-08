import { describe, it, expect, beforeAll } from 'vitest';
import { createWorld } from '../../src/world/world';
import {
  processTournamentAwards, awardsFor, awardsByDef, awardsByArena, rarityOf, currentOfSeries, isVictory, hasFinal,
  ensureWorldV2, TROPHY_DEFS, trophyCabinet, invalidateAwardIndex, sigDefFor,
} from '../../src/world/trophies';
import { hallOfRecords, recordLeaders, archiveLegends, competitorHonours, competitorPrestige } from '../../src/world/records';
import { createTournament, pendingPairings, recordResult } from '../../src/tournament/formats';
import { ARENAS } from '../../src/world/arenas';
import type { WorldState, WorldTournament } from '../../src/game/state';
import type { Competitor } from '../../src/world/types';

let w: WorldState;
beforeAll(() => {
  w = createWorld(9090, 6);
}, 120000);

/** Minimal world with no population: enough for the award registry. */
function bareWorld(): WorldState {
  const titles = ARENAS.map((a) => ({ id: `title-${a.index}`, arena: a.index, name: `Champion ${a.index}`, holder: null as string | null, since: 0, defenses: 0 }));
  const bw: WorldState = {
    seed: 1, day: 10, competitors: [], nextSerial: 1, chronicle: [], stats: { simGames: 0, retirements: 0, debuts: 0, promotions: 0, calibrations: 0 },
    titles, reigns: [], tournaments: [], invitations: [], season: 0, tournamentSerial: 0, history: [],
  };
  return ensureWorldV2(bw);
}

/** Play a championship match where `winner` wins every game. */
function champ(bw: WorldState, id: string, arena: number, a: string, b: string, winner: string): WorldTournament {
  const st = createTournament('match-series', [a, b], { [a]: 2000, [b]: 1900 }, { matchGames: 4 });
  for (let g = 0; g < 50 && !st.complete; g++) for (const p of pendingPairings(st)) recordResult(st, p.id, p.white === winner ? 1 : 0);
  const t: WorldTournament = {
    id, name: `Champ ${id}`, arena, kind: 'championship', format: 'match-series', season: bw.season, startDay: bw.day, roundEveryDays: 1,
    nextRoundDay: bw.day, status: 'complete', state: st, playerEntered: false, prize: 0, titleId: `title-${arena}`, featured: [], gameIds: {}, size: 2,
  };
  bw.tournaments.push(t);
  return t;
}
/** Run awards and apply the title change the way calendar.finishTournament does. */
function finish(bw: WorldState, t: WorldTournament) {
  const title = bw.titles.find((x) => x.id === t.titleId)!;
  const prev = title.holder;
  const out = processTournamentAwards(bw, t, { nameOf: (x) => String(x), prevHolder: prev, prevDefenses: title.defenses });
  const winner = t.state!.winner!;
  if (prev === winner) {
    title.defenses++;
    bw.reigns.find((r) => r.titleId === title.id && r.to === null)!.defenses++;
  } else {
    const old = bw.reigns.find((r) => r.titleId === title.id && r.to === null);
    if (old) old.to = bw.day;
    title.holder = winner;
    title.defenses = 0;
    bw.reigns.push({ titleId: title.id, holder: winner, holderName: winner, from: bw.day, to: null, defenses: 0 });
  }
  bw.day += 28;
  bw.season++;
  return out;
}

describe('imperial trophy registry', () => {
  it('defines signature trophies for all 24 arenas with stable ids', () => {
    // v0.2 arenas keep sig-<old index>; the 12 v0.3 arenas use sig-a<index>.
    for (const a of ARENAS) expect(TROPHY_DEFS.find((d) => d.id === sigDefFor(a.index))!.name).toBe(a.trophy);
    expect(sigDefFor(23)).toBe('sig-11');
    expect(sigDefFor(6)).toBe('sig-3');
    expect(sigDefFor(1)).toBe('sig-a1');
    expect(new Set(TROPHY_DEFS.map((d) => d.id)).size).toBe(TROPHY_DEFS.length);
  });

  it('awards exactly once per tournament even if processing runs twice', () => {
    const bw = bareWorld();
    const t = champ(bw, 't1', 6, 'A', 'B', 'A'); // the Gladiator's Court (v0.2 arena 3)
    const first = processTournamentAwards(bw, t, { nameOf: String, prevHolder: null });
    expect(first.length).toBeGreaterThan(0);
    const n = bw.awards!.length;
    expect(processTournamentAwards(bw, t, { nameOf: String, prevHolder: null })).toEqual([]);
    t.awarded = false; // even without the guard flag, deterministic ids prevent duplicates
    processTournamentAwards(bw, t, { nameOf: String, prevHolder: null });
    expect(bw.awards!.length).toBe(n);
    expect(new Set(bw.awards!.map((a) => a.awardId)).size).toBe(bw.awards!.length);
    const sig = bw.awards!.filter((a) => a.defId === 'sig-3');
    expect(sig.length).toBe(1);
    expect(sig[0].awardId).toBe('t1:sig-3:A');
    expect(sig[0].result).toBe('3–0'); // a best-of-4 match is decided once one side reaches 3
    expect(sig[0].finalOpponent).toBe('B');
  });

  it('repeat wins are separate awards; defences are honoured; losing the title flips current', () => {
    const bw = bareWorld();
    finish(bw, champ(bw, 'c1', 23, 'A', 'B', 'A')); // A captures
    finish(bw, champ(bw, 'c2', 23, 'A', 'B', 'A')); // A defends (1)
    finish(bw, champ(bw, 'c3', 23, 'A', 'B', 'A')); // defends (2)
    finish(bw, champ(bw, 'c4', 23, 'A', 'B', 'A')); // defends (3) → dynasty
    const sigA = awardsFor(bw, 'A').filter((a) => a.defId === 'sig-11');
    expect(sigA.length).toBe(4);
    expect(new Set(sigA.map((a) => a.awardId)).size).toBe(4);
    expect(awardsFor(bw, 'A').filter((a) => a.defId === 'imperial-crown').length).toBe(4);
    const def = awardsFor(bw, 'A').filter((a) => a.defId === 'defense-t3');
    expect(def.map((a) => a.defenseNumber)).toEqual([1, 2, 3]);
    expect(awardsFor(bw, 'A').some((a) => a.defId === 'hist-dynasty')).toBe(true);
    expect(awardsFor(bw, 'A').filter((a) => a.series === 'title-23').every((a) => a.current)).toBe(true);
    finish(bw, champ(bw, 'c5', 23, 'A', 'B', 'B')); // B dethrones A
    expect(awardsFor(bw, 'A').filter((a) => a.series === 'title-23').every((a) => !a.current)).toBe(true);
    expect(awardsFor(bw, 'A').length).toBeGreaterThan(8); // nothing deleted
    const cur = currentOfSeries(bw, 'title-23');
    expect(new Set(cur.map((a) => a.holder))).toEqual(new Set(['B']));
    finish(bw, champ(bw, 'c6', 23, 'A', 'B', 'A')); // A regains → comeback feat
    expect(awardsFor(bw, 'A').some((a) => a.defId === 'hist-comeback')).toBe(true);
    expect(new Set(currentOfSeries(bw, 'title-23').map((a) => a.holder))).toEqual(new Set(['A']));
    // Finalist medals for the loser of each match.
    expect(awardsByDef(bw, 'medal-t3').length).toBe(6);
    expect(rarityOf(bw, 'sig-11')!.count).toBe(6);
    expect(rarityOf(bw, 'sig-11')!.holders).toBe(2);
  });

  it('AI awards in a simulated world are consistent with history and titles', () => {
    const ids = new Set<string>();
    for (const a of w.awards!) {
      expect(ids.has(a.awardId)).toBe(false);
      ids.add(a.awardId);
    }
    // One winner award per completed event with a winner; medals only where there was a final.
    for (const h of w.history) {
      const mine = w.awards!.filter((a) => a.tournamentId === h.id);
      const winners = mine.filter(isVictory);
      if (h.winner) {
        expect(winners.length).toBe(1);
        expect(winners[0].holder).toBe(h.winner);
        expect(winners[0].holderName).toBe(h.winnerName);
      } else expect(winners.length).toBe(0);
      expect(mine.filter((a) => a.defId.startsWith('medal-') || a.defId === 'rmedal').length).toBe(h.winner && h.runnerUp && hasFinal(h.kind, h.format) ? 1 : 0);
    }
    // Current title series agree with the title table.
    for (const t of w.titles) {
      const cur = new Set(currentOfSeries(w, `title-${t.arena}`).map((a) => a.holder));
      if (t.holder) expect(cur).toEqual(new Set([t.holder]));
    }
    // Every edition series has at most one current award.
    const series = new Map<string, number>();
    for (const a of w.awards!) if (a.current && a.series && !a.series.startsWith('title-') && !a.series.startsWith('crown-')) series.set(a.series, (series.get(a.series) ?? 0) + 1);
    for (const n of series.values()) expect(n).toBe(1);
    // Competitor tournament wins == victories in the registry (world started at zero).
    for (const c of w.competitors) expect(awardsFor(w, c.id).filter(isVictory).length).toBe(c.tournamentsWon);
    // Season laurels: at most one per season and arena.
    const laurels = w.awards!.filter((a) => a.defId.startsWith('laurel-'));
    expect(laurels.length).toBeGreaterThan(12 * 3);
    expect(new Set(laurels.map((a) => a.tournamentId)).size).toBe(laurels.length);
    expect(awardsByArena(w, 23).length).toBeGreaterThan(0);
  });

  it('profiles show real trophies; prestige derives from them', () => {
    const champion = w.titles.find((t) => t.holder)!.holder!;
    const h = competitorHonours(w, champion)!;
    expect(h.championships).toBeGreaterThan(0);
    expect(h.currentTitles.length).toBeGreaterThan(0);
    expect(trophyCabinet(w, champion).length).toBeGreaterThan(0);
    const c = w.competitors.find((x) => x.id === champion)!;
    const nobody = w.competitors.find((x) => awardsFor(w, x.id).length === 0 && x.titles.length === 0 && x.peak < 1200)!;
    expect(competitorPrestige(w, c)).toBeGreaterThan(competitorPrestige(w, nobody));
  });

  it('chronicle career-arc entries come from real events', () => {
    for (const e of w.chronicle) {
      if (e.tag === 'new-champion' || e.tag === 'comeback' || e.tag === 'elite-upset') {
        expect(w.awards!.some((a) => a.defId.startsWith('sig-') && a.holder === e.ids![0] && a.day === e.day)).toBe(true);
      }
      if (e.tag === 'retirement') {
        const c = w.competitors.find((x) => x.id === e.ids![0]) ?? w.hall!.legends.find((x) => x.id === e.ids![0]);
        if (c) expect(c.retiredDay).toBe(e.day);
      }
      if (e.tag === 'prodigy') expect(w.competitors.find((x) => x.id === e.ids![0])?.arc?.prodigy).toBe(e.day);
    }
  });

  it('records include retired/pruned competitors and survive pruning', () => {
    const hall = { legends: [], rivalries: [], best: {} } as NonNullable<WorldState['hall']>;
    const mk = (i: number, peak: number): Competitor => ({ ...w.competitors[0], id: `x${i}`, name: `X${i}`, peak, retiredDay: 5, titles: [] });
    archiveLegends(hall, Array.from({ length: 300 }, (_, i) => mk(i, 1000 + i)));
    expect(hall.legends.length).toBeLessThan(300);
    expect(hall.legends.some((l) => l.id === 'x299')).toBe(true);
    const bw = { ...w, hall, competitors: w.competitors.filter((c) => c.peak < 1250) } as WorldState;
    expect(recordLeaders(bw, 'peak-elo', 1)[0].holder).toBe('x299');
    expect(recordLeaders(bw, 'peak-elo', 1)[0].retired).toBe(true);
    const all = hallOfRecords(w, 5);
    expect(all.championships.length).toBeGreaterThan(0);
    expect(all['peak-elo'][0].value).toBeGreaterThan(2500);
    expect(all.rivalries[0].value).toBeGreaterThan(5);
  });

  it('title holders are auto-seeded first (championship privilege)', () => {
    const st = createTournament('single-elim', ['a', 'b', 'c', 'd'], { a: 2000, b: 1900, c: 1800, d: 1500 }, { topSeeds: ['d'] });
    expect(st.entrants).toEqual(['d', 'a', 'b', 'c']);
    // Holders in the simulated world are seeded first in the events they enter.
    for (const t of w.tournaments) {
      if (!t.state || t.format === 'match-series') continue;
      // Arena title holders are seeded first everywhere; regional crown holders in their region's events.
      const regional = t.kind === 'local-open' || t.kind === 'regional';
      const holders = [...w.titles, ...(regional ? (w.regionTitles ?? []) : [])].filter((x) => x.holder && x.since < t.startDay && t.state!.entrants.includes(x.holder)).map((x) => x.holder!);
      if (holders.length) expect(holders).toContain(t.state.entrants[0]);
    }
  });

  it('ensureWorldV2 backfills an old world from its history without duplicates', () => {
    const old = JSON.parse(JSON.stringify(w)) as WorldState;
    delete old.awards;
    delete old.hall;
    delete old.seasonTally;
    delete old.worldVersion;
    ensureWorldV2(old);
    expect(old.awards!.length).toBeGreaterThan(0);
    expect(old.awards!.every((a) => a.backfilled)).toBe(true);
    for (const h of old.history) if (h.winner) expect(old.awards!.filter((a) => a.tournamentId === h.id && isVictory(a)).length).toBe(1);
    for (const t of old.titles) if (t.holder && old.history.some((h) => h.kind === 'championship' && h.arena === t.arena)) {
      expect(new Set(currentOfSeries(old, `title-${t.arena}`).map((a) => a.holder))).toEqual(new Set([t.holder]));
    }
    const n = old.awards!.length;
    invalidateAwardIndex(old);
    ensureWorldV2(old);
    expect(old.awards!.length).toBe(n);
  });
});
