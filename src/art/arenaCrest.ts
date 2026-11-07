/**
 * Arena crests (viewBox 0 0 160 160): one heraldic Roman shield per arena.
 *
 * Family rules: laurel wreath behind the shield, metal rim that climbs
 * bronze (arenas 0–7) → silver (8–15) → gold (16–23), a bold central charge in
 * the arena's accent colours, and a ribbon carrying the arena numeral (I–XXIV)
 * drawn as paths. The top tier (20–23) gains a radiant back. Every arena has
 * its own shield silhouette. Charges are chunky so they read at 40 px.
 *
 * Self-contained: the palette table below mirrors the arena palettes so the
 * crest family does not depend on world data.
 */
import { romanText, scorpion } from './arenaBackdrop';
import { idPrefix, laurelArc, mix, n, shade, starPath } from './svgUtil';

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

/** Per-arena crest colours: [field light, field dark, accent, ribbon, stoneDark]. */
const PAL: [string, string, string, string, string][] = [
  ['#c8603a', '#7a2e18', '#b4442b', '#b4442b', '#7a4a2c'], // 0 Dust Pits
  ['#b8743a', '#6a3a18', '#e0b860', '#a84a2c', '#8a5a34'], // 1 Ludus Yard
  ['#d0402e', '#7a1a14', '#f2c64a', '#c0392b', '#5a3b22'], // 2 Legion Camp
  ['#3f7a52', '#1a3a26', '#e8c060', '#9c3a2a', '#4a3420'], // 3 Rhine Frontier
  ['#7d8590', '#3b4048', '#a33b2b', '#a33b2b', '#3b4048'], // 4 Iron Citadel
  ['#2a7ac0', '#123a6a', '#f2c64a', '#b8342a', '#7a6448'], // 5 Harbour of Ostia
  ['#2c8a8a', '#16494a', '#c8302a', '#c8302a', '#8c5a2b'], // 6 Gladiator's Court
  ['#5a9a4a', '#24502a', '#e8d8b0', '#a8402a', '#7a6040'], // 7 Aqueduct Heights
  ['#3a6ea5', '#1d3a60', '#b8862b', '#3a6ea5', '#a89d88'], // 8 Forum of Triumph
  ['#2c9aa0', '#0f4a54', '#e0b860', '#2c7a8a', '#9a8a70'], // 9 Imperial Baths
  ['#8a2244', '#3a0d1c', '#f2c64a', '#7b1e3a', '#3d2a24'], // 10 Praetorian Bastion
  ['#d88a3a', '#7a3a10', '#2a6ab0', '#b8302a', '#84502a'], // 11 Circus Maximus
  ['#2a7a5a', '#103a2a', '#8e1b1b', '#8e1b1b', '#9c8f74'], // 12 Senate Hall
  ['#1f5a8a', '#0c2a4a', '#e8b84a', '#1f5a7a', '#9a7a4a'], // 13 Great Library
  ['#b02a2a', '#5a0e12', '#f2c64a', '#2b3f7a', '#5a1616'], // 14 Consular Palace
  ['#3a5aa8', '#16285a', '#a82a2a', '#a82a2a', '#7a6a50'], // 15 Capitoline Temple
  ['#d0702e', '#7a3010', '#9c1c1c', '#9c1c1c', '#7a4320'], // 16 Grand Colosseum
  ['#7a7468', '#3a362e', '#3a5a8a', '#3a5a8a', '#5a5448'], // 17 Pantheon
  ['#7a2a8a', '#2a1240', '#f2c64a', '#7a2a8a', '#4a3260'], // 18 Imperial Palace
  ['#3a7a6a', '#14382e', '#8a2a3a', '#8a2a3a', '#6a7a5a'], // 19 Villa of Tibur
  ['#2a6a74', '#0f2a3a', '#d9a440', '#b03030', '#2f4a52'], // 20 Hall of Caesars
  ['#9c1c1c', '#4a0a0a', '#1e2a6a', '#1e2a6a', '#6a4a18'], // 21 Golden House
  ['#5a8ad0', '#1a3a7a', '#c04a5a', '#a8242a', '#4a3a6a'], // 22 Sanctum of Victory
  ['#3a2a8a', '#0b1440', '#f4cf6a', '#3a2f8a', '#3a2f6a'], // 23 Eternal Throne
];

/** Shield outlines centred at (80,74), roughly 92 wide x 104 tall — one per arena. */
const SHIELDS: string[] = [
  // 0 round parma
  'M80,24a50,50 0 1,0 0.1,0Z',
  // 1 bevelled training board
  'M46,22H114L128,36V112L114,126H46L32,112V36Z',
  // 2 curved rectangular scutum
  'M36,28Q80,18 124,28V118Q80,130 36,118Z',
  // 3 arched-top frontier shield
  'M32,62Q32,20 80,20Q128,20 128,62V110Q80,134 32,110Z',
  // 4 heater / kite
  'M34,28H126V70Q126,112 80,130Q34,112 34,70Z',
  // 5 broad spade (harbour)
  'M34,28H126Q132,92 80,130Q28,92 34,28Z',
  // 6 oval republican scutum
  'M80,20C112,20 128,48 128,74C128,102 112,128 80,128C48,128 32,102 32,74C32,48 48,20 80,20Z',
  // 7 crenellated top (aqueduct)
  'M32,30H54V20H70V30H90V20H106V30H128V112Q80,134 32,112Z',
  // 8 rectangular with rounded corners
  'M42,24H118Q128,24 128,34V114Q128,124 118,124H42Q32,124 32,114V34Q32,24 42,24Z',
  // 9 rounded lozenge (baths)
  'M80,16A62,62 0 0,1 134,74A62,62 0 0,1 80,132A62,62 0 0,1 26,74A62,62 0 0,1 80,16Z',
  // 10 praetorian oval with flat ends
  'M50,22H110Q132,50 132,74Q132,98 110,126H50Q28,98 28,74Q28,50 50,22Z',
  // 11 concave-sided circus shield
  'M28,24Q80,40 132,24Q120,76 132,128Q80,112 28,128Q40,76 28,24Z',
  // 12 round clipeus (larger)
  'M80,20a54,54 0 1,0 0.1,0Z',
  // 13 cartouche (library)
  'M80,16C114,16 126,30 126,52V100C126,122 114,134 80,134C46,134 34,122 34,100V52C34,30 46,16 80,16Z',
  // 14 tall curved scutum
  'M38,22Q80,12 122,22V124Q80,134 38,124Z',
  // 15 pediment (temple)
  'M80,14L132,46V126H28V46Z',
  // 16 hexagonal
  'M80,18L128,40V108L80,130L32,108V40Z',
  // 17 domed (pantheon)
  'M28,128V80A52,52 0 0,1 132,80V128Z',
  // 18 round with points (imperial)
  'M80,18L94,30L112,28L116,46L130,58L122,74L130,90L116,102L112,120L94,118L80,130L66,118L48,120L44,102L30,90L38,74L30,58L44,46L48,28L66,30Z',
  // 19 quatrefoil (villa)
  'M50,44A34,34 0 0,1 110,44A34,34 0 0,1 110,104A34,34 0 0,1 50,104A34,34 0 0,1 50,44Z',
  // 20 heater with notched top
  'M32,24Q56,32 80,22Q104,32 128,24V72Q128,112 80,132Q32,112 32,72Z',
  // 21 octagon (golden house)
  'M60,18H100L130,48V100L100,130H60L30,100V48Z',
  // 22 vesica (sanctum)
  'M80,12C126,38 134,98 80,136C26,98 34,38 80,12Z',
  // 23 celestial star-shield
  'M80,14L98,40L128,44L114,72L128,100L98,106L80,132L62,106L32,100L46,72L32,44L62,40Z',
];

const st = (d: string, col: string, w: number, extra = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"${extra}/>`;
const f = (d: string, col: string, extra = '') => `<path d="${d}" fill="${col}"${extra}/>`;
const halo = (d: string, w: number) => st(d, OUT, w, ' stroke-linecap="round" stroke-linejoin="round" opacity=".55"');
const ol = (w = 2.5) => ` stroke="${OUT}" stroke-width="${w}" stroke-linejoin="round"`;

/** Charges of the twelve arenas that joined the empire in v0.3. */
function chargeNew(i: number, light: string, accent: string): string {
  switch (i) {
    case 1: {
      // palus (training post) with a wooden sword across it
      const post = 'M72,34H88V116H72Z';
      return f(post, '#d8a868', ol(3)) + st('M72,52H88M72,58H88M72,92H88', OUT, 2.2, ' opacity=".6"') + f('M68,30H92V38H68Z', light, ol(2)) + halo('M50,102L110,48', 12) + st('M50,102L110,48', light, 7, ' stroke-linecap="round"') + st('M48,90l14,14', accent, 7, ' stroke-linecap="round"');
    }
    case 3: {
      // timber palisade with gate over a river
      let stakes = '';
      for (let k = 0; k < 7; k++) stakes += `M${46 + k * 10},96V56l5,-10l5,10V96Z`;
      return f(stakes, light, ol(2)) + f('M72,96V76a8,8 0 0,1 16,0V96Z', OUT) + st('M44,104q9,-6 18,0t18,0t18,0t18,0M48,114q8,-6 16,0t16,0t16,0t16,0', '#9ad0f0', 4, ' stroke-linecap="round"') + f('M76,30V48M76,30l14,6l-14,6Z', accent, ol(1.6));
    }
    case 5: {
      // lighthouse with flame over waves
      return f('M66,112L70,62H90L94,112Z', light, ol(3)) + f('M70,62L72,46H88L90,62Z', light, ol(2.5)) + f('M74,46V38H86V46Z', light, ol(2)) + f('M80,18C86,26 90,30 86,38H74C70,30 74,26 80,18Z', '#ff8a2a', ol(1.8)) + f('M76,74h8v10h-8z', OUT) + st('M40,114q10,-8 20,0t20,0t20,0t20,0', '#bfe6fa', 5, ' stroke-linecap="round"') + st('M60,62H100M58,46H102', accent, 3);
    }
    case 7: {
      // aqueduct: three great arches carrying five small ones
      let small = '';
      for (let k = 0; k < 5; k++) small += `M${46 + k * 15},60v-10a5,5 0 0,1 10,0v10z`;
      return f('M40,112V40H120V112Z' + 'M48,112V88a12,12 0 0,1 24,0V112ZM88,112V88a12,12 0 0,1 24,0V112Z', light, ol(3) + ' fill-rule="evenodd"') + f(small, OUT) + f('M36,32H124V40H36Z', '#9ad0f0', ol(2)) + st('M40,60H120', OUT, 2.4);
    }
    case 9: {
      // bath vault over rippling water
      return f('M42,86V64A38,38 0 0,1 118,64V86Z', light, ol(3)) + f('M54,86V66A26,26 0 0,1 106,66V86Z', '#2c7a8a') + st('M80,40V30M62,46l-6,-8M98,46l6,-8', accent, 3.5, ' stroke-linecap="round"') + st('M38,98q10,-7 21,0t21,0t21,0t21,0M44,112q9,-7 18,0t18,0t18,0t18,0', '#bff0f0', 5, ' stroke-linecap="round"') + st('M70,62q4,-10 0,-18M90,62q4,-10 0,-18', '#ffffff', 2.4, ' stroke-linecap="round" opacity=".85"');
    }
    case 11: {
      // chariot wheel with an obelisk rising through it
      let spokes = '';
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        spokes += `M80,80L${n(80 + Math.cos(a) * 30)},${n(80 + Math.sin(a) * 30)}`;
      }
      return `<circle cx="80" cy="80" r="32" fill="none" stroke="${OUT}" stroke-width="12"/><circle cx="80" cy="80" r="32" fill="none" stroke="${light}" stroke-width="7"/>` + st(spokes, OUT, 6) + st(spokes, light, 3) + f('M72,116L75,40L80,30L85,40L88,116Z', accent, ol(2.5)) + f('M75,40L80,30L85,40Z', light);
    }
    case 13: {
      // unrolled scroll
      return f('M46,52H114V100H46Z', light, ol(2.5)) + st('M56,64H104M56,74H104M56,84H96', OUT, 2.4, ' opacity=".55"') + f('M38,46h14v60h-14z', accent, ol(2.5) + ' rx="6"') + f('M108,46h14v60h-14z', accent, ol(2.5) + ' rx="6"') + f('M42,40h6v6h-6zM42,106h6v6h-6zM112,40h6v6h-6zM112,106h6v6h-6z', OUT);
    }
    case 15: {
      // temple pediment crowned by an eagle
      let cols = '';
      for (let k = 0; k < 4; k++) cols += `M${52 + k * 16},${76}h8v32h-8z`;
      return f('M44,74L80,52L116,74Z', light, ol(2.5)) + f(cols, light, ol(2)) + f('M42,108H118V116H42Z', light, ol(2)) + f('M80,48c-6,-2 -14,-10 -24,-8c5,5 9,12 18,15l-2,5l8,-3l8,3l-2,-5c9,-3 13,-10 18,-15c-10,-2 -18,6 -24,8z', accent, ol(1.8)) + `<circle cx="80" cy="44" r="4" fill="${accent}" stroke="${OUT}" stroke-width="1.6"/>`;
    }
    case 17: {
      // dome with the oculus beam
      let cof = '';
      for (let k = 1; k < 6; k++) cof += `M${n(80 + Math.cos(Math.PI + (k * Math.PI) / 6) * 36)},${n(90 + Math.sin(Math.PI + (k * Math.PI) / 6) * 36)}L${n(80 + Math.cos(Math.PI + (k * Math.PI) / 6) * 14)},${n(90 + Math.sin(Math.PI + (k * Math.PI) / 6) * 14)}`;
      return f('M44,90A36,36 0 0,1 116,90Z', light, ol(3)) + st(cof, OUT, 1.8, ' opacity=".5"') + f('M74,56h12v4h-12z', '#bfe6fa', ol(1.6)) + f('M44,90H116V112H44Z', light, ol(2.5)) + st('M56,92V110M68,92V110M80,92V110M92,92V110M104,92V110', OUT, 2, ' opacity=".55"') + f('M76,58L88,58L72,112L60,112Z', '#fff6c8', ' opacity=".75"') + f('M74,40h12v8h-12z', accent, ol(1.6));
    }
    case 19: {
      // twin cypresses beside a reflecting pool
      const cy = (x: number, h: number) => `M${x},${100 - h}C${x + 10},${100 - h * 0.6} ${x + 12},${100 - h * 0.2} ${x + 5},100H${x - 5}C${x - 12},${100 - h * 0.2} ${x - 10},${100 - h * 0.6} ${x},${100 - h}Z`;
      return f(cy(56, 62) + cy(104, 62) + cy(80, 48), '#4f8a4a', ol(2.2)) + f('M40,102H120Q120,118 80,118Q40,118 40,102Z', '#7ac0d8', ol(2.2)) + st('M56,108h16M88,110h16', '#ffffff', 2.2, ' stroke-linecap="round"');
    }
    case 21: {
      // golden octagon with a radiant sun
      let rays = '';
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        rays += `M${n(80 + Math.cos(a - 0.14) * 16)},${n(76 + Math.sin(a - 0.14) * 16)}L${n(80 + Math.cos(a) * 30)},${n(76 + Math.sin(a) * 30)}L${n(80 + Math.cos(a + 0.14) * 16)},${n(76 + Math.sin(a + 0.14) * 16)}Z`;
      }
      return f('M66,40H94L114,60V92L94,112H66L46,92V60Z', 'none', ol(4)) + st('M66,40H94L114,60V92L94,112H66L46,92V60Z', light, 4) + f(rays, light, ol(1.4)) + `<circle cx="80" cy="76" r="13" fill="${accent}" stroke="${OUT}" stroke-width="2"/>`;
    }
    default: {
      // 22 winged Victory: spread wings, raised wreath
      const wing = (k: number) => `M${80 + k * 4},78C${80 + k * 10},56 ${80 + k * 26},44 ${80 + k * 44},36C${80 + k * 40},50 ${80 + k * 40},56 ${80 + k * 34},62C${80 + k * 38},64 ${80 + k * 34},72 ${80 + k * 28},74C${80 + k * 30},80 ${80 + k * 22},84 ${80 + k * 14},84Z`;
      return f(wing(-1) + wing(1), light, ol(2.2)) + f('M72,116Q70,96 74,78Q80,72 86,78Q90,96 88,116Z', light, ol(2.2)) + `<circle cx="80" cy="70" r="7" fill="${light}" stroke="${OUT}" stroke-width="2"/>` + `<circle cx="80" cy="44" r="10" fill="none" stroke="${OUT}" stroke-width="7"/><circle cx="80" cy="44" r="10" fill="none" stroke="#7ab060" stroke-width="4"/>` + st('M80,62V54', OUT, 3);
    }
  }
}

/** Charges of the original twelve arenas (by legacy index 0..11). */
function chargeLegacy(i: number, ink: string, light: string, accent: string): string {
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

/** Legacy (v0.2) index of each canonical arena, or -1 for arenas added in v0.3. */
const LEGACY_OF = (i: number) => (i === 23 ? 11 : i % 2 === 0 && i < 22 ? i / 2 : -1);

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII', 'XVIII', 'XIX', 'XX', 'XXI', 'XXII', 'XXIII', 'XXIV'];

/** Number of arenas with a crest. */
export const ARENA_CREST_COUNT = PAL.length;

/** Heraldic crest for arena 0..23 (viewBox 0 0 160 160; input clamped). */
export function arenaCrestSvg(arenaIndex: number): string {
  const i = Math.max(0, Math.min(PAL.length - 1, Math.floor(Number.isFinite(arenaIndex) ? arenaIndex : 0)));
  const [f0, f1, accent, ribbon, stoneDark] = PAL[i];
  const c: Ctx = { id: idPrefix('crest', i), defs: [], k: 0 };
  const tier = Math.floor(i / 8); // 0 bronze, 1 silver, 2 gold
  const metal = [
    ['#f2c08a', '#c07a3a', '#7a4418'],
    ['#ffffff', '#c8d0da', '#7a8494'],
    ['#fff2b0', '#f2c64a', '#a8761a'],
  ][tier];
  const legacy = LEGACY_OF(i);
  const light = i === 4 ? '#f2f2ee' : tier === 2 ? '#fff0b8' : '#fbe9c8';
  let o = '';
  // radiant back for the top tier (Hall of Caesars → Eternal Throne)
  if (i >= 20) {
    let rays = '';
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2;
      rays += `M80,76L${n(80 + Math.cos(a - 0.06) * 78)},${n(76 + Math.sin(a - 0.06) * 78)}L${n(80 + Math.cos(a + 0.06) * 78)},${n(76 + Math.sin(a + 0.06) * 78)}Z`;
    }
    o += `<path d="${rays}" fill="${metal[1]}" opacity=".45"/>`;
  }
  // laurel wreath (green → silvered → gilded by tier)
  const leafA = tier === 2 ? '#e8b440' : tier === 1 ? '#7aa070' : '#4f8a3e';
  const leafB = tier === 2 ? '#a8761a' : tier === 1 ? '#3f6a48' : '#2a5a26';
  o += `<path d="${laurelArc(80, 78, 64, Math.PI * 0.62, Math.PI * 1.42, 7, 20, 7)}${laurelArc(80, 78, 64, Math.PI * 0.38, -Math.PI * 0.42, 7, 20, 7)}" fill="${leafA}" stroke="${leafB}" stroke-width="1.5"/>`;
  // crossed spears behind the shield for the martial courts
  if (i === 6 || i === 10 || i === 14 || i === 23) o += `<path d="M28,138L132,16M132,138L28,16" stroke="${OUT}" stroke-width="6" stroke-linecap="round"/><path d="M28,138L132,16M132,138L28,16" stroke="${metal[1]}" stroke-width="3" stroke-linecap="round"/>`;
  // shield
  const sh = SHIELDS[i];
  o += `<path d="${sh}" fill="${OUT}" transform="translate(0 3)" opacity=".35"/>`;
  o += `<path d="${sh}" fill="${grad(c, [[0, metal[0]], [0.5, metal[1]], [1, metal[2]]], 1, 1)}" stroke="${OUT}" stroke-width="3"/>`;
  o += `<path d="${sh}" fill="${grad(c, [[0, f0], [1, f1]])}" transform="translate(80 74) scale(.86) translate(-80 -74)"/>`;
  o += `<path d="${sh}" fill="${grad(c, [[0, '#ffffff'], [0.45, '#ffffff'], [0.46, f0], [1, f0]], 1, 1)}" opacity=".14" transform="translate(80 74) scale(.86) translate(-80 -74)"/>`;
  o += legacy >= 0 ? chargeLegacy(legacy, shade(stoneDark, -0.2), light, accent) : chargeNew(i, light, accent);
  // ribbon with the arena numeral
  o += `<path d="M22,128l14,-6v22l-14,6l6,-11z" fill="${shade(ribbon, -0.35)}" stroke="${OUT}" stroke-width="2"/><path d="M138,128l-14,-6v22l14,6l-6,-11z" fill="${shade(ribbon, -0.35)}" stroke="${OUT}" stroke-width="2"/>`;
  o += `<path d="M34,120Q80,132 126,120V142Q80,154 34,142Z" fill="${ribbon}" stroke="${OUT}" stroke-width="2.5"/>`;
  const num = NUMERALS[i];
  const sc = num.length > 4 ? 0.86 : 1;
  o += `<path d="${numeral(num, 80, 128.5 + (1 - sc) * 7, sc)}" fill="none" stroke="${metal[0]}" stroke-width="${n(2.6 * sc)}" stroke-linecap="square"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><defs>${c.defs.join('')}</defs>${o}</svg>`;
}
