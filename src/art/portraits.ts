/**
 * Procedural bust portraits (viewBox 0 0 120 120) on an arena-tinted medallion.
 *
 * Style: clean vector shapes, soft gradient shading (key light from the upper
 * left), a cool rim light on the right edge and tinted (never black) outlines.
 *
 * Identity (face, skin, hair, expression) comes from the seed alone, so a
 * competitor keeps the same face for life; age only adds grey hair, lines and
 * baldness. Headgear and clothing are drawn from (seed, arena), so they change
 * when the competitor climbs to a new arena but are stable within one.
 */
import { ARENAS } from '../world/arenas';
import { createRng, mixSeed, type Rng } from '../core/rng';
import { leafPath, mix, n as n1, shade } from './svgUtil';

/** Compact number: 1 decimal, no leading zero. */
function n(v: number): string {
  const s = n1(v);
  return s.charCodeAt(0) === 48 && s.length > 1 ? s.slice(1) : s.charCodeAt(0) === 45 && s.charCodeAt(1) === 48 && s.length > 2 ? '-' + s.slice(2) : s;
}

export type PortraitOptions = { female: boolean; age: number; arenaIndex: number };

// very light .. very dark, roughly even steps in lightness
const SKIN = ['#fde7d8', '#f7d6bf', '#f0c6a5', '#e6b48c', '#d9a179', '#c98f66', '#b97c52', '#a26843', '#8a5535', '#71432a', '#5a3321', '#432518'];
const HAIR = ['#17110e', '#2a1c15', '#3e281b', '#573823', '#734629', '#8f4424', '#b05a2a', '#9b7a4c', '#c9a463', '#e2cb92'];
const EYES = ['#3a2416', '#563620', '#76552a', '#4e6a38', '#3f73a6', '#62737f', '#8f6328'];
const W = '#fff';

type Pt = [number, number];
const P = (x: number, y: number) => n(x) + ',' + n(y);

function pickW<T>(u: number, items: readonly T[], weights: readonly number[]): T {
  let t = 0;
  for (const w of weights) t += w;
  let x = u * t;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x < 0) return items[i];
  }
  return items[items.length - 1];
}

/** Catmull-Rom spline through points as cubic Béziers (closed or open); `int` rounds to whole units. */
function spline(p: Pt[], closed: boolean, int = false): string {
  const m = p.length;
  const F = int ? (x: number, y: number) => Math.round(x) + ',' + Math.round(y) : P;
  const at = (i: number) => (closed ? p[(i + m) % m] : p[Math.max(0, Math.min(m - 1, i))]);
  let d = 'M' + F(p[0][0], p[0][1]);
  const last = closed ? m : m - 1;
  for (let i = 0; i < last; i++) {
    const a = at(i - 1), b = at(i), c = at(i + 1), e = at(i + 2);
    // Catmull-Rom joints are C1-smooth, so every segment after the first can use the S shorthand
    d += (i ? 'S' : 'C' + F(b[0] + (c[0] - a[0]) / 6, b[1] + (c[1] - a[1]) / 6) + ' ') + F(c[0] - (e[0] - b[0]) / 6, c[1] - (e[1] - b[1]) / 6) + ' ' + F(c[0], c[1]);
  }
  return closed ? d + 'Z' : d;
}

/** Mirror right-side points (x relative to centre) into a full symmetric loop. */
function sym(cx: number, top: number, right: Pt[], bottom: number): Pt[] {
  const R = right.map(([x, y]) => [cx + x, y] as Pt);
  const L = right.map(([x, y]) => [cx - x, y] as Pt).reverse();
  return [[cx, top], ...R, [cx, bottom], ...L];
}

const path = (d: string, fill: string, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;
const stroke = (d: string, col: string, w: number, extra = '') => `<path d="${d}" stroke="${col}"${w === 1.1 ? '' : ` stroke-width="${n(w)}"`}${extra}/>`;
const op = (o: number) => ` opacity="${n(o)}"`;
const ell = (x: number, y: number, rx: number, ry: number) => `M${P(x - rx, y)}a${n(rx)},${n(ry)} 0 1 0 ${n(2 * rx)},0a${n(rx)},${n(ry)} 0 1 0 ${n(-2 * rx)},0`;
const circ = (x: number, y: number, r: number, fill: string, extra = '') => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${fill}"${extra}/>`;
const lin = (id: string, a: string, b: string, c: string, x2 = 0, y2 = 1, m = 0.5) =>
  `<linearGradient id="${id}" x2="${n(x2)}" y2="${n(y2)}"><stop stop-color="${a}"/><stop offset="${n(m)}" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>`;

const lin2 = (id: string, a: string, b: string, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x2="${n(x2)}" y2="${n(y2)}"><stop stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;

type Gear = 'none' | 'cap' | 'galea' | 'glad' | 'laurel' | 'diadem' | 'imperial';
type Cloth = 'tunic' | 'segm' | 'muscle' | 'toga' | 'palla' | 'stola' | 'glad';
type Mouth = 'neutral' | 'soft' | 'smile' | 'grin' | 'smirk' | 'stern' | 'laugh' | 'grit';
type Expr = { bi: number; bo: number; arch: number; lid: number; sq: number; m: Mouth; asym?: number };

const EXPRS: Expr[] = [
  { bi: 0, bo: 0, arch: 1, lid: 0.1, sq: 0.05, m: 'soft' }, // calm
  { bi: -0.8, bo: 0.2, arch: 1.4, lid: 0, sq: 0.45, m: 'grin' }, // cheerful
  { bi: 2.2, bo: -0.9, arch: 0.3, lid: 0.25, sq: 0.15, m: 'stern' }, // stern
  { bi: 0.3, bo: 0, arch: 1, lid: 0.42, sq: 0.1, m: 'smirk', asym: 2.6 }, // smug
  { bi: 3, bo: -1.6, arch: 0, lid: 0.1, sq: 0.35, m: 'grit' }, // fierce
  { bi: -1.2, bo: 0.4, arch: 1.5, lid: 0, sq: 0.75, m: 'laugh' }, // jolly
  { bi: -2, bo: 1.2, arch: 0.8, lid: 0, sq: 0, m: 'neutral' }, // wary
  { bi: 0.4, bo: -0.4, arch: 1.1, lid: 0.38, sq: 0, m: 'neutral' }, // proud
  { bi: -0.6, bo: 0.6, arch: 1.2, lid: 0.15, sq: 0.35, m: 'smile' }, // kind
];

function chooseGear(u: number, ai: number, female: boolean): Gear {
  const G: Gear[] = ['none', 'cap', 'galea', 'glad', 'laurel', 'diadem', 'imperial'];
  const fw = female ? 1 : 0;
  const w: number[][] = [
    [6, 3, 0.3, 1, 0, 0, 0],
    [4, 2, 4, 0.3, 0, 0.3 * fw, 0],
    [3, 1, 6, 0.5, 0, 0.3 * fw, 0],
    [3, 0.5, 1, 5, 0, 0.5 * fw, 0],
    [5, 0, 1, 0.5, 3.5, 2 * fw, 0],
    [3, 0, 5, 0.5, 1.5, 1 * fw, 0],
    [8, 0, 0.3, 0, 2, 2 * fw + 0.2, 0],
    [6, 0, 1.2, 0, 2.5, 2 * fw + 0.2, 0.3],
    [5, 0, 1, 3, 2.5, 1.5 * fw, 0.3],
    [5, 0, 0.3, 0, 2.5, 2.5 * fw + 0.5, 1.5],
    [4.5, 0, 0.3, 0, 2, 2 * fw + 0.5, 3],
    [4, 0, 0.2, 0, 1, 2.5 * fw + 0.5, 4],
  ];
  const ww = w[ai].slice();
  if (female) {
    ww[2] *= 0.45;
    ww[3] *= 0.5;
  }
  return pickW(u, G, ww);
}

function chooseCloth(u: number, ai: number, female: boolean, gear: Gear): Cloth {
  const C: Cloth[] = ['tunic', 'segm', 'muscle', 'toga', 'palla', 'stola', 'glad'];
  if (gear === 'glad') return pickW(u, C, [0, 1, 0.5, 0, 0, 0, 5]);
  if (gear === 'galea') return pickW(u, C, [0.4, ai < 5 ? 4 : 2, ai < 3 ? 1 : 3, 0, 0, 0, 0]);
  const w: number[][] = [
    [6, 0, 0, 0, 0, 1, 2],
    [4, 3, 0, 0, 0, 1, 0.3],
    [3, 4, 1, 0, 0, 1, 0.3],
    [2, 1, 0.5, 0, 0, 1, 4],
    [2, 0, 2, 3, 2, 3, 0],
    [1.5, 3, 3, 1, 1, 1, 0],
    [1, 0, 0.5, 6, 3, 3, 0],
    [1, 0, 3, 4, 3, 3, 0],
    [1, 0.5, 3, 2, 2, 2, 3],
    [0.5, 0, 3, 3, 4, 3, 0],
    [0.5, 0, 3.5, 3, 4, 3, 0],
    [0.3, 0, 4, 3, 4, 3, 0],
  ];
  const ww = w[ai].slice();
  if (female) {
    ww[3] *= 0.15;
    ww[6] *= 0.4;
  } else {
    ww[4] = 0;
    ww[5] = 0;
  }
  return pickW(u, C, ww);
}

export function portraitSvg(seed: number, opts: PortraitOptions): string {
  const sd = (Number.isFinite(seed) ? Math.floor(seed) : 0) >>> 0;
  const female = !!opts.female;
  const age = Math.max(14, Math.min(95, Number.isFinite(opts.age) ? opts.age : 30));
  // 24 arenas: the palette follows the arena; costume tiers (0..11) advance every two arenas.
  const a24 = Math.max(0, Math.min(ARENAS.length - 1, Math.floor(Number.isFinite(opts.arenaIndex) ? opts.arenaIndex : 0)));
  const ai = Math.min(11, a24 >> 1);
  const pal = ARENAS[a24].palette;
  const id = 'p' + (mixSeed('pt', sd, female ? 1 : 0, Math.round(age), ai) % 60466176).toString(36);
  const r: Rng = createRng(mixSeed(sd, 'face'));
  const g: Rng = createRng(mixSeed(sd, ai, 'gear'));
  const u = () => r.next();
  const cx = 60;

  // ---------- identity traits (fixed draw order: never depends on age/arena)
  const uSkin = u(), uHairC = u(), uEyeC = u(), uShape = u(), uCw = u(), uLen = u();
  const uEyeT = u(), uEyeS = u(), uEyeDX = u(), uBrowW = u(), uNose = u(), uNoseL = u();
  const uMouthW = u(), uExpr = u(), uStyle = u(), uVol = u(), uBeard = u(), uBald = u();
  const uGrey = u(), uEar = u(), uMark = u(), uMark2 = u(), uLash = u(), uGaze = u();
  const uLips = u(), uAcc = u(), uAcc2 = u(), uClosed = u(), uPart = u(), uJitter = u();

  // ---------- skin
  const si = pickW(uSkin, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], [0.8, 1.2, 1.5, 1.6, 1.6, 1.5, 1.3, 1, 0.8, 0.7, 0.6, 0.5]);
  const skin = SKIN[si];
  const dark = si >= 7;
  const sh = mix(skin, dark ? '#1c0c06' : '#7a2c1c', dark ? 0.34 : 0.3);
  const hi = mix(skin, dark ? '#f2c6a2' : '#fff6ee', dark ? 0.2 : 0.4);
  const line = mix(sh, '#24100a', 0.55);
  const lipC = female ? mix(skin, dark ? '#7a1f2a' : '#c4404c', dark ? 0.45 : 0.5) : mix(skin, '#8a3a2e', 0.3);

  // ---------- hair colour + greying
  const hw0 = si >= 6 ? [7, 6, 3, 1, 0.3, 0.1, 0, 0, 0, 0] : si >= 3 ? [4, 5, 4, 3, 1.5, 0.8, 0.4, 1, 0.5, 0.2] : [1.5, 2.5, 3, 3, 2.5, 1.5, 1.5, 2, 2, 1.2];
  const hairBase = pickW(uHairC, HAIR, hw0);
  const grey = Math.max(0, Math.min(1, (age - (36 + uGrey * 18)) / 26));
  const hairC = grey > 0 ? mix(hairBase, mix('#9d9a95', '#f1efea', grey), Math.pow(grey, 0.75)) : hairBase;
  const hairD = shade(hairC, -0.38);
  const browC = mix(mix(hairBase, '#9d9a95', grey * 0.6), line, 0.25);
  const eyeC = pickW(uEyeC, EYES, si >= 6 ? [6, 5, 1.5, 0.3, 0.1, 0.1, 1] : [3, 3, 2, 1.5, 2, 1, 1]);

  // ---------- head geometry
  const shapes = ['round', 'oval', 'square', 'long', 'heart'] as const;
  const shape = pickW(uShape, shapes, female ? [2, 3, 0.7, 1.2, 2.5] : [2, 2, 3, 2, 1]);
  let cw = (female ? 18 : 19) + uCw * 3;
  if (shape === 'round') cw += 1.6;
  if (shape === 'long') cw -= 1.6;
  if (shape === 'square') cw += 0.6;
  const fw = cw * (shape === 'heart' ? 1.02 : 0.95);
  const T = 26 + uJitter;
  const eyeY = 56.4 + uLen * 2.2;
  const browY = eyeY - 7.8;
  const nlen = 9.8 + uNoseL * 3.4 + (shape === 'long' ? 1.2 : 0);
  const noseY = eyeY + nlen;
  const mouthY = noseY + 6.4 + (shape === 'long' ? 0.6 : 0);
  const chinD = { round: 8.5, oval: 10.5, square: 10, long: 13, heart: 11 }[shape];
  const chinY = mouthY + chinD - (female ? 0.6 : 0);
  const jw = cw * { round: 0.88, oval: 0.76, square: 0.95, long: 0.76, heart: 0.66 }[shape] * (female ? 0.96 : 1);
  const jawY = mouthY + (shape === 'square' ? 2.5 : shape === 'round' ? 0 : 0.5);
  const chw = { round: 7.5, oval: 5.4, square: 8, long: 5.4, heart: 3.8 }[shape] * (female ? 0.9 : 1);
  const right: Pt[] = [
    [fw * 0.66, T + 1.6],
    [fw, browY - 4],
    [cw, eyeY + 3.5],
    [jw, jawY],
    [chw, chinY - (shape === 'square' ? 0.6 : 1.6)],
  ];
  if (shape === 'square') right.splice(4, 0, [(jw + chw) / 2 + 1, chinY - 2.2]);
  const headD = spline(sym(cx, T, right, chinY), true);
  const L = cx - fw, R = cx + fw;

  // ---------- features
  let expr = pickW(uExpr, EXPRS, female ? [3, 2.5, 1, 1.5, 0.7, 1, 1, 1.5, 2.5] : [2.5, 1.5, 2.5, 1.5, 1.5, 1.2, 1, 1.5, 1.5]);
  if (female && expr.m === 'grit') expr = EXPRS[2];
  const eyeT = pickW(uEyeT, ['almond', 'round', 'hooded', 'narrow'] as const, [3, 2, 2, 1.5]);
  const eyeDX = 8.4 + uEyeDX * 1.9;
  const ew = 4.1 + uEyeS * 0.8 + (eyeT === 'round' ? 0.2 : 0);
  const mw = 4.4 + uMouthW * 2.4 + (expr.m === 'laugh' || expr.m === 'grin' ? 0.8 : 0);
  const noseT = Math.floor(uNose * 7); // 0 button 1 roman 2 broad 3 snub 4 straight 5 narrow 6 bulb

  // ---------- outfit (seed + arena)
  const gear = chooseGear(g.next(), ai, female);
  const cloth = chooseCloth(g.next(), ai, female, gear);
  const gu = [g.next(), g.next(), g.next(), g.next(), g.next()];
  const helm = gear === 'galea' || gear === 'glad' || gear === 'cap';
  const metal = ai >= 9 || (ai === 7 && gu[0] < 0.6) ? '#e2b54e' : ai === 3 || ai === 8 || ai === 4 ? '#cf9a4c' : ai === 5 ? '#8c8798' : '#b3bcc6';
  const clothCols = [pal.accent, pal.accent2, mix(pal.accent, pal.stoneDark, 0.35), mix(pal.accent2, '#ffffff', 0.15)];
  const plain = ai <= 1 ? ['#b8916a', '#8a6a4a', '#9a4a32', '#6a7a5a'] : clothCols;
  const cc = plain[Math.floor(gu[1] * plain.length)];
  const purple = ai >= 9 ? '#6b2a86' : ai >= 6 ? '#8e1b2a' : '#a8342a';

  // ---------- hair style
  const baldStage = !female && uBald < 0.4 ? Math.max(0, Math.min(1, (age - 26 - uBald * 40) / 22)) : 0;
  type HS = 'crop' | 'curly' | 'wavy' | 'buzz' | 'longm' | 'tousled' | 'bun' | 'flavian' | 'crown' | 'long' | 'braid' | 'curlsf';
  let hs: HS = female
    ? pickW(uStyle, ['bun', 'flavian', 'crown', 'long', 'braid', 'curlsf'] as HS[], [3, 2, 2, 2.5, 1.6, 1.6])
    : pickW(uStyle, ['crop', 'curly', 'wavy', 'buzz', 'longm', 'tousled'] as HS[], [4, 3, 2.5, 1.2, 1, 1.5]);
  const bald = baldStage > 0.75 ? 2 : baldStage > 0.3 ? 1 : 0; // 1 receding, 2 horseshoe
  if (bald && hs === 'longm') hs = 'wavy';
  const vol = 1 + uVol * 3;
  const veil = cloth === 'palla' && gu[2] < 0.45 && gear === 'none';

  // ---------- beard
  type BS = 'none' | 'stubble' | 'short' | 'full' | 'philo' | 'goatee' | 'stache';
  let beard: BS = 'none';
  if (!female) {
    const ab = age < 19 ? 0.15 : age < 26 ? 0.6 : 1;
    beard = pickW(uBeard, ['none', 'stubble', 'short', 'full', 'philo', 'goatee', 'stache'] as BS[], [3.5, 2 * ab, 2 * ab, 1.5 * ab, (age > 40 ? 1.6 : 0.2) * ab, 0.8 * ab, 0.5 * ab]);
  }

  // ---------- medallion palette
  const bgBase = pickW(gu[3], [pal.accent2, pal.sky[0], pal.accent], [3, 2, 1.3]);
  const bgIn = mix(bgBase, W, 0.55);
  const bgOut = mix(bgBase, '#1a1010', 0.12);
  const ring = ai >= 7 ? '#d8aa3e' : ai >= 4 ? '#b9b2a2' : '#b07a48';
  const rim = mix(bgBase, W, 0.7);

  // ======================= defs
  let s = '';
  // ======================= medallion
  s += circ(60, 60, 60, `url(#${id}b)`);
  // laurel branches framing the lower medallion (one side drawn, the other mirrored)
  let bl = `M${P(60 + Math.cos(Math.PI * 0.56) * 50, 60 + Math.sin(Math.PI * 0.56) * 50)}A50,50 0 0 1 ${P(60 + Math.cos(Math.PI * 1.22) * 50, 60 + Math.sin(Math.PI * 1.22) * 50)}`;
  for (let i = 0; i < 4; i++) {
    const a = Math.PI * (0.63 + i * 0.16);
    const x = 60 + Math.cos(a) * 50, y = 60 + Math.sin(a) * 50, t = a + Math.PI / 2;
    for (const k of [-0.5, 0.5]) bl += `M${P(x, y)}l${P(Math.cos(t + k) * 5.4, Math.sin(t + k) * 5.4)}`;
  }
  s += `<path id="${id}l" d="${bl}" stroke="${W}" stroke-width="2.2"${op(0.28)}/><use href="#${id}l" transform="matrix(-1 0 0 1 120 0)"/>`;
  s += `<g clip-path="url(#${id}o)"><g transform="matrix(1.2 0 0 1.2 -12 -11)">`;

  let uid = 0;
  /** Same path stroked several times (outline, fill, highlight) without repeating its data. */
  const layers = (d: string, ls: [string, number, number?, string?][]) => {
    const k = id + 'u' + uid++;
    return ls
      .map(([c, w, o, t], i) => (i ? `<use href="#${k}"${t ? ` transform="translate(${t})"` : ''}` : `<g`) + ` stroke="${c}" stroke-width="${n(w)}"${o ? op(o) : ''}` + (i ? '/>' : `><path id="${k}" d="${d}"/></g>`))
      .join('');
  };
  /** Draw the right-hand half and mirror it about the centre line. */
  const mirror = (c: string) => {
    const k = id + 'u' + uid++;
    return `<g id="${k}">${c}</g><use href="#${k}" transform="matrix(-1 0 0 1 120 0)"/>`;
  };
  const hairPaint = `url(#${id}h)`;
  const out = (c: string) => ` stroke="${shade(c, -0.45)}"`;
  const hairOut = ` stroke="${shade(hairC, -0.55)}"`;

  // ======================= back hair layer
  const hb = (): string => {
    if (helm && !female) return '';
    let b = '';
    if (hs === 'long' || hs === 'longm' || hs === 'curlsf' || helm) {
      const wd = fw + (hs === 'curlsf' ? 7 : 4.5);
      const bot = hs === 'longm' ? 92 : 106;
      const d = `M${P(cx - wd + 1, browY)}C${P(cx - wd - 3, T)} ${P(cx + wd + 3, T)} ${P(cx + wd - 1, browY)}C${P(cx + wd + 2, 75)} ${P(cx + wd + 3, 95)} ${P(cx + wd - 2, bot)}L${P(cx - wd + 2, bot)}C${P(cx - wd - 3, 95)} ${P(cx - wd - 2, 75)} ${P(cx - wd + 1, browY)}Z`;
      b += path(d, hairPaint, hairOut);
    }
    if (helm || veil) return b;
    if (hs === 'bun' || hs === 'flavian') {
      b += circ(cx + (hs === 'bun' ? 0 : 0), T - 3, 9.5, hairPaint, hairOut);
      b += stroke(`M${P(cx - 7, T - 5)}Q${P(cx, T - 11)} ${P(cx + 7, T - 5)}M${P(cx - 6, T)}Q${P(cx, T - 5)} ${P(cx + 6, T)}`, hairD, 0.9, op(0.6));
    }
    if (hs === 'crown') b += path(`M${P(cx - fw - 3, eyeY + 2)}C${P(cx - fw - 7, T - 2)} ${P(cx + fw + 7, T - 2)} ${P(cx + fw + 3, eyeY + 2)}Z`, hairPaint, hairOut);
    return b;
  };
  s += hb();
  if (veil) {
    const vc = mix(cc, W, 0.1);
    s += path(`M${P(cx - fw - 9, 120)}C${P(cx - fw - 11, 70)} ${P(cx - fw - 8, T - 9)} ${P(cx, T - 9)}C${P(cx + fw + 8, T - 9)} ${P(cx + fw + 11, 70)} ${P(cx + fw + 9, 120)}Z`, `url(#${id}c)`, out(vc));
  }

  // ======================= neck
  const nw = jw * (female ? 0.6 : 0.7) + 1;
  s += path(`M${P(cx - nw, mouthY)}L${P(cx - nw - 1.2, 99)}Q${P(cx, 106)} ${P(cx + nw + 1.2, 99)}L${P(cx + nw, mouthY)}Z`, mix(skin, sh, 0.4), out(skin));

  // ======================= bust / clothing
  const shY = 94;
  const bust = `M${P(cx - nw - 3, shY - 1)}C${P(cx - nw - 14, shY - 1)} ${P(cx - 37, shY + 1)} ${P(cx - 46, 107)}L${P(cx - 54, 122)}H${n(cx + 54)}L${P(cx + 46, 107)}C${P(cx + 37, shY + 1)} ${P(cx + nw + 14, shY - 1)} ${P(cx + nw + 3, shY - 1)}Z`;
  const neckline = `M${P(cx - nw - 3, shY - 1)}Q${P(cx, 109)} ${P(cx + nw + 3, shY - 1)}`;
  const shoulderRim = stroke(`M${P(cx + nw + 6, shY - 0.6)}C${P(cx + 30, shY)} ${P(cx + 40, 101)} ${P(cx + 47, 109)}`, rim, 1.6, op(0.75));
  const clothPaint = `url(#${id}c)`;
  let cl = '';
  if (cloth === 'glad') {
    // bare shoulders, leather strap, manica on one arm, sometimes a galerus
    cl += path(bust, `url(#${id}s)`, out(skin));
    cl += stroke(`M${P(cx - 14, 104)}Q${P(cx - 8, 108)} ${P(cx - 2, 106)}M${P(cx + 14, 104)}Q${P(cx + 8, 108)} ${P(cx + 2, 106)}`, sh, 1, op(0.7));
    cl += path(`M${P(cx - 34, 98)}L${P(cx - 26, 97)}L${P(cx + 30, 122)}L${P(cx + 20, 122)}Z`, '#7a4a26', out('#7a4a26'));
    let man = '';
    for (let i = 0; i < 4; i++) man += `M${P(cx + 36 + i * 3, 100 + i * 4)}q${P(-8, 3)} ${P(-12, 10)}`;
    cl += path(`M${P(cx + 30, 98)}C${P(cx + 42, 98)} ${P(cx + 50, 106)} ${P(cx + 54, 122)}H${P(cx + 34, 122)}C${P(cx + 34, 112)} ${P(cx + 30, 104)} ${P(cx + 30, 98)}Z`, `url(#${id}m)`, out(metal));
    cl += stroke(man, shade(metal, -0.5), 0.9, op(0.7));
    if (gu[2] < 0.35) cl += path(`M${P(cx - 28, 98)}L${P(cx - 36, 80)}Q${P(cx - 42, 82)} ${P(cx - 44, 90)}L${P(cx - 46, 108)}Z`, `url(#${id}m)`, out(metal));
  } else {
    cl += path(bust, cloth === 'toga' ? '#efe8da' : cloth === 'segm' || cloth === 'muscle' ? shade(cc, -0.1) : clothPaint, out(cloth === 'toga' ? '#d8cfbd' : cc));
    if (cloth === 'tunic' || cloth === 'stola') {
      cl += path(neckline + 'Z', mix(skin, sh, 0.35), out(skin));
      cl += stroke(neckline, shade(cc, -0.4), 1.6);
      cl += stroke(`M${P(cx - 26, 108)}q${P(2, 6)} ${P(1, 14)}M${P(cx + 22, 106)}q${P(3, 6)} ${P(3, 16)}`, shade(cc, -0.35), 1, op(0.6));
      if (cloth === 'tunic' && (ai >= 3 || gu[2] < 0.3)) cl += stroke(`M${P(cx - 18, 98)}V122M${P(cx + 18, 98)}V122`, ai >= 6 ? purple : shade(cc, -0.45), 2.6);
      if (cloth === 'stola') cl += circ(cx - 27, 100, 2.3, '#e2b54e', out('#e2b54e')) + circ(cx + 27, 100, 2.3, '#e2b54e', out('#e2b54e'));
    }
    if (cloth === 'toga') {
      cl += path(neckline + 'Z', mix(skin, sh, 0.35), out(skin));
      cl += stroke(`M${P(cx - 17, 99)}V122M${P(cx + 17, 99)}V122`, purple, 2.6);
      // the sinus: a wide drape from the left shoulder across the chest
      cl += path(`M${P(cx - 44, 104)}C${P(cx - 36, 94)} ${P(cx - 24, 95)} ${P(cx - 14, 98)}C${P(cx, 106)} ${P(cx + 18, 112)} ${P(cx + 30, 122)}H${P(cx + 4, 122)}C${P(cx - 6, 114)} ${P(cx - 26, 108)} ${P(cx - 44, 112)}Z`, '#f6f1e6', out('#d8cfbd'));
      cl += stroke(`M${P(cx - 40, 108)}C${P(cx - 24, 102)} ${P(cx - 2, 108)} ${P(cx + 16, 122)}M${P(cx - 30, 104)}C${P(cx - 16, 102)} ${P(cx + 4, 110)} ${P(cx + 20, 120)}`, '#c9bfa8', 1, op(0.8));
      if (ai >= 6) cl += stroke(`M${P(cx - 44, 104)}C${P(cx - 36, 94)} ${P(cx - 24, 95)} ${P(cx - 14, 98)}C${P(cx, 106)} ${P(cx + 18, 112)} ${P(cx + 30, 122)}`, purple, 2.2);
    }
    if (cloth === 'palla' || cloth === 'stola') {
      if (cloth === 'palla') {
        cl += path(neckline + 'Z', mix(skin, sh, 0.35), out(skin));
        cl += stroke(neckline, shade(cc, -0.3), 1.4);
      }
      const pc = cloth === 'palla' ? mix(pal.accent2, pal.stoneDark, 0.2) : mix(cc, W, 0.55);
      cl += path(`M${P(cx - 50, 108)}C${P(cx - 40, 96)} ${P(cx - 28, 97)} ${P(cx - 16, 99)}C${P(cx - 12, 108)} ${P(cx - 14, 116)} ${P(cx - 18, 122)}H${P(cx - 54, 122)}Z`, pc, out(pc));
      cl += stroke(`M${P(cx - 40, 103)}q${P(4, 8)} ${P(2, 19)}M${P(cx - 28, 101)}q${P(4, 9)} ${P(2, 21)}`, shade(pc, -0.3), 1, op(0.7));
      cl += circ(cx - 17, 101, 2.4, '#e2b54e', out('#e2b54e'));
    }
    if (cloth === 'segm') {
      const m2 = shade(metal, -0.5);
      cl += path(neckline + 'Z', mix(skin, sh, 0.35));
      cl += path(`M${P(cx - nw - 4, shY - 2)}Q${P(cx, 104)} ${P(cx + nw + 4, shY - 2)}L${P(cx + nw + 5, shY + 2)}Q${P(cx, 109)} ${P(cx - nw - 5, shY + 2)}Z`, '#b8281e', out('#b8281e'));
      cl += path(`M${P(cx - 40, 122)}V108Q${P(cx, 114)} ${P(cx + 40, 108)}V122Z`, `url(#${id}m)`, out(metal));
      cl += stroke(`M${P(cx - 40, 115)}Q${P(cx, 121)} ${P(cx + 40, 115)}`, m2, 1.1);
      let sb = '';
      for (let i = 0; i < 3; i++) sb += `M${P(cx + nw + 5 + i * 1.5, shY + 1 + i * 3.4)}C${P(cx + 28 + i * 2, shY - 2 + i * 3)} ${P(cx + 40 + i, shY + 3 + i * 3)} ${P(cx + 48 + i, 108 + i * 3.4)}`;
      cl += mirror(path(`M${P(cx + nw + 4, shY - 1)}C${P(cx + 28, shY - 4)} ${P(cx + 42, shY + 1)} ${P(cx + 50, 108)}L${P(cx + 52, 120)}C${P(cx + 44, 110)} ${P(cx + 30, 108)} ${P(cx + nw + 8, 112)}Z`, `url(#${id}m)`, out(metal)) + stroke(sb, m2, 0.9, op(0.8)) + circ(cx + 24, 112, 1.2, '#e2c46a'));
    }
    if (cloth === 'muscle') {
      cl += path(neckline + 'Z', mix(skin, sh, 0.35));
      cl += path(`M${P(cx - 36, 122)}C${P(cx - 38, 110)} ${P(cx - 34, 102)} ${P(cx - nw - 3, shY + 1)}Q${P(cx, 105)} ${P(cx + nw + 3, shY + 1)}C${P(cx + 34, 102)} ${P(cx + 38, 110)} ${P(cx + 36, 122)}Z`, `url(#${id}m)`, out(metal));
      cl += stroke(`M${P(cx - 24, 110)}Q${P(cx - 12, 117)} ${P(cx - 2, 111)}M${P(cx + 24, 110)}Q${P(cx + 12, 117)} ${P(cx + 2, 111)}M${P(cx, 108)}V122`, shade(metal, -0.45), 1.1, op(0.85));
      cl += stroke(`M${P(cx - 22, 106)}Q${P(cx - 14, 104)} ${P(cx - 8, 107)}`, W, 1.4, op(0.6));
      if (gu[2] < 0.6) {
        const cape = ai >= 9 ? '#6b2a86' : pal.accent;
        cl += path(`M${P(cx + 30, 97)}C${P(cx + 42, 98)} ${P(cx + 50, 106)} ${P(cx + 56, 122)}H${P(cx + 36, 122)}C${P(cx + 38, 112)} ${P(cx + 34, 104)} ${P(cx + 30, 97)}Z`, cape, out(cape));
        cl += circ(cx + 31, 100, 2.6, '#e2b54e', out('#e2b54e'));
      }
    }
  }
  s += cl + shoulderRim;

  // torc / necklace
  if (!female && gu[4] < (ai <= 3 ? 0.12 : 0.05) && cloth !== 'segm') s += stroke(`M${P(cx - nw - 1, chinY + 7)}Q${P(cx, chinY + 14)} ${P(cx + nw + 1, chinY + 7)}`, '#d6a83e', 2.4, ` stroke-linecap="round"`) + circ(cx - nw - 1, chinY + 7, 1.6, '#d6a83e') + circ(cx + nw + 1, chinY + 7, 1.6, '#d6a83e');
  if (female && uAcc2 < 0.4 && cloth !== 'segm' && cloth !== 'glad') {
    let beads = '';
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.5) / 7;
      const x = cx - nw - 1 + t * (2 * nw + 2);
      beads += `M${P(x, 97 + Math.sin(t * Math.PI) * 5.5)}h0`;
    }
    s += stroke(beads, ai >= 6 ? '#e2b54e' : '#c9a45a', 2) ;
  }

  // ======================= long hair side locks over shoulders
  if (!helm && !veil && (hs === 'long' || hs === 'curlsf')) {
    const x0 = cx + fw - 1;
    s += mirror(path(`M${P(x0, eyeY - 4)}C${P(x0 + 6, eyeY + 10)} ${P(x0 + 4, 88)} ${P(cx + fw + 9, 106)}C${P(cx + fw + 2, 104)} ${P(cx + nw + 2, 96)} ${P(cx + nw + 1, 84)}Z`, hairPaint, hairOut));
  }
  if (!helm && !veil && hs === 'braid') {
    let br = '';
    for (let i = 0; i < 6; i++) br += `M${P(cx - fw - 1 + i * 0.6, eyeY + 4 + i * 6.5)}h0`;
    s += layers(br, [[shade(hairC, -0.5), 7.4], [hairC, 6], [shade(hairC, 0.3), 2.4, 0.6, '-1 -1']]) + circ(cx - fw + 2.2, eyeY + 42, 1.8, pal.accent);
  }

  // ======================= ears
  let fl = ''; // fine face lines, one path
  const earS = 1 + uEar * 0.3;
  const earD = (d: number) => {
    const x = cx + d * (cw - 1.2);
    return `M${P(x, eyeY - 1)}C${P(x + d * 5 * earS, eyeY - 4)} ${P(x + d * 6.5 * earS, eyeY + 9)} ${P(x + d * 0.5, eyeY + 11.5)}`;
  };
  if (!veil) {
    s += path(earD(-1) + earD(1), mix(skin, sh, 0.2), out(skin));
    fl += `M${P(cx - cw - 0.3, eyeY + 1)}c${P(-2.4, -0.8)} ${P(-3, 4)} ${P(-0.6, 6.5)}M${P(cx + cw + 0.3, eyeY + 1)}c${P(2.4, -0.8)} ${P(3, 4)} ${P(0.6, 6.5)}`;
    if (female && uAcc < 0.55 && !helm) {
      const ec = ai >= 6 ? '#e2b54e' : '#c99a4c';
      s += mirror(stroke(`M${P(cx + cw + 1.5, eyeY + 11)}v3`, ec, 0.9) + circ(cx + cw + 1.5, eyeY + 15.5, 1.5, uAcc < 0.2 ? '#f4f0ff' : ec, out(ec)));
    }
  }

  // ======================= head + face shading
  s += `<use href="#${id}f" fill="url(#${id}s)"${out(sh)}/>`;
  let fs = '';
  // eye sockets + cheek blush + side shadow
  if (female || age < 24 || expr.sq > 0.3) fs += stroke(`M${P(cx - eyeDX - 4, noseY - 1)}h3M${P(cx + eyeDX + 1, noseY - 1)}h3`, '#e8606a', 6, op(si >= 9 ? 0.08 : dark ? 0.13 : 0.22));
  // cheekbone / jaw definition for strong faces
  if (shape === 'square' || shape === 'long' || age > 50) fs += stroke(`M${P(cx + cw - 2, eyeY + 6)}Q${P(cx + cw - 6, noseY + 3)} ${P(cx + jw - 4, mouthY + 1)}M${P(cx - cw + 2, eyeY + 6)}Q${P(cx - cw + 6, noseY + 3)} ${P(cx - jw + 4, mouthY + 1)}`, sh, 2.4, op(0.18));
  // under-lip + chin shading
  fs += path(ell(cx + 0.5, mouthY + 4.5, mw * 0.55, 1.6) + ell(cx + 1, noseY + 1.6, [3.2, 3.4, 5, 3.4, 3.4, 2.8, 4.2][noseT] + 0.5, 1.5), sh, op(0.3));
  if ((shape === 'square' || (!female && uMark2 < 0.25)) && (beard === 'none' || beard === 'stache')) fl += `M${P(cx, chinY - 3.6)}v1.6`; // cleft
  // age: smile lines, crow's feet, forehead lines, eye bags
  const al = Math.max(0, Math.min(1, (age - 32) / 30));
  if (al > 0 || expr.sq > 0.4) {
    let w = `M${P(cx - 5, noseY - 1.5)}Q${P(cx - mw - 3, mouthY - 1)} ${P(cx - mw - 2.2, mouthY + 2.5)}M${P(cx + 5, noseY - 1.5)}Q${P(cx + mw + 3, mouthY - 1)} ${P(cx + mw + 2.2, mouthY + 2.5)}`;
    if (age > 44) for (const d of [-1, 1]) w += `M${P(cx + d * (eyeDX + ew + 1.2), eyeY - 0.5)}l${P(d * 2.2, -1)}M${P(cx + d * (eyeDX + ew + 1.3), eyeY + 1)}l${P(d * 2.4, 0.6)}`;
    if (age > 50) w += `M${P(cx - 7, browY - 5)}Q${P(cx, browY - 6.4)} ${P(cx + 7, browY - 5)}M${P(cx - 5, browY - 2.6)}Q${P(cx, browY - 3.6)} ${P(cx + 5, browY - 2.6)}`;
    if (age > 56) for (const d of [-1, 1]) w += `M${P(cx + d * (eyeDX - 3), eyeY + 3.4)}Q${P(cx + d * eyeDX, eyeY + 5.2)} ${P(cx + d * (eyeDX + 3), eyeY + 3.2)}`;
    fs += stroke(w, sh, 0.9, op(0.25 + 0.5 * Math.max(al, 0.25)));
  }
  // freckles / mole / scar
  if (si <= 3 && uMark < 0.18) {
    let fr = '';
    for (let i = 0; i < 6; i++) fr += `M${P(cx + (i % 2 ? 1 : -1) * (eyeDX - 2 + (i >> 1) * 2), noseY - 3 + (i % 3) * 1.4)}h0`;
    fs += stroke(fr, sh, 1, op(0.55));
  } else if (uMark < 0.28) fs += circ(cx + (uMark2 < 0.5 ? -1 : 1) * (mw + 2), mouthY - 2.5, 0.75, line, op(0.75));
  // hair shadow on forehead
  // cel shadow on the far side + rim light
  fs += path(`M${P(cx + fw * 0.5, T - 2)}C${P(cx + cw * 0.72, browY)} ${P(cx + cw * 0.5, eyeY + 4)} ${P(cx + cw * 0.62, noseY)}C${P(cx + cw * 0.72, mouthY)} ${P(cx + jw * 0.85, chinY - 4)} ${P(cx + jw * 0.75, chinY + 3)}H${n(cx + cw + 6)}V${n(T - 2)}Z` + ell(cx + 2, T + 4, fw + 2, browY - T - 3), sh, op(helm || bald === 2 ? 0.2 : 0.25));
  fs += stroke(spline([[R, browY - 5], [cx + cw, eyeY + 3.5], [cx + jw, jawY], [cx + jw * 0.6, chinY - 2.5]], false), mix(rim, skin, 0.4), 2.4, op(0.55));
  s += `<g clip-path="url(#${id}k)">${fs}</g>`;

  // ======================= beard (under mouth)
  const beardPaint = beard === 'stubble' ? hairD : hairPaint;
  if (beard !== 'none' && beard !== 'stache') {
    const drop = { stubble: 0, short: 2, full: 4.5, philo: 13, goatee: 3 }[beard];
    let d: string;
    if (beard === 'goatee') {
      d = `M${P(cx - mw - 1.5, mouthY - 0.5)}Q${P(cx - mw - 1, chinY)} ${P(cx, chinY + drop)}Q${P(cx + mw + 1, chinY)} ${P(cx + mw + 1.5, mouthY - 0.5)}Q${P(cx + mw - 1, mouthY + 3.5)} ${P(cx, mouthY + 3)}Q${P(cx - mw + 1, mouthY + 3.5)} ${P(cx - mw - 1.5, mouthY - 0.5)}Z`;
    } else {
      const ox = beard === 'stubble' ? 0 : 1;
      const bot = beard === 'philo' ? `C${P(cx + jw + 3, chinY + 6)} ${P(cx + 8, chinY + drop)} ${P(cx + 2, chinY + drop + 1)}Q${P(cx, chinY + drop - 2)} ${P(cx - 2, chinY + drop + 1)}C${P(cx - 8, chinY + drop)} ${P(cx - jw - 3, chinY + 6)}` : `C${P(cx + jw + ox, chinY - 1 + drop)} ${P(cx + chw + 3, chinY + drop)} ${P(cx, chinY + drop)}C${P(cx - chw - 3, chinY + drop)} ${P(cx - jw - ox, chinY - 1 + drop)}`;
      d = `M${P(cx + cw - 0.3, eyeY + 2)}C${P(cx + cw + ox, eyeY + 10)} ${P(cx + jw + ox + 1, jawY - 2)} ${P(cx + jw + ox, jawY)}${bot} ${P(cx - jw - ox, jawY)}C${P(cx - jw - ox - 1, jawY - 2)} ${P(cx - cw - ox, eyeY + 10)} ${P(cx - cw + 0.3, eyeY + 2)}L${P(cx - cw + 3.2, eyeY + 2)}C${P(cx - cw + 4, noseY)} ${P(cx - mw - 3, mouthY - 3)} ${P(cx - mw - 1.2, mouthY + 1.5)}Q${P(cx, mouthY + 5)} ${P(cx + mw + 1.2, mouthY + 1.5)}C${P(cx + mw + 3, mouthY - 3)} ${P(cx + cw - 4, noseY)} ${P(cx + cw - 3.2, eyeY + 2)}Z`;
    }
    s += beard === 'stubble' ? path(d, hairD, op(0.28)) : path(d, beardPaint, hairOut);
    if (beard === 'full' || beard === 'philo') {
      let cu = '';
      for (let i = 0; i < 5; i++) cu += `M${P(cx - 8 + i * 4, chinY + drop * 0.4 - (i % 2))}q${P(1.5, 2)} ${P(0, 3.5)}`;
      s += stroke(cu, hairD, 0.9, op(0.6));
    }
  }

  // ======================= mouth
  const my = mouthY;
  const mlc = mix(sh, '#2a0e08', 0.5);
  let mo = '';
  const open = expr.m === 'grin' || expr.m === 'laugh';
  if (open) {
    const dep = expr.m === 'laugh' ? 7 : 4.5;
    const up = expr.m === 'laugh' ? -1.6 : -1.3;
    const lip = `M${P(cx - mw, my + up)}Q${P(cx, my + 0.6)} ${P(cx + mw, my + up)}Q${P(cx, my + dep)} ${P(cx - mw, my + up)}Z`;
    mo += path(lip, '#5a1a1c', ` stroke="${female ? lipC : mlc}" stroke-width="1.2" stroke-linejoin="round"`);
    mo += path(`M${P(cx - mw + 1, my + up + 0.4)}Q${P(cx, my + 1)} ${P(cx + mw - 1, my + up + 0.4)}L${P(cx + mw - 1.6, my + up + 1.6)}Q${P(cx, my + 2.8)} ${P(cx - mw + 1.6, my + up + 1.6)}Z`, '#fbf6ee');
    if (expr.m === 'laugh') mo += `<ellipse cx="${cx}" cy="${n(my + 4.6)}" rx="${n(mw * 0.45)}" ry="1.4" fill="#d0606a"/>`;
  } else {
    const MC: Partial<Record<Mouth, number[]>> = { neutral: [0, 0.7, 0], soft: [-0.6, 1.5, -0.6], smile: [-1.6, 2.6, -1.6], smirk: [0.3, 1, -1.8], stern: [0.9, -0.6, 0.9], grit: [0.6, -0.2, 0.6] };
    const c = MC[expr.m] ?? [0, 0.7, 0];
    const ml = `M${P(cx - mw, my + c[0])}Q${P(cx, my + c[1])} ${P(cx + mw, my + c[2])}`;
    if (female || uLips < 0.3) {
      const lc = female ? lipC : mix(skin, sh, 0.5);
      mo += path(`M${P(cx - mw, my + c[0])}C${P(cx - mw * 0.5, my - 2.2)} ${P(cx - 1.2, my - 2.4)} ${P(cx, my - 1.7)}C${P(cx + 1.2, my - 2.4)} ${P(cx + mw * 0.5, my - 2.2)} ${P(cx + mw, my + c[2])}Q${P(cx, my + c[1])} ${P(cx - mw, my + c[0])}Z`, shade(lc, -0.12));
      mo += path(`M${P(cx - mw + 0.6, my + c[0] + 0.3)}Q${P(cx, my + c[1])} ${P(cx + mw - 0.6, my + c[2] + 0.3)}Q${P(cx, my + c[1] + 3.6)} ${P(cx - mw + 0.6, my + c[0] + 0.3)}Z`, lc);
    } else {
      if (beard === 'none' || beard === 'stubble' || beard === 'stache') fl += `M${P(cx - mw * 0.45, my + c[1] / 2 + 2.6)}Q${P(cx, my + c[1] / 2 + 3.4)} ${P(cx + mw * 0.45, my + c[1] / 2 + 2.6)}`;
    }
    mo += stroke(ml, mlc, 1.25);
    if (expr.m === 'smile' || expr.m === 'smirk') mo += stroke(`M${P(cx + mw - 0.3, my + c[2] - 0.9)}l${P(0.8, 0.9)}${expr.m === 'smile' ? `M${P(cx - mw + 0.3, my + c[0] - 0.9)}l${P(-0.8, 0.9)}` : ''}`, mlc, 0.9);
    if (expr.m === 'grit') mo += stroke(`M${P(cx - mw + 1.5, my + 0.6)}h${n(2 * mw - 3)}`, W, 0.9, op(0.7));
  }
  s += mo;

  // moustache
  if (beard === 'full' || beard === 'philo' || beard === 'stache' || (beard === 'short' && uBeard > 0.5) || (beard === 'goatee' && uBeard > 0.75)) {
    const mt = my - (open ? 2.2 : 1.2);
    const tip = beard === 'stache' && uLips < 0.5 ? 3.5 : 1.2;
    s += path(`M${P(cx, noseY + 1.2)}C${P(cx + 3, noseY + 0.6)} ${P(cx + mw + 2, mt - 1.5)} ${P(cx + mw + 2, mt + tip)}C${P(cx + mw - 1, mt)} ${P(cx + 2, mt + 0.4)} ${P(cx, mt + 0.2)}C${P(cx - 2, mt + 0.4)} ${P(cx - mw + 1, mt)} ${P(cx - mw - 2, mt + tip)}C${P(cx - mw - 2, mt - 1.5)} ${P(cx - 3, noseY + 0.6)} ${P(cx, noseY + 1.2)}Z`, hairPaint, hairOut);
  }

  // ======================= nose
  const nY = noseY;
  const nwid = [3.2, 3.4, 5, 3.4, 3.4, 2.8, 4.2][noseT];
  let no = '';
  const bridge =
    noseT === 1 ? `M${P(cx + 1.4, eyeY + 1)}Q${P(cx + 3.6, eyeY + nlen * 0.45)} ${P(cx + 2.4, nY - 1)}`
      : noseT === 4 || noseT === 5 ? `M${P(cx + 1.2, browY + 3)}L${P(cx + 2, nY - 1.6)}`
        : noseT === 3 ? `M${P(cx + 1.6, eyeY + 3)}Q${P(cx + 1.6, nY - 3)} ${P(cx + 2.4, nY - 2)}`
          : `M${P(cx + 1.6, eyeY + 2)}Q${P(cx + 2, nY - 4)} ${P(cx + 2.4, nY - 1.6)}`;
  fl += bridge;
  const tipY = nY + (noseT === 3 ? -0.8 : noseT === 1 ? 0.6 : 0);
  no += stroke(`M${P(cx - nwid, tipY - 1.6)}Q${P(cx - nwid - 1, tipY + 1)} ${P(cx - 1.6, tipY + 0.8)}Q${P(cx, tipY + 1.8)} ${P(cx + 1.6, tipY + 0.8)}Q${P(cx + nwid + 1, tipY + 1)} ${P(cx + nwid, tipY - 1.6)}`, mix(sh, line, 0.35), 1.1);
  if (noseT === 3 || noseT === 2) no += stroke(`M${P(cx - 2.4, tipY + 0.4)}h.8M${P(cx + 1.6, tipY + 0.4)}h.8`, line, 1.1, op(0.7));
  if (noseT === 6) no += circ(cx, tipY - 1.2, 2.6, sh, op(0.18));
  no += circ(cx - 0.8, tipY - 1.8, noseT === 6 ? 1.3 : 0.9, W, op(0.45));
  s += no;

  // ======================= eyes
  const closed = expr.m === 'laugh' && uClosed < 0.5;
  const patch = !female && uMark < 0.04 && !closed;
  const lidLine = female ? mix(line, '#120806', 0.4) : line;
  let wh = '', iris = '', glint = '', lash = '', crease = '', lower = '';
  let irisR = 2.5;
  const gx = (uGaze - 0.5) * 1.6;
  for (const d of [-1, 1]) {
    const ex = cx + d * eyeDX;
    if (patch && d === 1) continue;
    const tilt = eyeT === 'almond' ? 0.8 : eyeT === 'narrow' ? 0.5 : 0;
    const up = { almond: 3.5, round: 4.1, hooded: 2.9, narrow: 2.4 }[eyeT] * (1 - expr.lid * 0.5);
    const dn = { almond: 2, round: 2.8, hooded: 2, narrow: 1.4 }[eyeT] * (1 - expr.sq * 0.6);
    const ix = ex - d * ew, ox = ex + d * ew;
    if (closed) {
      lash += `M${P(ix, eyeY)}Q${P(ex, eyeY - 3)} ${P(ox, eyeY + 0.4)}`;
      continue;
    }
    wh += `M${P(ix, eyeY + 0.3)}Q${P(ex - d * 0.4, eyeY - up * 2)} ${P(ox, eyeY - tilt)}Q${P(ex, eyeY + dn * 2)} ${P(ix, eyeY + 0.3)}Z`;
    const ir = Math.min(3.1, 2.2 + up * 0.24);
    irisR = ir;
    iris += `M${P(ex + gx, eyeY - 0.2)}h0`;
    glint += `M${P(ex + gx - 0.8, eyeY - 1.1)}h0`;
    lash += `M${P(ix, eyeY + 0.3)}Q${P(ex - d * 0.4, eyeY - up * 2)} ${P(ox, eyeY - tilt)}`;
    if (female || uLash < 0.25) lash += `l${P(d * 1.6, -1)}`;
    crease += `M${P(ix + d * 0.6, eyeY - up * 0.6 - 0.8)}Q${P(ex, eyeY - up * 1.5 - (eyeT === 'hooded' ? 1 : 2.2))} ${P(ox + d * 0.3, eyeY - tilt - 1.4)}`;
    lower += `M${P(ix + d * 1, eyeY + dn * 0.7)}Q${P(ex, eyeY + dn * 1.15)} ${P(ox - d * 0.8, eyeY - tilt + dn * 0.5)}`;
  }
  if (wh) {
    s += `<clipPath id="${id}e"><path id="${id}w" d="${wh}"/></clipPath><use href="#${id}w" fill="#f8f4ee"/>`;
    s += `<g clip-path="url(#${id}e)">${stroke(iris, eyeC, irisR * 2)}${stroke(iris, '#120a08', irisR * 0.95)}${stroke(glint, W, 1.5)}<use href="#${id}w" stroke="${sh}" stroke-width="2.2"${op(0.35)}/></g>`;
  }
  if (eyeT === 'hooded') s += stroke(crease, sh, 1.3, op(0.75));
  else lower += crease;
  s += stroke(lower + fl, sh, 1, op(0.6));
  s += stroke(lash, lidLine, female ? 1.6 : 1.4, '');
  if (patch) {
    s += stroke(`M${P(cx - fw, browY - 5)}L${P(cx + cw, eyeY + 4)}`, '#2a1a12', 1.2);
    s += `<ellipse cx="${n(cx + eyeDX)}" cy="${n(eyeY + 0.3)}" rx="4.6" ry="3.8" fill="#2a1a12"/>`;
  }
  // scar (fighters)
  if (!patch && uAcc2 > (ai === 3 || ai === 8 ? 0.82 : 0.93) && (cloth === 'glad' || cloth === 'segm' || !female)) {
    const sx = cx + (uAcc < 0.5 ? -1 : 1) * (eyeDX + 1);
    s += stroke(`M${P(sx - 2, browY - 4)}L${P(sx + 2, eyeY + 9)}`, mix(skin, '#e08a8a', 0.5), 1.3) + stroke(`M${P(sx - 1.6, browY)}h2M${P(sx - 0.4, eyeY + 4)}h2`, mix(skin, '#c06a6a', 0.5), 0.7);
  }

  // ======================= brows
  const bwt = (female ? 1.2 : 1.7) + uBrowW * (female ? 1 : 2.2);
  let bp = '';
  for (const d of [-1, 1]) {
    const lift = expr.asym && d === 1 ? -expr.asym : 0;
    const x0 = cx + d * 3.2, x1 = cx + d * (eyeDX + ew + 1.8);
    const y0 = browY + expr.bi + lift * 0.4, y1 = browY + 0.6 + expr.bo + lift;
    const pk = browY - expr.arch * 1.6 + lift;
    const px = cx + d * (eyeDX + 0.5);
    bp += `M${P(x0, y0 + bwt * 0.5)}Q${P(px, pk + bwt * 0.45)} ${P(x1, y1)}Q${P(px, pk - bwt * 0.6)} ${P(x0, y0 - bwt * 0.5)}Z`;
  }
  s += path(bp, browC);

  // ======================= front hair
  const hy = browY - 7 - (female ? 0.5 : 0);
  const capTop = T - 2.5 - vol;
  const hcY = browY + 2;
  const arc = (ext: number, top: number, k: number, bump: number, y0: number): Pt[] => {
    const rx = fw + ext, ry = hcY - top;
    const pts: Pt[] = [[cx - rx + 0.8, y0]];
    for (let i = 0; i <= k; i++) {
      const a = Math.PI - (i / k) * Math.PI;
      const f = 1 + (i % 2 ? bump : 0);
      pts.push([cx + Math.cos(a) * rx * f, hcY - Math.sin(a) * ry * f]);
    }
    pts.push([cx + rx - 0.8, y0]);
    return pts;
  };
  const tail = (h: Pt[]) => spline(h, false, true).replace('M', 'L') + 'Z';
  const strands = (top: number, y0: number, a = 0.45) => {
    let d = '';
    for (const t of [-0.55, 0, 0.5]) d += `M${P(cx + t * fw * 1.05, y0)}Q${P(cx + t * fw * 1.35, (y0 + top) / 2)} ${P(cx + t * fw * 0.5, top + 2)}`;
    return stroke(d, hairD, 0.9, op(a));
  };
  const band = (top: number) => stroke(`M${P(cx - fw * 0.82, hcY - (hcY - top) * 0.62)}Q${P(cx - fw * 0.3, top + 0.6)} ${P(cx + fw * 0.35, top + 1.6)}`, shade(hairC, 0.55), 2.2, op(0.4));
  let fh = '';
  if (!helm && !veil) {
    if (female) {
      const px = cx + (uPart < 0.6 ? 0 : (uPart - 0.8) * 16);
      const top = capTop - 0.5;
      const o = arc(3.4, top, 6, 0.03, eyeY + 6);
      const h: Pt[] = [[R + 2, eyeY + 6], [R - 0.3, eyeY - 1], [R - 1.8, browY - 2.5], [px + 8, hy + 0.6], [px, hy - 1.4], [px - 8, hy + 0.6], [L + 1.8, browY - 2.5], [L + 0.3, eyeY - 1], [L - 2, eyeY + 6]];
      fh += path(spline(o, false, true) + tail(h), hairPaint, hairOut);
      fh += stroke(`M${P(px, hy - 1)}Q${P(cx - 10, hy - 1.5)} ${P(L - 0.5, browY + 2)}M${P(px, hy - 1)}Q${P(cx + 10, hy - 1.5)} ${P(R + 0.5, browY + 2)}M${P(px - 1, hy - 3)}Q${P(cx - 13, T + 1)} ${P(L - 2.5, browY)}M${P(px + 1, hy - 3)}Q${P(cx + 13, T + 1)} ${P(R + 2.5, browY)}M${P(px, hy - 2)}L${P(px * 0.3 + cx * 0.7, top + 1.5)}`, hairD, 0.9, op(0.5));
      fh += band(top);
      if (hs === 'flavian') {
        let c1 = '', c2 = '';
        for (let i = 0; i < 9; i++) {
          const a = Math.PI * (1.08 + (i / 8) * 0.84);
          c1 += `M${P(cx + Math.cos(a) * (fw + 0.5), hy + 6 + Math.sin(a) * 13)}h0`;
          if (i > 0 && i < 8) c2 += `M${P(cx + Math.cos(a) * (fw - 3.5), hy + 2 + Math.sin(a) * 17)}h0`;
        }
        fh += layers(c2 + c1, [[shade(hairC, -0.45), 6.8], [hairC, 5.6], [shade(hairC, 0.3), 2.2, 0.7, '-.9 -.9']]);
      }
      if (hs === 'crown') {
        let bb = '';
        for (let i = 0; i < 9; i++) {
          const a = Math.PI * (1.05 + (i / 8) * 0.9);
          bb += leafPath(cx + Math.cos(a) * (fw + 1), hy + 3 + Math.sin(a) * 9, 6.4, 2.6, a + Math.PI / 2 + 0.5);
        }
        fh += path(bb, shade(hairC, 0.12), hairOut);
      }
      if (hs === 'curlsf') {
        let c1 = '';
        for (let i = 0; i < 6; i++) c1 += `M${P(L - 1.5 + (i % 2) * 1.5, browY + 1 + i * 3.4)}h0M${P(R + 1.5 - (i % 2) * 1.5, browY + 1 + i * 3.4)}h0`;
        fh += layers(c1, [[shade(hairC, -0.45), 5.8], [hairC, 4.6], [shade(hairC, 0.3), 1.8, 0.6, '-.7 -.7']]);
      }
    } else if (bald === 2) {
      // horseshoe: sides only + scalp shine
      fh += mirror(path(`M${P(R - 1, browY - 3)}C${P(R + 3, browY - 5)} ${P(cx + cw + 3, eyeY - 2)} ${P(cx + cw + 0.5, eyeY + 3)}L${P(cx + cw - 1, eyeY + 2)}C${P(cx + cw - 0.6, eyeY - 3)} ${P(R - 0.5, browY - 1)} ${P(R - 1.5, browY - 1)}Z`, hairPaint, hairOut));
      fh += stroke(`M${P(cx - 9, T + 5)}Q${P(cx - 4, T + 2)} ${P(cx + 2, T + 2.5)}`, W, 2.2, op(0.45));
    } else {
      const buzz = hs === 'buzz';
      const top = buzz ? T - 1 : capTop;
      const ext = buzz ? 0.7 : hs === 'curly' ? 1.8 : 1.6;
      const o = arc(ext, top, hs === 'tousled' ? 9 : 6, hs === 'tousled' ? 0.07 : 0.02, eyeY - 1);
      const hl = hy + (bald === 1 ? -3 : 0);
      const sp = cx + (uPart - 0.5) * 12;
      let edge: string;
      if ((hs === 'crop' || hs === 'tousled') && !bald) {
        // forward-combed locks, tips pointing down
        const k = hs === 'crop' ? 6 : 5;
        edge = `L${P(R - 0.6, eyeY - 1)}L${P(R - 0.8, hl + 2)}`;
        for (let i = 0; i < k; i++) {
          const x0 = R - 0.8 - (i * (2 * fw - 1.6)) / k, x1 = R - 0.8 - ((i + 1) * (2 * fw - 1.6)) / k;
          const ty = hl + 4 - Math.abs(i - k / 2 + 0.5) * 0.6 + (hs === 'tousled' ? (i % 2) * 1.5 : 0);
          edge += `Q${P(x0 - 0.6, ty - 1.5)} ${P((x0 + x1) / 2 - 1.4, ty)}Q${P(x1 + 1.5, ty - 2.4)} ${P(x1, hl + 0.6)}`;
        }
        edge += `L${P(L + 0.6, eyeY - 1)}Z`;
      } else if (hs === 'curly' && !bald) {
        edge = `L${P(R - 0.6, eyeY - 1)}L${P(R - 1, hl + 2)}`;
        for (let i = 0; i < 6; i++) edge += `A3,3 0 0 1 ${P(R - 1 - ((i + 1) * (2 * fw - 2)) / 6, hl + 1.5 - (i === 2 || i === 3 ? 0.6 : 0))}`;
        edge += `L${P(L + 0.6, eyeY - 1)}Z`;
      } else if (bald === 1) {
        edge = tail([[R - 0.6, eyeY - 1], [R - 1.6, hl - 1], [cx + 6, hl - 3.5], [cx + 2.5, hl + 1.2], [cx, hl + 2], [cx - 2.5, hl + 1.2], [cx - 6, hl - 3.5], [L + 1.6, hl - 1], [L + 0.6, eyeY - 1]]);
      } else {
        edge = tail([[R - 0.6, eyeY - 1], [R - 1, hl + 3], [sp + 7, hl - 0.2], [sp, hl + 1.2], [sp - 7, hl - 0.2], [L + 1, hl + 3], [L + 0.6, eyeY - 1]]);
      }
      const outerD = spline(o, false, true);
      if (hs === 'curly' && !bald) {
        let bumps = '';
        for (let i = 0; i < 9; i++) {
          const a = Math.PI * (0.02 + (i / 8) * 0.96);
          bumps += `M${P(cx + Math.cos(a) * (fw + 1.2), hcY - Math.sin(a) * (hcY - top - 1.2))}h0`;
        }
        fh += layers(bumps, [[shade(hairC, -0.5), 7.6], [hairC, 6.2], [shade(hairC, 0.25), 2.4, 0.5, '-1 -1']]);
      }
      fh += path(outerD + edge, buzz ? mix(hairC, skin, 0.3) : hairPaint, hairOut + (buzz ? op(0.85) : ''));
      if (hs === 'curly' && !bald) {
        let cu = '';
        for (let i = 0; i < 9; i++) {
          const a = Math.PI * (0.12 + (i / 8) * 0.76);
          const rr = i % 2 ? 0.45 : 0.75;
          cu += `M${P(cx + Math.cos(a) * fw * rr, hcY - 3 - Math.sin(a) * (hcY - top - 3) * rr)}a1.7,1.7 0 1 1 ${P(2, 1)}`;
        }
        fh += stroke(cu, hairD, 1, op(0.7));
      } else if (!buzz) {
        fh += strands(top, hl + 1);
        if (hs === 'wavy' && !bald) fh += path(`M${P(sp - 1, hl)}C${P(sp - 6, hl + 2)} ${P(sp - 9, hl + 5)} ${P(sp - 8, hl + 8)}C${P(sp - 6, hl + 5)} ${P(sp - 3, hl + 3)} ${P(sp + 2, hl + 1)}Z`, hairPaint, hairOut);
      }
      if (!buzz) fh += band(top);
    }
  }
  if (veil) {
    const vc = mix(pal.accent2, pal.stoneDark, 0.2);
    const px = cx;
    fh += path(`M${P(L - 1, eyeY + 2)}C${P(L - 1, hy)} ${P(px - 6, hy - 1)} ${P(px, hy - 1.5)}C${P(px + 6, hy - 1)} ${P(R + 1, hy)} ${P(R + 1, eyeY + 2)}L${P(R + 3, eyeY + 2)}C${P(R + 4, T)} ${P(L - 4, T)} ${P(L - 3, eyeY + 2)}Z`, hairPaint, hairOut);
    fh += path(`M${P(L - 4, 112)}C${P(L - 6, 70)} ${P(L - 5, hy - 8)} ${P(cx, T - 3.5)}C${P(R + 5, hy - 8)} ${P(R + 6, 70)} ${P(R + 4, 112)}L${P(R + 9, 112)}C${P(R + 11, 70)} ${P(R + 8, T - 9)} ${P(cx, T - 9)}C${P(L - 8, T - 9)} ${P(L - 11, 70)} ${P(L - 9, 112)}Z`, mix(vc, W, 0.05), out(vc));
    fh += stroke(`M${P(L - 7, 80)}Q${P(L - 8, 50)} ${P(cx - 8, T - 6)}`, W, 1.4, op(0.35));
  }
  s += fh;

  // ======================= headgear
  let hg = '';
  const bandY = browY - 3;
  if (gear === 'cap') {
    const lc = mix('#8a5a32', pal.stoneDark, 0.2);
    hg += path(`M${P(L - 3, bandY + 2)}C${P(L - 4, T - 10)} ${P(R + 4, T - 10)} ${P(R + 3, bandY + 2)}Z`, lc, out(lc));
    hg += path(`M${P(L - 3.5, bandY + 3.5)}Q${P(cx, bandY - 2.5)} ${P(R + 3.5, bandY + 3.5)}L${P(R + 3.2, bandY - 0.5)}Q${P(cx, bandY - 6.5)} ${P(L - 3.2, bandY - 0.5)}Z`, shade(lc, 0.2), out(lc));
    hg += stroke(`M${P(cx, T - 1.6)}V${n(bandY - 4)}M${P(cx - 10, T + 2)}Q${P(cx - 12, bandY - 6)} ${P(cx - 13, bandY - 3)}M${P(cx + 10, T + 2)}Q${P(cx + 12, bandY - 6)} ${P(cx + 13, bandY - 3)}`, shade(lc, -0.4), 0.8, ' stroke-dasharray="1.6 1.4"');
    hg += stroke(`M${P(cx - fw * 0.55, T + 1)}Q${P(cx - 4, T - 2.8)} ${P(cx + 3, T - 3)}`, W, 1.6, op(0.3));
  } else if (gear === 'galea' || gear === 'glad') {
    const mp = `url(#${id}m)`;
    const mo2 = out(metal);
    const md = shade(metal, -0.45);
    if (gear === 'galea') {
      const crest = ai === 5 ? '#e0b050' : gu[2] < 0.6 ? '#c0281e' : pal.accent;
      const trans = ai >= 4 && gu[4] < 0.5; // centurion: transverse crest
      if (trans) {
        hg += path(`M${P(L - 4, T + 1)}C${P(L - 6, T - 12)} ${P(R + 6, T - 12)} ${P(R + 4, T + 1)}Q${P(cx, T - 4)} ${P(L - 4, T + 1)}Z`, crest, out(crest));
        let fb = '';
        for (let i = 1; i < 8; i++) fb += `M${P(L - 2 + i * ((2 * fw + 4) / 8), T - 2.5)}v-5`;
        hg += stroke(fb, shade(crest, -0.35), 0.8);
      } else {
        hg += path(`M${P(cx - 5.5, T - 3)}C${P(cx - 7, T - 17)} ${P(cx + 7, T - 17)} ${P(cx + 5.5, T - 3)}Z`, crest, out(crest));
        hg += stroke(`M${P(cx - 2.5, T - 4)}V${n(T - 13)}M${P(cx + 1.8, T - 4)}V${n(T - 13)}`, shade(crest, -0.35), 0.8);
        hg += stroke(`M${P(cx - 3, T - 13)}Q${P(cx - 1, T - 15)} ${P(cx + 1, T - 14)}`, W, 1, op(0.4));
      }
      // cheek guards
      hg += mirror(path(`M${P(R + 2.5, bandY + 1)}L${P(cx + cw + 2, eyeY + 12)}Q${P(cx + cw - 2, eyeY + 17)} ${P(cx + cw - 5.5, eyeY + 12)}Q${P(cx + cw - 3, eyeY + 4)} ${P(R - 4, bandY + 2)}Z`, mp, mo2) + circ(cx + cw - 1, eyeY + 8, 1, md));
    } else {
      // gladiator: fin crest + wide brim + grille side plates
      hg += path(`M${P(cx - 3, T - 1)}C${P(cx - 6, T - 14)} ${P(cx + 4, T - 20)} ${P(cx + 16, T - 15)}Q${P(cx + 8, T - 10)} ${P(cx + 5, T - 1)}Z`, mp, mo2);
      hg += path(`M${P(cx + 14, T - 15)}c${P(4, -4)} ${P(9, -1)} ${P(10, 3)}c${P(-4, -1)} ${P(-7, 0)} ${P(-10, -3)}Z`, pal.accent, out(pal.accent));
      let holes = '';
      for (let i = 0; i < 4; i++) holes += `M${P(cx + cw - 1.6 + (i % 2) * 1.2, bandY + 5 + i * 3.6)}h0`;
      hg += mirror(path(`M${P(R + 3, bandY)}L${P(cx + cw + 3, eyeY + 13)}Q${P(cx + cw - 1, eyeY + 17)} ${P(cx + cw - 6, eyeY + 13)}L${P(cx + cw - 5, bandY + 3)}Z`, mp, mo2) + stroke(holes, '#2a1a12', 1.7));
    }
    hg += path(`M${P(L - 3.5, bandY + 2)}C${P(L - 4.5, T - 11)} ${P(R + 4.5, T - 11)} ${P(R + 3.5, bandY + 2)}Z`, mp, mo2);
    if (gear === 'glad') hg += path(`M${P(L - 11, bandY + 5)}Q${P(cx, bandY - 4)} ${P(R + 11, bandY + 5)}Q${P(R + 12, bandY + 1)} ${P(R + 4, bandY - 1)}Q${P(cx, bandY - 8)} ${P(L - 4, bandY - 1)}Q${P(L - 12, bandY + 1)} ${P(L - 11, bandY + 5)}Z`, mp, mo2);
    else hg += path(`M${P(L - 4.5, bandY + 4)}Q${P(cx, bandY - 2)} ${P(R + 4.5, bandY + 4)}L${P(R + 4.2, bandY + 0.5)}Q${P(cx, bandY - 5.5)} ${P(L - 4.2, bandY + 0.5)}Z`, shade(metal, -0.15), mo2);
    hg += stroke(`M${P(cx - fw * 0.6, T + 2)}Q${P(cx - 5, T - 3.5)} ${P(cx + 2, T - 4)}`, W, 2, op(0.7));
    hg += stroke(`M${P(R - 1, T + 4)}Q${P(R + 3, T + 9)} ${P(R + 3.4, bandY - 1)}`, rim, 1.6, op(0.7));
    if (ai >= 7) hg += circ(cx, bandY - 1, 1.6, '#c0281e', out('#c0281e'));
  } else if (gear === 'laurel' || gear === 'imperial') {
    const gold = gear === 'imperial' || ai >= 8;
    const lf = gold ? '#e6b84a' : '#6f9a3a';
    const lo = gold ? '#8a5a12' : '#2f4f1a';
    const y0 = bandY - 2;
    let lv = '';
    const q = (t: number, a: number, b: number, c: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
    for (let i = 0; i < 6; i++) {
      const t = 0.06 + i * 0.18;
      const bx = q(t, cx + 1.5, cx + fw * 0.8, cx + fw + 3), by = q(t, y0 - 1.4, y0 - 3.4, y0 + 6);
      const ta = Math.atan2(q(t + 0.01, y0 - 1.4, y0 - 3.4, y0 + 6) - by, q(t + 0.01, cx + 1.5, cx + fw * 0.8, cx + fw + 3) - bx);
      for (const k of [-0.6, 0.6]) lv += `M${P(bx, by)}l${P(Math.cos(ta + k) * 4.6, Math.sin(ta + k) * 4.6)}`;
    }
    hg += `<g id="${id}r">${stroke(lv, lo, 3.8)}${stroke(lv, lf, 2.4)}</g><use href="#${id}r" transform="matrix(-1 0 0 1 120 0)"/>`;
    if (gear === 'imperial') hg += circ(cx, y0 - 1.6, 2.2, '#c0281e', out('#c0281e')) + circ(cx - fw + 3, y0 + 2.4, 1.5, '#2a7ab0', out('#2a7ab0')) + circ(cx + fw - 3, y0 + 2.4, 1.5, '#2a9a5a', out('#2a9a5a'));
  } else if (gear === 'diadem') {
    const y0 = bandY - (female ? 1.2 : 0);
    hg += path(`M${P(L - 1, y0 + 4)}Q${P(cx, y0 - 3)} ${P(R + 1, y0 + 4)}L${P(R + 1, y0 + 1.5)}Q${P(cx, y0 - 5.5)} ${P(L - 1, y0 + 1.5)}Z`, '#e6b84a', out('#e6b84a'));
    hg += path(`M${P(cx - 5, y0 - 0.5)}Q${P(cx - 2, y0 - 4)} ${P(cx, y0 - 8)}Q${P(cx + 2, y0 - 4)} ${P(cx + 5, y0 - 0.5)}Z`, '#e6b84a', out('#e6b84a'));
    hg += circ(cx, y0 - 2, 1.8, ai >= 9 ? '#8a3aa8' : '#c0281e', out('#c0281e'));
    hg += stroke(`M${P(cx - 9, y0)}h0M${P(cx + 9, y0)}h0M${P(cx - 14, y0 + 1.6)}h0M${P(cx + 14, y0 + 1.6)}h0`, '#fff8e8', 1.5);
  }
  s += hg;

  s += '</g></g>';
  s += `<circle cx="60" cy="60" r="58.3" stroke="${ring}" stroke-width="3.4"/></g>`;
  let defs = `<radialGradient id="${id}b" cx=".5" cy=".4" r=".6"><stop stop-color="${bgIn}"/><stop offset="1" stop-color="${bgOut}"/></radialGradient>`;
  defs += lin(id + 's', hi, skin, sh, 1, 0.35, 0.45);
  if (s.includes(id + 'h)')) defs += lin2(id + 'h', shade(hairC, 0.2), hairD);
  if (s.includes(id + 'c)')) defs += lin2(id + 'c', shade(cc, 0.15), shade(cc, -0.3), 1, 0.4);
  if (s.includes(id + 'm)')) defs += lin(id + 'm', shade(metal, 0.5), metal, shade(metal, -0.45), 1, 0.6, 0.4);
  defs += `<path id="${id}f" d="${headD}"/><clipPath id="${id}k"><use href="#${id}f"/></clipPath><clipPath id="${id}o"><circle cx="60" cy="60" r="57"/></clipPath>`;
  s = `<defs>${defs}</defs><g fill="none" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">` + s;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">${s}</svg>`;
}
