import { describe, it, expect } from 'vitest';
// @vitest-environment jsdom
import {
  arenaBackdropSvg, arenaCrestSvg, rankEmblemSvg, legacyRankEmblemSvg, arenaTrophySvg, portraitSvg, pieceSvg, svgDataUri,
  legacyArenaIndex, ARENA_ART_COUNT, ARENA_CREST_COUNT, RANK_EMBLEM_COUNT,
} from '../src/art';

const parser = new DOMParser();

function checkSvg(svg: string) {
  expect(svg.startsWith('<svg')).toBe(true);
  expect(svg.endsWith('</svg>')).toBe(true);
  expect(svg).not.toMatch(/NaN|undefined|Infinity/);
  const doc = parser.parseFromString(svg, 'image/svg+xml');
  expect(doc.getElementsByTagName('parsererror').length).toBe(0);
  expect(doc.documentElement.nodeName).toBe('svg');
  // every url(#id) / href="#id" reference must resolve to an id in the same document
  const ids = new Set([...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
  for (const m of svg.matchAll(/(?:url\(#|href="#)([^)"]+)/g)) expect(ids.has(m[1])).toBe(true);
  return ids;
}

const PORTRAIT_OPTS = (i: number) => ({ female: i % 2 === 1, age: 18 + ((i * 13) % 60), arenaIndex: i % 12 });

const idsOf = (svg: string) => [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);

describe('art: backdrops (24 arenas)', () => {
  const all = Array.from({ length: 24 }, (_, i) => arenaBackdropSvg(i));
  it('covers the 24-arena empire', () => {
    expect(ARENA_ART_COUNT).toBe(24);
    expect(ARENA_CREST_COUNT).toBe(24);
  });
  it('well-formed, viewBox, size budget', () => {
    for (const s of all) {
      checkSvg(s);
      expect(s).toContain('viewBox="0 0 1600 900"');
      expect(s).toContain('preserveAspectRatio="xMidYMid slice"');
      expect(s.length).toBeGreaterThan(18 * 1024); // illustrated, not a placeholder
      expect(s.length).toBeLessThan(90 * 1024);
      // self-contained: no external references, fonts or raster filters
      expect(s).not.toMatch(/<text|<image|https?:\/\/(?!www\.w3\.org)|<filter/);
    }
  });
  it('deterministic, distinct and clamped', () => {
    expect(arenaBackdropSvg(5)).toBe(all[5]);
    expect(arenaBackdropSvg(17)).toBe(all[17]);
    expect(new Set(all).size).toBe(24);
    expect(arenaBackdropSvg(-3)).toBe(all[0]);
    expect(arenaBackdropSvg(99)).toBe(all[23]);
    expect(arenaBackdropSvg(NaN)).toBe(all[0]);
  });
  it('legacy arenas keep their place in the new order', () => {
    expect([0, 1, 5, 10, 11].map(legacyArenaIndex)).toEqual([0, 2, 10, 20, 23]);
    expect(legacyArenaIndex(-4)).toBe(0);
    expect(legacyArenaIndex(40)).toBe(23);
  });
});

describe('art: arena crests (24)', () => {
  const all = Array.from({ length: 24 }, (_, i) => arenaCrestSvg(i));
  it('well-formed, viewBox, small, no text nodes', () => {
    for (const s of all) {
      checkSvg(s);
      expect(s).toContain('viewBox="0 0 160 160"');
      expect(s.length).toBeLessThan(12 * 1024);
      expect(s).not.toMatch(/<text|<image/);
    }
  });
  it('deterministic, distinct, tolerant of odd input', () => {
    expect(arenaCrestSvg(7)).toBe(all[7]);
    expect(new Set(all).size).toBe(24);
    checkSvg(arenaCrestSvg(NaN));
    expect(arenaCrestSvg(99)).toBe(all[23]);
    expect(arenaCrestSvg(-1)).toBe(all[0]);
  });
  it('metal tiers: bronze 0–7, silver 8–15, gold 16–23; radiant back for 20–23', () => {
    for (let i = 0; i < 24; i++) {
      const rimTop = ['#f2c08a', '#ffffff', '#fff2b0'][Math.floor(i / 8)];
      expect(all[i]).toContain(rimTop);
      expect(all[i].includes('opacity=".45"')).toBe(i >= 20);
    }
  });
  it('ids do not collide across all 48 backdrops and crests on one page', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 24; i++)
      for (const svg of [arenaBackdropSvg(i), arenaCrestSvg(i)])
        for (const id of new Set(idsOf(svg))) {
          expect(seen.has(id)).toBe(false);
          seen.add(id);
        }
  });
});

describe('art: rank emblems (72) & trophies', () => {
  const emblems = Array.from({ length: 72 }, (_, i) => rankEmblemSvg(i));
  it('well-formed and small', () => {
    expect(RANK_EMBLEM_COUNT).toBe(72);
    for (const s of emblems) {
      checkSvg(s);
      expect(s).toContain('viewBox="0 0 128 128"');
      expect(s.length).toBeLessThan(10 * 1024);
      expect(s).not.toMatch(/<text|<image|<filter/);
    }
    expect(rankEmblemSvg(3, 48)).toContain('width="48"');
  });
  it('deterministic, distinct, clamped', () => {
    expect(rankEmblemSvg(17)).toBe(emblems[17]);
    expect(new Set(emblems).size).toBe(72);
    expect(rankEmblemSvg(-5)).toBe(emblems[0]);
    expect(rankEmblemSvg(500)).toBe(emblems[71]);
    checkSvg(rankEmblemSvg(NaN));
  });
  it('ids do not collide between emblems on one page', () => {
    const seen = new Set<string>();
    for (const svg of emblems)
      for (const id of new Set(idsOf(svg))) {
        expect(seen.has(id)).toBe(false);
        seen.add(id);
      }
  });
  it('legacy 36-rank set and trophies still render', () => {
    const legacy = Array.from({ length: 36 }, (_, i) => legacyRankEmblemSvg(i));
    const trophies = Array.from({ length: 12 }, (_, i) => arenaTrophySvg(i));
    for (const s of legacy) {
      checkSvg(s);
      expect(s).toContain('viewBox="0 0 128 128"');
    }
    for (const s of trophies) {
      checkSvg(s);
      expect(s).toContain('viewBox="0 0 160 160"');
    }
    expect(new Set(legacy).size).toBe(36);
    expect(new Set(trophies).size).toBe(12);
    expect(arenaTrophySvg(9)).toBe(trophies[9]);
  });
});

describe('art: portraits', () => {
  it('well-formed, within size budget, deterministic', () => {
    let total = 0;
    for (let i = 0; i < 300; i++) {
      const s = portraitSvg(i * 7919, PORTRAIT_OPTS(i));
      checkSvg(s);
      expect(s).toContain('viewBox="0 0 120 120"');
      expect(s.length).toBeLessThan(8192);
      total += s.length;
    }
    expect(total / 300).toBeLessThan(6144);
    expect(portraitSvg(42, PORTRAIT_OPTS(3))).toBe(portraitSvg(42, PORTRAIT_OPTS(3)));
  });
  it('50 different seeds are pairwise distinct', () => {
    const set = new Set(Array.from({ length: 50 }, (_, i) => portraitSvg(1000 + i, { female: false, age: 30, arenaIndex: 2 })));
    expect(set.size).toBe(50);
  });
  it('ids are prefixed per portrait so several can be inlined on one page', () => {
    const a = new Set([...portraitSvg(1, PORTRAIT_OPTS(0)).matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
    const b = [...portraitSvg(2, PORTRAIT_OPTS(0)).matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    expect(b.length).toBeGreaterThan(0);
    for (const x of b) expect(a.has(x)).toBe(false);
  });
  it('keeps the same face as the competitor ages and climbs arenas', () => {
    // the head outline (stored in defs) depends only on the seed
    const head = (s: string) => /<path id="[^"]+f" d="([^"]+)"/.exec(s)?.[1];
    const young = portraitSvg(777, { female: true, age: 22, arenaIndex: 0 });
    const old = portraitSvg(777, { female: true, age: 64, arenaIndex: 11 });
    expect(head(young)).toBeTruthy();
    expect(head(young)).toBe(head(old));
  });
  it('tolerates odd inputs', () => {
    checkSvg(portraitSvg(-5, { female: true, age: NaN, arenaIndex: 99 }));
    checkSvg(portraitSvg(NaN, { female: false, age: Infinity, arenaIndex: -3 }));
    checkSvg(portraitSvg(2 ** 40 + 0.5, { female: false, age: -10, arenaIndex: 1.7 }));
  });
});

describe('art: pieces', () => {
  it('all sets well-formed, deterministic, distinct', () => {
    const seen = new Set<string>();
    for (let set = 0; set < 12; set++)
      for (const c of ['w', 'b'] as const)
        for (const t of ['p', 'n', 'b', 'r', 'q', 'k'] as const) {
          const s = pieceSvg(t, c, set);
          checkSvg(s);
          expect(s).toContain('viewBox="0 0 100 100"');
          expect(pieceSvg(t, c, set)).toBe(s);
          seen.add(s);
        }
    expect(seen.size).toBe(144);
  });
});

describe('art: svgDataUri', () => {
  it('encodes', () => {
    const uri = svgDataUri(rankEmblemSvg(0));
    expect(uri.startsWith('data:image/svg+xml')).toBe(true);
    expect(uri).not.toContain('#');
    expect(uri).not.toContain('<');
  });
});
