/**
 * GLADIUS chess pieces (v0.4) — hand-authored 2D vector illustrations.
 *
 * Every piece is a stack of flat-designed parts (body, gold trim, crest,
 * ink details) drawn into a 100×100 viewBox, lit from the upper left by
 * cylindrical gradients, with a firm outline so silhouettes survive at
 * 32–40 px. Designs (shapes) and materials (palettes) are independent, so a
 * collection is a design + a light material + a dark material.
 *
 * King / queen rule (v0.4, every set): the queen wears a WIDE open crown
 * (pearl coronet or radiate fan, wider than her waisted body) and the king a
 * CLOSED, domed crown under a single tall finial (cross-orb, or the aquila
 * for the Praetorians) on a broader body — two different silhouettes that
 * survive the 32 px "blink test" on every board.
 *
 * Bake-time only: `node scripts/bake-sprites.mjs pieces` rasterises these
 * SVGs in Chromium to public/pieces/<set>/<color><type>.webp. Nothing in the
 * shipped app imports this file.
 */

export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
export const PIECE_TYPES: PieceType[] = ['p', 'n', 'b', 'r', 'q', 'k'];

/** A colour ramp across a lit cylinder, left (rim) → right (shadow). */
type Ramp = [number, string][];

export type Material = {
  body: Ramp;
  gold: Ramp;
  crest: Ramp;
  outline: string; // body outline
  goldOutline: string;
  ink: string; // engraved details (doors, eyes, slits)
  line: string; // fine decorative lines on the body
  halo: string | null; // soft outer edge so dark pieces read on dark squares
  vein?: string | null; // marble veining colour
};

type Mat = 'body' | 'gold' | 'crest' | 'ink' | 'line' | 'gline' | 'hi' | 'iline';
type Part = { d: string; m: Mat; w?: number; noHalo?: boolean };
type Design = Record<PieceType, () => Part[]>;

// ---------------------------------------------------------------- geometry

type Seg = ['L', number, number] | ['Q', number, number, number, number] | ['C', number, number, number, number, number, number];
const f = (n: number) => +n.toFixed(2);
const mx = (x: number) => 100 - x;

/** Mirror a right-hand profile (top → bottom) into a closed symmetric outline. */
function lathe(start: [number, number], segs: Seg[]): string {
  let d = `M${f(mx(start[0]))} ${f(start[1])}L${f(start[0])} ${f(start[1])}`;
  const pts: [number, number][] = [start];
  for (const s of segs) {
    d += s[0] + s.slice(1).map((v) => f(v as number)).join(' ');
    pts.push([s[s.length - 2] as number, s[s.length - 1] as number]);
  }
  for (let i = segs.length - 1; i >= 0; i--) {
    const s = segs[i];
    const p = pts[i];
    if (s[0] === 'L') d += `L${f(mx(p[0]))} ${f(p[1])}`;
    else if (s[0] === 'Q') d += `Q${f(mx(s[1]))} ${f(s[2])} ${f(mx(p[0]))} ${f(p[1])}`;
    else d += `C${f(mx(s[3]))} ${f(s[4])} ${f(mx(s[1]))} ${f(s[2])} ${f(mx(p[0]))} ${f(p[1])}`;
  }
  return d + 'Z';
}
/** Move an absolute-command path (M/L/Q/C only) down by dy. */
function shiftY(d: string, dy: number): string {
  let i = 0;
  return d.replace(/-?[\d.]+/g, (n) => (i++ % 2 ? String(f(Number(n) + dy)) : n));
}
/** Rounded horizontal band centred on x = 50. */
function band(y0: number, y1: number, hw: number, r = 1.6, hwBottom = hw): string {
  const a = 50 - hw, b = 50 + hw, c = 50 - hwBottom, e = 50 + hwBottom;
  return `M${f(a + r)} ${f(y0)}L${f(b - r)} ${f(y0)}Q${f(b)} ${f(y0)} ${f(b + (e - b) * 0.15)} ${f(y0 + r)}L${f(e)} ${f(y1 - r)}Q${f(e)} ${f(y1)} ${f(e - r)} ${f(y1)}L${f(c + r)} ${f(y1)}Q${f(c)} ${f(y1)} ${f(c)} ${f(y1 - r)}L${f(a + (c - a) * 0.15)} ${f(y0 + r)}Q${f(a)} ${f(y0)} ${f(a + r)} ${f(y0)}Z`;
}
const circle = (cx: number, cy: number, r: number) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const ellipse = (cx: number, cy: number, rx: number, ry: number) => `M${f(cx - rx)} ${f(cy)}a${f(rx)} ${f(ry)} 0 1 0 ${f(2 * rx)} 0a${f(rx)} ${f(ry)} 0 1 0 ${f(-2 * rx)} 0Z`;
/** A laurel leaf from (x,y) pointing along angle a (radians). */
function leaf(x: number, y: number, a: number, len: number, wid: number): string {
  const ca = Math.cos(a), sa = Math.sin(a);
  const tx = x + ca * len, ty = y + sa * len;
  const nx = -sa * wid, ny = ca * wid;
  const m1x = x + ca * len * 0.45, m1y = y + sa * len * 0.45;
  return `M${f(x)} ${f(y)}Q${f(m1x + nx)} ${f(m1y + ny)} ${f(tx)} ${f(ty)}Q${f(m1x - nx)} ${f(m1y - ny)} ${f(x)} ${f(y)}Z`;
}
/** A sprig of laurel leaves along a band, mirrored about x = 50. */
function laurelBand(y: number, hw: number, n: number, len = 4.6, wid = 1.7): Part[] {
  const out: Part[] = [];
  for (let side = -1; side <= 1; side += 2)
    for (let i = 0; i < n; i++) {
      const x = 50 + side * (hw - 0.5 - i * ((hw - 3.5) / n));
      const up = i % 2 === 0 ? -1 : 1;
      const a = (side < 0 ? 0 : Math.PI) + up * 0.42 * (side < 0 ? 1 : -1);
      out.push({ d: leaf(x, y, a, len, wid), m: 'gold', w: 0.9, noHalo: true });
    }
  return out;
}

// ---------------------------------------------------------------- shared parts

/** "SPQR" as engraved strokes, letters 5 × 6 units, starting at (x, y). */
function spqr(x: number, y: number, k = 1): string {
  const L = (x0: number, y0: number, pts: string) => pts.replace(/(-?[\d.]+),(-?[\d.]+)/g, (_, a, b) => `${f(x0 + Number(a) * k)} ${f(y0 + Number(b) * k)}`);
  const w = 6.4 * k;
  return (
    L(x, y, 'M4.4,0.9Q2.6,-0.3 1,0.9Q0,2.6 2.4,3Q4.9,3.4 4.4,5.1Q3,6.5 0.4,5.4') +
    L(x + w, y, 'M0.8,6L0.8,0L3,0Q5,0 5,1.6Q5,3.2 3,3.2L0.8,3.2') +
    L(x + 2 * w, y, 'M2.6,0Q0.2,0 0.2,3Q0.2,6 2.6,6Q5,6 5,3Q5,0 2.6,0M3.2,4.6L5.4,6.6') +
    L(x + 3 * w, y, 'M0.8,6L0.8,0L3,0Q5,0 5,1.6Q5,3.2 3,3.2L0.8,3.2M2.6,3.2L5,6')
  );
}
/** The king's mark in every set: an orb under a tall cross (top at y ≈ 2). */
function crossOrb(orbY: number, m: Mat = 'gold'): Part[] {
  return [
    { d: circle(50, orbY, 3.3), m },
    { d: `M47 ${f(orbY - 2.6)}L47 10L41.6 10L41.6 5.6L47 5.6L47 2L53 2L53 5.6L58.4 5.6L58.4 10L53 10L53 ${f(orbY - 2.6)}Z`, m },
  ];
}
/** The queen's mark in every set: a wide five-point coronet (fan), pearl-tipped. */
function coronet(baseY: number, hw: number, m: Mat = 'gold', pearl: Mat = 'hi'): Part[] {
  const T: [number, number][] = [[50 - hw - 6, baseY - 19], [50 - hw * 0.55, baseY - 24], [50, baseY - 27], [50 + hw * 0.55, baseY - 24], [50 + hw + 6, baseY - 19]];
  const D: [number, number][] = [[50 - hw * 0.62, baseY - 9], [50 - hw * 0.28, baseY - 11], [50 + hw * 0.28, baseY - 11], [50 + hw * 0.62, baseY - 9]];
  let d = `M${f(50 - hw + 1)} ${f(baseY + 1)}`;
  for (let i = 0; i < 5; i++) {
    d += `L${f(T[i][0])} ${f(T[i][1])}`;
    if (i < 4) d += `L${f(D[i][0])} ${f(D[i][1])}`;
  }
  d += `L${f(50 + hw - 1)} ${f(baseY + 1)}Z`;
  return [{ d, m }, ...T.map(([x, y], i): Part => ({ d: circle(x, y - 1.2, i === 2 ? 3.3 : 2.9), m: i === 2 ? 'crest' : pearl, w: 1.1 }))];
}

/** Two-step plinth: wide foot + gold fillet. Returns parts and the top y. */
function plinth(hw: number, opts: { fillet?: boolean; tall?: boolean } = {}): Part[] {
  const out: Part[] = [{ d: band(85, 94, hw, 2.6, hw + 0.5), m: 'body' }];
  if (opts.fillet !== false) out.push({ d: band(81, 85.4, hw - 3.2, 1.4, hw - 2.6), m: 'gold' });
  return out;
}

// ---------------------------------------------------------------- design: Legio (primary)

const legio: Design = {
  p: () => [
    { d: lathe([50, 52], [['C', 56, 52, 57.5, 55, 57, 57], ['C', 58.5, 66, 62, 74, 68, 82], ['L', 50, 82]]), m: 'body' },
    ...plinth(21),
    // legionary galea: face, dome with flared brim, gold brow band, crest
    { d: circle(50, 45.6, 10.6), m: 'body' },
    { d: band(54.5, 59, 11.5, 1.6, 10.5), m: 'gold' },
    { d: lathe([50, 27.4], [['C', 57.6, 27.4, 61.6, 32.6, 61.8, 39.2], ['L', 64.6, 41.4], ['Q', 65.4, 44.2, 62.6, 44.2], ['L', 50, 44.2]]), m: 'body' },
    { d: 'M38.6 39.6Q50 36.6 61.4 39.6', m: 'gline', w: 2.2 },
    { d: 'M44.8 29C43.8 23 46.2 18.4 50 18.4C53.8 18.4 56.2 23 55.2 29Z', m: 'crest' },
  ],
  r: () => [
    { d: lathe([50, 40], [['L', 67, 40], ['C', 66, 56, 67, 70, 71, 81.5], ['L', 50, 81.5]]), m: 'body' },
    ...plinth(26),
    { d: band(66.5, 69, 17.6, 1, 18.2), m: 'gline' },
    // corbel band and battlements
    { d: band(36, 42, 21.5, 1.6, 18), m: 'gold' },
    {
      d: 'M27.5 37L27.5 17.5Q27.5 16 29 16L35 16Q36.5 16 36.5 17.5L36.5 23.5L45.5 23.5L45.5 17.5Q45.5 16 47 16L53 16Q54.5 16 54.5 17.5L54.5 23.5L63.5 23.5L63.5 17.5Q63.5 16 65 16L71 16Q72.5 16 72.5 17.5L72.5 37Z',
      m: 'body',
    },
    { d: 'M44 82L44 75Q44 69.5 50 69.5Q56 69.5 56 75L56 82Z', m: 'ink', w: 1.2 },
    { d: 'M33 46.5L67 46.5M42 40.5L42 46.5M58 40.5L58 46.5M42 59L42 66.5M58 59L58 66.5', m: 'line', w: 1 },
    { d: 'M33 29.5L67 29.5', m: 'line', w: 1 },
    // tabula with SPQR
    { d: band(49, 58.6, 14.2, 1.2, 14.6), m: 'gold', w: 1.4 },
    { d: spqr(38.4, 50.8, 1.08), m: 'iline', w: 1.15 },
  ],
  b: () => [
    { d: lathe([50, 58], [['C', 56, 58, 57, 62, 57.5, 66], ['C', 58.5, 73, 62, 78, 67, 82], ['L', 50, 82]]), m: 'body' },
    ...plinth(22),
    { d: band(54, 59.5, 13, 1.8, 12), m: 'gold' },
    // mitre
    { d: lathe([50, 15], [['C', 56, 19, 63.5, 27, 63.5, 37], ['C', 63.5, 45, 60, 51, 56, 54.5], ['L', 50, 54.5]]), m: 'body' },
    { d: band(48.5, 53.5, 10.6, 1.6, 8.8), m: 'gold' },
    // augur slit
    { d: 'M57.2 25.5L46.2 39.5', m: 'ink', w: 3.4 },
    { d: circle(50, 11.6, 3.6), m: 'gold' },
  ],
  n: () => [
    ...plinth(23),
    // neck & head, facing left
    {
      d: 'M33.5 81.5C33 74 35.5 67.5 40.5 62C37 61 33.5 61.5 29.5 62.5C25.5 63.5 20.5 62 18.5 58C16.5 54 17.5 49.5 20.5 46.5C25.5 38.5 31.5 30.5 38.5 24.5C42 21.5 46 19.5 50 18.5L52.5 9.5C56 11.5 58.5 14.5 60 18C67.5 23 72.5 33 74.5 44C76 54 75 66 71.5 81.5Z',
      m: 'body',
    },
    // legionary crest along the mane
    {
      d: 'M55.5 15C63.5 15 72 21 77 30C81.5 38.5 83 49 82 58C81.5 64 80 69.5 77.5 74.5L72.5 72.5C74.5 63 74.5 52 72 43C69.5 33 64 24.5 56 19.5Z',
      m: 'crest',
    },
    { d: 'M55.6 15.2C63.5 15 72 21 77 30C81.5 38.5 83 49 82 58', m: 'gline', w: 1.6 },
    // bridle & brow band
    { d: 'M47 21.5C45 28 41 33 34 37.5M21.8 51.5C26 49 31 47.5 36 47.5C39.5 47.5 42.5 49 44.5 51', m: 'gline', w: 2 },
    { d: circle(36.2, 47.6, 1.8), m: 'gold', w: 0.8 },
    { d: ellipse(39.6, 32.6, 2.5, 1.9), m: 'ink', w: 0.8 },
    { d: 'M21 54.2Q23 53.2 24 55', m: 'line', w: 1.2 },
    { d: 'M60 22C66 31 69 43 68.5 55M44.5 51C47.5 46 47.5 40 44 36', m: 'line', w: 1.1 },
  ],
  q: () => [
    // slender, waisted body (the king is broader)
    { d: lathe([50, 49], [['C', 55, 49, 55.6, 53, 55.6, 57], ['C', 56.4, 68, 61, 76, 69, 82], ['L', 50, 82]]), m: 'body' },
    ...plinth(24),
    { d: band(45.5, 50.5, 12.4, 1.8, 11.2), m: 'gold' },
    { d: lathe([50, 33], [['L', 61.5, 33], ['C', 59, 38.5, 56.6, 42.5, 55.6, 46], ['L', 50, 46]]), m: 'body' },
    ...coronet(34, 13.6),
    { d: band(31.6, 36.4, 15.4, 1.6, 14.2), m: 'gold' },
    { d: ellipse(50, 34, 2.2, 1.8), m: 'crest', w: 0.9 },
  ],
  k: () => [
    { d: lathe([50, 50], [['C', 57, 50, 58.2, 54, 58.6, 58], ['C', 60, 69, 63.6, 76, 71.5, 82], ['L', 50, 82]]), m: 'body' },
    ...plinth(26.5),
    { d: band(47, 52.5, 14.8, 1.8, 13.6), m: 'gold' },
    // closed imperial crown: dome, laurel corona, arches
    { d: lathe([50, 19.6], [['C', 58.6, 19.6, 64.6, 24, 65.2, 31.6], ['C', 62.2, 39, 59.4, 44, 58.4, 48], ['L', 50, 48]]), m: 'body' },
    { d: 'M37.2 31Q39.4 22.4 50 20.6Q60.6 22.4 62.8 31M50 20.6L50 31', m: 'gline', w: 1.9 },
    { d: band(30.6, 37, 17.6, 2, 16), m: 'gold' },
    ...laurelBand(33.8, 16.8, 2, 7.4, 2.3),
    { d: ellipse(50, 33.8, 2.6, 2.2), m: 'crest', w: 1 },
    ...crossOrb(17),
  ],
};

// ---------------------------------------------------------------- design: Castra (Praetorian guard)
// Military forms: centurion-crested legionary pawns, gate-tower rooks with a
// shield boss, armoured warhorse with an upright plume, flamen's apex bishop,
// radiate-crown queen, helm-crowned king bearing the aquila.

function radiate(cx: number, cy: number, r0: number, r1: number, n: number, from: number, to: number, w: number): string {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a = from + ((to - from) * i) / (n - 1);
    const ca = Math.cos(a), sa = Math.sin(a);
    const px = -sa * w, py = ca * w;
    const bx = cx + ca * r0, by = cy + sa * r0;
    const tx = cx + ca * r1, ty = cy + sa * r1;
    d += `M${f(bx + px)} ${f(by + py)}L${f(tx + px * 0.25)} ${f(ty + py * 0.25)}Q${f(tx + ca * 1.4)} ${f(ty + sa * 1.4)} ${f(tx - px * 0.25)} ${f(ty - py * 0.25)}L${f(bx - px)} ${f(by - py)}Z`;
  }
  return d;
}

const castra: Design = {
  p: () => [
    // legionary in a galea with a transverse (centurion) crest, on a classic pawn body
    { d: lathe([50, 54], [['C', 56, 54, 57.4, 57, 57, 59.5], ['C', 58.4, 67, 62, 74, 67.5, 82], ['L', 50, 82]]), m: 'body' },
    ...plinth(20),
    { d: band(51.4, 56, 11.2, 1.6, 10), m: 'gold' },
    { d: 'M35.4 35.6C35.4 22.6 41.8 17.4 50 17.4C58.2 17.4 64.6 22.6 64.6 35.6C60 32.2 55.2 31 50 31C44.8 31 40 32.2 35.4 35.6Z', m: 'crest' },
    { d: 'M41 22.6L43.6 31.4M46 19.4L47.2 31M54 19.4L52.8 31M59 22.6L56.4 31', m: 'line', w: 0.9 },
    { d: lathe([50, 29.6], [['C', 57.8, 29.6, 61.6, 34.4, 61.6, 40.4], ['L', 62.8, 47.4], ['Q', 62.4, 51.8, 57.6, 51.8], ['L', 50, 51.8]]), m: 'body' },
    { d: 'M38.6 40.4Q50 37.4 61.4 40.4', m: 'gline', w: 2.2 },
    // cheek guards
    { d: 'M42.4 43.4Q41.2 47.6 43.2 51.2M57.6 43.4Q58.8 47.6 56.8 51.2', m: 'gline', w: 1.6 },
    { d: 'M47.2 44.6Q50 46.2 52.8 44.6', m: 'line', w: 1.1 },
  ],
  r: () => [
    { d: lathe([50, 36], [['L', 69, 36], ['L', 72, 81.5], ['L', 50, 81.5]]), m: 'body' },
    ...plinth(27),
    {
      d: 'M25.5 38L25.5 19Q25.5 17.5 27 17.5L32.5 17.5Q34 17.5 34 19L34 24.5L39.3 24.5L39.3 19Q39.3 17.5 40.8 17.5L46 17.5Q47.4 17.5 47.4 19L47.4 24.5L52.6 24.5L52.6 19Q52.6 17.5 54 17.5L59.2 17.5Q60.7 17.5 60.7 19L60.7 24.5L66 24.5L66 19Q66 17.5 67.5 17.5L73 17.5Q74.5 17.5 74.5 19L74.5 38Z',
      m: 'body',
    },
    { d: band(34.5, 39.5, 25.2, 1.4, 24.5), m: 'gold' },
    // gate with portcullis
    { d: 'M41 81.5L41 66Q41 57.5 50 57.5Q59 57.5 59 66L59 81.5Z', m: 'ink', w: 1.4 },
    { d: 'M45 60L45 81M50 58.5L50 81M55 60L55 81M42 67L58 67M41.5 74L58.5 74', m: 'gline', w: 1.1 },
    // shield boss (umbo) above the gate, flanked by arrow slits
    { d: circle(50, 47.4, 4.4), m: 'gold', w: 1.3 },
    { d: circle(50, 47.4, 1.6), m: 'hi', w: 0.8 },
    { d: 'M36.5 43.5L36.5 51.5M63.5 43.5L63.5 51.5', m: 'ink', w: 2.4 },
    { d: 'M29.5 30.5L70.5 30.5', m: 'line', w: 1 },
  ],
  n: () => [
    ...plinth(23),
    {
      d: 'M34 81.5L35.6 70.5C36.4 66.6 38.6 63.8 41.6 61.6L30.6 62.6Q22.4 63.8 19.6 58.4L18.6 53.6Q18.4 49.8 21 47.4L37.6 26.4Q40.8 22.2 46 20.6L48.4 11.6L52.2 10.8L56.2 19C63.4 21.8 68.6 27.4 71.6 34.2C75.4 43 76 52.6 74.6 61.4L72.2 81.5Z',
      m: 'body',
    },
    // upright crest plume between the ears
    { d: 'M48.6 14.2C48.4 7.6 53.6 2.6 61 2C68.6 1.4 75.4 5.4 78.4 11.6L78.8 21.4C75.6 19.2 71.6 18.6 67.6 19.4C63.2 20.4 59.6 21.6 56.6 20.6Z', m: 'crest' },
    { d: 'M54 7.6L58.6 17.2M60.6 4.4L63.6 17.6M67.6 3.8L68.4 18.6M73.6 6.8L73.8 18.6', m: 'line', w: 1 },
    // chanfron (face armour)
    { d: 'M46.4 22.2L39.8 27.2L23.8 46.8Q25.6 49.2 28.2 49.4L43.8 31.4L48.8 24.6Z', m: 'gold', w: 1.4 },
    { d: ellipse(45.8, 34.4, 2.4, 1.8), m: 'ink', w: 0.8 },
    // crinet bands and peytral
    { d: 'M35.2 73.6Q54 70.4 73.4 72.2L73 77.6Q54 76.2 34.6 78.8Z', m: 'gold', w: 1.6 },
    { d: 'M21 54.4Q23 53.4 24 55.2', m: 'line', w: 1.2 },
    { d: 'M44.6 52C47.6 47 47.4 41.4 44.4 38', m: 'line', w: 1.1 },
  ],
  b: () => [
    { d: lathe([50, 60], [['C', 55.5, 60, 56.5, 63, 57, 67], ['C', 58, 74, 61, 78.5, 66, 82], ['L', 50, 82]]), m: 'body' },
    ...plinth(22),
    { d: band(55.5, 61, 12.6, 1.6, 11.4), m: 'gold' },
    // flamen's apex: ogive cap with spike and wool disc
    { d: lathe([50, 22.5], [['C', 57, 24.5, 62.4, 32, 62.4, 42], ['C', 62.4, 49, 60, 54, 57.4, 56.5], ['L', 50, 56.5]]), m: 'body' },
    { d: 'M48.6 24L48.6 10.5L51.4 10.5L51.4 24Z', m: 'gold', w: 1.2 },
    { d: ellipse(50, 9.6, 4.6, 2.4), m: 'gold', w: 1.4 },
    { d: 'M59.6 30.2L40.8 46.2', m: 'gline', w: 3.6 },
    { d: band(50.6, 55.4, 11.6, 1.4, 9.8), m: 'gold' },
  ],
  q: () => [
    { d: lathe([50, 49], [['C', 55, 49, 55.6, 53, 55.6, 57], ['C', 56.4, 68, 61, 76, 69, 82], ['L', 50, 82]]), m: 'body' },
    ...plinth(24),
    { d: band(45.5, 50.5, 12.4, 1.8, 11.2), m: 'gold' },
    { d: lathe([50, 34], [['L', 60, 34], ['C', 58, 39.5, 56.6, 43.5, 55.6, 46.5], ['L', 50, 46.5]]), m: 'body' },
    // corona radiata: a wide fan of rays
    { d: radiate(50, 37, 6, 29, 9, -Math.PI * 0.94, -Math.PI * 0.06, 2.6), m: 'body', w: 1.5 },
    { d: radiate(50, 37, 6, 22, 9, -Math.PI * 0.94, -Math.PI * 0.06, 0.9), m: 'gold', w: 0.8 },
    { d: band(32, 37.6, 15.6, 1.6, 14.2), m: 'gold' },
    { d: circle(50, 27.6, 3.6), m: 'crest', w: 1.2 },
  ],
  k: () => [
    { d: lathe([50, 50], [['C', 57, 50, 58.2, 54, 58.6, 58], ['C', 60, 69, 63.6, 76, 71.5, 82], ['L', 50, 82]]), m: 'body' },
    ...plinth(26.5),
    { d: band(47, 52.5, 14.8, 1.8, 13.6), m: 'gold' },
    { d: lathe([50, 34], [['L', 62.5, 34], ['C', 60, 40, 58.4, 44.4, 57.6, 48], ['L', 50, 48]]), m: 'body' },
    // closed helm-crown with a ridge, carrying the aquila standard
    { d: lathe([50, 17.6], [['C', 58.6, 17.6, 63.4, 23.6, 63.6, 32], ['L', 50, 32]]), m: 'body' },
    { d: 'M50 18.4L50 30.4M42.2 21.6Q39.6 25.6 39.4 30.4M57.8 21.6Q60.4 25.6 60.6 30.4', m: 'gline', w: 1.5 },
    { d: band(30.4, 36, 16.4, 1.8, 15), m: 'gold' },
    { d: ellipse(50, 33.2, 2.4, 2), m: 'crest', w: 1 },
    { d: 'M48.4 18.6L48.4 14.6L51.6 14.6L51.6 18.6Z', m: 'gold', w: 1.1 },
    // aquila with wings raised (compact, so the king's top stays a single spire)
    {
      d: shiftY('M50 14.6L45.6 12.8C42 11.4 40 8 39.8 4.2L39.6 1.2L42.4 3.6L43 1L45.2 4.4L46.2 2.6L47.4 6.4C47.8 7.4 48.4 8 48.8 8.2L48.6 6.4L46.4 5.6L47.8 4.4C48.2 3 49.8 2.4 50.8 3C51.8 3.6 52 4.8 51.6 5.8L51.2 8.2C51.6 8 52.2 7.4 52.6 6.4L53.8 2.6L54.8 4.4L57 1L57.6 3.6L60.4 1.2L60.2 4.2C60 8 58 11.4 54.4 12.8Z', 2.4),
      m: 'gold', w: 1.3,
    },
  ],
};

// ---------------------------------------------------------------- design: Senate (architectural marble)
// Column drums and capitals: drum-and-sphere pawn, crenellated Senate-gate
// rook, sculpted horse bust, Vestal-flame bishop, Ionic queen with a pearl
// coronet on a waisted shaft, Corinthian king under a laurel dome and cross-orb.

function flutes(y0: number, y1: number, hw0: number, hw1: number, n: number): string {
  let d = '';
  for (let i = 1; i < n; i++) {
    const t = i / n - 0.5;
    d += `M${f(50 + t * 2 * hw0)} ${f(y0)}L${f(50 + t * 2 * hw1)} ${f(y1)}`;
  }
  return d;
}

const senate: Design = {
  p: () => [
    ...plinth(20),
    { d: band(77.5, 81.5, 12.5, 1.6, 13.5), m: 'body' },
    { d: lathe([50, 57], [['L', 57.6, 57], ['L', 59, 77.6], ['L', 50, 77.6]]), m: 'body' },
    { d: flutes(59, 76.5, 7.6, 9, 4), m: 'line', w: 1.1 },
    { d: band(53.5, 58, 11.6, 1.6, 9.6), m: 'gold' },
    { d: circle(50, 42.4, 11.6), m: 'body' },
  ],
  r: () => [
    ...plinth(27),
    // gate of the Senate: an arch with a crenellated attic
    { d: 'M26 81.5L26 36L74 36L74 81.5L59 81.5L59 67Q59 58 50 58Q41 58 41 67L41 81.5Z', m: 'body' },
    { d: band(31.5, 37, 26, 1.2, 25), m: 'gold' },
    {
      d: 'M28 33L28 15.6Q28 14.4 29.2 14.4L35.6 14.4Q36.8 14.4 36.8 15.6L36.8 21L45.4 21L45.4 15.6Q45.4 14.4 46.6 14.4L53.4 14.4Q54.6 14.4 54.6 15.6L54.6 21L63.2 21L63.2 15.6Q63.2 14.4 64.4 14.4L70.8 14.4Q72 14.4 72 15.6L72 33Z',
      m: 'body',
    },
    { d: 'M32 27L68 27', m: 'line', w: 1.1 },
    { d: 'M32 40L32 79M68 40L68 79M36.2 40L36.2 79M63.8 40L63.8 79', m: 'line', w: 1.1 },
    { d: 'M41 67Q41 58 50 58Q59 58 59 67', m: 'gline', w: 1.8 },
  ],
  n: () => [
    ...plinth(23),
    { d: band(76, 81.5, 16, 1.4, 17), m: 'body' },
    {
      d: 'M35 76.5C34.6 71 36.2 66.4 40.4 62C36.8 61.2 33.4 61.6 29.6 62.6C25.4 63.6 20.6 62 18.6 58C16.6 54 17.6 49.6 20.6 46.6C25.6 38.6 31.6 30.6 38.6 24.6C42 21.8 45.6 19.8 49.4 18.8L51.6 9.8C55.2 11.6 58 14.6 59.6 18.2C67.6 22.8 72.6 33 74.2 44C75.4 54 74.6 64.6 71.4 76.5Z',
      m: 'body',
    },
    // carved mane locks
    {
      d: 'M55 16.4C59.6 13.4 66.4 15.4 67.6 21.2C72.2 20.6 76 24.6 74.8 29.6C79.4 31 80.8 36.4 77.8 39.8C81.6 42.4 81.8 48 78.4 50.6C81.4 53.8 80.8 59.4 77 61.4C79.2 65 77.6 70 73.2 71L72.8 60L72.2 47.6L68.4 35.6L61.6 25Z',
      m: 'body', w: 1.8,
    },
    { d: ellipse(39.6, 32.6, 2.5, 1.9), m: 'ink', w: 0.8 },
    { d: 'M21 54.2Q23 53.2 24 55M44.6 51C47.6 46 47.6 40 44 36M30.4 58Q34 56.4 37.4 57.6', m: 'line', w: 1.2 },
    { d: 'M38.6 72.4Q55 70 70.4 72.4', m: 'gline', w: 1.8 },
  ],
  b: () => [
    ...plinth(21),
    { d: band(77.5, 81.5, 12, 1.6, 13), m: 'body' },
    { d: lathe([50, 52], [['L', 55.8, 52], ['L', 57.6, 77.6], ['L', 50, 77.6]]), m: 'body' },
    { d: flutes(54, 76.6, 5.6, 7.6, 4), m: 'line', w: 1.1 },
    // brazier bowl and the Vestal flame
    { d: lathe([50, 41], [['L', 63.6, 41], ['Q', 62.4, 50.6, 55.6, 53.4], ['L', 50, 53.4]]), m: 'gold' },
    { d: 'M50 9C51 14.8 56 18.2 59.6 24.4C63.4 31 62.4 38.4 57.6 42H42.4C37.6 38.4 36.8 31.6 39.8 26C41.6 22.8 44.6 21.4 45.4 17.6C47.6 20 48 22.6 47.6 25.4C50 21.4 50.6 15.6 50 9Z', m: 'body' },
    { d: 'M50.8 26.4C53.6 30 55.6 33.4 54.4 37.6M45 33.6Q44.8 37 46.2 39.6', m: 'line', w: 1.3 },
  ],
  q: () => [
    ...plinth(23),
    // waisted shaft (the king's column is straight and heavier)
    { d: band(77.5, 81.5, 13.4, 1.6, 14.4), m: 'body' },
    { d: lathe([50, 47], [['L', 55, 47], ['C', 55, 60, 56.4, 70, 62.4, 77.6], ['L', 50, 77.6]]), m: 'body' },
    { d: 'M47.4 50Q47.2 66 44.6 76.6M52.6 50Q52.8 66 55.4 76.6M50 50L50 76.6', m: 'line', w: 1 },
    // Ionic capital with volutes
    { d: 'M34.4 39.4L65.6 39.4Q70.4 39.4 70.4 43.8Q70.4 48 66.2 48Q62.6 48 62.6 44.8L37.4 44.8Q37.4 48 33.8 48Q29.6 48 29.6 43.8Q29.6 39.4 34.4 39.4Z', m: 'gold' },
    { d: circle(33.8, 43.9, 1.7), m: 'ink', w: 0.6 },
    { d: circle(66.2, 43.9, 1.7), m: 'ink', w: 0.6 },
    { d: lathe([50, 33], [['L', 59, 33], ['C', 57.6, 35.6, 56.6, 37.6, 56, 39.6], ['L', 50, 39.6]]), m: 'body' },
    ...coronet(34, 12.4),
    { d: band(31.4, 35.8, 13.6, 1.4, 12.6), m: 'gold' },
  ],
  k: () => [
    ...plinth(26.5),
    { d: band(77.5, 81.5, 15.4, 1.6, 16.4), m: 'body' },
    { d: lathe([50, 46], [['L', 58.4, 46], ['L', 60.6, 77.6], ['L', 50, 77.6]]), m: 'body' },
    { d: flutes(48, 76.6, 8.4, 10.6, 5), m: 'line', w: 1.1 },
    // Corinthian capital: acanthus bell and abacus
    { d: 'M39.4 46.6L35 36Q41 38.8 43.4 35.4Q46 38.6 50 35.4Q54 38.6 56.6 35.4Q59 38.8 65 36L60.6 46.6Z', m: 'gold' },
    { d: 'M43.4 36.4L45 45.6M50 36.4L50 45.6M56.6 36.4L55 45.6', m: 'line', w: 0.9 },
    { d: band(31.4, 36, 17.4, 1.2, 16.4), m: 'body' },
    // domed laurel crown under the cross-orb
    { d: lathe([50, 17.6], [['C', 58.8, 17.6, 63.8, 23.4, 64, 32], ['L', 50, 32]]), m: 'body' },
    { d: 'M50 18.6L50 27.4M42.4 21.4Q40.8 24.4 40.6 27.4M57.6 21.4Q59.2 24.4 59.4 27.4', m: 'line', w: 1.1 },
    { d: band(27.4, 32.4, 15.4, 1.6, 15.8), m: 'gold' },
    ...laurelBand(29.9, 14.8, 2, 6.6, 2),
    { d: ellipse(50, 29.9, 2.3, 1.9), m: 'crest', w: 0.9 },
    ...crossOrb(14.6),
  ],
};

// ---------------------------------------------------------------- materials

export const MATERIALS: Record<string, Material> = {
  ivory: {
    body: [[0, '#cbb894'], [0.14, '#fbf3e2'], [0.32, '#fffdf7'], [0.62, '#f1e6d0'], [0.88, '#d8c6a3'], [1, '#bea57c']],
    gold: [[0, '#8a5d17'], [0.2, '#f7dc8c'], [0.38, '#ffefb8'], [0.62, '#d9a94a'], [1, '#8a5d17']],
    crest: [[0, '#7c1622'], [0.25, '#d34a5a'], [0.55, '#ae2f3d'], [1, '#6a1019']],
    outline: '#3b2a18', goldOutline: '#5a3a0e', ink: '#4a3420', line: 'rgba(110,80,45,0.55)', halo: null,
  },
  ebony: {
    body: [[0, '#2a2420'], [0.16, '#6d6055'], [0.32, '#4a3f37'], [0.6, '#29221e'], [1, '#141110']],
    gold: [[0, '#8a5d17'], [0.2, '#f2d27e'], [0.38, '#ffe9a8'], [0.62, '#cf9c3e'], [1, '#7a5212']],
    crest: [[0, '#6a1019'], [0.25, '#c43c4d'], [0.55, '#9c2533'], [1, '#560b13']],
    outline: '#0b0908', goldOutline: '#1d1306', ink: '#0b0908', line: 'rgba(230,200,140,0.32)', halo: 'rgba(255,246,228,0.78)',
  },
  // Praetorian: burnished steel vs oxblood lacquer, both gilded
  steel: {
    body: [[0, '#8f979f'], [0.14, '#e9eef2'], [0.3, '#ffffff'], [0.56, '#d3d9de'], [0.84, '#a7afb7'], [1, '#7f8790']],
    gold: [[0, '#8a5d17'], [0.2, '#f7dc8c'], [0.38, '#ffefb8'], [0.62, '#d9a94a'], [1, '#8a5d17']],
    crest: [[0, '#7c1622'], [0.25, '#d34a5a'], [0.55, '#ae2f3d'], [1, '#6a1019']],
    outline: '#1f2730', goldOutline: '#4a320c', ink: '#1f2730', line: 'rgba(40,55,70,0.45)', halo: null,
  },
  oxblood: {
    body: [[0, '#3a0d12'], [0.15, '#94303b'], [0.3, '#6e1a24'], [0.6, '#4a0f16'], [1, '#26070b']],
    gold: [[0, '#8a5d17'], [0.2, '#f2d27e'], [0.38, '#ffe9a8'], [0.62, '#cf9c3e'], [1, '#7a5212']],
    crest: [[0, '#2a2420'], [0.2, '#6d6055'], [0.4, '#3a322c'], [1, '#141110']],
    outline: '#160406', goldOutline: '#1d0a04', ink: '#160406', line: 'rgba(255,200,150,0.3)', halo: 'rgba(255,240,226,0.78)',
  },
  // Senate: Carrara vs Nero Marquina, silver fittings
  carrara: {
    body: [[0, '#b3b6b8'], [0.14, '#f3f3f1'], [0.32, '#ffffff'], [0.6, '#e8e6e1'], [0.86, '#c6c4be'], [1, '#a19f99']],
    gold: [[0, '#6f757c'], [0.2, '#e6eaee'], [0.38, '#ffffff'], [0.62, '#b5bcc3'], [1, '#666d74']],
    crest: [[0, '#7c1622'], [0.25, '#d34a5a'], [0.55, '#ae2f3d'], [1, '#6a1019']],
    outline: '#25282d', goldOutline: '#353b43', ink: '#2b2e33', line: 'rgba(60,64,70,0.5)', halo: null, vein: 'rgba(120,126,134,0.42)',
  },
  nero: {
    body: [[0, '#1a1b1e'], [0.15, '#5a5c62'], [0.3, '#3a3c41'], [0.6, '#232428'], [1, '#0f1012']],
    gold: [[0, '#5d636a'], [0.2, '#dfe4e9'], [0.38, '#ffffff'], [0.62, '#a9b1b9'], [1, '#575d64']],
    crest: [[0, '#6a1019'], [0.25, '#c43c4d'], [0.55, '#9c2533'], [1, '#560b13']],
    outline: '#060708', goldOutline: '#101214', ink: '#060708', line: 'rgba(220,226,232,0.3)', halo: 'rgba(244,246,250,0.8)', vein: 'rgba(235,238,242,0.36)',
  },
};

export type VectorSet = { design: Design; light: Material; dark: Material; scale?: Partial<Record<PieceType, number>> };
export const VECTOR_SETS: Record<string, VectorSet> = {
  classical: { design: legio, light: MATERIALS.ivory, dark: MATERIALS.ebony },
  imperial: { design: castra, light: MATERIALS.steel, dark: MATERIALS.oxblood, scale: { p: 0.92 } },
  marble: { design: senate, light: MATERIALS.carrara, dark: MATERIALS.nero },
};

/** Deterministic marble veins for a body part (clipped to it by the caller). */
function veinPaths(seed: number): string {
  let x = seed * 9301 + 49297;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  let d = '';
  for (let i = 0; i < 2; i++) {
    let px = 10 + rnd() * 80, py = rnd() * 20;
    d += `M${f(px)} ${f(py)}`;
    for (let k = 0; k < 5; k++) {
      const nx = px + (rnd() - 0.45) * 22, ny = py + 12 + rnd() * 10;
      d += `Q${f(px + (rnd() - 0.5) * 18)} ${f((py + ny) / 2)} ${f(nx)} ${f(ny)}`;
      px = nx; py = ny;
    }
  }
  return d;
}

// ---------------------------------------------------------------- rendering

function grad(id: string, ramp: Ramp, vertical = false): string {
  const xy = vertical ? 'x1="0" y1="0" x2="0" y2="1"' : 'x1="0" y1="0" x2="1" y2="0"';
  return `<linearGradient id="${id}" ${xy}>${ramp.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
}

/** Full SVG document for one piece. */
export function pieceSVG(setId: string, color: 'w' | 'b', type: PieceType, px = 320): string {
  const set = VECTOR_SETS[setId];
  const m = color === 'w' ? set.light : set.dark;
  const parts = set.design[type]();
  const OW = 2.3; // outline width in viewBox units (≈1 px at 40 px squares)
  const defs = [
    grad('gB', m.body), grad('gG', m.gold), grad('gC', m.crest),
    grad('gU', m.gold).replace('x1="0" y1="0" x2="1" y2="0"', 'gradientUnits="userSpaceOnUse" x1="22" y1="0" x2="78" y2="0"'),
    // top-light / bottom-shade overlay that gives every part volume
    `<linearGradient id="gS" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.22"/><stop offset="0.45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.16"/></linearGradient>`,
    `<linearGradient id="gL" x1="0" y1="0" x2="1" y2="0"><stop offset="0.12" stop-color="#fff" stop-opacity="0"/><stop offset="0.24" stop-color="#fff" stop-opacity="${color === 'w' ? 0.5 : 0.28}"/><stop offset="0.34" stop-color="#fff" stop-opacity="0"/></linearGradient>`,
    `<radialGradient id="gH" cx="0.35" cy="0.3" r="0.7"><stop offset="0" stop-color="#fff"/><stop offset="0.6" stop-color="#f4ecdc"/><stop offset="1" stop-color="#cdbb98"/></radialGradient>`,
  ];
  const fills: Record<Mat, string> = { body: 'url(#gB)', gold: 'url(#gG)', crest: 'url(#gC)', ink: m.ink, hi: 'url(#gH)', line: 'none', gline: 'none', iline: 'none' };
  const strokes: Record<Mat, string> = { body: m.outline, gold: m.goldOutline, crest: m.outline, ink: m.outline, hi: m.goldOutline, line: m.line, gline: 'url(#gU)', iline: m.goldOutline };
  let halo = '';
  if (m.halo) {
    halo = `<g fill="${m.halo}" stroke="${m.halo}" stroke-width="${OW + 2.6}" stroke-linejoin="round" opacity="1">` +
      parts.filter((p) => !p.noHalo && p.m !== 'line' && p.m !== 'gline' && p.m !== 'iline' && p.m !== 'ink').map((p) => `<path d="${p.d}"/>`).join('') + '</g>';
  }
  let body = '';
  let vid = 0;
  for (const p of parts) {
    const w = p.w ?? OW;
    if (p.m === 'line' || p.m === 'gline' || p.m === 'iline') {
      body += `<path d="${p.d}" fill="none" stroke="${strokes[p.m]}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
      continue;
    }
    if (p.m === 'ink' && /^(M[\d. ]+L[\d. ]+)+$/.test(p.d)) {
      body += `<path d="${p.d}" fill="none" stroke="${m.ink}" stroke-width="${w}" stroke-linecap="round"/>`;
      continue;
    }
    body += `<path d="${p.d}" fill="${fills[p.m]}"/>`;
    if (m.vein && p.m === 'body') {
      vid++;
      defs.push(`<clipPath id="v${vid}"><path d="${p.d}"/></clipPath>`);
      body += `<g clip-path="url(#v${vid})"><path d="${veinPaths(vid * 7 + type.charCodeAt(0))}" fill="none" stroke="${m.vein}" stroke-width="0.55"/></g>`;
    }
    if (p.m === 'body' || p.m === 'gold' || p.m === 'crest') body += `<path d="${p.d}" fill="url(#gS)"/>`;
    if (p.m === 'body' || p.m === 'crest') body += `<path d="${p.d}" fill="url(#gL)"/>`;
    body += `<path d="${p.d}" fill="none" stroke="${strokes[p.m]}" stroke-width="${w}" stroke-linejoin="round"/>`;
  }
  const s = set.scale?.[type] ?? 1;
  const tf = s === 1 ? '' : ` transform="translate(50 94) scale(${s}) translate(-50 -94)"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 100 100" fill-rule="evenodd"><defs>${defs.join('')}</defs><g${tf}>${halo}${body}</g></svg>`;
}
