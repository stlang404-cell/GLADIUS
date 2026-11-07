/**
 * Rank emblems (viewBox 0 0 128 128) and legacy arena trophies (12, viewBox 0 0 160 160).
 *
 * v0.3 — rankEmblemSvg covers the 72 ranks of the 24-arena empire (see the
 * section at the end of this file). The v0.2 set of 36 is kept as
 * legacyRankEmblemSvg; its notes follow.
 *
 * Progression: each arena has its own heraldic motif and material, moving
 * wood → bronze → iron → gold → purple/celestial. Within an arena the tier
 * (0..2) adds pips on the ribbon (1–3 stars) and extra ornament: tier 1 gains
 * an outer ring, tier 2 gains laurel sprigs and a radiant glow.
 */
import { ARENAS } from '../world/arenas';
import { idPrefix, laurelArc, linGrad, mix, n, radGrad, shade, starPath } from './svgUtil';

type MatName = 'wood' | 'bronze' | 'iron' | 'gold' | 'silver' | 'purple' | 'celest' | 'marble' | 'red' | 'leaf';

const MATS: Record<MatName, [string, string, string]> = {
  wood: ['#d9a067', '#9a6236', '#5c3416'],
  bronze: ['#f6cf8a', '#bf7a38', '#6e3a14'],
  iron: ['#eef1f4', '#8f99a5', '#3b424b'],
  gold: ['#fff3b8', '#e6b034', '#8c5a0c'],
  silver: ['#ffffff', '#c3ccd6', '#6d7884'],
  purple: ['#d9a6f0', '#7b2a92', '#2d0c3c'],
  celest: ['#ffffff', '#ffe7a0', '#e0a040'],
  marble: ['#ffffff', '#ece6d8', '#b8ad96'],
  red: ['#ff7a5c', '#c0281e', '#5e0d0b'],
  leaf: ['#d6e28a', '#6f9a3a', '#2f4f1a'],
};

/** Collects gradient defs lazily so each SVG only carries what it uses. */
class Mats {
  used = new Set<MatName>();
  extra = '';
  constructor(public id: string) {}
  u(m: MatName): string {
    this.used.add(m);
    return `url(#${this.id}${m})`;
  }
  defs(): string {
    let d = this.extra;
    for (const m of this.used) {
      const [l, c, k] = MATS[m];
      d += linGrad(`${this.id}${m}`, [
        [0, l],
        [0.45, c],
        [0.7, k],
        [1, mix(c, l, 0.3)],
      ], 0.15, 0, 0.85, 1);
    }
    return d;
  }
}

const OUT = '#2a1608';
const st = (c = OUT, w = 2.5) => `stroke="${c}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

// ---------------------------------------------------------------- motifs
// All motifs are drawn around the emblem centre (64,58) in a 128 box.

function rudis(M: Mats, x: number, y: number, ang: number, mat: MatName, len = 70, w = 1): string {
  // a training sword pointing up, centred on (x,y), rotated by ang degrees
  const h = len / 2;
  const trim = mat === 'wood' ? 'iron' : 'gold';
  return (
    `<g transform="translate(${n(x)},${n(y)}) rotate(${n(ang)}) scale(${n(w)},1)">` +
    `<path d="M0,${n(-h)}L5,${n(-h + 9)}V${n(h - 20)}H-5V${n(-h + 9)}Z" fill="${M.u(mat)}" ${st(OUT, 2)}/>` +
    `<path d="M-1.5,${n(-h + 9)}V${n(h - 23)}" stroke="#fff" stroke-opacity=".55" stroke-width="1.4"/>` +
    `<rect x="-12" y="${n(h - 21)}" width="24" height="6" rx="2.5" fill="${M.u(trim)}" ${st(OUT, 2)}/>` +
    `<rect x="-3.5" y="${n(h - 15)}" width="7" height="11" fill="${M.u(mat === 'wood' ? 'bronze' : 'red')}" ${st(OUT, 1.8)}/>` +
    `<circle cx="0" cy="${n(h - 1)}" r="5" fill="${M.u(trim)}" ${st(OUT, 2)}/>` +
    '</g>'
  );
}

function rivets(cx: number, cy: number, r: number, count: number, fill: string, size = 2.2): string {
  let d = '';
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 - Math.PI / 2;
    d += `M${n(cx + Math.cos(a) * r + size)},${n(cy + Math.sin(a) * r)}a${size},${size} 0 1,0 -${size * 2},0a${size},${size} 0 1,0 ${size * 2},0`;
  }
  return `<path d="${d}" fill="${fill}" stroke="${OUT}" stroke-width="1"/>`;
}

function motifWood(M: Mats, tier: number): string {
  let s = `<circle cx="64" cy="58" r="42" fill="${M.u('wood')}" ${st(OUT, 3)}/>`;
  // planks & grain
  s += `<path d="M50,18V98M78,18V98" stroke="#5a3416" stroke-width="1.6" opacity=".6"/>`;
  s += `<path d="M36,40Q42,58 36,76M58,22Q54,58 58,94M92,40Q86,58 92,76" fill="none" stroke="#f3c48c" stroke-width="1.2" opacity=".45"/>`;
  s += `<circle cx="64" cy="58" r="38" fill="none" stroke="${tier >= 2 ? M.u('bronze') : M.u('iron')}" stroke-width="5"/>`;
  s += rivets(64, 58, 38, 8 + tier * 4, tier >= 2 ? '#f0c27a' : '#c7ced6', 1.8);
  s += rudis(M, 64, 58, -35, 'wood', 62) + rudis(M, 64, 58, 35, 'wood', 62);
  if (tier >= 1) s += `<circle cx="64" cy="58" r="8" fill="${M.u('iron')}" ${st(OUT, 2)}/><circle cx="62" cy="56" r="2.5" fill="#fff" opacity=".7"/>`;
  return s;
}

function scutumPath(cx: number, cy: number, w: number, h: number): string {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const y0 = cy - h / 2;
  const y1 = cy + h / 2;
  return `M${n(x0 + 6)},${n(y0)}Q${n(cx)},${n(y0 - 6)} ${n(x1 - 6)},${n(y0)}Q${n(x1 + 2)},${n(cy)} ${n(x1 - 6)},${n(y1)}Q${n(cx)},${n(y1 + 6)} ${n(x0 + 6)},${n(y1)}Q${n(x0 - 2)},${n(cy)} ${n(x0 + 6)},${n(y0)}Z`;
}

function boltPath(cx: number, cy: number, dir: number): string {
  // stylised lightning bolt radiating from the boss
  const P = (x: number, y: number) => `${n(cx + x * dir)},${n(cy + y)}`;
  return `M${P(8, -2)}L${P(20, -14)}L${P(17, -6)}L${P(27, -18)}L${P(22, -3)}L${P(14, 2)}Z`;
}

function motifBronze(M: Mats, tier: number, accent: string): string {
  let s = `<path d="${scutumPath(64, 58, 64, 86)}" fill="${accent}" ${st(OUT, 3)}/>`;
  s += `<path d="${scutumPath(64, 58, 56, 78)}" fill="none" stroke="${M.u('bronze')}" stroke-width="4"/>`;
  s += `<path d="${scutumPath(64, 58, 64, 86)}" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="1.5" transform="translate(1.5,1.5)"/>`;
  s += `<rect x="58" y="20" width="12" height="76" fill="${M.u('bronze')}" opacity=".9"/>`;
  s += `<path d="${boltPath(64, 58, 1)}${boltPath(64, 58, -1)}${boltPath(64, 58, 1).replace(/,(-?[\d.]+)/g, (_m, y) => ',' + n(116 - +y))}${boltPath(64, 58, -1).replace(/,(-?[\d.]+)/g, (_m, y) => ',' + n(116 - +y))}" fill="${M.u('gold')}" ${st(OUT, 1.4)}/>`;
  s += `<circle cx="64" cy="58" r="11" fill="${M.u('bronze')}" ${st(OUT, 2.5)}/><circle cx="61" cy="55" r="3.5" fill="#fff" opacity=".6"/>`;
  if (tier >= 1) s += rivets(64, 58, 15, 8, '#f6cf8a', 1.5);
  return s;
}

function motifIron(M: Mats, tier: number, accent: string): string {
  // auxiliary hexagonal shield with crossed pila behind
  let s = '';
  const pilum = (ang: number) =>
    `<g transform="rotate(${ang} 64 58)"><rect x="62" y="6" width="4" height="98" fill="${M.u('wood')}" ${st(OUT, 1.5)}/><path d="M64,0L68,10L64,18L60,10Z" fill="${M.u('iron')}" ${st(OUT, 1.5)}/></g>`;
  s += pilum(-38) + pilum(38);
  const hex = 'M64,14L96,30V86L64,102L32,86V30Z';
  s += `<path d="${hex}" fill="${M.u('iron')}" ${st(OUT, 3)}/>`;
  s += `<path d="M64,22L89,35V81L64,94L39,81V35Z" fill="${shade(accent, -0.15)}" stroke="${M.u('iron')}" stroke-width="2"/>`;
  // wings across the boss
  s += `<path d="M64,58C52,48 44,46 36,48C42,52 44,56 48,58C44,60 42,64 38,66C46,68 54,64 64,58C74,64 82,68 90,66C86,64 84,60 80,58C84,56 86,52 92,48C84,46 76,48 64,58Z" fill="${M.u(tier >= 2 ? 'gold' : 'silver')}" ${st(OUT, 1.5)}/>`;
  s += `<circle cx="64" cy="58" r="9" fill="${M.u('iron')}" ${st(OUT, 2.2)}/><circle cx="61.5" cy="55.5" r="3" fill="#fff" opacity=".75"/>`;
  s += `<path d="M64,14L96,30V86L64,102L32,86V30Z" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1.4" transform="translate(1.2,1.2)"/>`;
  s += rivets(64, 58, 40, 6 + tier * 2, '#dfe5ea', 1.8);
  return s;
}

function motifHelmet(M: Mats, tier: number, accent: string): string {
  let s = `<circle cx="64" cy="58" r="42" fill="${accent}" ${st(OUT, 3)}/>`;
  s += `<circle cx="64" cy="58" r="36" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="2"/>`;
  // crossed trident & sword peeking behind (tier 2)
  // fish-fin crest
  s += `<path d="M44,40C44,22 56,12 76,12C88,12 94,20 92,28C86,24 80,26 76,30L72,40Z" fill="${M.u(tier >= 1 ? 'gold' : 'bronze')}" ${st(OUT, 2.2)}/>`;
  s += `<path d="M58,22Q66,17 76,17M54,30Q64,24 74,24" fill="none" stroke="${OUT}" stroke-width="1.3" opacity=".5"/>`;
  // dome
  s += `<path d="M38,66C38,44 48,34 64,34C80,34 90,44 90,66Z" fill="${M.u('bronze')}" ${st(OUT, 2.5)}/>`;
  // broad brim
  s += `<path d="M26,72C34,64 44,64 64,64C84,64 94,64 102,72C96,76 88,76 64,76C40,76 32,76 26,72Z" fill="${M.u('bronze')}" ${st(OUT, 2.5)}/>`;
  // grilled visor
  s += `<path d="M44,62C44,50 52,44 64,44C76,44 84,50 84,62V70H44Z" fill="#2a1608"/>`;
  let holes = '';
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 6; c++) {
      const x = 49 + c * 6;
      const y = 50 + r * 5;
      if ((r === 0 && (c === 0 || c === 5)) || y > 68) continue;
      holes += `M${x},${y}h3.6v2.8h-3.6Z`;
    }
  s += `<path d="${holes}" fill="${M.u('gold')}" opacity=".9"/>`;
  s += `<path d="M42,40C46,37 52,36 56,36" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="2.4" stroke-linecap="round"/>`;
  // neck guard
  s += `<path d="M46,76H82L78,88H50Z" fill="${M.u('bronze')}" ${st(OUT, 2)}/>`;
  return s;
}

function wreath(M: Mats, cx: number, cy: number, r: number, mat: MatName, count: number, size: number, gap = 0.7): string {
  const a0 = Math.PI / 2 + gap / 2;
  const a1 = Math.PI * 1.5 - 0.15;
  const b0 = Math.PI / 2 - gap / 2;
  const b1 = -Math.PI / 2 + 0.15;
  const leaves = laurelArc(cx, cy, r, a0, a1, count, size, size * 0.32) + laurelArc(cx, cy, r, b0, b1, count, size, size * 0.32);
  return (
    `<path d="M${n(cx + Math.cos(a0) * r)},${n(cy + Math.sin(a0) * r)}A${r},${r} 0 0,1 ${n(cx + Math.cos(a1) * r)},${n(cy + Math.sin(a1) * r)}M${n(cx + Math.cos(b0) * r)},${n(cy + Math.sin(b0) * r)}A${r},${r} 0 0,0 ${n(cx + Math.cos(b1) * r)},${n(cy + Math.sin(b1) * r)}" fill="none" stroke="${mat === 'leaf' ? '#3d5a20' : '#8c5a0c'}" stroke-width="2"/>` +
    `<path d="${leaves}" fill="${M.u(mat)}" stroke="${mat === 'leaf' ? '#24380f' : '#6b420a'}" stroke-width="0.9"/>`
  );
}

function motifLaurel(M: Mats, tier: number, accent2: string): string {
  let s = `<circle cx="64" cy="58" r="30" fill="${accent2}" ${st(OUT, 2.5)}/>`;
  s += `<circle cx="64" cy="58" r="25" fill="none" stroke="${M.u('gold')}" stroke-width="2"/>`;
  s += `<path d="${starPath(64, 58, 17, 0.42, 8, -Math.PI / 2)}" fill="${M.u('gold')}" ${st(OUT, 1.5)}/>`;
  s += `<circle cx="64" cy="58" r="4" fill="#fff" opacity=".8"/>`;
  s += wreath(M, 64, 58, 38, tier >= 2 ? 'gold' : 'leaf', 7, 13);
  // ribbon tie at the bottom
  s += `<path d="M56,92L50,104L57,101L60,108L64,94L68,108L71,101L78,104L72,92Z" fill="#b4232a" ${st(OUT, 1.5)}/>`;
  s += `<circle cx="64" cy="94" r="4.5" fill="${M.u('gold')}" ${st(OUT, 1.5)}/>`;
  return s;
}

function scorpion(M: Mats, mat: MatName): string {
  let s = '';
  // legs
  let legs = '';
  for (let i = 0; i < 4; i++) {
    const y = 52 + i * 5;
    legs += `M58,${y}Q${48 - i},${y - 4 + i * 2} ${44 - i},${y + 4 + i * 2}M70,${y}Q${80 + i},${y - 4 + i * 2} ${84 + i},${y + 4 + i * 2}`;
  }
  s += `<path d="${legs}" fill="none" stroke="${OUT}" stroke-width="5" stroke-linecap="round"/><path d="${legs}" fill="none" stroke="${M.u(mat)}" stroke-width="2.6" stroke-linecap="round"/>`;
  // claws
  const claw = (dir: number) => {
    const P = (x: number, y: number) => `${n(64 + x * dir)},${n(y)}`;
    return `M${P(-5, 46)}Q${P(-16, 42)} ${P(-18, 32)}L${P(-24, 24)}Q${P(-30, 22)} ${P(-28, 16)}Q${P(-22, 18)} ${P(-21, 23)}Q${P(-16, 16)} ${P(-12, 20)}Q${P(-17, 24)} ${P(-15, 30)}Q${P(-11, 39)} ${P(-3, 42)}Z`;
  };
  s += `<path d="${claw(1)}${claw(-1)}" fill="${M.u(mat)}" ${st(OUT, 1.8)}/>`;
  // tail segments curling up
  const tail = [
    [64, 80, 6],
    [65, 88, 5.6],
    [70, 94, 5.2],
    [77, 94, 4.8],
    [82, 88, 4.4],
  ];
  for (const [x, y, r] of tail) s += `<circle cx="${x}" cy="${y}" r="${r}" fill="${M.u(mat)}" ${st(OUT, 1.6)}/>`;
  s += `<path d="M84,84Q90,76 84,70Q85,77 79,82Z" fill="${M.u(mat)}" ${st(OUT, 1.6)}/>`;
  // body
  s += `<ellipse cx="64" cy="64" rx="10" ry="15" fill="${M.u(mat)}" ${st(OUT, 2)}/>`;
  s += `<path d="M55,60H73M55,66H73M57,72H71" stroke="${OUT}" stroke-width="1.2" opacity=".6"/>`;
  s += `<ellipse cx="64" cy="47" rx="7.5" ry="6.5" fill="${M.u(mat)}" ${st(OUT, 2)}/>`;
  s += `<ellipse cx="61" cy="59" rx="2.5" ry="6" fill="#fff" opacity=".45"/>`;
  return s;
}

function motifScorpion(M: Mats, tier: number, accent: string): string {
  let s = `<path d="M64,12C84,12 100,22 100,40V62C100,82 84,96 64,104C44,96 28,82 28,62V40C28,22 44,12 64,12Z" fill="${accent}" ${st(OUT, 3)}/>`;
  s += `<path d="M64,18C81,18 94,26 94,41V62C94,79 81,91 64,98C47,91 34,79 34,62V41C34,26 47,18 64,18Z" fill="none" stroke="${M.u(tier >= 1 ? 'gold' : 'iron')}" stroke-width="2.5"/>`;
  s += `<g transform="translate(64,60) scale(.82) translate(-64,-60)">${scorpion(M, 'gold')}</g>`;
  return s;
}

/** Stroke-drawn capital letters for SPQR (12×16 cells). */
const LETTERS: Record<string, string> = {
  S: 'M10,3C8,0.5 2,0.5 2,4.5C2,8.5 10,7.5 10,11.5C10,15.5 3.5,15.5 1.5,13',
  P: 'M2.5,16V1H7C11.5,1 11.5,8.5 7,8.5H2.5',
  Q: 'M6,1C0.5,1 0.5,15 6,15C11.5,15 11.5,1 6,1ZM7,11.5L11.5,16.5',
  R: 'M2.5,16V1H7C11.5,1 11.5,8.5 7,8.5H2.5M6.5,8.5L11,16',
};

function word(text: string, x: number, y: number, scale: number, color: string, w: number): string {
  let d = '';
  let cx = x;
  for (const ch of text) {
    const p = LETTERS[ch];
    if (p) d += p.replace(/([MLHVCQ])([^MLHVCQZ]*)/g, (_m, cmd: string, args: string) => {
      const nums = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (cmd === 'H') return 'H' + n(cx + nums[0] * scale);
      if (cmd === 'V') return 'V' + n(y + nums[0] * scale);
      const outNums: string[] = [];
      for (let i = 0; i < nums.length; i += 2) outNums.push(n(cx + nums[i] * scale) + ',' + n(y + nums[i + 1] * scale));
      return cmd + outNums.join(' ');
    });
    cx += 13.5 * scale;
  }
  return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
}

function motifTablet(M: Mats, tier: number, accent: string, accent2: string): string {
  // tabula ansata: tablet with dovetail handles
  const tab = 'M30,38H98L114,26V90L98,78H30L14,90V26Z';
  let s = `<path d="${tab}" fill="${accent2}" ${st(OUT, 3)}/>`;
  s += `<rect x="30" y="38" width="68" height="40" fill="${M.u('marble')}" ${st(OUT, 2)}/>`;
  s += `<rect x="34" y="42" width="60" height="32" fill="none" stroke="${M.u('gold')}" stroke-width="1.6"/>`;
  s += word('SPQR', 37.5, 49, 0.95, accent, 3.4);
  s += `<path d="M30,38H98" stroke="#fff" stroke-opacity=".7" stroke-width="1.5"/>`;
  // pediment above
  s += `<path d="M30,36L64,${tier >= 1 ? 14 : 20}L98,36Z" fill="${M.u('marble')}" ${st(OUT, 2.5)}/>`;
  s += `<circle cx="64" cy="${tier >= 1 ? 29 : 30}" r="4" fill="${M.u('gold')}" ${st(OUT, 1.2)}/>`;
  // columns below
  s += `<path d="M38,80V100M50,80V100M78,80V100M90,80V100" stroke="${M.u('marble')}" stroke-width="7"/><path d="M34.5,80V100M46.5,80V100M74.5,80V100M86.5,80V100M41.5,80V100M53.5,80V100M81.5,80V100M93.5,80V100" stroke="${OUT}" stroke-width="1" opacity=".5"/>`;
  s += `<rect x="28" y="99" width="72" height="5" rx="1" fill="${M.u('marble')}" ${st(OUT, 2)}/>`;
  return s;
}

function fasces(M: Mats, x: number, y: number, h: number, axeMat: MatName): string {
  // centred at x, top at y
  let s = `<g ${st(OUT, 1.6)}>`;
  // axe blade (to the left)
  s += `<path d="M${x - 6},${y + 6}C${x - 20},${y - 2} ${x - 30},${y + 6} ${x - 30},${y + 18}C${x - 22},${y + 14} ${x - 14},${y + 16} ${x - 6},${y + 22}Z" fill="${M.u(axeMat)}"/>`;
  for (let i = -2; i <= 2; i++) {
    s += `<rect x="${x + i * 5 - 2.6}" y="${y + (Math.abs(i) === 2 ? 4 : 0)}" width="5.2" height="${h - (Math.abs(i) === 2 ? 8 : 0)}" rx="2.6" fill="${M.u('wood')}"/>`;
  }
  s += '</g>';
  // red ties crossing the bundle
  let ties = '';
  for (let k = 0; k < 4; k++) {
    const yy = y + 10 + k * ((h - 20) / 3);
    ties += `M${x - 13},${yy}L${x + 13},${yy + 6}`;
  }
  s += `<path d="${ties}" stroke="${OUT}" stroke-width="5.5" stroke-linecap="round"/><path d="${ties}" stroke="#c4262a" stroke-width="3.2" stroke-linecap="round"/>`;
  s += `<path d="M${x - 2},${y - 6}H${x + 2}V${y + 4}H${x - 2}Z" fill="${M.u('gold')}" ${st(OUT, 1.2)}/>`;
  return s;
}

function motifFasces(M: Mats, tier: number, accent: string): string {
  M.extra += radGrad(`${M.id}fx`, [
    [0, '#a8302a'],
    [1, '#3a0d0d'],
  ], 0.45, 0.4, 0.6);
  let s = `<circle cx="64" cy="58" r="42" fill="url(#${M.id}fx)" ${st(OUT, 3)}/>`;
  s += `<circle cx="64" cy="58" r="37" fill="none" stroke="${M.u('gold')}" stroke-width="${tier >= 1 ? 3.5 : 2}"/>`;
  s += `<path d="${starPath(64, 58, 30, 0.75, 12, 0)}" fill="${mix(accent, '#ffffff', 0.1)}" opacity=".18"/>`;
  s += fasces(M, 70, 30, 58, 'silver');
  return s;
}

function arcadeBand(M: Mats, x: number, y: number, w: number, h: number, count: number, mat: MatName): string {
  let s = `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${M.u(mat)}" ${st(OUT, 2)}/>`;
  const cw = w / count;
  let holes = '';
  for (let i = 0; i < count; i++) {
    const ax = x + i * cw + cw * 0.22;
    const aw = cw * 0.56;
    holes += `M${n(ax)},${n(y + h - 3)}V${n(y + h * 0.45)}A${n(aw / 2)},${n(aw / 2)} 0 0,1 ${n(ax + aw)},${n(y + h * 0.45)}V${n(y + h - 3)}Z`;
  }
  s += `<path d="${holes}" fill="#5a2a0c"/>`;
  return s;
}

function motifColosseumCrown(M: Mats, tier: number, accent: string): string {
  let s = `<circle cx="64" cy="58" r="42" fill="${accent}" ${st(OUT, 3)}/>`;
  s += `<path d="${starPath(64, 58, 40, 0.8, 16, 0)}" fill="#fff" opacity=".1"/>`;
  // mural crown: crenellated band of colosseum arches
  s += `<path d="M30,48V34H38V40H46V32H54V40H62V30H66V40H74V32H82V40H90V34H98V48Z" fill="${M.u('gold')}" ${st(OUT, 2.2)}/>`;
  s += arcadeBand(M, 30, 48, 68, 18, 6, 'gold');
  s += arcadeBand(M, 33, 66, 62, 15, 5, 'gold');
  s += `<path d="M28,82Q64,92 100,82L98,88Q64,98 30,88Z" fill="${M.u('gold')}" ${st(OUT, 2)}/>`;
  s += `<path d="M30,48H98M33,66H95" stroke="#fff" stroke-opacity=".6" stroke-width="1.2"/>`;
  // gems
  s += `<circle cx="64" cy="86.5" r="3.4" fill="#c0281e" ${st(OUT, 1)}/><circle cx="46" cy="85" r="2.6" fill="#2f6db3" ${st(OUT, 1)}/><circle cx="82" cy="85" r="2.6" fill="#2f6db3" ${st(OUT, 1)}/>`;
  if (tier >= 1) s += `<path d="M64,30V22" stroke="${OUT}" stroke-width="2"/><path d="${starPath(64, 19, 6, 0.45)}" fill="${M.u('gold')}" ${st(OUT, 1.2)}/>`;
  return s;
}

function eagle(M: Mats, mat: MatName): string {
  // spread-winged aquila, symmetric; wing built as a feathered path and mirrored
  const wing =
    'M60,50C52,40 40,30 18,26C22,32 22,34 18,38C24,40 26,42 22,46C28,48 30,50 26,55C32,56 35,58 32,62C40,62 46,64 48,68C52,64 56,62 60,62Z';
  let s = `<path d="${wing}" fill="${M.u(mat)}" ${st(OUT, 2)}/>`;
  s += `<path d="${wing}" fill="${M.u(mat)}" ${st(OUT, 2)} transform="matrix(-1 0 0 1 128 0)"/>`;
  s += `<path d="M54,42Q36,36 24,32M54,50Q38,46 26,44M54,56Q42,56 32,58M74,42Q92,36 104,32M74,50Q90,46 102,44M74,56Q86,56 96,58" fill="none" stroke="${OUT}" stroke-width="1.1" opacity=".45"/>`;
  // tail
  s += `<path d="M56,74L50,92L58,88L64,95L70,88L78,92L72,74Z" fill="${M.u(mat)}" ${st(OUT, 2)}/>`;
  // body
  s += `<path d="M64,40C72,42 75,52 74,62C73,72 69,78 64,80C59,78 55,72 54,62C53,52 56,42 64,40Z" fill="${M.u(mat)}" ${st(OUT, 2)}/>`;
  s += `<path d="M58,56Q64,60 70,56M58,63Q64,67 70,63M59,70Q64,73 69,70" fill="none" stroke="${OUT}" stroke-width="1.1" opacity=".5"/>`;
  // head turned right with hooked beak
  s += `<path d="M58,40C57,32 62,27 68,28C72,28.5 75,31 78,33L82,36C78,36 76,38 72,38C70,41 66,43 62,44Z" fill="${M.u(mat)}" ${st(OUT, 2)}/>`;
  s += `<circle cx="68.5" cy="32.5" r="1.8" fill="${OUT}"/>`;
  // talons on a thunderbolt bar
  s += `<path d="M44,84H84" stroke="${OUT}" stroke-width="6" stroke-linecap="round"/><path d="M44,84H84" stroke="${M.u('gold')}" stroke-width="3.4" stroke-linecap="round"/>`;
  return s;
}

function motifEagle(M: Mats, tier: number, accent2: string): string {
  let s = `<circle cx="64" cy="58" r="44" fill="${accent2}" ${st(OUT, 3)}/>`;
  s += `<circle cx="64" cy="58" r="44" fill="url(#${M.id}vg)"/>`;
  s += `<circle cx="64" cy="58" r="39" fill="none" stroke="${M.u('gold')}" stroke-width="${tier >= 1 ? 3 : 1.6}"/>`;
  s += eagle(M, 'gold');
  return s;
}

function laureateProfile(M: Mats, mat: MatName): string {
  let s = `<path d="M56,38C62,34 71,35 74,42L76,49L81,55L77,56.5L78,59.5L76,60.5L77,63.5C75,67.5 71,68 68,68L69,77H52C55,70 51,66 49,60C46,51 49,42 56,38Z" fill="${M.u(mat)}" ${st(OUT, 1.8)}/>`;
  s += `<path d="M71,47.5Q73,46 75,47.5" fill="none" stroke="${OUT}" stroke-width="1.4"/>`;
  s += `<path d="${laurelArc(62, 52, 14, Math.PI * 0.95, Math.PI * 1.7, 4, 8, 2.6)}" fill="${M.u('leaf')}" stroke="#24380f" stroke-width=".7"/>`;
  s += `<path d="M54,62Q58,66 60,64M52,52Q55,56 56,52" fill="none" stroke="${OUT}" stroke-width="1" opacity=".5"/>`;
  return s;
}

function motifImperialWreath(M: Mats, tier: number, accent: string, accent2: string): string {
  let s = `<circle cx="64" cy="58" r="30" fill="${M.u('gold')}" ${st(OUT, 2.5)}/>`;
  s += `<circle cx="64" cy="58" r="25" fill="${shade(accent2 === '#b03030' ? '#1a3a42' : accent2, -0.1)}" stroke="${M.u('gold')}" stroke-width="1.5"/>`;
  s += `<g transform="translate(64,58) scale(.95) translate(-64,-56)">${laureateProfile(M, 'gold')}</g>`;
  s += wreath(M, 64, 58, 40, 'gold', 8, 13, 0.9);
  // gems on the wreath
  for (const a of [200, 250, 290, 340]) {
    const r = (a * Math.PI) / 180;
    s += `<circle cx="${n(64 + Math.cos(r) * 40)}" cy="${n(58 + Math.sin(r) * 40)}" r="3" fill="${a === 250 || a === 290 ? '#c0281e' : '#2f8f9a'}" ${st(OUT, 1)}/>`;
  }
  // flowing ribbons
  s += `<path d="M58,94C50,100 44,110 38,114L46,112L46,120C52,112 58,104 64,96C70,104 76,112 82,120L82,112L90,114C84,110 78,100 70,94Z" fill="${accent}" ${st(OUT, 1.6)}/>`;
  s += `<circle cx="64" cy="95" r="5" fill="${M.u('gold')}" ${st(OUT, 1.5)}/>`;
  if (tier >= 1) s += `<path d="${starPath(64, 16, 6, 0.45)}" fill="${M.u('gold')}" ${st(OUT, 1.2)}/>`;
  return s;
}

function motifRadiantCrown(M: Mats, tier: number): string {
  let s = `<circle cx="64" cy="58" r="44" fill="url(#${M.id}cs)" ${st('#140c33', 3)}/>`;
  // rays
  let rays = '';
  const R0 = 12;
  const R1 = 42;
  const count = 16;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const b = a + 0.08;
    const c = a - 0.08;
    rays += `M${n(64 + Math.cos(c) * R0)},${n(58 + Math.sin(c) * R0)}L${n(64 + Math.cos(a) * (i % 2 ? R1 - 8 : R1))},${n(58 + Math.sin(a) * (i % 2 ? R1 - 8 : R1))}L${n(64 + Math.cos(b) * R0)},${n(58 + Math.sin(b) * R0)}Z`;
  }
  s += `<path d="${rays}" fill="#ffe7a0" opacity=".55"/>`;
  // stars
  const starsP = [
    [36, 34, 2.4],
    [92, 30, 2],
    [30, 70, 1.6],
    [98, 74, 2.2],
    [80, 92, 1.5],
    [46, 92, 1.8],
  ];
  s += `<path d="${starsP.map(([x, y, r]) => starPath(x, y, r * 1.6, 0.4, 4, 0)).join('')}" fill="#fff"/>`;
  // radiate crown
  let spikes = 'M36,74';
  const sp = 7;
  for (let i = 0; i < sp; i++) {
    const x0 = 36 + (i * 56) / sp;
    const x1 = x0 + 56 / sp / 2;
    const x2 = x0 + 56 / sp;
    const hgt = 30 - Math.abs(i - 3) * 4;
    spikes += `L${n(x1)},${n(58 - hgt)}L${n(x2)},58`;
  }
  spikes += 'L92,74Z';
  s += `<path d="${spikes}" fill="${M.u('celest')}" ${st('#5a3a10', 2)}/>`;
  s += `<rect x="34" y="64" width="60" height="14" rx="3" fill="${M.u('gold')}" ${st('#5a3a10', 2)}/>`;
  s += `<path d="M36,67.5H92" stroke="#fff" stroke-opacity=".7" stroke-width="1.3"/>`;
  s += `<circle cx="64" cy="71" r="4" fill="#e0605a" ${st('#5a3a10', 1)}/><circle cx="48" cy="71" r="3" fill="#6ab0ff" ${st('#5a3a10', 1)}/><circle cx="80" cy="71" r="3" fill="#6ab0ff" ${st('#5a3a10', 1)}/>`;
  if (tier >= 1) s += `<path d="${starPath(64, 22, 7, 0.4, 4, 0)}" fill="#fff"/>`;
  return s;
}

// ---------------------------------------------------------------- ornaments

function pipsRibbon(M: Mats, count: number, ribbon: string, mat: MatName): string {
  const w = 22 + count * 11;
  const x0 = 64 - w / 2;
  const x1 = 64 + w / 2;
  let s = `<path d="M${n(x0 - 9)},104L${n(x0)},100V114L${n(x0 - 9)},118L${n(x0 - 4)},111Z M${n(x1 + 9)},104L${n(x1)},100V114L${n(x1 + 9)},118L${n(x1 + 4)},111Z" fill="${shade(ribbon, -0.3)}" ${st(OUT, 1.6)}/>`;
  s += `<path d="M${n(x0)},100Q64,96 ${n(x1)},100V114Q64,110 ${n(x0)},114Z" fill="${ribbon}" ${st(OUT, 1.8)}/>`;
  let stars = '';
  for (let i = 0; i < count; i++) {
    const x = 64 + (i - (count - 1) / 2) * 11;
    stars += starPath(x, 106, 5.2, 0.45);
  }
  s += `<path d="${stars}" fill="${M.u(mat)}" stroke="${OUT}" stroke-width="1"/>`;
  return s;
}

function sideSprigs(M: Mats, mat: MatName): string {
  return (
    `<path d="${laurelArc(64, 60, 52, Math.PI * 0.62, Math.PI * 0.95, 4, 11, 3.6)}${laurelArc(64, 60, 52, Math.PI * 0.38, Math.PI * 0.05, 4, 11, 3.6)}" fill="${M.u(mat)}" stroke="${OUT}" stroke-width=".9"/>`
  );
}

// ---------------------------------------------------------------- public

const ARENA_TRIM: MatName[] = ['iron', 'bronze', 'iron', 'bronze', 'gold', 'gold', 'gold', 'gold', 'gold', 'gold', 'gold', 'celest'];

/** v0.2 palette of a legacy (12-arena) index, looked up through ArenaDef.legacyIndex. */
function legacyPalette(oldArena: number) {
  return (ARENAS.find((a) => a.legacyIndex === oldArena) ?? ARENAS[Math.min(oldArena, ARENAS.length - 1)]).palette;
}

/**
 * The v0.2 emblem set: 36 ranks = 12 legacy arenas x 3 tiers (kept for old
 * saves, previews and comparisons). New code uses rankEmblemSvg (72 ranks).
 */
export function legacyRankEmblemSvg(rankIndex: number, size = 128): string {
  const idx = Math.max(0, Math.min(35, Math.floor(rankIndex) || 0));
  const rank = { arena: Math.floor(idx / 3), tier: idx % 3 };
  const pal = legacyPalette(rank.arena);
  const tier = rank.tier;
  const id = idPrefix('emblem', idx);
  const M = new Mats(id);

  let body = '';
  // tier-2 radiant glow behind everything
  if (tier >= 2) {
    M.extra += radGrad(`${id}gl`, [
      [0, rank.arena >= 9 ? '#fff4c0' : mix(pal.accent2, '#fff3b8', 0.5), 0.95],
      [0.55, rank.arena >= 9 ? '#ffd76a' : pal.accent2, 0.35],
      [1, pal.accent2, 0],
    ]);
    body += `<circle cx="64" cy="60" r="64" fill="url(#${id}gl)"/>`;
  }
  if (tier >= 2) body += sideSprigs(M, rank.arena < 4 ? 'leaf' : 'gold');
  if (tier >= 1) {
    body += `<circle cx="64" cy="58" r="${rank.arena === 6 ? 52 : 49}" fill="none" stroke="${M.u(ARENA_TRIM[rank.arena])}" stroke-width="3" stroke-dasharray="${tier >= 2 ? '0' : '6 4'}" opacity=".95"/>`;
  }

  switch (rank.arena) {
    case 0:
      body += motifWood(M, tier);
      break;
    case 1:
      body += motifBronze(M, tier, pal.accent);
      break;
    case 2:
      body += motifIron(M, tier, pal.accent);
      break;
    case 3:
      body += motifHelmet(M, tier, pal.accent);
      break;
    case 4:
      body += motifLaurel(M, tier, pal.accent2);
      break;
    case 5:
      body += motifScorpion(M, tier, pal.accent);
      break;
    case 6:
      body += motifTablet(M, tier, pal.accent, pal.accent2);
      break;
    case 7:
      body += motifFasces(M, tier, pal.accent);
      break;
    case 8:
      body += motifColosseumCrown(M, tier, pal.accent);
      break;
    case 9:
      M.extra += radGrad(`${id}vg`, [
        [0, '#ffffff', 0.25],
        [1, '#000000', 0.35],
      ], 0.4, 0.35, 0.7);
      body += motifEagle(M, tier, pal.accent2);
      break;
    case 10:
      body += motifImperialWreath(M, tier, pal.accent2, pal.stoneDark);
      break;
    default:
      M.extra += radGrad(`${id}cs`, [
        [0, '#6a4aa8'],
        [0.7, '#231a6a'],
        [1, '#0b1440'],
      ]);
      body += motifRadiantCrown(M, tier);
  }

  const ribbonColour = rank.arena === 4 ? '#b4232a' : rank.arena === 9 ? '#7a2a8a' : rank.arena === 11 ? '#3a2f8a' : rank.arena === 10 ? '#b03030' : pal.accent;
  const pipMat: MatName = rank.arena < 1 ? 'iron' : rank.arena < 3 ? 'bronze' : rank.arena === 11 ? 'celest' : 'gold';
  body += pipsRibbon(M, tier + 1, ribbonColour, pipMat);

  const s = n(size);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="${s}" height="${s}"><defs>${M.defs()}</defs>${body}</svg>`;
}

// ---------------------------------------------------------------- trophies

function plinth(M: Mats, accent: string): string {
  return (
    `<ellipse cx="80" cy="150" rx="52" ry="6" fill="#000" opacity=".3"/>` +
    `<path d="M38,128H122L126,148H34Z" fill="${M.u('marble')}" ${st(OUT, 2.2)}/>` +
    `<rect x="44" y="120" width="72" height="9" rx="2" fill="${M.u('gold')}" ${st(OUT, 2)}/>` +
    `<path d="M40,138H120" stroke="${accent}" stroke-width="3"/>` +
    `<path d="M45,123H115" stroke="#fff" stroke-opacity=".7" stroke-width="1.2"/>`
  );
}

/** Place a 128-box motif into the trophy space. */
function place(markup: string, x: number, y: number, s: number): string {
  return `<g transform="translate(${n(x)},${n(y)}) scale(${n(s)})">${markup}</g>`;
}

function standardPole(M: Mats, top: number): string {
  return `<rect x="77" y="${top}" width="6" height="${120 - top}" fill="${M.u('wood')}" ${st(OUT, 1.6)}/>`;
}

/** Trophy for a legacy (v0.2) arena index 0..11 (the baked trophy portraits supersede it). */
export function arenaTrophySvg(arenaIndex: number): string {
  const ai = ((Math.floor(arenaIndex) || 0) % 12 + 12) % 12;
  const pal = legacyPalette(ai);
  const id = idPrefix('trophy', ai);
  const M = new Mats(id);
  M.extra += radGrad(`${id}hl`, [
    [0, mix(pal.accent2, '#fff6d0', 0.6), 0.9],
    [0.6, pal.accent2, 0.25],
    [1, pal.accent2, 0],
  ]);
  let s = `<circle cx="80" cy="70" r="72" fill="url(#${id}hl)"/>`;
  // light rays
  let rays = '';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.13;
    rays += `M80,70L${n(80 + Math.cos(a - 0.09) * 76)},${n(70 + Math.sin(a - 0.09) * 76)}L${n(80 + Math.cos(a + 0.09) * 76)},${n(70 + Math.sin(a + 0.09) * 76)}Z`;
  }
  s += `<path d="${rays}" fill="#fff" opacity=".12"/>`;
  let obj = '';
  switch (ai) {
    case 0: // wooden rudis on a stand
      obj += `<path d="M58,120L80,96L102,120" fill="none" stroke="${M.u('wood')}" stroke-width="6" stroke-linecap="round"/>`;
      obj += rudis(M, 80, 62, 0, 'wood', 106, 1.5);
      obj += `<path d="M75.5,97L84.5,100M75.5,101L84.5,104M75.5,105L84.5,108" stroke="#e8d0a0" stroke-width="2"/>`;
      break;
    case 1: // vexillum
      obj += standardPole(M, 14);
      obj += `<rect x="50" y="24" width="60" height="5" rx="2" fill="${M.u('gold')}" ${st(OUT, 1.6)}/>`;
      obj += `<path d="M54,29H106V78Q80,72 54,78Z" fill="${pal.accent}" ${st(OUT, 2)}/>`;
      obj += `<path d="M54,78Q80,72 106,78V84Q80,78 54,84Z" fill="${M.u('gold')}" ${st(OUT, 1.2)}/>`;
      obj += `<path d="M58,33H102" stroke="${M.u('gold')}" stroke-width="2"/>`;
      obj += word('SPQR', 60, 45, 1.05, '#ffd76a', 3.4);
      obj += `<path d="M80,4L86,16H74Z" fill="${M.u('gold')}" ${st(OUT, 1.5)}/><circle cx="80" cy="18" r="3.5" fill="${M.u('gold')}" ${st(OUT, 1.2)}/>`;
      obj += `<path d="M54,29L50,40M106,29L110,40" stroke="${pal.accent}" stroke-width="2"/>`;
      break;
    case 2: // iron aquila on a pole
      obj += standardPole(M, 70);
      obj += place(eagle(M, 'iron'), 22, -2, 0.9);
      obj += `<rect x="64" y="86" width="32" height="8" rx="3" fill="${M.u('iron')}" ${st(OUT, 1.5)}/>`;
      break;
    case 3: // golden rudis with gems
      obj += `<path d="M58,120L80,98L102,120" fill="none" stroke="${M.u('bronze')}" stroke-width="6"/>`;
      obj += rudis(M, 80, 60, 0, 'gold', 110, 1.5);
      obj += `<circle cx="80" cy="95" r="3.4" fill="#c0281e" ${st(OUT, 1)}/>`;
            break;
    case 4: // laurel of the Via Sacra
      obj += place(wreath(M, 64, 58, 38, 'leaf', 8, 15), 16, 6, 1);
      obj += `<path d="M72,100L62,120L72,116L76,124L80,104L84,124L88,116L98,120L88,100Z" fill="#b4232a" ${st(OUT, 1.5)}/><circle cx="80" cy="102" r="5" fill="${M.u('gold')}" ${st(OUT, 1.4)}/>`;
      break;
    case 5: // scorpion standard with phalerae
      obj += standardPole(M, 10);
      obj += `<path d="M80,2L85,12H75Z" fill="${M.u('gold')}" ${st(OUT, 1.4)}/>`;
      obj += `<rect x="56" y="14" width="48" height="40" rx="5" fill="${pal.accent}" ${st(OUT, 2)}/>`;
      obj += place(scorpion(M, 'gold'), 59.5, 13, 0.32);
      obj += `<rect x="56" y="14" width="48" height="40" rx="5" fill="none" stroke="${M.u('gold')}" stroke-width="2.5"/>`;
      for (const y of [66, 82, 98]) obj += `<circle cx="80" cy="${y}" r="7" fill="${M.u('gold')}" ${st(OUT, 1.6)}/><circle cx="78" cy="${y - 2}" r="2.2" fill="#fff" opacity=".7"/>`;
      break;
    case 6: // curule seat (sella curulis)
      obj += `<path d="M52,118C52,96 108,96 108,72M108,118C108,96 52,96 52,72" fill="none" stroke="${OUT}" stroke-width="9" stroke-linecap="round"/>`;
      obj += `<path d="M52,118C52,96 108,96 108,72M108,118C108,96 52,96 52,72" fill="none" stroke="${M.u('gold')}" stroke-width="5.5" stroke-linecap="round"/>`;
      obj += `<path d="M44,66H116Q118,74 110,74H50Q42,74 44,66Z" fill="${M.u('marble')}" ${st(OUT, 2)}/>`;
      obj += `<path d="M46,66C50,56 110,56 114,66Z" fill="${pal.accent}" ${st(OUT, 2)}/>`;
      obj += `<path d="M56,62Q80,57 104,62" stroke="#ffd76a" stroke-width="1.5" fill="none"/>`;
      obj += `<circle cx="44" cy="70" r="4" fill="${M.u('gold')}" ${st(OUT, 1.2)}/><circle cx="116" cy="70" r="4" fill="${M.u('gold')}" ${st(OUT, 1.2)}/>`;
      break;
    case 7: // fasces of office
      obj += place(fasces(M, 64, 10, 100, 'silver'), 16, 6, 1);
      break;
    case 8: // Flavian crown
      obj += place(motifColosseumCrown(M, 2, pal.accent).replace(/<circle cx="64" cy="58" r="42"[^>]*\/>/, '').replace(/<path d="M[^"]*" fill="#fff" opacity=".1"\/>/, ''), 8, 18, 1.1);
      break;
    case 9: // purple mantle on a stand
      obj += `<rect x="77" y="18" width="6" height="102" fill="${M.u('wood')}" ${st(OUT, 1.5)}/><rect x="44" y="20" width="72" height="6" rx="3" fill="${M.u('gold')}" ${st(OUT, 1.5)}/>`;
      obj += `<path d="M48,26C44,60 40,90 34,116C54,110 64,118 80,112C96,118 106,110 126,116C120,90 116,60 112,26Z" fill="${M.u('purple')}" ${st(OUT, 2)}/>`;
      obj += `<path d="M34,116C54,110 64,118 80,112C96,118 106,110 126,116L125,109C106,104 96,112 80,106C64,112 54,104 35,109Z" fill="${M.u('gold')}"/>`;
      obj += `<path d="M60,40Q58,80 54,108M80,42V106M100,40Q102,80 106,108" fill="none" stroke="#2d0c3c" stroke-width="1.8" opacity=".55"/><path d="M68,44Q68,80 66,108M92,44Q92,80 94,108" fill="none" stroke="#fff" stroke-width="1.6" opacity=".25"/>`;
      obj += `<circle cx="80" cy="34" r="7" fill="${M.u('gold')}" ${st(OUT, 1.6)}/><circle cx="80" cy="34" r="3" fill="#c0281e"/>`;
      break;
    case 10: // corona triumphalis
      obj += place(wreath(M, 64, 58, 36, 'gold', 9, 15, 0.5), 16, 4, 1);
      for (const a of [160, 200, 240, 300, 340, 20]) {
        const r = (a * Math.PI) / 180;
        obj += `<circle cx="${n(80 + Math.cos(r) * 36)}" cy="${n(62 + Math.sin(r) * 36)}" r="3.6" fill="${a % 40 === 0 ? '#c0281e' : '#2f8f9a'}" ${st(OUT, 1)}/>`;
      }
      obj += `<path d="M72,96C64,104 58,112 52,118L60,116L62,124C68,114 74,106 80,100C86,106 92,114 98,124L100,116L108,118C102,112 96,104 88,96Z" fill="${pal.accent2}" ${st(OUT, 1.5)}/>`;
      break;
    default: // eternal laurel
      obj += `<circle cx="80" cy="62" r="30" fill="#fff6d0" opacity=".6"/>`;
      obj += place(wreath(M, 64, 58, 38, 'celest', 9, 15, 0.4), 16, 4, 1);
      obj += `<path d="${starPath(80, 62, 16, 0.42, 8)}${starPath(42, 22, 5, 0.4, 4, 0)}${starPath(122, 30, 4, 0.4, 4, 0)}${starPath(130, 92, 3.5, 0.4, 4, 0)}${starPath(30, 96, 4, 0.4, 4, 0)}" fill="#fff" ${st('#c08a20', 1)}/>`;
  }
  s += obj;
  s += plinth(M, pal.accent);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160"><defs>${M.defs()}</defs>${s}</svg>`;
}

// ================================================================ v0.3: 72 ranks

/**
 * Rank emblems for the 24-arena empire: rank = arena * 3 + grade (0 = III,
 * the entry grade … 2 = I, the top grade of the arena).
 *
 * Families set the base form (arena / 6):
 *  - gladiatorial (0–5): round bronze phalera with a riveted rim;
 *  - legion officers (6–11): silver tabula plaque over crossed gladii;
 *  - civic magistracies (12–17): gold-edged senatorial shield over crossed fasces;
 *  - imperial (18–23): gold laurel crown around a purple medallion.
 * Within a family the arena steps up the metal and ornament and carries its
 * own bold central charge. The grade is shown as 1–3 large pips on a dark
 * band under the emblem, sized to read at 20–28 px.
 */
type Fam = 0 | 1 | 2 | 3;

/** Per-arena field colour (the medallion / plaque / shield ground). */
const RANK_FIELD = [
  '#5a3418', '#6a3a1e', '#7a1a14', '#2a4a30', '#3b4048', '#1d3a60',
  '#16494a', '#5a2a14', '#1d3a60', '#0f4a54', '#3a0d1c', '#6a2a10',
  '#1f5f4a', '#1f3a6a', '#7a1414', '#16285a', '#5a1a3a', '#3a362e',
  '#3a1a5a', '#2a1a4a', '#2a1240', '#4a0a3a', '#2a2070', '#140c50',
];

function phaleraBase(M: Mats, a: number): string {
  const rim: MatName = a < 2 ? 'wood' : 'bronze';
  let s = `<circle cx="64" cy="54" r="44" fill="${M.u(rim)}" ${st(OUT, 3)}/>`;
  s += `<circle cx="64" cy="54" r="34" fill="${RANK_FIELD[a]}" ${st(OUT, 2)}/>`;
  s += rivets(64, 54, 39, 8 + a * 2, a < 2 ? '#c7ced6' : '#ffe0a0', 2);
  if (a >= 4) s += `<circle cx="64" cy="54" r="30" fill="none" stroke="${M.u('gold')}" stroke-width="2.4"/>`;
  return s;
}

function plaqueBase(M: Mats, a: number): string {
  // crossed gladii behind a silver tabula with an arched top
  const blade = (ang: number) =>
    `<g transform="translate(64,54) rotate(${ang})"><path d="M0,-62L7,-50V28H-7V-50Z" fill="${M.u('silver')}" ${st(OUT, 2)}/><rect x="-12" y="28" width="24" height="7" rx="2" fill="${M.u('gold')}" ${st(OUT, 1.8)}/><rect x="-4" y="35" width="8" height="10" fill="${M.u('red')}" ${st(OUT, 1.6)}/><circle cx="0" cy="48" r="4.5" fill="${M.u('gold')}" ${st(OUT, 1.6)}/></g>`;
  let s = blade(-118) + blade(118);
  const trim: MatName = a >= 10 ? 'gold' : 'silver';
  s += `<path d="M32,92V36Q32,14 64,12Q96,14 96,36V92Z" fill="${M.u(trim)}" ${st(OUT, 3)}/>`;
  s += `<path d="M39,86V38Q39,20 64,19Q89,20 89,38V86Z" fill="${RANK_FIELD[a]}" ${st(OUT, 1.6)}/>`;
  if (a >= 8) s += `<path d="M34,88h60" stroke="${M.u('gold')}" stroke-width="3"/>`;
  return s;
}

function senateBase(M: Mats, a: number): string {
  // crossed fasces behind a gold-edged heater shield
  const fx = (ang: number) => `<g transform="translate(64,54) rotate(${ang}) translate(-64,-54)">${fasces(M, 64, 6, 92, 'silver')}</g>`;
  let s = fx(-38) + fx(38);
  const edge = a >= 15 ? 7 : 5;
  s += `<path d="M28,16H100V54Q100,86 64,100Q28,86 28,54Z" fill="${M.u('gold')}" ${st(OUT, 3)}/>`;
  s += `<path d="M${28 + edge},${16 + edge}H${100 - edge}V54Q${100 - edge},${84 - edge / 2} 64,${100 - edge * 1.6}Q${28 + edge},${84 - edge / 2} ${28 + edge},54Z" fill="${RANK_FIELD[a]}" ${st(OUT, 1.4)}/>`;
  s += `<path d="M36,24H92" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>`;
  return s;
}

function crownBase(M: Mats, a: number): string {
  let s = '';
  if (a >= 22) {
    let rays = '';
    for (let i = 0; i < 20; i++) {
      const t = (i / 20) * Math.PI * 2;
      rays += `M64,54L${n(64 + Math.cos(t - 0.07) * 62)},${n(54 + Math.sin(t - 0.07) * 62)}L${n(64 + Math.cos(t + 0.07) * 62)},${n(54 + Math.sin(t + 0.07) * 62)}Z`;
    }
    s += `<path d="${rays}" fill="${M.u('celest')}" opacity=".7"/>`;
  }
  s += `<circle cx="64" cy="54" r="34" fill="${RANK_FIELD[a]}" ${st(OUT, 2.5)}/>`;
  s += `<circle cx="64" cy="54" r="30" fill="none" stroke="${M.u('gold')}" stroke-width="${a >= 20 ? 3 : 1.8}"/>`;
  s += wreath(M, 64, 54, 41, 'gold', a >= 20 ? 9 : 8, a >= 20 ? 15 : 13, 0.8);
  if (a >= 21) {
    for (const deg of [205, 245, 295, 335]) {
      const r = (deg * Math.PI) / 180;
      s += `<circle cx="${n(64 + Math.cos(r) * 41)}" cy="${n(54 + Math.sin(r) * 41)}" r="3.2" fill="${deg === 245 || deg === 295 ? '#c0281e' : '#2f8f9a'}" ${st(OUT, 1)}/>`;
    }
  }
  return s;
}

/** Central charge per arena (drawn around (64,54)). */
function rankCharge(M: Mats, a: number): string {
  const L = (mat: MatName) => M.u(mat);
  switch (a) {
    // ---- gladiatorial
    case 0:
      return rudis(M, 64, 54, -35, 'wood', 56) + rudis(M, 64, 54, 35, 'wood', 56);
    case 1:
      // palus post with a rope band and a rudis across it
      return `<rect x="57" y="22" width="14" height="64" rx="3" fill="${L('wood')}" ${st(OUT, 2.4)}/><path d="M57,36H71M57,41H71M57,70H71" stroke="${OUT}" stroke-width="2" opacity=".55"/>` + rudis(M, 64, 56, 50, 'wood', 54);
    case 2:
      // legionary galea (side view) with red crest
      return `<path d="M40,60Q40,30 64,28Q88,30 88,60L82,62V72L74,72V62H54V72H46V62Z" fill="${L('bronze')}" ${st(OUT, 2.4)}/><path d="M44,30Q64,6 86,28Q66,22 44,30Z" fill="${L('red')}" ${st(OUT, 2)}/><path d="M40,60H92" stroke="${OUT}" stroke-width="3"/><circle cx="76" cy="46" r="3" fill="${OUT}"/>`;
    case 3:
      // crossed pila over a small shield boss
      return `<path d="M36,84L90,26M92,84L38,26" stroke="${OUT}" stroke-width="7" stroke-linecap="round"/><path d="M36,84L90,26M92,84L38,26" stroke="${L('wood')}" stroke-width="4" stroke-linecap="round"/><path d="M86,24l10,-6l-4,10zM42,24l-10,-6l4,10z" fill="${L('iron')}" ${st(OUT, 1.6)}/><circle cx="64" cy="55" r="11" fill="${L('bronze')}" ${st(OUT, 2.4)}/>`;
    case 4:
      // crossed hammer and dolabra (the specialist's tools)
      return `<path d="M42,84L84,30M86,84L44,30" stroke="${OUT}" stroke-width="7" stroke-linecap="round"/><path d="M42,84L84,30M86,84L44,30" stroke="${L('wood')}" stroke-width="4" stroke-linecap="round"/><path d="M76,22h18v12h-18z" fill="${L('iron')}" ${st(OUT, 2)} transform="rotate(38 85 28)"/><path d="M34,24q12,-4 20,6l-6,6q-6,-6 -14,-4z" fill="${L('iron')}" ${st(OUT, 2)}/>`;
    case 5:
      // thunderbolt on the shield boss
      return `<circle cx="64" cy="55" r="14" fill="${L('gold')}" ${st(OUT, 2.4)}/>` + [1, -1].map((d) => `<path d="${boltPath(64, 55, d)}" fill="${L('gold')}" ${st(OUT, 1.6)}/><path d="${boltPath(64, 55, d)}" fill="${L('gold')}" ${st(OUT, 1.6)} transform="matrix(1 0 0 -1 0 110)"/>`).join('');
    // ---- legion officers
    case 6:
      // signum: pole with stacked discs
      return `<path d="M64,20V86" stroke="${OUT}" stroke-width="6"/><path d="M64,20V86" stroke="${L('wood')}" stroke-width="3"/>` + [36, 50, 64].map((y) => `<circle cx="64" cy="${y}" r="7.5" fill="${L('silver')}" ${st(OUT, 2)}/>`).join('') + `<path d="M58,22l6,-10l6,10z" fill="${L('silver')}" ${st(OUT, 1.6)}/><path d="M52,76H76" stroke="${OUT}" stroke-width="5" stroke-linecap="round"/>`;
    case 7:
      // optio's knobbed staff and a small pennant
      return `<path d="M50,86L78,24" stroke="${OUT}" stroke-width="7" stroke-linecap="round"/><path d="M50,86L78,24" stroke="${L('wood')}" stroke-width="4" stroke-linecap="round"/><circle cx="79" cy="22" r="7" fill="${L('silver')}" ${st(OUT, 2)}/><path d="M70,40L90,46L82,52L88,60L66,52Z" fill="${L('red')}" ${st(OUT, 1.8)}/>`;
    case 8:
      return `<g transform="translate(64,52) scale(.62) translate(-64,-58)">${eagle(M, 'silver')}</g>`;
    case 9:
      // centurion's helmet with transverse crest
      return `<path d="M42,66Q42,40 64,38Q86,40 86,66H80V76H72V66H56V76H48V66Z" fill="${L('silver')}" ${st(OUT, 2.4)}/><path d="M30,40Q64,18 98,40V46Q64,28 30,46Z" fill="${L('red')}" ${st(OUT, 2)}/><path d="M42,66H86" stroke="${OUT}" stroke-width="3"/>`;
    case 10:
      // pilum through a corona
      return `<circle cx="64" cy="56" r="17" fill="none" stroke="${OUT}" stroke-width="8"/><circle cx="64" cy="56" r="17" fill="none" stroke="${L('gold')}" stroke-width="5"/><path d="M64,90V24" stroke="${OUT}" stroke-width="7"/><path d="M64,90V26" stroke="${L('wood')}" stroke-width="3.6"/><path d="M58,28l6,-14l6,14z" fill="${L('silver')}" ${st(OUT, 1.8)}/>`;
    case 11:
      // vexillum with fringe
      return `<path d="M64,18V88M46,26H82" stroke="${OUT}" stroke-width="5" stroke-linecap="round"/><path d="M64,18V88M46,26H82" stroke="${L('gold')}" stroke-width="2.6" stroke-linecap="round"/><path d="M47,28H81V62Q64,66 47,62Z" fill="${L('red')}" ${st(OUT, 2.2)}/><path d="M50,66v6M57,67v6M64,68v6M71,67v6M78,66v6" stroke="${L('gold')}" stroke-width="2.4"/><circle cx="64" cy="44" r="7" fill="none" stroke="${L('gold')}" stroke-width="3"/>`;
    // ---- civic magistracies
    case 12:
      // quaestor: a gold coin with a wreathed head
      return `<circle cx="64" cy="52" r="22" fill="${L('gold')}" ${st(OUT, 2.4)}/><circle cx="64" cy="52" r="17" fill="none" stroke="${OUT}" stroke-width="1.2" opacity=".5"/><g transform="translate(64,52) scale(.55) translate(-64,-56)">${laureateProfile(M, 'gold')}</g>`;
    case 13:
      // aedile: theatre mask of the games
      return `<path d="M44,34Q64,26 84,34Q86,62 64,78Q42,62 44,34Z" fill="${L('marble')}" ${st(OUT, 2.4)}/><path d="M50,46q6,-5 12,0q-6,4 -12,0zM66,46q6,-5 12,0q-6,4 -12,0z" fill="${OUT}"/><path d="M54,62Q64,70 74,62Q64,66 54,62Z" fill="${OUT}"/><path d="M44,34Q38,24 32,30M84,34Q90,24 96,30" fill="none" stroke="${L('gold')}" stroke-width="3"/>`;
    case 14:
      // tribune: oak-leaf corona civica
      return wreath(M, 64, 52, 20, 'leaf', 6, 11, 0.9) + `<circle cx="64" cy="52" r="6" fill="${L('gold')}" ${st(OUT, 1.6)}/>`;
    case 15:
      // praetor: scales of justice
      return `<path d="M64,26V80M42,36H86M52,82H76" stroke="${OUT}" stroke-width="6" stroke-linecap="round"/><path d="M64,26V80M42,36H86M52,82H76" stroke="${L('gold')}" stroke-width="3" stroke-linecap="round"/><path d="M34,56Q42,66 50,56ZM78,56Q86,66 94,56Z" fill="${L('gold')}" ${st(OUT, 2)}/><path d="M42,36L34,56M42,36L50,56M86,36L78,56M86,36L94,56" stroke="${OUT}" stroke-width="1.4"/>`;
    case 16:
      // consul: the curule chair
      return `<path d="M44,80L84,42M84,80L44,42" stroke="${OUT}" stroke-width="9" stroke-linecap="round"/><path d="M44,80L84,42M84,80L44,42" stroke="${L('gold')}" stroke-width="5" stroke-linecap="round"/><rect x="38" y="34" width="52" height="9" rx="3" fill="${L('gold')}" ${st(OUT, 2)}/><path d="M40,82H52M76,82H88" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>`;
    case 17:
      // censor: the citizen register (scroll) and stylus
      return `<rect x="42" y="34" width="44" height="40" fill="${L('marble')}" ${st(OUT, 2)}/><path d="M48,44H80M48,52H80M48,60H72" stroke="${OUT}" stroke-width="2" opacity=".6"/><rect x="36" y="30" width="10" height="48" rx="5" fill="${L('gold')}" ${st(OUT, 2)}/><rect x="82" y="30" width="10" height="48" rx="5" fill="${L('gold')}" ${st(OUT, 2)}/>`;
    // ---- imperial
    case 18:
      // legate: gladius upright with an eagle-pommel
      return `<path d="M64,18L70,28V70H58V28Z" fill="${L('silver')}" ${st(OUT, 2.2)}/><rect x="50" y="70" width="28" height="7" rx="3" fill="${L('gold')}" ${st(OUT, 2)}/><rect x="60" y="77" width="8" height="10" fill="${L('red')}" ${st(OUT, 1.6)}/><circle cx="64" cy="89" r="5" fill="${L('gold')}" ${st(OUT, 1.8)}/>`;
    case 19:
      // proconsul: the orb of the provinces with a cross-band
      return `<circle cx="64" cy="56" r="20" fill="${L('gold')}" ${st(OUT, 2.4)}/><path d="M44,56H84M64,36V76" stroke="${OUT}" stroke-width="2" opacity=".6"/><path d="M50,42Q64,56 50,70M78,42Q64,56 78,70" fill="none" stroke="${OUT}" stroke-width="1.4" opacity=".5"/><path d="${starPath(64, 28, 7, 0.42)}" fill="${L('gold')}" ${st(OUT, 1.4)}/>`;
    case 20:
      return `<g transform="translate(64,54) scale(.6) translate(-64,-58)">${eagle(M, 'gold')}</g>`;
    case 21:
      // princeps: laureate profile
      return `<g transform="translate(64,52) scale(1.05) translate(-64,-56)">${laureateProfile(M, 'gold')}</g>`;
    case 22:
      // augustus: eagle beneath a radiate crown
      return `<g transform="translate(64,60) scale(.5) translate(-64,-58)">${eagle(M, 'gold')}</g><path d="M46,34L50,22L55,32L60,18L64,30L68,18L73,32L78,22L82,34Z" fill="${L('celest')}" ${st(OUT, 1.8)}/>`;
    default: {
      // caesar aeternus: radiate crown with a star
      let spikes = 'M38,70';
      for (let i = 0; i < 7; i++) {
        const x0 = 38 + i * 7.43;
        spikes += `L${n(x0 + 3.7)},${n(54 - (26 - Math.abs(i - 3) * 4))}L${n(x0 + 7.43)},54`;
      }
      spikes += 'L90,70Z';
      return `<path d="${spikes}" fill="${L('celest')}" ${st('#5a3a10', 2)}/><rect x="36" y="62" width="56" height="12" rx="3" fill="${L('gold')}" ${st('#5a3a10', 2)}/><circle cx="64" cy="68" r="3.6" fill="#e0605a"/><path d="${starPath(64, 24, 8, 0.4, 4, 0)}" fill="#fff"/>`;
    }
  }
}

/** Grade pips: 1–3 bold marks on a dark band (studs / bars / gold dots / stars by family). */
function gradePips(M: Mats, fam: Fam, count: number, band: string): string {
  const w = 28 + count * 24;
  const x0 = 64 - w / 2;
  let s = `<path d="M${n(x0 - 9)},104L${n(x0)},99V125L${n(x0 - 9)},120L${n(x0 - 4)},112Z M${n(64 + w / 2 + 9)},104L${n(64 + w / 2)},99V125L${n(64 + w / 2 + 9)},120L${n(64 + w / 2 + 4)},112Z" fill="${shade(band, -0.35)}" ${st(OUT, 1.6)}/>`;
  s += `<rect x="${n(x0)}" y="98" width="${n(w)}" height="28" rx="6" fill="${band}" ${st(OUT, 2)}/>`;
  const mat: MatName = fam === 0 ? 'bronze' : fam === 1 ? 'silver' : fam === 2 ? 'gold' : 'celest';
  let d = '';
  for (let i = 0; i < count; i++) {
    const x = 64 + (i - (count - 1) / 2) * 24;
    if (fam === 0) d += `M${n(x + 8.5)},112a8.5,8.5 0 1,0 -17,0a8.5,8.5 0 1,0 17,0Z`;
    else if (fam === 1) d += `M${n(x - 5.5)},102h11v20h-11z`;
    else if (fam === 2) d += `M${n(x)},102L${n(x + 10)},112L${n(x)},122L${n(x - 10)},112Z`;
    else d += starPath(x, 113, 11.5, 0.46);
  }
  s += `<path d="${d}" fill="${M.u(mat)}" stroke="${OUT}" stroke-width="1.6" stroke-linejoin="round"/>`;
  return s;
}

/** Number of rank emblems (24 arenas x 3 grades). */
export const RANK_EMBLEM_COUNT = 72;

/** Rank emblem for rank 0..71 (rank = arena*3 + grade, grade 0 = III … 2 = I). viewBox 0 0 128 128. */
export function rankEmblemSvg(rankIndex: number, size = 128): string {
  const idx = Math.max(0, Math.min(RANK_EMBLEM_COUNT - 1, Math.floor(Number.isFinite(rankIndex) ? rankIndex : 0)));
  const a = Math.floor(idx / 3);
  const grade = idx % 3;
  const fam = Math.floor(a / 6) as Fam;
  const id = idPrefix('rank-emblem', idx);
  const M = new Mats(id);
  let body = '';
  // top grade of an arena: a soft glow behind the emblem
  if (grade === 2) {
    M.extra += radGrad(`${id}gl`, [
      [0, '#fff3c0', 0.9],
      [0.6, fam >= 2 ? '#f2c64a' : fam === 1 ? '#d8e2ee' : '#f0b070', 0.35],
      [1, '#f2c64a', 0],
    ]);
    body += `<circle cx="64" cy="56" r="62" fill="url(#${id}gl)"/>`;
  }
  body += fam === 0 ? phaleraBase(M, a) : fam === 1 ? plaqueBase(M, a) : fam === 2 ? senateBase(M, a) : crownBase(M, a);
  body += rankCharge(M, a);
  const band = ['#5a2a14', '#24324a', '#7a1414', '#3a1a5a'][fam];
  body += gradePips(M, fam, grade + 1, band);
  const sz = n(size);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="${sz}" height="${sz}"><defs>${M.defs()}</defs>${body}</svg>`;
}
