import { createRng, mixSeed, type Rng } from '../core/rng';
import type { PieceSetId } from './pieceSets';

/**
 * 2D board collections — one signature board per arena (24 arenas, v0.3
 * indexing) plus Eternal Laurel. Ids are stored in saves and never change;
 * `arena` is the arena whose signature board it is. Purely cosmetic. Textures are painted once per theme to a canvas and cached.
 */
export type BoardTexture = 'marble' | 'gold' | 'bronze' | 'sandstone' | 'mosaic' | 'crimson' | 'obsidian' | 'laurel' | 'travertine' | 'granite' | 'amethyst' | 'verdigris' | 'wood' | 'papyrus' | 'porphyry';

export type BoardTheme = {
  id: string;
  name: string;
  arena: number; // signature arena
  light: string;
  dark: string;
  frame: string;
  frame2: string; // frame gradient end
  trim: string; // inlay / fillet colour
  ink: string; // coordinates on the frame
  texture: BoardTexture;
  pieces: PieceSetId; // the set shown when the player picks "match each board"
};

export const BOARD_THEMES: BoardTheme[] = [
  { id: 'sandstone', name: 'Colosseum Sandstone', arena: 0, light: '#F2DDB4', dark: '#C99A63', frame: '#B9875A', frame2: '#8E6038', trim: '#E9C77B', ink: '#FFF4DA', texture: 'sandstone', pieces: 'classical' },
  { id: 'bronze', name: 'Legion Bronze', arena: 2, light: '#EFE1C4', dark: '#A9784A', frame: '#8A5A2E', frame2: '#5E3A1C', trim: '#E2B04A', ink: '#FCE9C2', texture: 'bronze', pieces: 'imperial' },
  { id: 'granite', name: 'Citadel Granite', arena: 4, light: '#E7E6E2', dark: '#8E959D', frame: '#5E656E', frame2: '#3D434A', trim: '#D3B266', ink: '#F4F2EC', texture: 'granite', pieces: 'marble' },
  { id: 'travertine', name: "Gladiator's Travertine", arena: 6, light: '#F5E8CF', dark: '#C79C6E', frame: '#A8764A', frame2: '#7C522D', trim: '#E6BE6A', ink: '#FFF3DA', texture: 'travertine', pieces: 'classical' },
  { id: 'ivory', name: 'Ivory Marble', arena: 8, light: '#FBF8F2', dark: '#B9C3C6', frame: '#E7E1D6', frame2: '#CFC6B5', trim: '#C59A42', ink: '#7A6A4A', texture: 'marble', pieces: 'marble' },
  { id: 'crimson', name: 'Praetorian Crimson', arena: 10, light: '#F6E3D2', dark: '#B5525A', frame: '#8E2430', frame2: '#5E141C', trim: '#E2B04A', ink: '#FCE6C8', texture: 'crimson', pieces: 'imperial' },
  { id: 'mosaic', name: 'Senate Mosaic', arena: 12, light: '#F3EEDF', dark: '#7FA595', frame: '#3F6B5C', frame2: '#244639', trim: '#D9B05A', ink: '#F2EAD2', texture: 'mosaic', pieces: 'marble' },
  { id: 'gold', name: 'Imperial Gold', arena: 14, light: '#FBF0D2', dark: '#D3A44C', frame: '#B5832B', frame2: '#7E5815', trim: '#FFF2C4', ink: '#FFF6DA', texture: 'gold', pieces: 'classical' },
  { id: 'sand-arena', name: 'Flavian Arena', arena: 16, light: '#F7E6C2', dark: '#D49A5A', frame: '#9C4A2A', frame2: '#6A2C14', trim: '#F0C860', ink: '#FFF0D0', texture: 'sandstone', pieces: 'imperial' },
  { id: 'amethyst', name: 'Palatine Amethyst', arena: 18, light: '#F4EEF7', dark: '#9C84B4', frame: '#4E3A6A', frame2: '#2E2044', trim: '#E6C46A', ink: '#F6EEFF', texture: 'amethyst', pieces: 'marble' },
  { id: 'verdigris', name: "Caesars' Verdigris", arena: 20, light: '#F0EEE6', dark: '#6E9A98', frame: '#2F5A5C', frame2: '#1A3A3C', trim: '#D9A840', ink: '#EEF6F2', texture: 'verdigris', pieces: 'classical' },
  { id: 'obsidian', name: "Caesar's Obsidian", arena: 23, light: '#EDE7DA', dark: '#4A4650', frame: '#1F1C24', frame2: '#0E0C12', trim: '#E6BE5A', ink: '#F4E2B0', texture: 'obsidian', pieces: 'classical' },
  // v0.3: boards for the twelve new arenas of the 24-arena empire (odd indices + 22)
  { id: 'ludus-oak', name: 'Ludus Oak', arena: 1, light: '#F0DDBC', dark: '#A8794E', frame: '#6E4A2A', frame2: '#4A2F18', trim: '#D9B266', ink: '#F6E6C8', texture: 'wood', pieces: 'classical' },
  { id: 'frontier-pine', name: 'Frontier Pine', arena: 3, light: '#F1E6CC', dark: '#7F8F66', frame: '#5A4A33', frame2: '#3A2F20', trim: '#C9A55A', ink: '#F2EAD4', texture: 'wood', pieces: 'imperial' },
  { id: 'ostia', name: 'Ostia Harbour Blue', arena: 5, light: '#EEF2F3', dark: '#6F92B0', frame: '#2F4E6E', frame2: '#1C324A', trim: '#E0BC6A', ink: '#EEF4FA', texture: 'marble', pieces: 'classical' },
  { id: 'aqueduct', name: 'Aqueduct Travertine', arena: 7, light: '#F3EBDA', dark: '#AE9E82', frame: '#857257', frame2: '#5C4D38', trim: '#E2C27A', ink: '#FBF3E2', texture: 'travertine', pieces: 'marble' },
  { id: 'thermae', name: 'Thermae Teal Marble', arena: 9, light: '#EEF5F2', dark: '#5F9C95', frame: '#2E6460', frame2: '#1B403D', trim: '#E2C27A', ink: '#EAF6F2', texture: 'marble', pieces: 'marble' },
  { id: 'circus', name: 'Circus Red Granite', arena: 11, light: '#F3E6DE', dark: '#A8675B', frame: '#6E2E26', frame2: '#4A1C16', trim: '#E6BE6A', ink: '#FBE8DC', texture: 'granite', pieces: 'imperial' },
  { id: 'papyrus', name: 'Alexandria Papyrus', arena: 13, light: '#F6ECCD', dark: '#A8975C', frame: '#6B5A30', frame2: '#463A1C', trim: '#E6C46A', ink: '#FBF2D6', texture: 'papyrus', pieces: 'classical' },
  { id: 'porphyry', name: 'Capitoline Porphyry', arena: 15, light: '#F4E9E8', dark: '#84495A', frame: '#4E2234', frame2: '#321522', trim: '#E6C46A', ink: '#F8E8EE', texture: 'porphyry', pieces: 'imperial' },
  { id: 'pantheon', name: 'Pantheon Grey Granite', arena: 17, light: '#ECEBE7', dark: '#8A857D', frame: '#57534D', frame2: '#383531', trim: '#D9B866', ink: '#F4F2EC', texture: 'granite', pieces: 'marble' },
  { id: 'tibur', name: 'Tibur Garden Green', arena: 19, light: '#F2F3E5', dark: '#6F955F', frame: '#3E5A36', frame2: '#263B21', trim: '#E2C070', ink: '#F0F6E4', texture: 'marble', pieces: 'classical' },
  { id: 'domus-aurea', name: 'Domus Aurea Gilded', arena: 21, light: '#FCF2D8', dark: '#B5823E', frame: '#6A1E22', frame2: '#451216', trim: '#F2CF72', ink: '#FCEBC8', texture: 'gold', pieces: 'imperial' },
  { id: 'alabaster', name: 'Victoria Alabaster', arena: 22, light: '#FFFCF5', dark: '#B9A992', frame: '#D8CDB8', frame2: '#B3A68D', trim: '#C59A42', ink: '#6E5E40', texture: 'marble', pieces: 'classical' },
];
/** The Eternal Laurel board: earned by reaching the Eternal Throne (shares arena 23). */
export const LAUREL_THEME: BoardTheme = { id: 'laurel', name: 'Eternal Laurel', arena: 23, light: '#FAF6EA', dark: '#9DB58A', frame: '#C59A42', frame2: '#8E6A22', trim: '#FFFFFF', ink: '#FFF8E2', texture: 'laurel', pieces: 'classical' };
export const ALL_THEMES: BoardTheme[] = [...BOARD_THEMES, LAUREL_THEME];

export function themeById(id: string | undefined): BoardTheme | undefined {
  return ALL_THEMES.find((t) => t.id === id);
}
/** The signature board of an arena (0..23); falls back to the nearest lower arena's board. */
export function signatureTheme(arena: number): BoardTheme {
  for (let a = Math.min(23, Math.max(0, Math.floor(arena) || 0)); a >= 0; a--) {
    const t = BOARD_THEMES.find((x) => x.arena === a);
    if (t) return t;
  }
  return BOARD_THEMES[0];
}

function rgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(h: string, a: number): string {
  const [r, g, b] = rgb(h);
  const f = (c: number) => Math.round(a >= 0 ? c + (255 - c) * a : c * (1 + a));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function veins(x: CanvasRenderingContext2D, ox: number, oy: number, s: number, color: string, rng: Rng, n: number, alpha: number) {
  x.save();
  x.beginPath();
  x.rect(ox, oy, s, s);
  x.clip();
  for (let i = 0; i < n; i++) {
    x.strokeStyle = color;
    x.globalAlpha = alpha * (0.4 + rng.next() * 0.6);
    x.lineWidth = 0.6 + rng.next() * 1.8;
    x.beginPath();
    let px = ox + rng.next() * s, py = oy - 4;
    x.moveTo(px, py);
    for (let k = 0; k < 5; k++) {
      const nx = px + (rng.next() - 0.4) * s * 0.45, ny = py + s / 5 + rng.next() * 8;
      x.quadraticCurveTo(px + (rng.next() - 0.5) * s * 0.4, (py + ny) / 2, nx, ny);
      px = nx;
      py = ny;
    }
    x.stroke();
  }
  x.restore();
  x.globalAlpha = 1;
}

function grain(x: CanvasRenderingContext2D, ox: number, oy: number, s: number, rng: Rng, alpha: number, size = 1.6) {
  for (let i = 0; i < (s * s) / 40; i++) {
    x.fillStyle = rng.chance(0.5) ? `rgba(255,255,255,${alpha * rng.next()})` : `rgba(60,30,10,${alpha * rng.next()})`;
    x.fillRect(ox + rng.next() * s, oy + rng.next() * s, size, size);
  }
}

function paintSquare(x: CanvasRenderingContext2D, t: BoardTheme, ox: number, oy: number, s: number, light: boolean, rng: Rng) {
  const base = light ? t.light : t.dark;
  const g = x.createLinearGradient(ox, oy, ox + s, oy + s);
  g.addColorStop(0, shade(base, 0.07));
  g.addColorStop(1, shade(base, -0.06));
  x.fillStyle = g;
  x.fillRect(ox, oy, s, s);
  switch (t.texture) {
    case 'marble': case 'granite': case 'amethyst':
      veins(x, ox, oy, s, light ? shade(t.dark, -0.15) : shade(base, 0.45), rng, t.texture === 'granite' ? 2 : 4, light ? 0.22 : 0.3);
      if (t.texture === 'granite') grain(x, ox, oy, s, rng, 0.18, 1.4);
      break;
    case 'sandstone': case 'travertine':
      grain(x, ox, oy, s, rng, 0.14, 1.8);
      for (let i = 0; i < 4; i++) {
        x.strokeStyle = `rgba(120,70,30,${0.05 + rng.next() * 0.05})`;
        x.lineWidth = 1 + rng.next() * 2;
        const y = oy + rng.next() * s;
        x.beginPath();
        x.moveTo(ox, y);
        x.bezierCurveTo(ox + s * 0.3, y + 4, ox + s * 0.7, y - 4, ox + s, y + 2);
        x.stroke();
      }
      if (t.texture === 'travertine') for (let i = 0; i < 6; i++) {
        x.fillStyle = 'rgba(90,50,20,0.10)';
        x.beginPath();
        x.ellipse(ox + rng.next() * s, oy + rng.next() * s, 2 + rng.next() * 5, 1 + rng.next() * 1.5, 0, 0, Math.PI * 2);
        x.fill();
      }
      break;
    case 'bronze': case 'gold': case 'verdigris': {
      const sheen = x.createLinearGradient(ox, oy, ox + s, oy + s * 0.6);
      sheen.addColorStop(0, 'rgba(255,255,255,0.18)');
      sheen.addColorStop(0.45, 'rgba(255,255,255,0)');
      sheen.addColorStop(1, 'rgba(0,0,0,0.08)');
      x.fillStyle = sheen;
      x.fillRect(ox, oy, s, s);
      for (let i = 0; i < 26; i++) {
        x.strokeStyle = `rgba(255,255,255,${0.04 + rng.next() * 0.05})`;
        x.lineWidth = 1;
        const y = oy + rng.next() * s;
        x.beginPath();
        x.moveTo(ox, y);
        x.lineTo(ox + s, y + (rng.next() - 0.5) * 3);
        x.stroke();
      }
      if (t.texture === 'verdigris' && !light) for (let i = 0; i < 10; i++) {
        x.fillStyle = 'rgba(160,220,200,0.12)';
        x.beginPath();
        x.arc(ox + rng.next() * s, oy + rng.next() * s, 3 + rng.next() * 10, 0, Math.PI * 2);
        x.fill();
      }
      break;
    }
    case 'mosaic': {
      const n = 7;
      const c = s / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          x.fillStyle = shade(base, (rng.next() - 0.5) * 0.08);
          x.fillRect(ox + i * c + 1, oy + j * c + 1, c - 2, c - 2);
        }
      x.strokeStyle = 'rgba(0,0,0,0.06)';
      x.lineWidth = 1;
      for (let i = 1; i < n; i++) {
        x.beginPath(); x.moveTo(ox + i * c, oy); x.lineTo(ox + i * c, oy + s); x.stroke();
        x.beginPath(); x.moveTo(ox, oy + i * c); x.lineTo(ox + s, oy + i * c); x.stroke();
      }
      break;
    }
    case 'crimson':
      veins(x, ox, oy, s, light ? 'rgba(160,60,60,1)' : 'rgba(255,220,200,1)', rng, 3, 0.18);
      break;
    case 'obsidian': {
      const gl = x.createRadialGradient(ox + s * 0.3, oy + s * 0.25, 2, ox + s * 0.3, oy + s * 0.25, s);
      gl.addColorStop(0, light ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.14)');
      gl.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = gl;
      x.fillRect(ox, oy, s, s);
      if (!light) for (let i = 0; i < 14; i++) {
        x.fillStyle = `rgba(230,190,90,${0.25 + rng.next() * 0.4})`;
        x.fillRect(ox + rng.next() * s, oy + rng.next() * s, 1.5, 1.5);
      }
      else veins(x, ox, oy, s, shade(t.dark, 0.2), rng, 2, 0.15);
      break;
    }
    case 'wood': {
      // straight planks of grain with a few soft growth lines
      for (let i = 0; i < 14; i++) {
        const y = oy + rng.next() * s;
        x.strokeStyle = light ? `rgba(120,80,40,${0.05 + rng.next() * 0.06})` : `rgba(40,25,10,${0.06 + rng.next() * 0.08})`;
        x.lineWidth = 0.8 + rng.next() * 1.6;
        x.beginPath();
        x.moveTo(ox, y);
        x.bezierCurveTo(ox + s * 0.35, y + (rng.next() - 0.5) * 6, ox + s * 0.65, y + (rng.next() - 0.5) * 6, ox + s, y + (rng.next() - 0.5) * 3);
        x.stroke();
      }
      grain(x, ox, oy, s, rng, 0.06, 1.2);
      break;
    }
    case 'papyrus':
      // woven cross-laid fibres
      for (let i = 0; i < 18; i++) {
        const v = rng.chance(0.5);
        const t0 = rng.next() * s;
        x.strokeStyle = `rgba(110,85,30,${0.04 + rng.next() * 0.05})`;
        x.lineWidth = 1 + rng.next() * 2.5;
        x.beginPath();
        if (v) { x.moveTo(ox + t0, oy); x.lineTo(ox + t0 + (rng.next() - 0.5) * 3, oy + s); }
        else { x.moveTo(ox, oy + t0); x.lineTo(ox + s, oy + t0 + (rng.next() - 0.5) * 3); }
        x.stroke();
      }
      break;
    case 'porphyry':
      // fine feldspar speckle
      for (let i = 0; i < (s * s) / 90; i++) {
        x.fillStyle = light ? `rgba(130,70,90,${0.06 + rng.next() * 0.1})` : `rgba(255,225,230,${0.08 + rng.next() * 0.14})`;
        x.fillRect(ox + rng.next() * s, oy + rng.next() * s, 1.3 + rng.next(), 1.3 + rng.next());
      }
      break;
    case 'laurel':
      if (!light) {
        x.strokeStyle = 'rgba(255,255,255,0.25)';
        x.lineWidth = 1.5;
        x.beginPath();
        x.arc(ox + s / 2, oy + s / 2, s * 0.32, Math.PI * 0.15, Math.PI * 0.85);
        x.stroke();
      }
      veins(x, ox, oy, s, light ? shade(t.dark, -0.2) : 'rgba(255,255,255,1)', rng, 2, 0.12);
      break;
  }
  // Subtle bevel so squares read as inlaid stone.
  x.strokeStyle = 'rgba(255,255,255,0.22)';
  x.lineWidth = 2;
  x.beginPath(); x.moveTo(ox + 1, oy + s - 1); x.lineTo(ox + 1, oy + 1); x.lineTo(ox + s - 1, oy + 1); x.stroke();
  x.strokeStyle = 'rgba(0,0,0,0.10)';
  x.beginPath(); x.moveTo(ox + s - 1, oy + 1); x.lineTo(ox + s - 1, oy + s - 1); x.lineTo(ox + 1, oy + s - 1); x.stroke();
}

const cache = new Map<string, { squares: string; frame: string }>();

/** Paint (once) the 8×8 field and the frame texture for a theme. Returns data URLs. */
export function boardImages(t: BoardTheme, size = 1024): { squares: string; frame: string } {
  const key = `${t.id}|${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  const rng = createRng(mixSeed('board', t.id));
  const s = size / 8;
  for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) paintSquare(x, t, f * s, r * s, s, (f + r) % 2 === 0, rng);
  const squares = c.toDataURL('image/jpeg', 0.9);
  // Frame: material gradient + gold meander band.
  const fc = document.createElement('canvas');
  fc.width = fc.height = 512;
  const y = fc.getContext('2d')!;
  const fg = y.createLinearGradient(0, 0, 512, 512);
  fg.addColorStop(0, shade(t.frame, 0.12));
  fg.addColorStop(0.5, t.frame);
  fg.addColorStop(1, t.frame2);
  y.fillStyle = fg;
  y.fillRect(0, 0, 512, 512);
  grain(y, 0, 0, 512, createRng(mixSeed('frame', t.id)), t.texture === 'obsidian' ? 0.05 : 0.1, 1.4);
  if (t.texture === 'marble' || t.texture === 'granite' || t.texture === 'amethyst' || t.texture === 'laurel') veins(y, 0, 0, 512, shade(t.frame, -0.2), createRng(5), 6, 0.2);
  const frame = fc.toDataURL('image/jpeg', 0.9);
  const out = { squares, frame };
  cache.set(key, out);
  return out;
}
