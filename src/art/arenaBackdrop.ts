/**
 * Arena backdrops (viewBox 0 0 1600 900, slice). Twelve distinct Roman
 * architectures matching ARENAS[i].architecture. Composition rule: detail
 * lives on the horizon band and the left/right edges; the lower ~40% (where
 * the chessboard sits) stays calm.
 */
import { ARENAS, type Palette } from '../world/arenas';
import { createRng, mixSeed, type Rng } from '../core/rng';
import { idPrefix, laurelArc, linGrad, mix, n, radGrad, shade, starPath } from './svgUtil';

const W = 1600;
const H = 900;

type Ctx = { id: string; r: Rng; pal: Palette; defs: string[] };

// ------------------------------------------------------------------ primitives

function rect(x: number, y: number, w: number, h: number, fill: string, extra = ''): string {
  return `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
}

function path(d: string, fill: string, extra = ''): string {
  return `<path d="${d}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;
}

function sky(c: Ctx, top: string, bottom: string, mid?: string): string {
  c.defs.push(linGrad(`${c.id}sk`, mid ? [[0, top], [0.55, mid], [1, bottom]] : [[0, top], [1, bottom]]));
  return rect(0, 0, W, H, `url(#${c.id}sk)`);
}

function glow(c: Ctx, key: string, cx: number, cy: number, r: number, color: string, op = 0.9): string {
  c.defs.push(radGrad(`${c.id}${key}`, [[0, color, op], [0.35, color, op * 0.45], [1, color, 0]]));
  return `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="url(#${c.id}${key})"/>`;
}

function ground(c: Ctx, y: number, top: string, bottom: string): string {
  c.defs.push(linGrad(`${c.id}gr`, [[0, top], [1, bottom]]));
  return rect(0, y, W, H - y, `url(#${c.id}gr)`);
}

function vignette(c: Ctx, strength = 0.55): string {
  c.defs.push(radGrad(`${c.id}vg`, [[0.55, '#000', 0], [1, '#000', strength]], 0.5, 0.45, 0.75));
  return rect(0, 0, W, H, `url(#${c.id}vg)`);
}

/** Rolling silhouette (hills, crowds, clouds banks). */
function ridge(r: Rng, y: number, amp: number, step: number, fill: string, extra = '', bottom = H): string {
  let d = `M0,${n(bottom)}L0,${n(y)}`;
  let x = 0;
  let prevY = y;
  while (x < W) {
    const nx = Math.min(W, x + step * (0.7 + r.next() * 0.6));
    const ny = y - r.next() * amp;
    d += `Q${n((x + nx) / 2)},${n(Math.min(prevY, ny) - amp * 0.3)} ${n(nx)},${n(ny)}`;
    prevY = ny;
    x = nx;
  }
  return path(d + `L${W},${n(bottom)}Z`, fill, extra);
}

function clouds(c: Ctx, count: number, y0: number, y1: number, color: string, op: number, scale = 1): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    const x = c.r.next() * W;
    const y = y0 + c.r.next() * (y1 - y0);
    const w = (140 + c.r.next() * 220) * scale;
    const h = w * 0.22;
    d += `M${n(x - w / 2)},${n(y)}`;
    d += `C${n(x - w / 2)},${n(y - h)} ${n(x - w * 0.2)},${n(y - h * 1.4)} ${n(x - w * 0.05)},${n(y - h * 0.9)}`;
    d += `C${n(x + w * 0.05)},${n(y - h * 2)} ${n(x + w * 0.38)},${n(y - h * 1.6)} ${n(x + w * 0.32)},${n(y - h * 0.6)}`;
    d += `C${n(x + w * 0.5)},${n(y - h * 0.9)} ${n(x + w * 0.56)},${n(y - h * 0.1)} ${n(x + w / 2)},${n(y)}Z`;
  }
  return path(d, color, `opacity="${n(op)}"`);
}

function stars(c: Ctx, count: number, yMax: number, color = '#fff', op = 0.9): string {
  let d = '';
  let big = '';
  for (let i = 0; i < count; i++) {
    const x = c.r.next() * W;
    const y = Math.pow(c.r.next(), 1.4) * yMax;
    if (c.r.chance(0.06)) big += starPath(x, y, 5 + c.r.next() * 4, 0.25, 4, 0);
    else d += `M${n(x)},${n(y)}h.1`;
  }
  return (
    `<path d="${d}" stroke="${color}" stroke-width="2.6" stroke-linecap="round" opacity="${n(op * 0.75)}"/>` +
    (big ? path(big, color, `opacity="${n(op)}"`) : '')
  );
}

/** Column defined once per backdrop and reused via <use>. Unit size 40×200 at origin (bottom-centre). */
function defColumn(c: Ctx, key: string, light: string, dark: string, capital: string): void {
  c.defs.push(linGrad(`${c.id}${key}g`, [[0, shade(light, 0.2)], [0.35, light], [1, dark]], 0, 0, 1, 0));
  const g = `url(#${c.id}${key}g)`;
  c.defs.push(
    `<g id="${c.id}${key}">` +
      rect(-24, -12, 48, 12, g) +
      rect(-20, -16, 40, 5, g) +
      rect(-17, -184, 34, 168, g) +
      `<path d="M-9,-182V-18M0,-182V-18M9,-182V-18" stroke="${dark}" stroke-width="2" opacity=".35"/>` +
      rect(-21, -192, 42, 8, capital) +
      rect(-26, -200, 52, 9, capital) +
      `</g>`,
  );
}

function useAt(c: Ctx, key: string, x: number, y: number, sx: number, sy = sx): string {
  return `<use href="#${c.id}${key}" transform="translate(${n(x)},${n(y)}) scale(${n(sx)},${n(sy)})"/>`;
}

function colonnade(c: Ctx, key: string, x0: number, x1: number, baseY: number, count: number, scale: number): string {
  let s = '';
  for (let i = 0; i < count; i++) {
    const x = count === 1 ? x0 : x0 + ((x1 - x0) * i) / (count - 1);
    s += useAt(c, key, x, baseY, scale);
  }
  return s;
}

function pediment(x: number, y: number, w: number, h: number, fill: string, trim: string, dark: string): string {
  return (
    path(`M${n(x)},${n(y)}L${n(x + w / 2)},${n(y - h)}L${n(x + w)},${n(y)}Z`, fill) +
    path(`M${n(x + w * 0.1)},${n(y - 4)}L${n(x + w / 2)},${n(y - h + 12)}L${n(x + w * 0.9)},${n(y - 4)}Z`, dark, 'opacity=".35"') +
    path(`M${n(x - 6)},${n(y)}L${n(x + w / 2)},${n(y - h - 6)}L${n(x + w + 6)},${n(y)}`, 'none', `stroke="${trim}" stroke-width="6"`)
  );
}

/** Stepped temple front: stylobate, columns, entablature, pediment. */
function temple(c: Ctx, key: string, x: number, baseY: number, w: number, colScale: number, count: number, stone: string, trim: string, dark: string): string {
  const colH = 200 * colScale;
  let s = '';
  // cella shadow behind columns
  s += rect(x + 10, baseY - colH, w - 20, colH, shade(dark, -0.2), 'opacity=".75"');
  s += colonnade(c, key, x + 26 * colScale, x + w - 26 * colScale, baseY, count, colScale);
  // steps
  for (let i = 0; i < 3; i++) s += rect(x - 8 - i * 10, baseY + i * 9, w + 16 + i * 20, 9, i % 2 ? shade(stone, -0.12) : stone);
  // entablature
  s += rect(x - 8, baseY - colH - 30, w + 16, 30, stone);
  s += rect(x - 8, baseY - colH - 18, w + 16, 6, trim);
  s += pediment(x - 8, baseY - colH - 30, w + 16, (w + 16) * 0.22, stone, shade(stone, 0.4), dark);
  return s;
}

/** Wall with a row of arches (dark openings), rim-lit. */
function arcade(x: number, y: number, w: number, h: number, count: number, wall: string, hole: string, archRatio = 0.62, pier = 0.24): string {
  let s = rect(x, y, w, h, wall);
  const cw = w / count;
  let d = '';
  for (let i = 0; i < count; i++) {
    const ax = x + i * cw + cw * pier;
    const aw = cw * (1 - pier * 2);
    const top = y + h * (1 - archRatio);
    d += `M${n(ax)},${n(y + h)}V${n(top + aw / 2)}A${n(aw / 2)},${n(aw / 2)} 0 0,1 ${n(ax + aw)},${n(top + aw / 2)}V${n(y + h)}Z`;
  }
  s += path(d, hole);
  s += rect(x, y, w, Math.max(3, h * 0.05), shade(wall, 0.25));
  s += rect(x, y + h - Math.max(3, h * 0.04), w, Math.max(3, h * 0.04), shade(wall, -0.2));
  return s;
}

function crenellations(x0: number, x1: number, y: number, mw: number, mh: number, fill: string): string {
  let d = '';
  for (let x = x0; x < x1 - mw * 0.5; x += mw * 2) d += `M${n(x)},${n(y)}v${n(-mh)}h${n(mw)}v${n(mh)}Z`;
  return path(d, fill);
}

/** Hanging banner with swallowtail and gold rod. */
function banner(x: number, y: number, w: number, h: number, color: string, trim: string, emblem = ''): string {
  const tail = h * 0.16;
  let s = path(
    `M${n(x)},${n(y)}H${n(x + w)}V${n(y + h)}L${n(x + w / 2)},${n(y + h - tail)}L${n(x)},${n(y + h)}Z`,
    color,
  );
  s += path(`M${n(x + w * 0.62)},${n(y)}H${n(x + w)}V${n(y + h)}L${n(x + w * 0.62)},${n(y + h - tail * 0.6)}Z`, '#000', 'opacity=".18"');
  s += path(`M${n(x + w * 0.1)},${n(y + 6)}V${n(y + h - tail - 4)}M${n(x + w * 0.9)},${n(y + 6)}V${n(y + h - tail * 0.4 - 6)}`, 'none', `stroke="${trim}" stroke-width="${n(Math.max(2, w * 0.05))}"`);
  s += rect(x - w * 0.12, y - 6, w * 1.24, 8, trim, 'rx="3"');
  if (emblem) s += emblem;
  return s;
}

function wreathGlyph(cx: number, cy: number, r: number, color: string): string {
  const leaves =
    laurelArc(cx, cy, r, Math.PI * 0.62, Math.PI * 1.42, 5, r * 0.42, r * 0.13) +
    laurelArc(cx, cy, r, Math.PI * 0.38, -Math.PI * 0.42, 5, r * 0.42, r * 0.13);
  return path(leaves + starPath(cx, cy, r * 0.42, 0.45), color);
}

function scorpionGlyph(cx: number, cy: number, s: number, color: string): string {
  const P = (x: number, y: number) => `${n(cx + x * s)},${n(cy + y * s)}`;
  return (
    path(`M${P(0, -6)}A${n(5 * s)},${n(8 * s)} 0 1,0 ${P(0.1, -6)}Z`, color) +
    path(`M${P(-4, -8)}Q${P(-12, -12)} ${P(-10, -20)}M${P(4, -8)}Q${P(12, -12)} ${P(10, -20)}M${P(0, 9)}Q${P(2, 18)} ${P(9, 17)}Q${P(14, 14)} ${P(11, 8)}M${P(-4, -2)}L${P(-11, 0)}M${P(4, -2)}L${P(11, 0)}M${P(-4, 3)}L${P(-11, 6)}M${P(4, 3)}L${P(11, 6)}`, 'none', `stroke="${color}" stroke-width="${n(2.6 * s)}" stroke-linecap="round"`)
  );
}

/** Military standard: pole + optional vexillum or aquila. */
function standard(x: number, baseY: number, h: number, kind: 'vex' | 'aquila', red: string, gold: string, s = 1): string {
  let out = rect(x - 4 * s, baseY - h, 8 * s, h, '#5a3a20');
  out += path(`M${n(x - 4 * s)},${n(baseY - h)}h${n(3 * s)}V${n(baseY)}h${n(-3 * s)}Z`, '#fff', 'opacity=".2"');
  if (kind === 'vex') {
    const top = baseY - h + 30 * s;
    out += rect(x - 50 * s, top, 100 * s, 7 * s, gold, 'rx="3"');
    out += path(`M${n(x - 44 * s)},${n(top + 7 * s)}H${n(x + 44 * s)}V${n(top + 92 * s)}Q${n(x)},${n(top + 84 * s)} ${n(x - 44 * s)},${n(top + 92 * s)}Z`, red);
    out += path(`M${n(x + 10 * s)},${n(top + 7 * s)}H${n(x + 44 * s)}V${n(top + 92 * s)}Q${n(x + 26 * s)},${n(top + 87 * s)} ${n(x + 10 * s)},${n(top + 88 * s)}Z`, '#000', 'opacity=".18"');
    let fringe = '';
    for (let i = 0; i <= 10; i++) fringe += `M${n(x - 44 * s + i * 8.8 * s)},${n(top + 90 * s - Math.sin((i / 10) * Math.PI) * 6 * s)}v${n(10 * s)}`;
    out += path(fringe, 'none', `stroke="${gold}" stroke-width="${n(3 * s)}"`);
    out += wreathGlyph(x, top + 46 * s, 22 * s, gold);
    out += path(`M${n(x)},${n(baseY - h - 26 * s)}l${n(10 * s)},${n(24 * s)}h${n(-20 * s)}Z`, gold);
  } else {
    const ty = baseY - h;
    // eagle: spread wings + body on a plinth bar
    out += rect(x - 26 * s, ty + 40 * s, 52 * s, 8 * s, gold, 'rx="3"');
    out += path(
      `M${n(x)},${n(ty + 40 * s)}C${n(x - 8 * s)},${n(ty + 30 * s)} ${n(x - 20 * s)},${n(ty + 10 * s)} ${n(x - 52 * s)},${n(ty - 10 * s)}C${n(x - 46 * s)},${n(ty + 4 * s)} ${n(x - 48 * s)},${n(ty + 8 * s)} ${n(x - 42 * s)},${n(ty + 14 * s)}C${n(x - 36 * s)},${n(ty + 22 * s)} ${n(x - 26 * s)},${n(ty + 30 * s)} ${n(x - 10 * s)},${n(ty + 36 * s)}` +
        `L${n(x + 10 * s)},${n(ty + 36 * s)}C${n(x + 26 * s)},${n(ty + 30 * s)} ${n(x + 36 * s)},${n(ty + 22 * s)} ${n(x + 42 * s)},${n(ty + 14 * s)}C${n(x + 48 * s)},${n(ty + 8 * s)} ${n(x + 46 * s)},${n(ty + 4 * s)} ${n(x + 52 * s)},${n(ty - 10 * s)}C${n(x + 20 * s)},${n(ty + 10 * s)} ${n(x + 8 * s)},${n(ty + 30 * s)} ${n(x)},${n(ty + 40 * s)}Z`,
      gold,
    );
    out += path(`M${n(x - 7 * s)},${n(ty + 38 * s)}C${n(x - 8 * s)},${n(ty + 20 * s)} ${n(x - 6 * s)},${n(ty + 6 * s)} ${n(x)},${n(ty + 2 * s)}C${n(x + 6 * s)},${n(ty)} ${n(x + 12 * s)},${n(ty + 2 * s)} ${n(x + 16 * s)},${n(ty + 6 * s)}L${n(x + 7 * s)},${n(ty + 9 * s)}C${n(x + 8 * s)},${n(ty + 20 * s)} ${n(x + 8 * s)},${n(ty + 30 * s)} ${n(x + 7 * s)},${n(ty + 38 * s)}Z`, gold);
    out += path(`M${n(x - 30 * s)},${n(ty + 6 * s)}Q${n(x - 16 * s)},${n(ty + 20 * s)} ${n(x - 8 * s)},${n(ty + 24 * s)}M${n(x + 30 * s)},${n(ty + 6 * s)}Q${n(x + 16 * s)},${n(ty + 20 * s)} ${n(x + 8 * s)},${n(ty + 24 * s)}`, 'none', `stroke="#fff" stroke-opacity=".45" stroke-width="${n(2 * s)}"`);
    out += wreathGlyph(x, ty + 82 * s, 20 * s, gold);
  }
  return out;
}

function torch(c: Ctx, x: number, y: number, key: string): string {
  return (
    glow(c, key, x, y - 16, 90, '#ffb347', 0.75) +
    rect(x - 4, y - 6, 8, 46, '#2a1810') +
    path(`M${n(x - 10)},${n(y - 6)}H${n(x + 10)}L${n(x + 6)},${n(y + 2)}H${n(x - 6)}Z`, '#3a2416') +
    path(`M${n(x)},${n(y - 40)}C${n(x + 12)},${n(y - 22)} ${n(x + 10)},${n(y - 8)} ${n(x)},${n(y - 6)}C${n(x - 10)},${n(y - 8)} ${n(x - 12)},${n(y - 22)} ${n(x)},${n(y - 40)}Z`, '#ffcf5a') +
    path(`M${n(x)},${n(y - 28)}C${n(x + 5)},${n(y - 18)} ${n(x + 4)},${n(y - 10)} ${n(x)},${n(y - 9)}C${n(x - 4)},${n(y - 10)} ${n(x - 5)},${n(y - 18)} ${n(x)},${n(y - 28)}Z`, '#fff6c8')
  );
}

function cypress(x: number, baseY: number, h: number, fill: string): string {
  const w = h * 0.16;
  return path(`M${n(x)},${n(baseY - h)}C${n(x + w * 0.8)},${n(baseY - h * 0.7)} ${n(x + w)},${n(baseY - h * 0.2)} ${n(x + w * 0.4)},${n(baseY)}H${n(x - w * 0.4)}C${n(x - w)},${n(baseY - h * 0.2)} ${n(x - w * 0.8)},${n(baseY - h * 0.7)} ${n(x)},${n(baseY - h)}Z`, fill);
}

function palm(x: number, baseY: number, h: number, trunk: string, leaf: string, lean = 1): string {
  const tx = x + lean * h * 0.12;
  const ty = baseY - h;
  let s = path(`M${n(x - 7)},${n(baseY)}Q${n(x + lean * h * 0.02)},${n(baseY - h * 0.5)} ${n(tx - 3)},${n(ty)}h6Q${n(x + 6 + lean * h * 0.04)},${n(baseY - h * 0.5)} ${n(x + 7)},${n(baseY)}Z`, trunk);
  let d = '';
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI + (i / 6) * Math.PI + (i % 2 ? 0.1 : -0.1);
    const len = h * (0.36 + (i % 3) * 0.05);
    const ex = tx + Math.cos(a) * len;
    const ey = ty + Math.sin(a) * len * 0.5 + len * 0.35;
    const mx = tx + Math.cos(a) * len * 0.5;
    const my = ty + Math.sin(a) * len * 0.5 - len * 0.12;
    d += `M${n(tx)},${n(ty)}Q${n(mx)},${n(my - 10)} ${n(ex)},${n(ey)}Q${n(mx)},${n(my + 8)} ${n(tx)},${n(ty)}Z`;
  }
  s += path(d, leaf);
  return s;
}

/** Stone block courses drawn as thin lines over a wall. */
function masonry(x: number, y: number, w: number, h: number, course: number, color: string, op = 0.25): string {
  let d = '';
  let row = 0;
  for (let yy = y + course; yy < y + h; yy += course, row++) {
    d += `M${n(x)},${n(yy)}H${n(x + w)}`;
    for (let xx = x + (row % 2 ? course : course * 2); xx < x + w; xx += course * 3) d += `M${n(xx)},${n(yy)}v${n(-course)}`;
  }
  return path(d, 'none', `stroke="${color}" stroke-width="2" opacity="${n(op)}"`);
}

// ------------------------------------------------------------------ arenas

function ludus(c: Ctx): string {
  const p = c.pal;
  let s = sky(c, p.sky[0], p.sky[1]);
  s += glow(c, 'sn', 1180, 300, 420, '#fff2c4', 0.9);
  s += `<circle cx="1180" cy="300" r="70" fill="#fff6dc" opacity=".9"/>`;
  s += clouds(c, 5, 120, 260, '#fff4e0', 0.35, 1.2);
  s += ridge(c.r, 470, 50, 220, mix(p.sky[1], p.stoneDark, 0.35), 'opacity=".55"');
  s += ridge(c.r, 505, 30, 160, mix(p.sky[1], p.stoneDark, 0.55), 'opacity=".7"');
  // ludus buildings at both edges
  const bld = (x: number, w: number, top: number, flip: boolean) => {
    let b = rect(x, top, w, 600 - top, p.stone);
    b += masonry(x, top + 30, w, 600 - top - 30, 34, p.stoneDark, 0.18);
    b += path(`M${n(x - 20)},${n(top)}L${n(x + (flip ? w * 0.35 : w * 0.65))},${n(top - 70)}L${n(x + w + 20)},${n(top)}Z`, mix(p.accent, p.stoneDark, 0.3));
    b += path(`M${n(x - 20)},${n(top)}H${n(x + w + 20)}v10H${n(x - 20)}Z`, shade(p.stoneDark, -0.2));
    let win = '';
    for (let i = 0; i < Math.floor(w / 70); i++) win += `M${n(x + 30 + i * 70)},${n(top + 50)}h26v40h-26Z`;
    b += path(win, shade(p.stoneDark, -0.35));
    // wooden balcony
    b += rect(x, top + 120, w, 10, '#6b3f22') + path(Array.from({ length: Math.floor(w / 22) }, (_, i) => `M${n(x + 8 + i * 22)},${n(top + 130)}v34`).join(''), 'none', 'stroke="#6b3f22" stroke-width="5"');
    b += rect(x, top + 162, w, 7, '#6b3f22');
    // big arched gate
    const gx = x + w / 2 - 50;
    b += path(`M${n(gx)},600V${n(top + 240)}A50,50 0 0,1 ${n(gx + 100)},${n(top + 240)}V600Z`, shade(p.stoneDark, -0.4));
    return b;
  };
  s += bld(-40, 420, 300, false) + bld(1220, 420, 290, true);
  // red cloth banners from the buildings
  s += banner(330, 330, 54, 170, p.accent, p.accent2) + banner(1250, 320, 54, 170, p.accent, p.accent2);
  // palisade across the horizon
  let stakes = '';
  for (let x = 380; x < 1230; x += 26) {
    const h = 70 + ((x * 7) % 23);
    stakes += `M${x},590V${590 - h}l13,-16l13,16V590Z`;
  }
  s += path(stakes, '#8a5a32');
  s += path(stakes, 'none', 'stroke="#4a2c16" stroke-width="2.5"');
  s += rect(380, 548, 850, 8, '#5a3820') + rect(380, 572, 850, 8, '#5a3820');
  s += ground(c, 585, mix(p.light, p.stone, 0.5), mix(p.stone, p.dark, 0.45));
  s += rect(0, 585, W, 6, shade(p.stoneDark, -0.1), 'opacity=".35"');
  // raked sand
  let rake = '';
  for (let i = 0; i < 6; i++) rake += `M${-50},${640 + i * 46}Q800,${600 + i * 54} 1650,${640 + i * 46}`;
  s += path(rake, 'none', `stroke="${shade(p.stone, 0.35)}" stroke-width="3" opacity=".35"`);
  // training posts (palus) at the edges
  const palus = (x: number, h: number) => {
    let t = rect(x - 22, 880 - h, 44, h, '#7a4a28') + rect(x - 22, 880 - h, 12, h, '#a06a3c');
    t += path(`M${x - 22},${880 - h + 60}h44M${x - 22},${880 - h + 72}h44M${x - 22},${880 - h + 84}h44`, 'none', 'stroke="#d8c08a" stroke-width="5"');
    t += path(`M${x - 22},${880 - h}h44v-12q-22,-10 -44,0Z`, '#5a3418');
    t += path(`M${x - 70},${880 - h + 130}h140`, 'none', 'stroke="#5a3418" stroke-width="14" stroke-linecap="round"');
    t += `<ellipse cx="${x}" cy="882" rx="80" ry="12" fill="#000" opacity=".2"/>`;
    return t;
  };
  s += palus(120, 330) + palus(1480, 300);
  // weapon rack with wooden swords
  let rack = rect(230, 640, 120, 10, '#5a3418') + rect(230, 700, 120, 10, '#5a3418') + rect(234, 630, 10, 130, '#5a3418') + rect(336, 630, 10, 130, '#5a3418');
  for (let i = 0; i < 4; i++) rack += rect(254 + i * 22, 600, 9, 130, '#b07a48') + rect(248 + i * 22, 690, 21, 6, '#4a2c16');
  s += rack;
  return s + vignette(c, 0.45);
}

function camp(c: Ctx): string {
  const p = c.pal;
  let s = sky(c, p.sky[0], p.sky[1]);
  s += glow(c, 'sn', 400, 180, 380, '#ffffff', 0.7);
  s += clouds(c, 9, 90, 330, '#ffffff', 0.85, 1.3);
  s += ridge(c.r, 430, 90, 260, mix(p.sky[0], '#4a6a8a', 0.55), 'opacity=".75"');
  s += ridge(c.r, 480, 50, 200, mix('#7a8a4a', p.sky[1], 0.4));
  // camp rampart & palisade
  s += path('M0,560L0,520Q800,505 1600,520L1600,560Z', '#8a7a4a');
  let stakes = '';
  for (let x = 0; x < W; x += 18) stakes += `M${x},530V${498 - ((x * 13) % 9)}l9,-10l9,10V530Z`;
  s += path(stakes, '#6b4a2a');
  // gate towers (porta praetoria)
  const tower = (x: number) =>
    rect(x, 380, 90, 160, '#7a5432') +
    masonry(x, 380, 90, 160, 20, '#3a2414', 0.4) +
    path(`M${x - 12},380L${x + 45},336L${x + 102},380Z`, p.accent) +
    rect(x - 10, 380, 110, 12, '#4b2e19') +
    rect(x + 30, 410, 30, 34, '#2a1608');
  s += tower(690) + tower(820);
  s += rect(780, 430, 40, 110, '#3a2414');
  s += banner(705, 400, 30, 80, p.accent2, '#e8b04b') + banner(865, 400, 30, 80, p.accent2, '#e8b04b');
  // tent rows
  const tent = (x: number, y: number, w: number, col: string) => {
    const h = w * 0.62;
    return (
      path(`M${n(x)},${n(y)}L${n(x + w * 0.35)},${n(y - h)}H${n(x + w * 1.15)}L${n(x + w * 0.85)},${n(y)}Z`, shade(col, -0.18)) +
      path(`M${n(x)},${n(y)}L${n(x + w * 0.35)},${n(y - h)}L${n(x + w * 0.7)},${n(y)}Z`, col) +
      path(`M${n(x + w * 0.27)},${n(y)}L${n(x + w * 0.35)},${n(y - h * 0.55)}L${n(x + w * 0.43)},${n(y)}Z`, '#3a2414') +
      path(`M${n(x + w * 0.35)},${n(y - h)}l0,-14`, 'none', 'stroke="#5a3a20" stroke-width="3"')
    );
  };
  const tentCol = ['#e9dcc0', '#d8c49a', '#cdb48a'];
  for (let row = 0; row < 3; row++) {
    const y = 540 + row * 26;
    const w = 90 + row * 22;
    for (let i = 0; i < 4 - (row === 2 ? 1 : 0); i++) {
      s += tent(-30 + i * (w + 20) + row * 18, y, w, tentCol[(i + row) % 3]);
      s += tent(W - 30 - (i + 1) * (w + 20) - row * 18, y, w, tentCol[(i + row + 1) % 3]);
    }
  }
  s += ground(c, 600, mix('#b8a06a', p.light, 0.3), mix('#8f6a45', p.dark, 0.5));
  // trodden path
  s += path('M700,600L900,600L1100,900L500,900Z', shade(p.light, -0.05), 'opacity=".35"');
  s += standard(400, 860, 420, 'vex', p.accent, '#e8b04b', 1.2) + standard(1210, 860, 400, 'aquila', p.accent, '#e8b04b', 1.15);
  s += standard(170, 880, 330, 'vex', p.accent2, '#e8b04b', 0.9);
  s += standard(1440, 880, 330, 'vex', p.accent, '#e8b04b', 0.9);
  return s + vignette(c, 0.4);
}

function fortress(c: Ctx): string {
  const p = c.pal;
  let s = sky(c, p.sky[0], p.sky[1]);
  s += glow(c, 'sn', 820, 460, 520, '#ffe2b0', 0.55);
  s += clouds(c, 7, 80, 260, shade(p.sky[0], -0.25), 0.6, 1.6);
  s += clouds(c, 5, 160, 320, '#e8dccc', 0.35, 1.2);
  const stone = p.stone;
  const dk = p.stoneDark;
  // main curtain wall
  s += rect(0, 360, W, 230, shade(stone, -0.08));
  s += masonry(0, 360, W, 230, 28, dk, 0.35);
  s += crenellations(0, W, 362, 26, 26, shade(stone, -0.08));
  s += rect(0, 360, W, 6, shade(stone, 0.3));
  // arrow slits
  let slits = '';
  for (let x = 300; x < 1320; x += 110) if (x < 600 || x > 1000) slits += `M${x},420h8v44h-8Z`;
  s += path(slits, '#1a1d22');
  // flanking towers
  const tower = (x: number, w: number, top: number) => {
    let t = rect(x, top, w, 590 - top, stone);
    t += rect(x + w * 0.6, top, w * 0.4, 590 - top, '#000', 'opacity=".18"');
    t += masonry(x, top, w, 590 - top, 30, dk, 0.4);
    t += crenellations(x - 8, x + w + 8, top, 24, 30, stone);
    t += rect(x - 8, top - 2, w + 16, 14, shade(stone, -0.15));
    t += path(`M${n(x + w / 2 - 10)},${top + 70}h20v60h-20Z`, '#1a1d22');
    t += banner(x + w / 2 - 34, top + 160, 68, 220, p.accent, p.accent2, wreathGlyph(x + w / 2, top + 240, 18, p.accent2));
    return t;
  };
  s += tower(80, 230, 170) + tower(1290, 230, 180);
  // gatehouse
  s += rect(600, 250, 400, 340, shade(stone, 0.06));
  s += masonry(600, 250, 400, 340, 30, dk, 0.35);
  s += crenellations(592, 1010, 250, 26, 30, shade(stone, 0.06));
  s += rect(592, 248, 416, 12, shade(stone, -0.2));
  s += path('M690,590V430A110,110 0 0,1 910,430V590Z', '#14171b');
  let grid = '';
  for (let x = 705; x < 900; x += 24) grid += `M${x},${x < 800 ? 430 - (x - 690) * 0.7 : 430 - (910 - x) * 0.7}V590`;
  for (let y = 420; y < 590; y += 26) grid += `M690,${y}H910`;
  s += path(grid, 'none', `stroke="${shade(stone, -0.35)}" stroke-width="5"`);
  s += path('M680,590V430A120,120 0 0,1 920,430V590', 'none', `stroke="${shade(stone, 0.35)}" stroke-width="10"`);
  s += banner(620, 280, 50, 150, p.accent, p.accent2) + banner(930, 280, 50, 150, p.accent, p.accent2);
  // iron aquila above the gate
  s += standard(800, 300, 30, 'aquila', p.accent, p.accent2, 0.9);
  s += ground(c, 590, mix(stone, p.light, 0.25), shade(p.dark, -0.25));
  let flags = '';
  for (let i = 1; i < 6; i++) flags += `M0,${590 + i * i * 12}H${W}`;
  for (let i = -8; i <= 8; i++) flags += `M${800 + i * 70},590L${800 + i * 260},900`;
  s += path(flags, 'none', `stroke="${shade(stone, -0.4)}" stroke-width="2" opacity=".25"`);
  return s + vignette(c, 0.5);
}

function court(c: Ctx): string {
  const p = c.pal;
  let s = sky(c, p.sky[0], p.sky[1]);
  s += glow(c, 'sn', 800, 260, 520, '#fff0c0', 0.8);
  s += clouds(c, 4, 90, 200, '#fff3dc', 0.4, 1.4);
  // two-storey sandstone arcade wrapping the court
  s += arcade(0, 410, W, 180, 16, p.stone, shade(p.stoneDark, -0.35), 0.72, 0.18);
  s += arcade(0, 270, W, 140, 20, shade(p.stone, 0.08), shade(p.stoneDark, -0.25), 0.7, 0.18);
  s += rect(0, 262, W, 14, shade(p.stoneDark, 0.1));
  // terracotta roof
  s += path(`M-20,262L40,226H1560L1620,262Z`, mix(p.accent, '#a0522d', 0.5));
  let tiles = '';
  for (let x = 40; x < 1560; x += 18) tiles += `M${x},228L${x - 4},262`;
  s += path(tiles, 'none', `stroke="${shade(p.accent, -0.35)}" stroke-width="2" opacity=".5"`);
  // banners hanging between arches
  for (let i = 0; i < 8; i++) {
    const x = 70 + i * 200;
    s += banner(x, 286, 46, 150, i % 2 ? p.accent2 : p.accent, '#e8b04b', i % 2 ? '' : wreathGlyph(x + 23, 340, 12, '#e8b04b'));
  }
  // statues on plinths at both sides
  const statue = (x: number) =>
    rect(x - 40, 470, 80, 120, shade(p.stone, 0.15)) +
    rect(x - 46, 462, 92, 12, shade(p.stone, 0.3)) +
    path(`M${x - 12},462L${x - 16},400Q${x - 26},390 ${x - 34},360L${x - 22},356L${x - 10},380L${x - 8},350Q${x - 14},334 ${x},330Q${x + 14},334 ${x + 8},350L${x + 12},386L${x + 18},340L${x + 26},344L${x + 18},400L${x + 14},462Z`, shade(p.stone, 0.35)) +
    path(`M${x + 18},340L${x + 24},250`, 'none', `stroke="${shade(p.stone, 0.35)}" stroke-width="5"`);
  s += statue(150) + statue(1450);
  s += palm(310, 600, 300, '#7a4a28', '#4a7a3a', -1) + palm(1290, 600, 320, '#7a4a28', '#4a7a3a', 1);
  s += ground(c, 590, mix(p.light, '#f2d8a8', 0.4), mix(p.dark, p.stoneDark, 0.35));
  s += `<ellipse cx="800" cy="790" rx="900" ry="190" fill="none" stroke="${shade(p.light, 0.3)}" stroke-width="6" opacity=".35"/>`;
  s += rect(0, 590, W, 10, shade(p.stoneDark, -0.1), 'opacity=".4"');
  return s + vignette(c, 0.45);
}

function forum(c: Ctx): string {
  const p = c.pal;
  let s = sky(c, p.sky[0], p.sky[1]);
  s += glow(c, 'sn', 800, 200, 520, '#ffffff', 0.7);
  s += clouds(c, 6, 90, 280, '#ffffff', 0.8, 1.2);
  s += ridge(c.r, 470, 60, 260, mix(p.sky[0], '#7a9ab0', 0.4), 'opacity=".5"');
  defColumn(c, 'cl', p.stone, p.stoneDark, shade(p.stone, 0.1));
  // distant colonnade (basilica) across the back
  s += rect(0, 470, W, 110, shade(p.stone, -0.06));
  s += colonnade(c, 'cl', 20, 1580, 580, 26, 0.5);
  s += rect(0, 470, W, 14, p.stone);
  // temples left & right
  s += temple(c, 'cl', -80, 590, 540, 1.45, 6, p.stone, p.accent, p.stoneDark);
  s += temple(c, 'cl', 1140, 590, 540, 1.45, 6, p.stone, p.accent, p.stoneDark);
  // triumphal arch centre
  const ax = 590;
  const aw = 420;
  s += rect(ax, 270, aw, 320, p.stone);
  s += rect(ax + aw * 0.65, 270, aw * 0.35, 320, p.stoneDark, 'opacity=".22"');
  s += path(`M${ax + 150},590V430A60,60 0 0,1 ${ax + 270},430V590ZM${ax + 30},590V470A32,32 0 0,1 ${ax + 94},470V590ZM${ax + 326},590V470A32,32 0 0,1 ${ax + 390},470V590Z`, shade(p.stoneDark, -0.25));
  s += path(`M${ax + 144},590V430A66,66 0 0,1 ${ax + 276},430V590`, 'none', `stroke="${p.accent}" stroke-width="4"`);
  s += rect(ax - 10, 250, aw + 20, 24, shade(p.stone, 0.15)) + rect(ax - 6, 200, aw + 12, 52, p.stone);
  s += rect(ax + 60, 212, aw - 120, 28, shade(p.stoneDark, -0.1), 'opacity=".3"');
  let lines = '';
  for (let i = 0; i < 3; i++) lines += `M${ax + 90},${219 + i * 8}H${ax + aw - 90}`;
  s += path(lines, 'none', `stroke="${p.accent}" stroke-width="3"`);
  // engaged columns
  for (const x of [ax + 12, ax + 112, ax + 290, ax + 390]) s += rect(x, 280, 18, 310, shade(p.stone, 0.18)) + rect(x - 4, 276, 26, 8, p.accent);
  // golden quadriga on top
  const gold = p.accent;
  const qx = 800;
  let horses = '';
  for (let i = 0; i < 4; i++) {
    const hx = qx - 105 + i * 44;
    horses += `M${hx},200l4,-30q-10,-14 0,-30l10,-12q8,0 12,8l8,-2q-4,10 -10,12l2,24l6,30h-6l-6,-28l-10,0l-4,28Z`;
  }
  s += path(horses, gold);
  s += path(`M${qx + 60},200V160Q${qx + 70},145 ${qx + 90},150V200Z`, shade(gold, -0.15));
  s += path(`M${qx + 72},150l-6,-30a8,8 0 1,1 12,0l6,30Z`, gold);
  s += ground(c, 610, p.light, mix(p.dark, p.stone, 0.4));
  let pave = '';
  for (let i = 0; i < 6; i++) pave += `M0,${612 + i * i * 9}H${W}`;
  for (let i = -10; i <= 10; i++) pave += `M${800 + i * 60},610L${800 + i * 220},900`;
  s += path(pave, 'none', `stroke="${p.stoneDark}" stroke-width="2" opacity=".22"`);
  return s + vignette(c, 0.35);
}

function bastion(c: Ctx): string {
  const p = c.pal;
  let s = sky(c, p.sky[0], p.sky[1], mix(p.sky[0], p.sky[1], 0.6));
  s += stars(c, 60, 300, '#fff', 0.8);
  s += `<circle cx="1260" cy="150" r="46" fill="#f4e6d0"/><circle cx="1280" cy="138" r="44" fill="${mix(p.sky[0], p.sky[1], 0.15)}"/>`;
  s += glow(c, 'sn', 800, 560, 600, '#ff9a6a', 0.55);
  s += ridge(c.r, 470, 70, 240, mix(p.sky[0], '#1a1020', 0.5), 'opacity=".8"');
  const wall = mix(p.stone, p.accent, 0.35);
  const wallD = shade(mix(p.stoneDark, p.accent, 0.25), -0.2);
  // angled bastions (trace italienne flavour)
  const bast = (x: number, w: number, top: number) => {
    const b = path(`M${x},590L${x + w * 0.12},${top}H${x + w * 0.88}L${x + w},590Z`, wall);
    const sh = path(`M${x + w * 0.5},590V${top}H${x + w * 0.88}L${x + w},590Z`, '#000', 'opacity=".25"');
    return b + sh + masonry(x + w * 0.1, top + 4, w * 0.8, 586 - top, 26, wallD, 0.45) + crenellations(x + w * 0.12, x + w * 0.88, top, 22, 24, wall);
  };
  s += rect(0, 400, W, 190, wallD);
  s += crenellations(0, W, 400, 22, 22, wallD);
  s += bast(-40, 420, 300) + bast(1220, 420, 290) + bast(560, 480, 340);
  // gate with dark recess
  s += path('M720,590V470A80,80 0 0,1 880,470V590Z', '#140a0c');
  s += path('M708,590V470A92,92 0 0,1 892,470V590', 'none', `stroke="${p.accent2}" stroke-width="6"`);
  // scorpion banners
  for (const [x, y, h] of [[90, 330, 230], [300, 330, 230], [620, 370, 170], [930, 370, 170], [1260, 320, 230], [1470, 320, 230]] as [number, number, number][]) {
    const w = h * 0.3;
    s += banner(x, y, w, h, p.accent, p.accent2, scorpionGlyph(x + w / 2, y + h * 0.42, w * 0.03, p.accent2));
  }
  s += torch(c, 470, 400, 't1') + torch(c, 1130, 400, 't2') + torch(c, 700, 450, 't3') + torch(c, 900, 450, 't4');
  s += ground(c, 590, shade(mix(p.dark, p.stoneDark, 0.5), -0.1), shade(p.stoneDark, -0.5));
  s += glow(c, 'gl', 800, 600, 500, '#ff9a5a', 0.25);
  return s + vignette(c, 0.6);
}

function curia(c: Ctx): string {
  const p = c.pal;
  // interior: back wall of green marble with ivory columns
  let s = sky(c, shade(p.stoneDark, -0.35), shade(p.stoneDark, -0.1));
  // coffered ceiling band
  s += rect(0, 0, W, 130, shade(p.stoneDark, -0.45));
  let coff = '';
  for (let x = 10; x < W; x += 100) coff += `M${x},20h80v80h-80Z`;
  s += path(coff, shade(p.stoneDark, -0.25));
  s += path(coff.replace(/h80v80h-80Z/g, 'h80'), 'none', `stroke="${p.accent2}" stroke-width="3" opacity=".5"`);
  s += rect(0, 120, W, 22, p.stone) + rect(0, 142, W, 8, '#c9a040');
  // marble panels
  c.defs.push(linGrad(`${c.id}mb`, [[0, shade(p.accent2, 0.15)], [0.5, p.accent2], [1, shade(p.accent2, -0.35)]], 0, 0, 1, 1));
  s += rect(0, 150, W, 450, `url(#${c.id}mb)`);
  let veins = '';
  for (let i = 0; i < 26; i++) {
    const x = c.r.next() * W;
    const y = 160 + c.r.next() * 420;
    veins += `M${n(x)},${n(y)}q${n(30 + c.r.next() * 60)},${n(-20 + c.r.next() * 40)} ${n(90 + c.r.next() * 80)},${n(-10 + c.r.next() * 30)}`;
  }
  s += path(veins, 'none', 'stroke="#e8f2e8" stroke-width="2" opacity=".25"');
  defColumn(c, 'cl', p.stone, p.stoneDark, '#c9a040');
  s += colonnade(c, 'cl', 60, 1540, 600, 9, 2.2);
  // central doorway with pediment & bronze doors
  s += rect(660, 300, 280, 300, '#3a2a14');
  s += rect(676, 316, 120, 284, '#8a5a24') + rect(804, 316, 120, 284, '#7a4e1e');
  let studs = '';
  for (let y = 340; y < 590; y += 40) for (const x of [700, 740, 772, 828, 860, 900]) studs += `M${x},${y}h.1`;
  s += path(studs, 'none', 'stroke="#e8c070" stroke-width="7" stroke-linecap="round"');
  s += rect(640, 270, 320, 30, p.stone) + pediment(630, 270, 340, 80, p.stone, '#c9a040', p.stoneDark);
  // light shafts from high windows
  s += path('M300,150L380,150L620,600L420,600Z M1220,150L1300,150L1180,600L980,600Z', '#fff8e0', 'opacity=".09"');
  // tiered senate benches on both sides
  for (let i = 0; i < 4; i++) {
    const y = 600 - i * 40;
    s += path(`M-10,${y + 40}L${380 - i * 70},${y + 40}L${380 - i * 70},${y}L-10,${y}Z`, i % 2 ? shade(p.stone, -0.12) : p.stone);
    s += path(`M1610,${y + 40}L${1220 + i * 70},${y + 40}L${1220 + i * 70},${y}L1610,${y}Z`, i % 2 ? shade(p.stone, -0.12) : p.stone);
    s += rect(-10, y, 390 - i * 70, 5, shade(p.stone, 0.4)) + rect(1220 + i * 70, y, 390 - i * 70, 5, shade(p.stone, 0.4));
  }
  // red cushions on benches
  s += path('M40,553h120v7h-120ZM200,553h100v7h-100ZM1300,553h120v7h-120ZM1450,553h100v7h-100Z', p.accent);
  // opus sectile floor
  s += ground(c, 640, mix(p.light, p.stone, 0.4), mix(p.dark, p.stoneDark, 0.6));
  let floor = '';
  for (let i = 0; i < 5; i++) floor += `M0,${642 + i * i * 11}H${W}`;
  for (let i = -9; i <= 9; i++) floor += `M${800 + i * 80},640L${800 + i * 240},900`;
  s += path(floor, 'none', `stroke="${p.accent2}" stroke-width="3" opacity=".3"`);
  s += rect(0, 636, W, 8, '#c9a040', 'opacity=".7"');
  return s + vignette(c, 0.55);
}

function palace(c: Ctx): string {
  const p = c.pal;
  let s = sky(c, p.sky[0], p.sky[1], mix(p.sky[0], p.sky[1], 0.55));
  s += glow(c, 'sn', 800, 470, 600, '#ffd27a', 0.85);
  s += `<circle cx="800" cy="470" r="110" fill="#ffe2a0" opacity=".85"/>`;
  s += clouds(c, 6, 140, 360, shade(p.sky[1], 0.15), 0.45, 1.6);
  const gold = p.accent;
  const red = p.stone;
  defColumn(c, 'cl', mix(red, '#ffffff', 0.12), shade(red, -0.45), gold);
  // central dome hall
  s += path('M560,330C560,210 1040,210 1040,330Z', mix(gold, '#a0782a', 0.3));
  s += path('M600,330C600,240 800,220 800,220C700,250 690,300 690,330Z', '#fff', 'opacity=".2"');
  s += rect(790, 180, 20, 46, gold) + `<circle cx="800" cy="176" r="14" fill="${gold}"/>`;
  s += rect(540, 330, 520, 260, red);
  s += rect(540, 320, 520, 16, gold);
  s += colonnade(c, 'cl', 575, 1025, 590, 6, 1.25);
  // long wings
  s += rect(0, 400, 540, 190, shade(red, -0.12)) + rect(1060, 400, 540, 190, shade(red, -0.12));
  s += rect(0, 392, 540, 12, gold) + rect(1060, 392, 540, 12, gold);
  s += colonnade(c, 'cl', 30, 510, 590, 7, 0.9) + colonnade(c, 'cl', 1090, 1570, 590, 7, 0.9);
  // corner towers with gold roofs
  const tw = (x: number) => rect(x, 260, 150, 330, shade(red, -0.05)) + path(`M${x - 14},260L${x + 75},170L${x + 164},260Z`, gold) + rect(x - 10, 252, 170, 12, shade(gold, -0.2)) + path(`M${x + 55},300h40v70h-40Z`, '#2a0808');
  s += tw(150) + tw(1300);
  s += banner(185, 300, 80, 210, p.accent2, gold, wreathGlyph(225, 380, 22, gold)) + banner(1335, 300, 80, 210, p.accent2, gold, wreathGlyph(1375, 380, 22, gold));
  // terrace with balustrade
  s += ground(c, 590, mix(p.light, red, 0.35), shade(p.dark, -0.4));
  let bal = '';
  for (let x = 0; x < W; x += 24) if (x < 480 || x > 1100) bal += `M${x + 6},604h10v36h-10Z`;
  s += path(bal, mix(p.light, red, 0.2)) + rect(0, 596, 490, 10, gold) + rect(1100, 596, 500, 10, gold) + rect(0, 638, 490, 8, shade(gold, -0.25)) + rect(1100, 638, 500, 8, shade(gold, -0.25));
  s += path('M800,590L1200,900H400Z', '#ffd27a', 'opacity=".08"');
  return s + vignette(c, 0.5);
}

function colosseum(c: Ctx): string {
  const p = c.pal;
  let s = sky(c, p.sky[0], p.sky[1]);
  s += glow(c, 'sn', 800, 120, 520, '#fff2c0', 0.7);
  // velarium awning strips at the top edge
  let vel = '';
  for (let i = 0; i < 16; i++) {
    const x0 = i * 100;
    vel += `M${x0},0L${x0 + 100},0L${800 + (x0 + 50 - 800) * 0.7},${70 + Math.abs(x0 + 50 - 800) * 0.05}Z`;
  }
  s += path(vel, '#f2e6c8', 'opacity=".9"');
  let velR = '';
  for (let i = 0; i < 16; i += 2) {
    const x0 = i * 100;
    velR += `M${x0},0L${x0 + 100},0L${800 + (x0 + 50 - 800) * 0.7},${70 + Math.abs(x0 + 50 - 800) * 0.05}Z`;
  }
  s += path(velR, p.accent, 'opacity=".9"');
  // tiers: curved bands that bow upward toward the edges (inside the bowl)
  const tiers = [
    { y: 150, h: 95, cnt: 30, col: shade(p.stone, 0.12) },
    { y: 245, h: 110, cnt: 26, col: p.stone },
    { y: 355, h: 120, cnt: 22, col: shade(p.stone, -0.08) },
    { y: 475, h: 120, cnt: 18, col: shade(p.stone, -0.16) },
  ];
  const bow = 70;
  for (const t of tiers) {
    const yTop = (x: number) => t.y - bow * Math.pow((x - 800) / 800, 2) * 1.0;
    let band = `M0,${n(yTop(0))}`;
    for (let x = 100; x <= W; x += 100) band += `L${x},${n(yTop(x))}`;
    band += `L${W},${n(yTop(W) + t.h)}`;
    for (let x = W - 100; x >= 0; x -= 100) band += `L${x},${n(yTop(x) + t.h)}`;
    s += path(band + 'Z', t.col);
    // crowd strip on the seating
    let crowdA = '';
    let crowdB = '';
    for (let x = 6; x < W; x += 13) {
      const yy = yTop(x) + t.h * 0.08 + ((x * 7) % 5);
      if ((x * 31) % 3 === 0) crowdB += `M${x},${n(yy)}h.1`;
      else crowdA += `M${x},${n(yy)}h.1`;
    }
    s += path(crowdA, 'none', `stroke="${shade(p.stoneDark, -0.1)}" stroke-width="9" stroke-linecap="round" opacity=".55"`);
    s += path(crowdB, 'none', `stroke="${p.accent}" stroke-width="9" stroke-linecap="round" opacity=".6"`);
    // arches
    let arches = '';
    const cw = W / t.cnt;
    for (let i = 0; i < t.cnt; i++) {
      const x = i * cw + cw * 0.2;
      const aw = cw * 0.6;
      const by = yTop(x + aw / 2) + t.h - 6;
      const top = yTop(x + aw / 2) + t.h * 0.32;
      arches += `M${n(x)},${n(by)}V${n(top + aw / 2)}A${n(aw / 2)},${n(aw / 2)} 0 0,1 ${n(x + aw)},${n(top + aw / 2)}V${n(by)}Z`;
    }
    s += path(arches, shade(p.stoneDark, -0.25));
    let lip = `M0,${n(yTop(0) + t.h * 0.25)}`;
    for (let x = 100; x <= W; x += 100) lip += `L${x},${n(yTop(x) + t.h * 0.25)}`;
    s += path(lip, 'none', `stroke="${shade(p.stone, 0.4)}" stroke-width="4"`);
  }
  // emperor's box (pulvinar) at centre
  s += rect(700, 470, 200, 70, p.accent) + rect(690, 460, 220, 14, p.accent2) + path('M720,540V500A20,20 0 0,1 760,500V540ZM780,540V500A20,20 0 0,1 820,500V540ZM840,540V500A20,20 0 0,1 880,500V540Z', '#3a0a08');
  s += banner(620, 470, 40, 110, p.accent, p.accent2) + banner(940, 470, 40, 110, p.accent, p.accent2);
  // podium wall
  s += rect(0, 590, W, 26, shade(p.stoneDark, 0.1)) + rect(0, 590, W, 5, p.accent2);
  s += ground(c, 616, mix(p.light, p.sky[1], 0.25), mix(p.dark, p.stoneDark, 0.3));
  s += glow(c, 'gl', 800, 760, 700, '#fff0c0', 0.22);
  return s + vignette(c, 0.45);
}

function palatine(c: Ctx): string {
  const p = c.pal;
  let s = sky(c, p.sky[0], p.sky[1], mix(p.sky[0], p.sky[1], 0.45));
  s += stars(c, 140, 420, '#fff', 0.95);
  s += glow(c, 'mn', 1240, 170, 260, '#ffe8ff', 0.6);
  s += `<circle cx="1240" cy="170" r="62" fill="#fff4fa"/><circle cx="1222" cy="158" r="12" fill="#e8d8f0" opacity=".6"/><circle cx="1262" cy="190" r="8" fill="#e8d8f0" opacity=".6"/>`;
  s += clouds(c, 4, 260, 400, '#d8a8d0', 0.25, 1.8);
  const stone = p.stone;
  const dark = p.stoneDark;
  const gold = p.accent;
  defColumn(c, 'cl', stone, shade(dark, -0.2), gold);
  // distant city hills
  s += ridge(c.r, 470, 60, 180, shade(dark, -0.3), 'opacity=".9"');
  // palace complex
  const dome = (x: number, w: number, y: number) =>
    path(`M${x - w / 2},${y}C${x - w / 2},${y - w * 0.75} ${x + w / 2},${y - w * 0.75} ${x + w / 2},${y}Z`, mix(gold, '#8a5a8a', 0.25)) +
    path(`M${x - w / 2 + 10},${y}C${x - w / 2 + 10},${y - w * 0.6} ${x - w * 0.05},${y - w * 0.56} ${x},${y - w * 0.56}C${x - w * 0.2},${y - w * 0.5} ${x - w * 0.25},${y - 20} ${x - w * 0.2},${y}Z`, '#fff', 'opacity=".25"') +
    rect(x - 4, y - w * 0.56 - 30, 8, 32, gold) +
    rect(x - w / 2 - 10, y, w + 20, 14, gold);
  s += rect(520, 330, 560, 260, shade(stone, -0.3));
  s += dome(800, 300, 330);
  s += colonnade(c, 'cl', 550, 1050, 590, 8, 1.15);
  s += rect(0, 420, 520, 170, shade(stone, -0.45)) + rect(1080, 420, 520, 170, shade(stone, -0.45));
  s += dome(260, 180, 420) + dome(1340, 180, 420);
  let win = '';
  for (let x = 30; x < 500; x += 60) win += `M${x},460h24v40h-24ZM${x + 1080},460h24v40h-24Z`;
  s += path(win, '#ffd77a', 'opacity=".9"');
  s += glow(c, 'wl', 800, 470, 360, '#ffd77a', 0.35);
  s += cypress(80, 600, 300, '#160c22') + cypress(150, 600, 240, '#1c1030') + cypress(1450, 600, 300, '#160c22') + cypress(1530, 600, 230, '#1c1030');
  s += banner(470, 440, 44, 130, p.accent2, gold) + banner(1086, 440, 44, 130, p.accent2, gold);
  s += ground(c, 590, mix(p.dark, dark, 0.4), shade(dark, -0.55));
  s += path('M560,590L1040,590L1300,900H300Z', '#ffd77a', 'opacity=".06"');
  return s + vignette(c, 0.55);
}

function hall(c: Ctx): string {
  const p = c.pal;
  let s = sky(c, p.sky[0], p.sky[1]);
  // barrel vault with coffers
  s += path(`M0,0H${W}V200Q800,40 0,200Z`, shade(p.sky[0], -0.3));
  let coff = '';
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 14; i++) {
      const x = 30 + i * 115;
      const y = 20 + r * 60 + Math.pow((x + 40 - 800) / 800, 2) * 60;
      coff += `M${x},${n(y)}h80v44h-80Z`;
    }
  s += path(coff, shade(p.sky[0], -0.1), `stroke="${p.accent}" stroke-width="2" stroke-opacity=".35"`);
  s += glow(c, 'sk1', 800, 120, 380, '#ffe7a8', 0.45);
  // hall wall with niches & statues
  const wall = shade(p.stoneDark, 0.05);
  s += rect(0, 200, W, 400, wall);
  s += rect(0, 196, W, 14, p.accent);
  defColumn(c, 'cl', p.stone, shade(p.stoneDark, -0.1), p.accent);
  const niches = [80, 280, 480, 1120, 1320, 1520];
  for (const [i, x] of niches.entries()) {
    s += path(`M${x - 62},590V330A62,62 0 0,1 ${x + 62},330V590Z`, shade(p.stoneDark, -0.45));
    s += glow(c, `n${i}`, x, 360, 140, '#ffd98a', 0.35);
    // plinth + statue/bust silhouettes (alternate)
    s += rect(x - 40, 520, 80, 70, p.stone) + rect(x - 46, 512, 92, 10, shade(p.stone, 0.2));
    if (i % 2 === 0) {
      s += path(`M${x - 18},512L${x - 22},440Q${x - 34},420 ${x - 30},390Q${x - 26},360 ${x - 12},356Q${x - 18},336 ${x},330Q${x + 18},336 ${x + 12},356Q${x + 28},362 ${x + 30},392L${x + 26},440L${x + 20},512Z`, p.stone);
      s += path(`M${x + 30},392L${x + 42},300`, 'none', `stroke="${p.stone}" stroke-width="6"`);
    } else {
      s += path(`M${x - 34},512Q${x - 36},470 ${x - 16},462Q${x - 26},440 ${x - 20},420Q${x - 16},396 ${x},394Q${x + 16},396 ${x + 20},420Q${x + 26},440 ${x + 16},462Q${x + 36},470 ${x + 34},512Z`, p.stone);
      s += path(`M${x - 22},412Q${x},396 ${x + 22},412`, 'none', `stroke="${p.accent}" stroke-width="5"`);
    }
    s += path(`M${x - 62},590V330A62,62 0 0,1 ${x + 62},330V590`, 'none', `stroke="${p.accent}" stroke-width="5"`);
  }
  s += colonnade(c, 'cl', 180, 1420, 600, 8, 1.95);
  // hanging bronze lamps
  for (const x of [380, 1220]) {
    s += path(`M${x},200V300`, 'none', `stroke="${p.accent}" stroke-width="3"`);
    s += glow(c, `l${x}`, x, 320, 120, '#ffcf6a', 0.6);
    s += path(`M${x - 30},300h60l-12,22h-36Z`, p.accent);
  }
  // red runner banners
  s += banner(700, 220, 60, 200, p.accent2, p.accent, wreathGlyph(730, 290, 18, p.accent)) + banner(840, 220, 60, 200, p.accent2, p.accent, wreathGlyph(870, 290, 18, p.accent));
  // polished floor with reflections
  s += ground(c, 600, mix(p.dark, p.stone, 0.15), shade(p.stoneDark, -0.55));
  s += rect(0, 600, W, 6, p.accent, 'opacity=".6"');
  let refl = '';
  for (let i = 0; i < 8; i++) {
    const x = 180 + (i * 1240) / 7;
    refl += `M${n(x - 30)},606h60l${n((x - 800) * 0.06)},120h-60Z`;
  }
  s += path(refl, p.stone, 'opacity=".08"');
  return s + vignette(c, 0.55);
}

function celestial(c: Ctx): string {
  const p = c.pal;
  let s = sky(c, p.sky[0], p.sky[1], mix(p.sky[0], p.sky[1], 0.5));
  s += glow(c, 'nb1', 300, 260, 420, '#c06ac0', 0.35) + glow(c, 'nb2', 1300, 200, 460, '#4a8ae0', 0.3) + glow(c, 'nb3', 1100, 500, 380, '#e0605a', 0.18);
  s += stars(c, 220, 620, '#fff', 1);
  // golden radiance behind the throne
  s += glow(c, 'th', 800, 330, 560, '#ffe39a', 0.9);
  let rays = '';
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    rays += `M800,330L${n(800 + Math.cos(a - 0.035) * 900)},${n(330 + Math.sin(a - 0.035) * 900)}L${n(800 + Math.cos(a + 0.035) * 900)},${n(330 + Math.sin(a + 0.035) * 900)}Z`;
  }
  s += path(rays, '#ffe7a8', 'opacity=".1"');
  const gold = p.accent;
  // soft cloud banks behind the throne
  s += clouds(c, 8, 470, 560, '#d8c8ff', 0.4, 1.3);
  // floating broken columns at the edges
  defColumn(c, 'cl', p.stone, p.stoneDark, gold);
  s += useAt(c, 'cl', 180, 540, 1.6) + useAt(c, 'cl', 380, 450, 1.1) + useAt(c, 'cl', 1420, 540, 1.6) + useAt(c, 'cl', 1220, 450, 1.1);
  // throne on a golden dais
  const ol = `stroke="${shade(p.stoneDark, -0.4)}" stroke-width="4" stroke-linejoin="round"`;
  s += path('M690,480V300Q690,240 740,220L760,170H840L860,220Q910,240 910,300V480Z', gold, ol);
  s += path('M690,480V300Q690,240 740,220L760,170H800V480Z', '#fff', 'opacity=".18"');
  s += path('M722,470V312Q722,266 770,254H830Q878,266 878,312V470Z', mix(p.stoneDark, p.accent2, 0.25), ol);
  s += path('M760,170L800,118L840,170Z', gold, ol) + `<circle cx="800" cy="108" r="13" fill="#fffbe8"/>`;
  s += path('M650,480H950V450Q950,428 928,428H672Q650,428 650,450Z', gold, ol);
  s += path('M620,520H980V480H620Z', shade(gold, -0.25), ol);
  s += path('M600,550H1000V520H600Z', shade(gold, -0.4), ol);
  s += wreathGlyph(800, 340, 46, gold);
  s += ridge(c.r, 560, 50, 140, mix(p.sky[1], '#ffffff', 0.45), 'opacity=".85"');
  s += ridge(c.r, 640, 40, 170, mix(p.sky[1], '#ffffff', 0.25), 'opacity=".75"');
  c.defs.push(linGrad(`${c.id}cl`, [[0, mix(p.sky[1], '#ffffff', 0.2)], [1, p.sky[0]]]));
  s += rect(0, 680, W, 220, `url(#${c.id}cl)`, 'opacity=".9"');
  s += glow(c, 'bt', 800, 700, 600, '#ffe39a', 0.25);
  return s + vignette(c, 0.5);
}

const BUILDERS: Record<string, (c: Ctx) => string> = {
  ludus,
  camp,
  fortress,
  court,
  forum,
  bastion,
  curia,
  palace,
  colosseum,
  palatine,
  hall,
  celestial,
};

export function arenaBackdropSvg(arenaIndex: number): string {
  const ai = ((Math.floor(arenaIndex) || 0) % ARENAS.length + ARENAS.length) % ARENAS.length;
  const arena = ARENAS[ai];
  const c: Ctx = { id: idPrefix('backdrop', ai), r: createRng(mixSeed('backdrop', arena.id)), pal: arena.palette, defs: [] };
  const build = BUILDERS[arena.architecture] ?? ludus;
  const body = build(c);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" width="${W}" height="${H}">` +
    `<defs>${c.defs.join('')}</defs>${body}</svg>`
  );
}
