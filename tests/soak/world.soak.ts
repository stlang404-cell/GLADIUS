/**
 * Multi-season soak test (`npm run soak`): a simulated career inside a living
 * empire for ≥ 50 in-world seasons, checking the trophy / records / chronicle
 * invariants every season. Not part of `npm test`.
 */
import { describe, it, expect } from 'vitest';
import { createWorld } from '../../src/world/world';
import { createRng, mixSeed } from '../../src/core/rng';
import { expectedScore } from '../../src/rating/elo';
import {
  newSave, startGame, finishPlayerGame, restDays, suggestOpponents, playerTournamentGame, acceptTournament,
} from '../../src/game/career';
import { awardsFor, currentOfSeries, isVictory, hasFinal } from '../../src/world/trophies';
import { recordLeaders, type RecordKey } from '../../src/world/records';
import { objectives, legacyTimeline } from '../../src/game/legacy';
import { ACHIEVEMENTS } from '../../src/game/achievements';
import type { Save } from '../../src/game/state';
import type { Competitor } from '../../src/world/types';

const SEASONS = Number(process.env.SOAK_SEASONS ?? 50);
const PLAYER_SKILL = 1750;

function playOne(s: Save, opp: Competitor, kind: 'ranked' | 'tournament', extra: { tournamentId?: string; pairingId?: string; color?: 'w' | 'b' } = {}) {
  const rng = createRng(mixSeed('soak', s.world.day, s.library.length, opp.id));
  const rec = startGame(s, opp, { kind, tcId: 'rapid-10', ...extra });
  const e = expectedScore(PLAYER_SKILL, opp.skill);
  const r = rng.next();
  const score = r < e - 0.1 ? 1 : r < e + 0.1 ? 0.5 : 0;
  rec.result = score === 0.5 ? '1/2-1/2' : (score === 1) === (rec.playerColor === 'w') ? '1-0' : '0-1';
  rec.termination = score === 0.5 ? 'agreement' : 'resignation';
  rec.moves = Array.from({ length: 40 + Math.floor(rng.next() * 60) }, (_, i) => (i % 2 ? 'e7e5' : 'e2e4'));
  rec.opening = rng.chance(0.5) ? { eco: 'C50', name: 'Italian Game' } : { eco: 'D06', name: "Queen's Gambit" };
  s.active = null;
  s.library.push(rec.id);
  finishPlayerGame(s, rec);
}

describe('soak: 50+ seasons of a living empire with a player career', () => {
  it('keeps every trophy / record / chronicle invariant', () => {
    const t0 = performance.now();
    const s = newSave(createWorld(20260, 4), 'Soak', false, 1200);
    const w = s.world;
    const seenHistory = new Set<string>();
    const seenAwards = new Set<string>();
    let completed = 0;
    let winnerAwards = 0;
    let medals = 0;
    const tracked: RecordKey[] = ['championships', 'tournament-wins', 'longest-reign', 'consecutive-defenses', 'peak-elo'];
    const best: Record<string, number> = {};
    const startSeason = w.season;

    const checkSeason = () => {
      // New completed tournaments since the last check.
      for (const h of w.history) {
        if (seenHistory.has(h.id)) continue;
        seenHistory.add(h.id);
        completed++;
        const mine = w.awards!.filter((a) => a.tournamentId === h.id);
        const win = mine.filter(isVictory);
        expect(win.length).toBe(h.winner ? 1 : 0);
        if (h.winner) expect(win[0].holder).toBe(h.winner);
        const md = mine.filter((a) => a.defId.startsWith('medal-')).length;
        expect(md).toBe(h.winner && h.runnerUp && hasFinal(h.kind) ? 1 : 0);
        winnerAwards += win.length;
        medals += md;
      }
      // No duplicate award ids, registry append-only.
      for (const a of w.awards!) seenAwards.add(a.awardId);
      expect(seenAwards.size).toBe(w.awards!.length);
      // Award count == completed tournaments × awarded defs (winner cup / medal).
      expect(w.awards!.filter(isVictory).length).toBe(winnerAwards);
      expect(w.awards!.filter((a) => a.defId.startsWith('medal-')).length).toBe(medals);
      // One current holder per title.
      for (const t of w.titles) {
        const holders = new Set(currentOfSeries(w, `title-${t.arena}`).map((a) => a.holder));
        expect(holders.size).toBeLessThanOrEqual(1);
        if (holders.size) expect([...holders][0]).toBe(t.holder);
        expect(w.reigns.filter((r) => r.titleId === t.id && r.to === null).length).toBeLessThanOrEqual(1);
      }
      // Records are monotone (they survive retirement and pruning).
      for (const k of tracked) {
        const v = recordLeaders(w, k, 1)[0]?.value ?? 0;
        expect(v).toBeGreaterThanOrEqual(best[k] ?? 0);
        best[k] = v;
      }
      // Chronicle only from events.
      for (const e of w.chronicle) {
        if (e.tag === 'new-champion' || e.tag === 'comeback' || e.tag === 'elite-upset') {
          expect(w.awards!.some((a) => a.defId.startsWith('sig-') && a.holder === e.ids![0] && a.day === e.day)).toBe(true);
        }
        if (e.tag === 'record-broken') expect(e.ids?.length).toBe(1);
        if (e.tag === 'prodigy') {
          const c = w.competitors.find((x) => x.id === e.ids![0]);
          if (c) expect(c.arc?.prodigy).toBe(e.day);
        }
      }
      expect(w.chronicle.length).toBeLessThanOrEqual(600);
      // Live competitors: tournament wins == registry victories (since the world began).
      for (const c of w.competitors) expect(awardsFor(w, c.id).filter(isVictory).length).toBe(c.tournamentsWon);
      // Player: objectives never empty, timeline ordered.
      expect(objectives(s).length).toBeGreaterThan(0);
      const tl = legacyTimeline(s);
      for (let i = 1; i < tl.length; i++) expect(tl[i].day).toBeGreaterThanOrEqual(tl[i - 1].day);
      for (const id of Object.keys(s.player.achievements)) expect(ACHIEVEMENTS.some((a) => a.id === id)).toBe(true);
    };

    let lastSeason = w.season;
    let guard = 0;
    while (w.season < startSeason + SEASONS && guard++ < SEASONS * 28 * 3) {
      const pt = playerTournamentGame(s);
      if (pt?.opp) {
        playOne(s, pt.opp, 'tournament', { tournamentId: pt.t.id, pairingId: pt.pairingId, color: pt.color });
      } else {
        const inv = w.invitations.find((i) => i.tournamentId);
        if (inv) acceptTournament(s, inv.tournamentId!);
        if (w.day % 2 === 0) playOne(s, suggestOpponents(s)[0].c, 'ranked');
        else restDays(s, 1);
      }
      if (w.season !== lastSeason) {
        lastSeason = w.season;
        checkSeason();
      }
    }
    checkSeason();
    const ms = performance.now() - t0;
    const kb = Math.round(JSON.stringify(s).length / 1024);
    const awardsKb = Math.round(JSON.stringify(w.awards).length / 1024);
    console.log(JSON.stringify({
      seasons: w.season - startSeason, days: w.day, ms: Math.round(ms), completed, awards: w.awards!.length, awardsKb, saveKb: kb,
      playerAwards: awardsFor(w, 'player').length, playerAchievements: Object.keys(s.player.achievements).length,
      seasonReports: s.player.seasonReports!.length, timeline: s.player.timeline!.length, legends: w.hall!.legends.length,
      records: Object.fromEntries(tracked.map((k) => [k, best[k]])), chronicle: w.chronicle.length,
    }));
    expect(w.season - startSeason).toBeGreaterThanOrEqual(SEASONS);
    expect(s.player.seasonReports!.length).toBeGreaterThanOrEqual(SEASONS - 1);
    if (SEASONS >= 30) expect(w.hall!.legends.length).toBeGreaterThan(0); // pruning starts once 1,500 retirees accumulate
  });
});
