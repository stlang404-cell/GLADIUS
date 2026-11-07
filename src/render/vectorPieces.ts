/**
 * GLADIUS v0.3 chess pieces — hand-authored 2D vector illustrations.
 *
 * Every piece is a stack of flat-designed parts (body, gold trim, crest,
 * ink details) drawn into a 100×100 viewBox, lit from the upper left by
 * cylindrical gradients, with a firm outline so silhouettes survive at
 * 32–40 px. Designs (shapes) and materials (palettes) are independent, so a
 * collection is a design + a light material + a dark material.
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

type Mat = 'body' | 'gold' | 'crest' | 'ink' | 'line' | 'gline' | 'hi';
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
    { d: 'M33 49.5L67 49.5M33.5 58.5L66.5 58.5M42 40.5L42 49.5M58 49.5L58 58.5M42 58.5L42 66.5', m: 'line', w: 1 },
    { d: 'M33 29.5L67 29.5', m: 'line', w: 1 },
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
    { d: lathe([50, 48], [['C', 56, 48, 57, 52, 57.5, 56], ['C', 59, 68, 62.5, 76, 70, 82], ['L', 50, 82]]), m: 'body' },
    ...plinth(25),
    { d: band(46, 51.5, 13.6, 1.8, 12.5), m: 'gold' },
    // cup
    { d: lathe([50, 29], [['L', 64, 29], ['C', 61.5, 36, 58.5, 42, 57, 47.5], ['L', 50, 47.5]]), m: 'body' },
    // diadem points
    {
      d: 'M33.5 31.5L30 15.5L40 25L44 11.5L50 23.5L56 11.5L60 25L70 15.5L66.5 31.5Z',
      m: 'gold',
    },
    { d: band(29.5, 34.5, 16.6, 1.6, 15.5), m: 'gold' },
    { d: circle(30, 14.2, 3), m: 'hi' },
    { d: circle(44, 10.2, 3), m: 'hi' },
    { d: circle(56, 10.2, 3), m: 'hi' },
    { d: circle(70, 14.2, 3), m: 'hi' },
    { d: circle(50, 20.6, 3.2), m: 'crest', w: 1 },
  ],
  k: () => [
    { d: lathe([50, 48], [['C', 56.5, 48, 57.5, 52, 58, 56], ['C', 59.5, 68, 63, 76, 71, 82], ['L', 50, 82]]), m: 'body' },
    ...plinth(26),
    { d: band(46, 51.5, 14, 1.8, 13), m: 'gold' },
    // crown body
    { d: lathe([50, 21], [['C', 58, 21, 64.5, 24.5, 65.5, 31], ['C', 62.5, 38, 59, 43, 57.5, 47.5], ['L', 50, 47.5]]), m: 'body' },
    // laurel corona
    { d: band(29.2, 35.4, 17.2, 2, 15.6), m: 'gold' },
    ...laurelBand(32.3, 16.4, 2, 7.4, 2.3),
    { d: ellipse(50, 32.3, 2.6, 2.2), m: 'crest', w: 1 },
    // orb and cross
    { d: circle(50, 18.5, 3.6), m: 'gold' },
    { d: 'M47.6 15.6L47.6 10.5L43 10.5L43 6.5L47.6 6.5L47.6 2L52.4 2L52.4 6.5L57 6.5L57 10.5L52.4 10.5L52.4 15.6Z', m: 'gold' },
  ],
};

// ---------------------------------------------------------------- design: Castra (Praetorian guard)
// Military forms: shield pawns, gate-tower rooks, armoured warhorse with an
// upright plume, flamen's apex bishop, radiate-crown queen, aquila king.

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
    ...plinth(20),
    // legionary behind his scutum: galea and crest above the shield rim
    { d: 'M43.4 26.6C42.4 20.2 45 15.6 50 15.6C55 15.6 57.6 20.2 56.6 26.6Z', m: 'crest' },
    { d: lathe([50, 23], [['C', 58.6, 23, 62.4, 28.4, 62.4, 35], ['L', 66, 38], ['Q', 66.6, 40.6, 63.6, 40.6], ['L', 50, 40.6]]), m: 'body' },
    { d: 'M38.8 33Q50 30 61.2 33', m: 'gline', w: 2.2 },
    // scutum: curved oblong shield, spine and umbo
    { d: 'M39.5 40Q50 38 60.5 40Q66 40.6 66.2 45.2L66.6 76.6Q66.4 81.6 60.6 82.2Q50 84.2 39.4 82.2Q33.6 81.6 33.4 76.6L33.8 45.2Q34 40.6 39.5 40Z', m: 'body' },
    { d: 'M40.2 43.4Q50 41.8 59.8 43.4Q62.8 43.8 62.9 46.4L63.2 75.8Q63.1 78.8 59.8 79.2Q50 80.8 40.2 79.2Q36.9 78.8 36.8 75.8L37.1 46.4Q37.2 43.8 40.2 43.4Z', m: 'gline', w: 1.3 },
    { d: 'M50 44.6L50 55M50 68.4L50 78.2', m: 'gline', w: 2.6 },
    { d: circle(50, 61.7, 6.6), m: 'gold' },
    { d: circle(50, 61.7, 2.6), m: 'hi', w: 1 },
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
    { d: 'M37.5 44.5L37.5 51.5M62.5 44.5L62.5 51.5', m: 'ink', w: 2.4 },
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
    { d: lathe([50, 49], [['C', 56, 49, 57, 53, 57.5, 57], ['C', 59, 69, 62.5, 76, 69.5, 82], ['L', 50, 82]]), m: 'body' },
    ...plinth(25),
    { d: band(46, 51.5, 13.6, 1.8, 12.5), m: 'gold' },
    { d: lathe([50, 33], [['L', 61, 33], ['C', 59, 39.5, 57.4, 44, 56.6, 47.5], ['L', 50, 47.5]]), m: 'body' },
    // corona radiata
    { d: radiate(50, 35, 6, 25, 7, -Math.PI * 0.86, -Math.PI * 0.14, 2.9), m: 'body', w: 1.6 },
    { d: band(31, 36.5, 14.6, 1.6, 13.4), m: 'gold' },
    { d: circle(50, 26.6, 3.6), m: 'crest', w: 1.2 },
  ],
  k: () => [
    { d: lathe([50, 48], [['C', 56.5, 48, 57.5, 52, 58, 56], ['C', 59.5, 68, 63, 76, 71, 82], ['L', 50, 82]]), m: 'body' },
    ...plinth(26),
    { d: band(45, 50.5, 14, 1.8, 13), m: 'gold' },
    { d: lathe([50, 31], [['L', 62.5, 31], ['C', 60, 38, 58, 43, 57.2, 46.5], ['L', 50, 46.5]]), m: 'body' },
    { d: band(28.4, 33.6, 15.4, 1.8, 14), m: 'gold' },
    { d: ellipse(50, 31, 2.4, 2), m: 'crest', w: 1 },
    // aquila: eagle with raised wings, head turned left
    {
      d: 'M50 29.5L44.5 25.5C39 23.5 33.5 19.5 31 13L30.5 4L34.5 9L35.5 3.5L39 9.5L40.5 5L43.5 12.5C44.5 15.5 46 17.5 47.6 18.2L47.4 15.4L43.6 14.4L45.6 12.2C46.4 9.8 49.4 8.6 51.4 9.6C53.2 10.6 53.2 13.4 52.4 15.4L52.4 18.2C54 17.5 55.5 15.5 56.5 12.5L59.5 5L61 9.5L64.5 3.5L65.5 9L69.5 4L69 13C66.5 19.5 61 23.5 55.5 25.5Z',
      m: 'gold', w: 1.5,
    },
    { d: circle(49.4, 11.8, 0.9), m: 'ink', w: 0.4 },
    { d: 'M36 17.6Q40 19.6 44 19.8M64 17.6Q60 19.6 56 19.8M47.6 23.4L50 27.2L52.4 23.4', m: 'line', w: 0.9 },
  ],
};

// ---------------------------------------------------------------- design: Senate (architectural marble)
// Column drums and capitals: drum-and-sphere pawn, triumphal-arch rook,
// sculpted horse bust, Vestal-flame bishop, Ionic palmette queen,
// Corinthian laurel-wreath king.

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
    // triumphal arch with open passage
    { d: 'M26 81.5L26 33L74 33L74 81.5L59 81.5L59 66Q59 57 50 57Q41 57 41 66L41 81.5Z', m: 'body' },
    { d: band(28.5, 34, 25.5, 1.2, 25.5), m: 'gold' },
    { d: 'M30 34L30 18.5L40 18.5L40 14.5L60 14.5L60 18.5L70 18.5L70 34Z', m: 'body' },
    { d: 'M34 23.5L66 23.5', m: 'line', w: 1.2 },
    { d: 'M32 38L32 79M68 38L68 79M36.2 38L36.2 79M63.8 38L63.8 79', m: 'line', w: 1.1 },
    { d: 'M41 66Q41 57 50 57Q59 57 59 66', m: 'gline', w: 1.8 },
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
    ...plinth(24),
    { d: band(77.5, 81.5, 14, 1.6, 15), m: 'body' },
    { d: lathe([50, 44], [['L', 56.4, 44], ['L', 58.6, 77.6], ['L', 50, 77.6]]), m: 'body' },
    { d: flutes(46, 76.6, 6.4, 8.6, 5), m: 'line', w: 1.1 },
    // Ionic capital with volutes
    { d: 'M33.4 38.6L66.6 38.6Q71.6 38.6 71.6 43.2Q71.6 47.6 67.2 47.6Q63.4 47.6 63.4 44.2L36.6 44.2Q36.6 47.6 32.8 47.6Q28.4 47.6 28.4 43.2Q28.4 38.6 33.4 38.6Z', m: 'gold' },
    { d: circle(32.8, 43.4, 1.8), m: 'ink', w: 0.6 },
    { d: circle(67.2, 43.4, 1.8), m: 'ink', w: 0.6 },
    // cup and pearl diadem
    { d: radiate(50, 37, 4, 22, 5, -Math.PI * 0.8, -Math.PI * 0.2, 1.4), m: 'gold', w: 1.2 },
    ...[0, 1, 2, 3, 4].map((i): Part => { const a = -Math.PI * 0.8 + (Math.PI * 0.6 * i) / 4; return { d: circle(50 + Math.cos(a) * 22.5, 37 + Math.sin(a) * 22.5, 3.1), m: 'gold', w: 1.3 }; }),
    { d: lathe([50, 26], [['L', 60.4, 26], ['C', 59, 31, 57.4, 35, 56.6, 38.6], ['L', 50, 38.6]]), m: 'body' },
    { d: band(24, 28.6, 12, 1.4, 11), m: 'gold' },
  ],
  k: () => [
    ...plinth(25),
    { d: band(77.5, 81.5, 14.4, 1.6, 15.4), m: 'body' },
    { d: lathe([50, 44], [['L', 57, 44], ['L', 59.2, 77.6], ['L', 50, 77.6]]), m: 'body' },
    { d: flutes(46, 76.6, 7, 9.2, 5), m: 'line', w: 1.1 },
    // Corinthian capital: acanthus bell and abacus
    { d: 'M40 44.4L36.6 34Q41.6 36.6 43.6 33.6Q46 36.4 50 33.6Q54 36.4 56.4 33.6Q58.4 36.6 63.4 34L60 44.4Z', m: 'gold' },
    { d: 'M43.6 34.6L45 43.6M50 34.6L50 43.6M56.4 34.6L55 43.6', m: 'line', w: 0.9 },
    { d: band(29.6, 34, 16, 1.2, 15), m: 'body' },
    // laurel wreath crown (open ring) with orb
    { d: 'M50 3.4A13.4 13.4 0 1 1 49.99 3.4ZM50 10.4A6.4 6.4 0 1 0 50.01 10.4Z', m: 'gold', w: 1.7 },
    { d: 'M50 6.6A11.2 11.2 0 1 1 49.99 6.6', m: 'line', w: 0.9 },
    { d: circle(50, 26, 3.6), m: 'crest', w: 1.2 },
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
    body: [[0, '#b9bcbd'], [0.14, '#f3f3f1'], [0.32, '#ffffff'], [0.6, '#eceae6'], [0.86, '#cfcdc8'], [1, '#aeaca6']],
    gold: [[0, '#6f757c'], [0.2, '#e6eaee'], [0.38, '#ffffff'], [0.62, '#b5bcc3'], [1, '#666d74']],
    crest: [[0, '#7c1622'], [0.25, '#d34a5a'], [0.55, '#ae2f3d'], [1, '#6a1019']],
    outline: '#2b2e33', goldOutline: '#3a4048', ink: '#2b2e33', line: 'rgba(60,64,70,0.45)', halo: null, vein: 'rgba(120,126,134,0.42)',
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
  const fills: Record<Mat, string> = { body: 'url(#gB)', gold: 'url(#gG)', crest: 'url(#gC)', ink: m.ink, hi: 'url(#gH)', line: 'none', gline: 'none' };
  const strokes: Record<Mat, string> = { body: m.outline, gold: m.goldOutline, crest: m.outline, ink: m.outline, hi: m.goldOutline, line: m.line, gline: 'url(#gU)' };
  let halo = '';
  if (m.halo) {
    halo = `<g fill="${m.halo}" stroke="${m.halo}" stroke-width="${OW + 2.6}" stroke-linejoin="round" opacity="1">` +
      parts.filter((p) => !p.noHalo && p.m !== 'line' && p.m !== 'gline' && p.m !== 'ink').map((p) => `<path d="${p.d}"/>`).join('') + '</g>';
  }
  let body = '';
  let vid = 0;
  for (const p of parts) {
    const w = p.w ?? OW;
    if (p.m === 'line' || p.m === 'gline') {
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
