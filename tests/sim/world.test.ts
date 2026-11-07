import { describe, it, expect } from 'vitest';
import { createWorld, advanceWorld } from '../../src/world/world';
import { RANKS } from '../../src/world/arenas';

describe('living empire', () => {
  it('runs seasons of tournaments and championships coherently', () => {
    const t0 = performance.now();
    const w = createWorld(4242, 8);
    const burnMs = performance.now() - t0;
    advanceWorld(w, 28 * 8, null); // two more years
    console.log('burn-in ms', Math.round(burnMs), 'history', w.history.length, 'reigns', w.reigns.length, 'json KB', Math.round(JSON.stringify(w).length / 1024));
    expect(w.history.length).toBeGreaterThan(12 * 4 * 10);
    // Every format completed at least once.
    const kinds = new Set(w.history.map((h) => h.format));
    for (const f of ['single-elim', 'double-elim', 'swiss', 'round-robin', 'league', 'match-series']) expect(kinds.has(f as never)).toBe(true);
    expect(w.competitors.filter((c) => c.retiredDay === null).length).toBe(25000);
    // Titles: one open reign per title, holder consistent with competitor record.
    for (const t of w.titles) {
      const open = w.reigns.filter((r) => r.titleId === t.id && r.to === null);
      expect(open.length).toBeLessThanOrEqual(1);
      if (t.holder) {
        expect(open[0]?.holder).toBe(t.holder);
        const c = w.competitors.find((x) => x.id === t.holder)!;
        expect(c.titles).toContain(t.id);
      }
    }
    for (const c of w.competitors) for (const tid of c.titles) expect(w.titles.find((t) => t.id === tid)!.holder).toBe(c.id);
    // Title turnover happens but is not chaotic.
    const changes = w.reigns.length;
    expect(changes).toBeGreaterThan(12);
    // Every competitor's record is internally consistent.
    for (const c of w.competitors) {
      expect(c.w + c.d + c.l).toBe(c.games);
      expect(RANKS[c.rank]).toBeDefined();
    }
    // Ids unique, never reused.
    expect(new Set(w.competitors.map((c) => c.id)).size).toBe(w.competitors.length);
    // Save size bounded (v0.3: ~25k competitors; per-competitor JSON stays compact).
    const bytes = JSON.stringify(w).length;
    expect(bytes / w.competitors.length).toBeLessThan(1300);
    // Regional crowns: one open reign each, holder alive and from that region.
    for (const t of w.regionTitles!) {
      const open = w.regionReigns!.filter((r) => r.titleId === t.id && r.to === null);
      expect(open.length).toBeLessThanOrEqual(1);
      if (t.holder) {
        expect(open[0]?.holder).toBe(t.holder);
        const c = w.competitors.find((x) => x.id === t.holder)!;
        expect(c.retiredDay).toBe(null);
        expect(c.region).toBe(t.region);
      }
    }
    expect(w.regionTitles!.filter((t) => t.holder).length).toBeGreaterThan(4);
    // Retired competitors never hold an arena title.
    for (const t of w.titles) if (t.holder) expect(w.competitors.find((x) => x.id === t.holder)!.retiredDay).toBe(null);
    // Every v0.3 kind ran.
    for (const k of ['local-open', 'regional', 'regional-defense', 'qualifier', 'elite']) expect(w.history.some((h) => h.kind === k)).toBe(true);
    expect(burnMs).toBeLessThan(60000);
    // Running tournaments are not stuck.
    const running = w.tournaments.filter((t) => t.status === 'running');
    for (const t of running) expect(t.nextRoundDay).toBeLessThanOrEqual(w.day + 3);
  }, 300000);
});
