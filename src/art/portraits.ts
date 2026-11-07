/**
 * Procedural bust portraits (viewBox 0 0 120 120) on a coloured medallion.
 * Deterministic from the seed; small (< 4KB) so thousands can be generated.
 */
import { ARENAS } from '../world/arenas';
import { createRng, type Rng } from '../core/rng';
import { idPrefix, mix, n, shade } from './svgUtil';

export type PortraitOptions = { female: boolean; age: number; arenaIndex: number };

const SKIN = ['#f7dcc8', '#f0c8aa', '#e6b592', '#d9a27a', '#c88d62', '#b4774c', '#9a6139', '#7f4c2a', '#663b20', '#4e2c18'];
const HAIR = ['#1b1411', '#2f1f15', '#4a2e1b', '#6b4226', '#8a3b1c', '#a65a2a', '#c69a52', '#dcc07c'];
const EYES = ['#3a2414', '#4f3018', '#5e4a22', '#3f5a2c', '#3a5f8a', '#2a2020'];
const LINE = '#2a170c';

function pickW<T>(r: Rng, items: readonly T[], weights: readonly number[]): T {
  let t = 0;
  for (const w of weights) t += w;
  let x = r.next() * t;
  for (let i = 0; i < items.length; i++) {
    x -= weights[i];
    if (x <= 0) return items[i];
  }
  return items[items.length - 1];
}

/** Outlined filled discs drawn compactly as round-capped zero-length strokes. */
function dots(pts: [number, number][], r: number, fill: string, ow = 1.1): string {
  const d = pts.map(([x, y]) => `M${n(x)},${n(y)}h0`).join('');
  return `<path d="${d}" stroke="${LINE}" stroke-width="${n(r * 2 + ow * 2)}" stroke-linecap="round"/><path d="${d}" stroke="${fill}" stroke-width="${n(r * 2)}" stroke-linecap="round"/>`;
}

type Headgear = 'none' | 'cap' | 'galea' | 'gladiator' | 'laurel' | 'diadem';

function chooseHeadgear(r: Rng, arena: number, female: boolean): Headgear {
  // arena tier: 0-1 recruits, 2-5 soldiers/gladiators, 6-8 magistrates, 9-11 imperial
  if (arena <= 1) return pickW(r, ['none', 'cap', 'galea'] as Headgear[], [5, 3, arena === 1 ? 2 : 0.5]);
  if (arena <= 2) return pickW(r, ['none', 'cap', 'galea'] as Headgear[], [3, 1, 4]);
  if (arena <= 3) return pickW(r, ['none', 'gladiator', 'galea'] as Headgear[], [3, female ? 2 : 4, 1]);
  if (arena <= 5) return pickW(r, ['none', 'galea', 'laurel', 'gladiator'] as Headgear[], [4, arena === 5 ? 4 : 2, arena === 4 ? 3 : 1, 1]);
  if (arena <= 8) return pickW(r, ['none', 'laurel', 'galea', 'diadem'] as Headgear[], [5, 3, arena === 8 ? 1 : 0.3, female ? 1.5 : 0.3]);
  return pickW(r, ['none', 'laurel', 'diadem'] as Headgear[], [3, 4, female ? 4 : 2]);
}

type Garment = 'tunic' | 'armor' | 'toga' | 'gladiator' | 'stola';

export function portraitSvg(seed: number, opts: PortraitOptions): string {
  const r = createRng((seed ^ 0x5bd1e995) >>> 0);
  r.next();
  const female = !!opts.female;
  const age = Math.max(14, Math.min(90, Number.isFinite(opts.age) ? opts.age : 30));
  const ai = ((Math.floor(opts.arenaIndex) || 0) % 12 + 12) % 12;
  const pal = ARENAS[ai].palette;
  const id = idPrefix('portrait', seed >>> 0, female ? 1 : 0, Math.round(age), ai);

  // ---- appearance
  const skinI = pickW(r, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 1.6, 2, 2, 1.8, 1.5, 1.2, 1, 0.8, 0.6]);
  const skin = SKIN[skinI];
  const skinSh = shade(mix(skin, '#6a2a1a', 0.25), -0.22);
  const darkSkin = skinI >= 6;
  let hairC = pickW(r, HAIR, darkSkin ? [6, 5, 2, 1, 0.2, 0, 0, 0] : [3, 4, 4, 3, 1.4, 1, 1.2, 0.8]);
  const greyP = Math.max(0, Math.min(1, (age - 38) / 30));
  if (r.chance(greyP)) hairC = mix(hairC, age > 62 && r.chance(0.5) ? '#ecebe6' : '#a8a6a2', 0.55 + greyP * 0.4);
  const eyeC = pickW(r, EYES, darkSkin ? [5, 4, 1, 0.2, 0.1, 3] : [3, 3, 2, 1.5, 1.6, 1]);

  const hw = (female ? 16.5 : 18) + r.next() * 3.5; // half width at cheeks
  const jw = (female ? 8 : 10) + r.next() * (female ? 3 : 6); // jaw half-width near chin
  const chinY = (female ? 82 : 84) + r.next() * 4;
  const topY = 29 + r.next() * 2;
  const cx = 60;
  const eyeY = 56 + r.next() * 1.5;
  const eyeDX = 7.5 + r.next() * 1.5;

  const headgear = chooseHeadgear(r, ai, female);
  let garment: Garment;
  if (ai >= 6) garment = female ? 'stola' : r.chance(0.75) ? 'toga' : 'armor';
  else if (ai === 3) garment = r.chance(0.6) ? 'gladiator' : 'tunic';
  else if (ai === 1 || ai === 2 || ai === 5) garment = r.chance(0.6) ? 'armor' : 'tunic';
  else garment = r.chance(0.2) ? 'armor' : 'tunic';
  if (headgear === 'gladiator') garment = 'gladiator';
  if (female && garment === 'gladiator' && r.chance(0.5)) garment = 'armor';

  // ---- palette
  const bgBase = r.pick([pal.accent2, pal.accent, pal.stoneDark, pal.sky[0]]);
  const clothCols = [pal.accent, pal.accent2, '#7a1f1a', '#2f4f7a', '#5a6b2a', '#8a5a2a', '#6a2a6a', '#b88a3a'];
  const cloth = r.pick(clothCols);

  let s = '';
  // medallion background
  s += `<defs><radialGradient id="${id}b" cx=".5" cy=".38" r=".62"><stop offset="0" stop-color="${shade(bgBase, 0.35)}"/><stop offset="1" stop-color="${shade(bgBase, -0.35)}"/></radialGradient>`;
  s += `<linearGradient id="${id}s" x1="0" y1="0" x2="1" y2=".3"><stop offset=".25" stop-color="${skin}"/><stop offset="1" stop-color="${mix(skin, skinSh, 0.55)}"/></linearGradient><clipPath id="${id}c"><circle cx="60" cy="60" r="58"/></clipPath></defs>`;
  s += `<circle cx="60" cy="60" r="59" fill="url(#${id}b)" stroke="${shade(bgBase, -0.55)}" stroke-width="2"/><g clip-path="url(#${id}c)"><g transform="translate(60,76) scale(1.12) translate(-60,-76)">`;

  // ---- long hair behind (female styles)
  const style = female
    ? pickW(r, ['bun', 'long', 'braid', 'curls'], [3, 3, 2, 2])
    : pickW(r, ['crop', 'curly', 'bald', 'receding', 'swept'], [4, 3, age > 40 ? 2 : 0.15, age > 35 ? 2.5 : 0.3, 2]);
  const hideHair = headgear === 'galea' || headgear === 'gladiator';
  if (female && style === 'long' && !hideHair) {
    s += `<path d="M${n(cx - hw - 4)},50C${n(cx - hw - 8)},78 ${n(cx - hw - 10)},96 ${n(cx - hw - 4)},108H${n(cx + hw + 4)}C${n(cx + hw + 10)},96 ${n(cx + hw + 8)},78 ${n(cx + hw + 4)},50Z" fill="${hairC}" stroke="${LINE}" stroke-width="1.4"/>`;
  }

  // ---- bust / garment
  const shW = female ? 40 : 46;
  const bust = `M${cx - shW},120C${cx - shW},104 ${cx - 30},96 ${cx - 12},93H${cx + 12}C${cx + 30},96 ${cx + shW},104 ${cx + shW},120Z`;
  // neck
  s += `<path d="M${n(cx - 8.5)},76V96Q${cx},101 ${n(cx + 8.5)},96V76Z" fill="${mix(skin, skinSh, 0.5)}" stroke="${LINE}" stroke-width="1.4"/>`;
  if (garment === 'armor') {
    const metal = ai >= 7 ? '#d9b04a' : ai === 5 ? '#6f6a78' : '#a9b2bc';
    s += `<path d="${bust}" fill="${metal}" stroke="${LINE}" stroke-width="1.5"/>`;
    s += `<path d="M${cx - shW + 4},108Q${cx},100 ${cx + shW - 4},108M${cx - shW + 1},115Q${cx},107 ${cx + shW - 1},115" fill="none" stroke="${LINE}" stroke-width="1.2" opacity=".55"/>`;
    s += `<path d="M${cx - 30},100Q${cx - 18},94 ${cx - 12},96M${cx + 30},100Q${cx + 18},94 ${cx + 12},96" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.6"/>`;
    s += `<path d="M${cx - 12},93Q${cx},99 ${cx + 12},93L${cx + 10},99Q${cx},103 ${cx - 10},99Z" fill="${cloth}" stroke="${LINE}" stroke-width="1.2"/>`;
  } else if (garment === 'toga' || garment === 'stola') {
    const base = garment === 'toga' ? '#efe7d6' : cloth;
    const trim = garment === 'toga' ? (ai >= 9 ? '#6a2a7a' : '#9c1c1c') : '#d9b04a';
    s += `<path d="${bust}" fill="${base}" stroke="${LINE}" stroke-width="1.5"/>`;
    s += `<path d="M${cx - shW + 6},104C${cx - 18},100 ${cx + 6},112 ${cx + 22},120" fill="none" stroke="${trim}" stroke-width="4.5"/>`;
    s += `<path d="M${cx - shW + 12},112C${cx - 14},106 ${cx + 6},116 ${cx + 12},120M${cx + 20},100Q${cx + 32},106 ${cx + 34},120" fill="none" stroke="${LINE}" stroke-width="1" opacity=".4"/>`;
    s += `<path d="M${cx - 12},93Q${cx},101 ${cx + 12},93" fill="none" stroke="${LINE}" stroke-width="1.3"/>`;
    if (garment === 'stola') s += `<circle cx="${cx}" cy="99" r="2.4" fill="#d9b04a" stroke="${LINE}" stroke-width=".8"/>`;
  } else if (garment === 'gladiator') {
    s += `<path d="${bust}" fill="${mix(skin, skinSh, 0.3)}" stroke="${LINE}" stroke-width="1.5"/>`;
    s += `<path d="M${cx - shW},120C${cx - shW},106 ${cx - 36},100 ${cx - 28},97L${cx - 20},101C${cx - 30},106 ${cx - 32},112 ${cx - 32},120Z" fill="#8a5a2a" stroke="${LINE}" stroke-width="1.2"/>`;
    s += `<path d="M${cx - 28},99L${cx + 30},120" stroke="#6b3a1c" stroke-width="4"/>`;
    s += `<path d="M${cx - 6},104Q${cx},107 ${cx + 6},104" fill="none" stroke="${LINE}" stroke-width="1" opacity=".5"/>`;
  } else {
    s += `<path d="${bust}" fill="${cloth}" stroke="${LINE}" stroke-width="1.5"/>`;
    s += `<path d="M${cx - 12},93Q${cx},104 ${cx + 12},93" fill="${shade(cloth, -0.3)}" stroke="${LINE}" stroke-width="1.3"/>`;
    s += `<path d="M${cx - 30},108V120M${cx + 30},108V120" stroke="${shade(cloth, 0.25)}" stroke-width="3"/>`;
    if (r.chance(0.5)) s += `<circle cx="${cx - 26}" cy="100" r="3.2" fill="#d9b04a" stroke="${LINE}" stroke-width=".9"/>`;
  }

  // ---- ears
  s += `<path d="M${n(cx - hw + 1)},52c-6,-2 -7,8 -1,11M${n(cx + hw - 1)},52c6,-2 7,8 1,11" fill="${mix(skin, skinSh, 0.35)}" stroke="${LINE}" stroke-width="1.3"/>`;

  // ---- head
  const head = `M${n(cx - hw)},55C${n(cx - hw)},${n(topY + 8)} ${n(cx - hw * 0.6)},${n(topY)} ${cx},${n(topY)}C${n(cx + hw * 0.6)},${n(topY)} ${n(cx + hw)},${n(topY + 8)} ${n(cx + hw)},55C${n(cx + hw)},68 ${n(cx + jw)},${n(chinY - 4)} ${cx},${n(chinY)}C${n(cx - jw)},${n(chinY - 4)} ${n(cx - hw)},68 ${n(cx - hw)},55Z`;
  s += `<path d="${head}" fill="url(#${id}s)" stroke="${LINE}" stroke-width="1.6"/>`;

  // ---- wrinkles by age
  if (age > 42) {
    const o = Math.min(0.55, (age - 40) / 50);
    let w = `M${cx - 4},${n(eyeY + 9)}Q${cx - 9},${n(eyeY + 14)} ${cx - 8},${n(eyeY + 18)}M${cx + 4},${n(eyeY + 9)}Q${cx + 9},${n(eyeY + 14)} ${cx + 8},${n(eyeY + 18)}`;
    if (age > 52) w += `M${cx - 8},${n(topY + 13)}Q${cx},${n(topY + 11)} ${cx + 8},${n(topY + 13)}M${n(cx - hw + 3)},${n(eyeY + 1)}l-3,2`;
    if (age > 62) w += `M${cx - 6},${n(topY + 17)}Q${cx},${n(topY + 15.5)} ${cx + 6},${n(topY + 17)}M${n(cx + hw - 3)},${n(eyeY + 1)}l3,2`;
    s += `<path d="${w}" fill="none" stroke="${skinSh}" stroke-width="1.1" stroke-linecap="round" opacity="${n(o + 0.25)}"/>`;
  }
  // cheeks
  if (female || age < 26) s += `<path d="M${n(cx - eyeDX - 1)},${n(eyeY + 9)}h.1M${n(cx + eyeDX + 1)},${n(eyeY + 9)}h.1" stroke="#e0606a" stroke-width="7" stroke-linecap="round" opacity=".18"/>`;

  // ---- eyes
  const eyeR = 3 + r.next() * 0.6;
  const lid = 1.6 + r.next() * 0.6;
  let eyes = '';
  let iris = '';
  for (const d of [-1, 1]) {
    const ex = cx + d * eyeDX;
    eyes += `M${n(ex - eyeR)},${n(eyeY)}Q${n(ex)},${n(eyeY - lid - 1.2)} ${n(ex + eyeR)},${n(eyeY)}Q${n(ex)},${n(eyeY + lid)} ${n(ex - eyeR)},${n(eyeY)}Z`;
    iris += `M${n(ex + 1.6)},${n(eyeY - 0.2)}a1.6,1.6 0 1,0 -3.2,0a1.6,1.6 0 1,0 3.2,0`;
  }
  s += `<path d="${eyes}" fill="#fbf6ee" stroke="${LINE}" stroke-width="1.2"/><path d="${iris}" fill="${eyeC}"/>`;
  if (female) s += `<path d="M${n(cx - eyeDX - eyeR - 0.5)},${n(eyeY - 0.5)}l-1.6,-1.2M${n(cx + eyeDX + eyeR + 0.5)},${n(eyeY - 0.5)}l1.6,-1.2" stroke="${LINE}" stroke-width="1.2" stroke-linecap="round"/>`;

  // ---- brows (expression)
  const expr = r.int(0, 5); // 0 neutral 1 stern 2 raised 3 skeptical 4 kind
  const browY = eyeY - 6.5 - r.next();
  const browCol = mix(hairC, LINE, 0.35);
  const inner = [0, 2.2, -1.6, 0, -0.6][expr];
  const outer = [0, -0.8, 0.4, 0, 1][expr];
  const bw = female ? 1.6 : 2.4 + r.next() * 0.8;
  let brows = '';
  for (const d of [-1, 1]) {
    const lift = expr === 3 && d === 1 ? -2 : 0;
    brows += `M${n(cx + d * 3)},${n(browY + inner + lift)}Q${n(cx + d * (eyeDX + 0.5))},${n(browY - 1.6 + lift)} ${n(cx + d * (eyeDX + 5.5))},${n(browY + 1.2 + outer + lift)}`;
  }
  s += `<path d="${brows}" fill="none" stroke="${browCol}" stroke-width="${n(bw)}" stroke-linecap="round"/>`;

  // ---- nose
  const noseT = r.int(0, 3);
  const nl = 9 + r.next() * 3;
  const nose =
    noseT === 0
      ? `M${cx - 0.5},${n(eyeY + 1)}L${cx - 2},${n(eyeY + nl)}Q${cx},${n(eyeY + nl + 1.6)} ${cx + 2.5},${n(eyeY + nl - 0.5)}` // straight
      : noseT === 1
        ? `M${cx},${n(eyeY)}Q${cx + 2.5},${n(eyeY + nl * 0.5)} ${cx - 2.5},${n(eyeY + nl)}Q${cx},${n(eyeY + nl + 1.8)} ${cx + 2.5},${n(eyeY + nl - 0.3)}` // aquiline
        : `M${cx - 3},${n(eyeY + nl - 1)}Q${cx},${n(eyeY + nl + 1.6)} ${cx + 3},${n(eyeY + nl - 1)}`; // soft
  s += `<path d="${nose}" fill="none" stroke="${skinSh}" stroke-width="1.5" stroke-linecap="round"/>`;

  // ---- beard
  const mouthY = eyeY + nl + 6 + r.next() * 1.5;
  const beardP = female ? 0 : age < 20 ? 0.1 : age < 30 ? 0.35 : 0.55;
  if (r.chance(beardP)) {
    const bt = r.int(0, 3);
    const bc = hairC;
    if (bt === 0) {
      // full beard
      s += `<path d="M${n(cx - hw)},56C${n(cx - hw + 1)},74 ${n(cx - jw - 4)},${n(chinY + 4)} ${cx},${n(chinY + 6)}C${n(cx + jw + 4)},${n(chinY + 4)} ${n(cx + hw - 1)},74 ${n(cx + hw)},56C${n(cx + hw - 3)},66 ${cx + 8},${n(mouthY - 4)} ${cx},${n(mouthY - 4.5)}C${cx - 8},${n(mouthY - 4)} ${n(cx - hw + 3)},66 ${n(cx - hw)},56Z" fill="${bc}" stroke="${LINE}" stroke-width="1.3"/>`;
      s += `<path d="M${cx - 5},${n(mouthY)}Q${cx},${n(mouthY + 2)} ${cx + 5},${n(mouthY)}Q${cx},${n(mouthY + 3.5)} ${cx - 5},${n(mouthY)}Z" fill="${mix(skin, '#8a3030', 0.4)}"/>`;
    } else if (bt === 1) {
      // stubble
      s += `<path d="M${n(cx - hw + 1)},60C${n(cx - hw + 2)},72 ${n(cx - jw)},${n(chinY - 2)} ${cx},${n(chinY)}C${n(cx + jw)},${n(chinY - 2)} ${n(cx + hw - 2)},72 ${n(cx + hw - 1)},60C${n(cx + hw - 5)},68 ${cx + 6},${n(mouthY - 3)} ${cx},${n(mouthY - 4)}C${cx - 6},${n(mouthY - 3)} ${n(cx - hw + 5)},68 ${n(cx - hw + 1)},60Z" fill="${bc}" opacity=".32"/>`;
    } else {
      // moustache + chin beard
      s += `<path d="M${cx - 8},${n(mouthY - 1)}Q${cx},${n(mouthY - 5.5)} ${cx + 8},${n(mouthY - 1)}Q${cx},${n(mouthY - 3)} ${cx - 8},${n(mouthY - 1)}ZM${cx - 5},${n(mouthY + 3)}Q${cx},${n(mouthY + 2)} ${cx + 5},${n(mouthY + 3)}Q${cx + 4},${n(chinY + 5)} ${cx},${n(chinY + 6)}Q${cx - 4},${n(chinY + 5)} ${cx - 5},${n(mouthY + 3)}Z" fill="${bc}" stroke="${LINE}" stroke-width="1"/>`;
    }
  }

  // ---- mouth (expression)
  const mw = female ? 4.5 : 5.5;
  const lip = female ? mix('#c0464a', skin, 0.25) : mix(skin, '#7a2e24', 0.45);
  let mouth: string;
  if (expr === 4 || (expr === 0 && r.chance(0.4))) mouth = `M${n(cx - mw)},${n(mouthY - 0.6)}Q${cx},${n(mouthY + 3.6)} ${n(cx + mw)},${n(mouthY - 0.6)}`;
  else if (expr === 1) mouth = `M${n(cx - mw)},${n(mouthY + 0.8)}Q${cx},${n(mouthY - 1.2)} ${n(cx + mw)},${n(mouthY + 0.8)}`;
  else if (expr === 3) mouth = `M${n(cx - mw)},${n(mouthY + 0.4)}Q${cx + 1},${n(mouthY + 0.8)} ${n(cx + mw + 0.5)},${n(mouthY - 1.6)}`;
  else mouth = `M${n(cx - mw)},${n(mouthY)}Q${cx},${n(mouthY + 1)} ${n(cx + mw)},${n(mouthY)}`;
  if (female) s += `<path d="M${n(cx - mw + 0.5)},${n(mouthY)}Q${cx},${n(mouthY + 3.6)} ${n(cx + mw - 0.5)},${n(mouthY)}Z" fill="${lip}"/>`;
  s += `<path d="${mouth}" fill="none" stroke="${mix(LINE, lip, 0.3)}" stroke-width="1.5" stroke-linecap="round"/>`;

  // ---- hair (front)
  const T = topY;
  const L = cx - hw;
  const R = cx + hw;
  if (!hideHair) {
    if (female) {
      // centre-parted cap
      s += `<path d="M${n(L - 2)},58C${n(L - 4)},${n(T + 2)} ${n(cx - 6)},${n(T - 5)} ${cx},${n(T - 4)}C${n(cx + 6)},${n(T - 5)} ${n(R + 4)},${n(T + 2)} ${n(R + 2)},58C${n(R - 1)},48 ${n(R - 4)},${n(T + 12)} ${cx + 1},${n(T + 8)}Q${cx},${n(T + 10)} ${cx - 1},${n(T + 8)}C${n(L + 4)},${n(T + 12)} ${n(L + 1)},48 ${n(L - 2)},58Z" fill="${hairC}" stroke="${LINE}" stroke-width="1.4"/>`;
      s += `<path d="M${cx},${n(T - 3)}V${n(T + 7)}M${cx - 8},${n(T)}Q${n(L + 2)},${n(T + 8)} ${n(L)},50M${cx + 8},${n(T)}Q${n(R - 2)},${n(T + 8)} ${n(R)},50" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1.2"/>`;
      if (style === 'bun') s += `<circle cx="${cx}" cy="${n(T - 7)}" r="8" fill="${hairC}" stroke="${LINE}" stroke-width="1.4"/><path d="M${cx - 6},${n(T - 8)}Q${cx},${n(T - 13)} ${cx + 6},${n(T - 8)}" fill="none" stroke="${LINE}" stroke-width="1" opacity=".5"/>`;
      if (style === 'braid') {
        const b: [number, number][] = [];
        for (let i = 0; i < 7; i++) {
          const a = Math.PI + (i / 6) * Math.PI;
          b.push([cx + Math.cos(a) * (hw + 1), T + 14 + Math.sin(a) * 17]);
        }
        s += dots(b, 3.4, hairC);
      }
      if (style === 'curls') {
        const b: [number, number][] = [];
        for (const d of [-1, 1]) for (let i = 0; i < 3; i++) b.push([cx + d * (hw + 1), 54 + i * 7]);
        s += dots(b, 3, hairC);
      }
    } else if (style === 'crop' || style === 'swept') {
      // short Roman cap of hair with comb-forward fringe
      let fringe = '';
      const k = 6;
      for (let i = 0; i <= k; i++) {
        const x = R - 1 - (i * (hw * 2 - 2)) / k;
        const y = T + 10 + Math.sin((i / k) * Math.PI) * -1.5 + (style === 'swept' ? (i / k) * 3 : 0);
        fringe += `L${n(x)},${n(y + (i % 2 ? 3 : 0))}`;
      }
      s += `<path d="M${n(L - 1)},54C${n(L - 2)},${n(T + 2)} ${n(cx - 8)},${n(T - 4)} ${cx},${n(T - 4)}C${n(cx + 8)},${n(T - 4)} ${n(R + 2)},${n(T + 2)} ${n(R + 1)},54L${n(R - 1)},${n(T + 12)}${fringe}L${n(L + 1)},${n(T + 12)}Z" fill="${hairC}" stroke="${LINE}" stroke-width="1.4" stroke-linejoin="round"/>`;
      s += `<path d="M${cx - 10},${n(T - 1)}Q${cx},${n(T - 3)} ${cx + 10},${n(T - 1)}" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="1.4"/>`;
    } else if (style === 'curly') {
      const b: [number, number][] = [];
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * 1.02 + (i / 8) * Math.PI * 0.96;
        b.push([cx + Math.cos(a) * (hw - 1), T + 12 + Math.sin(a) * 14]);
      }
      s += `<path d="M${n(L - 1)},54C${n(L - 2)},${n(T)} ${n(R + 2)},${n(T)} ${n(R + 1)},54L${n(R - 2)},${n(T + 12)}H${n(L + 2)}Z" fill="${hairC}"/>` + dots(b, 4.4, hairC, 1.2);
    } else if (style === 'receding') {
      s += `<path d="M${n(L - 1)},56C${n(L - 2)},${n(T + 8)} ${n(cx - 8)},${n(T - 3)} ${cx},${n(T - 3)}C${n(cx + 8)},${n(T - 3)} ${n(R + 2)},${n(T + 8)} ${n(R + 1)},56L${n(R - 2)},${n(T + 12)}Q${cx + 6},${n(T + 3)} ${cx},${n(T + 6)}Q${cx - 6},${n(T + 3)} ${n(L + 2)},${n(T + 12)}Z" fill="${hairC}" stroke="${LINE}" stroke-width="1.3"/>`;
    } else {
      // bald with side fringe
      s += `<path d="M${n(L - 1)},58C${n(L - 2)},50 ${n(L)},44 ${n(L + 3)},42L${n(L + 3)},52ZM${n(R + 1)},58C${n(R + 2)},50 ${n(R)},44 ${n(R - 3)},42L${n(R - 3)},52Z" fill="${hairC}" stroke="${LINE}" stroke-width="1.2"/>`;
      s += `<path d="M${cx - 8},${n(T + 4)}Q${cx - 3},${n(T + 1)} ${cx + 2},${n(T + 2)}" fill="none" stroke="#fff" stroke-opacity=".4" stroke-width="2" stroke-linecap="round"/>`;
    }
  }

  // ---- headgear
  if (headgear === 'cap') {
    s += `<path d="M${n(L - 2)},${n(T + 14)}C${n(L - 2)},${n(T - 6)} ${n(R + 2)},${n(T - 6)} ${n(R + 2)},${n(T + 14)}Q${cx},${n(T + 9)} ${n(L - 2)},${n(T + 14)}Z" fill="#8a5a32" stroke="${LINE}" stroke-width="1.4"/><path d="M${n(L - 1)},${n(T + 12)}Q${cx},${n(T + 7)} ${n(R + 1)},${n(T + 12)}" fill="none" stroke="#c99a62" stroke-width="1.5"/><path d="M${cx},${n(T - 1)}V${n(T + 9)}" stroke="${LINE}" stroke-width="1" opacity=".5"/>`;
  } else if (headgear === 'galea' || headgear === 'gladiator') {
    const metal = headgear === 'gladiator' || ai >= 7 ? '#d6a548' : ai === 5 ? '#8a8494' : '#b8c0c8';
    const metalD = shade(metal, -0.4);
    // cheek guards
    s += `<path d="M${n(L - 2)},48L${n(L - 3)},70Q${n(L + 4)},74 ${n(L + 5)},66L${n(L + 4)},50ZM${n(R + 2)},48L${n(R + 3)},70Q${n(R - 4)},74 ${n(R - 5)},66L${n(R - 4)},50Z" fill="${metal}" stroke="${LINE}" stroke-width="1.3"/>`;
    // crest first (behind dome)
    if (headgear === 'galea') {
      const crestC = ai === 5 ? '#e0b050' : r.chance(0.7) ? '#b8241c' : pal.accent;
      s += `<path d="M${cx - 16},${n(T - 2)}C${cx - 18},${n(T - 18)} ${cx + 18},${n(T - 18)} ${cx + 16},${n(T - 2)}Z" fill="${crestC}" stroke="${LINE}" stroke-width="1.3"/><path d="M${cx - 10},${n(T - 8)}V${n(T - 13)}M${cx - 4},${n(T - 7)}V${n(T - 15)}M${cx + 2},${n(T - 7)}V${n(T - 15)}M${cx + 8},${n(T - 8)}V${n(T - 13)}" stroke="${shade(crestC, -0.35)}" stroke-width="1"/>`;
    } else {
      s += `<path d="M${cx - 4},${n(T - 2)}C${cx - 8},${n(T - 14)} ${cx + 6},${n(T - 22)} ${cx + 18},${n(T - 14)}Q${cx + 8},${n(T - 10)} ${cx + 6},${n(T - 2)}Z" fill="${metal}" stroke="${LINE}" stroke-width="1.3"/>`;
    }
    // dome & brow ridge
    s += `<path d="M${n(L - 3)},${n(T + 18)}C${n(L - 3)},${n(T - 6)} ${n(R + 3)},${n(T - 6)} ${n(R + 3)},${n(T + 18)}Z" fill="${metal}" stroke="${LINE}" stroke-width="1.4"/>`;
    s += `<path d="M${n(L - 5)},${n(T + 18)}Q${cx},${n(T + 13)} ${n(R + 5)},${n(T + 18)}L${n(R + 5)},${n(T + 21)}Q${cx},${n(T + 16)} ${n(L - 5)},${n(T + 21)}Z" fill="${metalD}" stroke="${LINE}" stroke-width="1.2"/>`;
    s += `<path d="M${cx - 10},${n(T + 2)}Q${cx - 4},${n(T - 3)} ${cx + 4},${n(T - 2)}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2" stroke-linecap="round"/>`;
    if (headgear === 'gladiator') s += `<path d="M${n(L - 9)},${n(T + 20)}Q${cx},${n(T + 12)} ${n(R + 9)},${n(T + 20)}" fill="none" stroke="${metalD}" stroke-width="2.5"/>`;
  } else if (headgear === 'laurel') {
    let leaves = '';
    for (let i = 0; i < 6; i++) {
      for (const d of [-1, 1]) {
        const a = Math.PI / 2 + d * (0.3 + i * 0.24);
        const px = cx + Math.cos(a - Math.PI) * (hw + 1.5);
        const py = T + 17 + Math.sin(a - Math.PI) * 18;
        const ang = a - Math.PI + (d * Math.PI) / 2 + d * 0.5;
        const c = Math.cos(ang) * 4.5;
        const sn = Math.sin(ang) * 4.5;
        leaves += `M${n(px - c)},${n(py - sn)}Q${n(px - sn * 0.4)},${n(py + c * 0.4)} ${n(px + c)},${n(py + sn)}Q${n(px + sn * 0.4)},${n(py - c * 0.4)} ${n(px - c)},${n(py - sn)}Z`;
      }
    }
    const gold = ai >= 8;
    s += `<path d="${leaves}" fill="${gold ? '#e3b23c' : '#6f9a3a'}" stroke="${gold ? '#7a4f0a' : '#2f4f1a'}" stroke-width=".8"/>`;
  } else if (headgear === 'diadem') {
    s += `<path d="M${n(L)},${n(T + 15)}Q${cx},${n(T + 4)} ${n(R)},${n(T + 15)}L${n(R)},${n(T + 18)}Q${cx},${n(T + 8)} ${n(L)},${n(T + 18)}Z" fill="#e3b23c" stroke="#6b420a" stroke-width="1"/><path d="M${cx - 4},${n(T + 9)}L${cx},${n(T + 1)}L${cx + 4},${n(T + 9)}Z" fill="#e3b23c" stroke="#6b420a" stroke-width="1"/><circle cx="${cx}" cy="${n(T + 9)}" r="2.2" fill="${ai >= 9 ? '#7a2a8a' : '#c0281e'}" stroke="#6b420a" stroke-width=".7"/>`;
  }

  // rim
  s += `</g></g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">${s}</svg>`;
}
