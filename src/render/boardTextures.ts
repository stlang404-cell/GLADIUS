import * as THREE from 'three';
import { createRng, mixSeed } from '../core/rng';

/**
 * Canvas-painted board textures: veined marble squares, a frame with a gold
 * Greek-key (meander) band and engraved coordinates, and soft glow decals.
 * Painted once per theme and cached.
 */
export type BoardTheme = { light: string; dark: string; frame: string; trim: string; ink: string; vein?: string };

function hexToRgb(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function shade(h: string, amt: number): string {
  const [r, g, b] = hexToRgb(h);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

function veins(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, seed: number, strength: number) {
  const rng = createRng(seed);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = strength * (0.25 + rng.next() * 0.6);
    ctx.lineWidth = 0.6 + rng.next() * 2.2;
    ctx.beginPath();
    let px = x + rng.next() * w;
    let py = y - 4;
    ctx.moveTo(px, py);
    const steps = 6;
    for (let s = 0; s < steps; s++) {
      const nx = px + (rng.next() - 0.35) * w * 0.5;
      const ny = py + h / steps + rng.next() * 10;
      ctx.quadraticCurveTo(px + (rng.next() - 0.5) * w * 0.4, (py + ny) / 2, nx, ny);
      px = nx;
      py = ny;
    }
    ctx.stroke();
  }
  ctx.restore();
}

function speckle(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, seed: number, alpha: number) {
  const rng = createRng(seed);
  for (let i = 0; i < (w * h) / 90; i++) {
    ctx.fillStyle = rng.chance(0.5) ? `rgba(255,255,255,${alpha * rng.next()})` : `rgba(0,0,0,${alpha * rng.next()})`;
    ctx.fillRect(x + rng.next() * w, y + rng.next() * h, 1.5, 1.5);
  }
}

const texCache = new Map<string, THREE.Texture>();

export function squaresTexture(theme: BoardTheme, size = 1024): THREE.Texture {
  const key = `sq|${theme.light}|${theme.dark}|${size}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const s = size / 8;
  for (let f = 0; f < 8; f++)
    for (let r = 0; r < 8; r++) {
      const light = (f + r) % 2 === 1;
      const x = f * s, y = (7 - r) * s;
      const base = light ? theme.light : theme.dark;
      const g = ctx.createLinearGradient(x, y, x + s, y + s);
      g.addColorStop(0, shade(base, 0.06));
      g.addColorStop(1, shade(base, -0.06));
      ctx.fillStyle = g;
      ctx.fillRect(x, y, s, s);
      veins(ctx, x, y, s, s, light ? (theme.vein ?? shade(theme.dark, -0.1)) : shade(base, 0.35), mixSeed('vein', f, r), light ? 0.18 : 0.22);
      speckle(ctx, x, y, s, s, mixSeed('spk', f, r), 0.05);
      // bevel line
      ctx.strokeStyle = 'rgba(0,0,0,0.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, s - 2, s - 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 3, y + 3, s - 6, s - 6);
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  texCache.set(key, t);
  return t;
}

/** Frame top surface: plinth stone + gold meander band + coordinates. Texture covers the full frame square. */
export function frameTexture(theme: BoardTheme, showCoords: boolean, flipped: boolean, frameRatio: number, size = 1024): THREE.Texture {
  const key = `fr|${theme.frame}|${theme.trim}|${theme.ink}|${showCoords}|${flipped}|${frameRatio}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.3, size / 2, size / 2, size * 0.75);
  g.addColorStop(0, shade(theme.frame, 0.12));
  g.addColorStop(1, shade(theme.frame, -0.18));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  veins(ctx, 0, 0, size, size, shade(theme.frame, 0.3), 77, 0.15);
  speckle(ctx, 0, 0, size, size, 78, 0.06);
  const inner = size * (1 - 2 * frameRatio); // playing area width on the texture
  const off = (size - inner) / 2;
  const border = off;
  // Meander band in the middle of the frame border.
  const bandW = border * 0.36;
  const bandOff = border * 0.5 - bandW / 2;
  ctx.save();
  ctx.strokeStyle = theme.trim;
  ctx.lineWidth = Math.max(2, bandW * 0.12);
  ctx.lineJoin = 'miter';
  const meanderSide = (len: number) => {
    const u = bandW / 4;
    const n = Math.floor(len / (u * 4));
    const start = (len - n * u * 4) / 2;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x0 = start + i * u * 4;
      // classic key: up, right, down, left-in, up ...
      ctx.moveTo(x0, u * 3.5);
      ctx.lineTo(x0, u * 0.5);
      ctx.lineTo(x0 + u * 3, u * 0.5);
      ctx.lineTo(x0 + u * 3, u * 2.5);
      ctx.lineTo(x0 + u * 1, u * 2.5);
      ctx.lineTo(x0 + u * 1, u * 1.5);
      ctx.lineTo(x0 + u * 2, u * 1.5);
      ctx.moveTo(x0, u * 3.5);
      ctx.lineTo(x0 + u * 4, u * 3.5);
    }
    ctx.stroke();
  };
  for (let side = 0; side < 4; side++) {
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate((side * Math.PI) / 2);
    ctx.translate(-size / 2, -size / 2);
    ctx.save();
    ctx.translate(off, bandOff);
    meanderSide(inner);
    ctx.restore();
    ctx.restore();
  }
  ctx.restore();
  // Gold fillets around the playing area and the outer edge.
  ctx.strokeStyle = theme.trim;
  ctx.lineWidth = size * 0.006;
  ctx.strokeRect(off - size * 0.006, off - size * 0.006, inner + size * 0.012, inner + size * 0.012);
  ctx.lineWidth = size * 0.003;
  ctx.strokeRect(size * 0.012, size * 0.012, size - size * 0.024, size - size * 0.024);
  if (showCoords) {
    ctx.fillStyle = theme.ink;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 ${Math.round(border * 0.3)}px Cinzel, Georgia, serif`;
    const sq = inner / 8;
    for (let i = 0; i < 8; i++) {
      const file = 'abcdefgh'[flipped ? 7 - i : i];
      const rank = String(flipped ? i + 1 : 8 - i);
      const cx = off + sq * (i + 0.5);
      ctx.fillText(file.toUpperCase(), cx, size - border * 0.2);
      ctx.fillText(rank, border * 0.2, off + sq * (i + 0.5));
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  texCache.set(key, t);
  return t;
}

export function glowTexture(kind: 'soft' | 'ring' | 'dot' | 'square'): THREE.Texture {
  const key = 'glow|' + kind;
  const hit = texCache.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const ctx = c.getContext('2d')!;
  const m = 128;
  if (kind === 'soft') {
    const g = ctx.createRadialGradient(m, m, 0, m, m, m);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  } else if (kind === 'ring') {
    ctx.lineWidth = 20;
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    ctx.arc(m, m, 100, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 34;
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.stroke();
  } else if (kind === 'dot') {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(m, m, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,1)';
    ctx.beginPath();
    ctx.arc(m, m, 36, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const g = ctx.createRadialGradient(m, m, 40, m, m, 190);
    g.addColorStop(0, 'rgba(255,255,255,0.65)');
    g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
  }
  const t = new THREE.CanvasTexture(c);
  texCache.set(key, t);
  return t;
}
