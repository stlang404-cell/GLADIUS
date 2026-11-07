import { describe, it, expect } from 'vitest';
// @vitest-environment jsdom
import { arenaBackdropSvg, rankEmblemSvg, arenaTrophySvg, portraitSvg, pieceSvg, svgDataUri } from '../src/art';

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

describe('art: backdrops', () => {
  const all = Array.from({ length: 12 }, (_, i) => arenaBackdropSvg(i));
  it('well-formed, viewBox, size budget', () => {
    for (const s of all) {
      checkSvg(s);
      expect(s).toContain('viewBox="0 0 1600 900"');
      expect(s).toContain('preserveAspectRatio="xMidYMid slice"');
      expect(s.length).toBeLessThan(25 * 1024);
    }
  });
  it('deterministic and distinct', () => {
    expect(arenaBackdropSvg(5)).toBe(all[5]);
    expect(new Set(all).size).toBe(12);
  });
});

describe('art: emblems & trophies', () => {
  const emblems = Array.from({ length: 36 }, (_, i) => rankEmblemSvg(i));
  const trophies = Array.from({ length: 12 }, (_, i) => arenaTrophySvg(i));
  it('well-formed', () => {
    for (const s of emblems) {
      checkSvg(s);
      expect(s).toContain('viewBox="0 0 128 128"');
    }
    for (const s of trophies) {
      checkSvg(s);
      expect(s).toContain('viewBox="0 0 160 160"');
    }
    expect(rankEmblemSvg(3, 48)).toContain('width="48"');
  });
  it('deterministic and distinct', () => {
    expect(rankEmblemSvg(17)).toBe(emblems[17]);
    expect(arenaTrophySvg(9)).toBe(trophies[9]);
    expect(new Set(emblems).size).toBe(36);
    expect(new Set(trophies).size).toBe(12);
  });
});

describe('art: portraits', () => {
  it('well-formed, small, deterministic', () => {
    for (let i = 0; i < 200; i++) {
      const s = portraitSvg(i * 7919, PORTRAIT_OPTS(i));
      checkSvg(s);
      expect(s).toContain('viewBox="0 0 120 120"');
      expect(s.length).toBeLessThan(4096);
    }
    expect(portraitSvg(42, PORTRAIT_OPTS(3))).toBe(portraitSvg(42, PORTRAIT_OPTS(3)));
  });
  it('50 different seeds are pairwise distinct', () => {
    const set = new Set(Array.from({ length: 50 }, (_, i) => portraitSvg(1000 + i, { female: false, age: 30, arenaIndex: 2 })));
    expect(set.size).toBe(50);
  });
  it('tolerates odd inputs', () => {
    checkSvg(portraitSvg(-5, { female: true, age: NaN, arenaIndex: 99 }));
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
