/**
 * Arena backdrops — stylized Roman key-art illustrations (viewBox 0 0 1600 900,
 * preserveAspectRatio slice). Twenty-four unique places, one per arena 0..23.
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

  /** @param arena canonical index (ids) · @param seed RNG seed slot (legacy scenes keep their old slot so artwork is unchanged) */
  constructor(arena: number, seed = arena) {
    this.id = idPrefix('arena-art', arena);
    this.r = createRng(0x51a7 + seed * 7919);
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

// ==== NEW-HELPERS-START
// ------------------------------------------------------------------ toolkit for arenas added in the 24-arena empire

type Pt = [number, number];

/** One-point perspective camera: world (X right, Y down, Z depth) → screen. */
function cam(VX: number, VY: number, f: number) {
  const pj = (X: number, Y: number, Z: number): Pt => [VX + (X * f) / Z, VY + (Y * f) / Z];
  const quad = (a: Pt, b: Pt, c: Pt, d: Pt) => `M${P(a[0], a[1])}L${P(b[0], b[1])}L${P(c[0], c[1])}L${P(d[0], d[1])}Z`;
  /** Rectangle on the floor/ceiling plane Y between X0..X1 and Z0..Z1. */
  const flat = (X0: number, X1: number, Y: number, Z0: number, Z1: number) => quad(pj(X0, Y, Z0), pj(X1, Y, Z0), pj(X1, Y, Z1), pj(X0, Y, Z1));
  /** Rectangle on a side wall plane X between Y0..Y1 and Z0..Z1. */
  const side = (X: number, Y0: number, Y1: number, Z0: number, Z1: number) => quad(pj(X, Y0, Z0), pj(X, Y0, Z1), pj(X, Y1, Z1), pj(X, Y1, Z0));
  /** Rectangle facing the camera at depth Z. */
  const front = (X0: number, X1: number, Y0: number, Y1: number, Z: number) => quad(pj(X0, Y0, Z), pj(X1, Y0, Z), pj(X1, Y1, Z), pj(X0, Y1, Z));
  return { pj, quad, flat, side, front, f };
}

/** Civilian in a tunic or toga (base centre x, feet at base, height h). */
function person(x: number, base: number, h: number, robe: string, skin: string, opts: { hair?: string; sash?: string; arm?: number; dir?: number } = {}): string {
  const u = h / 10;
  const dir = opts.dir ?? 1;
  let o = path(`M${P(x - 1.9 * u, base)}L${P(x - 1.5 * u, base - 5 * u)}Q${P(x - 1.6 * u, base - 7.7 * u)} ${P(x, base - 7.9 * u)}Q${P(x + 1.6 * u, base - 7.7 * u)} ${P(x + 1.5 * u, base - 5 * u)}L${P(x + 1.9 * u, base)}Z`, robe);
  if (opts.sash) o += path(`M${P(x - 1.4 * u, base - 7.4 * u)}L${P(x + 1.5 * u, base - 3 * u)}L${P(x + 1.6 * u, base - 4.2 * u)}L${P(x - 0.6 * u, base - 7.8 * u)}Z`, opts.sash);
  if (opts.arm) o += stroke(`M${P(x + dir * 1.2 * u, base - 7.2 * u)}l${n(dir * 2.4 * u)},${n(-opts.arm * u)}`, robe, Math.max(1, 0.9 * u), 'stroke-linecap="round"');
  o += `<circle cx="${n(x)}" cy="${n(base - 8.9 * u)}" r="${n(1.05 * u)}" fill="${skin}"/>`;
  if (opts.hair) o += path(`M${P(x - 1.1 * u, base - 8.8 * u)}Q${P(x, base - 10.6 * u)} ${P(x + 1.1 * u, base - 8.8 * u)}Z`, opts.hair);
  return o;
}

/** Training gladiator: bare torso, helmet, shield and wooden sword. */
function gladiator(x: number, base: number, h: number, c: { skin: string; cloth: string; metal: string; shield: string }, dir = 1, lunge = 0): string {
  const u = h / 10;
  const hip = base - 4.6 * u;
  let o = stroke(`M${P(x - 0.8 * u, hip)}L${P(x - (1.6 + lunge * 1.4) * u * dir, base)}M${P(x + 0.8 * u, hip)}L${P(x + (1.4 + lunge * 1.8) * u * dir, base)}`, c.skin, 1.1 * u, 'stroke-linecap="round"');
  o += path(`M${P(x - 1.5 * u, hip + 0.6 * u)}L${P(x - 1.3 * u, base - 8 * u)}Q${P(x, base - 8.5 * u)} ${P(x + 1.3 * u, base - 8 * u)}L${P(x + 1.5 * u, hip + 0.6 * u)}Z`, c.skin);
  o += path(`M${P(x - 1.7 * u, hip - 0.6 * u)}h${n(3.4 * u)}l${n(-0.4 * u)},${n(2.2 * u)}h${n(-2.6 * u)}z`, c.cloth);
  o += rect(x - 1.7 * u, hip - 0.9 * u, 3.4 * u, 0.6 * u, c.metal);
  // sword arm
  o += stroke(`M${P(x + dir * 1 * u, base - 7.6 * u)}L${P(x + dir * 3.2 * u, base - (6.4 + lunge) * u)}`, c.skin, 0.9 * u, 'stroke-linecap="round"');
  o += stroke(`M${P(x + dir * 3.2 * u, base - (6.4 + lunge) * u)}l${n(dir * 3.4 * u)},${n(-2.2 * u)}`, '#c8955c', 0.8 * u, 'stroke-linecap="round"');
  // helmet
  o += `<circle cx="${n(x)}" cy="${n(base - 9.1 * u)}" r="${n(1.25 * u)}" fill="${c.metal}"/>`;
  o += path(`M${P(x - 1.9 * u, base - 8.6 * u)}h${n(3.8 * u)}v${n(0.5 * u)}h${n(-3.8 * u)}z`, c.metal);
  o += path(`M${P(x - 0.3 * u, base - 10.2 * u)}q${n(-dir * 1.4 * u)},${n(-1.2 * u)} ${n(-dir * 2.4 * u)},${n(-0.2 * u)}l${n(dir * 2.2 * u)},${n(0.8 * u)}z`, c.cloth);
  // shield (scutum) on the off-hand side
  o += rect(x - dir * 3.6 * u - 1.4 * u, base - 8 * u, 2.8 * u, 4.6 * u, c.shield, `rx="${n(0.5 * u)}"`);
  o += rect(x - dir * 3.6 * u - 0.25 * u, base - 8 * u, 0.5 * u, 4.6 * u, c.metal, op(0.8));
  return o;
}

/** Soft rising smoke / steam wisps from (x,y). */
function smoke(s: S, x: number, y: number, h: number, w: number, color: string, alpha: number, drift = 0.4): string {
  let d = '';
  const k = 12;
  for (let i = 0; i < k; i++) {
    const t = i / k;
    const cx = x + Math.sin(t * 6 + s.rnd(0, 0.6)) * w * 0.35 + drift * h * t * t;
    const cy = y - h * t;
    const r = w * (0.3 + t * 0.7);
    d += `M${P(cx - r, cy)}a${n(r)},${n(r * 0.8)} 0 1,0 ${n(2 * r)},0a${n(r)},${n(r * 0.8)} 0 1,0 ${n(-2 * r)},0Z`;
  }
  return path(d, color, op(alpha));
}

/** Horizontal water glints (short strokes) within a band. */
function glints(s: S, x0: number, x1: number, y0: number, y1: number, count: number, color: string, alpha: number, len = 30): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    const t = s.r.next();
    const y = y0 + (y1 - y0) * t * t;
    const sc = 0.3 + ((y - y0) / Math.max(1, y1 - y0)) * 1.2;
    const x = s.rnd(x0, x1);
    d += `M${P(x, y)}h${n(len * sc * s.rnd(0.5, 1.4))}`;
  }
  return stroke(d, color, 2, `stroke-linecap="round" ${op(alpha)}`);
}

/** Garland swags between consecutive x positions at height y. */
function garlands(xs: number[], y: number, sag: number, leaf: string, hi: string, w = 6): string {
  let d = '';
  for (let i = 0; i < xs.length - 1; i++) d += `M${P(xs[i], y)}Q${P((xs[i] + xs[i + 1]) / 2, y + sag * 2)} ${P(xs[i + 1], y)}`;
  return stroke(d, leaf, w, 'stroke-linecap="round"') + stroke(d, hi, w * 0.3, op(0.8));
}

/** Simple wooden sailing merchant ship (corbita), facing dir, base = waterline. */
function corbita(s: S, x: number, base: number, sc: number, hull: string, sail: string, stripe: string, dir = 1): string {
  const u = sc;
  const X = (v: number) => x + dir * v * u;
  let o = path(`M${P(X(-60), base - 22 * u)}L${P(X(54), base - 22 * u)}Q${P(X(70), base - 30 * u)} ${P(X(66), base - 46 * u)}Q${P(X(78), base - 26 * u)} ${P(X(56), base)}L${P(X(-48), base)}Q${P(X(-66), base - 8 * u)} ${P(X(-60), base - 22 * u)}Z`, s.lg([[0, shade(hull, 0.15)], [1, shade(hull, -0.35)]]));
  // stern swan-neck
  o += stroke(`M${P(X(-58), base - 22 * u)}Q${P(X(-74), base - 40 * u)} ${P(X(-62), base - 50 * u)}`, hull, 4 * u, 'stroke-linecap="round"');
  o += stroke(`M${P(X(-56), base - 14 * u)}L${P(X(58), base - 14 * u)}`, stripe, 2.4 * u);
  // mast + sail
  o += stroke(`M${P(X(0), base - 22 * u)}V${n(base - 118 * u)}M${P(X(-40), base - 110 * u)}L${P(X(40), base - 110 * u)}`, shade(hull, -0.3), 2.6 * u);
  o += path(`M${P(X(-38), base - 108 * u)}L${P(X(38), base - 108 * u)}Q${P(X(46), base - 70 * u)} ${P(X(36), base - 36 * u)}L${P(X(-36), base - 36 * u)}Q${P(X(-44), base - 70 * u)} ${P(X(-38), base - 108 * u)}Z`, s.lg([[0, shade(sail, 0.25)], [0.6, sail], [1, shade(sail, -0.2)]], dir > 0 ? 0 : 1, 0, dir > 0 ? 1 : 0, 0));
  o += stroke(`M${P(X(-20), base - 108 * u)}Q${P(X(-24), base - 72 * u)} ${P(X(-19), base - 36 * u)}M${P(X(0), base - 108 * u)}V${n(base - 36 * u)}M${P(X(20), base - 108 * u)}Q${P(X(24), base - 72 * u)} ${P(X(19), base - 36 * u)}`, shade(sail, -0.3), 1.2 * u, op(0.5));
  // artemon (small bow sail)
  o += stroke(`M${P(X(56), base - 26 * u)}L${P(X(76), base - 66 * u)}`, shade(hull, -0.3), 1.6 * u);
  o += path(`M${P(X(66), base - 64 * u)}l${n(dir * 16 * u)},${n(-4 * u)}l${n(-dir * 4 * u)},${n(22 * u)}l${n(-dir * 14 * u)},${n(2 * u)}z`, sail);
  // reflection
  o += path(`M${P(X(-52), base + 2 * u)}L${P(X(54), base + 2 * u)}L${P(X(40), base + 18 * u)}L${P(X(-40), base + 18 * u)}Z`, hull, op(0.22));
  return o;
}

/** Brazier on a tripod with tall flame and glow (larger, more ornate than torch()). */
function brazier(s: S, x: number, base: number, sc: number, metal: string, glowC = '#ffb347'): string {
  const u = sc;
  let o = `<circle cx="${n(x)}" cy="${n(base - 70 * u)}" r="${n(120 * u)}" fill="${s.rgu([[0, glowC, 0.5], [0.35, glowC, 0.18], [1, glowC, 0]], x, base - 70 * u, 120 * u)}"/>`;
  o += stroke(`M${P(x, base - 48 * u)}L${P(x - 16 * u, base)}M${P(x, base - 48 * u)}L${P(x + 16 * u, base)}M${P(x, base - 48 * u)}V${n(base)}`, shade(metal, -0.35), 3 * u, 'stroke-linecap="round"');
  o += path(`M${P(x - 22 * u, base - 62 * u)}h${n(44 * u)}q${n(-4 * u)},${n(14 * u)} ${n(-22 * u)},${n(16 * u)}q${n(-18 * u)},${n(-2 * u)} ${n(-22 * u)},${n(-16 * u)}z`, s.lg([[0, shade(metal, 0.4)], [0.5, metal], [1, shade(metal, -0.4)]], 0, 0, 1, 0));
  o += rect(x - 24 * u, base - 65 * u, 48 * u, 4 * u, shade(metal, 0.3), `rx="${n(2 * u)}"`);
  o += path(`M${P(x - 18 * u, base - 64 * u)}C${P(x - 22 * u, base - 90 * u)} ${P(x - 4 * u, base - 96 * u)} ${P(x - 2 * u, base - 124 * u)}C${P(x + 8 * u, base - 104 * u)} ${P(x + 26 * u, base - 92 * u)} ${P(x + 18 * u, base - 64 * u)}Z`, '#ff7a1a');
  o += path(`M${P(x - 10 * u, base - 64 * u)}C${P(x - 12 * u, base - 80 * u)} ${P(x - 2 * u, base - 86 * u)} ${P(x, base - 102 * u)}C${P(x + 6 * u, base - 88 * u)} ${P(x + 14 * u, base - 80 * u)} ${P(x + 10 * u, base - 64 * u)}Z`, '#ffd25a');
  o += path(`M${P(x - 4 * u, base - 64 * u)}C${P(x - 5 * u, base - 72 * u)} ${P(x, base - 76 * u)} ${P(x, base - 84 * u)}C${P(x + 3 * u, base - 76 * u)} ${P(x + 6 * u, base - 72 * u)} ${P(x + 4 * u, base - 64 * u)}Z`, '#fff6c8');
  return o;
}

/** Statue of winged Victory (local: base centre x, feet at base, height h). */
function victoryStatue(s: S, x: number, base: number, h: number, gold: string, dark: string): string {
  const u = h / 100;
  const body = s.lg([[0, shade(gold, 0.45)], [0.45, gold], [1, dark]], 0, 0, 1, 0);
  let o = '';
  // wings: raised, with a scalloped feather edge and inner feather lines
  for (const k of [-1, 1]) {
    const sx = x + k * 4 * u;
    const sy = base - 72 * u;
    const tx = x + k * 78 * u;
    const ty = base - 150 * u;
    const lx = x + k * 22 * u;
    const ly = base - 50 * u;
    let d = `M${P(sx, sy)}C${P(x + k * 6 * u, base - 120 * u)} ${P(x + k * 40 * u, base - 150 * u)} ${P(tx, ty)}`;
    const m = 7;
    let lines = '';
    for (let i = 1; i <= m; i++) {
      const t = i / m;
      const px = tx + (lx - tx) * t;
      const py = ty + (ly - ty) * t;
      const pt = tx + (lx - tx) * (t - 0.5 / m);
      const qt = ty + (ly - ty) * (t - 0.5 / m);
      d += `Q${P(pt + k * 12 * u, qt + 10 * u)} ${P(px, py)}`;
      lines += `M${P(px, py)}Q${P((px + sx) / 2 + k * 4 * u, (py + sy) / 2 - 6 * u)} ${P(sx + k * 2 * u, sy - 4 * u)}`;
    }
    d += `Q${P(x + k * 8 * u, base - 60 * u)} ${P(sx, sy)}Z`;
    o += path(d, body) + stroke(lines, dark, 0.8 * u, op(0.45));
  }
  // robe (flowing chiton)
  o += path(`M${P(x - 9 * u, base)}C${P(x - 14 * u, base - 30 * u)} ${P(x - 8 * u, base - 50 * u)} ${P(x - 7 * u, base - 72 * u)}Q${P(x, base - 78 * u)} ${P(x + 7 * u, base - 72 * u)}C${P(x + 10 * u, base - 50 * u)} ${P(x + 22 * u, base - 24 * u)} ${P(x + 24 * u, base - 4 * u)}Q${P(x + 8 * u, base + 2 * u)} ${P(x - 9 * u, base)}Z`, body);
  o += stroke(`M${P(x - 3 * u, base - 66 * u)}Q${P(x - 1 * u, base - 30 * u)} ${P(x - 4 * u, base - 2 * u)}M${P(x + 3 * u, base - 60 * u)}Q${P(x + 8 * u, base - 30 * u)} ${P(x + 14 * u, base - 4 * u)}`, dark, 1.2 * u, op(0.5));
  // raised arm with laurel wreath
  o += stroke(`M${P(x + 5 * u, base - 72 * u)}L${P(x + 14 * u, base - 96 * u)}`, gold, 4 * u, 'stroke-linecap="round"');
  o += `<circle cx="${n(x + 16 * u)}" cy="${n(base - 104 * u)}" r="${n(7 * u)}" fill="none" stroke="#9ad05a" stroke-width="${n(3 * u)}"/>`;
  // palm branch in other hand
  o += stroke(`M${P(x - 6 * u, base - 60 * u)}Q${P(x - 18 * u, base - 50 * u)} ${P(x - 22 * u, base - 30 * u)}`, gold, 2 * u);
  // head
  o += `<circle cx="${n(x)}" cy="${n(base - 82 * u)}" r="${n(5.5 * u)}" fill="${gold}"/>`;
  return o;
}

/** Wave (running dog / vitruvian scroll) border along a horizontal line, as path data. */
function waveBand(x0: number, x1: number, y: number, h: number): string {
  let d = '';
  const step = h * 1.6;
  for (let x = x0; x < x1; x += step) d += `M${P(x, y + h)}C${P(x, y)} ${P(x + step * 0.6, y)} ${P(x + step * 0.6, y + h * 0.45)}C${P(x + step * 0.6, y + h * 0.75)} ${P(x + step * 0.3, y + h * 0.75)} ${P(x + step * 0.32, y + h * 0.5)}`;
  return d;
}

/** Racing quadriga in profile: four horses abreast, light chariot, charioteer in faction colours. */
function raceChariot(s: S, x: number, base: number, sc: number, dir: number, faction: string, coats: string[]): string {
  let o = ell(x + dir * 30 * sc, base + 2 * sc, 70 * sc, 6 * sc, '#6a3a1a', op(0.3));
  // dust plume behind
  o += smoke(s, x - dir * 40 * sc, base - 4 * sc, 40 * sc, 34 * sc, '#f2d6a0', 0.35, -dir * 1.6);
  for (let i = 3; i >= 0; i--) {
    const hx = x + dir * (34 + i * 5) * sc;
    const hy = base - (40 - i * 1.5) * sc;
    o += `<path d="${HORSE}" fill="${coats[i % coats.length]}" transform="translate(${n(hx)} ${n(hy)}) scale(${n(sc * dir)} ${n(sc)})"/>`;
  }
  o += stroke(`M${P(x + dir * 6 * sc, base - 30 * sc)}L${P(x + dir * 44 * sc, base - 26 * sc)}`, '#5a3a20', 1.6 * sc);
  // chariot body + wheel
  o += path(`M${P(x - 12 * sc, base - 30 * sc)}h${n(24 * sc)}l${n(-3 * sc)},${n(16 * sc)}h${n(-18 * sc)}z`, s.lg([[0, '#f2c860'], [1, '#a8762a']]));
  o += `<circle cx="${n(x)}" cy="${n(base - 9 * sc)}" r="${n(9 * sc)}" fill="none" stroke="#5a3a20" stroke-width="${n(2.4 * sc)}"/>` + stroke(`M${P(x - 9 * sc, base - 9 * sc)}h${n(18 * sc)}M${P(x, base - 18 * sc)}v${n(18 * sc)}`, '#5a3a20', 1.2 * sc);
  // charioteer leaning forward
  o += path(`M${P(x - 5 * sc, base - 28 * sc)}l${n(dir * 6 * sc)},${n(-20 * sc)}h${n(dir * 7 * sc)}l${n(-dir * 1 * sc)},${n(20 * sc)}z`, faction);
  o += `<circle cx="${n(x + dir * 7 * sc)}" cy="${n(base - 53 * sc)}" r="${n(4 * sc)}" fill="#c88a62"/>` + path(`M${P(x + dir * 3 * sc, base - 55 * sc)}q${n(dir * 4 * sc)},${n(-7 * sc)} ${n(dir * 8 * sc)},0z`, '#d8d0c0');
  o += stroke(`M${P(x + dir * 9 * sc, base - 44 * sc)}L${P(x + dir * 40 * sc, base - 34 * sc)}`, '#3a2414', 1 * sc);
  return o;
}

/** Caryatid (local: base centre x, feet at base, height h). */
function caryatid(x: number, base: number, h: number, stone: string, shadeC: string): string {
  const u = h / 100;
  let o = rect(x - 10 * u, base - 6 * u, 20 * u, 6 * u, stone);
  o += path(`M${P(x - 9 * u, base - 6 * u)}C${P(x - 11 * u, base - 40 * u)} ${P(x - 8 * u, base - 62 * u)} ${P(x - 7 * u, base - 76 * u)}Q${P(x, base - 80 * u)} ${P(x + 7 * u, base - 76 * u)}C${P(x + 8 * u, base - 62 * u)} ${P(x + 11 * u, base - 40 * u)} ${P(x + 9 * u, base - 6 * u)}Z`, stone);
  o += stroke(`M${P(x - 4 * u, base - 70 * u)}Q${P(x - 5 * u, base - 36 * u)} ${P(x - 3 * u, base - 8 * u)}M${P(x + 1 * u, base - 70 * u)}V${n(base - 8 * u)}M${P(x + 5 * u, base - 66 * u)}Q${P(x + 6 * u, base - 36 * u)} ${P(x + 4 * u, base - 8 * u)}`, shadeC, 1 * u, op(0.6));
  o += `<circle cx="${n(x)}" cy="${n(base - 84 * u)}" r="${n(5 * u)}" fill="${stone}"/>`;
  o += rect(x - 7 * u, base - 96 * u, 14 * u, 7 * u, stone) + rect(x - 10 * u, base - 100 * u, 20 * u, 4 * u, stone);
  return o;
}

/** Peacock displaying its fan (local: feet at base, height h of the body). */
function peacock(s: S, x: number, base: number, h: number, dir: number): string {
  const u = h / 100;
  const X = (v: number) => x + dir * v * u;
  const cx = X(-6);
  const cy = base - 40 * u;
  let fan = '';
  let eyes = '';
  let eyes2 = '';
  const N = 17;
  for (let i = 0; i < N; i++) {
    const a = -Math.PI * 0.95 + (i / (N - 1)) * Math.PI * 0.9;
    const L = 150 * u;
    const ex = cx + Math.cos(a) * L;
    const ey = cy + Math.sin(a) * L;
    const nx = -Math.sin(a) * 9 * u;
    const ny = Math.cos(a) * 9 * u;
    fan += `M${P(cx, cy)}Q${P((cx + ex) / 2 + nx, (cy + ey) / 2 + ny)} ${P(ex, ey)}Q${P((cx + ex) / 2 - nx, (cy + ey) / 2 - ny)} ${P(cx, cy)}Z`;
    eyes += circ(ex - Math.cos(a) * 10 * u, ey - Math.sin(a) * 10 * u, 8 * u);
    eyes2 += circ(ex - Math.cos(a) * 10 * u, ey - Math.sin(a) * 10 * u, 4 * u);
  }
  let o = path(fan, s.rgu([[0, '#1e5a4a'], [0.6, '#2a8a6a'], [1, '#7ac06a']], cx, cy, 150 * u));
  o += path(eyes, '#f2c64a') + path(eyes2, '#1e3a8a');
  o += path(`M${P(X(-14), base - 30 * u)}Q${P(X(-16), base - 56 * u)} ${P(X(6), base - 58 * u)}Q${P(X(14), base - 80 * u)} ${P(X(16), base - 96 * u)}Q${P(X(26), base - 100 * u)} ${P(X(26), base - 90 * u)}Q${P(X(22), base - 70 * u)} ${P(X(24), base - 48 * u)}Q${P(X(20), base - 26 * u)} ${P(X(-14), base - 30 * u)}Z`, s.lg([[0, '#3a6ad8'], [1, '#1e3a8a']]));
  o += path(`M${P(X(26), base - 94 * u)}l${n(dir * 8 * u)},${n(3 * u)}l${n(-dir * 8 * u)},${n(3 * u)}z`, '#e8b84a');
  let crest = '';
  for (let i = -1; i <= 1; i++) crest += `M${P(X(20), base - 99 * u)}l${n(dir * i * 3 * u)},${n(-10 * u)}`;
  o += stroke(crest, '#1e3a8a', 1.2 * u) + `<circle cx="${n(X(22))}" cy="${n(base - 94 * u)}" r="${n(1.6 * u)}" fill="#fff"/>`;
  o += stroke(`M${P(X(0), base - 30 * u)}V${n(base)}M${P(X(8), base - 30 * u)}V${n(base)}`, '#8a6a4a', 2 * u);
  return o;
}
// ==== NEW-HELPERS-END

/** 1 · The Ludus Yard — a gladiator school courtyard: barracks cells, palus posts, lanista's balcony. */
function ludusYard(s: S): void {
  s.lit = 1;
  const { pj, side, flat, front } = cam(800, 370, 800);
  const FY = 280; // ground plane
  const TOP = -520; // roof line
  const MID = -150; // gallery floor
  const ZB = 2300; // back wall
  const WX = 1400;
  sky(s, [[0, '#2f7fc4'], [0.35, '#6fb4e2'], [0.6, '#cfe8ee'], [0.75, '#fff0d4']]);
  sun(s, 300, 90, 30, '#ffffff', '#fff2c0', 380, 0.8);
  shafts(s, 300, 90, Math.PI * 0.05, Math.PI * 0.6, 8, 1100, '#fffbe8', 0.12);
  cloud(s, 1240, 110, 420, 96, '#ffffff', '#b8d2e6');
  cloud(s, 700, 60, 220, 48, '#ffffff', '#c4dcec', 0.9);
  cloud(s, 1500, 220, 240, 44, '#ffffff', '#cfe0ea', 0.8);
  birds(s, 980, 150, 5, 60, '#3a5a7a', 8);
  // distant city beyond the walls: the Flavian amphitheatre's upper ring + hills
  s.add(hills(s, 240, 26, 4, '#a9c6c0'));
  const am = '#e9cfa8';
  s.add(path('M120,250V168Q300,140 520,150V250Z', am));
  let ar = '';
  for (let r = 0; r < 2; r++) for (let k = 0; k < 13; k++) ar += `M${P(140 + k * 28, 236 - r * 34)}v-16a7,7 0 0,1 14,0v16z`;
  s.add(path(ar, '#c49a72'), stroke('M120,200Q300,172 520,184M120,168Q300,140 520,152', '#fff4e0', 3, op(0.7)));
  let pines = '';
  for (const [px, ph] of [[600, 60], [1060, 74], [1130, 58], [1400, 66], [60, 54]]) pines += umbrellaPine(s, px, 254, ph, ph * 1.15, '#7a6a5a', '#6f9a7a', '#a2c49a');
  s.add(pines);
  haze(s, 120, 270, '#f4f6ec', 0, 0.55);

  // ---- back wall: two storeys, cells below and gallery above
  const plaster = s.lg([[0, '#f2d6a6'], [1, '#e2b47e']]);
  s.add(path(front(-WX, WX, TOP, FY, ZB), plaster));
  const stone = patStone(s, 38, 16, '#9a6a3a', '#fff2d6', 0.22, 0.2);
  s.add(path(front(-WX, WX, MID, FY, ZB), stone));
  // red dado and cell doors
  s.add(path(front(-WX, WX, 120, FY, ZB), '#b8432e', op(0.85)));
  let doors = '';
  let doorTop = '';
  for (let X = -1300; X < 1300; X += 200) {
    if (Math.abs(X + 50) < 260) continue;
    const a = pj(X, -40, ZB);
    const b = pj(X + 100, FY, ZB);
    doors += `M${P(a[0], b[1])}V${n(a[1] + 8)}a${n((b[0] - a[0]) / 2)},${n((b[0] - a[0]) / 2)} 0 0,1 ${n(b[0] - a[0])},0V${n(b[1])}Z`;
    doorTop += `M${P(a[0] - 3, a[1] + 8)}h${n(b[0] - a[0] + 6)}`;
  }
  s.add(path(doors, s.lg([[0, '#4a2a18'], [1, '#7a4a2a']])), stroke(doorTop, '#fff2d6', 2, op(0.6)));
  // gallery: wooden floor + posts + railing
  s.add(path(front(-WX, WX, MID - 14, MID + 10, ZB), '#7a4626'));
  s.add(path(front(-WX, WX, TOP + 30, MID - 14, ZB), s.lg([[0, '#6a3a22'], [1, '#a8683e']]), op(0.55)));
  let posts = '';
  for (let X = -1350; X <= 1350; X += 150) {
    const a = pj(X - 10, TOP + 26, ZB);
    const b = pj(X + 10, MID, ZB);
    posts += `M${P(a[0], a[1])}H${n(b[0])}V${n(b[1])}H${n(a[0])}Z`;
  }
  s.add(path(posts, '#8a5030'));
  let rail = '';
  for (let X = -1390; X <= 1390; X += 22) {
    const a = pj(X, MID - 70, ZB);
    rail += `M${P(a[0], a[1])}V${n(pj(X, MID - 14, ZB)[1])}`;
  }
  s.add(stroke(rail, '#6a3a1e', 2.4), path(front(-WX, WX, MID - 76, MID - 66, ZB), '#8a5030'));
  // roof tiles along the back wall
  const tl = pj(-WX, TOP, ZB);
  const tr = pj(WX, TOP, ZB);
  s.add(path(`M${P(tl[0] - 10, tl[1] + 6)}L${P(tl[0] + 20, tl[1] - 22)}H${n(tr[0] - 20)}L${P(tr[0] + 10, tr[1] + 6)}Z`, patTiles(s, 9, 7, '#c4553a')));
  s.add(rect(tl[0] - 10, tl[1] + 2, tr[0] - tl[0] + 20, 6, '#7a2e1c'));

  // ---- lanista's tribunal (projecting balcony with awning) — top centre
  const bx = 800;
  const by = pj(0, MID, ZB)[1];
  s.add(rect(bx - 150, by - 4, 300, 16, '#f6ead2'), rect(bx - 150, by + 12, 300, 8, '#c49a72'));
  s.add(path(`M${P(bx - 140, by + 20)}l20,26h240l20,-26z`, '#d8b688'));
  let bal = '';
  for (let x = bx - 140; x <= bx + 140; x += 14) bal += `M${n(x)},${n(by - 4)}v-34`;
  s.add(stroke(bal, '#f6ead2', 5), rect(bx - 150, by - 46, 300, 10, '#fff6e4'));
  // lanista & guests behind the balustrade
  s.add(person(bx - 20, by - 8, 70, '#f6f0e4', '#c88a62', { sash: '#9a2a24', hair: '#3a2416', arm: 2.6 }));
  s.add(person(bx + 60, by - 8, 58, '#3f7a8a', '#d8a078', { hair: '#2a1a10' }), person(bx - 90, by - 8, 56, '#c49a42', '#c08060', { hair: '#5a3a20' }));
  // striped awning
  let stripes = '';
  const aw0 = bx - 190;
  for (let i = 0; i < 12; i++) if (i % 2 === 0) stripes += `M${P(aw0 + i * 31.7, by - 140)}h31.7l${n(i < 6 ? -4 : 4)},56h-31.7z`;
  s.add(path(`M${P(aw0, by - 140)}h380l12,56h-404z`, '#fff4e2'), path(stripes, '#b8342a'));
  let scal = '';
  for (let i = 0; i < 12; i++) scal += `M${P(aw0 - 12 + i * 33.7, by - 84)}q16.8,16 33.7,0z`;
  s.add(path(scal, '#b8342a'), rect(aw0, by - 146, 380, 8, '#7a2a1c'));
  s.add(stroke(`M${P(bx - 180, by - 84)}V${n(by - 8)}M${P(bx + 180, by - 84)}V${n(by - 8)}`, '#6a3a1e', 6));
  s.add(flag(s, bx, by - 200, 80, 34, '#b8342a', '#5a3018', 1, 0.8));
  s.add(hangingBanner(s, bx - 130, by + 22, 36, 90, '#b8342a', '#f0c060', `<circle cx="${n(bx - 112)}" cy="${n(by + 64)}" r="8" fill="none" stroke="#f0c060" stroke-width="3"/>`));
  s.add(hangingBanner(s, bx + 94, by + 22, 36, 90, '#b8342a', '#f0c060', `<circle cx="${n(bx + 112)}" cy="${n(by + 64)}" r="8" fill="none" stroke="#f0c060" stroke-width="3"/>`));
  // heavy gate under the tribunal (to the arena tunnel)
  const g0 = pj(-150, -60, ZB);
  const g1 = pj(150, FY, ZB);
  s.add(path(`M${P(g0[0], g1[1])}V${n(g0[1] + 40)}a${n((g1[0] - g0[0]) / 2)},${n(40)} 0 0,1 ${n(g1[0] - g0[0])},0V${n(g1[1])}Z`, '#3a2214'));
  let bars = '';
  for (let x = g0[0] + 10; x < g1[0]; x += 14) bars += `M${n(x)},${n(g1[1])}V${n(g0[1] + 26)}`;
  s.add(stroke(bars, '#6a5a4a', 3), stroke(`M${P(g0[0], g0[1] + 70)}H${n(g1[0])}M${P(g0[0], g0[1] + 120)}H${n(g1[0])}`, '#6a5a4a', 3));

  // ---- side wings (receding): left in shade, right sunlit
  for (const k of [-1, 1]) {
    const X = k * WX;
    const lit = k > 0;
    s.add(path(side(X, TOP, FY, 520, ZB), s.lg(lit ? [[0, '#e9b47a'], [1, '#f6d6a2']] : [[0, '#a8724a'], [1, '#c89060']], 0, 0, 1, 0)));
    s.add(path(side(X, MID, FY, 520, ZB), stone));
    s.add(path(side(X, 120, FY, 520, ZB), lit ? '#b8432e' : '#8a3020', op(0.85)));
    let cd = '';
    for (let Z = 700; Z < ZB - 100; Z += 260) cd += side(X, -40, FY, Z, Z + 130);
    s.add(path(cd, lit ? '#6a3a22' : '#3a2214'));
    s.add(path(side(X, MID - 14, MID + 10, 520, ZB), '#7a4626'));
    let gp = '';
    for (let Z = 560; Z < ZB; Z += 220) gp += side(X, TOP + 26, MID, Z, Z + 16);
    s.add(path(gp, '#8a5030'));
    s.add(path(side(X, TOP + 30, MID - 14, 520, ZB), '#5a3018', op(0.4)));
    let wn = '';
    for (let Z = 640; Z < ZB - 100; Z += 220) wn += side(X, TOP + 120, TOP + 250, Z + 50, Z + 150);
    s.add(path(wn, lit ? '#7a4426' : '#3a2214', op(0.85)));
    // roof overhang along the wing
    const r0 = pj(X, TOP, 520);
    const r1 = pj(X, TOP, ZB);
    const r2 = pj(X - k * 160, TOP - 60, ZB);
    const r3 = pj(X - k * 160, TOP - 60, 520);
    s.add(path(`M${P(r0[0], r0[1])}L${P(r1[0], r1[1])}L${P(r2[0], r2[1])}L${P(r3[0], r3[1])}Z`, patTiles(s, 12, 9, '#c4553a', k * 30)));
  }
  // banners on the wings
  for (const k of [-1, 1]) {
    for (const Z of [900, 1400]) {
      const a = pj(k * WX, MID + 14, Z);
      const sc = 800 / Z;
      s.add(hangingBanner(s, a[0] - 20 * sc * 2, a[1], 40 * sc * 2, 110 * sc * 2, k < 0 ? '#2c6a7a' : '#b8342a', '#f0c060'));
    }
  }

  // ---- sand yard
  s.add(path(flat(-WX, WX, FY, 300, ZB), s.lg([[0, '#f6dcae'], [0.4, '#ecc690'], [1, '#d6a066']])));
  // shade cast by the left wing
  s.add(path(`${flat(-WX, -760, FY, 300, ZB)}`, '#8a4a28', op(0.22)));
  // rake arcs and a training circle
  let rake = '';
  for (let Z = 500; Z < ZB; Z *= 1.12) {
    const a = pj(-WX, FY, Z);
    const b = pj(WX, FY, Z);
    rake += `M${P(a[0], a[1])}L${P(b[0], b[1])}`;
  }
  s.add(stroke(rake, '#b8743f', 1.5, op(0.18)));
  s.add(speckles(s, 0, 470, W, H, 220, '#a8653a', 0.3, 3));
  const ring = (Z: number, r: number) => {
    const c = pj(0, FY, Z);
    return `<ellipse cx="${n(c[0])}" cy="${n(c[1])}" rx="${n((r * 800) / Z)}" ry="${n((r * 800 * 0.16) / Z)}" fill="none" stroke="#fff2d0" stroke-width="3" opacity=".55"/>`;
  };
  s.add(ring(1200, 520));

  // ---- palus posts with sparring gladiators (back to front)
  const palus = (X: number, Z: number) => {
    const [x, y] = pj(X, FY, Z);
    const sc = 800 / Z;
    const h = 230 * sc;
    const w = 30 * sc;
    return (
      path(`M${P(x - w / 2, y)}L${P(x + w / 2, y)}L${P(x + w / 2 + 160 * sc, y + 30 * sc)}L${P(x - w / 2 + 160 * sc, y + 34 * sc)}Z`, '#7a3a1c', op(0.25)) +
      rect(x - w / 2, y - h, w, h, s.lg([[0, '#ffd296'], [0.35, '#b8784a'], [1, '#6a3a1c']], 0, 0, 1, 0)) +
      stroke(`M${P(x - w / 2, y - h * 0.62)}l${n(w)},${n(-4 * sc)}M${P(x - w / 2, y - h * 0.4)}l${n(w)},${n(3 * sc)}M${P(x - w / 2, y - h * 0.75)}l${n(w)},${n(2 * sc)}`, '#5a2e14', 2 * sc, op(0.8)) +
      ell(x, y - h, w / 2, w * 0.2, '#d8a06a')
    );
  };
  const glad = (X: number, Z: number, dir: number, cl: string, sh: string, lunge: number) => {
    const [x, y] = pj(X, FY, Z);
    return ell(x, y, 40 * (800 / Z), 8 * (800 / Z), '#7a3a1c', op(0.25)) + gladiator(x, y, 190 * (800 / Z), { skin: '#b87850', cloth: cl, metal: '#d8d0c0', shield: sh }, dir, lunge);
  };
  s.add(palus(-640, 1900), glad(-540, 1900, -1, '#b8342a', '#b8342a', 0.6));
  s.add(palus(700, 1750), glad(590, 1750, 1, '#2c6a7a', '#2c6a7a', 0.8));
  s.add(glad(-150, 1600, 1, '#e8b04b', '#b8342a', 0.7), glad(80, 1600, -1, '#f4ece0', '#2c6a7a', 0.3));
  // the doctor (trainer) watching with his rod
  {
    const [x, y] = pj(-30, FY, 2050);
    s.add(person(x, y, 84, '#6a4a3a', '#b87850', { hair: '#2a1a10', arm: 3 }), stroke(`M${P(x + 8, y - 70)}l18,-30`, '#5a3018', 2.5));
  }
  s.add(palus(-1020, 1100), palus(1040, 1050));
  s.add(glad(-880, 1100, -1, '#b8342a', '#e8b04b', 0.5));

  // ---- foreground props
  const rack = (x: number, y: number, sc: number, flip: number) => {
    let o = ell(x + 45 * sc, y + 4 * sc, 70 * sc, 10 * sc, '#5a2e14', op(0.3));
    o += rect(x, y - 90 * sc, 7 * sc, 90 * sc, '#5e3418') + rect(x + 90 * sc, y - 90 * sc, 7 * sc, 90 * sc, '#5e3418');
    o += rect(x - 6 * sc, y - 76 * sc, 110 * sc, 7 * sc, '#8a5030') + rect(x - 6 * sc, y - 26 * sc, 110 * sc, 7 * sc, '#8a5030');
    let sw = '';
    for (let i = 0; i < 6; i++) sw += `M${P(x + (14 + i * 14) * sc, y - 98 * sc)}v${n(70 * sc)}`;
    o += stroke(sw, '#e0b070', 5 * sc, 'stroke-linecap="round"') + stroke(sw.replace(/v[\d.]+/g, `v${n(12 * sc)}`), '#5a2e14', 8 * sc);
    // helmets on top
    o += `<circle cx="${n(x + (flip > 0 ? 20 : 74) * sc)}" cy="${n(y - 92 * sc)}" r="${n(13 * sc)}" fill="${s.lg([[0, '#fff0c8'], [1, '#a8783a']])}"/>`;
    return o;
  };
  s.add(rack(110, 860, 1.6, 1), rack(1340, 870, 1.6, -1));
  // round parmula + crossed wooden swords in the sand (below the board on phones)
  s.add(ell(800, 852, 140, 18, '#7a3a1c', op(0.22)));
  s.add(g(rect(-110, -7, 220, 14, '#d8a868', 'rx="5"') + rect(-132, -11, 26, 22, '#5a2e14', 'rx="4"') + rect(-110, -7, 220, 4, '#ffe0a8', op(0.6)), 'transform="translate(770 842) rotate(-14)"'));
  s.add(g(rect(-110, -7, 220, 14, '#c8955c', 'rx="5"') + rect(106, -11, 26, 22, '#5a2e14', 'rx="4"'), 'transform="translate(830 842) rotate(12)"'));
  s.add(ell(800, 838, 56, 22, s.lg([[0, '#f6d27a'], [0.5, '#c8902e'], [1, '#7a4a14']])), ell(800, 836, 40, 15, '#b8342a'), ell(800, 834, 12, 5, '#ffe2a0'));
  // retiarius net and trident dropped on the sand
  s.add(stroke('M470,800L640,742', '#8a8270', 5, 'stroke-linecap="round"'), stroke('M630,734l18,14M640,728l14,22M650,724l10,26', '#c8c0b0', 4, 'stroke-linecap="round"'));
  let net = '';
  for (let i = 0; i < 7; i++) net += `M${P(420 + i * 14, 770 + i * 2)}q30,40 70,${n(36 - i * 4)}M${P(410, 790 + i * 8)}q60,${n(-12 + i)} 120,${n(i * 2)}`;
  s.add(stroke(net, '#e8dcc0', 1.6, op(0.75)));
  // water trough + amphora at right, sacks at left
  s.add(rect(1080, 790, 170, 46, s.lg([[0, '#c8b08a'], [1, '#8a7258']])), rect(1086, 790, 158, 10, '#5a9ab0'), rect(1086, 790, 158, 3, '#bfe6f0'));
  const amph = (x: number, y: number, sc: number) =>
    path(`M${P(x - 6 * sc, y - 70 * sc)}h${n(12 * sc)}v${n(8 * sc)}q${n(22 * sc)},${n(10 * sc)} ${n(18 * sc)},${n(34 * sc)}q${n(-4 * sc)},${n(20 * sc)} ${n(-15 * sc)},${n(28 * sc)}h${n(-18 * sc)}q${n(-11 * sc)},${n(-8 * sc)} ${n(-15 * sc)},${n(-28 * sc)}q${n(-4 * sc)},${n(-24 * sc)} ${n(18 * sc)},${n(-34 * sc)}z`, s.lg([[0, '#f0a070'], [0.45, '#c4683c'], [1, '#7a3418']], 0, 0, 1, 0));
  s.add(amph(1290, 846, 1.6), amph(1520, 900, 2.2), amph(330, 880, 1.5));
  s.add(tufts(s, -20, 240, 870, 905, 5, '#8a7a3a', '#d8c070', 50), tufts(s, 1400, 1620, 870, 905, 5, '#8a7a3a', '#d8c070', 50));
  // dust motes in the sunbeam
  let mo = '';
  for (let i = 0; i < 40; i++) mo += circ(s.rnd(200, 1200), s.rnd(300, 800), s.rnd(1, 2.6));
  s.add(path(mo, '#fff6dc', op(0.6)));
  vignette(s, '#6a3a22', 0.28);
}

/** 3 · The Rhine Frontier — timber fort on a misty northern river, deep forest, watchtowers. */
function rhineFrontier(s: S): void {
  s.lit = 1;
  const HY = 430;
  sky(s, [[0, '#4f6f92'], [0.25, '#8eaac0'], [0.45, '#d8d4c8'], [0.55, '#f6d6aa'], [0.62, '#fbe6c4']]);
  sun(s, 860, 300, 40, '#fff4dc', '#ffd8a0', 520, 0.75);
  shafts(s, 860, 300, -Math.PI * 0.95, -Math.PI * 0.05, 12, 900, '#fff2d4', 0.14);
  cloud(s, 260, 130, 460, 80, '#f6e4d0', '#8ea0b8', 0.95, 7);
  cloud(s, 1330, 90, 520, 90, '#f8e8d4', '#94a6bc', 0.95, 7);
  cloud(s, 780, 50, 260, 40, '#f6e6d6', '#a8b4c4', 0.7);
  // geese in a V
  let v = '';
  for (let i = 0; i < 9; i++) {
    const k = i % 2 ? 1 : -1;
    const j = Math.ceil(i / 2);
    const x = 820 + k * j * 26;
    const y = 150 + j * 15;
    v += `M${P(x - 8, y - 3)}Q${P(x - 3, y - 6)} ${P(x, y)}Q${P(x + 3, y - 6)} ${P(x + 8, y - 3)}`;
  }
  s.add(stroke(v, '#3a4a5e', 2.2, 'stroke-linecap="round"'));
  // forested ridges fading into mist
  const ridge = (y: number, amp: number, th: number, fill: string, seedShift: number) => {
    let d = `M0,900L0,${n(y)}`;
    for (let x = 0; x <= W + th; ) {
      const base = y - Math.sin(x / 260 + seedShift) * amp - Math.sin(x / 97 + seedShift * 2) * amp * 0.35;
      const t = th * s.rnd(0.45, 1.3);
      const w = th * s.rnd(0.35, 0.7);
      d += `L${P(x, base)}L${P(x + w * 0.5, base - t)}L${P(x + w, base)}`;
      x += w * s.rnd(0.6, 1.1);
    }
    return path(d + `L${W},900Z`, fill);
  };
  s.add(ridge(330, 40, 16, '#8fa2b0', 1));
  haze(s, 250, 360, '#f2e2cc', 0, 0.55);
  s.add(ridge(375, 34, 22, '#6d8a8c', 2.3));
  haze(s, 300, 400, '#eadccc', 0, 0.5);
  s.add(ridge(410, 20, 30, '#4f6f68', 4.1));
  haze(s, 360, HY + 20, '#e6e0d4', 0, 0.55);
  // the river: silver ribbon from the horizon, widening toward the viewer
  const river = `M${P(760, HY)}C${P(700, 520)} ${P(620, 560)} ${P(460, 640)}C${P(300, 720)} ${P(260, 820)} ${P(200, 900)}L${P(1460, 900)}C${P(1240, 800)} ${P(1060, 700)} ${P(980, 600)}C${P(900, 520)} ${P(880, 470)} ${P(840, HY)}Z`;
  // banks first (meadow green), then the water on top
  s.add(rect(0, HY - 6, W, H - HY + 6, s.lg([[0, '#7a9a6a'], [0.4, '#5f8a4e'], [1, '#3f6a36']])));
  s.add(path(river, s.lg([[0, '#f6e6c8'], [0.25, '#b8ccd4'], [0.6, '#7fa2b4'], [1, '#4f7890']])));
  s.add(path(river, s.lg([[0, '#ffffff', 0.5], [0.4, '#ffffff', 0]]), op(0.8)));
  // sun path on the water
  s.add(ell(820, 520, 70, 110, s.rgu([[0, '#fff6e0', 0.45], [1, '#fff6e0', 0]], 820, 520, 110)));
  s.add(glints(s, 600, 1150, 470, 880, 70, '#ffffff', 0.5, 26));
  // reflections of the far trees
  s.add(stroke('M770,440L760,470M800,440L800,476M826,440L834,468', '#4f6f68', 4, op(0.3)));
  // pontoon bridge crossing the river in the middle distance
  const by = 486;
  let boats = '';
  for (let x = 700; x < 960; x += 26) boats += `M${P(x, by + 6)}q13,10 22,0z`;
  s.add(path(boats, '#5a3a24'), rect(680, by - 2, 300, 7, '#8a6038'), stroke('M680,' + (by - 8) + 'H980', '#6a4a2c', 2));
  s.add(figure(760, by - 2, 22, '#3a2a20', '#a8322a', true, 1), figure(790, by - 2, 22, '#3a2a20', '#a8322a', true, 1), figure(818, by - 2, 22, '#3a2a20', '#a8322a', true, 1));
  // ---- left bank: the timber fort on its earth rampart
  s.add(path('M-20,560Q120,470 360,470Q520,470 640,530Q610,580 560,600Q300,650 -20,660Z', s.lg([[0, '#8a7a52'], [1, '#5a5a36']])));
  s.add(path('M-20,560Q120,470 360,470Q520,470 610,540', 'none', 'stroke="#b8a878" stroke-width="4" opacity=".6"'));
  const palisade = (x0: number, x1: number, base: number, h: number) => {
    let lt = '';
    let dk = '';
    for (let x = x0, i = 0; x < x1; x += 13, i++) {
      const hh = h + s.rnd(-4, 4);
      const d = `M${P(x, base)}V${n(base - hh)}l6.5,-12l6.5,12V${n(base)}Z`;
      if (i % 2) lt += d;
      else dk += d;
    }
    return path(dk, '#6a4a2c') + path(lt, '#8a6440') + stroke(`M${P(x0, base - h * 0.75)}H${n(x1)}M${P(x0, base - h * 0.3)}H${n(x1)}`, '#3a2414', 3, op(0.7));
  };
  {
  const fort: string[] = [];
  const add0 = s.add.bind(s);
  s.add = (...x: string[]) => { fort.push(...x); };
  // barracks roofs inside the fort
  let huts = '';
  for (let i = 0; i < 6; i++) {
    const x = 40 + i * 80;
    huts += `M${P(x, 470)}l40,-34l40,34z`;
  }
  s.add(path(huts, patTiles(s, 9, 7, '#a8583a')));
  s.add(smoke(s, 180, 430, 160, 30, '#e8e4dc', 0.35, 0.5), smoke(s, 360, 436, 130, 24, '#e8e4dc', 0.3, 0.5));
  s.add(palisade(-10, 560, 520, 70));
  // gate tower + two corner towers
  s.add(watchtower(s, 70, 520, 230, '#8a6440', '#5a3a2c'), watchtower(s, 520, 528, 210, '#8a6440', '#5a3a2c'));
  s.add(rect(250, 430, 110, 90, s.lg([[0, '#a07a50'], [1, '#6a4a2c']], 0, 0, 1, 0)), path('M240,432L305,380L370,432Z', '#5a3a2c'), path('M280,520V478a25,25 0 0,1 50,0V520Z', '#2a1a10'));
  s.add(flag(s, 305, 340, 70, 30, '#a8322a', '#3a2414', 1, 0.4), standard(s, 214, 520, 110, 'vex', '#a8322a', '#e8c060'));
  // sentries on the wall walk
  s.add(figure(150, 450, 26, '#2a1e18', '#a8322a', true, 1), figure(430, 452, 26, '#2a1e18', '#a8322a', true, -1));
  s.add = add0;
  s.add(g(fort.join(''), 'transform="translate(70 0)"'));
  }
  // ---- right bank: forest and a beacon tower on a rock
  s.add(path('M975,596C1060,700 1240,800 1460,900H1620V470Q1460,480 1260,500Q1100,520 975,596Z', s.lg([[0, '#6a8a5a'], [1, '#3f6a36']])));
  s.add(path('M1180,520L1230,430L1330,410L1380,470L1400,540Z', s.lg([[0, '#a8a89a'], [1, '#6a6a62']], 0, 0, 1, 0)));
  s.add(watchtower(s, 1290, 432, 190, '#8a6440', '#5a3a2c'));
  s.add(brazier(s, 1290, 260, 0.5, '#5a4a3a'), smoke(s, 1300, 210, 200, 34, '#d8d4cc', 0.35, 0.8));
  let firs = '';
  const firRow = (x0: number, x1: number, base: number, hMin: number, hMax: number, dark: string, light: string, gap: number) => {
    for (let x = x0; x < x1; x += gap * s.rnd(0.7, 1.2)) firs += fir(x, base + s.rnd(-10, 10), s.rnd(hMin, hMax), dark, light);
  };
  firRow(1040, 1180, 560, 60, 90, '#2f4f3a', '#4f7a52', 34);
  firRow(1400, 1640, 520, 90, 150, '#2f4f3a', '#4f7a52', 40);
  firRow(600, 700, 470, 30, 44, '#3f5f4a', '#5f8a62', 26);
  firRow(940, 1040, 480, 30, 46, '#3f5f4a', '#5f8a62', 24);
  s.add(firs);
  haze(s, 420, 620, '#f0ece4', 0.35, 0);
  // mist banks drifting over the water
  for (const [x, y, w] of [[600, 520, 520], [1000, 590, 560], [300, 640, 480]] as [number, number, number][]) s.add(ell(x, y, w / 2, 26, s.rgu([[0, '#ffffff', 0.55], [1, '#ffffff', 0]], x, y, w / 2, 0.1)));
  // patrol boat (navis lusoria) on the river — lower centre
  {
    const x = 800;
    const y = 800;
    s.add(path(`M${P(x - 190, y - 24)}L${P(x + 190, y - 24)}Q${P(x + 236, y - 40)} ${P(x + 230, y - 70)}Q${P(x + 246, y - 26)} ${P(x + 196, y)}L${P(x - 180, y)}Q${P(x - 214, y - 12)} ${P(x - 190, y - 24)}Z`, s.lg([[0, '#9a6a40'], [1, '#4a2e1a']])));
    s.add(stroke(`M${P(x - 180, y - 14)}H${n(x + 196)}`, '#c8a050', 4));
    let shields = '';
    for (let i = 0; i < 9; i++) shields += `M${P(x - 160 + i * 38, y - 52)}h26v30q-13,6 -26,0z`;
    s.add(path(shields, '#a8322a'), stroke(shields, '#e8c060', 2));
    let oars = '';
    for (let i = 0; i < 9; i++) oars += `M${P(x - 150 + i * 38, y - 18)}l${n(-24)},${n(52)}`;
    s.add(stroke(oars, '#6a4a2c', 4, 'stroke-linecap="round"'));
    s.add(stroke(`M${P(x - 10, y - 24)}V${n(y - 170)}`, '#4a2e1a', 5), path(`M${P(x - 60, y - 160)}h110q8,40 -4,80h-102q-12,-40 -4,-80z`, s.lg([[0, '#f4ead6'], [1, '#c8b49a']], 0, 0, 1, 0)), path(`M${P(x - 30, y - 140)}h50v40h-50z`, '#a8322a', op(0.85)));
    s.add(path(`M${P(x - 180, y + 2)}L${P(x + 196, y + 2)}L${P(x + 150, y + 28)}L${P(x - 150, y + 28)}Z`, '#3a2a1a', op(0.25)));
    s.add(stroke(`M${P(x - 260, y + 10)}q40,-8 80,0M${P(x + 220, y + 6)}q40,-8 80,0M${P(x - 300, y + 40)}q50,-8 100,0`, '#ffffff', 2.5, op(0.55)));
  }
  // ---- foreground: reeds, boulders, framing firs, a sentinel
  const reeds = (x0: number, x1: number, base: number) => {
    let d = '';
    let tops = '';
    for (let i = 0; i < 26; i++) {
      const x = s.rnd(x0, x1);
      const h = s.rnd(60, 140);
      const lean = s.rnd(-20, 20);
      d += `M${P(x, base)}q${n(lean * 0.3)},${n(-h * 0.5)} ${n(lean)},${n(-h)}`;
      if (i % 3 === 0) tops += `M${P(x + lean, base - h)}l${n(lean * 0.05)},${n(-18)}`;
    }
    return stroke(d, '#6a7a3a', 3, 'stroke-linecap="round"') + stroke(tops, '#7a4a2a', 7, 'stroke-linecap="round"');
  };
  s.add(path('M-20,900V700Q120,660 260,720Q340,760 380,900Z', s.lg([[0, '#5a7a46'], [1, '#2f4a26']])));
  s.add(path('M1620,900V690Q1460,650 1320,720Q1240,770 1210,900Z', s.lg([[0, '#5a7a46'], [1, '#2f4a26']])));
  s.add(path('M180,820Q220,770 290,780Q340,800 330,860Q260,880 180,860Z', s.lg([[0, '#b8b8a8'], [1, '#6a6a62']])), path('M1280,840Q1300,790 1360,790Q1420,800 1410,860Z', s.lg([[0, '#b8b8a8'], [1, '#6a6a62']])));
  s.add(reeds(300, 470, 880), reeds(1150, 1320, 890));
  let fg = '';
  fg += fir(-10, 900, 540, '#1f3a2a', '#3a6046') + fir(120, 930, 300, '#24432e', '#40684a') + fir(1560, 910, 560, '#1f3a2a', '#3a6046') + fir(1660, 900, 420, '#24432e', '#40684a');
  s.add(fg);
  // sentinel in a red cloak with oval shield on the right bank
  {
    const x = 1350;
    const y = 790;
    s.add(path(`M${P(x - 24, y)}L${P(x - 18, y - 70)}Q${P(x, y - 84)} ${P(x + 18, y - 70)}L${P(x + 26, y)}Z`, '#a8322a'), `<circle cx="${x}" cy="${y - 92}" r="13" fill="#c89a72"/>`, path(`M${P(x - 15, y - 96)}q15,-22 30,0z`, '#c8c8c0'), path(`M${P(x - 2, y - 116)}q-6,-14 10,-16q-2,10 -6,16z`, '#a8322a'));
    s.add(ell(x - 34, y - 46, 22, 40, s.lg([[0, '#c8423a'], [1, '#6a1a14']], 0, 0, 1, 0)), ell(x - 34, y - 46, 6, 6, '#e8c060'), stroke(`M${P(x + 22, y)}V${n(y - 170)}`, '#5a3a20', 4), path(`M${P(x + 22, y - 182)}l5,14h-10z`, '#c8c8c0'));
  }
  s.add(tufts(s, 0, 360, 840, 900, 6, '#3f5a2a', '#7a9a4a', 50), tufts(s, 1240, 1600, 840, 900, 6, '#3f5a2a', '#7a9a4a', 50));
  vignette(s, '#2a3a4a', 0.3);
}

/** 5 · The Harbour of Ostia — lighthouse on the mole, merchant ships, warehouses, bright blue sea. */
function harbourOstia(s: S): void {
  s.lit = -1;
  const HY = 410;
  sky(s, [[0, '#1f6fc0'], [0.3, '#5eb0e6'], [0.44, '#bfe6f4'], [0.46, '#e6f6f6']]);
  sun(s, 1320, 120, 34, '#ffffff', '#fff8dc', 420, 0.75);
  cloud(s, 300, 140, 440, 100, '#ffffff', '#a8cce6');
  cloud(s, 1060, 70, 300, 60, '#ffffff', '#b8d6ec', 0.95);
  cloud(s, 640, 300, 360, 50, '#ffffff', '#cfe6f2', 0.8, 7);
  cloud(s, 1450, 300, 300, 46, '#ffffff', '#cfe6f2', 0.75, 6);
  birds(s, 620, 200, 5, 70, '#ffffff', 11);
  birds(s, 1000, 240, 4, 50, '#3a5a7a', 8);
  // far coast
  s.add(path(`M0,${HY}Q200,${HY - 30} 420,${HY - 14}Q520,${HY - 6} 600,${HY}Z`, '#8ab0b8'), path(`M1080,${HY}Q1300,${HY - 26} 1600,${HY - 20}V${HY}Z`, '#94b8c0'));
  // sea
  s.add(rect(0, HY, W, H - HY, s.lg([[0, '#3a8cc8'], [0.35, '#1f74b0'], [0.7, '#2a9ab8'], [1, '#3ab4c0']])));
  s.add(rect(0, HY, W, 40, s.lg([[0, '#e6f6f6', 0.7], [1, '#e6f6f6', 0]])));
  // sun glitter
  s.add(glints(s, 1100, 1600, HY + 6, 640, 60, '#ffffff', 0.7, 24), glints(s, 0, 1600, HY + 6, 760, 90, '#bfeaf4', 0.5, 30));
  // ---- the moles with arcades curving to the lighthouse island
  const mole = (pts: string, shadeC: string) => path(pts, shadeC);
  s.add(mole(`M-20,520Q300,470 640,452L700,446L700,462L640,468Q300,488 -20,540Z`, '#e8dcc4'));
  s.add(path(`M-20,540Q300,488 640,468L700,462L700,474L640,480Q300,502 -20,560Z`, '#b8a888'));
  let a1 = '';
  for (let i = 0; i < 18; i++) {
    const t = i / 18;
    const x = -10 + t * 690;
    const y = 540 - t * 72 - Math.sin(t * Math.PI) * 10;
    const w = 26 - t * 16;
    a1 += `M${P(x, y + w * 0.75)}v${n(-w * 0.45)}a${n(w * 0.3)},${n(w * 0.3)} 0 0,1 ${n(w * 0.6)},0v${n(w * 0.45)}z`;
  }
  s.add(path(a1, '#5a6a7a', op(0.75)));
  s.add(path(`M1620,520Q1300,470 960,452L900,446L900,462L960,468Q1300,488 1620,540Z`, '#efe4cc'), path(`M1620,540Q1300,488 960,468L900,462L900,474L960,480Q1300,502 1620,560Z`, '#c4b494'));
  // lighthouse island
  s.add(path(`M690,${HY + 52}Q800,${HY + 26} 910,${HY + 52}Z`, '#d8ccb0'));
  // lighthouse: square base, octagonal middle, round lantern with fire — top centre
  {
    const x = 800;
    const b = HY + 46;
    const stone = s.lg([[0, '#fff8ea'], [0.55, '#ece0c8'], [1, '#b8a888']], 0, 0, 1, 0);
    s.add(rect(x - 46, b - 120, 92, 120, stone), rect(x - 50, b - 126, 100, 8, '#fffaf0'));
    let win = '';
    for (const yy of [b - 100, b - 60]) for (const xx of [x - 26, x + 14]) win += `M${P(xx, yy)}h12v18h-12z`;
    s.add(path(win, '#5a6070'), path(`M${P(x - 14, b)}v-30a14,14 0 0,1 28,0v30z`, '#4a4a58'));
    s.add(rect(x - 32, b - 206, 64, 80, stone), rect(x - 36, b - 212, 72, 8, '#fffaf0'), path(`M${P(x - 6, b - 190)}h12v22h-12z`, '#5a6070'));
    s.add(rect(x - 20, b - 262, 40, 50, stone), rect(x - 24, b - 266, 48, 6, '#fffaf0'));
    s.add(stroke(`M${P(x - 18, b - 268)}V${n(b - 290)}M${P(x + 18, b - 268)}V${n(b - 290)}M${P(x, b - 268)}V${n(b - 290)}`, '#c8b48a', 4), path(`M${P(x - 26, b - 290)}h52l-26,-22z`, '#b8862a'));
    s.add(`<circle cx="${x}" cy="${b - 282}" r="150" fill="${s.rgu([[0, '#ffe08a', 0.7], [0.2, '#ffc860', 0.3], [1, '#ffc860', 0]], x, b - 282, 150)}"/>`);
    s.add(path(`M${P(x - 12, b - 268)}C${P(x - 16, b - 284)} ${P(x - 4, b - 290)} ${P(x - 2, b - 304)}C${P(x + 6, b - 292)} ${P(x + 16, b - 284)} ${P(x + 12, b - 268)}Z`, '#ff8a2a'), path(`M${P(x - 6, b - 268)}C${P(x - 8, b - 278)} ${P(x, b - 284)} ${P(x, b - 292)}C${P(x + 4, b - 282)} ${P(x + 8, b - 276)} ${P(x + 6, b - 268)}Z`, '#ffe27a'));
    // golden statue atop
    s.add(path(`M${P(x - 3, b - 312)}l3,-18l3,18z`, '#e8b84a'), `<circle cx="${x}" cy="${b - 334}" r="4" fill="#e8b84a"/>`);
    s.add(path(`M${P(x - 46, b)}l-14,8h120l-14,-8z`, '#c8b494'));
  }
  // small distant ships near the harbour mouth
  s.add(corbita(s, 600, 486, 0.36, '#6a4a32', '#f6ecd8', '#b8342a', 1), corbita(s, 1010, 480, 0.3, '#6a4a32', '#f6ecd8', '#2a5a9a', -1), corbita(s, 1160, 500, 0.4, '#6a4a32', '#f0c070', '#b8342a', -1));
  haze(s, HY - 30, 520, '#eef8fa', 0, 0.2);
  // ---- left: warehouses (horrea) receding along the quay, a treadwheel crane
  const vp: [number, number] = [800, 470];
  const brick = patStone(s, 30, 11, '#7a3418', '#ffd8b0', 0.3, 0.18);
  s.add(box(s, { x: -60, base: 760, w: 360, h: 330, depth: 0.32, side: 1, vp, front: s.lg([[0, '#d88a5a'], [1, '#b0623a']]), sideC: s.lg([[0, '#f0a874'], [1, '#d88a5a']], 0, 0, 1, 0), roof: { h: 70, color: '#c4553a' }, stone: brick }));
  s.add(path(archHoles(-50, 600, 340, 160, 3, 0.6, 0.6), s.lg([[0, '#3a1e12'], [1, '#6a3420']])));
  let w2 = '';
  for (let i = 0; i < 4; i++) w2 += `M${P(-20 + i * 86, 480)}h22v36h-22z`;
  s.add(path(w2, '#4a2414'));
  s.add(hangingBanner(s, 110, 452, 40, 100, '#2a5a9a', '#f0c060', `<circle cx="130" cy="494" r="8" fill="none" stroke="#f0c060" stroke-width="3"/>`));
  s.add(box(s, { x: 380, base: 600, w: 170, h: 120, depth: 0.25, side: 1, vp, front: s.lg([[0, '#dc9a68'], [1, '#b8744a']]), sideC: '#f0b07c', roof: { h: 34, color: '#c4553a' }, stone: brick }));
  s.add(path(archHoles(388, 540, 150, 60, 3, 0.55, 0.6), '#4a2414'));
  // quay along the left
  s.add(path('M-20,760L380,600L700,560L760,600L440,700L-20,900Z', s.lg([[0, '#e6d8bc'], [1, '#c8b494']])));
  s.add(path('M-20,900L440,700L760,600L780,616L470,724L60,900Z', '#9a8a6a'));
  let qp = '';
  for (let i = 1; i < 9; i++) qp += `M${P(-20 + i * 50, 760 - i * 20 + 140 * (i / 9))}L${P(380 + i * 40, 600 - i * 4)}`;
  for (let i = 1; i < 6; i++) qp += `M${P(-20 + i * 70, 760 + i * 28)}L${P(380 + i * 70, 600 + i * 20)}`;
  s.add(stroke(qp, '#a8987a', 1.2, op(0.45)));
  // crane: A-frame with treadwheel
  {
    const x = 560;
    const b = 610;
    s.add(stroke(`M${P(x - 40, b)}L${P(x + 10, b - 200)}L${P(x + 40, b)}M${P(x + 10, b - 200)}L${P(x + 120, b - 250)}M${P(x + 120, b - 250)}V${n(b - 120)}`, '#6a4a2c', 6, 'stroke-linecap="round"'));
    s.add(`<circle cx="${x}" cy="${b - 50}" r="44" fill="none" stroke="#8a6038" stroke-width="7"/>`, stroke(`M${P(x - 44, b - 50)}H${n(x + 44)}M${P(x, b - 94)}V${n(b - 6)}M${P(x - 31, b - 81)}L${P(x + 31, b - 19)}M${P(x + 31, b - 81)}L${P(x - 31, b - 19)}`, '#8a6038', 3));
    s.add(path(`M${P(x + 100, b - 120)}h40v26h-40z`, '#a87a4a'), stroke(`M${P(x + 104, b - 120)}l16,-16l16,16`, '#5a3a20', 2));
  }
  // dock workers with amphorae
  s.add(person(440, 640, 46, '#c8a070', '#a86a48', { hair: '#2a1a10', arm: 4 }), person(500, 620, 42, '#e8dcc4', '#a86a48', { hair: '#2a1a10' }), person(640, 590, 34, '#b8342a', '#a86a48', { hair: '#2a1a10' }));
  // ---- right: big merchant ship moored at the quay
  s.add(path('M1620,640L1180,700L1100,760L1620,760Z', '#1f6aa0', op(0.4)));
  s.add(corbita(s, 1290, 700, 1.9, '#7a4a2a', '#f4c060', '#2a5a9a', -1));
  // sail painting (eye + stripe) and rigging
  s.add(stroke('M1290,480L1180,690M1290,480L1420,690M1290,480L1150,640', '#3a2a1a', 1.5, op(0.6)));
  s.add(path('M1210,560h160v18h-160z', '#b8342a', op(0.85)));
  // right quay corner + bollards
  s.add(path('M1080,900L1180,760L1620,740V900Z', s.lg([[0, '#e8dcc4'], [1, '#c4b090']])), path('M1180,760L1620,740V752L1186,772Z', '#a8987a'));
  // ---- foreground quay with a black-and-white mosaic (Piazzale delle Corporazioni)
  s.add(path('M-20,900L60,790H1540L1620,900Z', s.lg([[0, '#f2ead8'], [1, '#d8ccb0']])));
  s.add(rect(0, 780, W, 12, '#b8a888'), rect(0, 776, W, 5, '#fff8ea'));
  {
    // mosaic panel in perspective
    const t = (x: number, y: number) => `${n(800 + (x - 800) * (0.86 + (y - 810) / 600))},${n(y)}`;
    s.add(`<path d="M${t(560, 810)}L${t(1040, 810)}L${t(1060, 900)}L${t(540, 900)}Z" fill="#f8f4ea"/>`);
    s.add(`<path d="M${t(560, 810)}L${t(1040, 810)}L${t(1060, 900)}L${t(540, 900)}Z" fill="none" stroke="#1e2430" stroke-width="5"/>`);
    // ship
    s.add(path('M690,862Q760,880 850,866L870,850H676Z', '#1e2430'), stroke('M770,850V818M744,820h52', '#1e2430', 3), path('M748,822h44q4,14 -2,24h-40q-6,-10 -2,-24z', '#1e2430'));
    // dolphin
    s.add(path('M900,872q24,-30 64,-22q-12,4 -10,10q14,-2 22,8q-20,-4 -32,6q-18,10 -44,-2z', '#1e2430'), path('M934,852l8,-12l4,14z', '#1e2430'));
    s.add(stroke(`M600,826q20,-6 40,0q20,6 40,0M600,890q20,-6 40,0q20,6 40,0M920,826q20,-6 40,0q20,6 40,0`, '#1e2430', 2.5));
  }
  // bollards, rope coils, amphorae stacks
  const bollard = (x: number, y: number, sc: number) => rect(x - 12 * sc, y - 34 * sc, 24 * sc, 34 * sc, s.lg([[0, '#b8b0a0'], [0.5, '#7a7468'], [1, '#4a4640']], 0, 0, 1, 0), `rx="${n(5 * sc)}"`) + ell(x, y - 34 * sc, 15 * sc, 6 * sc, '#c8c0b0');
  s.add(bollard(420, 800, 1.3), bollard(1180, 800, 1.3));
  const coil = (x: number, y: number, r: number) => {
    let d = '';
    for (let i = 0; i < 4; i++) d += `M${P(x - r + i * 3, y)}a${n(r - i * 3)},${n((r - i * 3) * 0.4)} 0 1,0 ${n(2 * (r - i * 3))},0a${n(r - i * 3)},${n((r - i * 3) * 0.4)} 0 1,0 ${n(-2 * (r - i * 3))},0`;
    return stroke(d, '#c8a068', 4) + stroke(d, '#8a6038', 1.2, op(0.6));
  };
  s.add(coil(470, 852, 34), coil(1240, 860, 36));
  const amph = (x: number, y: number, sc: number, c: string) =>
    path(`M${P(x - 5 * sc, y - 76 * sc)}h${n(10 * sc)}v${n(8 * sc)}q${n(16 * sc)},${n(10 * sc)} ${n(14 * sc)},${n(34 * sc)}q${n(-2 * sc)},${n(22 * sc)} ${n(-12 * sc)},${n(34 * sc)}l${n(-2 * sc)},${n(10 * sc)}l${n(-2 * sc)},${n(-10 * sc)}q${n(-10 * sc)},${n(-12 * sc)} ${n(-12 * sc)},${n(-34 * sc)}q${n(-2 * sc)},${n(-24 * sc)} ${n(14 * sc)},${n(-34 * sc)}z`, s.lg([[0, shade(c, 0.3)], [0.45, c], [1, shade(c, -0.45)]], 0, 0, 1, 0));
  let am = '';
  for (let i = 0; i < 6; i++) am += amph(70 + i * 34, 890 - (i % 2) * 6, 1.3, i % 2 ? '#d07848' : '#c4683c');
  for (let i = 0; i < 4; i++) am += amph(1380 + i * 36, 900 - (i % 2) * 6, 1.4, i % 2 ? '#d07848' : '#b85a30');
  s.add(am);
  // crates
  s.add(rect(250, 830, 80, 60, s.lg([[0, '#c8955c'], [1, '#8a5a30']])), stroke('M250,830l80,60M330,830l-80,60', '#6a4020', 3), rect(1300, 820, 70, 70, s.lg([[0, '#c8955c'], [1, '#8a5a30']])));
  // umbrella pines framing the left, a palm at right
  s.add(umbrellaPine(s, 20, 790, 560, 360, '#5a3e2a', '#3f6a4a', '#6a9a62'));
  s.add(palm(s, 1560, 790, 420, -0.35, '#8a6a4a', '#3f7a4a', '#7ab060'));
  vignette(s, '#1f4a6a', 0.22);
}

/** 7 · The Aqueduct Heights — a towering three-tier aqueduct striding across a green valley. */
function aqueductHeights(s: S): void {
  s.lit = 1;
  const HY = 420;
  const { pj } = cam(800, HY, 900);
  sky(s, [[0, '#4d8fd0'], [0.28, '#9ccbe8'], [0.42, '#f4e6c8'], [0.47, '#ffdca8']]);
  sun(s, 240, 230, 38, '#fffaf0', '#ffe2a8', 520, 0.8);
  shafts(s, 240, 230, -Math.PI * 0.4, Math.PI * 0.35, 10, 1200, '#fff6dc', 0.13);
  cloud(s, 620, 90, 380, 80, '#ffffff', '#d0c8d8');
  cloud(s, 1180, 200, 300, 56, '#fff8f0', '#e0c8c8', 0.9);
  cloud(s, 140, 80, 260, 50, '#ffffff', '#d8d0e0', 0.85);
  birds(s, 900, 130, 6, 70, '#4a5a7a', 9);
  // lavender mountains + hill towns
  mountains(s, HY, [[60, 120, 240], [380, 90, 220], [1100, 150, 260], [1420, 110, 230]], '#a8a4c8', '#c8c0dc');
  haze(s, 280, HY, '#f8e8d4', 0, 0.6);
  s.add(hills(s, HY + 10, 40, 5, '#9cbc8a'));
  const town = (x0: number, base: number, count: number, sc: number) => {
    let walls = '';
    let roofs = '';
    for (let i = 0; i < count; i++) {
      const x = x0 + i * 22 * sc + s.rnd(-4, 4) * sc;
      const h = s.rnd(14, 30) * sc;
      const y = base - Math.sin((i / count) * Math.PI) * 26 * sc;
      walls += `M${P(x, y)}v${n(-h)}h${n(18 * sc)}v${n(h)}z`;
      roofs += `M${P(x - 2 * sc, y - h)}l${n(11 * sc)},${n(-7 * sc)}l${n(11 * sc)},${n(7 * sc)}z`;
    }
    return path(walls, '#f2e2c4') + path(roofs, '#c86a48');
  };
  s.add(town(140, 432, 12, 1), town(1180, 426, 10, 1.1));
  s.add(path('M1268,370h46v-6l-23,-10l-23,10z', '#f6ead0'), cypress(s, 1250, 400, 40, 10, '#4a6a4a', '#6a8a5a'), cypress(s, 1336, 398, 36, 10, '#4a6a4a', '#6a8a5a'));
  // valley: patchwork fields in perspective
  s.add(rect(0, HY + 10, W, H - HY - 10, s.lg([[0, '#a8c87a'], [0.4, '#7aa85a'], [1, '#4f8a3e']])));
  let f1 = '';
  let f2 = '';
  for (let i = -10; i < 10; i++)
    for (let k = 0; k < 5; k++) {
      const Z0 = 9000 / (1 + k * 0.45);
      const Z1 = 9000 / (1 + (k + 1) * 0.45);
      const X0 = i * 700 + k * 230;
      const q = `M${P(...pj(X0, 600, Z0))}L${P(...pj(X0 + 700, 600, Z0))}L${P(...pj(X0 + 700, 600, Z1))}L${P(...pj(X0, 600, Z1))}Z`;
      if ((i + k) % 3 === 0) f1 += q;
      else if ((i * 7 + k) % 4 === 1) f2 += q;
    }
  s.add(path(f1, '#e0d080', op(0.4)), path(f2, '#5f9a4a', op(0.35)));
  // the river winding through the valley
  s.add(path('M700,436C760,470 640,500 700,540C780,600 1000,620 1060,700C1100,760 1000,820 1040,900H1200C1150,820 1240,760 1180,690C1100,600 860,590 780,530C740,500 820,470 744,436Z', s.lg([[0, '#fff0d0'], [0.4, '#9ad0e0'], [1, '#5aa0c0']])));
  s.add(glints(s, 760, 1160, 520, 880, 30, '#ffffff', 0.6, 22));
  // rows of cypresses and pines in the valley
  let tr = '';
  for (const [x, y, h] of [[480, 470, 50], [510, 476, 56], [540, 480, 52], [570, 486, 58], [1020, 480, 54], [1050, 486, 60], [1080, 492, 56]] as [number, number, number][]) tr += cypress(s, x, y, h, 12, '#3a6a3a', '#6a9a52');
  tr += umbrellaPine(s, 380, 500, 70, 80, '#6a5040', '#4f7a4a', '#7aa862') + umbrellaPine(s, 1240, 510, 80, 90, '#6a5040', '#4f7a4a', '#7aa862');
  s.add(tr);
  // a villa on the valley floor
  s.add(rect(1300, 520, 120, 40, '#f6ead0'), path('M1294,522l66,-22l66,22z', '#c86a48'), path(archHoles(1306, 532, 108, 28, 5, 0.5, 0.6), '#a88a6a'));
  haze(s, HY, 600, '#fff2dc', 0.35, 0);

  // ---- the aqueduct: three tiers of arches in a vertical plane running from far-left to near-right
  const A: [number, number] = [-3400, 9000];
  const B: [number, number] = [1900, 1200];
  const GY = 360; // ground level under the aqueduct
  const HT = 1180; // total height
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  const at = (t: number, Y: number, off = 0): Pt => {
    const X = A[0] + (B[0] - A[0]) * t + off * 0.85;
    const Z = A[1] + (B[1] - A[1]) * t - off * 0.55;
    return pj(X, Y, Z);
  };
  const tiers: [number, number, number, number][] = [
    // [y bottom, y top, bays, arch ratio]
    [GY, GY - HT * 0.48, 13, 0.62],
    [GY - HT * 0.48, GY - HT * 0.84, 13, 0.66],
    [GY - HT * 0.84, GY - HT, 39, 0.6],
  ];
  const face = (off: number) => {
    let d = '';
    for (const [y0, y1, bays, ratio] of tiers) {
      // outer band
      const p0 = at(0, y0, off);
      const p1 = at(1, y0, off);
      const p2 = at(1, y1, off);
      const p3 = at(0, y1, off);
      d += `M${P(p0[0], p0[1])}L${P(p1[0], p1[1])}L${P(p2[0], p2[1])}L${P(p3[0], p3[1])}Z`;
      const bay = 1 / bays;
      const hBand = y0 - y1;
      const wWorld = (L * bay * ratio) / 2; // arch radius in world units
      const wT = bay * ratio;
      for (let k = 0; k < bays; k++) {
        const t0 = k * bay + (bay - wT) / 2;
        const t1 = t0 + wT;
        const tc = (t0 + t1) / 2;
        const spring = y0 - (hBand - Math.min(wWorld, hBand * 0.45)) * 0.86;
        const r = Math.min(wWorld, hBand * 0.45);
        let a = `M${P(...at(t0, y0 - 2, off))}L${P(...at(t0, spring, off))}`;
        for (let j = 1; j <= 8; j++) {
          const ang = Math.PI - (j / 8) * Math.PI;
          a += `L${P(...at(tc + (Math.cos(ang) * (t1 - t0)) / 2, spring - Math.sin(ang) * r, off))}`;
        }
        a += `L${P(...at(t1, y0 - 2, off))}Z`;
        d += a;
      }
    }
    return d;
  };
  s.add(path(face(260), '#a8805a', 'fill-rule="evenodd"'));
  s.add(path(face(0), s.lgu([[0, '#e8cfa0'], [0.6, '#f6e2b8'], [1, '#fff2d4']], 400, 0, 1600, 0), 'fill-rule="evenodd"'));
  s.add(path(face(0), patStone(s, 36, 15, '#9a7448', '#fff6e0', 0.3, 0.25), 'fill-rule="evenodd"'));
  // cornices between tiers and the water channel cap
  let corn = '';
  for (const y of [GY - HT * 0.48, GY - HT * 0.84, GY - HT]) {
    const a = at(0, y);
    const b = at(1, y);
    const b2 = at(1, y - 22);
    const a2 = at(0, y - 22);
    corn += `M${P(a[0], a[1])}L${P(b[0], b[1])}L${P(b2[0], b2[1])}L${P(a2[0], a2[1])}Z`;
  }
  s.add(path(corn, '#fff8e6'));
  // shadow underside line under each cornice
  let csh = '';
  for (const y of [GY - HT * 0.48, GY - HT * 0.84]) {
    const a = at(0, y);
    const b = at(1, y);
    csh += `M${P(a[0], a[1])}L${P(b[0], b[1])}`;
  }
  s.add(stroke(csh, '#8a6a48', 4, op(0.5)));
  // grassy embankment anchoring the near piers
  {
    const a = at(0.35, GY);
    const b = at(1, GY);
    s.add(path(`M${P(a[0] - 40, a[1] + 6)}L${P(b[0] + 40, b[1] - 10)}L${P(1620, b[1] + 60)}L${P(a[0] + 200, a[1] + 60)}Z`, s.lg([[0, '#8ab862'], [1, '#6a9a48']])));
    let sh = '';
    for (let i = 0; i < 9; i++) {
      const t = 0.4 + i * 0.07;
      const p = at(t, GY);
      sh += roundTree(s, p[0] + 20, p[1] + 14, 26 + i * 6, 26 + i * 6, '#6a5040', '#4f7a42', '#86b062');
    }
    s.add(sh);
  }
  // travellers on the top channel walkway
  {
    const a = at(0.7, GY - HT - 22);
    s.add(person(a[0], a[1], 30, '#b8342a', '#a87050', { hair: '#2a1a10' }));
  }
  // ---- foreground: meadow hill with poppies, the road, sheep
  s.add(path('M-20,900V640Q200,600 460,660Q700,720 820,760Q1000,800 1300,740Q1480,700 1620,720V900Z', s.lg([[0, '#8abc5a'], [0.5, '#6a9a44'], [1, '#4a7a30']])));
  s.add(path('M-20,900V700Q160,680 320,720Q480,760 560,900Z', s.lg([[0, '#9ac862'], [1, '#5a8a38']])));
  // the paved road curving in from the lower right
  s.add(path('M1620,770Q1300,780 1100,840Q980,880 940,900H1240Q1330,840 1620,830Z', s.lg([[0, '#d8c8a8'], [1, '#b8a888']])));
  let cobble = '';
  for (let i = 0; i < 26; i++) cobble += circ(s.rnd(1000, 1600), s.rnd(790, 895), s.rnd(4, 9));
  s.add(path(cobble, '#a89878', op(0.5)));
  // milestone
  s.add(rect(1450, 700, 40, 90, s.lg([[0, '#f6ecd8'], [1, '#c8b898']], 0, 0, 1, 0), 'rx="12"'), stroke('M1458,724h24M1458,736h24M1462,748h16', '#8a7a5a', 2));
  // sheep flock in the lower centre (visible below the board on phones)
  const sheep = (x: number, y: number, sc: number, dir: number) => {
    let o = ell(x, y + 2 * sc, 22 * sc, 5 * sc, '#2a4a1a', op(0.25));
    o += stroke(`M${P(x - 10 * sc, y - 6 * sc)}v${n(10 * sc)}M${P(x - 4 * sc, y - 6 * sc)}v${n(10 * sc)}M${P(x + 6 * sc, y - 6 * sc)}v${n(10 * sc)}M${P(x + 12 * sc, y - 6 * sc)}v${n(10 * sc)}`, '#3a2a20', 2.5 * sc);
    let wool = '';
    for (let i = 0; i < 6; i++) wool += circ(x - 12 * sc + i * 5 * sc, y - 14 * sc - Math.sin(i) * 3 * sc, 8 * sc);
    o += path(wool, '#fffaf0') + path(wool, s.lg([[0, '#ffffff', 0], [1, '#c8c0b0', 0.8]]));
    o += ell(x + dir * 20 * sc, y - 14 * sc, 6 * sc, 5 * sc, '#3a2a20');
    return o;
  };
  let fl = '';
  for (const [x, y, sc, d] of [[640, 830, 1.3, 1], [720, 850, 1.4, -1], [800, 820, 1.2, 1], [880, 846, 1.45, 1], [960, 828, 1.2, -1], [700, 790, 1, 1], [860, 796, 1, -1], [560, 860, 1.5, 1]] as [number, number, number, number][]) fl += sheep(x, y, sc, d);
  s.add(fl);
  s.add(person(1010, 820, 80, '#c8a060', '#a87050', { hair: '#3a2010', arm: 4, dir: -1 }), stroke('M996,750l-12,76', '#6a4a2a', 3));
  // poppies and flowers
  let pop = '';
  let wht = '';
  for (let i = 0; i < 120; i++) {
    const y = s.rnd(680, 900);
    const x = s.rnd(0, W);
    if (x > 1000 && y > 790) continue;
    const r = 2 + ((y - 680) / 220) * 4.5;
    if (i % 3) pop += circ(x, y, r);
    else wht += circ(x, y, r * 0.8);
  }
  s.add(path(pop, '#e0402a'), path(wht, '#fff4c0'));
  s.add(tufts(s, 0, 600, 820, 900, 10, '#4a7a2a', '#9ac862', 60), tufts(s, 1200, 1600, 860, 900, 5, '#4a7a2a', '#9ac862', 50));
  // framing: olive tree left, cypress right
  s.add(umbrellaPine(s, 90, 760, 520, 380, '#5a4030', '#4f7a42', '#86b062'));
  s.add(cypress(s, 1560, 820, 460, 90, '#2f5a3a', '#5a8a4a'));
  vignette(s, '#4a5a3a', 0.22);
}

/** 9 · The Imperial Baths — vaulted thermae hall, teal pool, coloured marbles, mosaic floor, steam and light. */
function imperialBaths(s: S): void {
  s.lit = 1;
  const { pj, quad, flat, side } = cam(800, 360, 800);
  const FY = 380;
  const SY = -520; // vault spring line
  const WX = 1100;
  const ZN = 420;
  const ZB = 3600;
  const vault = (a: number, Z: number): Pt => pj(Math.cos(a) * WX, SY - Math.sin(a) * WX * 0.9, Z);
  s.add(rect(0, 0, W, H, '#e8d8c0'));
  // ---- coffered barrel vault
  const NA = 14;
  const zs: number[] = [ZN];
  while (zs[zs.length - 1] < ZB) zs.push(Math.min(ZB, zs[zs.length - 1] * 1.28));
  let vlit = '';
  let vdark = '';
  let cof = '';
  let ros = '';
  for (let i = 0; i < NA; i++) {
    const a0 = (i / NA) * Math.PI;
    const a1 = ((i + 1) / NA) * Math.PI;
    for (let k = 0; k < zs.length - 1; k++) {
      const q = quad(vault(a0, zs[k]), vault(a1, zs[k]), vault(a1, zs[k + 1]), vault(a0, zs[k + 1]));
      if (i < NA / 2) vdark += q;
      else vlit += q;
      // inner coffer
      const ia0 = a0 + (a1 - a0) * 0.16;
      const ia1 = a1 - (a1 - a0) * 0.16;
      const z0 = zs[k] + (zs[k + 1] - zs[k]) * 0.14;
      const z1 = zs[k + 1] - (zs[k + 1] - zs[k]) * 0.14;
      cof += quad(vault(ia0, z0), vault(ia1, z0), vault(ia1, z1), vault(ia0, z1));
      const c = vault((a0 + a1) / 2, (zs[k] + zs[k + 1]) / 2);
      ros += circ(c[0], c[1], Math.max(1.5, (16 * 800) / ((zs[k] + zs[k + 1]) / 2)));
    }
  }
  s.add(path(vdark, '#e2c8a4'), path(vlit, '#f2dcb8'));
  s.add(path(cof, s.lg([[0, '#3a7a84'], [1, '#5a9aa0']]), op(0.85)), path(ros, '#e8b84a'));
  // ---- back wall with the great thermal window
  {
    const l = pj(-WX, FY, ZB);
    const sp = pj(-WX, SY, ZB);
    const r = pj(WX, SY, ZB);
    const rx = (r[0] - sp[0]) / 2;
    s.add(path(`M${P(l[0], l[1])}V${n(sp[1])}A${n(rx)},${n(rx * 0.9)} 0 0,1 ${P(r[0], r[1])}V${n(l[1])}Z`, '#f0dcc0'));
  }
  const lc = pj(0, SY, ZB);
  const lr = (WX * 0.8 * 800) / ZB;
  const lunette = `M${P(lc[0] - lr, lc[1])}A${n(lr)},${n(lr * 0.9)} 0 0,1 ${P(lc[0] + lr, lc[1])}Z`;
  s.add(path(lunette, s.lg([[0, '#ffffff'], [0.6, '#fff4d0'], [1, '#ffe0a0']])));
  s.add(`<circle cx="${n(lc[0])}" cy="${n(lc[1])}" r="${n(lr * 2.4)}" fill="${s.rgu([[0, '#fff2c8', 0.6], [1, '#fff2c8', 0]], lc[0], lc[1], lr * 2.4)}"/>`);
  s.add(stroke(`M${P(lc[0] - lr * 0.36, lc[1])}V${n(lc[1] - lr * 0.84)}M${P(lc[0] + lr * 0.36, lc[1])}V${n(lc[1] - lr * 0.84)}`, '#c8a878', 10), stroke(lunette.replace('Z', ''), '#c8a878', 12));
  // grilles in the window
  let gr = '';
  for (let i = 1; i < 4; i++) {
    const hw = lr * Math.sqrt(1 - (i / 4) ** 2);
    gr += `M${P(lc[0] - hw, lc[1] - (lr * 0.9 * i) / 4)}H${n(lc[0] + hw)}`;
  }
  s.add(stroke(gr, '#c8a878', 2.5, op(0.6)));
  // arch to the next hall (frigidarium glimpsed beyond)
  const d0 = pj(-360, -120, ZB);
  const d1 = pj(360, FY, ZB);
  const dr = (d1[0] - d0[0]) / 2;
  s.add(path(`M${P(d0[0], d1[1])}V${n(d0[1] + dr)}A${n(dr)},${n(dr)} 0 0,1 ${P(d1[0], d0[1] + dr)}V${n(d1[1])}Z`, s.lg([[0, '#bfe6e4'], [1, '#6ab4b8']])));
  s.add(stroke(`M${P(d0[0], d1[1])}V${n(d0[1] + dr)}A${n(dr)},${n(dr)} 0 0,1 ${P(d1[0], d0[1] + dr)}V${n(d1[1])}`, '#d88a6a', 8));
  {
    // a far statue in the next hall
    const st = pj(0, FY, ZB + 600);
    s.add(person(st[0], st[1] - 4, 70, '#ffffff', '#f6f0e4', { arm: 3 }));
  }
  // ---- side walls: coloured marble revetment and arcades into side halls
  for (const k of [-1, 1]) {
    const X = k * WX;
    s.add(path(side(X, SY, FY, ZN, ZB), s.lg(k < 0 ? [[0, '#e8cfa8'], [1, '#f4e2c4']] : [[0, '#f6e6c8'], [1, '#e0c49c']], 0, 0, 1, 0)));
    // dado of red/green marble panels
    let pan = '';
    let pan2 = '';
    for (let Z = ZN + 100, j = 0; Z < ZB; Z += 360, j++) {
      const q = side(X, 120, FY - 20, Z, Z + 260);
      if (j % 2) pan += q;
      else pan2 += q;
    }
    s.add(path(pan, '#b85a4a'), path(pan2, '#4f8a7a'));
    // arched openings with light from the side halls
    let ar = '';
    for (let Z = ZN + 500; Z < ZB - 200; Z += 720) {
      const a = pj(X, -400, Z);
      const b = pj(X, 100, Z + 360);
      const c = pj(X, 100, Z);
      const d = pj(X, -400, Z + 360);
      ar += `M${P(c[0], c[1])}L${P(a[0], a[1])}Q${P((a[0] + d[0]) / 2, (a[1] + d[1]) / 2 - Math.abs(a[1] - d[1]) * 0.2 - 60 * (800 / Z))} ${P(d[0], d[1])}L${P(b[0], b[1])}Z`;
    }
    s.add(path(ar, s.lg([[0, '#fff2d4'], [1, '#e8c89a']])));
  }
  // vault cornice line
  let cor = '';
  for (const k of [-1, 1]) cor += `M${P(...pj(k * WX, SY, ZN))}L${P(...pj(k * WX, SY, ZB))}`;
  s.add(stroke(cor, '#fff6e4', 10), stroke(cor, '#c8a070', 3, op(0.7)));
  // ---- floor: opus sectile around the pool
  s.add(path(flat(-WX, WX, FY, ZN, ZB), '#f4e8d4'));
  let tiles = '';
  const tz = [ZN];
  while (tz[tz.length - 1] < ZB) tz.push(Math.min(ZB, tz[tz.length - 1] * 1.12));
  for (let i = -10; i < 10; i++)
    for (let k = 0; k < tz.length - 1; k++) {
      if ((i + k) % 2 === 0) continue;
      tiles += flat(i * 110, (i + 1) * 110, FY, tz[k], tz[k + 1]);
    }
  s.add(path(tiles, '#e0b48a', op(0.6)));
  // ---- the pool
  const PX = 620;
  const PZ0 = 640;
  const PZ1 = 3000;
  s.add(path(flat(-PX - 50, PX + 50, FY, PZ0 - 40, PZ1 + 40), '#fffaf0'));
  s.add(path(flat(-PX, PX, FY, PZ0, PZ1), s.lg([[0, '#7ad0cc'], [0.5, '#2fa0a8'], [1, '#1f7a8a']])));
  // inner pool wall (near side in shade)
  s.add(path(`${quad(pj(-PX, FY, PZ1), pj(PX, FY, PZ1), pj(PX, FY + 90, PZ1), pj(-PX, FY + 90, PZ1))}`, '#1a6a74', op(0.5)));
  // reflections of the window and columns
  const rw = pj(0, FY, PZ1);
  s.add(ell(rw[0], rw[1] + 60, 70, 130, s.rgu([[0, '#ffffff', 0.55], [1, '#ffffff', 0]], rw[0], rw[1] + 60, 130)));
  s.add(glints(s, 340, 1260, 470, 780, 60, '#e6fffa', 0.6, 26));
  // ---- columns of giallo antico along both sides
  const cId = defColumn(s, '#fff2c8', '#e8c878', '#a8803a', 'corinth', '#ffe8a8');
  const cols: string[] = [];
  for (const k of [-1, 1])
    for (let Z = ZB - 180; Z >= ZN + 60; Z -= 720) {
      const [x, y] = pj(k * 880, FY, Z);
      const top = pj(k * 880, SY, Z)[1];
      cols.push(rect(x - (36 * 800) / Z, y - (80 * 800) / Z, (72 * 800) / Z, (80 * 800) / Z, '#d88a6a'));
      cols.push(col(cId, x, y - (80 * 800) / Z, y - (80 * 800) / Z - top, 1.25));
    }
  // ---- light shafts from the thermal window
  let sh = '';
  for (const [x0, x1, fx0, fx1] of [[-0.8, -0.45, -500, -150], [-0.3, 0.1, -60, 360], [0.25, 0.6, 300, 700]] as [number, number, number, number][]) {
    const a = pj(x0 * WX * 0.8, SY - WX * 0.5, ZB);
    const b = pj(x1 * WX * 0.8, SY - WX * 0.5, ZB);
    const c = pj(fx1, FY, 1200);
    const d = pj(fx0, FY, 1200);
    sh += `M${P(a[0], a[1])}L${P(b[0], b[1])}L${P(c[0], c[1])}L${P(d[0], d[1])}Z`;
  }
  s.add(path(sh, s.lg([[0, '#fff8dc', 0.45], [1, '#fff8dc', 0.04]])));
  s.add(cols.join(''));
  // statues in niches between columns (white marble)
  for (const k of [-1, 1])
    for (const Z of [1500, 2600]) {
      const [x, y] = pj(k * 1040, FY - 80, Z);
      const sc = 800 / Z;
      s.add(rect(x - 34 * sc, y, 68 * sc, 80 * sc, '#f6efe2'), person(x, y, 220 * sc, '#ffffff', '#f2ece0', { arm: 4, dir: -k }));
    }
  // ---- steam rising off the pool
  for (const [x, y, w2] of [[560, 640, 200], [980, 600, 240], [780, 520, 160], [1160, 700, 180], [420, 720, 160]] as [number, number, number][]) s.add(smoke(s, x, y, 260, w2 * 0.35, '#ffffff', 0.12, 0.2));
  // bathers
  {
    const a = pj(-300, FY + 30, 1800);
    const b = pj(260, FY + 30, 2200);
    const c = pj(80, FY + 30, 1300);
    s.add(person(a[0], a[1], 60, '#2fa0a8', '#c88a62', { hair: '#3a2416' }), person(b[0], b[1], 50, '#2fa0a8', '#d8a078', { hair: '#2a1a10' }), person(c[0], c[1], 80, '#2fa0a8', '#b87850', { hair: '#5a3a20', arm: 4 }));
    const w1 = pj(-800, FY, 1700);
    s.add(person(w1[0], w1[1], 110, '#ffffff', '#c88a62', { sash: '#d88a6a', hair: '#3a2416' }));
    const w2 = pj(820, FY, 1400);
    s.add(person(w2[0], w2[1], 120, '#f6ead8', '#d8a078', { hair: '#2a1a10', sash: '#3a7a84' }));
  }
  // ---- foreground: near pool edge (marble), mosaic floor with a dolphin border
  s.add(rect(0, 800, W, 100, s.lg([[0, '#f8f0e2'], [1, '#e2d2b8']])));
  s.add(rect(0, 796, W, 8, '#ffffff'), rect(0, 804, W, 6, '#c8b494', op(0.6)));
  s.add(rect(0, 826, W, 74, '#fbf6ec'));
  s.add(stroke(waveBand(-20, 1640, 830, 18), '#1e3a4a', 4, 'stroke-linecap="round"'));
  s.add(rect(0, 858, W, 4, '#1e3a4a'));
  // dolphins in the mosaic (left and right of centre, and one under the board's lower edge)
  const dolphin = (x: number, y: number, sc: number, dir: number) =>
    `<g transform="translate(${n(x)} ${n(y)}) scale(${n(dir * sc)} ${n(sc)})"><path d="M-40,6q20,-26 58,-20q-10,4 -8,9q12,-1 20,8q-18,-3 -30,6q-20,10 -40,-3z" fill="#2a6a84"/><path d="M-6,-10l6,-10l4,12z" fill="#2a6a84"/><path d="M-40,6l-10,-8l2,12z" fill="#2a6a84"/></g>`;
  s.add(dolphin(800, 884, 0.62, 1), dolphin(420, 884, 0.58, -1), dolphin(1180, 884, 0.58, 1));
  // bench with towels, oil flask and strigil; potted palms framing
  s.add(rect(1260, 740, 260, 26, '#f2ead8'), rect(1280, 766, 24, 40, '#d8c8a8'), rect(1476, 766, 24, 40, '#d8c8a8'));
  s.add(rect(1300, 722, 120, 20, '#d88a6a', 'rx="6"'), rect(1310, 706, 100, 18, '#f6f0e4', 'rx="6"'), `<circle cx="1460" cy="722" r="14" fill="${s.lg([[0, '#f6d27a'], [1, '#a8762a']])}"/>`, stroke('M1440,706q30,-10 40,10', '#c8902e', 4));
  s.add(rect(80, 690, 90, 110, s.lg([[0, '#d88a6a'], [1, '#9a4a3a']]), 'rx="10"'), palm(s, 125, 700, 300, 0.25, '#8a6a4a', '#3f7a5a', '#7ab070'));
  s.add(rect(1500, 700, 80, 100, s.lg([[0, '#d88a6a'], [1, '#9a4a3a']]), 'rx="10"'), palm(s, 1540, 708, 260, -0.3, '#8a6a4a', '#3f7a5a', '#7ab070'));
  // hanging lamps on chains from the vault
  let lamps = '';
  for (const [x, y] of [[520, 150], [1080, 150]] as [number, number][]) {
    lamps += stroke(`M${P(x, 0)}V${n(y)}`, '#8a6a3a', 2) + path(`M${P(x - 26, y)}h52l-10,16h-32z`, '#c8902e') + `<circle cx="${x}" cy="${y + 4}" r="60" fill="${s.rgu([[0, '#ffd27a', 0.5], [1, '#ffd27a', 0]], x, y + 4, 60)}"/>` + path(`M${P(x - 4, y)}q4,-14 8,0z`, '#ffe8a0');
  }
  s.add(lamps);
  vignette(s, '#3a4a4a', 0.28);
}

/** 11 · The Circus Maximus — the long chariot track, spina with obelisk, roaring stands, golden dust. */
function circusMaximus(s: S): void {
  s.lit = -1;
  const { pj, quad, flat } = cam(800, 330, 800);
  const FY = 300;
  const ZN = 640;
  const ZF = 9000;
  const TX = 700; // track half-width
  const SX = 1900; // stands outer edge
  const SYT = -760; // stands top
  sky(s, [[0, '#2f6fb8'], [0.18, '#6aa8d8'], [0.32, '#f0d4a8'], [0.4, '#ffc880']]);
  sun(s, 1080, 80, 30, '#fffaf0', '#ffd890', 420, 0.8);
  cloud(s, 640, 120, 260, 46, '#fff6ec', '#e8b8a0', 0.85);
  cloud(s, 900, 170, 200, 36, '#fff6ec', '#e8b8a0', 0.75);
  birds(s, 720, 200, 5, 50, '#5a3a3a', 8);
  // Palatine palace on its hill at the far end (left)
  s.add(path('M380,330Q470,240 640,232L760,250L780,330Z', '#c8a07a'));
  let pal = '';
  for (let i = 0; i < 8; i++) pal += `M${P(470 + i * 34, 300 - i * 4)}v${n(-36 - (i % 3) * 10)}h28v${n(36 + (i % 3) * 10)}z`;
  s.add(path(pal, '#f2e0c0'), path('M560,236h120v-8l-60,-20l-60,20z', '#e8c070'));
  let pc = '';
  for (let i = 0; i < 9; i++) pc += `M${P(566 + i * 13, 268)}v-30`;
  s.add(stroke(pc, '#c8a888', 3));
  haze(s, 200, 340, '#ffe0b0', 0, 0.45);
  // ---- stands (both sides) in perspective
  const crowdL = patCrowd(s, 1.7, '#8a5a3a', ['#c0392b', '#f6f0e4', '#2f8a4a', '#2f6db3', '#e8b04b', '#9a3a8a'], ['#c88a62', '#a86a48', '#e0b08a']);
  for (const k of [-1, 1]) {
    const inner = (Z: number) => pj(k * TX, 200, Z);
    const outer = (Z: number) => pj(k * SX, SYT, Z);
    const surf = quad(inner(ZN), inner(ZF), outer(ZF), outer(ZN));
    s.add(path(surf, crowdL));
    s.add(path(surf, s.lgu([[0, '#ffe8c0', k < 0 ? 0.05 : 0.25], [1, '#2a1a10', k < 0 ? 0.35 : 0.1]], 0, 0, W, 0)));
    // tier walkways (praecinctiones)
    let tiers = '';
    for (const t of [0.33, 0.66]) {
      const X = k * (TX + (SX - TX) * t);
      const Y = 200 + (SYT - 200) * t;
      tiers += `M${P(...pj(X, Y, ZN))}L${P(...pj(X, Y, ZF))}`;
    }
    s.add(stroke(tiers, '#fff4e0', 5), stroke(tiers, '#a8784a', 1.5, op(0.6)));
    // podium wall along the track
    s.add(path(quad(pj(k * TX, 200, ZN), pj(k * TX, 200, ZF), pj(k * TX, FY, ZF), pj(k * TX, FY, ZN)), k < 0 ? '#e8d4b0' : '#c8a87a'));
    let pod = '';
    for (let Z = ZN + 200; Z < ZF; Z *= 1.25) pod += `M${P(...pj(k * TX, 200, Z))}L${P(...pj(k * TX, FY, Z))}`;
    s.add(stroke(pod, '#8a6a4a', 1.5, op(0.5)), stroke(`M${P(...pj(k * TX, 205, ZN))}L${P(...pj(k * TX, 205, ZF))}`, '#b8342a', 3));
    // outer arcade wall on top of the stands
    const ow = quad(pj(k * SX, SYT, ZN), pj(k * SX, SYT, ZF), pj(k * SX, SYT - 260, ZF), pj(k * SX, SYT - 260, ZN));
    s.add(path(ow, k < 0 ? '#f2dcb4' : '#d8b888'));
    let arc = '';
    for (let Z = ZN + 300; Z < ZF; Z *= 1.18) {
      const a = pj(k * SX, SYT - 40, Z);
      const b = pj(k * SX, SYT - 200, Z * 1.08);
      arc += `M${P(a[0], a[1])}L${P(b[0], b[1])}`;
    }
    s.add(stroke(arc, '#a8784a', 3, op(0.5)));
    // striped awnings shading the upper tiers
    let aw = '';
    let aw2 = '';
    for (let j = 0, Z = ZN; Z < ZF; Z *= 1.16, j++) {
      const Z1 = Z * 1.16;
      const q = quad(pj(k * SX, SYT - 260, Z), pj(k * SX, SYT - 260, Z1), pj(k * (SX - 520), SYT - 120, Z1), pj(k * (SX - 520), SYT - 120, Z));
      if (j % 2) aw += q;
      else aw2 += q;
    }
    s.add(path(aw, '#c0392b'), path(aw2, '#fff4e4'));
    let ropes = '';
    for (let Z = ZN; Z < ZF; Z *= 1.16) ropes += `M${P(...pj(k * (SX - 520), SYT - 120, Z))}L${P(...pj(k * (SX - 700), SYT + 60, Z))}`;
    s.add(stroke(ropes, '#6a4a2a', 1.5, op(0.6)));
    // tinted crowd sections (sun and shade) for depth
    let sec = '';
    for (let j = 0, Z = ZN; Z < ZF; Z *= 1.5, j++) {
      if (j % 2) continue;
      sec += quad(pj(k * TX, 200, Z), pj(k * TX, 200, Z * 1.5), pj(k * SX, SYT, Z * 1.5), pj(k * SX, SYT, Z));
    }
    s.add(path(sec, '#2a1408', op(0.12)));
    // faction banners on poles along the top
    let poles = '';
    const cols = ['#c0392b', '#f6f0e4', '#2f8a4a', '#2f6db3'];
    for (let j = 0, Z = ZN + 500; Z < 4200; Z *= 1.45, j++) {
      const [x, y] = pj(k * SX, SYT - 260, Z);
      const sc = 800 / Z;
      poles += flag(s, x, y - 200 * sc, 160 * sc * -k, 70 * sc, cols[j % 4], '#5a3a20', -k, j);
    }
    s.add(poles);
  }
  // imperial box (pulvinar) on the left stands — temple front with purple awning
  {
    const [x, y] = pj(-TX - 300, 60, 2400);
    const sc = 800 / 2400;
    const cId = defColumn(s, '#ffffff', '#f0e6d4', '#b8a888', 'corinth', '#f6e6b8');
    let cs = '';
    for (let i = 0; i < 4; i++) cs += col(cId, x - 200 * sc + i * 130 * sc, y, 360 * sc);
    s.add(rect(x - 250 * sc, y - 10 * sc, 480 * sc, 60 * sc, '#f6ecd8'), cs, path(`M${P(x - 260 * sc, y - 360 * sc)}h${n(500 * sc)}l${n(-250 * sc)},${n(-110 * sc)}z`, '#f6ecd8'), path(`M${P(x - 230 * sc, y - 330 * sc)}h${n(440 * sc)}v${n(70 * sc)}q${n(-220 * sc)},${n(40 * sc)} ${n(-440 * sc)},0z`, '#6a2a7a'));
  }
  // ---- the track
  s.add(path(flat(-TX, TX, FY, ZN - 300, ZF), s.lg([[0, '#f2c888'], [0.45, '#e2a868'], [1, '#c88a4a']])));
  let ruts = '';
  for (const X of [-560, -420, -300, 300, 420, 560]) ruts += `M${P(...pj(X, FY, ZN - 200))}L${P(...pj(X, FY, ZF))}`;
  s.add(stroke(ruts, '#a8683a', 2, op(0.35)), stroke(ruts.replace(/,(\d+\.?\d*)/g, (_m, a) => ',' + n(+a + 2)), '#fff0c8', 1.5, op(0.4)));
  s.add(speckles(s, 200, 420, 1400, 900, 160, '#a8683a', 0.3, 3));
  // far curved end with the gate arch
  {
    const [x, y] = pj(0, FY, ZF);
    s.add(rect(x - 70, y - 70, 140, 70, '#f2dcb4'), path(`M${P(x - 18, y)}v-30a18,18 0 0,1 36,0v30z`, '#8a5a3a'), rect(x - 74, y - 80, 148, 10, '#fff4e0'), path(`M${P(x - 24, y - 80)}h48l-6,-12h-36z`, '#e8b84a'));
  }
  // ---- the spina: long central barrier with obelisk, statues, lap-counters
  const spTop = 200;
  s.add(path(quad(pj(-110, spTop, 900), pj(110, spTop, 900), pj(110, spTop, ZF - 600), pj(-110, spTop, ZF - 600)), '#fff4e0'));
  s.add(path(quad(pj(-110, spTop, 900), pj(-110, spTop, ZF - 600), pj(-110, FY, ZF - 600), pj(-110, FY, 900)), '#d8bc90'));
  s.add(path(quad(pj(110, spTop, 900), pj(110, spTop, ZF - 600), pj(110, FY, ZF - 600), pj(110, FY, 900)), '#b08a5a'));
  s.add(path(quad(pj(-26, spTop, 1000), pj(26, spTop, 1000), pj(26, spTop, ZF - 700), pj(-26, spTop, ZF - 700)), '#4f9ab0', op(0.85)));
  {
    const a = pj(-110, spTop, 900);
    const b = pj(110, FY, 900);
    s.add(rect(a[0], a[1], b[0] - a[0], b[1] - a[1], '#f2e2c4'), rect(a[0], a[1] + (b[1] - a[1]) * 0.45, b[0] - a[0], 4, '#b8342a'), rect(a[0] - 4, a[1] - 5, b[0] - a[0] + 8, 6, '#ffffff'));
  }
  // statues and shrines along the spina
  let sts = '';
  for (const Z of [1600, 2300, 4200, 5600]) {
    const [x, y] = pj(0, spTop, Z);
    const sc = 800 / Z;
    sts += rect(x - 30 * sc, y - 60 * sc, 60 * sc, 60 * sc, '#f6ecd8') + person(x, y - 60 * sc, 200 * sc, '#e8b84a', '#e8b84a', { arm: 4 });
  }
  s.add(sts);
  // lap counter: seven golden dolphins on a frame
  {
    const [x, y] = pj(0, spTop, 1250);
    const sc = 800 / 1250;
    s.add(stroke(`M${P(x - 90 * sc, y)}V${n(y - 200 * sc)}M${P(x + 90 * sc, y)}V${n(y - 200 * sc)}M${P(x - 100 * sc, y - 200 * sc)}H${n(x + 100 * sc)}`, '#8a6a4a', 8 * sc));
    let dl = '';
    for (let i = 0; i < 7; i++) {
      const dx = x - 78 * sc + i * 26 * sc;
      dl += `M${P(dx, y - 196 * sc)}q${n(-10 * sc)},${n(18 * sc)} 0,${n(36 * sc)}q${n(12 * sc)},${n(-6 * sc)} ${n(8 * sc)},${n(-20 * sc)}z`;
    }
    s.add(path(dl, '#e8b84a'));
  }
  // the obelisk — rising into the sky strip
  {
    const Z = 3200;
    const [x, y] = pj(0, spTop, Z);
    const sc = 800 / Z;
    const h = 900 * sc;
    s.add(rect(x - 70 * sc, y - 120 * sc, 140 * sc, 120 * sc, '#f6ecd8'), rect(x - 80 * sc, y - 130 * sc, 160 * sc, 14 * sc, '#fffaf0'));
    s.add(path(`M${P(x - 56 * sc, y - 130 * sc)}L${P(x - 36 * sc, y - 130 * sc - h)}L${P(x, y - 130 * sc - h - 60 * sc)}L${P(x + 36 * sc, y - 130 * sc - h)}L${P(x + 56 * sc, y - 130 * sc)}Z`, s.lg([[0, '#f2c8a0'], [0.5, '#d8a07a'], [1, '#a86a4a']], 0, 0, 1, 0)));
    s.add(path(`M${P(x - 36 * sc, y - 130 * sc - h)}L${P(x, y - 130 * sc - h - 60 * sc)}L${P(x + 36 * sc, y - 130 * sc - h)}Z`, '#f2c64a'));
    let gl = '';
    for (let i = 0; i < 10; i++) {
      const yy = y - 200 * sc - i * 80 * sc;
      gl += `M${P(x - 12 * sc, yy)}h${n(8 * sc)}M${P(x + 4 * sc, yy - 30 * sc)}h${n(8 * sc)}M${P(x - 4 * sc, yy - 50 * sc)}v${n(10 * sc)}`;
    }
    s.add(stroke(gl, '#7a4a2a', 3 * sc, op(0.5)));
    s.add(`<circle cx="${n(x)}" cy="${n(y - 130 * sc - h - 40 * sc)}" r="${n(60)}" fill="${s.rgu([[0, '#fff4c0', 0.6], [1, '#fff4c0', 0]], x, y - 130 * sc - h - 40 * sc, 60)}"/>`);
  }
  // near meta: three gilded cones on a half-round base (bottom centre, visible below the board)
  {
    const [x, y] = pj(0, FY, 540);
    s.add(ell(x, y + 6, 190, 28, '#6a3a1a', op(0.25)));
    s.add(path(`M${P(x - 170, y)}V${n(y - 60)}H${n(x + 170)}V${n(y)}Z`, s.lg([[0, '#fff4e0'], [1, '#d8c0a0']])), rect(x - 180, y - 70, 360, 14, '#ffffff'));
    s.add(stroke(`M${P(x - 170, y - 30)}H${n(x + 170)}`, '#b8342a', 4));
    for (const dx of [-110, 0, 110]) {
      const h = dx === 0 ? 130 : 105;
      s.add(path(`M${P(x + dx - 34, y - 70)}Q${P(x + dx - 20, y - 70 - h * 0.6)} ${P(x + dx, y - 70 - h)}Q${P(x + dx + 20, y - 70 - h * 0.6)} ${P(x + dx + 34, y - 70)}Z`, s.lg([[0, '#fff0a8'], [0.45, '#e8b034'], [1, '#8c5a0c']], 0, 0, 1, 0)));
      s.add(`<circle cx="${n(x + dx)}" cy="${n(y - 74 - h)}" r="9" fill="#fff0a8"/>`);
    }
  }
  // ---- racing chariots throwing up dust
  const coatsA = ['#f6f0e4', '#e8dcc8', '#f6f0e4', '#d8ccb8'];
  const coatsB = ['#5a3420', '#7a4a2a', '#3a2214', '#6a3a1e'];
  const coatsC = ['#a86a3a', '#c88a4a', '#8a5030', '#b87a40'];
  s.add(raceChariot(s, 760, 520, 0.9, -1, '#2f8a4a', coatsC), raceChariot(s, 900, 540, 1, 1, '#f6f0e4', coatsB));
  s.add(raceChariot(s, 300, 760, 2.2, 1, '#c0392b', coatsB), raceChariot(s, 1290, 780, 2.3, -1, '#2f6db3', coatsA));
  // golden dust haze low over the track
  s.add(rect(0, 640, W, 260, s.lg([[0, '#ffd8a0', 0], [1, '#f0b878', 0.35]])));
  let mo = '';
  for (let i = 0; i < 60; i++) mo += circ(s.rnd(0, W), s.rnd(420, 880), s.rnd(1.5, 3.5));
  s.add(path(mo, '#fff0c8', op(0.55)));
  vignette(s, '#5a2e1a', 0.3);
}

/** 13 · The Great Library — Alexandria: scroll shelves, lotus columns, a terrace onto the Nile at golden hour. */
function greatLibrary(s: S): void {
  s.lit = 1;
  const { pj, quad, flat, side } = cam(800, 380, 800);
  const FY = 360;
  const CY = -940;
  const WX = 1050;
  const ZN = 420;
  const ZB = 3200;
  s.add(rect(0, 0, W, H, '#e8cfa0'));
  // ---- view through the great opening: Nile at sunset
  {
    const a = pj(-620, CY, ZB);
    const b = pj(620, FY, ZB);
    s.add(rect(a[0], a[1], b[0] - a[0], b[1] - a[1], s.lg([[0, '#4a7ab8'], [0.35, '#e8a0a0'], [0.62, '#ffc878'], [0.78, '#ffe0a0']])));
    const hz = a[1] + (b[1] - a[1]) * 0.78;
    s.add(`<circle cx="${n(800)}" cy="${n(hz - 20)}" r="22" fill="#fff6dc"/>`, `<circle cx="800" cy="${n(hz - 20)}" r="120" fill="${s.rgu([[0, '#fff0c0', 0.7], [1, '#fff0c0', 0]], 800, hz - 20, 120)}"/>`);
    // far bank: pyramids and a temple pylon
    s.add(path(`M${P(a[0], hz)}L${P(640, hz)}L${P(668, hz - 34)}L${P(696, hz)}L${P(712, hz)}L${P(730, hz - 22)}L${P(748, hz)}H${n(b[0])}V${n(hz + 6)}H${n(a[0])}Z`, '#c88a78'));
    s.add(rect(890, hz - 26, 40, 26, '#c88a78'), rect(940, hz - 26, 40, 26, '#c88a78'), rect(930, hz - 16, 10, 16, '#c88a78'));
    s.add(rect(a[0], hz + 4, b[0] - a[0], b[1] - hz - 4, s.lg([[0, '#ffd8a0'], [1, '#c8806a']])));
    s.add(glints(s, a[0], b[0], hz + 8, b[1] - 4, 26, '#fff4d0', 0.8, 14));
    // feluccas
    for (const [x, y, sc] of [[700, hz + 18, 0.8], [900, hz + 26, 1]] as [number, number, number][])
      s.add(path(`M${P(x - 18 * sc, y)}h${n(36 * sc)}l${n(-6 * sc)},${n(6 * sc)}h${n(-24 * sc)}z`, '#5a3a3a'), path(`M${P(x, y - 2)}L${P(x - 2 * sc, y - 40 * sc)}L${P(x + 22 * sc, y - 4)}Z`, '#fff4e0'));
    // palms on the terrace edge
    let pm = '';
    for (const [x, h, l] of [[560, 150, 0.3], [620, 120, -0.2], [990, 140, -0.3], [1050, 170, 0.25]] as [number, number, number][]) pm += palm(s, x, b[1], h, l, '#6a4a3a', '#3a5a3a', '#5a7a4a');
    s.add(pm);
    // terrace balustrade
    let bal = '';
    for (let x = a[0] + 6; x < b[0]; x += 12) bal += `M${n(x)},${n(b[1])}v-22`;
    s.add(stroke(bal, '#f6e6c8', 5), rect(a[0], b[1] - 28, b[0] - a[0], 7, '#fff4e0'));
  }
  // ---- ceiling: painted beams, lapis with gold stars
  s.add(path(quad(pj(-WX, CY, ZN), pj(WX, CY, ZN), pj(WX, CY, ZB), pj(-WX, CY, ZB)), s.lg([[0, '#1e3a6a'], [1, '#2f5a90']])));
  let beams = '';
  for (let Z = ZN + 120; Z < ZB; Z *= 1.22) beams += quad(pj(-WX, CY, Z), pj(WX, CY, Z), pj(WX, CY, Z + 50), pj(-WX, CY, Z + 50));
  s.add(path(beams, '#c8902e'));
  let stars = '';
  for (let i = 0; i < 70; i++) {
    const X = s.rnd(-WX, WX);
    const Z = s.rnd(ZN, ZB);
    const [x, y] = pj(X, CY, Z);
    stars += starPath5(x, y, (14 * 800) / Z);
  }
  s.add(path(stars, '#f2c64a'));
  // back wall around the opening (pylon form)
  {
    const l = pj(-WX, CY, ZB);
    const r = pj(WX, FY, ZB);
    const a = pj(-620, CY, ZB);
    const b = pj(620, FY, ZB);
    s.add(path(`M${P(l[0], l[1])}H${n(r[0])}V${n(r[1])}H${n(l[0])}ZM${P(a[0], a[1])}V${n(b[1])}H${n(b[0])}V${n(a[1])}Z`, s.lg([[0, '#e8c890'], [1, '#d8b070']]), 'fill-rule="evenodd"'));
    // winged sun disc over the opening
    const cx = 800;
    const cy = a[1] + 10;
    s.add(`<circle cx="${cx}" cy="${n(cy)}" r="12" fill="#e83a2a"/>`, path(`M${P(cx - 14, cy)}q-30,-14 -70,-6q30,4 40,14q-26,0 -34,6q30,4 64,-8zM${P(cx + 14, cy)}q30,-14 70,-6q-30,4 -40,14q26,0 34,6q-30,4 -64,-8z`, '#f2c64a'));
  }
  // ---- side walls: floor-to-ceiling scroll shelves (armaria)
  // scroll ends stacked in the pigeonholes (screen-space pattern keeps the markup small)
  const scrollPat = s.uid();
  {
    let inner = rect(0, 0, 24, 30, '#2a1608');
    const cc = ['#e8d0a0', '#d8b47a', '#f2dcb0', '#c89a62'];
    [[5, 8], [13, 7], [20, 9], [8, 21], [17, 22]].forEach(([x, y], i) => {
      inner += `<ellipse cx="${x}" cy="${y}" rx="3.6" ry="5.4" fill="${cc[i % 4]}"/><circle cx="${x}" cy="${y}" r="1.1" fill="#8a5a2a"/>`;
    });
    inner += rect(12, 12, 1.4, 8, '#b8342a');
    s.def(`<pattern id="${scrollPat}" patternUnits="userSpaceOnUse" width="24" height="30" patternTransform="scale(1.6)">${inner}</pattern>`);
  }
  const scrollFill = `url(#${scrollPat})`;
  for (const k of [-1, 1]) {
    const X = k * WX;
    s.add(path(side(X, CY, FY, ZN, ZB), k < 0 ? '#7a4a2a' : '#5a341e'));
    let cells = '';
    for (let Z = ZN; Z < ZB; Z *= 1.12) {
      const Z1 = Z * 1.12;
      for (let Y = -820; Y < 300; Y += 120) cells += side(X, Y + 10, Y + 110, Z + (Z1 - Z) * 0.08, Z1 - (Z1 - Z) * 0.08);
    }
    s.add(path(cells, '#2a1608'), path(cells, scrollFill));
    // ladders
    for (const Z of [1100, 2000]) {
      const sc = 800 / Z;
      const a = pj(X - k * 60, FY, Z);
      const b = pj(X - k * 10, -600, Z + 100);
      let rungs = '';
      for (let i = 1; i < 12; i++) {
        const t = i / 12;
        rungs += `M${P(a[0] + (b[0] - a[0]) * t - 14 * sc, a[1] + (b[1] - a[1]) * t)}h${n(28 * sc)}`;
      }
      s.add(stroke(`M${P(a[0] - 14 * sc, a[1])}L${P(b[0] - 14 * sc, b[1])}M${P(a[0] + 14 * sc, a[1])}L${P(b[0] + 14 * sc, b[1])}${rungs}`, '#c8955c', 5 * sc));
    }
  }
  // ---- floor
  s.add(path(flat(-WX, WX, FY, ZN, ZB), s.lg([[0, '#f2dcb0'], [1, '#d8b47a']])));
  let fl = '';
  const tz = [ZN];
  while (tz[tz.length - 1] < ZB) tz.push(Math.min(ZB, tz[tz.length - 1] * 1.15));
  for (let i = -8; i < 8; i++)
    for (let k = 0; k < tz.length - 1; k++) if ((i + k) % 2) fl += flat(i * 140, (i + 1) * 140, FY, tz[k], tz[k + 1]);
  s.add(path(fl, '#c89a5a', op(0.45)));
  // warm sunset light spilling across the floor from the opening
  s.add(path(quad(pj(-620, FY, ZB), pj(620, FY, ZB), pj(900, FY, ZN + 200), pj(-900, FY, ZN + 200)), s.lg([[0, '#fff0c0', 0.55], [1, '#fff0c0', 0]])));
  // lapis runner down the middle with a gold border
  s.add(path(flat(-220, 220, FY, ZN, ZB - 40), '#2f5a90', op(0.85)), stroke(`M${P(...pj(-200, FY, ZN))}L${P(...pj(-200, FY, ZB - 40))}M${P(...pj(200, FY, ZN))}L${P(...pj(200, FY, ZB - 40))}`, '#f2c64a', 3));
  // ---- lotus columns in front of the shelves
  const cid = s.uid();
  s.def(
    `<g id="${cid}">` +
      rect(-7, -4, 14, 4, '#e8c890') +
      path('M-5,-4L-4.4,-80H4.4L5,-4Z', s.lg([[0, '#5aa0a0'], [0.35, '#8ad0c8'], [0.7, '#3a7a80'], [1, '#2a5a60']], 0, 0, 1, 0)) +
      stroke('M-4.6,-20H4.6M-4.5,-40H4.5M-4.4,-60H4.4', '#f2c64a', 1.6) +
      path('M-4.4,-80Q-9,-88 -9,-97H9Q9,-88 4.4,-80Z', s.lg([[0, '#f6d27a'], [1, '#b8862a']], 0, 0, 1, 0)) +
      stroke('M-6,-90L-2,-81M0,-97V-81M6,-90L2,-81', '#2a5a60', 0.8) +
      rect(-10, -101, 20, 4, '#e8c890') +
      `</g>`,
  );
  const cols: string[] = [];
  for (const k of [-1, 1])
    for (let Z = ZB - 200; Z >= ZN + 80; Z -= 700) {
      const [x, y] = pj(k * 880, FY, Z);
      const top = pj(k * 880, CY, Z)[1];
      cols.push(col(cid, x, y, y - top, 1.3));
    }
  s.add(cols.join(''));
  // hanging oil lamps
  let lamps = '';
  for (const [X, Z] of [[-500, 1000], [500, 1000], [-500, 1900], [500, 1900]] as [number, number][]) {
    const [x, y] = pj(X, -300, Z);
    const top = pj(X, CY, Z)[1];
    const sc = 800 / Z;
    lamps += stroke(`M${P(x, top)}V${n(y)}`, '#8a6a3a', 1.5) + `<circle cx="${n(x)}" cy="${n(y + 10 * sc)}" r="${n(90 * sc)}" fill="${s.rgu([[0, '#ffd27a', 0.55], [1, '#ffd27a', 0]], x, y + 10 * sc, 90 * sc)}"/>` + path(`M${P(x - 24 * sc, y)}h${n(48 * sc)}l${n(-8 * sc)},${n(14 * sc)}h${n(-32 * sc)}z`, '#c8902e') + path(`M${P(x - 3 * sc, y)}q${n(3 * sc)},${n(-16 * sc)} ${n(6 * sc)},0z`, '#fff0a0');
  }
  s.add(lamps);
  // scholars
  {
    const p1 = pj(-420, FY, 1500);
    const p2 = pj(380, FY, 1800);
    const p3 = pj(-120, FY, 2500);
    s.add(person(p1[0], p1[1], 150, '#f6f0e4', '#a86a48', { sash: '#2f5a90', hair: '#2a1a10', arm: 1.2 }), person(p2[0], p2[1], 130, '#e8c070', '#8a5a3a', { hair: '#1a1008', dir: -1, arm: 1 }), person(p3[0], p3[1], 90, '#ffffff', '#a86a48', { sash: '#b8342a', hair: '#2a1a10' }));
  }
  // ---- foreground: reading table with unrolled scrolls, inkpot, armillary sphere
  s.add(path('M120,900L220,770H1380L1480,900Z', s.lg([[0, '#9a5a30'], [1, '#5a3018']])), rect(200, 762, 1200, 14, '#c8804a'));
  s.add(path('M300,800L330,780H740L720,820Z', '#fbf0d6'), stroke('M340,792H720M336,800H716M332,808H712', '#7a5a3a', 1.2, op(0.6)));
  s.add(ell(300, 806, 14, 20, '#e8d4a8'), ell(740, 796, 14, 20, '#e8d4a8'));
  s.add(path('M860,812L880,786H1060L1050,816Z', '#fbf0d6'), ell(1060, 800, 12, 18, '#e8d4a8'));
  s.add(ell(820, 806, 22, 9, '#2a1a10'), stroke('M820,800l30,-46', '#c8a060', 3));
  // armillary sphere
  {
    const x = 1240;
    const y = 690;
    s.add(path(`M${P(x - 30, 776)}h60l-10,-20h-40z`, '#c8902e'), stroke(`M${P(x, 756)}V${n(y + 60)}`, '#a87a2a', 6));
    s.add(`<ellipse cx="${x}" cy="${y}" rx="66" ry="66" fill="none" stroke="#e8b84a" stroke-width="5"/>`, `<ellipse cx="${x}" cy="${y}" rx="66" ry="20" fill="none" stroke="#e8b84a" stroke-width="4"/>`, `<ellipse cx="${x}" cy="${y}" rx="22" ry="66" fill="none" stroke="#c8902e" stroke-width="4" transform="rotate(30 ${x} ${y})"/>`, `<ellipse cx="${x}" cy="${y}" rx="66" ry="14" fill="none" stroke="#f6d27a" stroke-width="5" transform="rotate(-24 ${x} ${y})"/>`, `<circle cx="${x}" cy="${y}" r="12" fill="#2f5a90"/>`);
  }
  // potted papyrus framing
  const papyrus = (x: number, base: number, sc: number) => {
    let st = '';
    let heads = '';
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.13;
      const L = (220 + (i % 3) * 30) * sc;
      const ex = x + Math.cos(a) * L;
      const ey = base - 60 * sc + Math.sin(a) * L;
      st += `M${P(x, base - 60 * sc)}L${P(ex, ey)}`;
      for (let j = -3; j <= 3; j++) heads += `M${P(ex, ey)}l${n(Math.sin(a + Math.PI / 2 + j * 0.32) * 38 * sc)},${n(-Math.abs(Math.cos(j * 0.32)) * 30 * sc - 4 * sc)}`;
    }
    return rect(x - 46 * sc, base - 80 * sc, 92 * sc, 80 * sc, s.lg([[0, '#3a7ab8'], [1, '#1e3a6a']]), `rx="${n(10 * sc)}"`) + rect(x - 50 * sc, base - 84 * sc, 100 * sc, 10 * sc, '#f2c64a') + stroke(st, '#4a7a3a', 3 * sc) + stroke(heads, '#7aa84a', 2.4 * sc, 'stroke-linecap="round"');
  };
  s.add(papyrus(70, 900, 1.4), papyrus(1530, 900, 1.4));
  vignette(s, '#3a2410', 0.3);
}

/** 15 · The Capitoline Temple — Jupiter's gilded temple atop the great stair, sacrificial fires, high summer sky. */
function capitolineTemple(s: S): void {
  s.lit = -1;
  sky(s, [[0, '#1a4f9a'], [0.3, '#4f8fd0'], [0.55, '#a8d0ec'], [0.7, '#ffe6b8']]);
  sun(s, 1380, 150, 40, '#ffffff', '#fff2c0', 520, 0.8);
  shafts(s, 1380, 150, Math.PI * 0.55, Math.PI * 1.05, 10, 1300, '#fff8dc', 0.12);
  cloud(s, 220, 120, 400, 110, '#fff6e6', '#c8a8a0');
  cloud(s, 1300, 300, 420, 70, '#fff4e0', '#d8b0a0', 0.9);
  cloud(s, 560, 330, 300, 50, '#fff8ec', '#e0c0b0', 0.8, 6);
  s.add(soaringEagle(560, 70, 0.9, '#3a2a1a'), soaringEagle(1180, 44, 0.6, '#4a3a2a'));
  // the city far below to the sides (rooftops and umbrella pines)
  s.add(hills(s, 560, 30, 4, '#b8c8b0'));
  let roofs = '';
  for (let i = 0; i < 26; i++) {
    const x = i < 13 ? 10 + i * 18 : 1340 + (i - 13) * 20;
    const y = 560 - s.rnd(0, 16);
    roofs += `M${P(x, y)}l10,-8l10,8v12h-20z`;
  }
  s.add(path(roofs, '#d88a6a', op(0.8)));
  haze(s, 420, 600, '#fff2dc', 0, 0.5);
  // ---- the temple (hexastyle front, gilded roof, polychrome terracotta)
  const cId = defColumn(s, '#ffffff', '#f2ece0', '#a8b0c4', 'corinth', '#f2c64a');
  const T = { stone: '#f4efe4', light: '#ffffff', dark: '#8a96b0', roof: '#e8b034', gold: '#f2c64a', colId: cId, inner: '#8a6a58' };
  s.add(temple(s, 800, 500, 1080, 250, 8, T, { steps: 2, pedH: 110 }));
  // polychrome frieze band and antefixes along the pediment
  s.add(rect(268, 190, 1064, 9, '#b8342a'), rect(268, 199, 1064, 4, '#2f5a9a'));
  let ante = '';
  for (let x = 266; x < 1330; x += 30) ante += `M${P(x, 178)}l7,-12l7,12z`;
  s.add(path(ante, '#e8b034'));
  // golden Jupiter glimpsed through the doors
  s.add(`<circle cx="800" cy="380" r="90" fill="${s.rgu([[0, '#ffe08a', 0.55], [1, '#ffe08a', 0]], 800, 360, 90)}"/>`, person(800, 488, 120, '#e8b034', '#f2c64a', { arm: 4 }));
  // gilded quadriga and eagles on the roof
  s.add(quadriga(800, 72, 0.85, '#e8b034'));
  
  // garlands and red banners between the columns
  const xs: number[] = [];
  for (let i = 0; i < 8; i++) xs.push(260 + 13.6 + ((1080 - 27.2) * i) / 7);
  s.add(garlands(xs, 240, 14, '#4f8a3e', '#b8e07a', 6));
  for (const bx of [xs[1] + 32, xs[5] + 32]) s.add(hangingBanner(s, bx, 248, 40, 110, '#b8342a', '#f2c64a', `<circle cx="${n(bx + 20)}" cy="${n(296)}" r="9" fill="none" stroke="#f2c64a" stroke-width="3"/>`));
  // ---- the great stair, widening toward the viewer
  s.add(path('M240,496H1360L1600,900H0Z', s.lg([[0, '#f6f1e6'], [1, '#e0d6c2']])));
  let st = '';
  let hi = '';
  for (let i = 0; i < 26; i++) {
    const t = i / 26;
    const y = 496 + 404 * Math.pow(t, 1.25);
    const x0 = 240 - 240 * ((y - 496) / 404);
    const x1 = 1360 + 240 * ((y - 496) / 404);
    st += `M${P(x0, y)}H${n(x1)}`;
    hi += `M${P(x0, y + 1.5 + t * 3)}H${n(x1)}`;
  }
  s.add(stroke(st, '#a8a090', 1.6, op(0.55)), stroke(hi, '#ffffff', 1.4, op(0.8)));
  // cheek walls of the stair with bronze Dioscuri statues at the foot
  s.add(path('M180,480H250L40,900H-40Z', s.lg([[0, '#e8e0d0'], [1, '#c8bca4']])), path('M1420,480H1350L1560,900H1640Z', s.lg([[0, '#e8e0d0'], [1, '#c8bca4']])));
  s.add(rect(30, 660, 170, 70, '#efe8da'), rect(1400, 660, 170, 70, '#efe8da'));
  s.add(`<path d="${HORSE}" fill="#8a6a3a" transform="translate(70 590) scale(1.8)"/>`, `<path d="${HORSE}" fill="#8a6a3a" transform="translate(1530 590) scale(-1.8 1.8)"/>`);
  s.add(person(80, 662, 90, '#7a5a2a', '#7a5a2a', { arm: 5 }), person(1520, 662, 90, '#7a5a2a', '#7a5a2a', { arm: 5, dir: -1 }));
  // procession: white-robed priests and a garlanded white bull ascending
  let proc = '';
  for (const [x, y, h] of [[420, 600, 70], [470, 580, 64], [520, 562, 60], [1180, 590, 68], [1230, 572, 62]] as [number, number, number][]) proc += person(x, y, h, '#ffffff', '#c88a62', { sash: '#b8342a', hair: '#3a2416' });
  s.add(proc);
  {
    const x = 1060;
    const y = 630;
    s.add(path(`M${P(x - 70, y - 30)}q10,-34 60,-36q40,-2 70,6q20,4 30,20l6,22q-8,6 -16,0l-6,-10q-10,10 -20,6v40h-10l-4,-30h-60l-6,30h-10l-2,-36q-14,-4 -20,-12z`, '#fbf7ee'), path(`M${P(x + 70, y - 52)}l10,-14l4,12z`, '#e8d8b8'), stroke(`M${P(x + 54, y - 40)}q-10,22 -2,40`, '#6aa84a', 6), path(`M${P(x - 10, y - 66)}h40v14h-40z`, '#b8342a', op(0.8)));
  }
  // ---- braziers burning on both sides of the stair
  s.add(brazier(s, 330, 720, 1.5, '#c8902e'), brazier(s, 1270, 720, 1.5, '#c8902e'));
  s.add(brazier(s, 300, 520, 0.7, '#c8902e'), brazier(s, 1300, 520, 0.7, '#c8902e'));
  s.add(smoke(s, 300, 440, 160, 30, '#ffffff', 0.12, -0.6), smoke(s, 1300, 440, 160, 30, '#ffffff', 0.12, 0.6));
  // ---- sacrificial altar at the foot of the stair (bottom centre)
  {
    const x = 800;
    const y = 900;
    s.add(ell(x, y - 2, 260, 26, '#6a5a4a', op(0.2)));
    s.add(rect(x - 220, y - 110, 440, 110, s.lg([[0, '#ffffff'], [1, '#e2d8c4']])), rect(x - 236, y - 124, 472, 18, '#fffaf0'), rect(x - 226, y - 20, 452, 20, '#e8e0d0'));
    s.add(garlands([x - 200, x - 100, x, x + 100, x + 200], y - 96, 14, '#4f8a3e', '#b8e07a', 7));
    s.add(path(`M${P(x - 14, y - 70)}l14,-14l14,14l-14,14z`, '#b8342a'), `<circle cx="${n(x - 120)}" cy="${n(y - 54)}" r="12" fill="none" stroke="#c8902e" stroke-width="4"/>`, `<circle cx="${n(x + 120)}" cy="${n(y - 54)}" r="12" fill="none" stroke="#c8902e" stroke-width="4"/>`);
    // sacred fire
    s.add(`<circle cx="${x}" cy="${y - 150}" r="160" fill="${s.rgu([[0, '#ffb347', 0.5], [1, '#ffb347', 0]], x, y - 150, 160)}"/>`);
    s.add(path(`M${P(x - 120, y - 124)}C${P(x - 130, y - 170)} ${P(x - 60, y - 180)} ${P(x - 40, y - 230)}C${P(x - 20, y - 190)} ${P(x + 10, y - 200)} ${P(x + 20, y - 260)}C${P(x + 50, y - 200)} ${P(x + 90, y - 190)} ${P(x + 80, y - 160)}C${P(x + 120, y - 160)} ${P(x + 130, y - 140)} ${P(x + 120, y - 124)}Z`, '#ff7a1a'));
    s.add(path(`M${P(x - 80, y - 124)}C${P(x - 80, y - 150)} ${P(x - 30, y - 160)} ${P(x - 20, y - 190)}C${P(x, y - 160)} ${P(x + 20, y - 170)} ${P(x + 30, y - 200)}C${P(x + 50, y - 160)} ${P(x + 80, y - 150)} ${P(x + 80, y - 124)}Z`, '#ffd25a'));
    s.add(path(`M${P(x - 36, y - 124)}C${P(x - 30, y - 140)} ${P(x - 6, y - 148)} ${P(x, y - 166)}C${P(x + 10, y - 146)} ${P(x + 30, y - 140)} ${P(x + 36, y - 124)}Z`, '#fff6c8'));
  }
  // laurel and rose petals strewn on the steps
  let pet = '';
  for (let i = 0; i < 40; i++) {
    const x = s.rnd(250, 1350);
    const y = s.rnd(600, 880);
    const r = 2 + ((y - 600) / 280) * 4;
    pet += `M${P(x - r, y)}q${n(r)},${n(-r)} ${n(2 * r)},0q${n(-r)},${n(r * 0.8)} ${n(-2 * r)},0z`;
  }
  s.add(path(pet, '#d8404a', op(0.75)));
  // cypresses framing
  s.add(cypress(s, 120, 500, 300, 60, '#2f5a3a', '#5e8a52'), cypress(s, 1480, 500, 320, 64, '#2f5a3a', '#5e8a52'));
  vignette(s, '#2a3a6a', 0.24);
}

/** 17 · The Pantheon — the coffered dome, the oculus and its moving beam of light, marble floor of circles and squares. */
function pantheon(s: S): void {
  s.lit = 1;
  // rings of the dome: [centre y, rx, ry]; ring 0 is the oculus, the last ring is the cornice
  const R: [number, number, number][] = [
    [74, 86, 46],
    [44, 230, 132],
    [8, 410, 238],
    [-54, 630, 352],
    [-136, 900, 488],
    [-250, 1240, 650],
  ];
  const pt = (k: number, t: number): Pt => [800 + R[k][1] * Math.sin(t), R[k][0] + R[k][2] * Math.cos(t)];
  const lerpRing = (k: number, f: number, t: number): Pt => {
    const a = pt(k, t);
    const b = pt(k + 1, t);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  };
  // dome surface
  s.add(rect(0, 0, W, H, s.lg([[0, '#cfc2ac'], [0.45, '#e2d6c0'], [1, '#d6c8ae']])));
  // coffers: 28 meridians, rings between consecutive ellipses
  const M = 28;
  let cofOuter = '';
  let cofInner = '';
  let cofDeep = '';
  let ros = '';
  for (let k = 0; k < R.length - 1; k++) {
    for (let j = 0; j < M; j++) {
      const t0 = -Math.PI + (j / M) * Math.PI * 2;
      const t1 = t0 + (Math.PI * 2) / M;
      const tm = (t0 + t1) / 2;
      const c = pt(k, tm);
      if (c[1] < -400 && pt(k + 1, tm)[1] < -50) continue;
      const q = (f0: number, f1: number, a: number, b: number) => {
        const A = lerpRing(k, f0, t0 + (t1 - t0) * a);
        const B = lerpRing(k, f0, t1 - (t1 - t0) * b);
        const C = lerpRing(k, f1, t1 - (t1 - t0) * b);
        const D = lerpRing(k, f1, t0 + (t1 - t0) * a);
        return `M${P(A[0], A[1])}L${P(B[0], B[1])}L${P(C[0], C[1])}L${P(D[0], D[1])}Z`;
      };
      cofOuter += q(0.12, 0.88, 0.1, 0.1);
      cofInner += q(0.24, 0.8, 0.2, 0.2);
      cofDeep += q(0.36, 0.72, 0.3, 0.3);
      const m = lerpRing(k, 0.54, tm);
      const sc = (R[k + 1][2] - R[k][2]) / 130;
      ros += starPath5(m[0], m[1], Math.max(2, 9 * sc));
    }
  }
  s.add(path(cofOuter, '#b8a88e'), path(cofInner, '#a8967a'), path(cofDeep, s.lg([[0, '#8a7a62'], [1, '#c8b89c']])), path(ros, '#d8a83a'));
  // light falls on the lower-right dome: soft warm wash
  s.add(rect(0, 0, W, H, s.rgu([[0, '#fff6e0', 0.35], [1, '#fff6e0', 0]], 1100, 260, 700)));
  // the oculus — open sky
  {
    const [cy, rx, ry] = R[0];
    s.add(`<ellipse cx="800" cy="${cy}" rx="${rx + 8}" ry="${ry + 6}" fill="#c8a868"/>`, `<ellipse cx="800" cy="${cy}" rx="${rx}" ry="${ry}" fill="${s.lg([[0, '#3a8ad8'], [1, '#bfe6fa']])}"/>`);
    s.add(path(`M${P(740, cy + 10)}q20,-22 46,-12q14,-16 34,-4q22,-6 30,12z`, '#ffffff', op(0.9)));
    s.add(`<ellipse cx="800" cy="${cy}" rx="${rx * 3}" ry="${ry * 3}" fill="${s.rgu([[0, '#fffbe8', 0.55], [1, '#fffbe8', 0]], 800, cy, rx * 3)}"/>`);
  }
  // ---- the drum (wall) between the cornice (U) and the floor junction (∩)
  const corn = (x: number) => {
    const [cy, rx, ry] = R[R.length - 1];
    const u = Math.max(-1, Math.min(1, (x - 800) / rx));
    return cy + ry * Math.sqrt(1 - u * u);
  };
  const FLC = 1110;
  const FRX = 1500;
  const FRY = 440;
  const floorJ = (x: number) => {
    const u = Math.max(-1, Math.min(1, (x - 800) / FRX));
    return FLC - FRY * Math.sqrt(1 - u * u);
  };
  // floor first (marble circles & squares in perspective), the wall then covers the far part
  {
    const VY = 560;
    const f = 800;
    const fy = 300;
    const pj = (X: number, Z: number): Pt => [800 + (X * f) / Z, VY + (fy * f) / Z];
    s.add(rect(0, 600, W, 300, '#e8e0d0'));
    let sq = '';
    let ci = '';
    let ci2 = '';
    const zs = [420];
    while (zs[zs.length - 1] < 2600) zs.push(zs[zs.length - 1] * 1.22);
    for (let i = -12; i < 12; i++)
      for (let k = 0; k < zs.length - 1; k++) {
        const X0 = i * 300;
        const X1 = X0 + 300;
        const a = pj(X0, zs[k]);
        const b = pj(X1, zs[k]);
        const c = pj(X1, zs[k + 1]);
        const d = pj(X0, zs[k + 1]);
        if ((i + k) % 2 === 0) sq += `M${P(a[0], a[1])}L${P(b[0], b[1])}L${P(c[0], c[1])}L${P(d[0], d[1])}Z`;
        else {
          const cx = (a[0] + b[0] + c[0] + d[0]) / 4;
          const cy = (a[1] + c[1]) / 2;
          const rx = (Math.abs(b[0] - a[0] + c[0] - d[0]) / 4) * 0.66;
          const ry = (Math.abs(a[1] - c[1]) / 2) * 0.66;
          if (k % 2) ci += `M${P(cx - rx, cy)}a${n(rx)},${n(ry)} 0 1,0 ${n(2 * rx)},0a${n(rx)},${n(ry)} 0 1,0 ${n(-2 * rx)},0Z`;
          else ci2 += `M${P(cx - rx, cy)}a${n(rx)},${n(ry)} 0 1,0 ${n(2 * rx)},0a${n(rx)},${n(ry)} 0 1,0 ${n(-2 * rx)},0Z`;
        }
      }
    s.add(path(sq, '#c8c0b2', op(0.6)), path(ci, '#a8504a', op(0.85)), path(ci2, '#5f8a7a', op(0.85)));
  }
  // drum band
  {
    let top = `M-20,${n(corn(-20))}`;
    let bot = '';
    for (let x = -20; x <= 1620; x += 40) top += `L${P(x, corn(x))}`;
    for (let x = 1620; x >= -20; x -= 40) bot += `L${P(x, floorJ(x))}`;
    s.add(path(top + bot + 'Z', s.lg([[0, '#efe4d0'], [0.5, '#f6ecdc'], [1, '#e2d4bc']], 0, 0, 1, 0)));
    // attic band just below the cornice and the main entablature
    let att = `M-20,${n(corn(-20) + 10)}`;
    for (let x = -20; x <= 1620; x += 40) att += `L${P(x, corn(x) + 10)}`;
    s.add(stroke(att, '#c8b494', 14), stroke(att.replace(/,(-?\d+\.?\d*)/g, (_m, a) => ',' + n(+a + 70)), '#fff8ec', 10), stroke(att.replace(/,(-?\d+\.?\d*)/g, (_m, a) => ',' + n(+a + 78)), '#b8a07a', 3));
    // attic panels (porphyry / serpentine) between cornices
    let ap = '';
    let ap2 = '';
    for (let x = -60, i = 0; x < 1660; x += 120, i++) {
      const y0 = corn(x) + 26;
      const y1 = corn(x + 70) + 26;
      const q = `M${P(x, y0)}L${P(x + 70, y1)}V${n(y1 + 36)}L${P(x, y0 + 36)}Z`;
      if (i % 2) ap += q;
      else ap2 += q;
    }
    s.add(path(ap, '#9a4a3a', op(0.8)), path(ap2, '#4f7a6a', op(0.8)));
    // shading toward the sides of the drum
    s.add(path(top + bot + 'Z', s.lg([[0, '#5a4a3a', 0.35], [0.22, '#5a4a3a', 0], [0.78, '#5a4a3a', 0], [1, '#5a4a3a', 0.25]], 0, 0, 1, 0)));
  }
  // ---- aediculae and the great apse around the drum
  const cId = defColumn(s, '#fff4d0', '#e8cc88', '#a8803a', 'corinth', '#f6e6c0');
  const cId2 = defColumn(s, '#f6e8ec', '#d8c0c8', '#8a6a7a', 'corinth', '#f6e6c0');
  const aed = (x: number, kind: number) => {
    const t = corn(x) + 90;
    const b = floorJ(x);
    const h = b - t;
    const w = h * 0.62 * (1 - Math.min(0.6, Math.abs(x - 800) / 1400));
    let o = rect(x - w / 2, t + h * 0.18, w, h * 0.82, s.lg([[0, '#e8dcc6'], [1, '#d4c4a8']]));
    o += path(`M${P(x - w * 0.28, b)}V${n(t + h * 0.42)}a${n(w * 0.28)},${n(w * 0.28)} 0 0,1 ${n(w * 0.56)},0V${n(b)}Z`, s.lg([[0, '#8a7a62'], [1, '#c8b89c']]));
    o += person(x, b - h * 0.04, h * 0.5, '#ffffff', '#f6f0e4', { sash: '#e8e0d4' });
    o += col(kind ? cId : cId2, x - w * 0.42, b, h * 0.78, 0.9) + col(kind ? cId : cId2, x + w * 0.42, b, h * 0.78, 0.9);
    const py = b - h * 0.78 - 4;
    o += rect(x - w * 0.52, py - h * 0.06, w * 1.04, h * 0.06, '#fff8ec');
    o += kind ? path(`M${P(x - w * 0.54, py - h * 0.06)}L${P(x, py - h * 0.2)}L${P(x + w * 0.54, py - h * 0.06)}Z`, '#f6ecd8') : path(`M${P(x - w * 0.54, py - h * 0.06)}Q${P(x, py - h * 0.26)} ${P(x + w * 0.54, py - h * 0.06)}Z`, '#f6ecd8');
    return o;
  };
  s.add(aed(150, 1), aed(470, 0), aed(1130, 0), aed(1450, 1));
  // the great apse at the far side (centre)
  {
    const t = corn(800) + 20;
    const b = floorJ(800);
    s.add(path(`M640,${n(b)}V${n(t + 120)}A160,160 0 0,1 960,${n(t + 120)}V${n(b)}Z`, s.lg([[0, '#c89a4a'], [1, '#8a6a3a']])));
    s.add(path(`M664,${n(b)}V${n(t + 124)}A136,136 0 0,1 936,${n(t + 124)}V${n(b)}Z`, s.lg([[0, '#f6d27a'], [0.6, '#d8a83a'], [1, '#a87a2a']])));
    s.add(col(cId, 650, b, b - t - 60, 1.3), col(cId, 950, b, b - t - 60, 1.3));
  }
  // ---- the beam of light from the oculus, landing on the floor at lower left
  s.add(path(`M720,${R[0][0] + 30}L860,${R[0][0] + 40}L560,880L250,830Z`, s.lg([[0, '#fff8dc', 0.55], [1, '#fff8dc', 0.15]], 0.5, 0, 0.3, 1)));
  s.add(ell(410, 840, 200, 52, s.rgu([[0, '#fffbe8', 0.9], [0.6, '#fff4d0', 0.5], [1, '#fff4d0', 0]], 410, 840, 200, 0.26)));
  let motes = '';
  for (let i = 0; i < 50; i++) {
    const t = s.r.next();
    const x = 790 - t * 400 + s.rnd(-60, 60);
    const y = 100 + t * 740;
    motes += circ(x, y, s.rnd(1, 2.4));
  }
  s.add(path(motes, '#fffbe8', op(0.7)));
  // visitors in the light and around
  s.add(person(380, 846, 90, '#ffffff', '#c88a62', { sash: '#9a3a3a', hair: '#3a2416', arm: 4 }), person(450, 852, 84, '#e8c070', '#a86a48', { hair: '#2a1a10' }));
  s.add(person(1180, 820, 76, '#3f6a8a', '#c88a62', { hair: '#2a1a10' }), person(1240, 826, 70, '#f6f0e4', '#a86a48', { sash: '#d8a83a', hair: '#5a3a20' }));
  // bronze candelabra framing the lower edge
  for (const x of [80, 1520]) s.add(brazier(s, x, 900, 1.6, '#b8862a'), rect(x - 6, 790, 12, 110, '#8a6a2a'));
  vignette(s, '#3a3020', 0.3);
}

/** 19 · The Villa of Tibur — Hadrian's Canopus at dusk: long mirror pool, caryatids, curved colonnade, cypress gardens. */
function villaTibur(s: S): void {
  s.lit = -1;
  const { pj, quad, flat } = cam(800, 400, 800);
  const GY = 200; // ground
  const WY = 214; // water surface
  const PX = 420;
  const ZN = 430;
  const ZB = 2900;
  sky(s, [[0, '#4a4a90'], [0.22, '#8a76b4'], [0.42, '#e8a8a8'], [0.5, '#ffd0a0']]);
  // evening star + crescent
  s.add(`<circle cx="560" cy="90" r="3.4" fill="#fffbe8"/>`, `<circle cx="560" cy="90" r="40" fill="${s.rgu([[0, '#fffbe8', 0.4], [1, '#fffbe8', 0]], 560, 90, 40)}"/>`);
  s.add(`<path d="M1032,86a30,30 0 1,0 26,46a24,24 0 1,1 -26,-46z" fill="#fff4dc"/>`);
  let st = '';
  for (let i = 0; i < 40; i++) st += circ(s.rnd(0, W), s.rnd(0, 170), s.rnd(0.6, 1.5));
  s.add(path(st, '#fff4e0', op(0.7)));
  cloud(s, 300, 230, 460, 50, '#ffd8c8', '#9a7ab0', 0.85, 8);
  cloud(s, 1300, 250, 520, 46, '#ffd8c8', '#9a7ab0', 0.8, 8);
  birds(s, 820, 170, 4, 40, '#3a2a4a', 8);
  // distant Tiburtine hills
  s.add(hills(s, 380, 40, 4, '#8a7aa0'), hills(s, 404, 24, 6, '#6a7a7a'));
  haze(s, 300, 420, '#ffd8b8', 0, 0.5);
  // ---- garden ground and cypress avenues
  s.add(path(flat(-3000, 3000, GY, ZN - 100, 9000), s.lg([[0, '#8aa070'], [1, '#5a7a48']])));
  s.add(path(flat(-PX - 140, PX + 140, GY, ZN, ZB + 200), s.lg([[0, '#ece0cc'], [1, '#d8c8b0']])));
  // the Serapeum: half-dome grotto behind the far end
  {
    const [cx, cy] = pj(0, GY, ZB + 700);
    const sc = 800 / (ZB + 700);
    const r = 900 * sc;
    s.add(path(`M${P(cx - r, cy)}V${n(cy - r * 0.9)}A${n(r)},${n(r)} 0 0,1 ${P(cx + r, cy - r * 0.9)}V${n(cy)}Z`, s.lg([[0, '#f2e2cc'], [1, '#d8c0a4']])));
    s.add(path(`M${P(cx - r * 0.72, cy)}V${n(cy - r * 0.8)}A${n(r * 0.72)},${n(r * 0.72)} 0 0,1 ${P(cx + r * 0.72, cy - r * 0.8)}V${n(cy)}Z`, s.lg([[0, '#6a5a6a'], [1, '#9a7a7a']])));
    let ribs = '';
    for (let i = 1; i < 8; i++) {
      const a = Math.PI + (i / 8) * Math.PI;
      ribs += `M${P(cx, cy - r * 0.8)}L${P(cx + Math.cos(a) * r * 0.72, cy - r * 0.8 + Math.sin(a) * r * 0.72)}`;
    }
    s.add(stroke(ribs, '#c8a8a0', 3, op(0.6)));
    s.add(`<circle cx="${n(cx)}" cy="${n(cy - r * 0.4)}" r="${n(r * 0.6)}" fill="${s.rgu([[0, '#ffd890', 0.5], [1, '#ffd890', 0]], cx, cy - r * 0.4, r * 0.6)}"/>`);
    // cascade
    s.add(rect(cx - 10 * sc * 10, cy - r * 0.5, 20 * sc * 10, r * 0.5, s.lg([[0, '#e8f6f8'], [1, '#9ad0d8']]), op(0.8)));
  }
  // cypress avenues on both sides (tall, into the top strip)
  let cy2 = '';
  for (const k of [-1, 1])
    for (let Z = ZB + 400; Z >= 1000; Z -= 300) {
      const [x, y] = pj(k * (PX + 330), GY, Z);
      const sc = 800 / Z;
      cy2 += cypress(s, x, y, 1100 * sc, 170 * sc, '#2f4a3a', '#5a7a5a');
    }
  s.add(cy2);
  haze(s, 260, 460, '#ffd8c0', 0, 0.25);
  // ---- curved colonnade at the far end: alternating arches and flat lintels
  const cId = defColumn(s, '#ffffff', '#f0e6da', '#b8a8b0', 'corinth', '#f6eee0');
  const reflect: string[] = [];
  {
    const RZ = ZB + 50;
    let entab = '';
    let cs = '';
    const pts2: Pt[] = [];
    for (let i = 0; i <= 10; i++) {
      const th = (i / 10) * Math.PI;
      const X = -Math.cos(th) * PX;
      const Z = RZ + Math.sin(th) * 360;
      const [x, y] = pj(X, GY, Z);
      const top = pj(X, GY - 560, Z)[1];
      cs += col(cId, x, y, y - top, 1.1);
      pts2.push([x, top]);
    }
    for (let i = 0; i < pts2.length - 1; i++) {
      const [x0, y0] = pts2[i];
      const [x1, y1] = pts2[i + 1];
      if (i % 2) entab += `M${P(x0, y0)}Q${P((x0 + x1) / 2, Math.min(y0, y1) - 26)} ${P(x1, y1)}`;
      else entab += `M${P(x0, y0)}L${P(x1, y1)}`;
    }
    const g0 = cs + stroke(entab, '#fff8ec', 8, 'stroke-linecap="round"') + stroke(entab, '#c8b0a8', 2, op(0.6));
    s.add(g0);
    reflect.push(g0);
    // statues on top of the colonnade
    let tops = '';
    for (let i = 1; i < pts2.length - 1; i += 2) tops += person(pts2[i][0], pts2[i][1] - 10, 30, '#ffffff', '#f6f0e4');
    s.add(tops);
  }
  // ---- the pool (mirror) — clip region for reflections
  const poolD = quad(pj(-PX, WY, ZN), pj(PX, WY, ZN), pj(PX, WY, ZB), pj(-PX, WY, ZB));
  const clipId = s.uid();
  s.def(`<clipPath id="${clipId}"><path d="${poolD}"/></clipPath>`);
  s.add(path(poolD, s.lg([[0, '#f2c0a8'], [0.3, '#b898c0'], [1, '#4a5a8a']])));
  // ---- caryatids (left) and columns with statues (right) along the pool edge
  let left = '';
  let right = '';
  const entL: Pt[] = [];
  for (let Z = ZB - 150; Z >= 700; Z -= 300) {
    const [x, y] = pj(-PX - 50, GY, Z);
    const sc = 800 / Z;
    left += caryatid(x, y, 470 * sc, '#fffaf0', '#b8a8b0');
    entL.push([x, y - 470 * sc]);
    const [rx, ry] = pj(PX + 50, GY, Z);
    right += col(cId, rx, ry, 470 * sc, 1);
  }
  const ent = (side: number) => {
    const a = pj(side * (PX + 50), GY - 470, ZB - 150);
    const b = pj(side * (PX + 50), GY - 470, 700);
    const a2 = pj(side * (PX + 50), GY - 505, ZB - 150);
    const b2 = pj(side * (PX + 50), GY - 505, 700);
    return path(`M${P(a[0], a[1])}L${P(b[0], b[1])}L${P(b2[0], b2[1])}L${P(a2[0], a2[1])}Z`, '#fbf4e8');
  };
  const LG = left + ent(-1);
  const RG = right + ent(1);
  s.add(LG, RG);
  reflect.push(LG, RG);
  // reflections inside the pool
  s.add(`<g clip-path="url(#${clipId})" opacity=".35">${reflect.map((r) => `<g transform="translate(0 ${n(2 * pj(0, WY, 1600)[1])}) scale(1 -1)">${r}</g>`).join('')}</g>`);
  s.add(path(poolD, s.lg([[0, '#ffffff', 0.25], [0.5, '#ffffff', 0]])));
  s.add(glints(s, 560, 1040, 470, 760, 40, '#fff4e8', 0.6, 22));
  // ---- foreground: marble coping, the crocodile statue, lemon trees and roses
  s.add(path(`M${P(...pj(-PX - 140, GY, ZN))}L${P(...pj(PX + 140, GY, ZN))}L1700,900H-100Z`, s.lg([[0, '#f6ecdc'], [1, '#d8c8b0']])));
  s.add(stroke(`M${P(...pj(-PX, GY, ZN))}L${P(...pj(PX, GY, ZN))}`, '#ffffff', 6));
  // crocodile (green-grey marble) lying on the coping — bottom centre
  {
    const x = 800;
    const y = 862;
    s.add(ell(x, y + 8, 230, 16, '#6a5a4a', op(0.2)));
    s.add(rect(x - 160, y - 20, 320, 26, s.lg([[0, '#f6ecdc'], [1, '#c8b8a0']])));
    s.add(path(`M${P(x - 210, y - 22)}Q${P(x - 160, y - 34)} ${P(x - 110, y - 40)}L${P(x + 60, y - 44)}Q${P(x + 120, y - 40)} ${P(x + 150, y - 30)}L${P(x + 220, y - 26)}Q${P(x + 230, y - 22)} ${P(x + 220, y - 18)}L${P(x + 140, y - 18)}L${P(x - 110, y - 18)}Q${P(x - 170, y - 18)} ${P(x - 210, y - 22)}Z`, s.lg([[0, '#9ab0a0'], [1, '#5a7a6a']])));
    let sc2 = '';
    for (let i = 0; i < 12; i++) sc2 += `M${P(x - 90 + i * 16, y - 42)}l6,-6l6,6`;
    s.add(stroke(sc2, '#4a6a5a', 2.5), stroke(`M${P(x + 150, y - 24)}h66`, '#3a5a4a', 1.5), `<circle cx="${n(x + 160)}" cy="${n(y - 34)}" r="3" fill="#2a3a30"/>`);
    s.add(stroke(`M${P(x - 70, y - 20)}l-14,14M${P(x + 70, y - 22)}l-12,14M${P(x - 20, y - 20)}l10,12M${P(x + 110, y - 22)}l10,12`, '#5a7a6a', 7, 'stroke-linecap="round"'));
  }
  const lemon = (x: number, base: number, sc: number) => {
    let o = path(`M${P(x - 50 * sc, base)}l${n(-10 * sc)},${n(-80 * sc)}h${n(120 * sc)}l${n(-10 * sc)},${n(80 * sc)}z`, s.lg([[0, '#e0906a'], [1, '#9a4a32']], 0, 0, 1, 0));
    o += rect(x - 64 * sc, base - 90 * sc, 128 * sc, 14 * sc, '#c8704a');
    o += path(`M${P(x - 8 * sc, base - 86 * sc)}L${P(x - 6 * sc, base - 200 * sc)}h${n(12 * sc)}L${P(x + 8 * sc, base - 86 * sc)}z`, '#6a4a32');
    let dk = '';
    let lt = '';
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const bx = x + Math.cos(a) * 70 * sc;
      const by = base - 250 * sc + Math.sin(a) * 50 * sc;
      dk += circ(bx, by, 48 * sc);
      lt += circ(bx + 10 * sc, by - 14 * sc, 30 * sc);
    }
    dk += circ(x, base - 250 * sc, 70 * sc);
    o += path(dk, '#3f6a3a') + path(lt, '#6a9a52', op(0.85));
    let fr = '';
    for (let i = 0; i < 14; i++) fr += circ(x + s.rnd(-80, 80) * sc, base - s.rnd(180, 300) * sc, 7 * sc);
    return o + path(fr, '#f6d040');
  };
  s.add(lemon(150, 900, 1.4), lemon(1450, 900, 1.4));
  let roses = '';
  for (let i = 0; i < 40; i++) {
    const x = i < 20 ? s.rnd(260, 520) : s.rnd(1080, 1340);
    roses += circ(x, s.rnd(800, 900), s.rnd(4, 8));
  }
  s.add(path('M240,900Q300,780 540,800L560,900ZM1360,900Q1300,780 1060,800L1040,900Z', '#4f7a42'), path(roses, '#f08aa0'));
  vignette(s, '#2a2040', 0.3);
}

/** 21 · The Golden House — Nero's octagonal hall: gilded frescoed walls, cascade nymphaeum, starry rotating vault. */
function goldenHouse(s: S): void {
  s.lit = 1;
  const { pj, quad } = cam(800, 560, 800);
  const FY = 300;
  const TY = -620;
  const RO = 1300;
  const Z0 = 1500;
  // octagon vertices (angles in the XZ plane)
  const V: Pt[] = [];
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + (k * Math.PI) / 4;
    V.push([Math.cos(a) * RO, Z0 + Math.sin(a) * RO]);
  }
  s.add(rect(0, 0, W, H, '#1a1e4a'));
  // ---- vault: deep blue sectors with gold stars and ribs converging on the sun
  const apex = pj(0, -1500, Z0);
  let ribs = '';
  for (let k = 0; k < 8; k++) {
    const [X, Z] = V[k];
    if (Z < 260) continue;
    const t = pj(X, TY, Z);
    ribs += `M${P(t[0], t[1])}L${P(apex[0], apex[1])}`;
  }
  s.add(rect(0, 0, W, 520, s.lg([[0, '#141a50'], [1, '#2a3a8a']])));
  let st = '';
  for (let i = 0; i < 90; i++) st += starPath5(s.rnd(0, W), s.rnd(0, 470), s.rnd(3, 7));
  s.add(path(st, '#f2c64a', op(0.85)));
  // zodiac ring and the radiant sun at the crown
  s.add(`<ellipse cx="${n(apex[0])}" cy="${n(apex[1])}" rx="760" ry="420" fill="none" stroke="#e8b034" stroke-width="22"/>`, `<ellipse cx="${n(apex[0])}" cy="${n(apex[1])}" rx="760" ry="420" fill="none" stroke="#fff0a8" stroke-width="3"/>`);
  let med = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.2;
    const x = apex[0] + Math.cos(a) * 760;
    const y = apex[1] + Math.sin(a) * 420;
    if (y < -20) continue;
    med += `<circle cx="${n(x)}" cy="${n(y)}" r="26" fill="#1e2a6a" stroke="#f2c64a" stroke-width="5"/>` + `<path d="${starPath5(x, y, 13)}" fill="#f2c64a"/>`;
  }
  s.add(med);
  let rays = '';
  for (let i = 0; i < 24; i++) {
    const a = Math.PI * 0.05 + (i / 23) * Math.PI * 0.9;
    rays += `M${P(apex[0] + Math.cos(a - 0.02) * 300, apex[1] + Math.sin(a - 0.02) * 300)}L${P(apex[0] + Math.cos(a) * 560, apex[1] + Math.sin(a) * 560)}L${P(apex[0] + Math.cos(a + 0.02) * 300, apex[1] + Math.sin(a + 0.02) * 300)}Z`;
  }
  s.add(path(rays, '#f2c64a', op(0.55)));
  s.add(`<circle cx="${n(apex[0])}" cy="${n(apex[1])}" r="330" fill="${s.rgu([[0, '#fff0a8', 0.95], [0.4, '#f2c64a', 0.8], [0.62, '#e8b034', 0.4], [1, '#e8b034', 0]], apex[0], apex[1], 330)}"/>`);
  s.add(stroke(ribs, '#e8b034', 10), stroke(ribs, '#fff0a8', 2.5));
  // ---- floor: polished marble with a central golden star
  {
    s.add(rect(0, 560, W, 340, s.lg([[0, '#f2e6cc'], [1, '#d8c4a0']])));
    let rings = '';
    for (let r = 300; r <= 1300; r += 250) {
      const c = pj(0, FY, Z0);
      const near = pj(0, FY, Z0 - r * 0.9);
      const far = pj(0, FY, Z0 + r);
      const rx = (r * 800) / Z0;
      rings += `M${P(c[0] - rx, (near[1] + far[1]) / 2)}a${n(rx)},${n((near[1] - far[1]) / 2)} 0 1,0 ${n(2 * rx)},0a${n(rx)},${n((near[1] - far[1]) / 2)} 0 1,0 ${n(-2 * rx)},0Z`;
    }
    s.add(path(rings, 'none', 'stroke="#c8902e" stroke-width="5" opacity=".6"'));
    const c = pj(0, FY, Z0);
    s.add(`<g transform="translate(${n(c[0])} ${n(c[1])}) scale(1 0.3)"><path d="${starPath8(0, 0, 300, 120)}" fill="#a8282a" opacity=".85"/><path d="${starPath8(0, 0, 210, 84)}" fill="#e8b034"/><circle r="40" fill="#1e2a6a"/></g>`);
  }
  // ---- walls: the far five faces of the octagon
  const faceOrder = [0, 7, 1, 6, 2, 5, 3, 4]
    .map((k) => [k, (k + 1) % 8] as [number, number])
    .filter(([a, b]) => V[a][1] + V[b][1] > 900)
    .sort((p, q) => V[q[0]][1] + V[q[1]][1] - (V[p[0]][1] + V[p[1]][1]));
  const nymph = s.uid();
  for (const [a, b] of faceOrder) {
    const [Xa, Za] = V[a];
    const [Xb, Zb] = V[b];
    const zClip = (z: number) => Math.max(z, 240);
    const A = pj(Xa, TY, zClip(Za));
    const B = pj(Xb, TY, zClip(Zb));
    const C = pj(Xb, FY, zClip(Zb));
    const D = pj(Xa, FY, zClip(Za));
    const midX = (Xa + Xb) / 2;
    const back = Math.abs(midX) < 10;
    const lum = back ? 0 : Math.abs(midX) / RO;
    s.add(path(quad(A, B, C, D), s.lgu([[0, '#f2c64a'], [0.5, '#e8b034'], [1, '#b8862a']], A[0], A[1], C[0], C[1])));
    // fresco panels: red field, gold frame, painted candelabrum
    const lerp = (p: Pt, q: Pt, t: number): Pt => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    const at = (u: number, v: number) => {
      // u along the face 0..1, v height 0 (top) .. 1 (floor)
      const top = lerp(A, B, u);
      const bot = lerp(D, C, u);
      return lerp(top, bot, v);
    };
    const panel = (u0: number, u1: number, v0: number, v1: number) => quad(at(u0, v0), at(u1, v0), at(u1, v1), at(u0, v1));
    if (back) {
      // the nymphaeum opening: an arch onto a glowing cascade
      const q0 = at(0.2, 0.18);
      const q1 = at(0.8, 1);
      const p0: Pt = [Math.min(q0[0], q1[0]), q0[1]];
      const p1: Pt = [Math.max(q0[0], q1[0]), q1[1]];
      const r = (p1[0] - p0[0]) / 2;
      const arch = `M${P(p0[0], p1[1])}V${n(p0[1] + r)}A${n(r)},${n(r)} 0 0,1 ${P(p1[0], p0[1] + r)}V${n(p1[1])}Z`;
      s.def(`<clipPath id="${nymph}"><path d="${arch}"/></clipPath>`);
      let casc = rect(p0[0], p0[1], p1[0] - p0[0], p1[1] - p0[1], s.lg([[0, '#bff0e8'], [1, '#2a9aa0']]));
      for (let i = 0; i < 7; i++) {
        const y = p0[1] + r * 0.6 + i * ((p1[1] - p0[1] - r * 0.6) / 7);
        casc += rect(p0[0], y, p1[0] - p0[0], 6, '#ffffff', op(0.7)) + rect(p0[0] + (i % 2) * 10, y + 8, p1[0] - p0[0], 3, '#e8fffa', op(0.5));
      }
      casc += rect((p0[0] + p1[0]) / 2 - 20, p0[1], 40, p1[1] - p0[1], s.lg([[0, '#ffffff', 0.9], [1, '#ffffff', 0.3]]));
      s.add(`<g clip-path="url(#${nymph})">${casc}</g>`, stroke(arch.replace('Z', ''), '#fff0a8', 6));
      s.add(`<circle cx="${n((p0[0] + p1[0]) / 2)}" cy="${n((p0[1] + p1[1]) / 2)}" r="${n(r * 1.8)}" fill="${s.rgu([[0, '#bff0e8', 0.4], [1, '#bff0e8', 0]], (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, r * 1.8)}"/>`);
      s.add(path(panel(0.03, 0.15, 0.1, 0.9), '#a8282a'), path(panel(0.85, 0.97, 0.1, 0.9), '#a8282a'));
    } else {
      s.add(path(panel(0.08, 0.92, 0.08, 0.62), '#a8282a'), path(panel(0.08, 0.92, 0.68, 0.94), '#1e2a6a'));
      s.add(path(panel(0.12, 0.88, 0.12, 0.58), 'none', `stroke="#f2c64a" stroke-width="${n(3 - lum)}"`));
      // painted architecture: thin candelabra and a garland medallion
      const c0 = at(0.5, 0.14);
      const c1 = at(0.5, 0.56);
      const mid = at(0.5, 0.3);
      const fw = Math.abs(at(0.9, 0.3)[0] - at(0.1, 0.3)[0]);
      s.add(stroke(`M${P(c0[0], c0[1])}L${P(c1[0], c1[1])}M${P(mid[0] - fw * 0.16, mid[1])}h${n(fw * 0.32)}`, '#f6d27a', 2.2), `<circle cx="${n(mid[0])}" cy="${n(mid[1] - fw * 0.08)}" r="${n(fw * 0.07)}" fill="none" stroke="#7ab060" stroke-width="2.5"/>`);
      const sw = at(0.3, 0.42);
      s.add(person(sw[0], sw[1] + fw * 0.12, fw * 0.24, '#f6e6c0', '#e8c8a0', { arm: 3 }), person(at(0.7, 0.42)[0], sw[1] + fw * 0.12, fw * 0.24, '#7ab0c0', '#e8c8a0', { arm: 2, dir: -1 }));
      // shade the oblique faces toward the sides
      s.add(path(quad(A, B, C, D), '#3a1a0a', op(0.12 + lum * 0.2)));
    }
    // gilded pilasters on the corners
    s.add(path(quad(pj(Xa, TY, zClip(Za)), pj(Xa * 0.97, TY, zClip(Za) - 20), pj(Xa * 0.97, FY, zClip(Za) - 20), pj(Xa, FY, zClip(Za))), '#fff0a8'));
  }
  // cornice at the springing of the vault
  let cn = '';
  for (let k = 0; k < 8; k++) {
    const [Xa, Za] = V[k];
    const [Xb, Zb] = V[(k + 1) % 8];
    if (Za + Zb < 700) continue;
    cn += `M${P(...pj(Xa, TY, Math.max(Za, 240)))}L${P(...pj(Xb, TY, Math.max(Zb, 240)))}`;
  }
  s.add(stroke(cn, '#fff0a8', 12), stroke(cn, '#a8762a', 3));
  // ---- foreground luxury: gilded tripods, silk cushions, fruit, a peacock
  s.add(brazier(s, 160, 900, 2, '#e8b034'), brazier(s, 1440, 900, 2, '#e8b034'));
  s.add(rect(-20, 870, W + 40, 30, s.lg([[0, '#000', 0], [1, '#3a1a0a', 0.3]])));
  // low table with fruit at bottom centre
  {
    const x = 800;
    const y = 880;
    s.add(ell(x, y + 14, 220, 18, '#3a1a0a', op(0.3)), path(`M${P(x - 200, y - 30)}h400l-20,18h-360z`, s.lg([[0, '#fff0a8'], [1, '#b8862a']])), stroke(`M${P(x - 160, y - 12)}l-10,40M${P(x + 160, y - 12)}l10,40`, '#b8862a', 8));
    s.add(ell(x, y - 44, 90, 22, s.lg([[0, '#fff0a8'], [1, '#a8762a']])));
    let gr = '';
    for (let i = 0; i < 12; i++) gr += circ(x - 50 + (i % 6) * 14, y - 56 - Math.floor(i / 6) * 12, 8);
    s.add(path(gr, '#6a2a7a'), ell(x + 40, y - 60, 16, 16, '#e8702a'), ell(x + 66, y - 54, 14, 14, '#d8402a'), ell(x - 74, y - 54, 13, 13, '#9ac04a'));
  }
  s.add(peacock(s, 1220, 880, 120, -1));
  // rose petals falling from the vault (Nero's famous ceiling)
  let pet = '';
  for (let i = 0; i < 60; i++) {
    const x = s.rnd(0, W);
    const y = s.rnd(80, 880);
    const r = s.rnd(3, 6);
    pet += `M${P(x - r, y)}q${n(r)},${n(-r)} ${n(2 * r)},0q${n(-r)},${n(r * 0.8)} ${n(-2 * r)},0z`;
  }
  s.add(path(pet, '#f08aa0', op(0.85)));
  vignette(s, '#2a1408', 0.32);
}

/** 22 · The Sanctum of Victory — Victoria's white-and-gold apse, winged statue, laurel, high celestial light. */
function sanctumVictory(s: S): void {
  s.lit = 1;
  sky(s, [[0, '#cfe2f6'], [0.35, '#eef2f8'], [0.6, '#fff6e2'], [1, '#f6ead2']]);
  // celestial clouds beyond the open clerestory
  cloud(s, 200, 180, 420, 70, '#ffffff', '#d8e0f0', 0.9, 7);
  cloud(s, 1400, 150, 420, 70, '#ffffff', '#d8e0f0', 0.9, 7);
  // ---- the apse with its gold-mosaic half-dome
  const AX = 800;
  const AR = 430;
  const SPRING = 340;
  const BASE = 640;
  s.add(path(`M${AX - AR - 60},${BASE}V${SPRING}A${AR + 60},${AR + 60} 0 0,1 ${AX + AR + 60},${SPRING}V${BASE}Z`, s.lg([[0, '#ffffff'], [1, '#efe6d4']])));
  const tess = s.uid();
  s.def(`<pattern id="${tess}" patternUnits="userSpaceOnUse" width="12" height="12">${rect(0, 0, 12, 12, '#e8b034')}${rect(1, 1, 5, 5, '#f6d27a')}${rect(7, 7, 4, 4, '#d8a02a')}${rect(7, 1, 4, 5, '#f2c64a')}</pattern>`);
  const dome = `M${AX - AR},${SPRING}A${AR},${AR} 0 0,1 ${AX + AR},${SPRING}Z`;
  s.add(path(dome, `url(#${tess})`), path(dome, s.rgu([[0, '#fff8d8', 0.75], [0.55, '#fff0b0', 0.2], [1, '#8a5a10', 0.45]], AX, SPRING + 60, AR + 40)));
  // radiating ribs and stars in the mosaic
  let rib = '';
  for (let i = 1; i < 12; i++) {
    const a = Math.PI + (i / 12) * Math.PI;
    rib += `M${P(AX + Math.cos(a) * 140, SPRING + Math.sin(a) * 140)}L${P(AX + Math.cos(a) * AR, SPRING + Math.sin(a) * AR)}`;
  }
  s.add(stroke(rib, '#fff8e0', 3, op(0.7)));
  let st = '';
  for (let i = 0; i < 26; i++) {
    const a = Math.PI + s.rnd(0.08, 0.92) * Math.PI;
    const r = s.rnd(170, AR - 30);
    st += starPath5(AX + Math.cos(a) * r, SPRING + Math.sin(a) * r, s.rnd(5, 10));
  }
  s.add(path(st, '#ffffff', op(0.85)));
  s.add(stroke(`M${AX - AR},${SPRING}A${AR},${AR} 0 0,1 ${AX + AR},${SPRING}`, '#ffffff', 16), stroke(`M${AX - AR - 10},${SPRING}A${AR + 10},${AR + 10} 0 0,1 ${AX + AR + 10},${SPRING}`, '#c8902e', 3));
  // laurel garland along the arch
  {
    let d = '';
    for (let i = 0; i < 34; i++) {
      const a = Math.PI + ((i + 0.5) / 34) * Math.PI;
      const x = AX + Math.cos(a) * (AR + 30);
      const y = SPRING + Math.sin(a) * (AR + 30);
      const ang = a + Math.PI / 2;
      const c = Math.cos(ang);
      const sn = Math.sin(ang);
      const Q = (u: number, v: number) => P(x + u * c - v * sn, y + u * sn + v * c);
      d += `M${Q(-12, 0)}Q${Q(0, -7)} ${Q(12, 0)}Q${Q(0, 7)} ${Q(-12, 0)}Z`;
    }
    s.add(path(d, '#5a9a4a'));
  }
  // apse wall: colonnade of white columns with gilded capitals
  const cId = defColumn(s, '#ffffff', '#f2ece2', '#c0b8b0', 'corinth', '#f2c64a');
  let ac = '';
  for (let i = 0; i < 7; i++) {
    const x = AX - AR + 40 + (i * (2 * AR - 80)) / 6;
    ac += col(cId, x, BASE, BASE - SPRING - 6, 1.2);
  }
  s.add(rect(AX - AR - 60, SPRING - 6, 2 * AR + 120, 16, '#ffffff'), rect(AX - AR - 60, SPRING + 10, 2 * AR + 120, 4, '#e8b034'));
  s.add(rect(AX - AR, SPRING + 14, 2 * AR, BASE - SPRING - 14, s.lg([[0, '#e8dccc'], [1, '#f6efe2']])), ac);
  // ---- celestial light from above
  s.add(`<circle cx="${AX}" cy="200" r="520" fill="${s.rgu([[0, '#ffffff', 0.9], [0.3, '#fff6d0', 0.5], [1, '#fff6d0', 0]], AX, 200, 520)}"/>`);
  let sh = '';
  for (const [x0, x1, x2, x3] of [[620, 700, 760, 560], [760, 840, 900, 700], [900, 980, 1060, 860]] as [number, number, number, number][]) sh += `M${x0},0L${x1},0L${x2},${BASE + 120}L${x3},${BASE + 120}Z`;
  s.add(path(sh, s.lg([[0, '#ffffff', 0.5], [1, '#fff8e0', 0.05]])));
  // ---- Victoria on her globe and pedestal
  s.add(rect(AX - 70, 420, 140, 220, s.lg([[0, '#ffffff'], [0.5, '#f2ece2'], [1, '#c8beb0']], 0, 0, 1, 0)), rect(AX - 84, 408, 168, 18, '#ffffff'), rect(AX - 84, 620, 168, 20, '#ffffff'));
  s.add(rect(AX - 50, 470, 100, 100, 'none', 'stroke="#e8b034" stroke-width="3"'), `<circle cx="${AX}" cy="520" r="26" fill="none" stroke="#5a9a4a" stroke-width="6"/>`);
  s.add(`<circle cx="${AX}" cy="372" r="40" fill="${s.lg([[0, '#fff0a8'], [0.5, '#e8b034'], [1, '#8a5a10']], 0, 0, 1, 1)}"/>`, stroke(`M${AX - 40},372a40,12 0 0,0 80,0`, '#fff0a8', 2));
  s.add(victoryStatue(s, AX, 334, 200, '#f2c64a', '#9a6a14'));
  // ---- great foreground columns with garlands and crimson laurel banners
  const bigC = defColumn(s, '#ffffff', '#f0eae0', '#b8b0a8', 'corinth', '#f2c64a');
  s.add(col(bigC, 130, 900, 1000, 1.9), col(bigC, 1470, 900, 1000, 1.9));
  s.add(rect(0, 0, W, 34, '#ffffff'), rect(0, 34, W, 8, '#e8b034'), rect(0, 42, W, 4, '#c8b8a0'));
  s.add(garlands([0, 260, 520, 800, 1080, 1340, 1600], 44, 30, '#4f8a3e', '#b8e07a', 8));
  const laurelB = (x: number) => hangingBanner(s, x, 60, 90, 300, '#a8242a', '#f2c64a', `<g transform="translate(${n(x + 45)} 180)">${path(laurelRing(0, 0, 26, 12, 7), '#f2c64a')}</g>`);
  s.add(laurelB(260), laurelB(1250));
  // ---- floor: steps up to the apse, white marble with a laurel inlay
  s.add(rect(0, BASE, W, H - BASE, s.lg([[0, '#f6f0e6'], [1, '#e2d6c2']])));
  for (let i = 0; i < 4; i++) s.add(rect(AX - AR - 120 - i * 60, BASE + i * 18, 2 * AR + 240 + i * 120, 18, i % 2 ? '#f2ebe0' : '#fbf7f0'), rect(AX - AR - 120 - i * 60, BASE + i * 18, 2 * AR + 240 + i * 120, 3, '#ffffff'));
  let pv = '';
  for (let i = -12; i <= 12; i++) pv += `M${n(800 + i * 60)},712L${n(800 + i * 150)},900`;
  for (let j = 0; j < 6; j++) pv += `M0,${n(730 + j * j * 6 + j * 14)}H1600`;
  s.add(stroke(pv, '#c8bca8', 1.2, op(0.45)));
  s.add(`<g transform="translate(800 832) scale(1 0.34)">${path(laurelRing(0, 0, 170, 30, 16), '#5a9a4a')}<circle r="148" fill="none" stroke="#e8b034" stroke-width="10"/><path d="${starPath8(0, 0, 90, 36)}" fill="#e8b034"/></g>`);
  // golden braziers
  s.add(brazier(s, 420, 860, 1.4, '#e8b034'), brazier(s, 1180, 860, 1.4, '#e8b034'));
  // drifting golden laurel leaves and crimson petals
  let lv = '';
  let pt = '';
  for (let i = 0; i < 60; i++) {
    const x = s.rnd(0, W);
    const y = s.rnd(60, 880);
    const a = s.rnd(0, Math.PI);
    const L = s.rnd(8, 16);
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const Q = (u: number, v: number) => P(x + u * c - v * sn, y + u * sn + v * c);
    if (i % 3) lv += `M${Q(-L, 0)}Q${Q(0, -L * 0.45)} ${Q(L, 0)}Q${Q(0, L * 0.45)} ${Q(-L, 0)}Z`;
    else pt += `M${Q(-L * 0.6, 0)}q${n(L * 0.6)},${n(-L * 0.6)} ${n(L * 1.2)},0q${n(-L * 0.6)},${n(L * 0.5)} ${n(-L * 1.2)},0z`;
  }
  s.add(path(lv, '#e8b034', op(0.85)), path(pt, '#c8323a', op(0.7)));
  birds(s, 520, 250, 3, 40, '#ffffff', 12);
  birds(s, 1080, 230, 3, 40, '#ffffff', 12);
  vignette(s, '#8a6a3a', 0.22);
}

// ==== NEW-SCENES-END

/**
 * Canonical order of the 24 arenas (prestige rises with index). Legacy scene i
 * of the original twelve sits at 2i (the Eternal Throne at 23); each entry
 * carries the RNG slot it is drawn with so legacy artwork stays byte-stable.
 */
const SCENES: [(s: S) => void, number][] = [
  [dustPits, 0], [ludusYard, 101], [legionCamp, 1], [rhineFrontier, 103],
  [ironCitadel, 2], [harbourOstia, 105], [gladiatorsCourt, 3], [aqueductHeights, 107],
  [forumOfTriumph, 4], [imperialBaths, 109], [praetorianBastion, 5], [circusMaximus, 111],
  [senateHall, 6], [greatLibrary, 113], [consularPalace, 7], [capitolineTemple, 115],
  [grandColosseum, 8], [pantheon, 117], [imperialPalace, 9], [villaTibur, 119],
  [hallOfCaesars, 10], [goldenHouse, 121], [sanctumVictory, 122], [eternalThrone, 11],
];

/** Number of arenas with a backdrop. */
export const ARENA_ART_COUNT = SCENES.length;

/** Full-bleed arena backdrop SVG for arena 0..23 (input clamped). */
export function arenaBackdropSvg(arenaIndex: number): string {
  const i = Math.max(0, Math.min(SCENES.length - 1, Math.floor(Number.isFinite(arenaIndex) ? arenaIndex : 0)));
  const [scene, seed] = SCENES[i];
  const s = new S(i, seed);
  scene(s);
  return s.svg();
}
