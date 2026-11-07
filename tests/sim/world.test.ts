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
    // Save size bounded.
    expect(JSON.stringify(w).length).toBeLessThan(12 * 1024 * 1024);
    // Running tournaments are not stuck.
    const running = w.tournaments.filter((t) => t.status === 'running');
    for (const t of running) expect(t.nextRoundDay).toBeLessThanOrEqual(w.day + 3);
  }, 300000);
});
