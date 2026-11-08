import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync } from 'fs';
import { createWorld } from '../../src/world/world';
import { TROPHY_DEFS, V3_TROPHY_IDS, trophyArt, isVictory, awardsFor } from '../../src/world/trophies';
import { tournamentInfo, PLAYER_ID } from '../../src/world/calendar';
import { hallOfFame, competitorProfile, careerStage, careerAmbition, regionInfo, arenaInfo, populationPyramid, regionalLeaderboard, eventCalendar, playerCareerRecords } from '../../src/world/hall';
import { chronicleFilter, chronicleStats, CHRONICLE_TAG_LABELS } from '../../src/world/chronicle';
import { feudIntensity, topFeuds } from '../../src/world/rivalry';
import { REGIONS } from '../../src/world/regions';
import { ARENAS, RANKS, rankProgress, rankId, rankIndexById } from '../../src/world/arenas';
import { newSave, refreshInvitations, careerRating, playerRegion, setPlayerRegion } from '../../src/game/career';
import type { WorldState } from '../../src/game/state';

let w: WorldState;
beforeAll(() => {
  w = createWorld(31415, 6, undefined, 8000);
}, 180_000);

describe('v0.3 Golden Age data API', () => {
  it('every trophy definition has baked art (directly or via trophyArt)', () => {
    expect(new Set(TROPHY_DEFS.map((d) => d.id)).size).toBe(TROPHY_DEFS.length);
    for (const d of TROPHY_DEFS) expect(existsSync(new URL(`../../public/trophies/${trophyArt(d.id)}.webp`, import.meta.url)), d.id).toBe(true);
    for (const id of V3_TROPHY_IDS) expect(TROPHY_DEFS.some((d) => d.id === id)).toBe(true);
  });

  it('every tournament carries its identity (name, arena, region, format, prestige, rule, series, trophy, winners)', () => {
    for (const t of w.tournaments) {
      const i = tournamentInfo(w, t);
      expect(i.name.length).toBeGreaterThan(0);
      expect(ARENAS[i.arena]).toBeDefined();
      expect(i.region === 'imperial' || REGIONS.some((r) => r.id === i.region)).toBe(true);
      expect(i.prestige).toBeGreaterThan(0);
      expect(i.qualification.length).toBeGreaterThan(10);
      expect(i.series.length).toBeGreaterThan(0);
      expect(TROPHY_DEFS.some((d) => d.id === i.trophy)).toBe(true);
      if (t.status === 'complete' && t.state?.winner) expect(i.champion).toBe(t.state.winner);
    }
    const crown = w.tournaments.find((t) => t.kind === 'regional' && t.status === 'complete');
    if (crown) expect(tournamentInfo(w, crown).historicalWinners.length).toBeGreaterThan(0);
    expect(eventCalendar(w, { region: 'latium' }).every((e) => e.region === 'latium')).toBe(true);
  });

  it('regional circuits: crowns, reigns, leaderboards, records', () => {
    let crowned = 0;
    for (const r of REGIONS) {
      const info = regionInfo(w, r.id);
      expect(info.population).toBeGreaterThan(200);
      expect(info.byArena.reduce((a, b) => a + b, 0)).toBe(info.population);
      if (info.crown.holder) {
        crowned++;
        const c = w.competitors.find((x) => x.id === info.crown.holder)!;
        expect(c.region).toBe(r.id);
        expect(info.reigns.some((x) => x.holder === c.id && x.to === null)).toBe(true);
        expect(info.champions.length).toBeGreaterThan(0);
      }
      const lb = regionalLeaderboard(w, r.id, 10);
      for (let i = 1; i < lb.length; i++) expect(lb[i].rating).toBeLessThanOrEqual(lb[i - 1].rating);
    }
    expect(crowned).toBeGreaterThan(4);
    // Regional events award exactly one victory, tagged with their region.
    for (const h of w.history.filter((x) => x.kind === 'local-open' || x.kind === 'regional' || x.kind === 'regional-defense')) {
      const v = w.awards!.filter((a) => a.tournamentId === h.id && isVictory(a));
      expect(v.length).toBe(h.winner ? 1 : 0);
      if (v[0]) expect(v[0].region).toBe(h.region);
    }
  });

  it('arenas: champion, history, signature trophy, grades and promotion rule', () => {
    for (const a of ARENAS) {
      const i = arenaInfo(w, a.index);
      expect(i.grades.length).toBe(3);
      expect(i.signatureTrophy.name).toBe(a.trophy);
      expect(i.promotion.length).toBeGreaterThan(5);
      if (i.champion.holder) expect(i.championHistory[0].holder).toBe(i.champion.holder);
    }
    for (const r of RANKS) expect(rankIndexById(rankId(r.index))).toBe(r.index);
    const p = rankProgress(8, 790);
    expect(p.crossesArena).toBe(true);
    expect(p.nextFloor).toBe(800);
  });

  it('profiles: stage and ambition derive from real state', () => {
    const champ = w.titles.find((t) => t.holder)!;
    const c = w.competitors.find((x) => x.id === champ.holder)!;
    expect(careerAmbition(w, c).kind).toBe('defend-title');
    const prof = competitorProfile(w, c.id)!;
    expect(prof.championshipHistory.some((a) => a.defId.startsWith('sig-'))).toBe(true);
    expect(prof.recent.length).toBeGreaterThan(0);
    const py = populationPyramid(w);
    expect(Object.values(py.byStage).reduce((a, b) => a + b, 0)).toBe(w.competitors.length);
    for (const k of ['prospect', 'rising', 'prime', 'veteran', 'declining'] as const) expect(py.byStage[k]).toBeGreaterThan(0);
    for (const x of w.competitors.slice(0, 500)) {
      const st = careerStage(x, w.day);
      if (x.retiredDay !== null) expect(st).toBe('retired');
      expect(careerAmbition(w, x).text.length).toBeGreaterThan(5);
    }
  });

  it('Hall of Fame lists are ordered, labelled and include retired legends', () => {
    const hof = hallOfFame(w, 10);
    expect(hof.length).toBe(10);
    for (const l of hof) {
      expect(l.criteria.length).toBeGreaterThan(10);
      for (let i = 1; i < l.rows.length; i++) expect(l.rows[i].value).toBeLessThanOrEqual(l.rows[i - 1].value);
    }
    expect(hof.find((l) => l.key === 'greatest-champions')!.rows.length).toBeGreaterThan(0);
    expect(hof.find((l) => l.key === 'greatest-rivalries')!.rows.length).toBeGreaterThan(0);
    const f = topFeuds(w, 1)[0];
    expect(feudIntensity(f, w.day)).toBeGreaterThan(0);
  });

  it('Chronicle: bounded, event tags, filter helper', () => {
    const st = chronicleStats(w);
    expect(st.kept).toBeLessThanOrEqual(st.maxInMemory);
    for (const e of w.chronicle) if (e.tag) expect(CHRONICLE_TAG_LABELS[e.tag]).toBeDefined();
    const titles = chronicleFilter(w.chronicle, { kind: 'title' });
    expect(titles.every((e) => e.kind === 'title')).toBe(true);
    expect(titles.length).toBeGreaterThan(0);
    for (let i = 1; i < titles.length; i++) expect(titles[i].day).toBeLessThanOrEqual(titles[i - 1].day);
    const reg = chronicleFilter(w.chronicle, { tag: 'regional-champion' });
    expect(reg.length).toBeGreaterThan(0);
    expect(reg.every((e) => e.region && REGIONS.some((r) => r.id === e.region))).toBe(true);
    expect(chronicleFilter(w.chronicle, { region: 'gallia' }).every((e) => e.region === 'gallia')).toBe(true);
    expect(chronicleFilter(w.chronicle, { limit: 3 }).length).toBe(3);
  });

  it('invitations to regional events follow real eligibility', () => {
    const s = newSave(w, 'Hero', false, 1200);
    expect(playerRegion(s)).toBe('latium');
    expect(setPlayerRegion(s, 'gallia')).toBe(true);
    // Find the next Gallia Local Open whose band contains the player's arena, and step to 2 days before it.
    const lo = s.world.tournaments.find((t) => t.kind === 'local-open' && t.region === 'gallia' && t.status === 'scheduled' && (t.band?.[0] ?? 0) === 0);
    if (lo) {
      s.world.day = lo.startDay - 2;
      refreshInvitations(s);
      const inv = s.world.invitations.find((i) => i.tournamentId === lo.id);
      expect(inv?.context).toBe('local-open');
      // Another region's open is never offered.
      expect(s.world.invitations.some((i) => i.context === 'local-open' && s.world.tournaments.find((t) => t.id === i.tournamentId)?.region !== 'gallia')).toBe(false);
    }
    expect(careerRating(s).rating).toBe(1200);
    // A 1200-rated newcomer is never invited to the Imperial Masters or a regional crown.
    expect(s.world.invitations.some((i) => i.context === 'imperial-masters' || i.context === 'regional-crown')).toBe(false);
    const rec = playerCareerRecords(s);
    expect(rec.games).toBe(0);
    expect(awardsFor(s.world, PLAYER_ID).length).toBe(0);
  });
});
