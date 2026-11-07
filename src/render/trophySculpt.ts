import {
  type SDF, type Vec3, revolve, smoothUnion, union, sphere, ellipsoid, capsule, roundBox, torusY, subtract, smoothSubtract, intersect, polarY,
} from './sdf';

/**
 * Trophy models for the Hall of Honors, sculpted as SDFs like the chess set.
 * body = the trophy itself (metal); accent = pedestal / gems / enamel.
 * Units ≈ 1 = trophy height. y up.
 */
export type TrophySculpt = { body: SDF; accent: SDF | null; bounds: [Vec3, Vec3] };

const pedestal = (r = 0.2, h = 0.12): SDF => revolve([[r, 0], [r, 0.03], [r - 0.015, 0.04], [r - 0.03, 0.045], [r - 0.03, h - 0.02], [r - 0.012, h - 0.01], [r - 0.012, h]]);

function rotX(f: SDF, a: number, pivot: Vec3): SDF {
  const c = Math.cos(-a), s = Math.sin(-a);
  return (x, y, z) => {
    const dy = y - pivot[1], dz = z - pivot[2];
    return f(x, pivot[1] + c * dy - s * dz, pivot[2] + s * dy + c * dz);
  };
}
function rotZ(f: SDF, a: number, pivot: Vec3): SDF {
  const c = Math.cos(-a), s = Math.sin(-a);
  return (x, y, z) => {
    const dx = x - pivot[0], dy = y - pivot[1];
    return f(pivot[0] + c * dx - s * dy, pivot[1] + s * dx + c * dy, z);
  };
}
const B: [Vec3, Vec3] = [[-0.42, -0.01, -0.3], [0.42, 1.02, 0.3]];

function laurelRing(cy: number, R: number, leaves: number, size: number, tilt = 0): SDF {
  const leaf = ellipsoid([R, cy, 0], [size * 0.5, size, size * 0.42]);
  const tilted = tilt ? rotZ(leaf, tilt, [R, cy, 0]) : leaf;
  return smoothUnion(0.01, polarY(leaves, tilted), torusY(cy, R - size * 0.2, size * 0.18));
}

export const TROPHY_SCULPTS: Record<string, () => TrophySculpt> = {
  cup: () => {
    const bowl = revolve([[0.07, 0.3], [0.05, 0.36], [0.09, 0.42], [0.2, 0.55], [0.25, 0.72], [0.26, 0.82], [0.28, 0.85], [0.26, 0.86]], 2);
    const inner = (x: number, y: number, z: number) => Math.max(Math.hypot(x, z) - 0.23, 0.6 - y);
    const stem = revolve([[0.14, 0.12], [0.1, 0.16], [0.05, 0.22], [0.045, 0.28], [0.08, 0.31]]);
    const handle = (x: number, y: number, z: number) => Math.hypot(Math.hypot(Math.abs(x) - 0.3, y - 0.68) - 0.09, z) - 0.022;
    const handles = intersect(handle, (x) => 0.24 - Math.abs(x) < 0 ? 0 - (Math.abs(x) - 0.25) : 1);
    return { body: smoothUnion(0.02, smoothSubtract(0.012, bowl, inner), stem, handles), accent: pedestal(), bounds: B };
  },
  amphora: () => {
    const body = revolve([[0.1, 0.12], [0.06, 0.16], [0.12, 0.26], [0.2, 0.4], [0.21, 0.52], [0.15, 0.68], [0.07, 0.76], [0.06, 0.88], [0.1, 0.92], [0.09, 0.95]], 2);
    const handles = (x: number, y: number, z: number) => Math.hypot(Math.hypot(Math.abs(x) - 0.12, y - 0.8) - 0.08, z) - 0.02;
    const hcut = intersect(handles, (x) => 0.07 - Math.abs(x));
    return { body: smoothUnion(0.015, subtract(body, (x, y, z) => Math.max(Math.hypot(x, z) - 0.05, 0.9 - y)), hcut), accent: pedestal(0.18), bounds: B };
  },
  shield: () => {
    const disc = intersect(sphere(0, 0.58, -0.55, 0.8), (x, y, z) => Math.max(Math.hypot(x, y - 0.58) - 0.36, Math.abs(z) - 0.06));
    const boss = sphere(0, 0.58, 0.08, 0.09);
    const rim = (x: number, y: number, z: number) => Math.hypot(Math.hypot(x, y - 0.58) - 0.35, z - 0.03) - 0.025;
    const stand = roundBox([0, 0.16, -0.08], [0.05, 0.1, 0.03], 0.01);
    return { body: union(disc, rim, stand), accent: union(pedestal(0.22, 0.08), boss), bounds: B };
  },
  medal: () => {
    const disc = (x: number, y: number, z: number) => Math.max(Math.hypot(x, y - 0.55) - 0.24, Math.abs(z) - 0.03);
    const rim = (x: number, y: number, z: number) => Math.hypot(Math.hypot(x, y - 0.55) - 0.24, z) - 0.03;
    const relief = rotX(laurelRing(0.0, 0.15, 14, 0.035), Math.PI / 2, [0, 0, 0]);
    const reliefPlaced = (x: number, y: number, z: number) => relief(x, z - 0.03, -(y - 0.55));
    const ribbon = roundBox([0, 0.86, 0], [0.09, 0.07, 0.02], 0.01);
    const stand = capsule([0, 0.12, -0.06], [0, 0.32, -0.06], 0.02);
    return { body: union(disc, rim, reliefPlaced, stand), accent: union(pedestal(0.16, 0.1), ribbon), bounds: B };
  },
  laurel: () => {
    const wreath = (x: number, y: number, z: number) => laurelRing(0, 0.23, 22, 0.06, 0.6)(x, z, y - 0.6);
    const post = capsule([0, 0.1, -0.02], [0, 0.4, -0.02], 0.03);
    const bow = ellipsoid([0, 0.37, 0.02], [0.07, 0.04, 0.03]);
    return { body: smoothUnion(0.02, wreath, post), accent: union(pedestal(0.2), bow), bounds: B };
  },
  crown: () => {
    const band = revolve([[0.2, 0.4], [0.22, 0.43], [0.22, 0.55], [0.2, 0.58]], 1);
    const hollow = (x: number, y: number, z: number) => Math.max(Math.hypot(x, z) - 0.18, Math.abs(y - 0.5) - 0.2);
    const spikes = polarY(8, capsule([0.21, 0.56, 0], [0.24, 0.76, 0], 0.035, 0.012));
    const gems = polarY(8, sphere(0.245, 0.79, 0, 0.03));
    const bandGems = polarY(8, sphere(0.225, 0.5, 0, 0.022), Math.PI / 8);
    const cushion = smoothUnion(0.04, ellipsoid([0, 0.36, 0], [0.26, 0.1, 0.26]), revolve([[0.14, 0.1], [0.11, 0.16], [0.12, 0.3]]));
    return { body: smoothUnion(0.02, subtract(band, hollow), spikes), accent: union(gems, bandGems, pedestal(0.22), cushion), bounds: B };
  },
  torque: () => {
    const ring = (x: number, y: number, z: number) => {
      const a = Math.atan2(y - 0.55, x);
      const gap = Math.abs(a + Math.PI / 2) < 0.45;
      const d = Math.hypot(Math.hypot(x, y - 0.55) - 0.26, z) - 0.035;
      return gap ? Math.max(d, 0.02) : d;
    };
    const ends = union(sphere(Math.cos(-Math.PI / 2 + 0.47) * 0.26, 0.55 + Math.sin(-Math.PI / 2 + 0.47) * 0.26, 0, 0.055), sphere(Math.cos(-Math.PI / 2 - 0.47) * 0.26, 0.55 + Math.sin(-Math.PI / 2 - 0.47) * 0.26, 0, 0.055));
    const stand = capsule([0, 0.12, -0.05], [0, 0.3, -0.05], 0.025);
    return { body: union(ring, stand), accent: union(ends, pedestal(0.17, 0.1)), bounds: B };
  },
  eagle: () => {
    const pole = capsule([0, 0.1, 0], [0, 0.6, 0], 0.025);
    const bodyE = ellipsoid([0, 0.7, 0], [0.07, 0.11, 0.08]);
    const head = sphere(0, 0.83, 0.03, 0.045);
    const beak = capsule([0, 0.83, 0.06], [0, 0.81, 0.11], 0.018, 0.006);
    const wing = (x: number, y: number, z: number) => {
      const ax = Math.abs(x);
      return rotZ(ellipsoid([0.2, 0.8, -0.01], [0.17, 0.05, 0.03]), 0.55, [0.06, 0.72, 0])(ax, y, z);
    };
    const feathers = (x: number, y: number, z: number) => {
      const ax = Math.abs(x);
      let d = Infinity;
      for (let i = 0; i < 4; i++) d = Math.min(d, capsule([0.12 + i * 0.05, 0.86 + i * 0.03, -0.01], [0.17 + i * 0.06, 0.93 + i * 0.012, -0.01], 0.018, 0.01)(ax, y, z));
      return d;
    };
    const wreath = (x: number, y: number, z: number) => laurelRing(0, 0.08, 12, 0.025)(x, z, y - 0.6);
    return { body: smoothUnion(0.03, pole, bodyE, head, beak, wing, feathers), accent: union(wreath, pedestal(0.18)), bounds: B };
  },
  sword: () => {
    const blade = (x: number, y: number, z: number) => {
      const t = Math.max(0, Math.min(1, (y - 0.42) / 0.5));
      const w = 0.045 * (1 - t * 0.55) * (t > 0.9 ? (1 - (t - 0.9) * 9) : 1);
      return Math.max(roundBox([0, 0.67, 0], [0.05, 0.27, 0.012], 0.005)(x, y, z), Math.abs(x) - Math.max(0.002, w));
    };
    const guard = roundBox([0, 0.4, 0], [0.09, 0.022, 0.04], 0.015);
    const grip = capsule([0, 0.24, 0], [0, 0.38, 0], 0.025);
    const pommel = sphere(0, 0.22, 0, 0.04);
    const cradle = roundBox([0, 0.15, 0], [0.12, 0.03, 0.06], 0.02);
    return { body: union(blade, guard, pommel), accent: union(grip, cradle, pedestal(0.2, 0.1)), bounds: B };
  },
  standard: () => {
    const pole = capsule([0, 0.1, 0], [0, 0.95, 0], 0.02);
    const bar = capsule([-0.17, 0.82, 0], [0.17, 0.82, 0], 0.016);
    const cloth = (x: number, y: number, z: number) => roundBox([0, 0.62, 0.02 * Math.sin(x * 12)], [0.15, 0.19, 0.012], 0.01)(x, y, z - 0.02 * Math.sin(x * 12));
    const tip = smoothUnion(0.01, sphere(0, 0.98, 0, 0.03), capsule([0, 0.98, 0], [0, 1.0, 0], 0.012));
    const discs = union(torusY(0.36, 0.045, 0.015), torusY(0.3, 0.045, 0.015));
    return { body: union(pole, bar, tip, discs), accent: union(cloth, pedestal(0.18)), bounds: B };
  },
  fasces: () => {
    const rods = polarY(9, capsule([0.06, 0.16, 0], [0.06, 0.82, 0], 0.022));
    const core = capsule([0, 0.16, 0], [0, 0.85, 0], 0.05);
    const straps = union(torusY(0.3, 0.08, 0.012), torusY(0.5, 0.08, 0.012), torusY(0.7, 0.08, 0.012));
    const axe = smoothUnion(0.01, capsule([0, 0.82, 0], [0.12, 0.84, 0], 0.016), intersect(sphere(0.18, 0.82, 0, 0.11), roundBox([0.2, 0.82, 0], [0.06, 0.1, 0.012], 0.006)));
    return { body: union(straps, axe), accent: union(rods, core, pedestal(0.17)), bounds: B };
  },
  curule: () => {
    const seat = roundBox([0, 0.55, 0], [0.24, 0.025, 0.14], 0.015);
    const leg = (x: number, y: number, z: number) => {
      const ax = Math.abs(x);
      const zz = Math.abs(z) - 0.12;
      // X-shaped curved legs on each side
      const a = Math.hypot(Math.hypot(ax - 0.36, y - 0.33) - 0.25, zz) - 0.022;
      return Math.max(a, 0.12 - y, y - 0.54, 0.05 - ax);
    };
    const feet = union(sphere(0.2, 0.13, 0.12, 0.03), sphere(-0.2, 0.13, 0.12, 0.03), sphere(0.2, 0.13, -0.12, 0.03), sphere(-0.2, 0.13, -0.12, 0.03));
    const cushion = roundBox([0, 0.59, 0], [0.22, 0.025, 0.12], 0.02);
    return { body: union(leg, seat, feet), accent: union(cushion, pedestal(0.3, 0.1)), bounds: B };
  },
};

/** Visual recipe for each trophy definition: model + materials + enamel. */
export type TrophyLook = { model: string; metal: 'bronze' | 'silver' | 'gold' | 'iron' | 'wood' | 'imperial'; accent: string; glow?: boolean };

const SIG: TrophyLook[] = [
  { model: 'sword', metal: 'wood', accent: '#7a4a2c' },
  { model: 'standard', metal: 'bronze', accent: '#b8302a' },
  { model: 'eagle', metal: 'iron', accent: '#a8a8a8' },
  { model: 'sword', metal: 'gold', accent: '#8a2a1d' },
  { model: 'laurel', metal: 'gold', accent: '#efe8da' },
  { model: 'standard', metal: 'gold', accent: '#7b1e3a' },
  { model: 'curule', metal: 'silver', accent: '#1f5f4a' },
  { model: 'fasces', metal: 'gold', accent: '#6b3a24' },
  { model: 'crown', metal: 'gold', accent: '#9c1c1c' },
  { model: 'amphora', metal: 'imperial', accent: '#5a2a7a' },
  { model: 'laurel', metal: 'gold', accent: '#1a3a42', glow: true },
  { model: 'crown', metal: 'imperial', accent: '#f4cf6a', glow: true },
];
const TIER_METAL: TrophyLook['metal'][] = ['bronze', 'silver', 'gold', 'imperial'];

export function trophyLook(defId: string, arena?: number, arenaTierIdx?: number): TrophyLook {
  if (defId.startsWith('sig-')) return SIG[Number(defId.slice(4))] ?? SIG[0];
  const t = arenaTierIdx ?? (arena !== undefined ? Math.min(3, Math.floor(arena / 3)) : 2);
  const metal = TIER_METAL[Math.max(0, Math.min(3, t))];
  if (defId === 'imperial-crown') return { model: 'crown', metal: 'imperial', accent: '#9c1c1c', glow: true };
  if (defId.startsWith('cup-gauntlet')) return { model: 'amphora', metal, accent: '#3a2a20' };
  if (defId.startsWith('cup-') || defId.startsWith('hosted-')) return { model: 'cup', metal, accent: '#2c2018' };
  if (defId.startsWith('league-')) return { model: 'shield', metal, accent: '#b8302a' };
  if (defId.startsWith('invit-')) return { model: 'eagle', metal, accent: '#2c6aa8' };
  if (defId.startsWith('medal-')) return { model: 'medal', metal: t >= 2 ? 'silver' : 'bronze', accent: '#9c1f1a' };
  if (defId.startsWith('defense-')) return { model: 'torque', metal, accent: '#d9a63e' };
  if (defId.startsWith('laurel-')) return { model: 'laurel', metal, accent: '#efe8da' };
  if (defId === 'dist-iron-champion') return { model: 'shield', metal: 'iron', accent: '#d9a63e', glow: true };
  if (defId.startsWith('dist-')) return { model: 'laurel', metal: 'gold', accent: '#9c1c1c', glow: defId !== 'dist-decorated' };
  if (defId === 'hist-dynasty') return { model: 'crown', metal: 'gold', accent: '#2c6aa8', glow: true };
  if (defId.startsWith('hist-')) return { model: 'medal', metal: 'gold', accent: '#2c6aa8', glow: true };
  return { model: 'cup', metal, accent: '#2c2018' };
}

export const _unused = { smoothSubtract };
