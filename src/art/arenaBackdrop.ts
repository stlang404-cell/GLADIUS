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

/** Subtle warm frame vignette (never muddy). */
function vignette(s: S, color: string, strength = 0.35): void {
  s.add(rect(0, 0, W, H, s.rgu([[0.55, color, 0], [0.85, color, strength * 0.6], [1, color, strength]], W / 2, H * 0.48, W * 0.62, 0.78)));
}

/** Gentle centre calm-down glow behind the board card. */
function centerGlow(s: S, color: string, strength = 0.35, cy = 470): void {
  s.add(`<ellipse cx="800" cy="${n(cy)}" rx="520" ry="330" fill="${s.rgu([[0, color, strength], [0.6, color, strength * 0.5], [1, color, 0]], 800, cy, 520, 330 / 520)}"/>`);
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

const SCENES: ((s: S) => void)[] = [dustPits];

/** Full-bleed arena backdrop SVG for arena 0..11. */
export function arenaBackdropSvg(arenaIndex: number): string {
  const i = Math.max(0, Math.min(11, Math.floor(Number.isFinite(arenaIndex) ? arenaIndex : 0)));
  const s = new S(i);
  (SCENES[i] ?? SCENES[0])(s);
  return s.svg();
}
