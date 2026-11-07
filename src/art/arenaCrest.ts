/**
 * Arena crests (viewBox 0 0 160 160): one heraldic Roman shield per arena.
 *
 * Family rules: laurel wreath behind the shield, metal rim that climbs
 * bronze → silver → gold with the arena tier, a bold central charge in the
 * arena's accent colours, and a ribbon carrying the arena numeral (I–XII)
 * drawn as paths. Silhouettes and charges are chunky so they read at 40 px.
 */
import { ARENAS } from '../world/arenas';
import { romanText, scorpion } from './arenaBackdrop';
import { idPrefix, laurelArc, luma, mix, n, shade, starPath } from './svgUtil';

type Ctx = { id: string; defs: string[]; k: number };

function grad(c: Ctx, stops: [number, string][], x2 = 0, y2 = 1): string {
  const id = `${c.id}${(c.k++).toString(36)}`;
  c.defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, col]) => `<stop offset="${o}" stop-color="${col}"/>`).join('')}</linearGradient>`);
  return `url(#${id})`;
}

const OUT = '#2a1608';

/** Serifed Roman numerals (I, V, X) as stroked path data, centred at cx; cap height 14*sc. */
const NUM: Record<string, [number, string]> = {
  I: [5, 'M0,0H5M2.5,0V14M0,14H5'],
  V: [12, 'M0,0H4.5M7.5,0H12M2,0L6,14L10,0'],
  X: [12, 'M0,0H4.5M7.5,0H12M0,14H4.5M7.5,14H12M2,0L10,14M10,0L2,14'],
};
function numeral(text: string, cx: number, y: number, sc: number): string {
  const gap = 1.6;
  let w = 0;
  for (const ch of text) w += NUM[ch][0] + gap;
  w -= gap;
  let x = cx - (w * sc) / 2;
  let d = '';
  for (const ch of text) {
    const [gw, gd] = NUM[ch];
    const x0 = x;
    d += gd.replace(/(-?[\d.]+),(-?[\d.]+)/g, (_m, a: string, b: string) => `${n(x0 + +a * sc)},${n(y + +b * sc)}`).replace(/H(-?[\d.]+)/g, (_m, a: string) => `H${n(x0 + +a * sc)}`).replace(/V(-?[\d.]+)/g, (_m, a: string) => `V${n(y + +a * sc)}`);
    x += (gw + gap) * sc;
  }
  return d;
}

/** Shield outlines centred at (80,74), roughly 92 wide x 104 tall. */
const SHIELDS: string[] = [
  // 0 round parma
  'M80,24a50,50 0 1,0 0.1,0Z',
  // 1 curved rectangular scutum
  'M36,28Q80,18 124,28V118Q80,130 36,118Z',
  // 2 heater / kite
  'M34,28H126V70Q126,112 80,130Q34,112 34,70Z',
  // 3 oval republican scutum
  'M80,20C112,20 128,48 128,74C128,102 112,128 80,128C48,128 32,102 32,74C32,48 48,20 80,20Z',
  // 4 rectangular with rounded corners
  'M42,24H118Q128,24 128,34V114Q128,124 118,124H42Q32,124 32,114V34Q32,24 42,24Z',
  // 5 praetorian oval with flat ends
  'M50,22H110Q132,50 132,74Q132,98 110,126H50Q28,98 28,74Q28,50 50,22Z',
  // 6 round clipeus (larger)
  'M80,20a54,54 0 1,0 0.1,0Z',
  // 7 tall curved scutum
  'M38,22Q80,12 122,22V124Q80,134 38,124Z',
  // 8 hexagonal
  'M80,18L128,40V108L80,130L32,108V40Z',
  // 9 round with points (imperial)
  'M80,18L94,30L112,28L116,46L130,58L122,74L130,90L116,102L112,120L94,118L80,130L66,118L48,120L44,102L30,90L38,74L30,58L44,46L48,28L66,30Z',
  // 10 heater with notched top
  'M32,24Q56,32 80,22Q104,32 128,24V72Q128,112 80,132Q32,112 32,72Z',
  // 11 celestial star-shield
  'M80,14L98,40L128,44L114,72L128,100L98,106L80,132L62,106L32,100L46,72L32,44L62,40Z',
];

function charge(i: number, ink: string, light: string, accent: string): string {
  const st = (d: string, col: string, w: number, extra = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"${extra}/>`;
  const f = (d: string, col: string, extra = '') => `<path d="${d}" fill="${col}"${extra}/>`;
  const halo = (d: string, w: number) => st(d, OUT, w, ' stroke-linecap="round" stroke-linejoin="round" opacity=".55"');
  switch (i) {
    case 0: {
      // crossed wooden rudis
      const sw = 'M52,104L106,46M108,104L54,46';
      return halo(sw, 13) + st(sw, light, 8, ' stroke-linecap="round"') + st('M50,92l12,12M110,92l-12,12', ink, 7, ' stroke-linecap="round"') + `<circle cx="80" cy="75" r="9" fill="${accent}" stroke="${OUT}" stroke-width="2"/>`;
    }
    case 1: {
      // vexillum
      const flag = 'M58,46H102V86Q80,92 58,86Z';
      return st('M80,30V116M54,46H106', OUT, 8, ' stroke-linecap="round"') + st('M80,30V116M54,46H106', light, 4.5, ' stroke-linecap="round"') + f(flag, accent, ` stroke="${OUT}" stroke-width="2.5"`) + st('M62,92v8M70,93v8M80,94v8M90,93v8M98,92v8', light, 3) + `<circle cx="80" cy="66" r="9" fill="none" stroke="${light}" stroke-width="3.5"/>` + f('M80,22l6,10h-12z', light);
    }
    case 2: {
      // tower with portcullis
      const t = 'M56,112V52H62V44H70V52H76V44H84V52H90V44H98V52H104V112Z';
      return f(t, light, ` stroke="${OUT}" stroke-width="3"`) + f('M70,112V88a10,10 0 0,1 20,0V112Z', OUT) + st('M75,86V112M80,84V112M85,86V112M70,96H90M70,104H90', '#8a909a', 1.6) + f('M77,62h6v10h-6z', OUT);
    }
    case 3: {
      // crossed gladius and trident
      const g1 = 'M54,46L104,104';
      const tr = 'M108,44L58,108M96,40l14,14M100,36l0,0';
      return halo(g1 + tr, 11) + st(g1, light, 6, ' stroke-linecap="round"') + st('M58,62l12,-12', accent, 6, ' stroke-linecap="round"') + st('M110,46L58,108', light, 4, ' stroke-linecap="round"') + st('M96,44l16,-6l-6,16M100,42l12,12', light, 3.5, ' stroke-linecap="round" stroke-linejoin="round"');
    }
    case 4: {
      // triumphal arch
      const a = 'M48,112V58H112V112H92V86a12,12 0 0,0 -24,0V112Z';
      return f(a, light, ` stroke="${OUT}" stroke-width="3"`) + f('M44,48H116V58H44Z', light, ` stroke="${OUT}" stroke-width="2.5"`) + f('M66,48l6,-12h16l6,12z', accent, ` stroke="${OUT}" stroke-width="2"`) + st('M54,66V104M106,66V104', OUT, 2, ' opacity=".5"');
    }
    case 5:
      return [[-1.6, 0], [1.6, 0], [0, -1.6], [0, 1.6]].map(([dx, dy]) => `<g transform="translate(${dx} ${dy})">${scorpion(80, 80, 44, OUT)}</g>`).join('') + scorpion(80, 80, 44, light);
    case 6: {
      // curule seat + SPQR
      const [d] = romanText('SPQR', 56, 40, 0.95, 3);
      return st('M58,108L102,70M102,108L58,70', OUT, 9, ' stroke-linecap="round"') + st('M58,108L102,70M102,108L58,70', light, 5, ' stroke-linecap="round"') + f('M54,64H106V72H54Z', light, ` stroke="${OUT}" stroke-width="2.5"`) + st(d, light, 3.2, ' stroke-linecap="square"');
    }
    case 7: {
      // fasces
      return f('M90,40q20,-2 24,10q2,10 -6,18q-10,-6 -18,-6z', '#d8dde4', ` stroke="${OUT}" stroke-width="2.5"`) + f('M70,34H90V118H70Z', light, ` stroke="${OUT}" stroke-width="3" rx="4"`) + st('M75,36V116M80,36V116M85,36V116', OUT, 1.2, ' opacity=".5"') + st('M68,52l24,-6M68,72l24,-6M68,92l24,-6M68,112l24,-6', accent, 4);
    }
    case 8: {
      // colosseum facade
      let arches = '';
      for (let r = 0; r < 3; r++) for (let k = 0; k < 5; k++) arches += `M${50 + k * 13},${100 - r * 20}v-9a4,4 0 0,1 8,0v9z`;
      return f('M42,108V52Q80,36 118,52V108Z', light, ` stroke="${OUT}" stroke-width="3"`) + f(arches, OUT) + st('M42,82Q80,70 118,82M42,62Q80,48 118,62', OUT, 1.8, ' opacity=".6"');
    }
    case 9: {
      // imperial eagle with crown
      const e = 'M80,58c-10,-4 -24,-18 -40,-14c8,8 14,22 30,28l-6,10l16,-6l16,6l-6,-10c16,-6 22,-20 30,-28c-16,-4 -30,10 -40,14z';
      return f(e, light, ` stroke="${OUT}" stroke-width="2.5" stroke-linejoin="round"`) + `<circle cx="80" cy="54" r="7" fill="${light}" stroke="${OUT}" stroke-width="2.5"/>` + f('M64,90h32l-4,18h-24z', light, ` stroke="${OUT}" stroke-width="2.5"`) + f('M66,40l5,-10l9,7l9,-7l5,10z', accent, ` stroke="${OUT}" stroke-width="2"`);
    }
    case 10: {
      // corona triumphalis + star
      const ring = laurelArc(80, 78, 26, Math.PI * 0.62, Math.PI * 2.38, 10, 13, 5);
      return `<path d="${ring}" fill="${light}" stroke="${OUT}" stroke-width="1.6"/>` + `<path d="${starPath(80, 78, 15)}" fill="${accent}" stroke="${OUT}" stroke-width="2"/>`;
    }
    default: {
      // throne within rays
      let rays = '';
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        rays += `M${n(80 + Math.cos(a) * 18)},${n(74 + Math.sin(a) * 18)}L${n(80 + Math.cos(a + 0.1) * 40)},${n(74 + Math.sin(a + 0.1) * 40)}L${n(80 + Math.cos(a - 0.1) * 40)},${n(74 + Math.sin(a - 0.1) * 40)}Z`;
      }
      return f(rays, mix(light, accent, 0.3), ' opacity=".55"') + f('M64,104V60Q64,42 80,40Q96,42 96,60V104Z', light, ` stroke="${OUT}" stroke-width="3"`) + f('M70,82V62Q70,50 80,49Q90,50 90,62V82Z', accent) + f('M58,84H102V94H58Z', light, ` stroke="${OUT}" stroke-width="2.5"`) + f('M62,94H98L96,108H64Z', light, ` stroke="${OUT}" stroke-width="2.5"`);
    }
  }
}

/** Heraldic crest for arena 0..11 (viewBox 0 0 160 160). */
export function arenaCrestSvg(arenaIndex: number): string {
  const i = Math.max(0, Math.min(11, Math.floor(Number.isFinite(arenaIndex) ? arenaIndex : 0)));
  const A = ARENAS[i];
  const pal = A.palette;
  const c: Ctx = { id: idPrefix('crest', i), defs: [], k: 0 };
  const tier = Math.floor(i / 4); // 0 bronze, 1 silver, 2 gold
  const metal = [
    ['#f2c08a', '#c07a3a', '#7a4418'],
    ['#ffffff', '#c8d0da', '#7a8494'],
    ['#fff2b0', '#f2c64a', '#a8761a'],
  ][tier];
  const field: Record<number, [string, string]> = {
    0: ['#c8603a', '#7a2e18'],
    1: ['#d0402e', '#7a1a14'],
    2: ['#7d8590', '#3b4048'],
    3: ['#2c8a8a', '#16494a'],
    4: ['#3a6ea5', '#1d3a60'],
    5: ['#8a2244', '#3a0d1c'],
    6: ['#2a7a5a', '#103a2a'],
    7: ['#b02a2a', '#5a0e12'],
    8: ['#d0702e', '#7a3010'],
    9: ['#7a2a8a', '#2a1240'],
    10: ['#2a6a74', '#0f2a3a'],
    11: ['#3a2a8a', '#0b1440'],
  };
  const [f0, f1] = field[i];
  const light = i === 2 ? '#f2f2ee' : i >= 8 ? '#fff0b8' : '#fbe9c8';
  const accent = i === 1 || i === 7 ? '#f2c64a' : i === 5 || i === 9 ? '#f2c64a' : pal.accent;
  let o = '';
  // radiant back for the highest tiers
  if (i >= 9) {
    let rays = '';
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      rays += `M80,76L${n(80 + Math.cos(a - 0.06) * 78)},${n(76 + Math.sin(a - 0.06) * 78)}L${n(80 + Math.cos(a + 0.06) * 78)},${n(76 + Math.sin(a + 0.06) * 78)}Z`;
    }
    o += `<path d="${rays}" fill="${metal[1]}" opacity=".45"/>`;
  }
  // laurel wreath
  const leafA = tier === 2 ? '#e8b440' : tier === 1 ? '#7aa070' : '#4f8a3e';
  const leafB = tier === 2 ? '#a8761a' : tier === 1 ? '#3f6a48' : '#2a5a26';
  o += `<path d="${laurelArc(80, 78, 64, Math.PI * 0.62, Math.PI * 1.42, 7, 20, 7)}${laurelArc(80, 78, 64, Math.PI * 0.38, -Math.PI * 0.42, 7, 20, 7)}" fill="${leafA}" stroke="${leafB}" stroke-width="1.5"/>`;
  // crossed spears / standards behind shield for mid tiers
  if (i % 4 === 3 || i === 5 || i === 7) o += `<path d="M28,138L132,16M132,138L28,16" stroke="${OUT}" stroke-width="6" stroke-linecap="round"/><path d="M28,138L132,16M132,138L28,16" stroke="${metal[1]}" stroke-width="3" stroke-linecap="round"/>`;
  // shield
  const sh = SHIELDS[i];
  o += `<path d="${sh}" fill="${OUT}" transform="translate(0 3)" opacity=".35"/>`;
  o += `<path d="${sh}" fill="${grad(c, [[0, metal[0]], [0.5, metal[1]], [1, metal[2]]], 1, 1)}" stroke="${OUT}" stroke-width="3"/>`;
  o += `<path d="${sh}" fill="${grad(c, [[0, f0], [1, f1]])}" transform="translate(80 74) scale(.86) translate(-80 -74)"/>`;
  // sheen
  o += `<path d="${sh}" fill="${grad(c, [[0, '#ffffff'], [0.45, '#ffffff'], [0.46, f0], [1, f0]], 1, 1)}" opacity=".14" transform="translate(80 74) scale(.86) translate(-80 -74)"/>`;
  o += charge(i, shade(pal.stoneDark, -0.2), light, accent);
  // ribbon with numeral
  const num = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][i];
  const ribbon = luma(pal.accent) > 0.45 ? (luma(pal.accent2) < 0.4 ? pal.accent2 : '#8e1b1b') : shade(pal.accent, -0.05);
  o += `<path d="M22,128l14,-6v22l-14,6l6,-11z" fill="${shade(ribbon, -0.35)}" stroke="${OUT}" stroke-width="2"/><path d="M138,128l-14,-6v22l14,6l-6,-11z" fill="${shade(ribbon, -0.35)}" stroke="${OUT}" stroke-width="2"/>`;
  o += `<path d="M34,120Q80,132 126,120V142Q80,154 34,142Z" fill="${ribbon}" stroke="${OUT}" stroke-width="2.5"/>`;
  o += `<path d="${numeral(num, 80, 128.5, 1)}" fill="none" stroke="${metal[0]}" stroke-width="2.6" stroke-linecap="square"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">` +
    `<defs>${c.defs.join('')}</defs>${o}</svg>`
  );
}
