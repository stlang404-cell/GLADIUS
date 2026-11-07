/**
 * Small shared helpers for the procedural SVG art module.
 * Everything here is pure and deterministic.
 */
import { mixSeed } from '../core/rng';

/** Encode an SVG string as a data: URI usable in <img src> or CSS url(). */
export function svgDataUri(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

/** Format a number compactly (1 decimal) — keeps markup small and NaN-free. */
export function n(v: number): string {
  if (!Number.isFinite(v)) return '0';
  const r = Math.round(v * 10) / 10;
  return (Object.is(r, -0) ? 0 : r).toString();
}

/** Deterministic id prefix so many SVGs can coexist inline on one page. */
export function idPrefix(...parts: (number | string)[]): string {
  return 'g' + mixSeed(...parts).toString(36);
}

type RGB = [number, number, number];

function parseHex(hex: string): RGB {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const v = parseInt(h, 16);
  if (Number.isNaN(v)) return [128, 128, 128];
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function toHex([r, g, b]: RGB): string {
  const c = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

/** Linear blend between two hex colours, t in [0,1]. */
export function mix(a: string, b: string, t: number): string {
  const A = parseHex(a);
  const B = parseHex(b);
  return toHex([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]);
}

/** amt > 0 lightens toward white, amt < 0 darkens toward black. */
export function shade(c: string, amt: number): string {
  return amt >= 0 ? mix(c, '#ffffff', amt) : mix(c, '#000000', -amt);
}

/** Relative luminance 0..1 (approximate, sRGB weights). */
export function luma(c: string): number {
  const [r, g, b] = parseHex(c);
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** Vertical linear gradient definition. stops: [offset 0..1, colour, opacity?] */
export function linGrad(
  id: string,
  stops: [number, string, number?][],
  x1 = 0,
  y1 = 0,
  x2 = 0,
  y2 = 1,
): string {
  return (
    `<linearGradient id="${id}" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}">` +
    stops
      .map(([o, c, op]) => `<stop offset="${n(o)}" stop-color="${c}"${op === undefined ? '' : ` stop-opacity="${n(op)}"`}/>`)
      .join('') +
    '</linearGradient>'
  );
}

export function radGrad(id: string, stops: [number, string, number?][], cx = 0.5, cy = 0.5, r = 0.5): string {
  return (
    `<radialGradient id="${id}" cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}">` +
    stops
      .map(([o, c, op]) => `<stop offset="${n(o)}" stop-color="${c}"${op === undefined ? '' : ` stop-opacity="${n(op)}"`}/>`)
      .join('') +
    '</radialGradient>'
  );
}

/** Build a polygon points attribute from a flat list of numbers. */
export function pts(arr: number[]): string {
  let s = '';
  for (let i = 0; i < arr.length; i += 2) s += (i ? ' ' : '') + n(arr[i]) + ',' + n(arr[i + 1]);
  return s;
}

/** Five-pointed star path centred at (cx,cy). */
export function starPath(cx: number, cy: number, r: number, inner = 0.45, points = 5, rot = -Math.PI / 2): string {
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const rr = i % 2 === 0 ? r : r * inner;
    const a = rot + (i * Math.PI) / points;
    d += (i === 0 ? 'M' : 'L') + n(cx + Math.cos(a) * rr) + ',' + n(cy + Math.sin(a) * rr);
  }
  return d + 'Z';
}

/** A single laurel leaf (pointed ellipse) as path data, centred at (x,y), rotated by angle (radians). */
export function leafPath(x: number, y: number, len: number, wid: number, ang: number): string {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const P = (u: number, v: number) => n(x + u * c - v * s) + ',' + n(y + u * s + v * c);
  return `M${P(-len / 2, 0)}Q${P(0, -wid)} ${P(len / 2, 0)}Q${P(0, wid)} ${P(-len / 2, 0)}Z`;
}

/**
 * Laurel branch along an arc around (cx,cy) radius r from angle a0 to a1.
 * Returns path data for all leaves (one path keeps the markup tiny).
 */
export function laurelArc(cx: number, cy: number, r: number, a0: number, a1: number, count: number, len: number, wid: number): string {
  let d = '';
  const dir = a1 > a0 ? 1 : -1;
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const a = a0 + (a1 - a0) * t;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    const tang = a + (dir * Math.PI) / 2;
    // pair of leaves splayed outward/inward
    d += leafPath(px + Math.cos(a) * len * 0.28, py + Math.sin(a) * len * 0.28, len, wid, tang - dir * 0.55);
    d += leafPath(px - Math.cos(a) * len * 0.28, py - Math.sin(a) * len * 0.28, len, wid, tang + dir * 0.55);
  }
  return d;
}
