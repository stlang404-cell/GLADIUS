import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { ARENAS } from '../world/arenas';
import { createRng, mixSeed } from '../core/rng';
import { arenaBackdropSvg } from '../art/arenaBackdrop';
import { svgDataUri } from '../art/svgUtil';
import { loadPieceSet } from './pieceAssets';

/**
 * Twelve arena environments built from a small architecture kit. Each arena
 * has its own ground, structures, props, light and fog; its painted backdrop
 * becomes the distant sky. Environment meshes neither cast nor receive
 * shadow-map shadows (only the board does), keeping mobile cost low.
 */
type Kit = {
  ground: { color: string; pattern: 'sand' | 'grass' | 'flag' | 'marble' | 'mosaic' | 'cloud' | 'tiles'; accent?: string };
  light: { key: number; keyColor: string; ambient: number; sky: string; ground: string; exposure: number };
  fog: string;
  build: (g: THREE.Group, ctx: Ctx) => void;
};
type Ctx = { rng: () => number; pal: (typeof ARENAS)[number]['palette']; stone: THREE.Material; dark: THREE.Material; accent: THREE.Material; gold: THREE.Material; wood: THREE.Material; cloth: (color: string, emblem?: boolean) => THREE.Material };

const FLOOR_Y = -0.8;

function mat(color: string, rough = 0.8, metal = 0, emissive?: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, emissive: emissive ?? '#000000', emissiveIntensity: emissive ? 1 : 0 });
}

function groundTexture(kind: Kit['ground']['pattern'], color: string, accent: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d')!;
  x.fillStyle = color;
  x.fillRect(0, 0, 512, 512);
  const r = createRng(mixSeed('ground', kind, color));
  if (kind === 'sand' || kind === 'grass') {
    for (let i = 0; i < 9000; i++) {
      x.fillStyle = `rgba(${r.chance(0.5) ? '255,255,255' : '0,0,0'},${0.03 + r.next() * 0.06})`;
      x.fillRect(r.next() * 512, r.next() * 512, 2 + r.next() * 3, 1 + r.next() * 2);
    }
    if (kind === 'sand') for (let i = 0; i < 40; i++) {
      x.strokeStyle = 'rgba(120,70,30,0.08)';
      x.lineWidth = 2;
      x.beginPath();
      const y0 = r.next() * 512;
      x.moveTo(0, y0);
      x.bezierCurveTo(170, y0 + 20, 340, y0 - 20, 512, y0 + 6);
      x.stroke();
    }
  } else if (kind === 'flag' || kind === 'tiles' || kind === 'marble' || kind === 'mosaic') {
    const n = kind === 'flag' ? 6 : kind === 'mosaic' ? 16 : 4;
    const s = 512 / n;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const alt = (i + j) % 2 === 0;
        const v = (r.next() - 0.5) * 0.07;
        x.fillStyle = color;
        x.fillRect(i * s, j * s, s, s);
        if ((kind === 'mosaic' || kind === 'tiles') && alt) {
          x.globalAlpha = kind === 'mosaic' ? 0.12 : 0.18;
          x.fillStyle = accent;
          x.fillRect(i * s, j * s, s, s);
          x.globalAlpha = 1;
        }
        x.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`;
        x.fillRect(i * s, j * s, s, s);
        x.strokeStyle = 'rgba(0,0,0,0.12)';
        x.lineWidth = kind === 'mosaic' ? 1 : 2;
        x.strokeRect(i * s, j * s, s, s);
        if (kind === 'marble') {
          x.strokeStyle = 'rgba(120,110,100,0.18)';
          x.lineWidth = 1.5;
          x.beginPath();
          x.moveTo(i * s + r.next() * s, j * s);
          x.quadraticCurveTo(i * s + r.next() * s, j * s + s / 2, i * s + r.next() * s, j * s + s);
          x.stroke();
        }
      }
  } else if (kind === 'cloud') {
    for (let i = 0; i < 120; i++) {
      const gx = x.createRadialGradient(0, 0, 0, 0, 0, 60);
      gx.addColorStop(0, 'rgba(255,255,255,0.35)');
      gx.addColorStop(1, 'rgba(255,255,255,0)');
      x.save();
      x.translate(r.next() * 512, r.next() * 512);
      x.fillStyle = gx;
      x.fillRect(-60, -60, 120, 120);
      x.restore();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(kind === 'mosaic' ? 3 : 4, kind === 'mosaic' ? 3 : 4);
  t.anisotropy = 4;
  return t;
}

function bannerTexture(color: string, trim: string): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const x = c.getContext('2d')!;
  x.fillStyle = color;
  x.fillRect(0, 0, 128, 256);
  x.fillStyle = trim;
  x.fillRect(0, 0, 128, 10);
  x.fillRect(0, 230, 128, 8);
  for (let i = 0; i < 4; i++) {
    x.beginPath();
    x.moveTo(i * 32, 238);
    x.lineTo(i * 32 + 16, 256);
    x.lineTo(i * 32 + 32, 238);
    x.fill();
  }
  // laurel + eagle medallion
  x.strokeStyle = trim;
  x.lineWidth = 6;
  x.beginPath();
  x.arc(64, 110, 34, 0.25 * Math.PI, 0.75 * Math.PI, true);
  x.stroke();
  x.fillStyle = trim;
  x.beginPath();
  x.moveTo(64, 82);
  x.lineTo(92, 104);
  x.lineTo(70, 104);
  x.lineTo(64, 134);
  x.lineTo(58, 104);
  x.lineTo(36, 104);
  x.closePath();
  x.fill();
  x.font = 'bold 26px Cinzel, Georgia, serif';
  x.textAlign = 'center';
  x.fillText('SPQR', 64, 190);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ── Kit pieces ──────────────────────────────────────────────────────────
const colGeoCache: Record<string, THREE.BufferGeometry> = {};
function columnGeo(h: number, r: number, fluted = true): THREE.BufferGeometry {
  const k = `${h}|${r}|${fluted}`;
  if (colGeoCache[k]) return colGeoCache[k];
  const pts = [
    new THREE.Vector2(r * 1.5, 0), new THREE.Vector2(r * 1.5, h * 0.03), new THREE.Vector2(r * 1.25, h * 0.045), new THREE.Vector2(r * 1.1, h * 0.06),
    new THREE.Vector2(r, h * 0.08), new THREE.Vector2(r * 0.88, h * 0.9), new THREE.Vector2(r * 1.05, h * 0.92), new THREE.Vector2(r * 1.25, h * 0.95),
    new THREE.Vector2(r * 1.55, h * 0.965), new THREE.Vector2(r * 1.55, h), new THREE.Vector2(0, h),
  ];
  const g = new THREE.LatheGeometry(pts, fluted ? 20 : 14);
  if (fluted) {
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < h * 0.1 || y > h * 0.9) continue;
      const a = Math.atan2(pos.getZ(i), pos.getX(i));
      const f = 1 - 0.05 * Math.max(0, Math.cos(a * 20));
      pos.setX(i, pos.getX(i) * f);
      pos.setZ(i, pos.getZ(i) * f);
    }
    g.computeVertexNormals();
  }
  colGeoCache[k] = g;
  return g;
}

function ring(n: number, radius: number, arc: [number, number], place: (i: number, x: number, z: number, ang: number) => void) {
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const a = arc[0] + (arc[1] - arc[0]) * t;
    place(i, Math.sin(a) * radius, -Math.cos(a) * radius, a);
  }
}

function instanced(geo: THREE.BufferGeometry, m: THREE.Material, mats: THREE.Matrix4[]): THREE.InstancedMesh {
  const im = new THREE.InstancedMesh(geo, m, mats.length);
  mats.forEach((mm, i) => im.setMatrixAt(i, mm));
  im.instanceMatrix.needsUpdate = true;
  return im;
}
const M = (x: number, y: number, z: number, ry = 0, s = 1, sy = s) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(s, sy, s));

function colonnade(g: THREE.Group, c: Ctx, n: number, radius: number, arc: [number, number], h: number, r: number, entablature = true) {
  const mats: THREE.Matrix4[] = [];
  ring(n, radius, arc, (_i, x, z) => mats.push(M(x, FLOOR_Y, z)));
  g.add(instanced(columnGeo(h, r), c.stone, mats));
  if (entablature) {
    const segs = 32;
    const geo = new THREE.TorusGeometry(radius, 0.35, 6, segs, arc[1] - arc[0]);
    const beam = new THREE.Mesh(geo, c.stone);
    beam.rotation.x = Math.PI / 2;
    beam.rotation.z = -(Math.PI / 2) - arc[0] + 0 * 1;
    beam.rotation.z = arc[0] - Math.PI / 2;
    beam.scale.set(1, 1, 1.4);
    beam.position.y = FLOOR_Y + h + 0.3;
    g.add(beam);
  }
}

function arcadeWall(g: THREE.Group, c: Ctx, radius: number, arc: [number, number], h: number, arches: number, tiers = 1, material?: THREE.Material) {
  // A curved wall with arched openings, built from instanced piers + lintels per tier.
  const pierW = 0.9;
  for (let t = 0; t < tiers; t++) {
    const y0 = FLOOR_Y + t * h;
    const piers: THREE.Matrix4[] = [];
    const lint: THREE.Matrix4[] = [];
    const arcs: THREE.Matrix4[] = [];
    const rr = radius + t * 0.6;
    const span = ((arc[1] - arc[0]) * rr) / arches;
    ring(arches + 1, rr, arc, (_i, x, z, a) => piers.push(M(x, y0 + h / 2, z, -a)));
    ring(arches, rr, [arc[0] + (arc[1] - arc[0]) / arches / 2, arc[1] - (arc[1] - arc[0]) / arches / 2], (_i, x, z, a) => {
      lint.push(M(x, y0 + h - 0.35, z, -a));
      arcs.push(new THREE.Matrix4().compose(new THREE.Vector3(x, y0 + h * 0.62, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a, 0)), new THREE.Vector3(1, 1, 1)));
    });
    const m = material ?? c.stone;
    // Shadowed backing wall so the arches read as openings.
    const back = new THREE.Mesh(new THREE.CylinderGeometry(rr + 0.7, rr + 0.7, h, 48, 1, true, arc[0] - Math.PI / 2, arc[1] - arc[0]), c.dark);
    (back.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    back.rotation.y = Math.PI;
    back.position.y = y0 + h / 2;
    g.add(back);
    g.add(instanced(new THREE.BoxGeometry(pierW, h, 1.2), m, piers));
    g.add(instanced(new THREE.BoxGeometry(span, 0.7, 1.2), m, lint));
    const archGeo = new THREE.TorusGeometry((span - pierW) / 2, 0.16, 6, 12, Math.PI);
    g.add(instanced(archGeo, m, arcs));
  }
}

function banner(g: THREE.Group, c: Ctx, x: number, z: number, h: number, color: string, faceAngle: number) {
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, h, 8), c.wood);
  pole.position.set(x, FLOOR_Y + h / 2, z);
  g.add(pole);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.3, 6), c.gold);
  bar.rotation.z = Math.PI / 2;
  bar.position.set(x, FLOOR_Y + h - 0.25, z);
  bar.rotation.y = faceAngle;
  g.add(bar);
  const clothGeo = new THREE.PlaneGeometry(1.15, 2.2, 6, 8);
  const pos = clothGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 3 + pos.getY(i)) * 0.06);
  clothGeo.computeVertexNormals();
  const cloth = new THREE.Mesh(clothGeo, c.cloth(color, true));
  cloth.position.set(x, FLOOR_Y + h - 1.4, z);
  cloth.rotation.y = faceAngle;
  g.add(cloth);
  const eagle = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 6), c.gold);
  eagle.position.set(x, FLOOR_Y + h + 0.12, z);
  g.add(eagle);
}

function brazier(g: THREE.Group, c: Ctx, x: number, z: number, flame = '#ff9a30') {
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.2, 1.4, 8), c.dark);
  stand.position.set(x, FLOOR_Y + 0.7, z);
  g.add(stand);
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), c.gold);
  bowl.rotation.x = Math.PI;
  bowl.position.set(x, FLOOR_Y + 1.55, z);
  g.add(bowl);
  const fire = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 10), new THREE.MeshBasicMaterial({ color: flame, transparent: true, opacity: 0.85 }));
  fire.position.set(x, FLOOR_Y + 1.9, z);
  g.add(fire);
  const glow = new THREE.PointLight(flame, 6, 9, 2);
  glow.position.set(x, FLOOR_Y + 2.2, z);
  g.add(glow);
}

function statue(g: THREE.Group, c: Ctx, x: number, z: number, type: string, scale: number, faceAngle: number, material?: THREE.Material) {
  const plinth = new THREE.Mesh(new RoundedBoxGeometry(1.4 * scale * 0.5, 1.2, 1.4 * scale * 0.5, 2, 0.06), c.stone);
  plinth.position.set(x, FLOOR_Y + 0.6, z);
  g.add(plinth);
  void loadPieceSet('legio').then((set) => {
    const geo = set[type]?.body;
    if (!geo) return;
    const s = new THREE.Mesh(geo, material ?? c.stone);
    s.scale.setScalar(scale);
    s.position.set(x, FLOOR_Y + 1.2, z);
    s.rotation.y = faceAngle;
    g.add(s);
    g.userData.onAsync?.();
  });
}

function tents(g: THREE.Group, c: Ctx, n: number, radius: number, arc: [number, number], color: string) {
  const mats: THREE.Matrix4[] = [];
  ring(n, radius, arc, (i, x, z, a) => mats.push(M(x, FLOOR_Y + 1.1, z, -a + Math.PI / 4, 1 + (i % 2) * 0.15)));
  const geo = new THREE.ConeGeometry(1.6, 2.2, 4, 1);
  g.add(instanced(geo, mat(color, 0.95), mats));
  void c;
  const trim: THREE.Matrix4[] = mats.map((m) => m.clone().multiply(new THREE.Matrix4().makeTranslation(0, -1.0, 0)));
  g.add(instanced(new THREE.CylinderGeometry(1.15, 1.15, 0.18, 4), mat('#f4ead6', 0.9), trim));
}

function palisade(g: THREE.Group, c: Ctx, radius: number, arc: [number, number], h: number) {
  const n = Math.round(((arc[1] - arc[0]) * radius) / 0.42);
  const mats: THREE.Matrix4[] = [];
  const r = createRng(9);
  ring(n, radius, arc, (_i, x, z) => mats.push(M(x, FLOOR_Y + h / 2, z, r.next() * 3, 1, 0.85 + r.next() * 0.3)));
  const post = new THREE.CylinderGeometry(0.2, 0.22, h, 6);
  post.translate(0, 0, 0);
  g.add(instanced(post, c.wood, mats));
  const tips: THREE.Matrix4[] = mats.map((m) => m.clone().multiply(new THREE.Matrix4().makeTranslation(0, h / 2 + 0.2, 0)));
  g.add(instanced(new THREE.ConeGeometry(0.21, 0.45, 6), c.wood, tips));
}

function crenellatedWall(g: THREE.Group, c: Ctx, radius: number, arc: [number, number], h: number, towers: number, m?: THREE.Material) {
  const segs = 24;
  const geo = new THREE.CylinderGeometry(radius, radius, h, segs * 2, 1, true, arc[0] - Math.PI / 2, arc[1] - arc[0]);
  const wall = new THREE.Mesh(geo, m ?? c.stone);
  (wall.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  wall.rotation.y = Math.PI;
  wall.position.y = FLOOR_Y + h / 2;
  g.add(wall);
  const merlons: THREE.Matrix4[] = [];
  const n = Math.round(((arc[1] - arc[0]) * radius) / 1.1);
  ring(n, radius, arc, (_i, x, z, a) => merlons.push(M(x, FLOOR_Y + h + 0.35, z, -a)));
  g.add(instanced(new THREE.BoxGeometry(0.6, 0.7, 0.9), m ?? c.stone, merlons));
  const tw: THREE.Matrix4[] = [];
  ring(towers, radius + 0.4, arc, (_i, x, z) => tw.push(M(x, FLOOR_Y + (h + 2.4) / 2, z)));
  g.add(instanced(new THREE.CylinderGeometry(1.5, 1.7, h + 2.4, 12), m ?? c.stone, tw));
  const caps: THREE.Matrix4[] = tw.map((mm) => mm.clone().multiply(new THREE.Matrix4().makeTranslation(0, (h + 2.4) / 2 + 0.9, 0)));
  g.add(instanced(new THREE.ConeGeometry(1.9, 1.8, 12), c.accent, caps));
}

function cypress(g: THREE.Group, c: Ctx, positions: [number, number][], color = '#2f5a35') {
  const mats = positions.map(([x, z], i) => M(x, FLOOR_Y + 2.4, z, i, 1, 1 + (i % 3) * 0.12));
  const geo = new THREE.SphereGeometry(0.75, 10, 10);
  geo.scale(1, 3.2, 1);
  g.add(instanced(geo, mat(color, 0.9), mats));
  void c;
}

function palms(g: THREE.Group, c: Ctx, positions: [number, number][]) {
  for (const [x, z] of positions) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 4, 6), c.wood);
    trunk.position.set(x, FLOOR_Y + 2, z);
    trunk.rotation.z = 0.08;
    g.add(trunk);
    for (let i = 0; i < 7; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.28, 2.2, 4), mat('#3f7a3a', 0.85));
      const a = (i / 7) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 0.8, FLOOR_Y + 3.85, z + Math.sin(a) * 0.8);
      leaf.rotation.set(Math.sin(a) * 1.3, 0, -Math.cos(a) * 1.3);
      g.add(leaf);
    }
  }
}

function dome(g: THREE.Group, c: Ctx, x: number, z: number, r: number, h: number) {
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), c.stone);
  drum.position.set(x, FLOOR_Y + h / 2, z);
  g.add(drum);
  const d = new THREE.Mesh(new THREE.SphereGeometry(r * 1.02, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), c.gold);
  d.position.set(x, FLOOR_Y + h, z);
  g.add(d);
}

function triumphalArch(g: THREE.Group, c: Ctx, x: number, z: number, s: number) {
  const shape = new THREE.Shape();
  shape.moveTo(-3 * s, 0);
  shape.lineTo(3 * s, 0);
  shape.lineTo(3 * s, 6 * s);
  shape.lineTo(-3 * s, 6 * s);
  shape.closePath();
  const hole = new THREE.Path();
  hole.moveTo(-1.2 * s, 0);
  hole.lineTo(-1.2 * s, 3 * s);
  hole.absarc(0, 3 * s, 1.2 * s, Math.PI, 0, true);
  hole.lineTo(1.2 * s, 0);
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 1.6 * s, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1 });
  const arch = new THREE.Mesh(geo, c.stone);
  arch.position.set(x, FLOOR_Y, z - 0.8 * s);
  g.add(arch);
  const attic = new THREE.Mesh(new THREE.BoxGeometry(6.3 * s, 1.2 * s, 1.8 * s), c.stone);
  attic.position.set(x, FLOOR_Y + 6.6 * s, z);
  g.add(attic);
  const quad = new THREE.Mesh(new THREE.BoxGeometry(2.4 * s, 0.9 * s, 1 * s), c.gold);
  quad.position.set(x, FLOOR_Y + 7.6 * s, z);
  g.add(quad);
}

function steps(g: THREE.Group, c: Ctx, m?: THREE.Material) {
  // A ceremonial dais under the board.
  for (let i = 0; i < 2; i++) {
    const s = new THREE.Mesh(new RoundedBoxGeometry(13 + i * 2.2, 0.3, 13 + i * 2.2, 2, 0.06), m ?? c.stone);
    s.position.y = FLOOR_Y - 0.15 - i * 0.3;
    g.add(s);
  }
}

// ── The twelve arenas ───────────────────────────────────────────────────
const WIDE: [number, number] = [-1.9, 1.9];

export const ARENA_KITS: Kit[] = [
  { // 0 Dust Pits — sunset ludus: sand, palisade, training posts, braziers
    ground: { color: '#d9a46c', pattern: 'sand' }, fog: '#e9b07a',
    light: { key: 2.3, keyColor: '#ffd29a', ambient: 0.55, sky: '#ffd7a0', ground: '#8a5a32', exposure: 1.0 },
    build: (g, c) => {
      palisade(g, c, 13, WIDE, 3.2);
      const posts: THREE.Matrix4[] = [];
      ring(5, 9.5, [-0.9, 0.9], (_i, x, z) => posts.push(M(x, FLOOR_Y + 1.2, z)));
      g.add(instanced(new THREE.CylinderGeometry(0.22, 0.26, 2.4, 8), c.wood, posts));
      banner(g, c, -7.5, -8, 5, c.pal.accent, 0.5);
      banner(g, c, 7.5, -8, 5, c.pal.accent, -0.5);
      brazier(g, c, -6.5, -5.5);
      brazier(g, c, 6.5, -5.5);
    },
  },
  { // 1 Legion Camp — tents, standards, blue sky, grass
    ground: { color: '#8a9a5a', pattern: 'grass' }, fog: '#cfe4f0',
    light: { key: 2.6, keyColor: '#fff6e6', ambient: 0.7, sky: '#d4ecff', ground: '#6a7a40', exposure: 1.0 },
    build: (g, c) => {
      tents(g, c, 9, 13, WIDE, '#c4b08a');
      tents(g, c, 6, 17, [-1.3, 1.3], '#b8302a');
      for (const [x, z] of [[-5, -8], [0, -9.5], [5, -8]] as [number, number][]) banner(g, c, x, z, 5.5, x === 0 ? '#2f6db3' : c.pal.accent, -x * 0.06);
      palisade(g, c, 20, [-1.5, 1.5], 2.6);
    },
  },
  { // 2 Iron Citadel — fortified grey walls & towers
    ground: { color: '#8c8f94', pattern: 'flag' }, fog: '#b8c2cc',
    light: { key: 2.0, keyColor: '#e6eefc', ambient: 0.6, sky: '#c8d6e6', ground: '#4a4e55', exposure: 0.98 },
    build: (g, c) => {
      crenellatedWall(g, c, 14, WIDE, 6, 4);
      banner(g, c, -4, -10.5, 6, c.pal.accent, 0.3);
      banner(g, c, 4, -10.5, 6, c.pal.accent, -0.3);
      brazier(g, c, -7, -6, '#ffb060');
      brazier(g, c, 7, -6, '#ffb060');
    },
  },
  { // 3 Gladiator's Court — sandstone arcade courtyard, palms, banners
    ground: { color: '#e2b47a', pattern: 'tiles', accent: '#c48a52' }, fog: '#ffd6a0',
    light: { key: 2.5, keyColor: '#ffe2b0', ambient: 0.65, sky: '#ffe0b0', ground: '#9a6a3a', exposure: 1.02 },
    build: (g, c) => {
      arcadeWall(g, c, 13, WIDE, 4.2, 9, 2);
      palms(g, c, [[-9, -4], [9, -4], [-6.5, -9], [6.5, -9]]);
      for (const x of [-3, 3]) banner(g, c, x, -11, 6, x < 0 ? c.pal.accent : c.pal.accent2, 0);
    },
  },
  { // 4 Forum of Triumph — white marble colonnade, triumphal arch, statues
    ground: { color: '#efe8da', pattern: 'marble' }, fog: '#e6f2fb',
    light: { key: 2.7, keyColor: '#fffaf0', ambient: 0.75, sky: '#e8f4ff', ground: '#a89d88', exposure: 0.95 },
    build: (g, c) => {
      steps(g, c);
      colonnade(g, c, 11, 13, WIDE, 6.5, 0.42);
      triumphalArch(g, c, 0, -18, 1.25);
      statue(g, c, -8, -7, 'k', 3, 0.5);
      statue(g, c, 8, -7, 'q', 3, -0.5);
      cypress(g, c, [[-12, -12], [12, -12], [-15, -6], [15, -6]]);
    },
  },
  { // 5 Praetorian Bastion — dusk, dark red walls, torches
    ground: { color: '#6e4b45', pattern: 'flag' }, fog: '#6a4a5a',
    light: { key: 1.6, keyColor: '#ffb48a', ambient: 0.45, sky: '#8a6a9a', ground: '#2b1a17', exposure: 1.05 },
    build: (g, c) => {
      crenellatedWall(g, c, 13.5, WIDE, 5, 5, c.dark);
      for (const x of [-6.5, -2.2, 2.2, 6.5]) banner(g, c, x, -10.5, 5.5, '#7b1e3a', 0);
      brazier(g, c, -5.5, -5, '#ff7a30');
      brazier(g, c, 5.5, -5, '#ff7a30');
      brazier(g, c, -9, 1, '#ff7a30');
      brazier(g, c, 9, 1, '#ff7a30');
    },
  },
  { // 6 Senate Hall — green marble interior, columns, curule benches
    ground: { color: '#7f9b8c', pattern: 'tiles', accent: '#e9e2d0' }, fog: '#d9e6e0',
    light: { key: 2.1, keyColor: '#fff0d8', ambient: 0.7, sky: '#f2ead8', ground: '#4a5a52', exposure: 1.0 },
    build: (g, c) => {
      steps(g, c, mat('#e9e2d0', 0.5));
      colonnade(g, c, 13, 12.5, [-2.2, 2.2], 7, 0.45);
      const benches: THREE.Matrix4[] = [];
      for (let t = 0; t < 3; t++) ring(7, 9.5 + t * 1.3, [-1.2, 1.2], (_i, x, z, a) => benches.push(M(x, FLOOR_Y + 0.3 + t * 0.45, z, -a)));
      g.add(instanced(new RoundedBoxGeometry(2.2, 0.5, 0.9, 2, 0.08), mat('#8e1b1b', 0.6), benches));
    },
  },
  { // 7 Consular Palace — crimson & gold palace, fasces standards
    ground: { color: '#9c3a33', pattern: 'mosaic', accent: '#e8c060' }, fog: '#d08a6a',
    light: { key: 2.0, keyColor: '#ffcf9a', ambient: 0.55, sky: '#e8a07a', ground: '#5a1616', exposure: 1.02 },
    build: (g, c) => {
      steps(g, c, mat('#5a1616', 0.5));
      colonnade(g, c, 11, 12.5, WIDE, 7, 0.45);
      arcadeWall(g, c, 17, [-1.4, 1.4], 6, 7, 1, c.accent);
      for (const x of [-7, 7]) {
        const fasces = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 3.4, 10), c.wood);
        fasces.position.set(x, FLOOR_Y + 1.7, -6);
        g.add(fasces);
        const axe = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.1, 3), c.gold);
        axe.rotation.x = Math.PI / 2;
        axe.position.set(x + 0.4, FLOOR_Y + 3.3, -6);
        g.add(axe);
      }
      brazier(g, c, -9, -2);
      brazier(g, c, 9, -2);
    },
  },
  { // 8 Grand Colosseum — sand floor, tiered arcade ring
    ground: { color: '#e0b27a', pattern: 'sand' }, fog: '#ffcf8a',
    light: { key: 2.6, keyColor: '#ffe0a8', ambient: 0.6, sky: '#ffd890', ground: '#8a5a2a', exposure: 1.0 },
    build: (g, c) => {
      arcadeWall(g, c, 15, [-2.6, 2.6], 4.2, 18, 3);
      // Seating tiers above the podium.
      for (let t = 0; t < 3; t++) {
        const tier = new THREE.Mesh(new THREE.CylinderGeometry(14.4 + t * 0.2, 14.4 + t * 0.2, 0.35, 48, 1, true, -Math.PI * 0.85, Math.PI * 1.7), mat(t % 2 ? '#e8c890' : '#d9a066', 0.85));
        (tier.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
        tier.rotation.y = Math.PI;
        tier.position.y = FLOOR_Y + 1.6 + t * 0.35;
        g.add(tier);
      }
      const podium = new THREE.Mesh(new THREE.CylinderGeometry(14.2, 14.2, 1.4, 48, 1, true, -Math.PI * 0.85, Math.PI * 1.7), c.accent);
      (podium.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      podium.rotation.y = Math.PI;
      podium.position.y = FLOOR_Y + 0.7;
      g.add(podium);
      for (const x of [-6, 6]) banner(g, c, x, -12.5, 6.5, '#9c1c1c', 0);
    },
  },
  { // 9 Imperial Palace — night, domes, purple and gold
    ground: { color: '#7c5f92', pattern: 'mosaic', accent: '#e8c060' }, fog: '#4a3a6a',
    light: { key: 1.5, keyColor: '#d8d0ff', ambient: 0.5, sky: '#6a5a9a', ground: '#2a1638', exposure: 1.08 },
    build: (g, c) => {
      steps(g, c, mat('#c9b8d8', 0.45));
      colonnade(g, c, 9, 12.5, [-1.7, 1.7], 7, 0.45);
      dome(g, c, 0, -20, 4.2, 5);
      dome(g, c, -11, -16, 2.4, 4);
      dome(g, c, 11, -16, 2.4, 4);
      for (const x of [-7, 7]) brazier(g, c, x, -4, '#ffd27a');
    },
  },
  { // 10 Hall of Caesars — teal hall of colossal statues
    ground: { color: '#3f6b74', pattern: 'tiles', accent: '#d8d2c0' }, fog: '#2f5a62',
    light: { key: 1.8, keyColor: '#fff2d8', ambient: 0.55, sky: '#5a8a92', ground: '#132328', exposure: 1.05 },
    build: (g, c) => {
      steps(g, c, mat('#d8d2c0', 0.4));
      colonnade(g, c, 12, 13, [-2.1, 2.1], 8, 0.5);
      const marble = mat('#e8e2d2', 0.35);
      statue(g, c, -9, -6, 'k', 4, 0.6, marble);
      statue(g, c, 9, -6, 'q', 4, -0.6, marble);
      statue(g, c, -4, -10.5, 'n', 3.6, 1.2, marble);
      statue(g, c, 4, -10.5, 'b', 3.6, -1.2, marble);
      for (const x of [-11, 11]) brazier(g, c, x, 0, '#ffd890');
    },
  },
  { // 11 Eternal Throne — celestial platform above the clouds
    ground: { color: '#9a8ad8', pattern: 'cloud' }, fog: '#8a7ac8',
    light: { key: 2.4, keyColor: '#fff2cc', ambient: 0.75, sky: '#d8d0ff', ground: '#6a5aa8', exposure: 1.02 },
    build: (g, c) => {
      steps(g, c, mat('#f7efdc', 0.3));
      colonnade(g, c, 8, 12, [-1.6, 1.6], 9, 0.5, false);
      const throne = new THREE.Group();
      const seat = new THREE.Mesh(new RoundedBoxGeometry(3, 1.2, 2.2, 3, 0.15), c.gold);
      seat.position.y = 0.6;
      const back = new THREE.Mesh(new RoundedBoxGeometry(3, 4.6, 0.6, 3, 0.2), c.gold);
      back.position.set(0, 2.9, -0.8);
      const halo = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.12, 12, 48), c.gold);
      halo.position.set(0, 5.6, -0.9);
      throne.add(seat, back, halo);
      throne.position.set(0, FLOOR_Y, -16);
      throne.scale.setScalar(1.3);
      g.add(throne);
      const rays = new THREE.Mesh(new THREE.ConeGeometry(9, 26, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#fff0c0', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }));
      rays.position.set(0, 9, -16);
      g.add(rays);
    },
  },
];

const bgCache = new Map<number, THREE.Texture>();
function backdropTexture(i: number): THREE.Texture {
  let t = bgCache.get(i);
  if (!t) {
    t = new THREE.TextureLoader().load(svgDataUri(arenaBackdropSvg(i)));
    t.colorSpace = THREE.SRGBColorSpace;
    bgCache.set(i, t);
  }
  return t;
}

export type ArenaEnv = { group: THREE.Group; background: THREE.Texture; fog: THREE.Fog; lights: THREE.Light[]; exposure: number; dispose: () => void };

export function buildArenaEnvironment(index: number, onAsync?: () => void): ArenaEnv {
  const kit = ARENA_KITS[index] ?? ARENA_KITS[0];
  const pal = ARENAS[index].palette;
  const rng = createRng(mixSeed('arena', index));
  const clothCache = new Map<string, THREE.Material>();
  const ctx: Ctx = {
    rng: () => rng.next(), pal,
    stone: mat(new THREE.Color(pal.stone).multiplyScalar(0.9).getStyle(), 0.75), dark: mat(pal.stoneDark, 0.7), accent: mat(pal.accent, 0.6), gold: mat('#d9a840', 0.3, 0.85), wood: mat('#7a4e2c', 0.85),
    cloth: (color: string) => {
      let m = clothCache.get(color);
      if (!m) {
        m = new THREE.MeshStandardMaterial({ map: bannerTexture(color, '#e8c060'), side: THREE.DoubleSide, roughness: 0.9 });
        clothCache.set(color, m);
      }
      return m;
    },
  };
  const group = new THREE.Group();
  group.userData.onAsync = onAsync;
  const tex = groundTexture(kit.ground.pattern, kit.ground.color, kit.ground.accent ?? pal.stone);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, color: '#d8d0c4' }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = FLOOR_Y - 0.02;
  ground.receiveShadow = true;
  group.add(ground);
  // Radial vignette: the floor darkens away from the board, focusing the eye.
  const vc = document.createElement('canvas');
  vc.width = vc.height = 256;
  const vx = vc.getContext('2d')!;
  const vg = vx.createRadialGradient(128, 128, 30, 128, 128, 128);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(0.55, 'rgba(0,0,0,0.12)');
  vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  vx.fillStyle = vg;
  vx.fillRect(0, 0, 256, 256);
  const vig = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(vc), transparent: true, depthWrite: false }));
  vig.rotation.x = -Math.PI / 2;
  vig.position.y = FLOOR_Y - 0.01;
  group.add(vig);
  kit.build(group, ctx);
  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && o !== ground) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });
  const hemi = new THREE.HemisphereLight(kit.light.sky, kit.light.ground, kit.light.ambient);
  return {
    group,
    background: backdropTexture(index),
    fog: new THREE.Fog(kit.fog, 22, 60),
    lights: [hemi],
    exposure: kit.light.exposure,
    dispose: () => {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          if (!Object.values(colGeoCache).includes(m.geometry)) m.geometry.dispose();
        }
      });
    },
  };
}

export function arenaKeyLight(index: number): { intensity: number; color: string } {
  const k = (ARENA_KITS[index] ?? ARENA_KITS[0]).light;
  return { intensity: k.key, color: k.keyColor };
}
