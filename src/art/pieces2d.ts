/**
 * Original Roman-flavoured 2D chess piece set (viewBox 0 0 100 100).
 * Classic silhouettes come first; Roman touches (galea crest on the pawn,
 * plumed mane on the knight, laurel band on the bishop, arched gate on the
 * rook, radiate crown on the queen, laurel collar on the king) are details
 * that vanish gracefully at small sizes.
 */
import { ARENAS } from '../world/arenas';
import { idPrefix, linGrad, mix, shade } from './svgUtil';

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export type PieceColor = 'w' | 'b';

const GOLD = '#d8a63c';

// Shared plinth (two steps) used by every piece.
const BASE = 'M21,91H79Q82,91 82,88V85Q82,82 79,82H21Q18,82 18,85V88Q18,91 21,91Z';
const STEP = 'M28,82H72L69,76H31Z';

type Shape = { body: string[]; detail: string; accent: string; gold: string };

function pawn(): Shape {
  return {
    body: [
      'M31,76C33,67 39,62 43,58H57C61,62 67,67 69,76Z',
      'M36,53.5H64Q67,53.5 67,56.5Q67,59.5 64,59.5H36Q33,59.5 33,56.5Q33,53.5 36,53.5Z',
      // galea-domed head with a small brim at the back of the neck
      'M50,27C58.5,27 64,33 64,41C64,46 62,50 59,52.5H41C38,50 36,46 36,41C36,33 41.5,27 50,27Z',
    ],
    detail: 'M38.5,44Q50,48.5 61.5,44',
    // crest ridge on top of the helmet
    accent: 'M41,30.5C42,20 47,16.5 50,16.5C53,16.5 58,20 59,30.5Q50,25 41,30.5Z',
    gold: '',
  };
}

function knight(): Shape {
  return {
    body: [
      // horse head facing left
      'M70,76C73,60 71,40 61,26L60,13L53.5,21C44,22 36,29 30.5,39C26,44 23.5,50 26.5,53.5C30,57 35,56 38.5,53.5C42,51 46,50.5 48.5,52C41,59 35,67 32,76Z',
    ],
    // eye, nostril, mouth line
    detail: 'M44,33.5a2.6,2.2 0 1,0 0.1,0ZM29.5,47.5a1.6,1.6 0 1,0 0.1,0ZM27.5,52.5Q31,52 34,50',
    // Roman plumed mane running down the neck
    accent:
      'M60.5,25C69,27 76.5,35 79,44C81,53 79.5,63 76,71L70.5,71C72.5,58 71,44 63.5,31Z',
    // bridle
    gold: 'M33.5,45.5L50,39L58,33',
  };
}

function bishop(): Shape {
  return {
    body: [
      'M33,76C35,68 41,64 44,60H56C59,64 65,68 67,76Z',
      'M37,54H63Q66,54 66,57Q66,60 63,60H37Q34,60 34,57Q34,54 37,54Z',
      'M50,19C60,27 64.5,36 63,44C61.5,51 56.5,54 50,54C43.5,54 38.5,51 37,44C35.5,36 40,27 50,19Z',
      'M50,10.5a4.6,4.6 0 1,0 0.1,0Z',
    ],
    // mitre slit
    detail: 'M57,31L48,41',
    accent: '',
    // laurel band across the mitre
    gold: '',
  };
}

function rook(): Shape {
  return {
    body: [
      'M29,76L33,70L35,45L31,41V22H40V29H46V22H54V29H60V22H69V41L65,45L67,70L71,76Z',
    ],
    detail: 'M31.5,41H68.5M35,45H65M33.5,70H66.5M44.5,70V61Q50,53.5 55.5,61V70',
    accent: '',
    gold: '',
  };
}

function queen(): Shape {
  return {
    body: [
      'M30,76C34,66 38,59 39,53H61C62,59 66,66 70,76Z',
      'M36,47.5H64Q67,47.5 67,50.5Q67,53.5 64,53.5H36Q33,53.5 33,50.5Q33,47.5 36,47.5Z',
      'M34,47.5L25,24L37.5,37L39,17L46,33L50,13L54,33L61,17L62.5,37L75,24L66,47.5Z',
    ],
    detail: 'M36.5,42Q50,38.5 63.5,42',
    accent: '',
    gold: 'M25,20.5a3.6,3.6 0 1,0 0.1,0ZM39,13.5a3.6,3.6 0 1,0 0.1,0ZM50,9.2a3.8,3.8 0 1,0 0.1,0ZM61,13.5a3.6,3.6 0 1,0 0.1,0ZM75,20.5a3.6,3.6 0 1,0 0.1,0Z',
  };
}

function king(): Shape {
  return {
    body: [
      'M30,76C34,66 38,59 39,53H61C62,59 66,66 70,76Z',
      'M36,47.5H64Q67,47.5 67,50.5Q67,53.5 64,53.5H36Q33,53.5 33,50.5Q33,47.5 36,47.5Z',
      'M35,47.5C29,39 30.5,30 39,30C44,30 47.5,33.5 50,37C52.5,33.5 56,30 61,30C69.5,30 71,39 65,47.5Z',
      'M46.5,8H53.5V15H60V21.5H53.5V31H46.5V21.5H40V15H46.5Z',
    ],
    detail: 'M50,37V47',
    accent: '',
    gold: '',
  };
}

const SHAPES: Record<PieceType, () => Shape> = { p: pawn, n: knight, b: bishop, r: rook, q: queen, k: king };

export function pieceSvg(type: PieceType, color: PieceColor, setIndex: number): string {
  const arena = ARENAS[((setIndex % ARENAS.length) + ARENAS.length) % ARENAS.length];
  const pal = arena.palette;
  const id = idPrefix('piece', type, color, arena.index);
  const shape = SHAPES[type]();

  const isW = color === 'w';
  const base = isW ? pal.pieceLight : pal.pieceDark;
  const outline = isW ? shade(mix(pal.pieceDark, '#000000', 0.15), -0.35) : shade(pal.pieceDark, -0.72);
  const top = isW ? shade(base, 0.35) : shade(base, 0.22);
  const bottom = isW ? mix(base, pal.pieceDark, 0.22) : shade(base, -0.4);
  const detailCol = isW ? outline : mix(pal.pieceLight, base, 0.15);
  const crest = mix('#b8241c', pal.accent, 0.25);
  const gold = isW ? mix(GOLD, pal.accent2, 0.15) : mix(GOLD, '#f1cf72', 0.35);

  const defs =
    linGrad(`${id}f`, [
      [0, top],
      [0.55, base],
      [1, bottom],
    ], 0, 0, 1, 1) +
    linGrad(`${id}m`, [
      [0, shade(gold, 0.35)],
      [1, shade(gold, -0.25)],
    ]);

  const sw = 3.2;
  const strokeAttr = `stroke="${outline}" stroke-width="${sw}" stroke-linejoin="round"`;
  const thinStroke = `stroke="${outline}" stroke-width="2.4" stroke-linejoin="round"`;

  let out =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><defs>${defs}</defs>` +
    // soft contact shadow
    `<ellipse cx="50" cy="91.5" rx="33" ry="4" fill="#000" opacity=".22"/>`;

  // body: fill, then a clipped upper-left rim light, then the outline on top
  const parts = [BASE, STEP, ...shape.body];
  const pathsMarkup = parts.map((d) => `<path d="${d}"/>`).join('');
  out += `<clipPath id="${id}c">${pathsMarkup}</clipPath>`;
  out += `<g fill="url(#${id}f)">${pathsMarkup}</g>`;
  out += `<g fill="none" stroke="#fff" stroke-opacity="${isW ? 0.7 : 0.32}" stroke-width="3" clip-path="url(#${id}c)"><g transform="translate(1.7,1.7)">${pathsMarkup}</g></g>`;
  out += `<g fill="none" ${strokeAttr}>${pathsMarkup}</g>`;

  // crest / mane accents
  if (shape.accent) {
    out += `<path d="${shape.accent}" fill="${crest}" ${thinStroke}/>`;
  }

  // base band highlight
  out += `<path d="M22,85.5H78" stroke="${isW ? '#fff' : pal.pieceLight}" stroke-opacity="${isW ? 0.6 : 0.35}" stroke-width="1.4" stroke-linecap="round"/>`;

  // interior detail lines
  if (shape.detail) {
    out += `<path d="${shape.detail}" fill="${type === 'n' ? detailCol : 'none'}" stroke="${detailCol}" stroke-width="${isW ? 2.4 : 2.2}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  // gold trims
  if (shape.gold) {
    const fillGold = type === 'q';
    out += `<path d="${shape.gold}" fill="${fillGold ? `url(#${id}m)` : 'none'}" stroke="${fillGold ? outline : gold}" stroke-width="${fillGold ? 2 : 2.6}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  // gold collars (and the king's cross) — the premium Roman trim
  const goldParts: string[] = [];
  if (type === 'p' || type === 'b' || type === 'q' || type === 'k') goldParts.push(shape.body[1]);
  if (type === 'k') goldParts.push(shape.body[3]);
  if (goldParts.length) {
    out += `<g fill="url(#${id}m)" ${thinStroke}>${goldParts.map((d) => `<path d="${d}"/>`).join('')}</g>`;
    out += `<path d="${type === 'k' ? 'M48.5,10V29M42,16.6H58' : ''}M38,${type === 'p' ? 55.5 : type === 'b' ? 56 : 49.5}H62" stroke="#fff" stroke-opacity=".55" stroke-width="1.3" stroke-linecap="round"/>`;
  }
  if (type === 'r') {
    out += `<path d="M38,31H62M38,36H62" stroke="${detailCol}" stroke-width="1.4" opacity=".45"/>`;
  }

  out += '</svg>';
  return out;
}

/** All twelve pieces of one set, keyed like "wK", "bP" (handy for board renderers). */
export function pieceSetSvgs(setIndex: number): Record<string, string> {
  const res: Record<string, string> = {};
  for (const c of ['w', 'b'] as PieceColor[]) {
    for (const t of ['p', 'n', 'b', 'r', 'q', 'k'] as PieceType[]) {
      res[c + t.toUpperCase()] = pieceSvg(t, c, setIndex);
    }
  }
  return res;
}

