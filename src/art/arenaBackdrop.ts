/**
 * Arena backdrops — stylized Roman key-art illustrations (viewBox 0 0 1600 900,
 * preserveAspectRatio slice). Twelve unique places, one per ARENAS[i].
 *
 * Composition contract: the chessboard card sits in the centre. Landmark
 * architecture lives in the upper third and on the left/right edges; the
 * centre band stays comparatively calm. The centre 420px column must read on
 * its own (phone portrait crop) and the top 40% must read as a banner strip.
 *
 * Technique: layered depth (sky → far → mid → near), atmospheric haze layers
 * between depths, gradient-shaded flat shapes, cheap <pattern> textures
 * (stone courses, roof tiles, crowds) and soft light shafts. No raster
 * filters, no fonts, no external references.
 */
import { createRng, type Rng } from '../core/rng';
import { idPrefix, mix, n, shade } from './svgUtil';

const W = 1600;
const H = 900;

type Stop = [number, string, number?];

/** Scene builder: collects defs, de-duplicates gradients, owns the RNG. */
class S {
  readonly id: string;
  readonly r: Rng;
  private defs: string[] = [];
  private cache = new Map<string, string>();
  private k = 0;
  out: string[] = [];
  /** +1: light comes from the left (lit faces on the left); -1 from the right. */
  lit = 1;

  constructor(arena: number) {
    this.id = idPrefix('arena-art', arena);
    this.r = createRng(0x51a7 + arena * 7919);
  }
  uid(): string {
    return this.id + (this.k++).toString(36);
  }
  def(s: string): void {
    this.defs.push(s);
  }
  private stops(stops: Stop[]): string {
    return stops
      .map(([o, c, op]) => `<stop offset="${n(o)}" stop-color="${c}"${op === undefined || op === 1 ? '' : ` stop-opacity="${n(op)}"`}/>`)
      .join('');
  }
  /** Linear gradient (bounding-box units). Returns `url(#id)`. */
  lg(stops: Stop[], x1 = 0, y1 = 0, x2 = 0, y2 = 1): string {
    const key = 'l' + JSON.stringify(stops) + [x1, y1, x2, y2].join();
    let id = this.cache.get(key);
    if (!id) {
      id = this.uid();
      this.cache.set(key, id);
      this.defs.push(`<linearGradient id="${id}" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}">${this.stops(stops)}</linearGradient>`);
    }
    return `url(#${id})`;
  }
  /** Linear gradient in user space (works on zero-height/width shapes). */
  lgu(stops: Stop[], x1: number, y1: number, x2: number, y2: number): string {
    const id = this.uid();
    this.defs.push(
      `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}">${this.stops(stops)}</linearGradient>`,
    );
    return `url(#${id})`;
  }
  /** Radial gradient in user space. */
  rgu(stops: Stop[], cx: number, cy: number, r: number, sy = 1): string {
    const key = 'r' + JSON.stringify(stops) + [cx, cy, r, sy].join();
    let id = this.cache.get(key);
    if (!id) {
      id = this.uid();
      this.cache.set(key, id);
      const tr = sy === 1 ? '' : ` gradientTransform="translate(0 ${n(cy * (1 - sy))}) scale(1 ${n(sy)})"`;
      this.defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"${tr}>${this.stops(stops)}</radialGradient>`);
    }
    return `url(#${id})`;
  }
  add(...s: string[]): void {
    for (const x of s) this.out.push(x);
  }
  rnd(a: number, b: number): number {
    return a + this.r.next() * (b - a);
  }
  svg(): string {
    return (
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">` +
      `<defs>${this.defs.join('')}</defs>${this.out.join('')}</svg>`
    );
  }
}

// ------------------------------------------------------------------ primitives

const rect = (x: number, y: number, w: number, h: number, fill: string, extra = '') =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
const path = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
const ell = (cx: number, cy: number, rx: number, ry: number, fill: string, extra = '') =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
const stroke = (d: string, color: string, w: number, extra = '') =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${n(w)}"${extra ? ' ' + extra : ''}/>`;
const op = (v: number) => `opacity="${n(v)}"`;
const g = (inner: string, extra = '') => `<g${extra ? ' ' + extra : ''}>${inner}</g>`;
const P = (x: number, y: number) => n(x) + ',' + n(y);
const poly = (pts: number[]) => {
  let d = '';
  for (let i = 0; i < pts.length; i += 2) d += (i ? 'L' : 'M') + P(pts[i], pts[i + 1]);
  return d + 'Z';
};
const circ = (cx: number, cy: number, r: number) =>
  `M${P(cx - r, cy)}a${n(r)},${n(r)} 0 1,0 ${n(2 * r)},0a${n(r)},${n(r)} 0 1,0 ${n(-2 * r)},0Z`;

/** Full-frame sky gradient. */
function sky(s: S, stops: Stop[]): void {
  s.add(rect(0, 0, W, H, s.lg(stops)));
}

/** Sun/moon disc with layered glow. */
function sun(s: S, x: number, y: number, r: number, core: string, glowC: string, glowR = r * 6, glowOp = 0.75): void {
  s.add(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(glowR)}" fill="${s.rgu([[0, glowC, glowOp], [0.25, glowC, glowOp * 0.45], [1, glowC, 0]], x, y, glowR)}"/>`);
  s.add(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 1.5)}" fill="${core}" ${op(0.35)}/>`);
  s.add(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${core}"/>`);
}

/** Fan of soft light shafts from (x,y). */
function shafts(s: S, x: number, y: number, a0: number, a1: number, count: number, len: number, color: string, strength = 0.22): void {
  let out = '';
  const fill = s.rgu([[0, color, strength], [0.55, color, strength * 0.4], [1, color, 0]], x, y, len);
  for (let i = 0; i < count; i++) {
    const a = a0 + ((a1 - a0) * (i + s.rnd(0.2, 0.8))) / count;
    const w = s.rnd(0.025, 0.07);
    out += `M${P(x, y)}L${P(x + Math.cos(a - w) * len, y + Math.sin(a - w) * len)}L${P(x + Math.cos(a + w) * len, y + Math.sin(a + w) * len)}Z`;
  }
  s.add(path(out, fill));
}

/**
 * Cartoon cumulus: flat bottom, bumpy top, vertical lit→shade gradient and a
 * brighter cap offset toward the light.
 */
function cloud(s: S, x: number, y: number, w: number, h: number, litC: string, shadeC: string, alpha = 1, bumps = 0): void {
  const k = bumps || 4 + Math.floor(s.r.next() * 3);
  const contour = (cx: number, by: number, ww: number, hh: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= k; i++) {
      const t = i / k;
      const env = Math.sin(Math.PI * (0.08 + t * 0.84));
      pts.push([cx - ww / 2 + ww * t, by - hh * (0.25 + 0.75 * env) * (i === 0 || i === k ? 0.35 : s.rnd(0.75, 1))]);
    }
    let d = `M${P(cx - ww / 2 - hh * 0.15, by)}L${P(pts[0][0], pts[0][1])}`;
    for (let i = 1; i <= k; i++) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      const r = Math.hypot(x1 - x0, y1 - y0) * 0.56;
      d += `A${n(r)},${n(r)} 0 0,1 ${P(x1, y1)}`;
    }
    return d + `L${P(cx + ww / 2 + hh * 0.15, by)}Z`;
  };
  const st = s.r.state();
  const base = contour(x, y, w, h);
  s.add(path(base, s.lg([[0, litC], [0.55, mix(litC, shadeC, 0.45)], [1, shadeC]]), alpha < 1 ? op(alpha) : ''));
  void st;
  const cap = contour(x - s.lit * w * 0.04, y - h * 0.3, w * 0.8, h * 0.72);
  s.add(path(cap, litC, op(0.55 * alpha)));
}

/** Smooth rolling hills silhouette from y with amplitude amp. */
function hills(s: S, y: number, amp: number, count: number, fill: string, extra = '', bottom = H): string {
  let d = `M0,${n(bottom)}L0,${n(y - s.rnd(0, amp))}`;
  const step = W / count;
  for (let i = 0; i < count; i++) {
    const x1 = (i + 1) * step;
    const yy = y - s.rnd(0.1, 1) * amp;
    d += `Q${P(x1 - step / 2, yy - amp * 0.6)} ${P(x1, y - s.rnd(0, amp * 0.5))}`;
  }
  return path(d + `L${W},${n(bottom)}Z`, fill, extra);
}

/** Faceted stylized mountain range with lit facets and optional snow caps. */
function mountains(s: S, y: number, peaks: [number, number, number][], body: string, litC: string, snow?: string): void {
  // peaks: [x, height, halfWidth]
  let sil = '';
  let lit = '';
  let cap = '';
  for (const [px, ph, hw] of peaks) {
    const top = y - ph;
    const lx = px - hw;
    const rx = px + hw;
    const sk = s.rnd(-0.12, 0.12) * hw;
    sil += `M${P(lx, y)}L${P(px - hw * 0.45, top + ph * 0.38)}L${P(px + sk, top)}L${P(px + hw * 0.5, top + ph * 0.42)}L${P(rx, y)}Z`;
    const side = s.lit;
    // lit facet: from peak down toward the lit side
    lit += `M${P(px + sk, top)}L${P(px - side * hw * 0.45, top + ph * 0.38 + (side < 0 ? ph * 0.04 : 0))}L${P(px - side * hw, y)}L${P(px - side * hw * 0.1, y)}L${P(px + sk - side * hw * 0.05, top + ph * 0.5)}Z`;
    if (snow) {
      const sh = ph * 0.26;
      const ax = px + sk;
      cap += `M${P(ax, top)}L${P(ax + (px - hw * 0.45 - ax) * (sh / (ph * 0.38)), top + sh)}L${P(ax - hw * 0.12, top + sh * 0.75)}L${P(ax, top + sh * 1.05)}L${P(ax + hw * 0.14, top + sh * 0.8)}L${P(ax + (px + hw * 0.5 - ax) * (sh / (ph * 0.42)), top + sh)}Z`;
    }
  }
  s.add(path(sil, body), path(lit, litC));
  if (snow) s.add(path(cap, snow));
}

/** Haze / mist band: vertical gradient from transparent to colour. */
function haze(s: S, y0: number, y1: number, color: string, opTop: number, opBot: number): void {
  s.add(rect(0, y0, W, y1 - y0, s.lg([[0, color, opTop], [1, color, opBot]])));
}

/** Small flock of birds (M-shapes). */
function birds(s: S, cx: number, cy: number, count: number, spread: number, color: string, size = 9): void {
  let d = '';
  for (let i = 0; i < count; i++) {
    const x = cx + s.rnd(-1, 1) * spread;
    const y = cy + s.rnd(-0.4, 0.4) * spread;
    const sz = size * s.rnd(0.6, 1.15);
    const f = s.rnd(-0.3, 0.4);
    d += `M${P(x - sz, y - sz * (0.3 + f))}Q${P(x - sz * 0.45, y - sz * 0.55)} ${P(x, y)}Q${P(x + sz * 0.45, y - sz * 0.55)} ${P(x + sz, y - sz * (0.3 + f))}`;
  }
  s.add(stroke(d, color, size * 0.22, 'stroke-linecap="round" stroke-linejoin="round"'));
}

/** Cypress: flame-shaped, two-tone. */
function cypress(s: S, x: number, base: number, h: number, w: number, dark: string, light: string): string {
  const top = base - h;
  const lean = s.rnd(-0.06, 0.06) * w;
  const body = `M${P(x + lean, top)}C${P(x + w * 0.42, top + h * 0.25)} ${P(x + w * 0.62, top + h * 0.7)} ${P(x + w * 0.18, base - h * 0.03)}L${P(x - w * 0.18, base - h * 0.03)}C${P(x - w * 0.62, top + h * 0.7)} ${P(x - w * 0.42, top + h * 0.25)} ${P(x + lean, top)}Z`;
  const side = s.lit;
  const half = `M${P(x + lean, top)}C${P(x - side * w * 0.42, top + h * 0.25)} ${P(x - side * w * 0.62, top + h * 0.7)} ${P(x - side * w * 0.18, base - h * 0.03)}L${P(x - side * w * 0.02, base - h * 0.05)}C${P(x - side * w * 0.2, top + h * 0.6)} ${P(x - side * w * 0.12, top + h * 0.25)} ${P(x + lean, top)}Z`;
  // little tufts for texture
  let tufts = '';
  for (let i = 0; i < 5; i++) {
    const ty = top + h * (0.2 + i * 0.15);
    const tw = w * (0.18 + 0.28 * Math.sin(Math.PI * (0.2 + i * 0.15)));
    tufts += `M${P(x - side * tw, ty)}q${n(side * tw * 0.4)},${n(-h * 0.04)} ${n(side * tw * 0.8)},${n(h * 0.01)}`;
  }
  return (
    rect(x - w * 0.05, base - h * 0.06, w * 0.1, h * 0.06, shade(dark, -0.3)) +
    path(body, dark) +
    path(half, light) +
    stroke(tufts, light, Math.max(1, w * 0.06), `stroke-linecap="round" ${op(0.7)}`)
  );
}

/** Umbrella (stone) pine: tall bare trunk, flat cloud canopy. */
function umbrellaPine(s: S, x: number, base: number, h: number, w: number, trunk: string, dark: string, light: string): string {
  const top = base - h;
  const lean = s.rnd(-0.18, 0.18) * w;
  const tw = Math.max(2, w * 0.035);
  let out = stroke(`M${P(x, base)}Q${P(x + lean * 0.2, base - h * 0.5)} ${P(x + lean, top + h * 0.18)}`, trunk, tw, 'stroke-linecap="round"');
  out += stroke(`M${P(x + lean * 0.6, top + h * 0.35)}L${P(x + lean - w * 0.25, top + h * 0.17)}M${P(x + lean * 0.8, top + h * 0.28)}L${P(x + lean + w * 0.28, top + h * 0.16)}`, trunk, tw * 0.6, 'stroke-linecap="round"');
  const cx = x + lean;
  const cy = top + h * 0.12;
  let darkD = '';
  let litD = '';
  const k = 5;
  for (let i = 0; i < k; i++) {
    const t = i / (k - 1) - 0.5;
    const ex = cx + t * w * 0.8;
    const ey = cy + Math.abs(t) * h * 0.08;
    const rx = w * s.rnd(0.2, 0.26);
    const ry = h * s.rnd(0.07, 0.09);
    darkD += `M${P(ex - rx, ey)}a${n(rx)},${n(ry)} 0 1,0 ${n(2 * rx)},0a${n(rx)},${n(ry)} 0 1,0 ${n(-2 * rx)},0Z`;
    litD += `M${P(ex - rx * 0.8 - s.lit * rx * 0.1, ey - ry * 0.35)}a${n(rx * 0.75)},${n(ry * 0.6)} 0 1,0 ${n(1.5 * rx)},0a${n(rx * 0.75)},${n(ry * 0.6)} 0 1,0 ${n(-1.5 * rx)},0Z`;
  }
  return out + path(darkD, dark) + path(litD, light, op(0.9));
}

/** Olive / round deciduous tree. */
function roundTree(s: S, x: number, base: number, h: number, w: number, trunk: string, dark: string, light: string): string {
  const top = base - h;
  let out = path(`M${P(x - w * 0.05, base)}Q${P(x - w * 0.08, base - h * 0.3)} ${P(x - w * 0.15, base - h * 0.55)}L${P(x + w * 0.05, base - h * 0.5)}Q${P(x + w * 0.06, base - h * 0.25)} ${P(x + w * 0.08, base)}Z`, trunk);
  let darkD = '';
  let litD = '';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const bx = x + Math.cos(a) * w * 0.28;
    const by = top + h * 0.38 + Math.sin(a) * h * 0.18;
    const r = w * s.rnd(0.2, 0.27);
    darkD += circ(bx, by, r);
    litD += circ(bx - s.lit * r * 0.22, by - r * 0.28, r * 0.68);
  }
  out += path(darkD, dark) + path(litD, light, op(0.85));
  return out;
}

/** Palm tree with curved segmented trunk and arched fronds. */
function palm(s: S, x: number, base: number, h: number, lean: number, trunk: string, dark: string, light: string): string {
  const tx = x + lean * h * 0.35;
  const ty = base - h;
  const tw = h * 0.035;
  let out = path(`M${P(x - tw * 1.3, base)}Q${P(x + lean * h * 0.05, base - h * 0.55)} ${P(tx - tw * 0.7, ty)}L${P(tx + tw * 0.7, ty)}Q${P(x + lean * h * 0.05 + tw * 2, base - h * 0.55)} ${P(x + tw * 1.3, base)}Z`, trunk);
  let rings = '';
  for (let i = 1; i < 14; i++) {
    const t = i / 14;
    const cx = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * (x + lean * h * 0.05 + tw) + t * t * tx;
    const cy = base - h * t;
    const ww = tw * (1.3 - t * 0.5);
    rings += `M${P(cx - ww, cy)}q${n(ww)},${n(h * 0.012)} ${n(2 * ww)},0`;
  }
  out += stroke(rings, shade(trunk, -0.35), Math.max(1, tw * 0.25), op(0.8));
  let fd = '';
  let fl = '';
  const fronds = 9;
  for (let i = 0; i < fronds; i++) {
    const a = -Math.PI + (i / (fronds - 1)) * Math.PI + s.rnd(-0.12, 0.12);
    const len = h * s.rnd(0.38, 0.5);
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.45 + len * 0.42;
    const mx = tx + Math.cos(a) * len * 0.55;
    const my = ty + Math.sin(a) * len * 0.6 - len * 0.12;
    const nx = -(ey - ty);
    const ny = ex - tx;
    const nl = Math.hypot(nx, ny) || 1;
    const wd = len * 0.13;
    const ox = (nx / nl) * wd;
    const oy = (ny / nl) * wd;
    const d = `M${P(tx, ty)}Q${P(mx + ox, my + oy)} ${P(ex, ey)}Q${P(mx - ox * 0.3, my - oy * 0.3)} ${P(tx, ty)}Z`;
    if (Math.cos(a) * s.lit < 0) fl += d;
    else fd += d;
  }
  out += path(fd, dark) + path(fl, light);
  out += `<circle cx="${n(tx)}" cy="${n(ty + tw)}" r="${n(tw * 1.4)}" fill="${shade(trunk, -0.2)}"/>`;
  return out;
}

/** Waving flag on a pole. */
function flag(s: S, x: number, y: number, w: number, h: number, color: string, poleC: string, dir = 1, phase = 0, finial = '#e8c060'): string {
  const a = h * 0.18;
  const ph = phase;
  const x1 = x + dir * w;
  const top = `M${P(x, y)}C${P(x + dir * w * 0.33, y - a * Math.cos(ph))} ${P(x + dir * w * 0.66, y + a * Math.sin(ph + 1))} ${P(x1, y + a * 0.3)}`;
  const tail = `L${P(x1 - dir * w * 0.12, y + h * 0.5 + a * 0.3)}L${P(x1, y + h + a * 0.3)}`;
  const bottom = `C${P(x + dir * w * 0.66, y + h + a * Math.sin(ph + 1))} ${P(x + dir * w * 0.33, y + h - a * Math.cos(ph))} ${P(x, y + h)}Z`;
  const fill = s.lg([[0, color], [0.3, shade(color, 0.22)], [0.55, shade(color, -0.25)], [0.8, shade(color, 0.12)], [1, shade(color, -0.2)]], dir > 0 ? 0 : 1, 0, dir > 0 ? 1 : 0, 0);
  return (
    path(top + tail + bottom, fill) +
    stroke(`M${P(x, y - h * 0.4)}L${P(x, y + h * 3.2)}`, poleC, Math.max(2, h * 0.07), 'stroke-linecap="round"') +
    `<circle cx="${n(x)}" cy="${n(y - h * 0.45)}" r="${n(Math.max(2.5, h * 0.09))}" fill="${finial}"/>`
  );
}

/** Hanging vertical banner with swallowtail, folds and gold trim. */
function hangingBanner(s: S, x: number, y: number, w: number, h: number, color: string, trim: string, emblem = ''): string {
  const fill = s.lg([[0, shade(color, -0.25)], [0.18, shade(color, 0.15)], [0.42, color], [0.62, shade(color, -0.18)], [0.85, shade(color, 0.1)], [1, shade(color, -0.3)]], 0, 0, 1, 0);
  const d = `M${P(x, y)}L${P(x + w, y)}L${P(x + w, y + h)}L${P(x + w / 2, y + h - w * 0.35)}L${P(x, y + h)}Z`;
  return (
    path(d, fill) +
    stroke(`M${P(x + w * 0.1, y + 4)}L${P(x + w * 0.1, y + h - w * 0.12)}M${P(x + w * 0.9, y + 4)}L${P(x + w * 0.9, y + h - w * 0.12)}`, trim, Math.max(1.5, w * 0.05), op(0.9)) +
    rect(x - w * 0.12, y - w * 0.08, w * 1.24, w * 0.12, trim) +
    emblem
  );
}

// ------------------------------------------------------------------ lettering

const GLYPHS: Record<string, [number, string]> = {
  A: [10, 'M0,14L5,0L10,14M2.2,9.2L7.8,9.2'],
  C: [9, 'M9,2.6Q7.4,0 4.8,0Q0,0 0,7Q0,14 4.8,14Q7.4,14 9,11.4'],
  D: [9.5, 'M0,0L0,14M0,0L3.8,0Q9.5,0 9.5,7Q9.5,14 3.8,14L0,14'],
  E: [8, 'M8,0L0,0L0,14L8,14M0,7L6,7'],
  G: [9.5, 'M9,2.6Q7.4,0 4.8,0Q0,0 0,7Q0,14 4.8,14Q9.5,14 9.5,8.6L5.4,8.6'],
  I: [0, 'M0,0L0,14'],
  L: [7.5, 'M0,0L0,14L7.5,14'],
  M: [12, 'M0,14L1.2,0L6,12L10.8,0L12,14'],
  N: [9.5, 'M0,14L0,0L9.5,14L9.5,0'],
  O: [10.5, 'M5.25,0Q0,0 0,7Q0,14 5.25,14Q10.5,14 10.5,7Q10.5,0 5.25,0Z'],
  P: [8.5, 'M0,14L0,0L4.2,0Q8.5,0 8.5,3.8Q8.5,7.6 4.2,7.6L0,7.6'],
  Q: [10.5, 'M5.25,0Q0,0 0,7Q0,14 5.25,14Q10.5,14 10.5,7Q10.5,0 5.25,0ZM6.5,11.5L10.5,15.5'],
  R: [9, 'M0,14L0,0L4.2,0Q8.5,0 8.5,3.8Q8.5,7.6 4.2,7.6L0,7.6M4.2,7.6L9,14'],
  S: [8.5, 'M8.2,2.2Q6.6,0 4.2,0Q0.2,0 0.2,3.6Q0.2,6.4 4.2,7Q8.5,7.6 8.5,10.6Q8.5,14 4.2,14Q1.4,14 0,11.8'],
  T: [10, 'M0,0L10,0M5,0L5,14'],
  V: [10, 'M0,0L5,14L10,0'],
  X: [10, 'M0,0L10,14M10,0L0,14'],
  ' ': [5, ''],
  '·': [2, 'M1,7L1,7.01'],
};

/** Path data for Roman capitals (stroked). Returns [d, width]. Cap height 14 units * scale. */
export function romanText(text: string, x: number, y: number, scale: number, spacing = 3.4): [string, number] {
  let d = '';
  let cx = 0;
  for (const ch of text.toUpperCase()) {
    const gl = GLYPHS[ch === 'U' ? 'V' : ch] ?? GLYPHS[' '];
    const [w, gd] = gl;
    if (gd) {
      d += gd.replace(/([MLQZ])([^MLQZ]*)/g, (_m, cmd: string, args: string) => {
        if (cmd === 'Z') return 'Z';
        const nums = args.split(/[ ,]/).filter(Boolean).map(Number);
        const o: string[] = [];
        for (let i = 0; i < nums.length; i += 2) o.push(n(x + (cx + nums[i]) * scale) + ',' + n(y + nums[i + 1] * scale));
        return cmd + o.join(' ');
      });
    }
    cx += w + spacing;
  }
  return [d, (cx - spacing) * scale];
}

function inscription(text: string, cx: number, y: number, capH: number, color: string, extra = ''): string {
  const sc = capH / 14;
  const [, w] = romanText(text, 0, 0, sc);
  const [d] = romanText(text, cx - w / 2, y, sc);
  return stroke(d, color, Math.max(0.8, sc * 1.7), `stroke-linecap="square" stroke-linejoin="miter" ${extra}`);
}

// ------------------------------------------------------------------ textures

/** Ashlar stone courses overlay (transparent background). */
function patStone(s: S, cw: number, ch: number, line: string, hi: string, lineOp = 0.35, hiOp = 0.25): string {
  const id = s.uid();
  const w = cw;
  const h = ch * 2;
  s.def(
    `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${n(w)}" height="${n(h)}">` +
      `<path d="M0,${n(ch - 0.5)}H${n(w)}M0,${n(h - 0.5)}H${n(w)}M0.5,0V${n(ch)}M${n(w / 2)},${n(ch)}V${n(h)}" stroke="${line}" stroke-opacity="${n(lineOp)}" stroke-width="1.2" fill="none"/>` +
      `<path d="M0,${n(ch + 0.8)}H${n(w)}M0,0.8H${n(w)}" stroke="${hi}" stroke-opacity="${n(hiOp)}" stroke-width="1" fill="none"/>` +
      `</pattern>`,
  );
  return `url(#${id})`;
}

/** Terracotta roof tiles: imbrex ridges + course shadows. */
function patTiles(s: S, tw: number, th: number, base: string, slant = 0): string {
  const id = s.uid();
  const dk = shade(base, -0.32);
  const lt = shade(base, 0.22);
  s.def(
    `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${n(tw)}" height="${n(th)}"${slant ? ` patternTransform="skewX(${n(slant)})"` : ''}>` +
      rect(0, 0, tw, th, base) +
      rect(tw * 0.08, 0, tw * 0.34, th, lt) +
      rect(tw * 0.42, 0, tw * 0.1, th, dk, op(0.7)) +
      rect(0, th * 0.82, tw, th * 0.18, dk, op(0.45)) +
      `</pattern>`,
  );
  return `url(#${id})`;
}

/** Distant crowd: heads and colourful tunics. */
function patCrowd(s: S, scale: number, bg: string, tunics: string[], skins: string[], dim = 0): string {
  const id = s.uid();
  const w = 30 * scale;
  const h = 17 * scale;
  let inner = rect(0, 0, w, h, bg);
  const pos = [
    [3, 6], [9, 7], [15, 5.5], [21, 6.5], [27, 6],
    [0, 14], [6, 14.5], [12, 13.5], [18, 14.2], [24, 13.6], [30, 14],
  ];
  pos.forEach(([px, py], i) => {
    const t = mix(tunics[(i * 3 + 1) % tunics.length], bg, dim);
    const k = mix(skins[(i * 5) % skins.length], bg, dim);
    inner += rect((px - 2.6) * scale, (py - 0.5) * scale, 5.2 * scale, 5 * scale, t, `rx="${n(2 * scale)}"`);
    inner += `<circle cx="${n(px * scale)}" cy="${n((py - 2.2) * scale)}" r="${n(1.7 * scale)}" fill="${k}"/>`;
  });
  s.def(`<pattern id="${id}" patternUnits="userSpaceOnUse" width="${n(w)}" height="${n(h)}">${inner}</pattern>`);
  return `url(#${id})`;
}

/** Sparse dots/streaks for sand/grass texture. */
function speckles(s: S, x0: number, y0: number, x1: number, y1: number, count: number, color: string, alpha: number, size: number): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    const t = s.r.next();
    const y = y0 + (y1 - y0) * t * t;
    const x = x0 + (x1 - x0) * s.r.next();
    const sz = size * (0.35 + ((y - y0) / Math.max(1, y1 - y0)) * 0.9);
    d += `M${P(x, y)}h${n(sz * s.rnd(1, 2.5))}`;
  }
  return stroke(d, color, size * 0.6, `stroke-linecap="round" ${op(alpha)}`);
}

// ------------------------------------------------------------------ architecture

type ColKind = 'doric' | 'ionic' | 'corinth';

/** Column symbol, origin at base centre, 10 wide x 100 tall (shaft cylinder shading). */
function defColumn(s: S, light: string, base: string, dark: string, kind: ColKind = 'ionic', capC?: string, flutes = true): string {
  const id = s.uid();
  const cyl = s.lg(
    s.lit > 0
      ? [[0, mix(light, base, 0.3)], [0.28, shade(light, 0.25)], [0.55, base], [0.85, dark], [1, shade(dark, -0.15)]]
      : [[0, shade(dark, -0.15)], [0.15, dark], [0.45, base], [0.72, shade(light, 0.25)], [1, mix(light, base, 0.3)]],
    0, 0, 1, 0,
  );
  const cc = capC ?? light;
  let cap = '';
  if (kind === 'doric') cap = rect(-6.2, -96, 12.4, 4, cc) + rect(-7, -100, 14, 4, cc);
  else if (kind === 'ionic')
    cap = rect(-7.2, -100, 14.4, 3, cc) + path(`M-7,-97h14v3h-14z`, cc) + `<circle cx="-6.6" cy="-94.8" r="2.6" fill="${cc}"/><circle cx="6.6" cy="-94.8" r="2.6" fill="${cc}"/><circle cx="-6.6" cy="-94.8" r="1.1" fill="${dark}" opacity=".5"/><circle cx="6.6" cy="-94.8" r="1.1" fill="${dark}" opacity=".5"/>`;
  else
    cap =
      path(`M-5,-91L-7.6,-99.5H7.6L5,-91Z`, cc) +
      path(`M-5,-91Q-6.8,-94 -7,-97M5,-91Q6.8,-94 7,-97M0,-91V-98M-2.6,-91Q-3,-95 -4,-98M2.6,-91Q3,-95 4,-98`, 'none', `stroke="${dark}" stroke-width=".7" opacity=".45"`) +
      rect(-8, -101.5, 16, 2.4, cc);
  const fl = flutes ? stroke('M-2.6,-90V-8M0,-90V-8M2.6,-90V-8', dark, 0.6, op(0.28)) : '';
  s.def(
    `<g id="${id}">` +
      rect(-7.4, -3.2, 14.8, 3.2, cc) +
      rect(-6.4, -6.6, 12.8, 3.6, cc, 'rx="1.6"') +
      path('M-5.1,-7L-4.4,-91H4.4L5.1,-7Z', cyl) +
      fl +
      cap +
      `</g>`,
  );
  return id;
}

/** Place a column symbol: base centre (x,y), height h. */
function col(id: string, x: number, y: number, h: number, wScale = 1): string {
  const sy = h / 100;
  return `<use href="#${id}" transform="translate(${n(x)} ${n(y)}) scale(${n(sy * wScale)} ${n(sy)})"/>`;
}

type TempleStyle = { stone: string; light: string; dark: string; roof: string; gold: string; colId: string; inner?: string };

/** Classical temple front (hexastyle etc.) centred at cx with stylobate at baseY. */
function temple(s: S, cx: number, baseY: number, w: number, colH: number, cols: number, st: TempleStyle, opts: { steps?: number; pedH?: number; relief?: boolean } = {}): string {
  const x0 = cx - w / 2;
  const steps = opts.steps ?? 3;
  const stepH = colH * 0.045;
  let o = '';
  // steps
  for (let i = 0; i < steps; i++) {
    const ww = w + (steps - i) * colH * 0.06;
    const y = baseY - (i + 1) * stepH;
    o += rect(cx - ww / 2, y, ww, stepH + 0.5, i % 2 ? st.stone : shade(st.stone, -0.06));
    o += rect(cx - ww / 2, y, ww, Math.max(1, stepH * 0.22), st.light, op(0.8));
  }
  const top = baseY - steps * stepH;
  // cella wall in shadow
  o += rect(x0 + w * 0.04, top - colH, w * 0.92, colH, s.lg([[0, shade(st.inner ?? st.dark, -0.25)], [1, st.inner ?? st.dark]]));
  // doorway glow
  o += rect(cx - w * 0.08, top - colH * 0.62, w * 0.16, colH * 0.62, s.lg([[0, shade(st.gold, -0.35)], [1, st.gold]]), op(0.7));
  // columns
  const cw = (colH / 100) * 10;
  for (let i = 0; i < cols; i++) {
    const x = x0 + cw * 0.9 + ((w - cw * 1.8) * i) / (cols - 1);
    o += col(st.colId, x, top, colH);
  }
  // entablature
  const eH = colH * 0.2;
  const ey = top - colH - eH;
  o += rect(x0 - w * 0.01, ey + eH * 0.55, w * 1.02, eH * 0.45, st.stone);
  o += rect(x0 - w * 0.01, ey + eH * 0.55, w * 1.02, eH * 0.08, st.light);
  o += rect(x0 - w * 0.01, ey + eH * 0.15, w * 1.02, eH * 0.42, shade(st.stone, -0.08));
  // frieze dentils
  let dent = '';
  const dn = Math.max(8, Math.round(w / 9));
  for (let i = 0; i < dn; i++) dent += `M${P(x0 + (w * (i + 0.3)) / dn, ey + eH * 0.18)}h${n((w / dn) * 0.4)}v${n(eH * 0.12)}h${n((-w / dn) * 0.4)}z`;
  o += path(dent, st.dark, op(0.4));
  o += rect(x0 + w * 0.12, ey + eH * 0.3, w * 0.76, eH * 0.2, st.gold, op(0.55));
  o += rect(x0 - w * 0.03, ey, w * 1.06, eH * 0.17, st.light);
  // cast shadow of entablature onto columns
  o += rect(x0, top - colH, w, colH * 0.16, s.lg([[0, '#000', 0.28], [1, '#000', 0]]));
  // pediment
  const pH = opts.pedH ?? w * 0.17;
  const py = ey;
  o += path(poly([x0 - w * 0.04, py, cx, py - pH, x0 + w * 1.04, py]), st.light);
  o += path(poly([x0 + w * 0.04, py - pH * 0.08, cx, py - pH * 0.84, x0 + w * 0.96, py - pH * 0.08]), s.lg([[0, shade(st.stone, -0.18)], [1, shade(st.stone, -0.05)]]));
  if (opts.relief !== false) {
    // simple relief: reclining figures + central wreath
    o += `<circle cx="${n(cx)}" cy="${n(py - pH * 0.36)}" r="${n(pH * 0.17)}" fill="none" stroke="${st.gold}" stroke-width="${n(pH * 0.05)}"/>`;
    o += path(
      `M${P(cx - w * 0.33, py - pH * 0.12)}q${n(w * 0.06)},${n(-pH * 0.22)} ${n(w * 0.14)},${n(-pH * 0.24)}l${n(w * 0.03)},${n(pH * 0.24)}zM${P(cx + w * 0.33, py - pH * 0.12)}q${n(-w * 0.06)},${n(-pH * 0.22)} ${n(-w * 0.14)},${n(-pH * 0.24)}l${n(-w * 0.03)},${n(pH * 0.24)}z`,
      st.light,
      op(0.75),
    );
  }
  // roof line + acroteria
  o += stroke(`M${P(x0 - w * 0.05, py + 1)}L${P(cx, py - pH - 2)}L${P(x0 + w * 1.05, py + 1)}`, st.roof, Math.max(2, pH * 0.06), 'stroke-linejoin="round"');
  const ac = pH * 0.18;
  o += path(`M${P(cx - ac * 0.6, py - pH - 1)}Q${P(cx, py - pH - ac * 2)} ${P(cx + ac * 0.6, py - pH - 1)}Z`, st.gold);
  o += path(`M${P(x0 - w * 0.05, py)}l${n(ac * 0.4)},${n(-ac * 1.3)}l${n(ac * 0.6)},${n(ac * 1.3)}zM${P(x0 + w * 1.05, py)}l${n(-ac * 0.4)},${n(-ac * 1.3)}l${n(-ac * 0.6)},${n(ac * 1.3)}z`, st.gold);
  return o;
}

/** A row of arched openings cut into a wall band (returns path data for the holes). */
function archHoles(x: number, y: number, w: number, h: number, count: number, ratio = 0.62, springAt = 0.55): string {
  let d = '';
  const bay = w / count;
  const aw = bay * ratio;
  const r = aw / 2;
  for (let i = 0; i < count; i++) {
    const ax = x + bay * i + (bay - aw) / 2;
    const sy = y + h * (1 - springAt);
    d += `M${P(ax, y + h)}V${n(sy)}A${n(r)},${n(r)} 0 0,1 ${P(ax + aw, sy)}V${n(y + h)}Z`;
  }
  return d;
}

/** Point toward a vanishing point. */
const toward = (x: number, y: number, vx: number, vy: number, t: number): [number, number] => [x + (vx - x) * t, y + (vy - y) * t];

type Box = {
  x: number; base: number; w: number; h: number;
  depth: number; // 0..1 toward VP
  side: 1 | -1; // which side face shows (+1 right)
  vp: [number, number];
  front: string; sideC: string;
  roof?: { h: number; color: string; over?: number };
  stone?: string; // pattern url overlay
};

/** 2.5D building block: front face + receding side face + optional hip roof. */
function box(s: S, b: Box): string {
  const { x, base, w, h, depth, side, vp, front, sideC } = b;
  const top = base - h;
  const ex = side > 0 ? x + w : x;
  const [fx1, fy1] = toward(ex, top, vp[0], vp[1], depth);
  const [fx2, fy2] = toward(ex, base, vp[0], vp[1], depth);
  let o = path(`M${P(ex, top)}L${P(fx1, fy1)}L${P(fx2, fy2)}L${P(ex, base)}Z`, sideC);
  o += rect(x, top, w, h, front);
  if (b.stone) o += rect(x, top, w, h, b.stone) + path(`M${P(ex, top)}L${P(fx1, fy1)}L${P(fx2, fy2)}L${P(ex, base)}Z`, b.stone);
  if (b.roof) {
    const ov = b.roof.over ?? w * 0.04;
    const rh = b.roof.h;
    const rx0 = x - ov;
    const rx1 = x + w + ov;
    const tiles = patTiles(s, Math.max(6, rh * 0.22), Math.max(5, rh * 0.18), b.roof.color);
    // front slope
    o += path(`M${P(rx0, top + 2)}L${P(x + w * 0.12, top - rh)}L${P(x + w * 0.88, top - rh)}L${P(rx1, top + 2)}Z`, tiles);
    // side slope receding
    const ox = side > 0 ? rx1 : rx0;
    const ix = side > 0 ? x + w * 0.88 : x + w * 0.12;
    const [a1, a2] = toward(ox, top + 2, vp[0], vp[1], depth);
    const [c1, c2] = toward(ix, top - rh, vp[0], vp[1], depth * 0.92);
    o += path(`M${P(ox, top + 2)}L${P(ix, top - rh)}L${P(c1, c2)}L${P(a1, a2)}Z`, shade(b.roof.color, -0.2));
    o += rect(rx0, top + 1, rx1 - rx0, Math.max(2, rh * 0.09), shade(b.roof.color, -0.45));
    o += rect(x, top + 2, w, Math.max(4, h * 0.08), s.lg([[0, '#000', 0.3], [1, '#000', 0]]));
  }
  return o;
}

/** Crenellated wall segment. */
function crenels(x0: number, x1: number, y: number, mw: number, mh: number, gap = 0.55): string {
  let d = '';
  for (let x = x0; x < x1 - mw * 0.5; x += mw * (1 + gap)) d += `M${P(x, y)}h${n(mw)}v${n(-mh)}h${n(-mw)}z`;
  return d;
}

/** Brazier/torch with glow. */
function torch(s: S, x: number, y: number, scale: number, pole: string, glowC = '#ffb347'): string {
  const f = scale;
  let o = `<circle cx="${n(x)}" cy="${n(y - 14 * f)}" r="${n(70 * f)}" fill="${s.rgu([[0, glowC, 0.55], [0.3, glowC, 0.22], [1, glowC, 0]], x, y - 14 * f, 70 * f)}"/>`;
  o += path(`M${P(x - 9 * f, y)}h${n(18 * f)}l${n(-5 * f)},${n(9 * f)}h${n(-8 * f)}z`, pole);
  o += path(`M${P(x, y - 34 * f)}C${P(x + 12 * f, y - 18 * f)} ${P(x + 11 * f, y)} ${P(x, y)}C${P(x - 11 * f, y)} ${P(x - 12 * f, y - 16 * f)} ${P(x - 3 * f, y - 26 * f)}C${P(x - 2 * f, y - 20 * f)} ${P(x + 1 * f, y - 22 * f)} ${P(x, y - 34 * f)}Z`, '#ff7a1a');
  o += path(`M${P(x, y - 22 * f)}C${P(x + 6 * f, y - 12 * f)} ${P(x + 6 * f, y)} ${P(x, y)}C${P(x - 6 * f, y)} ${P(x - 6 * f, y - 10 * f)} ${P(x, y - 22 * f)}Z`, '#ffe27a');
  return o;
}

/** Tiny legionary / figure silhouette (for life in the mid-ground). */
function figure(x: number, base: number, h: number, body: string, accent: string, spear = true, dir = 1): string {
  const u = h / 10;
  let o = path(`M${P(x - 1.4 * u, base)}L${P(x - 1.1 * u, base - 4 * u)}L${P(x - 1.8 * u, base - 7.6 * u)}Q${P(x, base - 8.4 * u)} ${P(x + 1.8 * u, base - 7.6 * u)}L${P(x + 1.1 * u, base - 4 * u)}L${P(x + 1.4 * u, base)}Z`, body);
  o += `<circle cx="${n(x)}" cy="${n(base - 9 * u)}" r="${n(1.1 * u)}" fill="${body}"/>`;
  o += path(`M${P(x - 1.3 * u, base - 9.6 * u)}Q${P(x, base - 11.4 * u)} ${P(x + 1.3 * u, base - 9.6 * u)}Z`, accent);
  o += rect(x + dir * 0.6 * u - (dir < 0 ? 2.4 * u : 0), base - 7 * u, 2.4 * u, 4.6 * u, accent, `rx="${n(0.5 * u)}"`);
  if (spear) o += stroke(`M${P(x - dir * 2 * u, base)}L${P(x - dir * 2 * u, base - 13 * u)}`, body, Math.max(0.8, 0.35 * u));
  return o;
}

/** Clumps of grass blades (filled, two-tone) scattered in a rect. */
function tufts(s: S, x0: number, x1: number, y0: number, y1: number, count: number, dark: string, light: string, hMax: number): string {
  let dk = '';
  let lt = '';
  for (let i = 0; i < count; i++) {
    const x = s.rnd(x0, x1);
    const y = s.rnd(y0, y1);
    const blades = 5 + Math.floor(s.r.next() * 4);
    for (let b = 0; b < blades; b++) {
      const a = -Math.PI / 2 + s.rnd(-0.75, 0.75);
      const h = hMax * s.rnd(0.45, 1);
      const bx = x + s.rnd(-8, 8);
      const tx = bx + Math.cos(a) * h;
      const ty = y + Math.sin(a) * h;
      const w = h * 0.07;
      const d = `M${P(bx - w, y)}Q${P(bx + (tx - bx) * 0.3 - w, y + (ty - y) * 0.6)} ${P(tx, ty)}Q${P(bx + (tx - bx) * 0.3 + w, y + (ty - y) * 0.6)} ${P(bx + w, y)}Z`;
      if (b % 2) lt += d;
      else dk += d;
    }
  }
  return path(dk, dark) + path(lt, light);
}

/** Inlaid floor medallion seen in perspective (rings + star). */
function medallion(cx: number, cy: number, r: number, squash: number, ring: string, inner: string, star: string): string {
  return (
    `<g transform="translate(${n(cx)} ${n(cy)}) scale(1 ${n(squash)})">` +
    `<circle r="${n(r)}" fill="${ring}"/><circle r="${n(r * 0.88)}" fill="${inner}"/>` +
    `<circle r="${n(r * 0.8)}" fill="none" stroke="${ring}" stroke-width="${n(r * 0.03)}"/>` +
    `<path d="${starPath8(0, 0, r * 0.72, r * 0.3)}" fill="${star}"/><circle r="${n(r * 0.16)}" fill="${ring}"/></g>`
  );
}

function starPath8(cx: number, cy: number, r: number, ri: number): string {
  let d = '';
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 8;
    const rr = i % 2 ? ri : r;
    d += (i ? 'L' : 'M') + P(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  return d + 'Z';
}

/** Soaring eagle silhouette. */
function soaringEagle(x: number, y: number, sc: number, color: string): string {
  return path(
    `M${P(x, y)}c${n(-10 * sc)},${n(-6 * sc)} ${n(-30 * sc)},${n(-14 * sc)} ${n(-56 * sc)},${n(-10 * sc)}l${n(8 * sc)},${n(4 * sc)}l${n(-6 * sc)},${n(2 * sc)}l${n(8 * sc)},${n(3 * sc)}l${n(-4 * sc)},${n(3 * sc)}c${n(18 * sc)},${n(0)} ${n(34 * sc)},${n(4 * sc)} ${n(48 * sc)},${n(10 * sc)}l${n(-2 * sc)},${n(12 * sc)}l${n(6 * sc)},${n(-4 * sc)}l${n(6 * sc)},${n(4 * sc)}l${n(-2 * sc)},${n(-12 * sc)}c${n(14 * sc)},${n(-6 * sc)} ${n(30 * sc)},${n(-10 * sc)} ${n(48 * sc)},${n(-10 * sc)}l${n(-4 * sc)},${n(-3 * sc)}l${n(8 * sc)},${n(-3 * sc)}l${n(-6 * sc)},${n(-2 * sc)}l${n(8 * sc)},${n(-4 * sc)}c${n(-26 * sc)},${n(-4 * sc)} ${n(-46 * sc)},${n(4 * sc)} ${n(-56 * sc)},${n(10 * sc)}z` +
      `M${P(x - 3 * sc, y - 1 * sc)}q${n(3 * sc)},${n(-8 * sc)} ${n(7 * sc)},${n(-2 * sc)}z`,
    color,
  );
}

/** Subtle warm frame vignette (never muddy). */
function vignette(s: S, color: string, strength = 0.35): void {
  s.add(rect(0, 0, W, H, s.rgu([[0.55, color, 0], [0.85, color, strength * 0.6], [1, color, strength]], W / 2, H * 0.48, W * 0.62, 0.78)));
}


// ================================================================== scenes

/** 0 · The Dust Pits — sunrise over a ludus training yard. */
function dustPits(s: S): void {
  s.lit = 1;
  const HY = 520; // sand horizon
  sky(s, [[0, '#4a5fa0'], [0.3, '#a07fb4'], [0.5, '#f0a088'], [0.62, '#ffc48a'], [0.75, '#ffe2a8']]);
  sun(s, 860, 430, 48, '#fff6dc', '#ffc982', 620, 0.85);
  shafts(s, 860, 430, -Math.PI * 0.97, -Math.PI * 0.03, 14, 1000, '#fff0c8', 0.2);
  cloud(s, 230, 210, 420, 95, '#ffe6cf', '#d98e98');
  cloud(s, 1370, 170, 460, 110, '#ffe3c8', '#cf8496');
  cloud(s, 640, 120, 200, 46, '#ffe9d6', '#e3a2a6', 0.85);
  cloud(s, 1080, 285, 230, 44, '#fff0d8', '#eeb0a0', 0.8);
  cloud(s, 120, 360, 260, 40, '#ffe8c8', '#f0b090', 0.7);
  birds(s, 1010, 250, 7, 70, '#7a4a5e', 9);
  birds(s, 520, 300, 3, 30, '#8a5a6a', 7);
  // far hazy mountains
  mountains(s, HY - 40, [[80, 120, 220], [330, 160, 230], [560, 110, 200], [1150, 140, 240], [1400, 175, 250], [1580, 120, 180]], '#c896ab', '#e9b6ae');
  haze(s, 300, HY - 30, '#ffd3a8', 0, 0.55);
  // distant aqueduct
  const aq = '#d2958f';
  s.add(rect(940, 398, 660, 14, aq));
  s.add(path(`M940,412h660v60h-660z` + archHoles(940, 412, 660, 60, 15, 0.6, 0.62), aq, 'fill-rule="evenodd"'));
  // distant hill town on the left
  let town = '';
  for (let i = 0; i < 9; i++) {
    const x = 380 + i * 34 + s.rnd(-6, 6);
    const h = s.rnd(16, 34);
    town += `M${P(x, 462)}v${n(-h)}l${n(14)},${n(-8)}l${n(14)},${n(8)}v${n(h)}z`;
  }
  s.add(path(town, '#d29a96'));
  // rolling mid hills with trees
  s.add(hills(s, 492, 28, 6, '#c99070'));
  let trees = '';
  for (let i = 0; i < 12; i++) {
    const x = 60 + i * 135 + s.rnd(-30, 30);
    if (x > 600 && x < 1000) continue;
    trees += cypress(s, x, 492 + s.rnd(-6, 8), s.rnd(40, 70), 12, '#8a6a5e', '#c99a7e');
  }
  s.add(trees, umbrellaPine(s, 1290, 494, 70, 90, '#8a6058', '#9a7a62', '#c8a080'));
  haze(s, 380, HY + 10, '#ffd8b0', 0, 0.45);
  // sand yard
  s.add(rect(0, HY - 30, W, H - HY + 30, s.lg([[0, '#ffd9a0'], [0.25, '#f2bf84'], [1, '#d8925a']])));
  // sun reflection on sand
  s.add(ell(860, HY + 40, 520, 90, s.rgu([[0, '#fff2cf', 0.75], [1, '#fff2cf', 0]], 860, HY + 40, 520, 0.18)));
  // rake marks
  let rake = '';
  for (let i = 0; i < 16; i++) {
    const y = HY + 30 + i * i * 1.6 + i * 10;
    rake += `M${P(-50, y + 30)}Q800,${n(y - 25 - i * 2)} 1650,${n(y + 30)}`;
  }
  s.add(stroke(rake, '#b8743f', 2, op(0.22)), stroke(rake.replace(/(\d+\.?\d*),(\d+\.?\d*)/g, (_m, a, b) => `${a},${n(+b + 3)}`), '#fff0cf', 1.6, op(0.3)));
  s.add(speckles(s, 0, HY, W, H, 260, '#a8653a', 0.35, 3));
  // palisade ring behind the yard
  let stakesL = '';
  let stakesD = '';
  for (let x = 330; x < 1290; x += 15) {
    const t = (x - 800) / 480;
    const base = HY + 4 - t * t * 0 + Math.abs(t) * 14;
    const h = 44 + Math.abs(t) * 30 + s.rnd(-5, 5);
    const d = `M${P(x, base)}V${n(base - h)}l7,-11l7,11V${n(base)}Z`;
    if ((x / 15) % 2 < 1) stakesL += d;
    else stakesD += d;
  }
  s.add(path(stakesD, '#8a5632'), path(stakesL, '#a8693c'));
  s.add(stroke('M330,488Q800,484 1290,488M330,506Q800,502 1290,506', '#5e3418', 4, op(0.85)));
  // rim light on stake tips
  s.add(stroke('M330,446Q800,438 1290,446', '#ffd79a', 2, op(0)));
  // gate in palisade
  s.add(path('M740,522V448q60,-40 120,0V522Z', '#6a3a1c'), path('M752,522V454q48,-32 96,0V522Z', '#ffe0a8', op(0.75)));
  s.add(rect(728, 430, 14, 94, '#7a4626'), rect(858, 430, 14, 94, '#7a4626'));
  // left barracks
  const vp: [number, number] = [800, 470];
  const stone = patStone(s, 46, 20, '#6e3a20', '#ffe0b0', 0.25, 0.2);
  s.add(box(s, { x: -40, base: 640, w: 430, h: 280, depth: 0.22, side: 1, vp, front: s.lg([[0, '#d99a6a'], [1, '#b8754c']]), sideC: s.lg([[0, '#ffcf92'], [1, '#e8a466']], 0, 0, 1, 0), roof: { h: 70, color: '#c4553a' }, stone }));
  // barracks windows & arcade
  s.add(path(archHoles(-20, 520, 380, 120, 4, 0.58, 0.62), s.lg([[0, '#4a2414'], [1, '#7a3a20']])));
  let win = '';
  for (let i = 0; i < 5; i++) win += `M${P(10 + i * 74, 400)}h26v36h-26z`;
  s.add(path(win, '#4a2414'), stroke(win.replace(/M(\d+)/g, (_m, a) => `M${a}`), '#ffd9a0', 1.5, op(0.5)));
  // wooden balcony
  s.add(rect(-40, 470, 430, 10, '#6e3c1e'), rect(-40, 452, 430, 4, '#8a5030'));
  let rail = '';
  for (let x = -30; x < 390; x += 14) rail += `M${n(x)},456v14`;
  s.add(stroke(rail, '#6e3c1e', 4), rect(-40, 480, 430, 16, s.lg([[0, '#000', 0.25], [1, '#000', 0]])));
  // hanging banners on barracks
  s.add(hangingBanner(s, 60, 300, 42, 120, '#c0392b', '#f0c060', `<circle cx="81" cy="352" r="9" fill="none" stroke="#f0c060" stroke-width="3"/>`));
  s.add(hangingBanner(s, 250, 300, 42, 120, '#c0392b', '#f0c060', `<circle cx="271" cy="352" r="9" fill="none" stroke="#f0c060" stroke-width="3"/>`));
  // right building: two-storey tower house
  s.add(box(s, { x: 1235, base: 630, w: 420, h: 330, depth: 0.2, side: -1, vp, front: s.lg([[0, '#dca070'], [1, '#b8764c']]), sideC: s.lg([[0, '#e8a466'], [1, '#ffd49a']], 0, 0, 1, 0), roof: { h: 80, color: '#c4553a' }, stone }));
  s.add(path(archHoles(1255, 520, 360, 110, 3, 0.55, 0.62), s.lg([[0, '#4a2414'], [1, '#7a3a20']])));
  let win2 = '';
  for (let i = 0; i < 4; i++) win2 += `M${P(1272 + i * 86, 360)}h28v46h-28z`;
  s.add(path(win2, '#4a2414'));
  s.add(hangingBanner(s, 1300, 430, 40, 90, '#e8b04b', '#b4442b'), hangingBanner(s, 1480, 430, 40, 90, '#e8b04b', '#b4442b'));
  // pennant flags on roofs
  s.add(flag(s, 205, 196, 70, 30, '#c0392b', '#5a3018', 1, 0.6), flag(s, 1430, 168, 70, 30, '#c0392b', '#5a3018', -1, 1.4));
  // training posts (palus) with long shadows toward viewer
  const post = (x: number, base: number, h: number) => {
    const w = h * 0.12;
    return (
      path(`M${P(x - w / 2, base)}L${P(x + w / 2, base)}L${P(x + (x - 860) * 0.5 + w, base + h * 0.9)}L${P(x + (x - 860) * 0.5 - w, base + h * 0.9)}Z`, '#8a4a28', op(0.28)) +
      rect(x - w / 2, base - h, w, h, s.lg([[0, '#ffc98a'], [0.4, '#a8693c'], [1, '#6a3a1c']], 0, 0, 1, 0)) +
      stroke(`M${P(x - w / 2, base - h * 0.62)}h${n(w)}M${P(x - w / 2, base - h * 0.55)}h${n(w)}M${P(x - w / 2, base - h * 0.3)}h${n(w)}`, '#e8c890', 2.5) +
      ell(x, base - h, w / 2, w * 0.18, '#c98d58')
    );
  };
  s.add(post(470, 600, 110), post(560, 570, 80), post(1110, 590, 100), post(1190, 625, 120));
  // weapon rack (left) with wooden swords and shields
  const rack = (x: number, y: number, sc: number) => {
    let o = rect(x, y - 70 * sc, 6 * sc, 70 * sc, '#5e3418') + rect(x + 84 * sc, y - 70 * sc, 6 * sc, 70 * sc, '#5e3418');
    o += rect(x - 4 * sc, y - 58 * sc, 98 * sc, 6 * sc, '#7a4626') + rect(x - 4 * sc, y - 22 * sc, 98 * sc, 6 * sc, '#7a4626');
    let sw = '';
    for (let i = 0; i < 6; i++) sw += `M${P(x + (12 + i * 13) * sc, y - 78 * sc)}v${n(56 * sc)}`;
    o += stroke(sw, '#d8a868', 4 * sc, 'stroke-linecap="round"');
    o += stroke(sw.replace(/v[\d.]+/g, `v${n(10 * sc)}`), '#6a3a1c', 7 * sc);
    return o;
  };
  s.add(rack(300, 660, 1.1));
  // scutum shields leaning
  const scutum = (x: number, y: number, w: number, h: number, c: string, rot: number) =>
    g(
      rect(-w / 2, -h, w, h, s.lg([[0, shade(c, 0.25)], [0.5, c], [1, shade(c, -0.3)]], 0, 0, 1, 0), `rx="${n(w * 0.18)}"`) +
        stroke(`M0,${n(-h)}V0M${n(-w / 2)},${n(-h / 2)}H${n(w / 2)}`, '#f0c060', w * 0.07) +
        `<circle cx="0" cy="${n(-h / 2)}" r="${n(w * 0.16)}" fill="#f0c060"/>`,
      `transform="translate(${n(x)} ${n(y)}) rotate(${n(rot)})"`,
    );
  s.add(scutum(420, 705, 48, 86, '#b4442b', -8), scutum(1270, 712, 50, 90, '#2f6db3', 9), scutum(1215, 700, 44, 80, '#b4442b', 4));
  // sparring figures
  s.add(figure(640, 560, 40, '#5e3020', '#b4442b', false, 1), figure(690, 560, 40, '#5e3020', '#e8b04b', true, -1));
  s.add(figure(1010, 552, 34, '#5e3020', '#2f6db3', true, 1));
  // foreground: amphorae, barrel, grass tufts
  const amph = (x: number, y: number, sc: number) =>
    path(`M${P(x - 6 * sc, y - 70 * sc)}h${n(12 * sc)}v${n(8 * sc)}q${n(22 * sc)},${n(10 * sc)} ${n(18 * sc)},${n(34 * sc)}q${n(-4 * sc)},${n(20 * sc)} ${n(-15 * sc)},${n(28 * sc)}h${n(-18 * sc)}q${n(-11 * sc)},${n(-8 * sc)} ${n(-15 * sc)},${n(-28 * sc)}q${n(-4 * sc)},${n(-24 * sc)} ${n(18 * sc)},${n(-34 * sc)}z`, s.lg([[0, '#f0a070'], [0.45, '#c4683c'], [1, '#7a3418']], 0, 0, 1, 0));
  s.add(amph(70, 880, 2.1), amph(150, 900, 1.7), amph(1520, 890, 2));
  // foreground dropped rudis + small shield in sand (visible in phone crop)
  s.add(g(rect(-80, -6, 160, 12, '#c8955c', 'rx="4"') + rect(-96, -10, 22, 20, '#6a3a1c', 'rx="3"'), 'transform="translate(760 820) rotate(-12)"'));
  s.add(ell(880, 838, 52, 18, '#9a5a30', op(0.35)), ell(880, 828, 50, 22, s.lg([[0, '#f0c060'], [1, '#b4442b']])), ell(880, 826, 12, 5, '#ffe2a0'));
  s.add(tufts(s, -20, 300, 850, 900, 7, '#8a7a3a', '#d8c070', 60), tufts(s, 1330, 1620, 850, 900, 7, '#8a7a3a', '#d8c070', 60));
  s.add(ell(200, 645, 320, 16, '#7a3a1c', op(0.25)), ell(1420, 636, 300, 16, '#7a3a1c', op(0.25)));
  vignette(s, '#7a3a28', 0.32);
}

/** Leather contubernium tent seen in 3/4 (front gable + receding roof). */
function tent(s: S, x: number, base: number, w: number, h: number, vp: [number, number], depth: number, cloth: string, flap: string): string {
  const apex: [number, number] = [x, base - h];
  const l: [number, number] = [x - w / 2, base];
  const r: [number, number] = [x + w / 2, base];
  const far = (p: [number, number]) => toward(p[0], p[1], vp[0], vp[1], depth);
  const fa = far(apex);
  const side = x < vp[0] ? 1 : -1; // visible roof slope faces the centre
  const edge = side > 0 ? r : l;
  const fe = far(edge);
  let o = path(`M${P(apex[0], apex[1])}L${P(fa[0], fa[1])}L${P(fe[0], fe[1])}L${P(edge[0], edge[1])}Z`, s.lg([[0, shade(cloth, 0.12)], [1, shade(cloth, -0.12)]]));
  // seams on roof
  let seams = '';
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    const a = toward(apex[0], apex[1], vp[0], vp[1], depth * t);
    const b = toward(edge[0], edge[1], vp[0], vp[1], depth * t);
    seams += `M${P(a[0], a[1])}L${P(b[0], b[1])}`;
  }
  o += stroke(seams, shade(cloth, -0.35), Math.max(0.8, w * 0.012), op(0.5));
  o += path(`M${P(apex[0], apex[1])}L${P(l[0], l[1])}L${P(r[0], r[1])}Z`, s.lg([[0, shade(cloth, -0.05)], [1, shade(cloth, -0.28)]]));
  o += path(`M${P(apex[0], apex[1] + h * 0.18)}L${P(x - w * 0.18, base)}L${P(x + w * 0.18, base)}Z`, flap);
  o += stroke(`M${P(apex[0], apex[1] - h * 0.12)}V${n(base)}`, '#5a3a20', Math.max(1, w * 0.02));
  return o;
}

/** Side wing of a building receding toward vp: returns quad + arched bays. */
function wing(
  sideSign: 1 | -1, vp: [number, number], xNear: number, yTop: number, yBot: number, T: number,
  bays: number, wall: string, hole: string, ratio = 0.6,
): string {
  const A = toward(xNear, yTop, vp[0], vp[1], T);
  const B = toward(xNear, yBot, vp[0], vp[1], T);
  let o = path(`M${P(xNear, yTop)}L${P(A[0], A[1])}L${P(B[0], B[1])}L${P(xNear, yBot)}Z`, wall);
  // geometric spacing for perspective foreshortening
  const rr = 0.78;
  const ts: number[] = [];
  let tot = 0;
  for (let k = 0; k < bays; k++) tot += Math.pow(rr, k);
  let acc = 0;
  for (let k = 0; k <= bays; k++) {
    ts.push((T * acc) / tot);
    acc += Math.pow(rr, k);
  }
  let d = '';
  for (let k = 0; k < bays; k++) {
    const t0 = ts[k] + (ts[k + 1] - ts[k]) * (1 - ratio) * 0.5;
    const t1 = ts[k + 1] - (ts[k + 1] - ts[k]) * (1 - ratio) * 0.5;
    const yS = yTop + (yBot - yTop) * 0.42;
    const p0 = toward(xNear, yBot, vp[0], vp[1], t0);
    const p1 = toward(xNear, yS, vp[0], vp[1], t0);
    const p2 = toward(xNear, yS, vp[0], vp[1], t1);
    const p3 = toward(xNear, yBot, vp[0], vp[1], t1);
    const top = toward(xNear, yTop + (yBot - yTop) * 0.12, vp[0], vp[1], (t0 + t1) / 2);
    d += `M${P(p0[0], p0[1])}L${P(p1[0], p1[1])}Q${P(p1[0] + (p2[0] - p1[0]) * 0.05, top[1])} ${P((p1[0] + p2[0]) / 2, top[1])}Q${P(p2[0] - (p2[0] - p1[0]) * 0.05, top[1])} ${P(p2[0], p2[1])}L${P(p3[0], p3[1])}Z`;
  }
  void sideSign;
  return o + path(d, hole);
}

/** Roman standard: vexillum (square flag on crossbar) or aquila. */
function standard(s: S, x: number, base: number, h: number, kind: 'vex' | 'aquila', red: string, gold: string): string {
  const u = h / 100;
  let o = stroke(`M${P(x, base)}V${n(base - h)}`, '#4a2a14', Math.max(1.5, 2.2 * u));
  if (kind === 'vex') {
    o += stroke(`M${P(x - 16 * u, base - h * 0.86)}H${n(x + 16 * u)}`, gold, 2.2 * u);
    o += path(`M${P(x - 15 * u, base - h * 0.86)}h${n(30 * u)}v${n(30 * u)}q${n(-15 * u)},${n(4 * u)} ${n(-30 * u)},0z`, s.lg([[0, shade(red, 0.15)], [0.5, red], [1, shade(red, -0.25)]], 0, 0, 1, 0));
    let fr = '';
    for (let i = 0; i < 7; i++) fr += `M${P(x - 14 * u + i * 4.6 * u, base - h * 0.86 + 31 * u)}v${n(6 * u)}`;
    o += stroke(fr, gold, 1.4 * u);
    o += `<circle cx="${n(x)}" cy="${n(base - h * 0.86 + 14 * u)}" r="${n(5 * u)}" fill="none" stroke="${gold}" stroke-width="${n(1.6 * u)}"/>`;
    o += path(`M${P(x, base - h - 6 * u)}l${n(4 * u)},${n(7 * u)}h${n(-8 * u)}z`, gold);
  } else {
    const y = base - h;
    o += path(`M${P(x, y - 4 * u)}c${n(-6 * u)},${n(-2 * u)} ${n(-14 * u)},${n(-12 * u)} ${n(-20 * u)},${n(-10 * u)}c${n(4 * u)},${n(5 * u)} ${n(8 * u)},${n(12 * u)} ${n(16 * u)},${n(13 * u)}l${n(4 * u)},${n(6 * u)}l${n(4 * u)},${n(-6 * u)}c${n(8 * u)},${n(-1 * u)} ${n(12 * u)},${n(-8 * u)} ${n(16 * u)},${n(-13 * u)}c${n(-6 * u)},${n(-2 * u)} ${n(-14 * u)},${n(8 * u)} ${n(-20 * u)},${n(10 * u)}z`, gold);
    o += `<circle cx="${n(x)}" cy="${n(y - 7 * u)}" r="${n(3 * u)}" fill="${gold}"/>`;
    o += rect(x - 8 * u, y + 4 * u, 16 * u, 4 * u, gold);
    o += `<circle cx="${n(x)}" cy="${n(y + 22 * u)}" r="${n(9 * u)}" fill="none" stroke="${gold}" stroke-width="${n(2.4 * u)}"/>`;
    o += path(`M${P(x - 12 * u, y + 36 * u)}h${n(24 * u)}v${n(18 * u)}q${n(-12 * u)},${n(4 * u)} ${n(-24 * u)},0z`, red);
    o += stroke(`M${P(x - 14 * u, y + 36 * u)}h${n(28 * u)}`, gold, 2 * u);
  }
  return o;
}

/** Wooden watchtower. */
function watchtower(s: S, x: number, base: number, h: number, wood: string, roof: string): string {
  const w = h * 0.34;
  const top = base - h;
  let o = '';
  // legs
  o += stroke(`M${P(x - w / 2, base)}L${P(x - w * 0.38, top + h * 0.25)}M${P(x + w / 2, base)}L${P(x + w * 0.38, top + h * 0.25)}`, shade(wood, -0.15), w * 0.09);
  let br = '';
  for (let i = 0; i < 3; i++) {
    const y0 = base - (h * 0.75 * i) / 3;
    const y1 = base - (h * 0.75 * (i + 1)) / 3;
    br += `M${P(x - w * 0.48, y0)}L${P(x + w * 0.42, y1)}M${P(x + w * 0.48, y0)}L${P(x - w * 0.42, y1)}M${P(x - w * 0.46, y1)}H${n(x + w * 0.46)}`;
  }
  o += stroke(br, shade(wood, -0.3), w * 0.04);
  // cabin
  const cy = top + h * 0.12;
  o += rect(x - w * 0.55, cy, w * 1.1, h * 0.14, s.lg([[0, shade(wood, 0.25)], [0.5, wood], [1, shade(wood, -0.3)]], 0, 0, 1, 0));
  let planks = '';
  for (let i = 1; i < 7; i++) planks += `M${P(x - w * 0.55 + (w * 1.1 * i) / 7, cy)}v${n(h * 0.14)}`;
  o += stroke(planks, shade(wood, -0.4), 1.2, op(0.6));
  o += rect(x - w * 0.45, cy - h * 0.09, w * 0.9, h * 0.09, '#2a1a10', op(0.75));
  o += path(`M${P(x - w * 0.72, cy - h * 0.08)}L${P(x, top - h * 0.06)}L${P(x + w * 0.72, cy - h * 0.08)}Z`, s.lg([[0, shade(roof, 0.15)], [1, shade(roof, -0.2)]], 0, 0, 1, 0));
  o += stroke(`M${P(x - w * 0.5, cy)}V${n(cy - h * 0.09)}M${P(x + w * 0.5, cy)}V${n(cy - h * 0.09)}`, wood, w * 0.06);
  return o;
}

/** 1 · The Legion Camp — green hills, rows of tents, standards, watchtower. */
function legionCamp(s: S): void {
  s.lit = 1;
  const HY = 488;
  const vp: [number, number] = [800, HY - 6];
  sky(s, [[0, '#3f8fd8'], [0.45, '#8cc8ee'], [0.68, '#d6eef6'], [0.8, '#f4f0d8']]);
  sun(s, 300, 120, 34, '#fffbe8', '#fff1c0', 420, 0.7);
  shafts(s, 300, 120, 0.05, Math.PI * 0.55, 9, 900, '#fffbe0', 0.12);
  cloud(s, 620, 150, 330, 100, '#ffffff', '#b8d4ea');
  cloud(s, 1260, 120, 470, 130, '#ffffff', '#aecbe6');
  cloud(s, 1000, 260, 240, 60, '#ffffff', '#c4dcee', 0.9);
  cloud(s, 140, 290, 300, 60, '#ffffff', '#c8def0', 0.85);
  birds(s, 1000, 220, 5, 60, '#3a5a7a', 8);
  s.add(soaringEagle(780, 170, 1.4, '#3a3040'));
  mountains(s, HY - 40, [[140, 150, 230], [420, 200, 260], [700, 130, 210], [1000, 170, 240], [1290, 230, 260], [1540, 160, 220]], '#7ea6c8', '#b4d0e6', '#f4f8fc');
  haze(s, 260, HY - 20, '#e4f0f4', 0, 0.6);
  s.add(hills(s, HY - 30, 40, 5, '#88b07e'));
  haze(s, 380, HY, '#e8f0e0', 0, 0.45);
  s.add(hills(s, HY - 8, 26, 7, '#79a85c'));
  // tree line on far hills
  let tl = '';
  for (let i = 0; i < 22; i++) {
    const x = s.rnd(0, W);
    if (x > 620 && x < 980) continue;
    tl += cypress(s, x, HY - s.rnd(10, 30), s.rnd(26, 46), 10, '#4f7a4a', '#7eaa66');
  }
  s.add(tl);
  // camp plain
  s.add(rect(0, HY, W, H - HY, s.lg([[0, '#9cc46a'], [0.35, '#86b452'], [1, '#5f8e38']])));
  // camp road toward the porta praetoria
  s.add(path(`M${P(780, HY + 2)}L${P(820, HY + 2)}L${P(1000, H)}L${P(600, H)}Z`, s.lg([[0, '#e6cf98'], [1, '#c8a46a']])));
  // earth rampart + palisade along the far edge
  s.add(path(`M0,${n(HY + 12)}Q800,${n(HY - 14)} 1600,${n(HY + 12)}V${n(HY + 26)}Q800,${n(HY)} 0,${n(HY + 26)}Z`, '#8a6a3e'));
  let pal = '';
  for (let x = 0; x < W; x += 7) {
    const t = (x - 800) / 800;
    const y = HY + 12 - (1 - t * t) * 26;
    if (x > 760 && x < 840) continue;
    pal += `M${P(x, y)}v-10l3,-4l3,4v10z`;
  }
  s.add(path(pal, '#7a5430'));
  s.add(rect(752, HY - 32, 8, 22, '#6a4426'), rect(840, HY - 32, 8, 22, '#6a4426'), rect(748, HY - 38, 104, 8, '#7a5430'));
  // rows of tents on the ground plane (simple pinhole projection)
  const cloth = ['#e6c48a', '#d8b070', '#ecd29a'];
  const proj = (X: number, Z: number): [number, number, number] => [800 + (X * 700) / Z, HY + (150 * 700) / Z / 1.6, 700 / Z];
  const items: [number, string][] = [];
  for (const side of [-1, 1]) {
    for (const X of [230, 400, 570]) {
      for (let z = 1300; z >= 390; z -= 130) {
        const [sx, sy, f] = proj(side * X, z);
        if (sy > H + 40) continue;
        let t = tent(s, sx, sy, 110 * f, 80 * f, vp, 0.1, cloth[Math.round(z / 130 + X / 170) % 3], '#6a4a2a');
        if (X === 400 && z === 780) t += standard(s, sx - side * 70 * f, sy, 230 * f, 'vex', '#c0392b', '#e8c060');
        items.push([z, t]);
      }
    }
  }
  items.sort((a, b) => b[0] - a[0]);
  s.add(items.map((i) => i[1]).join(''));
  // campfire smoke
  s.add(path('M610,560q-20,-40 6,-80q24,-40 -4,-90q40,40 16,90q-20,40 2,80z', '#ffffff', op(0.35)));
  // watchtower (left edge) and standards (right)
  s.add(watchtower(s, 150, 760, 560, '#a8743e', '#b5473f'));
  s.add(flag(s, 150, 152, 90, 40, '#c0392b', '#5a3018', 1, 0.8));
  s.add(figure(150, 316, 36, '#5a3a24', '#c0392b', true, 1));
  s.add(standard(s, 1360, 800, 420, 'aquila', '#c0392b', '#f0c048'), standard(s, 1470, 820, 470, 'vex', '#c0392b', '#f0c048'));
  s.add(flag(s, 1240, 300, 80, 36, '#2f6db3', '#5a3018', -1, 0.3, '#f0c048'));
  // legionaries in formation
  let men = '';
  for (let i = 0; i < 6; i++) men += figure(470 + i * 22, 600 + i * 3, 36, '#5a3a24', i % 2 ? '#c0392b' : '#b8342a', true, 1);
  for (let i = 0; i < 5; i++) men += figure(1050 + i * 24, 600 - i * 2, 36, '#5a3a24', '#c0392b', true, -1);
  s.add(men);
  // shield and crossed pila planted by the road (phone foreground)
  s.add(stroke('M880,900L940,700M960,900L900,700', '#6a4a2a', 5, 'stroke-linecap="round"'), path('M936,700l4,-24l4,24zM896,700l4,-24l4,24z', '#c8d0d8'));
  s.add(g(rect(-34, -110, 68, 110, s.lg([[0, '#e05040'], [0.5, '#c0392b'], [1, '#7a1f1a']], 0, 0, 1, 0), 'rx="10"') + stroke('M0,-110V0M-34,-55H34', '#f0c048', 5) + `<circle cy="-55" r="12" fill="#f0c048"/>` + path('M-14,-90l14,-10l14,10M-14,-20l14,10l14,-10', 'none', 'stroke="#f0c048" stroke-width="3"'), 'transform="translate(700 890) rotate(-6)"'));
  // foreground: meadow with flowers, pila stack, crate + helmet
  s.add(tufts(s, -20, 420, 820, 910, 12, '#4f7a2e', '#9cc45a', 70), tufts(s, 1180, 1620, 820, 910, 12, '#4f7a2e', '#9cc45a', 70));
  let fl = '';
  let fl2 = '';
  for (let i = 0; i < 70; i++) {
    const x = i % 2 ? s.rnd(0, 520) : s.rnd(1080, 1600);
    const y = s.rnd(640, 900);
    const r = 2 + ((y - 640) / 260) * 5;
    if (i % 3) fl += circ(x, y, r);
    else fl2 += circ(x, y, r);
  }
  s.add(path(fl, '#e0453a'), path(fl2, '#ffe070'));
  s.add(g(rect(-50, -40, 100, 40, s.lg([[0, '#b8844a'], [1, '#7a5028']]), 'rx="3"') + stroke('M-50,-20H50M-20,-40V0M20,-40V0', '#5a3418', 2) + path('M-24,-40q0,-34 24,-34q24,0 24,34z', s.lg([[0, '#f6d68a'], [1, '#b8862b']], 0, 0, 1, 0)) + path('M-6,-74q6,-22 30,-10q-12,6 -30,10z', '#c0392b'), 'transform="translate(1260 860)"'));
  vignette(s, '#2a4a3a', 0.28);
}

/** Fir tree (stacked triangles) for mountain scenes. */
function fir(x: number, base: number, h: number, dark: string, light: string): string {
  let d = '';
  let l = '';
  for (let i = 0; i < 4; i++) {
    const y = base - h * 0.15 - i * h * 0.22;
    const w = h * (0.34 - i * 0.07);
    d += `M${P(x - w, y)}L${P(x, y - h * 0.38)}L${P(x + w, y)}Z`;
    l += `M${P(x - w, y)}L${P(x, y - h * 0.38)}L${P(x - w * 0.05, y)}Z`;
  }
  return rect(x - h * 0.03, base - h * 0.16, h * 0.06, h * 0.16, '#3a2a20') + path(d, dark) + path(l, light);
}

/** Square stone tower with crenels, windows and lit side. */
function stoneTower(s: S, x: number, base: number, w: number, h: number, c: { lit: string; mid: string; dark: string; roof?: string }, stone: string, banner?: string): string {
  const top = base - h;
  let o = rect(x, top, w, h, s.lg([[0, c.lit], [0.6, c.mid], [1, c.dark]], 0, 0, 1, 0));
  o += rect(x, top, w, h, stone);
  o += rect(x - w * 0.06, top - h * 0.02, w * 1.12, h * 0.04, shade(c.mid, 0.1));
  o += path(crenels(x - w * 0.06, x + w * 1.06, top - h * 0.02, w * 0.16, h * 0.06, 0.45), s.lg([[0, c.lit], [1, c.mid]], 0, 0, 1, 0));
  let win = '';
  for (let i = 0; i < 3; i++) {
    const wy = top + h * (0.18 + i * 0.2);
    win += `M${P(x + w * 0.42, wy + h * 0.08)}v${n(-h * 0.05)}a${n(w * 0.08)},${n(w * 0.08)} 0 0,1 ${n(w * 0.16)},0v${n(h * 0.05)}z`;
  }
  o += path(win, '#1e2228');
  if (c.roof) o += path(`M${P(x - w * 0.1, top - h * 0.08)}L${P(x + w / 2, top - h * 0.08 - w * 0.75)}L${P(x + w * 1.1, top - h * 0.08)}Z`, s.lg([[0, shade(c.roof, 0.25)], [0.55, c.roof], [1, shade(c.roof, -0.3)]], 0, 0, 1, 0));
  if (banner) o += hangingBanner(s, x + w * 0.3, top + h * 0.06, w * 0.4, h * 0.42, banner, '#e2b04a', `<path d="${starPath5(x + w * 0.5, top + h * 0.2, w * 0.08)}" fill="#e2b04a"/>`);
  return o;
}

function starPath5(cx: number, cy: number, r: number): string {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    d += (i ? 'L' : 'M') + P(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  return d + 'Z';
}

/** 2 · The Iron Citadel — mountain fortress in morning mist. */
function ironCitadel(s: S): void {
  s.lit = -1;
  sky(s, [[0, '#5d86b4'], [0.4, '#a8c0d4'], [0.62, '#f0dcc0'], [0.75, '#ffe6c4']]);
  sun(s, 1180, 260, 40, '#fff6e0', '#ffe2b0', 480, 0.75);
  shafts(s, 1180, 260, Math.PI * 0.45, Math.PI * 1.15, 10, 1000, '#fff4dc', 0.13);
  cloud(s, 300, 150, 380, 80, '#ffffff', '#b4c4d8', 0.9);
  cloud(s, 1450, 120, 300, 60, '#fff8ee', '#c4c8d8', 0.85);
  // grand snowy range
  mountains(s, 640, [[100, 420, 300], [420, 500, 340], [760, 400, 280], [1060, 460, 320], [1400, 520, 340], [1620, 400, 260]], '#8a9cb8', '#c4d2e2', '#ffffff');
  haze(s, 200, 640, '#eef0f0', 0, 0.6);
  // the citadel on its crag (upper centre, visible in the phone crop)
  const crag = `M520,560L600,420L660,380L700,300L760,262L840,262L900,300L940,380L1000,420L1080,560Z`;
  s.add(path(crag, s.lg([[0, '#8a8c92'], [1, '#6a6e78']], 0, 0, 1, 0)), path('M760,262L700,300L660,380L600,420L520,560L700,560L760,400Z', '#c4c8cc', op(0.6)));
  s.add(path('M840,262L900,300L940,380L1000,420L1080,560L960,560L880,380Z', '#4a5060', op(0.35)));
  let rf = '';
  for (let i = 0; i < 9; i++) rf += fir(560 + i * 60 + s.rnd(-10, 10), 560 - Math.abs(i - 4) * 18 + s.rnd(0, 10), s.rnd(30, 46), '#5a7a6a', '#8aa890');
  s.add(rf);
  const stoneF = patStone(s, 22, 10, '#2a2e36', '#ffffff', 0.3, 0.15);
  const tc = { lit: '#c8ccd4', mid: '#9aa0aa', dark: '#6a707c', roof: '#5a6878' };
  s.add(rect(690, 214, 220, 70, s.lg([[0, '#9aa0aa'], [1, '#c4c8d0']], 0, 0, 1, 0)), rect(690, 214, 220, 70, stoneF), path(crenels(690, 910, 214, 10, 9), '#b4bac4'));
  s.add(stoneTower(s, 660, 300, 56, 150, tc, stoneF), stoneTower(s, 884, 300, 56, 150, tc, stoneF), stoneTower(s, 770, 240, 62, 150, tc, stoneF));
  s.add(path('M790,284v-26a10,10 0 0,1 20,0v26z', '#2a2e36'));
  s.add(flag(s, 801, 60, 46, 22, '#b8342a', '#3a3e46', -1, 0.6), flag(s, 688, 120, 38, 18, '#b8342a', '#3a3e46', -1, 1.6), flag(s, 912, 120, 38, 18, '#b8342a', '#3a3e46', -1, 2.4));
  // switchback road
  s.add(stroke('M800,560L700,500L880,440L760,380L800,300', '#d8c8a8', 6, op(0.7) + ' stroke-linejoin="round"'));
  // mist bands — the calm centre
  haze(s, 330, 620, '#f6f2ea', 0, 0.8);
  cloud(s, 300, 470, 700, 70, '#ffffff', '#e2e6ec', 0.75, 7);
  cloud(s, 1320, 460, 760, 80, '#ffffff', '#e2e6ec', 0.75, 7);
  // mid ridges with firs
  s.add(hills(s, 610, 50, 4, '#7d8f98'));
  let firs = '';
  for (let i = 0; i < 26; i++) {
    const x = s.rnd(0, W);
    if (x > 560 && x < 1040) continue;
    firs += fir(x, 600 + s.rnd(-20, 20), s.rnd(40, 80), '#4c6470', '#7a96a0');
  }
  s.add(firs);
  haze(s, 520, 700, '#f2efe8', 0, 0.5);
  // ground: stone causeway
  s.add(rect(0, 640, W, 260, s.lg([[0, '#9aae8a'], [1, '#5e7a52']])));
  s.add(path('M640,640H960L1180,900H420Z', s.lg([[0, '#e2d6c0'], [1, '#b0a48e']])));
  let pav = '';
  for (let i = 0; i < 9; i++) {
    const y = 646 + i * i * 3.2 + i * 10;
    const t = (y - 640) / 260;
    pav += `M${n(640 - 220 * t)},${n(y)}H${n(960 + 220 * t)}`;
  }
  for (let i = -5; i <= 5; i++) pav += `M${n(800 + i * 30)},640L${n(800 + i * 70)},900`;
  s.add(stroke(pav, '#6a6050', 1.5, op(0.35)));
  s.add(path('M760,640H840L900,900H700Z', '#fff4dc', op(0.25)));
  s.add(tufts(s, 330, 640, 660, 900, 10, '#4c6a40', '#8aaa6a', 40), tufts(s, 960, 1270, 660, 900, 10, '#4c6a40', '#8aaa6a', 40));
  s.add(medallion(800, 838, 120, 0.22, '#a33b2b', '#d6c8ae', '#d6a54a'));
  // foreground fortress walls left/right with iron gates
  const big = patStone(s, 64, 26, '#20242a', '#ffffff', 0.35, 0.18);
  const wallC = { lit: '#b8bec8', mid: '#8a919c', dark: '#565c68' };
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? -40 : 1260;
    s.add(rect(x0, 380, 380, 520, s.lg(side < 0 ? [[0, wallC.dark], [0.7, wallC.mid], [1, wallC.lit]] : [[0, wallC.lit], [0.3, wallC.mid], [1, wallC.dark]], 0, 0, 1, 0)), rect(x0, 380, 380, 520, big));
    s.add(path(crenels(x0, x0 + 380, 380, 34, 30), '#9aa0aa'));
    // iron gate arch
    const gx = x0 + 120;
    s.add(path(`M${gx},900V700a70,70 0 0,1 140,0V900z`, '#1c1f24'));
    let grid = '';
    for (let i = 1; i < 7; i++) grid += `M${gx + i * 20},640V900`;
    for (let j = 0; j < 9; j++) grid += `M${gx},${700 + j * 24}h140`;
    s.add(g(stroke(grid, '#4a505a', 6) + stroke(grid, '#7a828e', 2), `clip-path="url(#${s.id}gc${side > 0 ? 'r' : 'l'})"`));
    s.def(`<clipPath id="${s.id}gc${side > 0 ? 'r' : 'l'}"><path d="M${gx},900V700a70,70 0 0,1 140,0V900z"/></clipPath>`);
    s.add(stroke(`M${gx - 6},900V700a76,76 0 0,1 152,0V900`, '#c8ccd4', 10));
    s.add(hangingBanner(s, x0 + (side < 0 ? 290 : 30), 420, 56, 200, '#a33b2b', '#d6a54a', `<path d="${starPath5(x0 + (side < 0 ? 318 : 58), 480, 14)}" fill="#d6a54a"/>`));
    s.add(torch(s, x0 + (side < 0 ? 300 : 80), 690, 1.2, '#3a3e46'));
  }
  s.add(stoneTower(s, -30, 900, 150, 640, { ...wallC, roof: '#4e5a6a' }, big), stoneTower(s, 1490, 900, 150, 640, { ...wallC, roof: '#4e5a6a' }, big));
  s.add(flag(s, 45, 160, 90, 40, '#b8342a', '#3a3e46', 1, 0.5), flag(s, 1565, 160, 90, 40, '#b8342a', '#3a3e46', -1, 1.5));
  birds(s, 1020, 180, 6, 70, '#3a4a5a', 8);
  vignette(s, '#2a3440', 0.3);
}

/** Striped awning (scalloped). */
function awning(s: S, x: number, y: number, w: number, h: number, c1: string, c2: string, stripes = 10): string {
  let a = '';
  let b = '';
  const sw = w / stripes;
  for (let i = 0; i < stripes; i++) {
    const d = `M${P(x + i * sw, y)}h${n(sw)}l${n(sw * 0.06)},${n(h)}q${n(-sw * 0.56)},${n(h * 0.28)} ${n(-sw * 1.12)},0z`;
    if (i % 2) a += d;
    else b += d;
  }
  return path(a, c1) + path(b, c2) + rect(x, y, w, h, s.lg([[0, '#000', 0], [1, '#000', 0.18]])) + rect(x - 4, y - 4, w + 8, 6, shade(c1, -0.35));
}

/** 3 · The Gladiator's Court — sandstone arcade courtyard with palms and fountain. */
function gladiatorsCourt(s: S): void {
  s.lit = 1;
  const vp: [number, number] = [800, 470];
  sky(s, [[0, '#ff9a5a'], [0.25, '#ffc27e'], [0.45, '#ffe6b8']]);
  sun(s, 460, 90, 40, '#fff6dc', '#fff0c0', 420, 0.8);
  cloud(s, 820, 70, 360, 60, '#fff4e4', '#f2b48a', 0.9);
  cloud(s, 1380, 50, 300, 50, '#fff4e4', '#f2b48a', 0.8);
  birds(s, 1100, 110, 6, 50, '#8a4a2a', 7);
  // far rooftops
  let roofs = '';
  for (let i = 0; i < 10; i++) roofs += `M${P(380 + i * 90, 200)}l45,-22l45,22z`;
  s.add(path(roofs, '#d88a5a'), rect(380, 198, 900, 30, '#e6b484'));
  // back arcade: two storeys across the top
  const sand = { lit: '#f6d39c', mid: '#e0b77e', dark: '#b07a44' };
  const st = patStone(s, 40, 16, '#8c5a2b', '#fff0d0', 0.22, 0.2);
  const bx0 = 300;
  const bx1 = 1300;
  s.add(rect(bx0, 210, bx1 - bx0, 280, s.lg([[0, sand.lit], [1, sand.mid]])), rect(bx0, 210, bx1 - bx0, 280, st));
  s.add(path(archHoles(bx0 + 10, 230, bx1 - bx0 - 20, 100, 9, 0.62, 0.6), s.lg([[0, '#7a3e1a'], [1, '#a85a2a']])));
  s.add(path(archHoles(bx0 + 10, 350, bx1 - bx0 - 20, 140, 7, 0.62, 0.6), s.lg([[0, '#6a3214'], [1, '#b06a36']])));
  s.add(rect(bx0 - 10, 330, bx1 - bx0 + 20, 14, sand.lit), rect(bx0 - 10, 344, bx1 - bx0 + 20, 8, sand.dark, op(0.6)));
  s.add(rect(bx0 - 10, 200, bx1 - bx0 + 20, 14, sand.lit), path(crenels(bx0 - 10, bx1 + 10, 200, 14, 8, 1.2), sand.mid));
  s.add(awning(s, bx0 + 20, 236, bx1 - bx0 - 40, 26, '#c8302a', '#fff0d8', 30));
  s.add(rect(bx0, 262, bx1 - bx0, 18, s.lg([[0, '#000', 0.22], [1, '#000', 0]])));
  // side wings in perspective (two storeys)
  for (const side of [-1, 1] as const) {
    const xn = side < 0 ? -10 : 1610;
    const wallG = s.lg(side < 0 ? [[0, sand.mid], [1, sand.lit]] : [[0, sand.dark], [1, sand.mid]], 0, 0, 1, 0);
    s.add(wing(side, vp, xn, 60, 360, 0.62, 5, wallG, '#7a3e1a', 0.6));
    s.add(wing(side, vp, xn, 360, 830, 0.62, 5, wallG, s.lg([[0, '#5a2a10'], [1, '#a05a2a']]), 0.62));
    // cornice lines
    const a = toward(xn, 360, vp[0], vp[1], 0.62);
    const b = toward(xn, 60, vp[0], vp[1], 0.62);
    s.add(stroke(`M${P(xn, 360)}L${P(a[0], a[1])}`, sand.lit, 14), stroke(`M${P(xn, 60)}L${P(b[0], b[1])}`, sand.lit, 18));
    // big awning swag on wing
    const c = toward(xn, 60, vp[0], vp[1], 0.0);
    const d2 = toward(xn, 60, vp[0], vp[1], 0.6);
    let aw = '';
    let aw2 = '';
    for (let i = 0; i < 8; i++) {
      const t0 = 0.6 * (1 - Math.pow(0.8, i)) / (1 - Math.pow(0.8, 8));
      const t1 = 0.6 * (1 - Math.pow(0.8, i + 1)) / (1 - Math.pow(0.8, 8));
      const p0 = toward(xn, 60, vp[0], vp[1], t0);
      const p1 = toward(xn, 60, vp[0], vp[1], t1);
      const q0 = toward(xn, 160, vp[0], vp[1], t0);
      const q1 = toward(xn, 160, vp[0], vp[1], t1);
      const dd = `M${P(p0[0], p0[1])}L${P(p1[0], p1[1])}L${P(q1[0], q1[1])}Q${P((q0[0] + q1[0]) / 2, (q0[1] + q1[1]) / 2 + 30 * (1 - t0))} ${P(q0[0], q0[1])}Z`;
      if (i % 2) aw += dd;
      else aw2 += dd;
    }
    void c;
    void d2;
    s.add(path(aw, '#c8302a'), path(aw2, '#fff0d8'));
  }
  // courtyard floor
  s.add(path(`M300,490H1300L1610,830V900H-10V830Z`, s.lg([[0, '#f2cf98'], [1, '#d49a5e']])));
  let tiles = '';
  for (let i = -10; i <= 10; i++) tiles += `M${n(800 + i * 52)},490L${n(800 + i * 170)},900`;
  for (let j = 0; j < 9; j++) tiles += `M0,${n(500 + j * j * 5 + j * 6)}H1600`;
  s.add(stroke(tiles, '#a86a36', 1.4, op(0.3)));
  // central mosaic ring
  s.add(medallion(800, 640, 400, 0.26, '#2c7a7b', '#f6dcaa', '#c8302a'));
  // long sunlight band across floor
  s.add(path('M300,490L1300,490L1500,620L80,700Z', '#fff6dc', op(0.18)));
  // palms
  s.add(palm(s, 240, 820, 520, 0.35, '#9a6a3e', '#2f7a50', '#6ab060'), palm(s, 1370, 830, 540, -0.32, '#9a6a3e', '#2f7a50', '#6ab060'));
  s.add(palm(s, 420, 560, 240, 0.25, '#a87a4a', '#3a8a5a', '#78b868'), palm(s, 1180, 560, 250, -0.2, '#a87a4a', '#3a8a5a', '#78b868'));
  // fountain (bottom centre — visible on phones)
  const fx = 800;
  const fy = 846;
  s.add(ell(fx, fy + 10, 250, 46, '#8c5a2b', op(0.35)));
  s.add(path(`M${fx - 240},${fy}V${fy - 40}A240,46 0 0,1 ${fx + 240},${fy - 40}V${fy}A240,46 0 0,1 ${fx - 240},${fy}Z`, s.lg([[0, '#f6d8a4'], [0.5, '#e0b77e'], [1, '#a8723e']], 0, 0, 1, 0)));
  s.add(ell(fx, fy - 40, 226, 38, s.lg([[0, '#3aa0a8'], [1, '#a8e4e0']])), ell(fx, fy - 40, 226, 38, 'none', 'stroke="#fff4d8" stroke-width="6"'));
  s.add(rect(fx - 16, fy - 150, 32, 110, s.lg([[0, '#f6d8a4'], [1, '#b07a44']], 0, 0, 1, 0)), ell(fx, fy - 150, 70, 14, '#e8c08a'), ell(fx, fy - 154, 60, 9, '#7ac8c8'));
  s.add(stroke(`M${fx},${fy - 160}q-40,-30 -70,14M${fx},${fy - 160}q40,-30 70,14M${fx},${fy - 160}q-20,-40 -40,-10M${fx},${fy - 160}q20,-40 40,-10`, '#d8f4f4', 4, 'stroke-linecap="round" opacity=".85"'));
  s.add(ell(fx - 60, fy - 44, 40, 6, '#ffffff', op(0.5)), ell(fx + 80, fy - 36, 30, 5, '#ffffff', op(0.4)));
  // potted plants & amphora at edges
  const pot = (x: number, y: number, sc: number) =>
    path(`M${P(x - 34 * sc, y - 60 * sc)}h${n(68 * sc)}l${n(-10 * sc)},${n(60 * sc)}h${n(-48 * sc)}z`, s.lg([[0, '#e08a5a'], [1, '#9a4a2a']], 0, 0, 1, 0)) +
    roundTree(s, x, y - 50 * sc, 110 * sc, 110 * sc, '#6a4a2a', '#2f7a50', '#6ab060');
  s.add(pot(560, 640, 0.9), pot(1040, 640, 0.9), pot(80, 900, 1.8), pot(1520, 900, 1.8));
  vignette(s, '#8a3a1a', 0.28);
}

/** Stylized horse silhouette (local units ~44x40, facing right, base at y=40). */
const HORSE =
  'M2,16C4,10 10,9 16,10L27,9C29,4 31,0 35,-1L40,1L43,5L41,8L37,6L35,10C36,14 37,17 36,20L41,13L44,15L38,24L35,26L34,40L31,40L30,27L16,27L13,40L10,40L10,27C6,25 4,22 3,19L-2,28L-4,27Z';

/** Bronze quadriga: four rearing horses, chariot and laurelled victor. */
function quadriga(x: number, base: number, sc: number, fill: string): string {
  let o = '';
  for (let i = 0; i < 4; i++) {
    const dx = (i - 1.5) * 15 * sc;
    o += `<path d="${HORSE}" fill="${i % 2 ? shade(fill, -0.18) : fill}" transform="translate(${n(x + dx - 12 * sc)} ${n(base - (40 + (i % 2) * 2) * sc)}) scale(${n(sc * (i < 2 ? -1 : 1))} ${n(sc)})"/>`;
  }
  // chariot + figure
  o += path(`M${P(x - 16 * sc, base - 30 * sc)}h${n(32 * sc)}l${n(-4 * sc)},${n(18 * sc)}h${n(-24 * sc)}z`, shade(fill, -0.1));
  o += `<circle cx="${n(x)}" cy="${n(base - 8 * sc)}" r="${n(9 * sc)}" fill="none" stroke="${shade(fill, -0.25)}" stroke-width="${n(2.5 * sc)}"/>`;
  o += path(`M${P(x - 6 * sc, base - 30 * sc)}l${n(2 * sc)},${n(-20 * sc)}h${n(8 * sc)}l${n(2 * sc)},${n(20 * sc)}z`, fill);
  o += `<circle cx="${n(x)}" cy="${n(base - 55 * sc)}" r="${n(4.5 * sc)}" fill="${fill}"/>`;
  o += stroke(`M${P(x + 4 * sc, base - 46 * sc)}L${P(x + 14 * sc, base - 64 * sc)}`, fill, 3 * sc, 'stroke-linecap="round"');
  o += `<circle cx="${n(x + 15 * sc)}" cy="${n(base - 67 * sc)}" r="${n(5 * sc)}" fill="none" stroke="#9ad05a" stroke-width="${n(2 * sc)}"/>`;
  return o;
}

/** Triumphal arch with attic inscription and quadriga. */
function triumphalArch(s: S, cx: number, base: number, w: number, h: number, m: { lit: string; mid: string; dark: string; gold: string }, colId: string): string {
  const x0 = cx - w / 2;
  const top = base - h;
  const attic = h * 0.2;
  let o = '';
  // body
  o += rect(x0, top + attic, w, h - attic, s.lg([[0, m.lit], [0.65, m.mid], [1, m.dark]], 0, 0, 1, 0));
  o += rect(x0, top + attic, w, h - attic, patStone(s, w / 9, h / 22, m.dark, '#ffffff', 0.18, 0.25));
  // central arch + side arches
  const archD = (ax: number, aw: number, ah: number) => `M${P(ax, base)}V${n(base - ah + aw / 2)}a${n(aw / 2)},${n(aw / 2)} 0 0,1 ${n(aw)},0V${n(base)}Z`;
  const inner = s.lg([[0, '#4a5a78'], [0.7, '#8a9ab8'], [1, '#e8e2d0']]);
  o += path(archD(cx - w * 0.17, w * 0.34, h * 0.66) + archD(x0 + w * 0.06, w * 0.14, h * 0.4) + archD(x0 + w * 0.8, w * 0.14, h * 0.4), inner);
  o += stroke(`M${P(cx - w * 0.17, base - h * 0.66 + w * 0.17)}a${n(w * 0.17)},${n(w * 0.17)} 0 0,1 ${n(w * 0.34)},0`, m.lit, w * 0.025);
  o += path(`M${P(cx - w * 0.025, base - h * 0.66 - w * 0.01)}h${n(w * 0.05)}l${n(-w * 0.008)},${n(w * 0.06)}h${n(-w * 0.034)}z`, m.gold);
  // reliefs over side arches
  o += rect(x0 + w * 0.05, base - h * 0.62, w * 0.16, h * 0.14, m.dark, op(0.25)) + rect(x0 + w * 0.79, base - h * 0.62, w * 0.16, h * 0.14, m.dark, op(0.25));
  // engaged columns
  for (const fx of [0.03, 0.235, 0.765, 0.97]) o += col(colId, x0 + w * fx, base - h * 0.02, h * 0.66, 0.9);
  // entablature + attic
  o += rect(x0 - w * 0.02, top + attic + h * 0.03, w * 1.04, h * 0.07, m.lit);
  o += rect(x0 - w * 0.03, top + attic, w * 1.06, h * 0.035, shade(m.lit, 0.3));
  o += rect(x0 + w * 0.02, top + h * 0.02, w * 0.96, attic, s.lg([[0, m.lit], [0.7, m.mid], [1, m.dark]], 0, 0, 1, 0));
  o += rect(x0 + w * 0.2, top + h * 0.045, w * 0.6, attic * 0.7, shade(m.mid, -0.06));
  o += inscription('SPQR', cx, top + h * 0.065, attic * 0.42, m.gold);
  o += rect(x0, top, w, h * 0.025, shade(m.lit, 0.25));
  o += quadriga(cx, top, w * 0.006, m.gold);
  // victories on the corners
  for (const fx of [0.04, 0.96]) o += path(`M${P(x0 + w * fx - 6, top)}l3,-22h6l3,22z`, m.gold) + `<circle cx="${n(x0 + w * fx)}" cy="${n(top - 26)}" r="4" fill="${m.gold}"/>`;
  return o;
}

/** Ring of laurel leaves (two branches meeting at the bottom). */
function laurelRing(cx: number, cy: number, r: number, len: number, count: number): string {
  let d = '';
  for (const side of [-1, 1]) {
    for (let i = 0; i < count; i++) {
      const a = Math.PI / 2 + side * (0.25 + (i / count) * 2.6);
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      const tang = a + side * Math.PI / 2;
      for (const k of [-1, 1]) {
        const la = tang + k * 0.6 * side;
        const ox = px + Math.cos(a) * k * len * 0.25;
        const oy = py + Math.sin(a) * k * len * 0.25;
        const c = Math.cos(la);
        const s2 = Math.sin(la);
        const Q = (u: number, v: number) => P(ox + u * c - v * s2, oy + u * s2 + v * c);
        d += `M${Q(-len / 2, 0)}Q${Q(0, -len * 0.28)} ${Q(len / 2, 0)}Q${Q(0, len * 0.28)} ${Q(-len / 2, 0)}Z`;
      }
    }
  }
  return d;
}

/** Honorific column with golden statue. */
function honorColumn(x: number, base: number, h: number, colId: string, gold: string, stone: string): string {
  let o = rect(x - h * 0.06, base - h * 0.12, h * 0.12, h * 0.12, stone) + col(colId, x, base - h * 0.12, h * 0.8, 1.1);
  o += path(`M${P(x - h * 0.02, base - h * 0.93)}l${n(h * 0.008)},${n(-h * 0.06)}h${n(h * 0.024)}l${n(h * 0.008)},${n(h * 0.06)}z`, gold);
  o += `<circle cx="${n(x)}" cy="${n(base - h * 1.005)}" r="${n(h * 0.014)}" fill="${gold}"/>`;
  o += stroke(`M${P(x + h * 0.01, base - h * 0.97)}l${n(h * 0.02)},${n(-h * 0.05)}`, gold, h * 0.008);
  return o;
}

/** 4 · The Forum of Triumph — gleaming marble, triumphal arch, cypresses. */
function forumOfTriumph(s: S): void {
  s.lit = -1;
  const HY = 500;
  sky(s, [[0, '#3c9ee0'], [0.4, '#9ad4f2'], [0.62, '#e4f4f6'], [0.72, '#fff8e6']]);
  sun(s, 1280, 110, 36, '#ffffff', '#fff6d0', 440, 0.8);
  shafts(s, 1280, 110, Math.PI * 0.45, Math.PI * 0.98, 9, 1000, '#ffffff', 0.12);
  cloud(s, 360, 130, 380, 90, '#ffffff', '#c0daee');
  cloud(s, 920, 70, 240, 50, '#ffffff', '#cfe2f0', 0.9);
  birds(s, 600, 220, 6, 60, '#4a6a8a', 8);
  // Capitoline hill with the great temple — top centre (phone crop)
  s.add(hills(s, 330, 30, 3, '#a8c8b0'));
  s.add(path('M520,340Q600,250 700,236L900,236Q1000,250 1080,340Z', '#9cbc9a'));
  let pines = '';
  for (const [px, ph] of [[560, 70], [640, 90], [960, 86], [1040, 70], [460, 60], [1160, 64]]) pines += umbrellaPine(s, px, 300 + (ph < 70 ? 30 : 0), ph, ph * 1.1, '#7a6a5a', '#6a9a72', '#9cc49a');
  s.add(pines);
  const farCol = defColumn(s, '#ffffff', '#e8e6e0', '#b8c0cc', 'corinth', '#f6eed8', false);
  s.add(temple(s, 800, 244, 250, 96, 8, { stone: '#f2eee4', light: '#ffffff', dark: '#b8c2d0', roof: '#c88a5a', gold: '#e8b84a', colId: farCol }, { steps: 3 }));
  haze(s, 200, 400, '#f2f8f8', 0, 0.45);
  // mid: low marble buildings + colonnade along the Via Sacra
  const midCol = defColumn(s, '#ffffff', '#ece8de', '#a8b4c4', 'ionic', '#fff8e8');
  s.add(rect(330, 380, 940, 120, s.lg([[0, '#f6f2ea'], [1, '#dcd6ca']])));
  let mc = '';
  for (let i = 0; i < 17; i++) mc += col(midCol, 350 + i * 56.25, 500, 96);
  s.add(rect(330, 380, 940, 120, '#a8b4c4', op(0.35)), mc, rect(320, 372, 960, 14, '#ffffff'), rect(320, 386, 960, 6, '#c8ccd4'));
  // gold garlands between columns
  let gar = '';
  for (let i = 0; i < 16; i++) gar += `M${P(350 + i * 56.25, 396)}q28,22 56,0`;
  s.add(stroke(gar, '#7ab04a', 5, 'stroke-linecap="round"'), stroke(gar, '#c8e07a', 1.6, op(0.8)));
  haze(s, 360, HY, '#fffaf0', 0, 0.25);
  // paving — Via Sacra
  s.add(rect(0, HY, W, H - HY, s.lg([[0, '#f4efe4'], [1, '#cfc6b4']])));
  let pv = '';
  for (let i = -14; i <= 14; i++) pv += `M${n(800 + i * 40)},${HY}L${n(800 + i * 190)},900`;
  for (let j = 0; j < 10; j++) pv += `M0,${n(HY + 8 + j * j * 4.4 + j * 6)}H1600`;
  s.add(stroke(pv, '#a89d88', 1.3, op(0.35)));
  s.add(path(`M${P(740, HY)}L${P(860, HY)}L${P(1060, H)}L${P(540, H)}Z`, s.lg([[0, '#e8d8b4'], [1, '#c8a870']]), op(0.6)));
  // left: triumphal arch (3/4 framing), right: temple front cropped
  const arCol = defColumn(s, '#ffffff', '#efe8da', '#a89d88', 'corinth', '#f8f0dc');
  s.add(ell(230, 770, 330, 22, '#6a7a90', op(0.25)));
  s.add(triumphalArch(s, 220, 770, 440, 430, { lit: '#fffaf0', mid: '#ece4d4', dark: '#b8b0a0', gold: '#e2a83a' }, arCol));
  const bigCol = defColumn(s, '#ffffff', '#efe8da', '#9aa4b4', 'corinth', '#f6ecd4');
  s.add(temple(s, 1500, 790, 560, 380, 6, { stone: '#f2ece0', light: '#ffffff', dark: '#8a96aa', roof: '#c88a5a', gold: '#e2a83a', colId: bigCol, inner: '#6a7890' }, { steps: 4 }));
  // honorific columns & cypresses
  s.add(cypress(s, 620, 520, 170, 34, '#2f5a3a', '#5e8a52'), cypress(s, 980, 520, 160, 32, '#2f5a3a', '#5e8a52'), cypress(s, 1120, 540, 220, 40, '#2f5a3a', '#5e8a52'));
  s.add(honorColumn(560, 560, 300, midCol, '#e2a83a', '#e6e0d4'), honorColumn(1050, 560, 300, midCol, '#e2a83a', '#e6e0d4'));
  // red triumph banners on the colonnade
  for (const bx of [420, 1150]) s.add(hangingBanner(s, bx, 398, 34, 84, '#b8342a', '#e8b84a'));
  // festival petals drifting
  let pet = '';
  let pet2 = '';
  for (let i = 0; i < 46; i++) {
    const x = s.rnd(0, W);
    const y = s.rnd(0, H);
    const r = s.rnd(3, 7);
    const d = `M${P(x - r, y)}q${n(r)},${n(-r)} ${n(2 * r)},0q${n(-r)},${n(r * 0.8)} ${n(-2 * r)},0z`;
    if (i % 3) pet += d;
    else pet2 += d;
  }
  s.add(path(pet, '#e8505a', op(0.8)), path(pet2, '#ffd0d0', op(0.9)));
  // inlaid laurel wreath in the paving (visible below the board on phones)
  s.add(`<g transform="translate(800 820) scale(1 0.32)">${path(laurelRing(0, 0, 150, 26, 15), '#6aa04e')}<circle r="132" fill="none" stroke="#e2a83a" stroke-width="8"/></g>`);
  s.add(cypress(s, 40, 900, 360, 70, '#2f5a3a', '#5e8a52'), cypress(s, 1580, 900, 380, 74, '#2f5a3a', '#5e8a52'));
  vignette(s, '#3a5a7a', 0.2);
}

/** Scorpion emblem (Praetorian). */
export function scorpion(cx: number, cy: number, s: number, color: string): string {
  const u = s / 20;
  let d = `M${P(cx, cy - 6 * u)}c${n(4 * u)},0 ${n(5 * u)},${n(4 * u)} ${n(4 * u)},${n(9 * u)}c${n(-1 * u)},${n(5 * u)} ${n(-3 * u)},${n(7 * u)} ${n(-4 * u)},${n(7 * u)}c${n(-1 * u)},0 ${n(-3 * u)},${n(-2 * u)} ${n(-4 * u)},${n(-7 * u)}c${n(-1 * u)},${n(-5 * u)} 0,${n(-9 * u)} ${n(4 * u)},${n(-9 * u)}z`;
  d += circ(cx, cy - 8 * u, 2.6 * u);
  let st = `M${P(cx, cy + 10 * u)}c0,${n(6 * u)} ${n(2 * u)},${n(9 * u)} ${n(6 * u)},${n(9 * u)}c${n(5 * u)},0 ${n(8 * u)},${n(-4 * u)} ${n(7 * u)},${n(-9 * u)}c${n(-1 * u)},${n(-4 * u)} ${n(-4 * u)},${n(-5 * u)} ${n(-6 * u)},${n(-3 * u)}`;
  st += `M${P(cx - 2 * u, cy - 9 * u)}c${n(-4 * u)},${n(-4 * u)} ${n(-6 * u)},${n(-7 * u)} ${n(-6 * u)},${n(-11 * u)}M${P(cx + 2 * u, cy - 9 * u)}c${n(4 * u)},${n(-4 * u)} ${n(6 * u)},${n(-7 * u)} ${n(6 * u)},${n(-11 * u)}`;
  for (const k of [-1, 1]) for (let i = 0; i < 3; i++) st += `M${P(cx + k * 3 * u, cy - 3 * u + i * 3 * u)}l${n(k * 6 * u)},${n((i - 1) * 3 * u)}`;
  let cl = '';
  for (const k of [-1, 1]) cl += `M${P(cx + k * 6 * u, cy - 21 * u)}c${n(k * 3 * u)},${n(-3 * u)} ${n(k * 1 * u)},${n(-7 * u)} ${n(-k * 2 * u)},${n(-5 * u)}l${n(k * 1 * u)},${n(3 * u)}z`;
  return path(d + cl, color) + stroke(st, color, 2.2 * u, 'stroke-linecap="round"') + path(`M${P(cx + 7 * u, cy + 13 * u)}l${n(-4 * u)},${n(-2 * u)}l${n(3 * u)},${n(-3 * u)}z`, color);
}

/** 5 · The Praetorian Bastion — dusk, dark red walls, torches. */
function praetorianBastion(s: S): void {
  s.lit = -1;
  const HY = 520;
  sky(s, [[0, '#1e2350'], [0.22, '#4a3a7a'], [0.42, '#a04a78'], [0.56, '#f07a50'], [0.66, '#ffb260'], [0.72, '#ffd890']]);
  // stars
  let st = '';
  for (let i = 0; i < 70; i++) {
    const x = s.rnd(0, W);
    const y = s.rnd(0, 230);
    st += circ(x, y, s.rnd(0.6, 1.8));
  }
  s.add(path(st, '#fff4e0', op(0.85)));
  s.add(`<circle cx="870" cy="110" r="160" fill="${s.rgu([[0, '#fff2d0', 0.3], [1, '#fff2d0', 0]], 870, 110, 160)}"/>`);
  s.add(`<path d="M860,82a34,34 0 1,0 30,52a28,28 0 1,1 -30,-52z" fill="#fff2d0"/>`);
  birds(s, 700, 170, 4, 40, '#2a1a3a', 8);
  sun(s, 880, HY - 10, 60, '#ffe6a0', '#ff9a50', 700, 0.7);
  // long glowing cloud streaks
  cloud(s, 420, 300, 600, 50, '#ffb080', '#8a4a78', 0.9, 8);
  cloud(s, 1180, 340, 700, 44, '#ffc090', '#a05080', 0.85, 8);
  cloud(s, 200, 180, 400, 40, '#d880a0', '#5a3a70', 0.7, 6);
  // distant city with lights
  let city = '';
  let lights = '';
  for (let i = 0; i < 40; i++) {
    const x = 300 + i * 26 + s.rnd(-6, 6);
    const h = s.rnd(18, 60);
    city += `M${P(x, HY)}v${n(-h)}h${n(s.rnd(16, 26))}v${n(h)}z`;
    if (i % 2) lights += `M${P(x + 6, HY - h * 0.5)}h3v4h-3z`;
  }
  city += 'M640,470a50,50 0 0,1 100,0zM686,424h8v-14h-8z';
  s.add(path(city, '#6a3a5a'), path(lights, '#ffd27a'));
  s.add(rect(0, HY - 2, W, 40, '#5a2e4a'));
  haze(s, 380, HY + 20, '#ff9a6a', 0, 0.35);
  // courtyard ground
  s.add(rect(0, HY + 30, W, H - HY - 30, s.lg([[0, '#6a3a3a'], [1, '#2e1a1e']])));
  let pv = '';
  for (let i = -14; i <= 14; i++) pv += `M${n(800 + i * 40)},${HY + 30}L${n(800 + i * 170)},900`;
  for (let j = 0; j < 9; j++) pv += `M0,${n(HY + 40 + j * j * 4.4 + j * 8)}H1600`;
  s.add(stroke(pv, '#1e0e10', 1.4, op(0.4)));
  s.add(ell(800, HY + 60, 600, 80, s.rgu([[0, '#ffb070', 0.5], [1, '#ffb070', 0]], 800, HY + 60, 600, 0.14)));
  s.add(path(`M770,${HY + 30}H830L1000,900H600Z`, s.lg([[0, '#9a2a3a'], [1, '#5a0e22']])), stroke(`M770,${HY + 30}L600,900M830,${HY + 30}L1000,900`, '#e0b050', 5));
  s.add(medallion(800, 820, 110, 0.24, '#e0b050', '#7b1e3a', '#e0b050'));
  // massive bastion walls (left and right) — dark red brick
  const brick = patStone(s, 30, 12, '#1e0a0c', '#ff9a6a', 0.45, 0.12);
  const wallFill = (side: number) => s.lg(side < 0 ? [[0, '#3a1218'], [0.75, '#6a1e26'], [1, '#a8423a']] : [[0, '#a8423a'], [0.25, '#6a1e26'], [1, '#3a1218']], 0, 0, 1, 0);
  for (const side of [-1, 1] as const) {
    const x0 = side < 0 ? -20 : 1180;
    const x1 = x0 + 440;
    s.add(path(`M${x0},900V420L${side < 0 ? x1 - 60 : x0 + 60},400H${side < 0 ? x1 : x0 + 440 - 380}`, 'none'));
    s.add(rect(x0, 400, 440, 500, wallFill(side)), rect(x0, 400, 440, 500, brick));
    s.add(rect(x0 - 10, 392, 460, 16, '#c8786a'), path(crenels(x0 - 10, x1 + 10, 392, 30, 34), '#8a3030'));
    // rim light from the sunset on inner edges
    s.add(rect(side < 0 ? x1 - 6 : x0, 400, 6, 500, '#ffb070', op(0.7)));
    // gate arch with glow
    const gx = side < 0 ? x0 + 200 : x0 + 100;
    s.add(path(`M${gx},900V700a70,70 0 0,1 140,0V900z`, s.lg([[0, '#ffb060'], [1, '#6a2a1a']])));
    s.add(stroke(`M${gx - 8},900V700a78,78 0 0,1 156,0V900`, '#c8786a', 14));
    // scorpion banners
    const bx = side < 0 ? x0 + 240 : x0 + 130;
    s.add(hangingBanner(s, bx, 440, 70, 230, '#7b1e3a', '#e0b050', scorpion(bx + 35, 530, 46, '#e0b050')));
    s.add(torch(s, side < 0 ? x0 + 390 : x0 + 50, 600, 1.3, '#2a1210'));
  }
  // great towers at the extreme edges
  for (const side of [-1, 1]) {
    const x = side < 0 ? -40 : 1460;
    s.add(rect(x, 160, 180, 740, wallFill(side)), rect(x, 160, 180, 740, brick), path(crenels(x - 10, x + 190, 160, 26, 34, 0.4), '#8a3030'), rect(x - 10, 152, 200, 14, '#c8786a'));
    let win = '';
    for (let i = 0; i < 4; i++) win += `M${x + 76},${300 + i * 130}v-30a14,14 0 0,1 28,0v30z`;
    s.add(path(win, '#ffc060'), path(win, s.rgu([[0, '#ffc060', 0.6], [1, '#ffc060', 0]], x + 90, 400, 300), op(0.4)));
    s.add(flag(s, x + 90, 60, side < 0 ? 110 : 110, 50, '#7b1e3a', '#2a1210', side < 0 ? 1 : -1, 0.9, '#e0b050'));
    s.add(torch(s, x + 90, 152, 1.1, '#2a1210'));
  }
  // guards silhouettes on the walls
  let guards = '';
  for (const gx of [80, 200, 330, 1250, 1370]) guards += figure(gx, 390, 40, '#1e0a10', '#7b1e3a', true, gx < 800 ? 1 : -1);
  s.add(guards);
  // foreground parapet torches
  s.add(torch(s, 470, 860, 1.9, '#1e0a10'), torch(s, 1130, 860, 1.9, '#1e0a10'));
  s.add(rect(0, 870, W, 30, '#1e0a10'));
  vignette(s, '#120818', 0.35);
}

/** 6 · The Senate Hall — interior of the curia in one-point perspective. */
function senateHall(s: S): void {
  s.lit = 1;
  const VX = 800;
  const VY = 380;
  const f = 800;
  const pj = (X: number, Y: number, Z: number): [number, number] => [VX + (X * f) / Z, VY + (Y * f) / Z];
  const quad = (a: [number, number], b: [number, number], c: [number, number], d: [number, number]) =>
    `M${P(a[0], a[1])}L${P(b[0], b[1])}L${P(c[0], c[1])}L${P(d[0], d[1])}Z`;
  const FY = 420; // floor Y
  const CY = -980; // ceiling Y
  const WX = 1000; // side wall X
  const ZN = 420;
  const ZB = 3000;
  // walls
  s.add(rect(0, 0, W, H, '#e8dcc4'));
  // ceiling coffers
  s.add(path(quad(pj(-WX, CY, ZN), pj(WX, CY, ZN), pj(WX, CY, ZB), pj(-WX, CY, ZB)), s.lg([[0, '#7a5a3a'], [1, '#c8a878']])));
  let cof = '';
  for (let i = -4; i < 4; i++)
    for (let k = 0; k < 7; k++) {
      const z0 = ZN + k * 380 + 40;
      const z1 = z0 + 300;
      const x0 = i * 250 + 30;
      const x1 = x0 + 190;
      cof += quad(pj(x0, CY, z0), pj(x1, CY, z0), pj(x1, CY, z1), pj(x0, CY, z1));
    }
  s.add(path(cof, '#5a3a22', op(0.55)));
  // side walls (left lit, right in shade)
  for (const side of [-1, 1]) {
    s.add(path(quad(pj(side * WX, CY, ZN), pj(side * WX, CY, ZB), pj(side * WX, FY, ZB), pj(side * WX, FY, ZN)), side < 0 ? s.lg([[0, '#efe4cc'], [1, '#f8eed8']], 0, 0, 1, 0) : s.lg([[0, '#e4d6b8'], [1, '#c8b494']], 0, 0, 1, 0)));
    // marble wainscot (green panels)
    let pan = '';
    for (let k = 0; k < 6; k++) {
      const z0 = ZN + 180 + k * 430;
      pan += quad(pj(side * WX, -120, z0), pj(side * WX, -120, z0 + 300), pj(side * WX, 60, z0 + 300), pj(side * WX, 60, z0));
    }
    s.add(path(pan, side < 0 ? '#5f9a80' : '#3f7462', op(0.85)));
    // high windows
    let win = '';
    for (let k = 0; k < 5; k++) {
      const z0 = ZN + 300 + k * 520;
      win += quad(pj(side * WX, -860, z0), pj(side * WX, -860, z0 + 200), pj(side * WX, -560, z0 + 200), pj(side * WX, -560, z0));
    }
    s.add(path(win, side < 0 ? '#fff8e0' : '#cfe4ec'));
  }
  // back wall with Altar of Victory niche
  const bw = quad(pj(-WX, CY, ZB), pj(WX, CY, ZB), pj(WX, FY, ZB), pj(-WX, FY, ZB));
  s.add(path(bw, s.lg([[0, '#efe2c6'], [1, '#e2d2b0']])));
  let pil = '';
  for (const px of [-900, -600, -300, 300, 600, 900]) {
    const a = pj(px - 40, CY, ZB);
    const b = pj(px + 40, FY, ZB);
    pil += `M${P(a[0], a[1])}H${n(b[0])}V${n(b[1])}H${n(a[0])}Z`;
  }
  s.add(path(pil, '#f8eedc'), path(pil, 'none', 'stroke="#c8b48a" stroke-width="1.5"'));
  {
    const a = pj(0, -880, ZB);
    s.add(inscription('SENATVS', a[0], a[1], 16, '#a8822a'));
  }
  const [nx0, ny0] = pj(-180, -760, ZB);
  const [nx1, ny1] = pj(180, FY, ZB);
  s.add(path(`M${P(nx0, ny1)}V${n(ny0 + 60)}A${n((nx1 - nx0) / 2)},${n((nx1 - nx0) / 2)} 0 0,1 ${P(nx1, ny0 + 60)}V${n(ny1)}Z`, s.lg([[0, '#3f7462'], [1, '#2a4f42']])));
  // golden Victory statue
  const vx = VX;
  const vb = pj(0, 100, ZB)[1];
  s.add(rect(vx - 30, vb - 4, 60, 40, '#f0e6d0'), rect(vx - 36, vb - 10, 72, 8, '#ffffff'));
  s.add(path(`M${P(vx - 14, vb - 10)}L${P(vx - 8, vb - 80)}Q${P(vx, vb - 92)} ${P(vx + 8, vb - 80)}L${P(vx + 14, vb - 10)}Z`, s.lg([[0, '#ffe08a'], [0.5, '#e2a83a'], [1, '#9a6a1a']], 0, 0, 1, 0)));
  s.add(`<circle cx="${n(vx)}" cy="${n(vb - 98)}" r="8" fill="#f0c050"/>`);
  s.add(path(`M${P(vx - 6, vb - 80)}C${P(vx - 50, vb - 110)} ${P(vx - 70, vb - 150)} ${P(vx - 60, vb - 170)}C${P(vx - 40, vb - 130)} ${P(vx - 20, vb - 110)} ${P(vx, vb - 86)}ZM${P(vx + 6, vb - 80)}C${P(vx + 50, vb - 110)} ${P(vx + 70, vb - 150)} ${P(vx + 60, vb - 170)}C${P(vx + 40, vb - 130)} ${P(vx + 20, vb - 110)} ${P(vx, vb - 86)}Z`, '#f0c050'));
  s.add(stroke(`M${P(vx + 6, vb - 70)}L${P(vx + 26, vb - 120)}`, '#e2a83a', 3), `<circle cx="${n(vx + 28)}" cy="${n(vb - 126)}" r="7" fill="none" stroke="#9ad05a" stroke-width="3"/>`);
  s.add(`<circle cx="${n(vx)}" cy="${n(vb - 100)}" r="140" fill="${s.rgu([[0, '#fff0b0', 0.45], [1, '#fff0b0', 0]], vx, vb - 100, 140)}"/>`);
  // floor: opus sectile checker
  s.add(path(quad(pj(-WX, FY, ZN), pj(WX, FY, ZN), pj(WX, FY, ZB), pj(-WX, FY, ZB)), '#f4ecdc'));
  let chk = '';
  const tz = [ZN];
  while (tz[tz.length - 1] < ZB) tz.push(Math.min(ZB, tz[tz.length - 1] * 1.13));
  for (let i = -6; i < 6; i++)
    for (let k = 0; k < tz.length - 1; k++) {
      if ((i + k) % 2 === 0) continue;
      chk += quad(pj(i * 110, FY, tz[k]), pj((i + 1) * 110, FY, tz[k]), pj((i + 1) * 110, FY, tz[k + 1]), pj(i * 110, FY, tz[k + 1]));
    }
  s.add(path(chk, '#4f8a6e'));
  s.add(path(quad(pj(-660, FY, ZN), pj(-640, FY, ZN), pj(-640, FY, ZB), pj(-660, FY, ZB)) + quad(pj(640, FY, ZN), pj(660, FY, ZN), pj(660, FY, ZB), pj(640, FY, ZB)), '#8e1b1b'));
  // tiered senators' benches along both sides
  const steps = 3;
  const items: string[] = [];
  for (const side of [-1, 1]) {
    for (let k = steps - 1; k >= 0; k--) {
      const xi = side * (700 + k * 100);
      const xo = side * WX;
      const yTop = FY - (k + 1) * 90;
      const yBot = FY - k * 90;
      // riser
      items.push(path(quad(pj(xi, yTop, ZN), pj(xi, yTop, ZB - 200), pj(xi, yBot, ZB - 200), pj(xi, yBot, ZN)), side < 0 ? '#e6dac0' : '#cbb998'));
      // seat top
      items.push(path(quad(pj(xi, yTop, ZN), pj(xi, yTop, ZB - 200), pj(xo, yTop, ZB - 200), pj(xo, yTop, ZN)), '#f8f0de'));
      items.push(stroke(`M${P(...pj(xi, yTop, ZN))}L${P(...pj(xi, yTop, ZB - 200))}`, '#8e1b1b', 2.5, op(0.6)));
      // senators in togas seated on this tier
      let sen = '';
      let heads = '';
      for (let z = ZB - 400; z > ZN + 120; z -= 210 + k * 30) {
        const [sx, sy] = pj(xi + side * 50, yTop, z);
        const sc = f / z;
        sen += `M${P(sx - 22 * sc, sy)}q${n(2 * sc)},${n(-60 * sc)} ${n(22 * sc)},${n(-62 * sc)}q${n(20 * sc)},${n(2 * sc)} ${n(22 * sc)},${n(62 * sc)}z`;
        heads += circ(sx, sy - 72 * sc, 10 * sc);
      }
      let clav = '';
      for (let z = ZB - 400; z > ZN + 120; z -= 210 + k * 30) {
        const [sx, sy] = pj(xi + side * 50, yTop, z);
        const sc = f / z;
        clav += `M${P(sx - 6 * sc, sy - 56 * sc)}l${n(4 * sc)},${n(56 * sc)}h${n(5 * sc)}l${n(-3 * sc)},${n(-58 * sc)}z`;
      }
      items.push(path(sen, s.lg([[0, '#ffffff'], [1, '#d8ccb4']], 0, 0, 1, 0)), path(clav, '#a8282a'), path(heads, '#c89a72'));
    }
  }
  s.add(items.join(''));
  // columns lining the hall
  const cId = defColumn(s, '#fffaf0', '#ece2cc', '#a89a7a', 'corinth', '#e8c870');
  const cols: string[] = [];
  for (const side of [-1, 1]) {
    for (let z = ZB - 260; z >= ZN + 100; z -= 520) {
      const [x, y] = pj(side * 900, FY - steps * 90, z);
      const top = pj(side * 900, CY, z)[1];
      cols.push(col(cId, x, y, y - top, 1.2));
    }
  }
  s.add(cols.join(''));
  // sun shafts from the left windows
  let sh = '';
  for (let k = 0; k < 4; k++) {
    const z0 = ZN + 300 + k * 520;
    const a = pj(-WX, -860, z0);
    const b = pj(-WX, -560, z0 + 200);
    const c2 = pj(400, FY, z0 + 400);
    const d = pj(100, FY, z0 + 100);
    sh += `M${P(a[0], a[1])}L${P(b[0], b[1])}L${P(c2[0], c2[1])}L${P(d[0], d[1])}Z`;
  }
  s.add(path(sh, s.lg([[0, '#fff6d8', 0.5], [1, '#fff6d8', 0.05]], 0, 0, 1, 1)));
  // curule chairs + rostrum near camera
  s.add(rect(0, 820, W, 80, s.lg([[0, '#000', 0], [1, '#3a2a1a', 0.25]])));
  vignette(s, '#4a3a22', 0.3);
}

/** Fasces: bundle of rods bound with red straps, axe blade. */
function fasces(s: S, x: number, base: number, h: number, rod: string, strap: string, blade: string): string {
  const w = h * 0.16;
  let o = path(`M${P(x + w * 0.4, base - h * 0.96)}h${n(w * 0.5)}q${n(w * 0.9)},${n(-h * 0.04)} ${n(w * 1.1)},${n(-h * 0.08)}q${n(w * 0.2)},${n(h * 0.14)} 0,${n(h * 0.28)}q${n(-w * 0.2)},${n(-h * 0.04)} ${n(-w * 1.1)},${n(-h * 0.08)}h${n(-w * 0.5)}z`, s.lg([[0, shade(blade, 0.4)], [1, shade(blade, -0.2)]], 0, 0, 1, 0));
  o += rect(x - w / 2, base - h, w, h, s.lg([[0, shade(rod, 0.3)], [0.4, rod], [1, shade(rod, -0.4)]], 0, 0, 1, 0), `rx="${n(w * 0.3)}"`);
  let lines = '';
  for (let i = 1; i < 4; i++) lines += `M${P(x - w / 2 + (w * i) / 4, base - h)}v${n(h)}`;
  o += stroke(lines, shade(rod, -0.45), Math.max(0.6, w * 0.04), op(0.6));
  let straps = '';
  for (let i = 0; i < 5; i++) straps += `M${P(x - w * 0.55, base - h * (0.15 + i * 0.17))}l${n(w * 1.1)},${n(-h * 0.06)}`;
  o += stroke(straps, strap, w * 0.14);
  return o;
}

/** Balustrade (row of balusters with rail). */
function balustrade(s: S, x0: number, x1: number, base: number, h: number, c: string, dark: string): string {
  let d = '';
  const bw = h * 0.32;
  for (let x = x0 + bw * 0.6; x < x1 - bw * 0.5; x += bw * 1.45)
    d += `M${P(x, base - h * 0.12)}q${n(-bw * 0.5)},${n(-h * 0.22)} 0,${n(-h * 0.38)}q${n(bw * 0.7)},${n(-h * 0.14)} 0,${n(-h * 0.32)}h${n(bw * 0.001)}q${n(-bw * 0.7)},${n(h * 0.18)} 0,${n(h * 0.32)}q${n(bw * 0.5)},${n(h * 0.16)} 0,${n(h * 0.38)}z`;
  let bal = '';
  for (let x = x0 + bw * 0.6; x < x1 - bw * 0.5; x += bw * 1.45)
    bal += `M${P(x - bw * 0.22, base - h * 0.12)}C${P(x - bw * 0.6, base - h * 0.35)} ${P(x - bw * 0.15, base - h * 0.55)} ${P(x - bw * 0.15, base - h * 0.84)}H${n(x + bw * 0.15)}C${P(x + bw * 0.15, base - h * 0.55)} ${P(x + bw * 0.6, base - h * 0.35)} ${P(x + bw * 0.22, base - h * 0.12)}Z`;
  void d;
  return (
    path(bal, s.lg([[0, shade(c, 0.2)], [0.5, c], [1, dark]], 0, 0, 1, 0)) +
    rect(x0, base - h, x1 - x0, h * 0.16, c) +
    rect(x0, base - h, x1 - x0, h * 0.04, shade(c, 0.35)) +
    rect(x0, base - h * 0.14, x1 - x0, h * 0.14, dark)
  );
}

/** Small sailing ship silhouette. */
function ship(x: number, y: number, sc: number, hull: string, sail: string): string {
  return (
    path(`M${P(x - 30 * sc, y)}q${n(30 * sc)},${n(10 * sc)} ${n(64 * sc)},0l${n(-6 * sc)},${n(8 * sc)}h${n(-52 * sc)}z`, hull) +
    stroke(`M${P(x, y)}v${n(-36 * sc)}`, hull, 1.6 * sc) +
    path(`M${P(x - 16 * sc, y - 32 * sc)}q${n(16 * sc)},${n(8 * sc)} ${n(32 * sc)},0v${n(22 * sc)}q${n(-16 * sc)},${n(6 * sc)} ${n(-32 * sc)},0z`, sail)
  );
}

/** Heavy drapery swag hanging from the top corner. */
function drape(s: S, side: number, color: string, gold: string): string {
  const x0 = side < 0 ? 0 : W;
  const d = side < 0
    ? `M-10,-10H360C320,60 220,120 120,130C90,240 70,420 40,560C20,600 0,620 -10,630Z`
    : `M1610,-10H1240C1280,60 1380,120 1480,130C1510,240 1530,420 1560,560C1580,600 1600,620 1610,630Z`;
  void x0;
  let folds = '';
  for (let i = 0; i < 5; i++) {
    const t = i / 5;
    const fx = side < 0 ? 20 + t * 300 : 1580 - t * 300;
    folds += `M${P(fx, -10)}Q${P(side < 0 ? fx - 20 - t * 40 : fx + 20 + t * 40, 160 - t * 60)} ${P(side < 0 ? 30 + t * 60 : 1570 - t * 60, 560 - t * 420)}`;
  }
  return (
    path(d, s.lg(side < 0 ? [[0, shade(color, -0.35)], [0.6, color], [1, shade(color, 0.15)]] : [[0, shade(color, 0.15)], [0.4, color], [1, shade(color, -0.35)]], 0, 0, 1, 0)) +
    stroke(folds, shade(color, -0.45), 8, op(0.35) + ' stroke-linecap="round"') +
    stroke(folds, shade(color, 0.3), 2.5, op(0.35) + ' stroke-linecap="round" transform="translate(' + (side < 0 ? 6 : -6) + ' 0)"') +
    stroke(side < 0 ? 'M120,130Q60,140 0,100' : 'M1480,130Q1540,140 1600,100', gold, 10, 'stroke-linecap="round"') +
    `<circle cx="${side < 0 ? 122 : 1478}" cy="134" r="14" fill="${gold}"/>` +
    path(side < 0 ? 'M114,146l8,56l8,-56z' : 'M1470,146l8,56l8,-56z', gold)
  );
}

/** 7 · The Consular Palace — sunset terrace over the sea. */
function consularPalace(s: S): void {
  s.lit = 1;
  const SEA = 470;
  sky(s, [[0, '#4a0c22'], [0.2, '#8a1a3a'], [0.38, '#d84a4a'], [0.5, '#f48a50'], [0.56, '#ffc070']]);
  sun(s, 800, SEA - 8, 58, '#fff0b0', '#ffb050', 640, 0.85);
  shafts(s, 800, SEA - 8, -Math.PI * 0.98, -Math.PI * 0.02, 14, 900, '#ffe0a0', 0.1);
  cloud(s, 420, 250, 560, 54, '#ffb080', '#a02c4a', 0.95, 8);
  cloud(s, 1220, 200, 620, 60, '#ffa878', '#901c40', 0.95, 8);
  cloud(s, 820, 120, 380, 40, '#f07a6a', '#6a1430', 0.8, 6);
  birds(s, 980, 330, 6, 60, '#5a1428', 8);
  // headlands with pharos
  s.add(path(`M0,${SEA}V400Q80,380 160,390Q240,370 320,420Q380,440 430,${SEA}Z`, '#7a2a40'));
  s.add(path(`M1600,${SEA}V410Q1500,390 1420,410Q1330,420 1250,${SEA}Z`, '#7a2a40'));
  s.add(rect(240, 330, 26, 50, '#a8505a'), rect(246, 300, 14, 30, '#a8505a'), `<circle cx="253" cy="296" r="9" fill="#ffe0a0"/><circle cx="253" cy="296" r="40" fill="${s.rgu([[0, '#ffe0a0', 0.6], [1, '#ffe0a0', 0]], 253, 296, 40)}"/>`);
  s.add(umbrellaPine(s, 120, 392, 50, 60, '#5a1a2a', '#6a2a3a', '#8a3a4a'), umbrellaPine(s, 1480, 410, 54, 66, '#5a1a2a', '#6a2a3a', '#8a3a4a'));
  // sea with sun glitter
  s.add(rect(0, SEA, W, 160, s.lg([[0, '#e07060'], [0.25, '#9a3a5a'], [1, '#3a1a4a']])));
  let gl = '';
  for (let i = 0; i < 46; i++) {
    const y = SEA + 4 + Math.pow(s.r.next(), 1.4) * 140;
    const spread = 30 + (y - SEA) * 1.6;
    const x = 800 + s.rnd(-1, 1) * spread;
    gl += `M${P(x, y)}h${n(s.rnd(10, 40) * (0.5 + (y - SEA) / 140))}`;
  }
  s.add(stroke(gl, '#ffe0a0', 3, 'stroke-linecap="round" opacity=".85"'));
  s.add(ship(560, SEA + 26, 1.2, '#3a1020', '#f0c8a0'), ship(1090, SEA + 18, 0.9, '#3a1020', '#f0c8a0'));
  // terrace balustrade
  s.add(rect(0, 600, W, 300, s.lg([[0, '#c86a50'], [0.3, '#a8443a'], [1, '#5a1616']])));
  let tiles = '';
  for (let i = -16; i <= 16; i++) tiles += `M${n(800 + i * 50)},600L${n(800 + i * 150)},900`;
  for (let j = 0; j < 7; j++) tiles += `M0,${n(610 + j * j * 6 + j * 10)}H1600`;
  s.add(stroke(tiles, '#3a0d0d', 1.4, op(0.35)));
  s.add(ell(800, 640, 560, 70, s.rgu([[0, '#ffd090', 0.55], [1, '#ffd090', 0]], 800, 640, 560, 0.13)));
  s.add(balustrade(s, 0, W, 612, 70, '#f2d8b8', '#9a4a3a'));
  s.add(medallion(800, 800, 200, 0.22, '#e8c060', '#7a1a1a', '#f6d888'));
  // palace wings with crimson columns + gold capitals
  const cId = defColumn(s, '#ff9a7a', '#c0463c', '#6a1616', 'corinth', '#f0c860', false);
  for (const side of [-1, 1]) {
    const xs = side < 0 ? [40, 170, 300] : [1300, 1430, 1560];
    const wallX = side < 0 ? -20 : 1240;
    s.add(rect(wallX, 60, 380, 640, s.lg(side < 0 ? [[0, '#5a1616'], [1, '#8a2a2a']] : [[0, '#8a2a2a'], [1, '#5a1616']], 0, 0, 1, 0)));
    // warm lit doorways
    for (const dx of [105, 235]) {
      const xx = side < 0 ? dx : W - dx;
      s.add(path(`M${xx - 38},700V520a38,38 0 0,1 76,0V700z`, s.lg([[0, '#ffe0a0'], [1, '#e08a40']])));
    }
    for (const x of xs) s.add(col(cId, x, 700, 560, 1.4));
    s.add(rect(wallX - 20, 80, 420, 50, '#c0463c'), rect(wallX - 20, 72, 420, 14, '#f0c860'), rect(wallX - 20, 130, 420, 10, '#f0c860'));
    s.add(rect(wallX - 20, 140, 420, 30, s.lg([[0, '#000', 0.3], [1, '#000', 0]])));
    s.add(path(`M${wallX - 30},74L${wallX + 190},-30L${wallX + 410},74Z`, patTiles(s, 18, 14, '#b84a30')));
    s.add(rect(wallX - 20, 700, 420, 24, '#f2d8b8'), rect(wallX - 20, 724, 420, 8, '#9a4a3a'));
  }
  // fasces on pedestals flanking the view
  for (const fx of [470, 1130]) {
    s.add(rect(fx - 40, 690, 80, 110, s.lg([[0, '#f8e2c4'], [1, '#c09070']], 0, 0, 1, 0)), rect(fx - 48, 684, 96, 12, '#fff0dc'), rect(fx - 48, 796, 96, 12, '#fff0dc'));
    s.add(fasces(s, fx, 684, 200, '#c8955c', '#c0302a', '#c8d0dc'));
  }
  // garden: cypresses, lemon trees in urns, oleander
  s.add(cypress(s, 420, 600, 230, 44, '#2a3a2a', '#6a5a3a'), cypress(s, 1180, 600, 250, 46, '#2a3a2a', '#6a5a3a'));
  const urn = (x: number, y: number, sc: number) =>
    path(`M${P(x - 34 * sc, y - 70 * sc)}h${n(68 * sc)}q${n(-4 * sc)},${n(40 * sc)} ${n(-20 * sc)},${n(56 * sc)}l${n(6 * sc)},${n(14 * sc)}h${n(-40 * sc)}l${n(6 * sc)},${n(-14 * sc)}q${n(-16 * sc)},${n(-16 * sc)} ${n(-20 * sc)},${n(-56 * sc)}z`, s.lg([[0, '#fff0d8'], [1, '#b88a6a']], 0, 0, 1, 0)) +
    roundTree(s, x, y - 64 * sc, 120 * sc, 120 * sc, '#5a3a2a', '#2f5a30', '#6a8a3a') +
    path(`${circ(x - 20 * sc, y - 130 * sc, 5 * sc)}${circ(x + 16 * sc, y - 116 * sc, 5 * sc)}${circ(x + 4 * sc, y - 150 * sc, 5 * sc)}${circ(x - 30 * sc, y - 104 * sc, 5 * sc)}`, '#ffd23a');
  s.add(urn(80, 900, 1.9), urn(1520, 900, 1.9));
  s.add(drape(s, -1, '#9a1a2a', '#f0c860'), drape(s, 1, '#9a1a2a', '#f0c860'));
  vignette(s, '#2a0612', 0.35);
}

/** 8 · The Grand Colosseum — interior, tiers of crowd, velarium, sand. */
function grandColosseum(s: S): void {
  s.lit = 1;
  const CX = 800;
  const CY = 720; // centre of the arena ellipse
  sky(s, [[0, '#2f86d8'], [0.25, '#7cc0f0'], [0.45, '#d8eef8']]);
  sun(s, 560, 60, 30, '#ffffff', '#fff4c8', 300, 0.7);
  cloud(s, 820, 120, 300, 60, '#ffffff', '#c4daf0', 0.95);
  cloud(s, 1130, 70, 200, 40, '#ffffff', '#c4daf0', 0.85);
  birds(s, 700, 150, 5, 40, '#3a5a7a', 7);
  const band = (rx: number, ry: number, rx2: number, ry2: number) =>
    `M${P(CX - rx, CY)}A${n(rx)},${n(ry)} 0 0,1 ${P(CX + rx, CY)}L${P(CX + rx2, CY)}A${n(rx2)},${n(ry2)} 0 0,0 ${P(CX - rx2, CY)}Z`;
  const arc = (rx: number, ry: number) => `M${P(CX - rx, CY)}A${n(rx)},${n(ry)} 0 0,1 ${P(CX + rx, CY)}`;
  const tunics = ['#f4ecdc', '#c8302a', '#2f6db3', '#e8b04b', '#3a8a5a', '#ffffff', '#9a4a8a'];
  const skins = ['#e8b48a', '#c88a5a', '#a86a3a'];
  const crowdFar = patCrowd(s, 0.62, '#b07a50', tunics, skins, 0.35);
  const crowdMid = patCrowd(s, 0.85, '#9a6440', tunics, skins, 0.15);
  const crowdNear = patCrowd(s, 1.15, '#8a5a3a', tunics, skins, 0);
  const stoneP = patStone(s, 34, 12, '#7a4320', '#fff0d0', 0.3, 0.2);
  // outer attic wall (top storey with windows) and masts
  s.add(rect(0, CY - 20, W, H - CY + 20, crowdNear));
  s.add(path(band(1420, 560, 1300, 500), s.lg([[0, '#f2c48a'], [1, '#d49a62']])), path(band(1420, 560, 1300, 500), stoneP));
  let win = '';
  for (let k = 1; k < 40; k++) {
    const t = (Math.PI * k) / 40;
    const x = CX - Math.cos(t) * 1360;
    const y = CY - Math.sin(t) * 530;
    const w = 4 + Math.sin(t) * 6;
    win += `M${P(x - w / 2, y + 8)}h${n(w)}v${n(-14 * (0.5 + Math.sin(t) * 0.5))}h${n(-w)}z`;
  }
  s.add(path(win, '#7a3a1a'));
  // tiers (outer → inner)
  const tiers: [number, number, 'crowd' | 'arch' | 'wall'][] = [
    [1300, 500, 'crowd'], [1190, 440, 'arch'], [1110, 400, 'crowd'], [990, 330, 'wall'], [950, 310, 'crowd'], [800, 220, 'wall'],
  ];
  const end: [number, number] = [740, 200];
  for (let i = 0; i < tiers.length; i++) {
    const [rx, ry, kind] = tiers[i];
    const [rx2, ry2] = i + 1 < tiers.length ? tiers[i + 1] : end;
    const d = band(rx, ry, rx2, ry2);
    if (kind === 'crowd') {
      s.add(path(d, i < 1 ? crowdFar : i < 3 ? crowdMid : crowdNear));
      let rows = '';
      for (let k = 1; k < 4; k++) {
        const t = k / 4;
        rows += arc(rx + (rx2 - rx) * t, ry + (ry2 - ry) * t);
      }
      s.add(stroke(rows, '#f8e4c0', 1.6, op(0.5)));
    } else if (kind === 'arch') {
      s.add(path(d, s.lg([[0, '#f6cc92'], [1, '#dca46a']])));
      let ar = '';
      const N = 36;
      for (let k = 0; k < N; k++) {
        const t = (Math.PI * (k + 0.5)) / N;
        const x = CX - Math.cos(t) * (rx + rx2) / 2;
        const yTop = CY - Math.sin(t) * ry;
        const yBot = CY - Math.sin(t) * ry2;
        const hh = yBot - yTop;
        const ww = Math.max(3, Math.sin(t) * 22);
        if (hh < 8) continue;
        ar += `M${P(x - ww / 2, yBot - hh * 0.1)}V${n(yTop + hh * 0.3 + ww / 2)}a${n(ww / 2)},${n(ww / 2)} 0 0,1 ${n(ww)},0V${n(yBot - hh * 0.1)}Z`;
      }
      s.add(path(ar, '#7a3a1a'));
    } else {
      s.add(path(d, s.lg([[0, '#fff6e6'], [1, '#e8d4b0']])));
      s.add(stroke(arc(rx, ry), '#c8302a', 3, op(0.6)));
    }
  }
  // afternoon shade: right side of the bowl
  s.add(path(band(1420, 560, 740, 200) + `M${CX + 740},${CY - 1}H1600V${H}H${CX + 740}Z`, s.lg([[0, '#4a2050', 0], [0.6, '#4a2050', 0], [1, '#4a2050', 0.28]], 0, 0, 1, 0)));
  // emperor's box (pulvinar) on the far side
  const pY = CY - 310 - 4;
  s.add(rect(CX - 62, pY - 54, 124, 56, '#fff4e0'), rect(CX - 52, pY - 46, 104, 46, '#4a1a5a'));
  s.add(path(`M${CX - 80},${pY - 54}L${CX},${pY - 96}L${CX + 80},${pY - 54}Z`, '#8a2a9a'), path(`M${CX - 74},${pY - 56}h148v12q-18.5,10 -37,0q-18.5,10 -37,0q-18.5,10 -37,0q-18.5,10 -37,0z`, '#b04ac0'));
  s.add(figure(CX, pY, 36, '#fbf4e4', '#8a2a9a', false), stroke(`M${CX - 50},${pY + 2}h100`, '#f0c040', 4));
  s.add(hangingBanner(s, CX - 100, pY - 40, 22, 56, '#8a2a9a', '#f0c040'), hangingBanner(s, CX + 78, pY - 40, 22, 56, '#8a2a9a', '#f0c040'));
  // podium banners
  let bn = '';
  for (let k = 1; k < 14; k++) {
    const t = (Math.PI * k) / 14;
    const x = CX - Math.cos(t) * 770;
    const y = CY - Math.sin(t) * 210;
    const sc = 0.45 + Math.sin(t) * 0.55;
    bn += hangingBanner(s, x - 9 * sc, y - 6, 18 * sc, 40 * sc, k % 2 ? '#9c1c1c' : '#f0c040', k % 2 ? '#f0c040' : '#9c1c1c');
  }
  s.add(bn);
  // sand
  s.add(ell(CX, CY, 740, 200, s.lg([[0, '#e2a868'], [0.35, '#f6d29a'], [1, '#fde8c0']])));
  s.def(`<clipPath id="${s.id}sand"><ellipse cx="${CX}" cy="${CY}" rx="740" ry="200"/></clipPath>`);
  s.add(path(`M${CX + 60},${CY - 210}H${CX + 760}V${CY + 210}H${CX + 600}Q${CX + 420},${CY - 120} ${CX + 60},${CY - 210}Z`, '#8a4a20', `opacity=".16" clip-path="url(#${s.id}sand)"`));
  let rk = '';
  for (let i = 1; i < 6; i++) rk += `M${P(CX - 740 + i * 60, CY + 30)}A${n(740 - i * 60)},${n(200 - i * 16)} 0 0,1 ${P(CX + 740 - i * 60, CY + 30)}`;
  s.add(stroke(rk, '#d49a5a', 2, op(0.14)));
  // velarium: striped gores rising from the attic rim, open over the centre
  let sailA = '';
  let sailB = '';
  const N = 40;
  for (let k = 0; k < N; k++) {
    const t0 = (Math.PI * k) / N;
    const t1 = (Math.PI * (k + 1)) / N;
    const mid = (t0 + t1) / 2;
    if (mid > Math.PI * 0.4 && mid < Math.PI * 0.6) continue;
    const r0 = (t: number): [number, number] => [CX - Math.cos(t) * 1420, CY - Math.sin(t) * 560];
    const r1 = (t: number): [number, number] => [CX - Math.cos(t) * 1900, CY + 260 - Math.sin(t) * 1250];
    const a0 = r0(t0);
    const a1 = r0(t1);
    const b0 = r1(t0);
    const b1 = r1(t1);
    const sag = (Math.cos(mid) > 0 ? 1 : -1) * 8;
    const d = `M${P(a0[0], a0[1])}Q${P((a0[0] + a1[0]) / 2 + sag, (a0[1] + a1[1]) / 2 + 26)} ${P(a1[0], a1[1])}L${P(b1[0], b1[1])}L${P(b0[0], b0[1])}Z`;
    if (k % 2) sailA += d;
    else sailB += d;
  }
  s.add(path(sailA, s.lg([[0, '#8a1818'], [1, '#d0442e']], 0, 0, 0, 1)), path(sailB, s.lg([[0, '#e8d4b0'], [1, '#fff6e6']], 0, 0, 0, 1)));
  // masts and ropes on the rim
  let masts = '';
  let ropes = '';
  for (let k = 0; k <= 40; k++) {
    const t = (Math.PI * k) / 40;
    const x = CX - Math.cos(t) * 1420;
    const y = CY - Math.sin(t) * 560;
    const hh = 26 + Math.abs(Math.cos(t)) * 30;
    masts += `M${P(x, y)}v${n(-hh)}`;
    if (t > Math.PI * 0.38 && t < Math.PI * 0.62) ropes += `M${P(x, y - hh)}Q${P((x + CX) / 2, y - hh + 60)} ${P(CX + (x - CX) * 0.2, y - hh - 120)}`;
  }
  s.add(stroke(masts, '#6a3a1a', 4), stroke(ropes, '#6a3a1a', 1.4, op(0.45)));
  // light motes
  let motes = '';
  for (let i = 0; i < 36; i++) motes += circ(s.rnd(200, 1400), s.rnd(180, 640), s.rnd(1, 2.5));
  s.add(path(motes, '#fff6d8', op(0.6)));
  // near podium parapets + torches
  s.add(path(`M0,${H}V760Q300,830 540,${H}Z`, s.lg([[0, '#fff4e0'], [1, '#c8a070']])), path(`M1600,${H}V760Q1300,830 1060,${H}Z`, s.lg([[0, '#fff4e0'], [1, '#c8a070']])));
  s.add(stroke(`M0,762Q300,832 540,${H}M1600,762Q1300,832 1060,${H}`, '#c8302a', 5));
  s.add(torch(s, 130, 790, 1.4, '#3a1a10'), torch(s, 1470, 790, 1.4, '#3a1a10'));
  // dropped trident, net & shield in the sand (phone foreground)
  s.add(stroke('M620,884L880,800', '#6a4a2a', 6, 'stroke-linecap="round"'), stroke('M872,796l28,-10M878,810l28,-10M866,784l18,22', '#b8c0c8', 4, 'stroke-linecap="round"'));
  s.add(ell(990, 862, 60, 14, '#7a4320', op(0.25)), ell(990, 852, 56, 20, s.lg([[0, '#f0c040'], [1, '#9c1c1c']])), ell(990, 850, 12, 5, '#fff0b0'));
  vignette(s, '#5c2c10', 0.25);
}

/** Onion/golden dome. */
function dome(s: S, x: number, base: number, w: number, h: number, gold: string): string {
  return (
    path(`M${P(x - w / 2, base)}C${P(x - w / 2, base - h * 0.7)} ${P(x - w * 0.12, base - h * 0.78)} ${P(x, base - h)}C${P(x + w * 0.12, base - h * 0.78)} ${P(x + w / 2, base - h * 0.7)} ${P(x + w / 2, base)}Z`, s.lg([[0, shade(gold, 0.5)], [0.35, gold], [1, shade(gold, -0.45)]], 0, 0, 1, 0)) +
    stroke(`M${P(x - w * 0.22, base)}Q${P(x - w * 0.2, base - h * 0.6)} ${P(x, base - h)}M${P(x + w * 0.22, base)}Q${P(x + w * 0.2, base - h * 0.6)} ${P(x, base - h)}`, shade(gold, -0.4), Math.max(1, w * 0.015), op(0.5)) +
    stroke(`M${P(x, base - h)}v${n(-h * 0.25)}`, gold, Math.max(1.5, w * 0.03)) +
    `<circle cx="${n(x)}" cy="${n(base - h * 1.28)}" r="${n(Math.max(2, w * 0.04))}" fill="${shade(gold, 0.4)}"/>`
  );
}

/** Lantern string between two points. */
function lanterns(s: S, x0: number, y0: number, x1: number, y1: number, sag: number, count: number, color: string): string {
  let o = stroke(`M${P(x0, y0)}Q${P((x0 + x1) / 2, (y0 + y1) / 2 + sag * 2)} ${P(x1, y1)}`, '#2a1a3a', 1.5, op(0.8));
  for (let i = 1; i < count; i++) {
    const t = i / count;
    const x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * ((x0 + x1) / 2) + t * t * x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * ((y0 + y1) / 2 + sag * 2) + t * t * y1;
    o += `<circle cx="${n(x)}" cy="${n(y + 8)}" r="22" fill="${s.rgu([[0, color, 0.55], [1, color, 0]], 0, 0, 22)}" transform="translate(0 0)"/>`;
    o += rect(x - 5, y + 2, 10, 14, color, 'rx="4"');
  }
  return o;
}

/** 9 · The Imperial Palace — moonlit Palatine with golden domes. */
function imperialPalace(s: S): void {
  s.lit = 1;
  sky(s, [[0, '#120a30'], [0.35, '#2a1a5a'], [0.6, '#5a3a8a'], [0.72, '#b06a9a']]);
  let st = '';
  let big = '';
  for (let i = 0; i < 160; i++) {
    const x = s.rnd(0, W);
    const y = Math.pow(s.r.next(), 1.3) * 420;
    if (i % 12 === 0) big += starPath5(x, y, s.rnd(3, 5));
    else st += circ(x, y, s.rnd(0.5, 1.6));
  }
  s.add(path(st, '#ffffff', op(0.85)), path(big, '#fff4c8'));
  // moon
  s.add(`<circle cx="1180" cy="170" r="260" fill="${s.rgu([[0, '#e8e0ff', 0.45], [0.3, '#c8b8f0', 0.18], [1, '#c8b8f0', 0]], 1180, 170, 260)}"/>`);
  s.add(`<circle cx="1180" cy="170" r="62" fill="#fbf6ff"/>`, path(`${circ(1160, 150, 12)}${circ(1200, 190, 8)}${circ(1190, 140, 6)}`, '#e4dcf4'));
  cloud(s, 1000, 260, 420, 40, '#c8b8e8', '#4a3a7a', 0.6, 7);
  cloud(s, 320, 200, 360, 36, '#a898d0', '#3a2a6a', 0.55, 6);
  // Palatine hill
  s.add(path('M0,560Q200,420 480,380Q800,330 1120,380Q1400,420 1600,540V900H0Z', s.lg([[0, '#3a2a5a'], [1, '#1e1238']])));
  // palace complex on the hill (top-centre)
  const marble = { lit: '#e8dcf4', mid: '#b8a4d0', dark: '#6a5490' };
  const pc = defColumn(s, '#f4ecff', '#c9b8d8', '#6a5490', 'corinth', '#e8c060', false);
  s.add(rect(470, 270, 660, 120, s.lg([[0, marble.lit], [1, marble.mid]])));
  let pcs = '';
  for (let i = 0; i < 15; i++) pcs += col(pc, 490 + i * 44.3, 390, 104);
  s.add(rect(470, 286, 660, 104, '#3a2560', op(0.5)), pcs);
  // lit windows behind colonnade
  let lw = '';
  for (let i = 0; i < 14; i++) lw += `M${P(505 + i * 44.3, 386)}v-46a8,8 0 0,1 16,0v46z`;
  s.add(path(lw, '#ffcf6a', op(0.9)));
  s.add(rect(460, 262, 680, 16, marble.lit), rect(460, 278, 680, 6, '#e8c060'));
  s.add(dome(s, 800, 262, 210, 170, '#e8b440'), dome(s, 590, 262, 90, 90, '#e8b440'), dome(s, 1010, 262, 90, 90, '#e8b440'));
  s.add(rect(700, 226, 200, 40, s.lg([[0, marble.mid], [0.35, marble.lit], [1, marble.dark]], 0, 0, 1, 0)));
  let dw = '';
  for (let i = 0; i < 6; i++) dw += `M${P(714 + i * 32, 260)}v-20a6,6 0 0,1 12,0v20z`;
  s.add(path(dw, '#ffcf6a'));
  // substructure arcades and grand stair down the hill
  s.add(rect(470, 390, 660, 110, s.lg([[0, '#6a5490'], [1, '#3a2a5a']])));
  s.add(path(archHoles(480, 400, 640, 96, 9, 0.6, 0.55), s.lg([[0, '#ffcf6a'], [1, '#c87a3a']]), op(0.85)));
  let stair = '';
  for (let i = 0; i < 12; i++) {
    const y = 500 + i * 12;
    const hw = 90 + i * 16;
    stair += `M${P(800 - hw, y)}h${n(hw * 2)}v5h${n(-hw * 2)}z`;
  }
  s.add(path(`M710,500H890L1000,644H600Z`, '#8a78a8'), path(stair, '#c9b8d8', op(0.8)));
  // moon rim light on domes
  s.add(stroke('M880,170Q900,210 905,262', '#fff6d0', 3, op(0.7)));
  // side wings stepping down the hill
  for (const side of [-1, 1]) {
    const x0 = side < 0 ? 180 : 1130;
    s.add(rect(x0, 360, 290, 120, s.lg([[0, marble.mid], [1, marble.dark]])));
    let ww = '';
    for (let i = 0; i < 6; i++) ww += `M${P(x0 + 20 + i * 46, 450)}v-50a10,10 0 0,1 20,0v50z`;
    s.add(path(ww, '#ffcf6a', op(0.85)), rect(x0 - 10, 352, 310, 12, marble.lit));
    s.add(dome(s, x0 + 145, 352, 80, 70, '#d8a038'));
  }
  // glow of the city below
  haze(s, 420, 640, '#b06a9a', 0, 0.45);
  // garden terrace + reflecting pool (bottom centre, visible on phones)
  s.add(rect(0, 640, W, 260, s.lg([[0, '#3a2a5a'], [1, '#160c28']])));
  s.add(ell(800, 800, 520, 90, '#0e1a3a'), ell(800, 800, 520, 90, 'none', 'stroke="#c9b8d8" stroke-width="10"'));
  s.add(ell(800, 800, 500, 80, s.lg([[0, '#2a3a7a'], [1, '#0e1a3a']])));
  // reflections
  s.add(stroke('M1100,744h60M1090,760h80M1110,778h44M1120,796h30', '#fbf6ff', 3, 'stroke-linecap="round" opacity=".7"'));
  s.add(stroke('M740,740h120M760,756h80M770,772h60', '#ffcf6a', 3, 'stroke-linecap="round" opacity=".55"'));
  // cypress avenue & statues on plinths
  let cy = '';
  for (const [x, h] of [[40, 420], [170, 360], [290, 300], [1310, 300], [1430, 360], [1560, 420]]) cy += cypress(s, x, 700 + (h - 300) * 0.4, h, h * 0.2, '#140a28', '#3a2a5a');
  s.add(cy);
  for (const x of [420, 1180]) s.add(rect(x - 24, 640, 48, 70, '#8a78a8'), rect(x - 30, 634, 60, 8, '#c9b8d8'), figure(x, 634, 70, '#c9b8d8', '#a898c0', false));
  // lantern strings
  s.add(lanterns(s, 0, 520, 470, 600, 30, 7, '#ffb84a'), lanterns(s, 1130, 600, 1600, 520, 30, 7, '#ffb84a'));
  // fireflies
  let ff = '';
  for (let i = 0; i < 40; i++) ff += circ(s.rnd(0, W), s.rnd(560, 880), s.rnd(1, 2.4));
  s.add(path(ff, '#fff0a0', op(0.8)));
  vignette(s, '#0a0418', 0.4);
}

/** Colossal emperor statue (local: base centre at 0,0, height 100). */
function emperorStatue(s: S, x: number, base: number, h: number, variant: number, light: string, dark: string, gold: string): string {
  const sc = h / 100;
  const fill = s.lg([[0, shade(light, 0.2)], [0.45, light], [1, dark]], 0, 0, 1, 0);
  const arm = variant % 3;
  let d = 'M-9,0L-7,-36L-1.5,-36L-1,0ZM1,0L1.5,-36L7,-36L9,0Z';
  d += 'M-11.5,-36L11.5,-36L9.5,-24L-9.5,-24Z';
  d += 'M-10,-35L-12,-62Q0,-67 12,-62L10,-35Z';
  d += 'M-12,-62Q-21,-48 -19,-18L-12,-18Q-14,-44 -8,-56Z';
  if (arm === 0) d += 'M9,-61L21,-84L25.5,-82L14,-57Z';
  else if (arm === 1) d += 'M9,-61L18,-40L22,-42L14,-60Z';
  else d += 'M9,-61L24,-66L24,-61L13,-56Z';
  d += 'M-3,-66h6v4h-6z';
  const head = `<circle cx="0" cy="-71.5" r="5.4" fill="${light}"/>` + stroke('M-7,-58Q0,-50 8,-58M-8,-50Q0,-42 9,-50', dark, 1, op(0.6));
  let extra = stroke('M-6,-76Q0,-82 6,-76', gold, 2.2, 'stroke-linecap="round"');
  if (variant % 2 === 0) extra += stroke('M-16,-22L-18,-98', shade(dark, -0.2), 1.6) + path('M-18,-98l-2,-6l4,0z', gold);
  else extra += `<circle cx="-16" cy="-24" r="4" fill="${gold}"/>`;
  return `<g transform="translate(${n(x)} ${n(base)}) scale(${n(sc)})">${path(d, fill)}${head}${extra}</g>`;
}

/** 10 · The Hall of Caesars — teal-and-gold barrel-vaulted hall of statues. */
function hallOfCaesars(s: S): void {
  s.lit = 1;
  const VX = 800;
  const VY = 400;
  const f = 760;
  const pj = (X: number, Y: number, Z: number): [number, number] => [VX + (X * f) / Z, VY + (Y * f) / Z];
  const FY = 440;
  const SY = -620; // vault spring line
  const WX = 900;
  const ZN = 380;
  const ZB = 3400;
  const quad = (a: [number, number], b: [number, number], c: [number, number], d: [number, number]) =>
    `M${P(a[0], a[1])}L${P(b[0], b[1])}L${P(c[0], c[1])}L${P(d[0], d[1])}Z`;
  s.add(rect(0, 0, W, H, '#0f2a3a'));
  // vault: big teal field + gold ribs (arcs) + coffers
  s.add(rect(0, 0, W, pj(0, SY, ZB)[1], s.lg([[0, '#0c2230'], [1, '#1f4a5a']])));
  const ribs: number[] = [];
  for (let z = ZN; z <= ZB; z *= 1.28) ribs.push(z);
  let ribD = '';
  let cof = '';
  for (let i = ribs.length - 1; i >= 0; i--) {
    const z = ribs[i];
    const [cx, cy] = pj(0, SY, z);
    const r = (WX * f) / z;
    ribD += `M${P(cx - r, cy)}A${n(r)},${n(r)} 0 0,1 ${P(cx + r, cy)}`;
    if (i < ribs.length - 1) {
      const z2 = ribs[i + 1];
      const [cx2, cy2] = pj(0, SY, z2);
      const r2 = (WX * f) / z2;
      for (let k = 1; k < 8; k++) {
        const a = Math.PI * (k / 8);
        const xA = cx - Math.cos(a) * r;
        const yA = cy - Math.sin(a) * r;
        const xB = cx2 - Math.cos(a) * r2;
        const yB = cy2 - Math.sin(a) * r2;
        const mx = xA + (xB - xA) * 0.5;
        const my = yA + (yB - yA) * 0.5;
        cof += circ(mx, my, Math.max(1.5, (r - r2) * 0.07));
      }
    }
  }
  s.add(stroke(ribD, '#d9a440', 5, op(0.9)), path(cof, '#e8c060', op(0.8)));
  // longitudinal gold lines along the vault
  let lon = '';
  for (let k = 1; k < 8; k++) {
    const a = Math.PI * (k / 8);
    const p0 = pj(-Math.cos(a) * WX, SY - Math.sin(a) * WX, ZN);
    const p1 = pj(-Math.cos(a) * WX, SY - Math.sin(a) * WX, ZB);
    lon += `M${P(p0[0], p0[1])}L${P(p1[0], p1[1])}`;
  }
  s.add(stroke(lon, '#d9a440', 2.4, op(0.6)));
  // back wall with glowing doorway and golden eagle
  const bL = pj(-WX, SY, ZB);
  const bR = pj(WX, FY, ZB);
  const bcy = pj(0, SY, ZB)[1];
  const br = (WX * f) / ZB;
  s.add(path(`M${P(bL[0], bR[1])}V${n(bcy)}A${n(br)},${n(br)} 0 0,1 ${P(bR[0], bcy)}V${n(bR[1])}Z`, s.lg([[0, '#2a6a74'], [1, '#1a4a54']])));
  const d0 = pj(-170, -420, ZB);
  const d1 = pj(170, FY, ZB);
  s.add(`<circle cx="${n(VX)}" cy="${n((d0[1] + d1[1]) / 2)}" r="330" fill="${s.rgu([[0, '#ffd890', 0.85], [0.3, '#ffc060', 0.35], [1, '#ffc060', 0]], VX, (d0[1] + d1[1]) / 2, 330)}"/>`);
  s.add(path(`M${P(d0[0], d1[1])}V${n(d0[1] + 30)}A${n((d1[0] - d0[0]) / 2)},${n((d1[0] - d0[0]) / 2)} 0 0,1 ${P(d1[0], d0[1] + 30)}V${n(d1[1])}Z`, s.lg([[0, '#fff2c8'], [1, '#ffd070']])));
  s.add(standard(s, VX, d0[1] - 6, 30, 'aquila', '#b03030', '#e8b440'));
  // walls
  for (const side of [-1, 1]) {
    s.add(path(quad(pj(side * WX, SY, ZN), pj(side * WX, SY, ZB), pj(side * WX, FY, ZB), pj(side * WX, FY, ZN)), s.lg(side < 0 ? [[0, '#2f6a74'], [1, '#3f8a8a']] : [[0, '#2a5a64'], [1, '#1c4450']], 0, 0, 1, 0)));
    // gold cornice at the spring line
    s.add(stroke(`M${P(...pj(side * WX, SY, ZN))}L${P(...pj(side * WX, SY, ZB))}`, '#e8c060', 10), stroke(`M${P(...pj(side * WX, SY + 40, ZN))}L${P(...pj(side * WX, SY + 40, ZB))}`, '#d9a440', 4));
  }
  // floor: polished teal marble with gold inlays and reflections
  s.add(path(quad(pj(-WX, FY, ZN), pj(WX, FY, ZN), pj(WX, FY, ZB), pj(-WX, FY, ZB)), s.lg([[0, '#4a8a8a'], [1, '#1f5058']])));
  let inl = '';
  for (const X of [-600, -300, 0, 300, 600]) inl += `M${P(...pj(X, FY, ZN))}L${P(...pj(X, FY, ZB))}`;
  for (let z = ZN; z < ZB; z *= 1.28) inl += `M${P(...pj(-WX, FY, z))}L${P(...pj(WX, FY, z))}`;
  s.add(stroke(inl, '#e8c060', 2, op(0.5)));
  s.add(medallion(VX, 820, 190, 0.2, '#e8c060', '#1f5058', '#f4d888'));
  s.add(path(`M${P(...pj(-170, FY, ZB))}L${P(...pj(170, FY, ZB))}L${P(...pj(500, FY, ZN))}L${P(...pj(-500, FY, ZN))}Z`, s.lg([[0, '#ffe0a0', 0.55], [1, '#ffe0a0', 0]])));
  // niches + colossal statues along both walls (far to near)
  const items: string[] = [];
  let v = 0;
  for (let z = ZB - 300; z > ZN + 60; z /= 1.42) {
    for (const side of [-1, 1]) {
      const nb = pj(side * WX, FY - 120, z);
      const nt = pj(side * WX, SY + 60, z);
      const sc = f / z;
      const nw = 260 * sc;
      const nh = nb[1] - nt[1];
      // niche (drawn as a frontal arch approximating the receding wall)
      const nx = nb[0] - side * nw * 0.15;
      items.push(path(`M${P(nx - nw / 2, nb[1])}V${n(nt[1] + nw / 2)}A${n(nw / 2)},${n(nw / 2)} 0 0,1 ${P(nx + nw / 2, nt[1] + nw / 2)}V${n(nb[1])}Z`, s.lg([[0, '#0f2a3a'], [1, '#235a64']])));
      items.push(stroke(`M${P(nx - nw / 2, nb[1])}V${n(nt[1] + nw / 2)}A${n(nw / 2)},${n(nw / 2)} 0 0,1 ${P(nx + nw / 2, nt[1] + nw / 2)}V${n(nb[1])}`, '#d9a440', Math.max(1.5, 10 * sc)));
      // plinth
      items.push(rect(nx - nw * 0.36, nb[1] - 4 * sc, nw * 0.72, 130 * sc, s.lg([[0, '#f6f0de'], [1, '#a8a088']], 0, 0, 1, 0)), rect(nx - nw * 0.4, nb[1] - 10 * sc, nw * 0.8, 12 * sc, '#e8c060'));
      items.push(emperorStatue(s, nx, nb[1] - 10 * sc, nh * 0.86, v++, '#f4eedc', '#8a948a', '#e8c060'));
    }
  }
  s.add(items.join(''));
  // warm shafts from lunette windows high on the left
  let sh = '';
  for (const z of [700, 1300, 2300]) {
    const a = pj(-WX * 0.7, SY - 500, z);
    const b = pj(-WX * 0.4, SY - 640, z + 200);
    const c = pj(500, FY, z + 900);
    const d = pj(150, FY, z + 500);
    sh += `M${P(a[0], a[1])}L${P(b[0], b[1])}L${P(c[0], c[1])}L${P(d[0], d[1])}Z`;
  }
  s.add(path(sh, s.lg([[0, '#ffe6a8', 0.45], [1, '#ffe6a8', 0.04]], 0, 0, 1, 1)));
  let motes = '';
  for (let i = 0; i < 50; i++) motes += circ(s.rnd(300, 1200), s.rnd(100, 700), s.rnd(1, 2.4));
  s.add(path(motes, '#fff0c0', op(0.55)));
  // red & gold banners hanging from the near vault
  for (const bx of [250, 1300]) s.add(hangingBanner(s, bx, 0, 70, 250, '#b03030', '#e8c060', `<path d="${starPath5(bx + 35, 150, 18)}" fill="#e8c060"/>`));
  vignette(s, '#06141c', 0.4);
}

/** Golden throne with high back. */
function throne(s: S, x: number, base: number, h: number): string {
  const w = h * 0.62;
  const gold = s.lg([[0, '#fff0a8'], [0.35, '#f4cf6a'], [0.75, '#c8902a'], [1, '#8a5a12']], 0, 0, 1, 0);
  let o = '';
  // back
  o += path(`M${P(x - w * 0.42, base - h * 0.45)}V${n(base - h * 0.8)}Q${P(x - w * 0.42, base - h)} ${P(x, base - h * 1.06)}Q${P(x + w * 0.42, base - h)} ${P(x + w * 0.42, base - h * 0.8)}V${n(base - h * 0.45)}Z`, gold);
  o += path(`M${P(x - w * 0.3, base - h * 0.47)}V${n(base - h * 0.78)}Q${P(x - w * 0.3, base - h * 0.92)} ${P(x, base - h * 0.95)}Q${P(x + w * 0.3, base - h * 0.92)} ${P(x + w * 0.3, base - h * 0.78)}V${n(base - h * 0.47)}Z`, s.lg([[0, '#7a2a8a'], [1, '#3a1a5a']]));
  o += path(starPath5(x, base - h * 0.74, h * 0.08), '#f4cf6a');
  // finials
  o += `<circle cx="${n(x - w * 0.42)}" cy="${n(base - h * 0.84)}" r="${n(h * 0.04)}" fill="#fff0a8"/><circle cx="${n(x + w * 0.42)}" cy="${n(base - h * 0.84)}" r="${n(h * 0.04)}" fill="#fff0a8"/>`;
  o += path(`M${P(x - h * 0.03, base - h * 1.06)}l${n(h * 0.03)},${n(-h * 0.1)}l${n(h * 0.03)},${n(h * 0.1)}z`, '#fff0a8');
  // seat + cushion
  o += rect(x - w * 0.46, base - h * 0.47, w * 0.92, h * 0.1, s.lg([[0, '#b04a8a'], [1, '#6a1a5a']]), `rx="${n(h * 0.03)}"`);
  o += rect(x - w * 0.5, base - h * 0.38, w, h * 0.08, gold);
  // legs / front panel
  o += path(`M${P(x - w * 0.48, base - h * 0.3)}h${n(w * 0.96)}l${n(-w * 0.04)},${n(h * 0.3)}h${n(-w * 0.88)}z`, s.lg([[0, '#f4cf6a'], [1, '#8a5a12']]));
  o += path(`M${P(x - w * 0.3, base - h * 0.24)}h${n(w * 0.6)}v${n(h * 0.18)}h${n(-w * 0.6)}z`, '#5a2a6a', op(0.6));
  // armrests with scrolls
  for (const k of [-1, 1]) {
    o += path(`M${P(x + k * w * 0.46, base - h * 0.38)}V${n(base - h * 0.56)}q${n(k * w * 0.16)},0 ${n(k * w * 0.16)},${n(h * 0.08)}V${n(base - h * 0.3)}z`, gold);
    o += `<circle cx="${n(x + k * w * 0.58)}" cy="${n(base - h * 0.5)}" r="${n(h * 0.035)}" fill="#fff0a8"/>`;
  }
  return o;
}

/** Floating broken column with cloud wisps. */
function floatingColumn(s: S, x: number, y: number, h: number, rot: number, colId: string, broken = true): string {
  let o = `<g transform="translate(${n(x)} ${n(y)}) rotate(${n(rot)})">`;
  o += col(colId, 0, 0, h, 1.1);
  if (broken) o += path(`M${P(-h * 0.06, -h * 0.98)}l${n(h * 0.03)},${n(-h * 0.04)}l${n(h * 0.03)},${n(h * 0.02)}l${n(h * 0.03)},${n(-h * 0.05)}l${n(h * 0.03)},${n(h * 0.07)}z`, '#f8f0dc');
  o += path(`M${P(-h * 0.11, 0)}h${n(h * 0.22)}l${n(-h * 0.05)},${n(h * 0.12)}l${n(-h * 0.06)},${n(-h * 0.03)}l${n(-h * 0.05)},${n(h * 0.06)}z`, s.lg([[0, '#e8dcc8'], [1, '#8a7aa8']]));
  return o + '</g>';
}

/** Aurora ribbon. */
function aurora(s: S, y: number, amp: number, h: number, c: string, alpha: number, phase: number): string {
  let top = `M-20,${n(y)}`;
  let bot = '';
  const pts: [number, number][] = [];
  for (let i = 0; i <= 8; i++) {
    const x = -20 + i * 205;
    pts.push([x, y + Math.sin(i * 0.9 + phase) * amp]);
  }
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    top += `C${P(x0 + 70, y0)} ${P(x1 - 70, y1)} ${P(x1, y1)}`;
  }
  for (let i = pts.length - 1; i > 0; i--) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[i - 1];
    bot += `C${P(x0 - 70, y0 + h)} ${P(x1 + 70, y1 + h)} ${P(x1, y1 + h)}`;
  }
  return path(`${top}L${P(pts[pts.length - 1][0], pts[pts.length - 1][1] + h)}${bot}Z`, s.lg([[0, c, 0], [0.4, c, alpha], [1, c, 0]]));
}

/** 11 · The Eternal Throne — celestial golden throne above the clouds. */
function eternalThrone(s: S): void {
  s.lit = 1;
  sky(s, [[0, '#0b1440'], [0.25, '#2a2a78'], [0.45, '#6a4aa8'], [0.62, '#d07aa8'], [0.75, '#ffc8a0']]);
  let st = '';
  let big = '';
  for (let i = 0; i < 140; i++) {
    const x = s.rnd(0, W);
    const y = Math.pow(s.r.next(), 1.5) * 380;
    if (i % 10 === 0) big += starPath5(x, y, s.rnd(3, 5.5));
    else st += circ(x, y, s.rnd(0.5, 1.6));
  }
  s.add(path(st, '#ffffff', op(0.85)), path(big, '#fff2c0'));
  s.add(aurora(s, 40, 40, 160, '#5af0c0', 0.35, 0), aurora(s, 90, 50, 140, '#f080d0', 0.28, 2), aurora(s, 10, 30, 120, '#80c0ff', 0.3, 4));
  // radiant halo behind the throne
  const TX = 800;
  const TB = 330;
  s.add(`<circle cx="${TX}" cy="${TB - 110}" r="560" fill="${s.rgu([[0, '#fff4c8', 0.95], [0.18, '#ffe08a', 0.6], [0.45, '#f4a0a0', 0.22], [1, '#f4a0a0', 0]], TX, TB - 110, 560)}"/>`);
  shafts(s, TX, TB - 110, -Math.PI, Math.PI, 28, 900, '#fff0c0', 0.22);
  s.add(`<circle cx="${TX}" cy="${TB - 110}" r="150" fill="none" stroke="#fff0b0" stroke-width="3" opacity=".7"/><circle cx="${TX}" cy="${TB - 110}" r="180" fill="none" stroke="#ffe08a" stroke-width="1.5" opacity=".5" stroke-dasharray="4 10"/><circle cx="${TX}" cy="${TB - 110}" r="120" fill="none" stroke="#fff8e0" stroke-width="8" opacity=".35"/>`);
  // distant cloud sea
  cloud(s, 300, 470, 800, 120, '#ffe4d8', '#b07ab8', 0.9, 8);
  cloud(s, 1300, 470, 820, 130, '#ffe4d8', '#b07ab8', 0.9, 8);
  // floating columns (far)
  const cFar = defColumn(s, '#fff8ec', '#d8cce8', '#8a7aa8', 'ionic', '#f4cf6a', true);
  s.add(floatingColumn(s, 330, 330, 150, -8, cFar), floatingColumn(s, 1250, 300, 170, 10, cFar), floatingColumn(s, 560, 200, 90, 14, cFar), floatingColumn(s, 1060, 180, 100, -12, cFar));
  // marble platform with steps
  let steps = '';
  for (let i = 0; i < 5; i++) {
    const w = 260 + i * 70;
    const y = TB + i * 18;
    steps += rect(TX - w / 2, y, w, 18, i % 2 ? '#efe4cc' : '#f8f0dc') + rect(TX - w / 2, y, w, 3, '#ffffff', op(0.9)) + rect(TX - w / 2, y + 15, w, 3, '#f4cf6a', op(0.8));
  }
  s.add(steps, path(`M${TX - 290},${TB + 90}h580l-70,60h-440z`, s.lg([[0, '#c8b8e0'], [1, '#6a5a9a']])));
  s.add(throne(s, TX, TB, 240));
  // laurel wreath floating above the throne
  s.add(`<g transform="translate(${TX} ${TB - 300}) scale(0.32)">${path(laurelRing(0, 0, 120, 34, 11), '#f4cf6a')}</g>`);
  // braziers on the platform
  s.add(torch(s, TX - 230, TB + 10, 1.2, '#c8902a', '#ffd070'), torch(s, TX + 230, TB + 10, 1.2, '#c8902a', '#ffd070'));
  // near cloud banks
  cloud(s, 120, 680, 700, 170, '#fff4ec', '#c890c8', 1, 7);
  cloud(s, 1480, 690, 720, 180, '#fff4ec', '#c890c8', 1, 7);
  cloud(s, 800, 930, 1400, 240, '#fff8f0', '#e0b0d0', 1, 9);
  // big near floating columns at the edges
  const cNear = defColumn(s, '#ffffff', '#e8e0f0', '#8a7aa8', 'corinth', '#f4cf6a', true);
  s.add(floatingColumn(s, 90, 640, 520, -4, cNear, false), floatingColumn(s, 1520, 660, 540, 5, cNear, true));
  cloud(s, 90, 700, 360, 90, '#ffffff', '#d0a8d8', 1, 5);
  cloud(s, 1520, 720, 380, 90, '#ffffff', '#d0a8d8', 1, 5);
  // doves
  birds(s, 520, 120, 4, 50, '#ffffff', 10);
  birds(s, 1150, 90, 3, 40, '#ffffff', 9);
  // sparkles
  let sp = '';
  for (let i = 0; i < 40; i++) sp += starPath5(s.rnd(150, 1450), s.rnd(80, 800), s.rnd(2, 4));
  s.add(path(sp, '#fff4c8', op(0.85)));
  vignette(s, '#141033', 0.3);
}

const SCENES: ((s: S) => void)[] = [
  dustPits, legionCamp, ironCitadel, gladiatorsCourt, forumOfTriumph, praetorianBastion,
  senateHall, consularPalace, grandColosseum, imperialPalace, hallOfCaesars, eternalThrone,
];

/** Full-bleed arena backdrop SVG for arena 0..11. */
export function arenaBackdropSvg(arenaIndex: number): string {
  const i = Math.max(0, Math.min(11, Math.floor(Number.isFinite(arenaIndex) ? arenaIndex : 0)));
  const s = new S(i);
  (SCENES[i] ?? SCENES[0])(s);
  return s.svg();
}
