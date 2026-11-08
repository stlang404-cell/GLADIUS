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

/** Uniformly scale a sculpt about the ground origin (keeps wide models inside the portrait frame). */
function scaled(t: TrophySculpt, k: number): TrophySculpt {
  const sc = (f: SDF): SDF => (x, y, z) => f(x / k, y / k, z / k) * k;
  return { body: sc(t.body), accent: t.accent ? sc(t.accent) : null, bounds: t.bounds };
}

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
  // ---- v0.3: signature trophies of the twelve new arenas
  helmet: () => {
    // gladiator's helmet: dome, broad brim, grilled visor, tall crest
    const dome = ellipsoid([0, 0.52, 0], [0.17, 0.2, 0.19]);
    const brim = (x: number, y: number, z: number) => Math.max(Math.hypot(x, z) - 0.27, Math.abs(y - 0.4) - 0.018);
    const visorCut = (x: number, y: number, z: number) => Math.max(Math.abs(x) - 0.1, Math.abs(y - 0.5) - 0.08, -z);
    const grille = union(...[-0.06, -0.02, 0.02, 0.06].map((gx) => capsule([gx, 0.43, 0.17], [gx, 0.57, 0.17], 0.008)));
    const crest = (x: number, y: number, z: number) => Math.max(Math.abs(x) - 0.025, Math.hypot(y - 0.62, z + 0.02) - 0.2, 0.66 - y);
    const neck = revolve([[0.11, 0.12], [0.07, 0.18], [0.06, 0.3], [0.12, 0.36]]);
    return { body: union(smoothUnion(0.02, subtract(dome, visorCut), brim, neck), grille), accent: union(crest, pedestal(0.2)), bounds: B };
  },
  palisade: () => {
    // timber fort: ring of sharpened stakes with a gate tower
    const stake = (r: number, a: number, h: number): SDF => {
      const cx = Math.cos(a) * r, cz = Math.sin(a) * r;
      return smoothUnion(0.005, capsule([cx, 0.14, cz], [cx, h, cz], 0.032), capsule([cx, h, cz], [cx, h + 0.07, cz], 0.03, 0.004));
    };
    const stakes = union(...Array.from({ length: 16 }, (_, i) => stake(0.22, (i / 16) * Math.PI * 2, 0.42 + (i % 2) * 0.04)));
    const tower = roundBox([0, 0.5, 0.2], [0.07, 0.2, 0.06], 0.01);
    const roof = intersect(roundBox([0, 0.74, 0.2], [0.1, 0.06, 0.08], 0.01), (x, y) => Math.abs(x) * 0.9 + (y - 0.8));
    const flag = roundBox([0.06, 0.86, 0.2], [0.05, 0.03, 0.005], 0.004);
    const pole = capsule([0, 0.74, 0.2], [0, 0.9, 0.2], 0.008);
    return { body: union(stakes, tower, roof, pole), accent: union(flag, pedestal(0.3, 0.12)), bounds: B };
  },
  anchor: () => {
    const shank = capsule([0, 0.2, 0], [0, 0.82, 0], 0.03);
    const ring = (x: number, y: number, z: number) => Math.hypot(Math.hypot(x, y - 0.88) - 0.05, z) - 0.016;
    const stock = capsule([-0.16, 0.74, 0], [0.16, 0.74, 0], 0.022);
    const arms = (x: number, y: number, z: number) => Math.max(Math.hypot(Math.hypot(x, y - 0.42) - 0.22, z) - 0.03, y - 0.42);
    const flukes = union(capsule([0.2, 0.33, 0], [0.26, 0.44, 0], 0.035, 0.008), capsule([-0.2, 0.33, 0], [-0.26, 0.44, 0], 0.035, 0.008));
    const rope = (x: number, y: number, z: number) => Math.hypot(Math.hypot(x - 0.06, y - 0.6) - 0.08, z - 0.03) - 0.012;
    return { body: smoothUnion(0.02, shank, ring, stock, arms, flukes), accent: union(rope, pedestal(0.2)), bounds: B };
  },
  arch: () => {
    // aqueduct: two tiers of arches
    const block = roundBox([0, 0.5, 0], [0.32, 0.34, 0.06], 0.01);
    const arches = (x: number, y: number, z: number) => {
      let d = Infinity;
      for (const cx of [-0.2, 0, 0.2]) d = Math.min(d, Math.max(Math.min(Math.hypot(x - cx, y - 0.4) - 0.075, Math.max(Math.abs(x - cx) - 0.075, y - 0.4)), 0.16 - y));
      for (const cx of [-0.24, -0.08, 0.08, 0.24]) d = Math.min(d, Math.max(Math.min(Math.hypot(x - cx, y - 0.68) - 0.05, Math.max(Math.abs(x - cx) - 0.05, y - 0.68)), 0.58 - y));
      return Math.max(d, Math.abs(z) - 0.2);
    };
    const channel = roundBox([0, 0.86, 0], [0.34, 0.025, 0.08], 0.01);
    return scaled({ body: union(subtract(block, arches), channel), accent: pedestal(0.36, 0.12), bounds: B }, 0.74);
  },
  krater: () => {
    const bowl = revolve([[0.08, 0.14], [0.06, 0.2], [0.09, 0.3], [0.2, 0.42], [0.24, 0.56], [0.24, 0.66], [0.29, 0.72], [0.28, 0.74]], 2);
    const inner = (x: number, y: number, z: number) => Math.max(Math.hypot(x, z) - 0.21, 0.5 - y);
    const volute = (x: number, y: number, z: number) => Math.hypot(Math.hypot(Math.abs(x) - 0.29, y - 0.58) - 0.06, z) - 0.02;
    const vol = intersect(volute, (x) => 0.23 - Math.abs(x));
    const band = torusY(0.5, 0.235, 0.014);
    return { body: union(smoothSubtract(0.01, bowl, inner), vol), accent: union(band, pedestal(0.18)), bounds: B };
  },
  wheel: () => {
    const rim = (x: number, y: number, z: number) => Math.hypot(Math.hypot(x, y - 0.56) - 0.3, z) - 0.03;
    const hub = (x: number, y: number, z: number) => Math.max(Math.hypot(x, y - 0.56) - 0.06, Math.abs(z) - 0.06);
    const spokes = (x: number, y: number, z: number) => {
      let d = Infinity;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        d = Math.min(d, capsule([0, 0.56, 0], [Math.cos(a) * 0.29, 0.56 + Math.sin(a) * 0.29, 0], 0.016)(x, y, z));
      }
      return d;
    };
    const stand = roundBox([0, 0.16, 0], [0.08, 0.06, 0.05], 0.015);
    const palm = (x: number, y: number, z: number) => Math.max(Math.hypot(Math.hypot(x, y - 0.56) - 0.2, z - 0.035) - 0.012, 0.56 - y);
    return { body: union(rim, hub, spokes, stand), accent: union(palm, pedestal(0.2, 0.1)), bounds: B };
  },
  scroll: () => {
    // unrolled papyrus between two rods, on a lectern
    const sheet = (x: number, y: number, z: number) => roundBox([0, 0.6, 0.02 * Math.sin(y * 18)], [0.18, 0.2, 0.006], 0.004)(x, y, z - 0.02 * Math.sin(y * 18));
    const rods = union(capsule([-0.24, 0.82, 0], [0.24, 0.82, 0], 0.035), capsule([-0.24, 0.38, 0], [0.24, 0.38, 0], 0.035));
    const knobs = union(sphere(0.26, 0.82, 0, 0.04), sphere(-0.26, 0.82, 0, 0.04), sphere(0.26, 0.38, 0, 0.04), sphere(-0.26, 0.38, 0, 0.04));
    const post = capsule([0, 0.1, -0.05], [0, 0.36, -0.05], 0.03);
    return { body: union(rods, knobs, post), accent: union(sheet, pedestal(0.2)), bounds: B };
  },
  temple: () => {
    const podium = roundBox([0, 0.2, 0], [0.32, 0.05, 0.2], 0.01);
    const cols = union(...[-0.26, -0.13, 0, 0.13, 0.26].map((cx) => capsule([cx, 0.25, 0.14], [cx, 0.62, 0.14], 0.03)));
    const cella = roundBox([0, 0.44, -0.05], [0.26, 0.19, 0.12], 0.01);
    const entab = roundBox([0, 0.66, 0], [0.32, 0.035, 0.2], 0.01);
    const pediment = intersect(roundBox([0, 0.76, 0], [0.33, 0.08, 0.2], 0.01), (x, y) => Math.abs(x) * 0.42 + (y - 0.82));
    const acro = sphere(0, 0.84, 0.05, 0.035);
    return scaled({ body: union(podium, cols, cella, entab, pediment), accent: union(acro, pedestal(0.36, 0.15)), bounds: B }, 0.74);
  },
  dome: () => {
    const drum = revolve([[0.3, 0.14], [0.3, 0.42], [0.31, 0.44], [0.31, 0.46]], 1);
    const domeS = intersect(ellipsoid([0, 0.46, 0], [0.29, 0.29, 0.29]), (_x, y) => 0.46 - y);
    const oculus = (x: number, y: number, z: number) => Math.max(Math.hypot(x, z) - 0.06, 0.6 - y);
    const steps = union(torusY(0.62, 0.22, 0.012), torusY(0.68, 0.17, 0.012));
    const portico = union(roundBox([0, 0.3, 0.3], [0.16, 0.16, 0.05], 0.01), intersect(roundBox([0, 0.5, 0.3], [0.17, 0.05, 0.05], 0.01), (x, y) => Math.abs(x) * 0.5 + (y - 0.54)));
    const columns = union(...[-0.12, -0.04, 0.04, 0.12].map((cx) => capsule([cx, 0.15, 0.36], [cx, 0.44, 0.36], 0.018)));
    return scaled({ body: union(drum, subtract(domeS, oculus), steps, columns), accent: union(portico, pedestal(0.34, 0.14)), bounds: B }, 0.74);
  },
  pinecone: () => {
    // the pigna of a Roman garden fountain
    const cone = ellipsoid([0, 0.58, 0], [0.15, 0.27, 0.15]);
    const scales = (x: number, y: number, z: number) => {
      const a = Math.atan2(z, x);
      const bumps = 0.012 * Math.sin(a * 10 + y * 40) * Math.sin(y * 48);
      return cone(x, y, z) - bumps;
    };
    const tip = sphere(0, 0.86, 0, 0.03);
    const bowl = revolve([[0.08, 0.14], [0.06, 0.22], [0.2, 0.3], [0.26, 0.36], [0.25, 0.37]], 2);
    const leaves = polarY(6, ellipsoid([0.17, 0.36, 0], [0.09, 0.03, 0.04]));
    return { body: smoothUnion(0.01, scales, tip), accent: union(bowl, leaves, pedestal(0.2)), bounds: B };
  },
  radiate: () => {
    // Nero's radiate sun crown on a cushion
    const band = revolve([[0.2, 0.4], [0.215, 0.42], [0.215, 0.5], [0.2, 0.52]], 1);
    const hollow = (x: number, y: number, z: number) => Math.max(Math.hypot(x, z) - 0.18, Math.abs(y - 0.46) - 0.1);
    const rays = polarY(12, (x, y, z) => capsule([0.205, 0.5, 0], [0.27, 0.86, 0], 0.03, 0.004)(x, y, z));
    const sun = (x: number, y: number, z: number) => Math.max(Math.hypot(x, y - 0.46, z - 0.21) - 0.05, -z);
    const cushion = smoothUnion(0.04, ellipsoid([0, 0.33, 0], [0.26, 0.09, 0.26]), revolve([[0.14, 0.1], [0.11, 0.16], [0.12, 0.26]]));
    return { body: smoothUnion(0.015, subtract(band, hollow), rays), accent: union(sun, cushion, pedestal(0.22)), bounds: B };
  },
  victory: () => {
    // winged Victory: wings raised behind an orb carrying a wreath
    const orb = sphere(0, 0.36, 0, 0.13);
    const figure = smoothUnion(0.04, capsule([0, 0.48, 0], [0, 0.7, 0], 0.06, 0.04), sphere(0, 0.76, 0.01, 0.045));
    const wing = (x: number, y: number, z: number) => {
      const ax = Math.abs(x);
      return rotZ(ellipsoid([0.2, 0.74, -0.06], [0.2, 0.085, 0.03]), 0.7, [0.04, 0.64, -0.06])(ax, y, z);
    };
    const arm = capsule([0.03, 0.68, 0.02], [0.08, 0.86, 0.04], 0.018);
    const wreath = (x: number, y: number, z: number) => laurelRing(0, 0.06, 10, 0.02)(x - 0.08, z - 0.04, y - 0.9);
    return { body: smoothUnion(0.03, figure, wing, arm), accent: union(orb, wreath, pedestal(0.18)), bounds: B };
  },

  // ---- v0.4: dedicated art for the v0.3 regional / qualifier / masters / historical defs
  plate: () => {
    // Provincial Open Plate: a patera on a plate stand, tilted back; regional enamel band, beaded rim, boss
    const C: Vec3 = [0, 0.52, 0];
    const dish = (x: number, y: number, z: number) => {
      const r = Math.hypot(x, y - C[1]);
      const shell = Math.abs(Math.hypot(x, y - C[1], z - 0.95) - 0.97) - 0.016;
      return Math.max(shell, r - 0.27);
    };
    const rim = (x: number, y: number, z: number) => Math.hypot(Math.hypot(x, y - C[1]) - 0.27, z - 0.035) - 0.022;
    const beads = (x: number, y: number, z: number) => {
      const a = Math.atan2(y - C[1], x), k = Math.round(a / (Math.PI / 14)) * (Math.PI / 14);
      return Math.hypot(x - Math.cos(k) * 0.235, y - C[1] - Math.sin(k) * 0.235, z - 0.03) - 0.014;
    };
    const boss = ellipsoid([0, C[1], 0.0], [0.065, 0.065, 0.04]);
    const band = (x: number, y: number, z: number) => Math.max(Math.abs(Math.hypot(x, y - C[1]) - 0.16) - 0.035, Math.abs(z - 0.012) - 0.008);
    const tilt = (f: SDF): SDF => rotX(f, -0.62, C);
    const easel = union(capsule([0, 0.12, -0.06], [0, 0.42, -0.13], 0.022), capsule([-0.12, 0.13, 0.12], [-0.17, 0.3, 0.11], 0.016), capsule([0.12, 0.13, 0.12], [0.17, 0.3, 0.11], 0.016));
    return { body: union(tilt(smoothUnion(0.01, dish, rim, boss)), tilt(beads), easel), accent: union(tilt(band), pedestal(0.2, 0.1)), bounds: B };
  },
  kylix: () => {
    // Provincial Open Cup: wide shallow kylix on a slender stem, horizontal loop handles, enamel band
    const bowl = revolve([[0.05, 0.47], [0.1, 0.5], [0.2, 0.56], [0.28, 0.63], [0.31, 0.67], [0.3, 0.69]], 2);
    const inner = (x: number, y: number, z: number) => Math.max(Math.hypot(x, z) - 0.285, 0.58 - y);
    const cavity = intersect(sphere(0, 0.98, 0, 0.42), inner);
    const stem = revolve([[0.15, 0.12], [0.1, 0.15], [0.04, 0.2], [0.03, 0.3], [0.05, 0.33], [0.03, 0.36], [0.035, 0.46], [0.08, 0.49]]);
    const handle = (x: number, y: number, z: number) => Math.hypot(Math.hypot(Math.abs(x) - 0.3, z) - 0.065, y - 0.62) - 0.018;
    const handles = intersect(handle, (x) => 0.29 - Math.abs(x));
    const band = (x: number, y: number, z: number) => {
      const d = bowl(x, y, z);
      return Math.max(d - 0.008, Math.abs(y - 0.585) - 0.02, -d - 0.02);
    };
    return { body: union(smoothSubtract(0.01, bowl, cavity), smoothUnion(0.02, stem, handles)), accent: union(band, pedestal(0.19, 0.12)), bounds: B };
  },
  wolf: () => {
    // The Capitoline Wolf: standing she-wolf, head turned, the twins beneath, on a marble plinth
    const body = smoothUnion(0.06,
      ellipsoid([-0.03, 0.52, 0], [0.19, 0.075, 0.07]),
      ellipsoid([0.1, 0.53, 0], [0.1, 0.1, 0.085]),
      capsule([0.15, 0.56, 0], [0.22, 0.67, 0.02], 0.055, 0.045),
    );
    const head = smoothUnion(0.03, ellipsoid([0.24, 0.69, 0.03], [0.06, 0.05, 0.052]), capsule([0.27, 0.68, 0.04], [0.35, 0.645, 0.06], 0.032, 0.017));
    const ears = union(capsule([0.22, 0.72, 0.0], [0.205, 0.79, -0.01], 0.02, 0.004), capsule([0.24, 0.72, 0.06], [0.235, 0.79, 0.075], 0.02, 0.004));
    const legs = union(
      capsule([0.12, 0.48, 0.045], [0.15, 0.25, 0.05], 0.03, 0.019), capsule([0.1, 0.48, -0.045], [0.08, 0.25, -0.05], 0.03, 0.019),
      capsule([-0.15, 0.49, 0.045], [-0.13, 0.25, 0.05], 0.036, 0.019), capsule([-0.16, 0.49, -0.045], [-0.2, 0.25, -0.05], 0.036, 0.019),
    );
    const tail = capsule([-0.21, 0.53, 0], [-0.31, 0.38, 0.01], 0.022, 0.012);
    // mane: rows of curls along the neck (the statue's stylised locks)
    const mane = (x: number, y: number, z: number) => {
      let d = Infinity;
      for (let i = 0; i < 5; i++) for (const s of [-1, 1]) d = Math.min(d, sphere(0.1 + i * 0.03, 0.6 + i * 0.025, s * 0.05, 0.022)(x, y, z));
      return d;
    };
    const teats = union(...[-0.06, 0, 0.06].map((tx) => sphere(tx, 0.45, 0.02, 0.014)));
    const twin = (cx: number, cz: number, lean: number): SDF => smoothUnion(0.02,
      ellipsoid([cx, 0.3, cz], [0.032, 0.045, 0.03]), sphere(cx + lean, 0.36, cz, 0.026),
      capsule([cx, 0.33, cz], [cx + lean * 1.4, 0.4, cz + 0.01], 0.01),
    );
    const plinth = roundBox([0, 0.15, 0], [0.33, 0.11, 0.13], 0.02);
    const step = roundBox([0, 0.27, 0], [0.3, 0.015, 0.11], 0.01);
    return { body: union(smoothUnion(0.03, body, head, legs, tail), ears, mane, teats, twin(0.0, 0.07, 0.01), twin(-0.07, -0.02, -0.01), step), accent: plinth, bounds: B };
  },
  kantharos: () => {
    // The Vesuvian Cup: tall-handled kantharos with a vine band, its lid a smoking Vesuvius
    const bowl = revolve([[0.14, 0.12], [0.08, 0.16], [0.045, 0.22], [0.05, 0.28], [0.1, 0.32], [0.19, 0.4], [0.22, 0.5], [0.21, 0.6], [0.23, 0.63], [0.22, 0.64]], 2);
    const lid = revolve([[0.215, 0.63], [0.2, 0.655], [0.15, 0.69], [0.1, 0.77], [0.075, 0.84], [0.07, 0.85]], 1);
    const crater = sphere(0, 0.89, 0, 0.06);
    const handle = (x: number, y: number, z: number) => Math.hypot(Math.hypot(Math.abs(x) - 0.235, y - 0.6) - 0.12, z) - 0.022;
    const handles = intersect(handle, (x) => 0.2 - Math.abs(x));
    const grapes = (x: number, y: number, z: number) => {
      let d = Infinity;
      for (const [dy, r] of [[0, 0.0], [-0.025, 0.012], [-0.025, -0.012], [-0.048, 0]] as const) d = Math.min(d, sphere(0.218, 0.5 + dy, r, 0.016)(x, y, z));
      return d;
    };
    const vine = union(polarY(8, grapes, Math.PI / 8), torusY(0.53, 0.222, 0.008), polarY(8, ellipsoid([0.222, 0.53, 0], [0.012, 0.03, 0.04])));
    const smoke = smoothUnion(0.03, ellipsoid([0, 0.865, 0], [0.05, 0.03, 0.05]), sphere(0.02, 0.9, -0.01, 0.036), sphere(0.05, 0.94, -0.02, 0.03), sphere(0.085, 0.97, -0.03, 0.022));
    return { body: union(smoothUnion(0.015, bowl, handles), subtract(lid, crater), vine), accent: union(smoke, pedestal(0.18, 0.11)), bounds: B };
  },
  lituus: () => {
    // The Augur's Lituus: the curved augural staff with a perched bird, set in a black bucchero stand
    const staff = capsule([0, 0.3, 0], [0, 0.72, 0], 0.03, 0.026);
    const spiral = (x: number, y: number, z: number) => {
      let d = Infinity;
      const C: [number, number] = [0.11, 0.72];
      let px = 0, py = 0.72;
      const N = 40;
      for (let i = 1; i <= N; i++) {
        const t = i / N, th = Math.PI - t * Math.PI * 2.6, r = 0.11 * (1 - t * 0.68);
        const nx = C[0] + Math.cos(th) * r, ny = C[1] + Math.sin(th) * r;
        d = Math.min(d, capsule([px, py, 0], [nx, ny, 0], 0.026 - t * 0.012)(x, y, z));
        px = nx; py = ny;
      }
      return d;
    };
    const bird = smoothUnion(0.015, ellipsoid([0.11, 0.875, 0], [0.045, 0.028, 0.026]), sphere(0.15, 0.9, 0, 0.02), capsule([0.07, 0.87, 0], [0.03, 0.89, 0], 0.014, 0.006));
    const beak = capsule([0.165, 0.9, 0], [0.19, 0.895, 0], 0.007, 0.002);
    const bands = union(torusY(0.36, 0.034, 0.012), torusY(0.66, 0.03, 0.01));
    const stand = revolve([[0.21, 0], [0.21, 0.03], [0.17, 0.06], [0.1, 0.1], [0.08, 0.14], [0.15, 0.2], [0.17, 0.25], [0.12, 0.3], [0.05, 0.31]], 2);
    const studs = polarY(10, sphere(0.168, 0.225, 0, 0.012));
    return { body: union(smoothUnion(0.01, staff, spiral), bird, beak, bands, studs), accent: stand, bounds: B };
  },
  torc: () => {
    // The Golden Torc: thick three-strand twisted torc with boar-head terminals, laid on a cushion
    const R = 0.22;
    const ring: SDF = (x, y, z) => {
      const a = Math.atan2(z, x);
      const q = Math.hypot(x, z) - R;
      let d = Infinity;
      for (let k = 0; k < 3; k++) {
        const ph = a * 9 + (k * Math.PI * 2) / 3;
        d = Math.min(d, Math.hypot(q - 0.02 * Math.cos(ph), y - 0.02 * Math.sin(ph)) - 0.021);
      }
      const gap = Math.abs(a - Math.PI / 2);
      return gap < 0.55 ? Math.max(d, (0.55 - gap) * R) : d;
    };
    const term = (s: number): SDF => {
      const a = Math.PI / 2 + s * 0.6, cx = Math.cos(a) * R, cz = Math.sin(a) * R;
      const snout = capsule([cx, 0, cz], [cx - s * 0.05, 0.0, cz + 0.035], 0.04, 0.026);
      const ear = capsule([cx - s * 0.01, 0.035, cz], [cx - s * 0.02, 0.07, cz - 0.01], 0.013, 0.003);
      return smoothUnion(0.02, sphere(cx, 0, cz, 0.062), snout, ear);
    };
    const local = union(ring, term(1), term(-1));
    const placed: SDF = (x, y, z) => local(x, y - 0.5, z);
    const torc = rotX(placed, 0.95, [0, 0.5, 0]);
    const cushion = smoothUnion(0.05, ellipsoid([0, 0.27, 0], [0.27, 0.085, 0.2]), revolve([[0.15, 0.1], [0.11, 0.14], [0.12, 0.22]]));
    const tassels = union(...[[0.25, 0.18], [-0.25, 0.18]].map(([tx]) => smoothUnion(0.01, sphere(tx, 0.25, 0.14, 0.02), capsule([tx, 0.24, 0.14], [tx, 0.18, 0.15], 0.012, 0.018))));
    const post = capsule([0, 0.3, -0.04], [0, 0.42, -0.06], 0.03);
    void tassels;
    return { body: union(torc, post), accent: union(cushion, pedestal(0.2, 0.1)), bounds: B };
  },
  bull: () => {
    // The Silver of Baetica: a bull's head with lyre horns on a silver column, wreathed in olive
    const skull = smoothUnion(0.04, ellipsoid([0, 0.68, 0.02], [0.095, 0.1, 0.08]), ellipsoid([0, 0.56, 0.05], [0.07, 0.08, 0.065]));
    const muzzle = ellipsoid([0, 0.5, 0.075], [0.065, 0.045, 0.05]);
    const nostrils = union(sphere(0.025, 0.49, 0.12, 0.012), sphere(-0.025, 0.49, 0.12, 0.012));
    const horn = (x: number, y: number, z: number) => {
      const ax = Math.abs(x);
      let d = Infinity;
      let p: Vec3 = [0.07, 0.73, 0.01];
      for (let i = 1; i <= 14; i++) {
        const t = i / 14;
        const n: Vec3 = [0.07 + Math.sin(t * 1.7) * 0.17, 0.73 + t * 0.04 + t * t * 0.17, 0.01 + Math.sin(t * 2.5) * 0.05];
        d = Math.min(d, capsule(p, n, 0.036 * (1 - t * 0.8))(ax, y, z));
        p = n;
      }
      return d;
    };
    const ears = (x: number, y: number, z: number) => rotZ(ellipsoid([0.12, 0.68, 0.0], [0.05, 0.022, 0.03]), -0.35, [0.1, 0.68, 0])(Math.abs(x), y, z);
    const forelock = polarY(5, sphere(0.04, 0.765, 0, 0.022));
    const eyes = union(sphere(0.06, 0.64, 0.075, 0.016), sphere(-0.06, 0.64, 0.075, 0.016));
    const column = revolve([[0.15, 0.12], [0.11, 0.15], [0.085, 0.18], [0.075, 0.38], [0.1, 0.42], [0.1, 0.44]], 1);
    const flutes = polarY(12, capsule([0.084, 0.2, 0], [0.084, 0.36, 0], 0.011));
    const olive = (x: number, y: number, z: number) => laurelRing(0.4, 0.105, 12, 0.03, 0.5)(x, y, z);
    const berries = polarY(6, sphere(0.125, 0.39, 0, 0.012), 0.3);
    return { body: union(smoothUnion(0.03, skull, muzzle, ears, forelock), horn, eyes, nostrils, subtract(column, flutes)), accent: union(olive, berries, pedestal(0.2, 0.12)), bounds: B };
  },
  lion: () => {
    // The Lion of Carthage: couchant lion beneath a date palm, on a porphyry plinth
    const torso = smoothUnion(0.05, ellipsoid([-0.02, 0.37, 0], [0.19, 0.075, 0.08]), ellipsoid([-0.15, 0.37, 0], [0.08, 0.08, 0.085]));
    const mane = (x: number, y: number, z: number) => {
      const base = ellipsoid([0.13, 0.46, 0.01], [0.1, 0.11, 0.1])(x, y, z);
      const a = Math.atan2(y - 0.46, x - 0.13), b = Math.atan2(z, x - 0.13);
      return base - 0.012 * Math.sin(a * 9) * Math.sin(b * 7);
    };
    const face = smoothUnion(0.02, ellipsoid([0.2, 0.45, 0.02], [0.055, 0.06, 0.055]), capsule([0.22, 0.43, 0.025], [0.27, 0.42, 0.03], 0.034, 0.03));
    const ears = union(sphere(0.18, 0.53, 0.06, 0.018), sphere(0.18, 0.53, -0.04, 0.018));
    const paws = union(capsule([0.08, 0.32, 0.05], [0.29, 0.3, 0.05], 0.03, 0.026), capsule([0.08, 0.32, -0.04], [0.27, 0.3, -0.04], 0.03, 0.026));
    const haunch = ellipsoid([-0.14, 0.34, 0.07], [0.08, 0.06, 0.03]);
    const tail = union(capsule([-0.22, 0.32, 0.03], [-0.12, 0.29, 0.1], 0.014), sphere(-0.11, 0.29, 0.1, 0.022));
    const trunk = (x: number, y: number, z: number) => {
      const d = capsule([-0.25, 0.27, -0.08], [-0.21, 0.84, -0.08], 0.03, 0.022)(x, y, z);
      return d - 0.006 * Math.sin(y * 70);
    };
    const frond = (a: number, len: number, droop: number): SDF => {
      const o: Vec3 = [-0.21, 0.85, -0.08];
      const m: Vec3 = [o[0] + Math.cos(a) * len * 0.55, o[1] + Math.sin(a) * len * 0.55 + 0.04, o[2]];
      const e: Vec3 = [o[0] + Math.cos(a) * len, o[1] + Math.sin(a) * len - droop, o[2] + 0.02];
      return union(capsule(o, m, 0.02, 0.016), capsule(m, e, 0.016, 0.004));
    };
    const fronds = union(frond(0.25, 0.22, 0.09), frond(Math.PI - 0.25, 0.2, 0.09), frond(0.95, 0.15, 0.02), frond(Math.PI - 1.0, 0.15, 0.02), frond(Math.PI / 2, 0.1, -0.01), frond(-0.2, 0.17, 0.1));
    const dates = union(sphere(-0.18, 0.81, -0.05, 0.02), sphere(-0.23, 0.8, -0.05, 0.02), sphere(-0.205, 0.78, -0.04, 0.02));
    const plinth = roundBox([0, 0.15, 0], [0.34, 0.12, 0.14], 0.02);
    const cornice = roundBox([0, 0.27, 0], [0.35, 0.012, 0.15], 0.008);
    return { body: union(smoothUnion(0.03, torso, mane, face, paws, haunch), ears, tail, trunk, fronds, dates, cornice), accent: plinth, bounds: B };
  },
  pharos: () => {
    // The Lamp of Pharos: three-stage lighthouse (square, octagonal, round) with the beacon fire
    const steps = union(roundBox([0, 0.04, 0], [0.26, 0.04, 0.2], 0.01), roundBox([0, 0.1, 0], [0.22, 0.03, 0.17], 0.01));
    const tier1 = (x: number, y: number, z: number) => {
      const t = (y - 0.13) / 0.3, w = 0.15 - t * 0.025;
      return Math.max(roundBox([0, 0.28, 0], [0.16, 0.15, 0.16], 0.01)(x, y, z), Math.abs(x) - w, Math.abs(z) - w);
    };
    const windows = union(...[0.2, 0.3, 0.38].map((wy) => roundBox([0, wy, 0.14], [0.018, 0.028, 0.03], 0.005)));
    const gallery1 = roundBox([0, 0.44, 0], [0.16, 0.014, 0.16], 0.006);
    const oct = (x: number, y: number, z: number) => {
      const a = Math.atan2(z, x), k = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
      const r = Math.hypot(x, z) * Math.cos(a - k);
      return Math.max(r - 0.095, Math.abs(y - 0.55) - 0.1);
    };
    const gallery2 = torusY(0.655, 0.09, 0.012);
    const drum = revolve([[0.065, 0.66], [0.065, 0.76], [0.08, 0.77], [0.08, 0.785]], 1);
    const lanternCols = polarY(6, capsule([0.06, 0.78, 0], [0.06, 0.86, 0], 0.01));
    const cap = revolve([[0.075, 0.86], [0.075, 0.875], [0.03, 0.9], [0.0, 0.905]], 1);
    const statue = smoothUnion(0.01, capsule([0, 0.905, 0], [0, 0.97, 0], 0.016, 0.012), sphere(0, 0.985, 0, 0.014));
    const fire = union(ellipsoid([0, 0.815, 0], [0.04, 0.05, 0.04]), ellipsoid([0.0, 0.84, 0.0], [0.025, 0.045, 0.025]));
    const lotus = polarY(8, ellipsoid([0.11, 0.48, 0], [0.04, 0.035, 0.02]), Math.PI / 8);
    return scaled({ body: union(steps, subtract(tier1, windows), gallery1, oct, gallery2, drum, lanternCols, cap, statue, lotus), accent: fire, bounds: B }, 1.0);
  },
  olive: () => {
    // The Olympian Olive: Ionic column carrying Athena's owl inside an olive crown (kotinos)
    const shaft = revolve([[0.16, 0.12], [0.12, 0.15], [0.1, 0.18], [0.085, 0.2], [0.075, 0.56], [0.085, 0.58]], 1);
    const flutes = polarY(16, capsule([0.077, 0.21, 0], [0.072, 0.55, 0], 0.01));
    const abacus = roundBox([0, 0.62, 0], [0.13, 0.018, 0.1], 0.006);
    const echinus = revolve([[0.08, 0.57], [0.1, 0.59], [0.11, 0.6]], 1);
    const volute = (x: number, y: number, z: number) => Math.hypot(Math.hypot(Math.abs(x) - 0.12, y - 0.585) - 0.03, Math.max(Math.abs(z) - 0.08, 0)) - 0.012;
    const owl = smoothUnion(0.03, ellipsoid([0, 0.73, 0], [0.065, 0.09, 0.06]), ellipsoid([0, 0.83, 0.005], [0.06, 0.05, 0.055]));
    const tufts = union(capsule([0.035, 0.86, 0], [0.05, 0.9, -0.005], 0.014, 0.004), capsule([-0.035, 0.86, 0], [-0.05, 0.9, -0.005], 0.014, 0.004));
    const eyes: SDF = (x, y, z) => Math.hypot(Math.hypot(Math.abs(x) - 0.024, y - 0.83) - 0.016, z - 0.05) - 0.006;
    const beak = capsule([0, 0.82, 0.05], [0, 0.8, 0.065], 0.008, 0.003);
    const wings = (x: number, y: number, z: number) => ellipsoid([0.05, 0.72, 0.0], [0.025, 0.07, 0.05])(Math.abs(x), y, z);
    const wreath = laurelRing(0.655, 0.12, 18, 0.034, 0.5);
    const olives = polarY(9, sphere(0.14, 0.645, 0, 0.012), 0.2);
    return { body: union(subtract(shaft, flutes), abacus, echinus, volute, smoothUnion(0.01, owl, tufts, wings), eyes, beak), accent: union(wreath, olives, pedestal(0.2, 0.12)), bounds: B };
  },
  scutum: () => {
    // Provincial Defender's Torque: an oval enamelled shield (scutum) with a torque hung over its boss
    const C = 0.55;
    const curve = (x: number, z: number) => z + (x * x) * 0.9;
    const face = (x: number, y: number, z: number) => Math.max(Math.hypot(x / 0.21, (y - C) / 0.33) - 1, Math.abs(curve(x, z)) - 0.02) * 0.2;
    const rim = (x: number, y: number, z: number) => {
      const e = Math.hypot(x / 0.21, (y - C) / 0.33);
      return Math.hypot((e - 1) * 0.24, curve(x, z) - 0.012) - 0.016;
    };
    const spine = capsule([0, C - 0.28, 0.022], [0, C + 0.28, 0.022], 0.014);
    const boss = ellipsoid([0, C, 0.03], [0.065, 0.075, 0.045]);
    const torque = (x: number, y: number, z: number) => {
      const a = Math.atan2(y - (C - 0.02), x);
      const d = Math.hypot(Math.hypot(x, y - (C - 0.02)) - 0.13, z - 0.06) - 0.02;
      return Math.abs(a + Math.PI / 2) < 0.4 ? Math.max(d, 0.02) : d;
    };
    const ends = union(...[1, -1].map((s) => sphere(Math.cos(-Math.PI / 2 + s * 0.42) * 0.13, C - 0.02 + Math.sin(-Math.PI / 2 + s * 0.42) * 0.13, 0.06, 0.034)));
    const stand = roundBox([0, 0.16, -0.06], [0.05, 0.1, 0.03], 0.01);
    return { body: union(rim, spine, boss, torque, ends, stand), accent: union(face, pedestal(0.2, 0.08)), bounds: B };
  },
  phalera: () => {
    // Provincial Finalist's Medal: a rosette phalera hung by ribbon from an arched stand
    const C = 0.48;
    const disc = (x: number, y: number, z: number) => Math.max(Math.hypot(x, y - C) - 0.17, Math.abs(z) - 0.025);
    const rim = (x: number, y: number, z: number) => Math.hypot(Math.hypot(x, y - C) - 0.17, z) - 0.024;
    const petal = (x: number, y: number, z: number) => {
      const a = Math.atan2(y - C, x), k = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
      const lx = (x) * Math.cos(k) + (y - C) * Math.sin(k) - 0.085, ly = -(x) * Math.sin(k) + (y - C) * Math.cos(k);
      return ellipsoid([0, 0, 0.025], [0.055, 0.03, 0.02])(lx, ly, z);
    };
    const centre = sphere(0, C, 0.03, 0.035);
    const posts = union(capsule([-0.27, 0.12, 0], [-0.27, 0.78, 0], 0.022), capsule([0.27, 0.12, 0], [0.27, 0.78, 0], 0.022));
    const arch = (x: number, y: number, z: number) => Math.max(Math.hypot(Math.hypot(x, y - 0.78) - 0.27, z) - 0.022, 0.78 - y);
    const finials = union(sphere(0.27, 0.12, 0, 0.035), sphere(-0.27, 0.12, 0, 0.035), sphere(0, 1.0, 0, 0.03));
    const ring = (x: number, y: number, z: number) => Math.hypot(Math.hypot(x, z) - 0.03, y - 0.97) - 0.01;
    const ribbon = (x: number, y: number, z: number) => Math.max(roundBox([0, 0.81, 0], [0.07, 0.15, 0.008], 0.006)(x, y, z), Math.abs(x) - (0.022 + (0.96 - y) * 0.16));
    const tails = union(capsule([0.0, 0.66, 0.0], [0.07, 0.6, -0.01], 0.02, 0.012), capsule([0.0, 0.66, 0.0], [-0.07, 0.6, -0.01], 0.02, 0.012));
    const base = roundBox([0, 0.05, 0], [0.33, 0.05, 0.1], 0.02);
    return { body: union(smoothUnion(0.008, disc, rim), petal, centre, posts, arch, finials, ring), accent: union(ribbon, tails, base), bounds: B };
  },
  ...Object.fromEntries([0, 1, 2, 3].map((k) => [`token${k}`, () => {
    // Qualifier's Token: an upright tessera with a suspension ring, raised border and k+1 tier studs
    const C = 0.53;
    const outline = (x: number, y: number) => {
      const box = Math.hypot(Math.max(Math.abs(x) - 0.1, 0), Math.max(Math.abs(y - (C - 0.045)) - 0.225, 0)) + Math.min(Math.max(Math.abs(x) - 0.1, Math.abs(y - (C - 0.045)) - 0.225), 0) - 0.02;
      return Math.min(Math.max(box, y - (C + 0.2)), Math.hypot(x, y - (C + 0.2)) - 0.12);
    };
    const tab = (x: number, y: number, z: number) => Math.max(outline(x, y), Math.abs(z) - 0.03);
    const border = (x: number, y: number, z: number) => Math.max(Math.abs(outline(x, y) + 0.024) - 0.011, Math.abs(z - 0.03) - 0.012);
    const hole = (x: number, y: number) => Math.hypot(x, y - (C + 0.22)) - 0.03;
    const ring = (x: number, y: number, z: number) => Math.hypot(Math.hypot(x, y - (C + 0.33)) - 0.05, z) - 0.014;
    const holder = union(roundBox([0, 0.2, 0], [0.16, 0.05, 0.09], 0.02), roundBox([0, 0.27, -0.045], [0.14, 0.03, 0.012], 0.006), roundBox([0, 0.27, 0.045], [0.14, 0.03, 0.012], 0.006));
    const studs = union(...Array.from({ length: k + 1 }, (_, i) => sphere(0, C + 0.1 - i * 0.09 - (3 - k) * 0.045, 0.035, 0.03)));
    const groove = roundBox([0, C - 0.21, 0.03], [0.08, 0.006, 0.01], 0.004);
    const t = subtract(subtract(tab, hole), groove);
    return { body: union(smoothUnion(0.006, t, border), ring, holder), accent: union(studs, pedestal(0.19, 0.15)), bounds: B };
  }])) as Record<string, () => TrophySculpt>,
  grandcup: () => {
    // The Imperial Masters Trophy: a covered two-handled urn crowned by an eagle, eight gems for the empire's top eight
    const urn = revolve([[0.12, 0.2], [0.07, 0.24], [0.05, 0.3], [0.09, 0.34], [0.17, 0.42], [0.2, 0.52], [0.19, 0.62], [0.14, 0.69], [0.15, 0.71]], 2);
    const lid = revolve([[0.15, 0.7], [0.15, 0.72], [0.11, 0.76], [0.05, 0.79], [0.04, 0.81]], 1);
    const handle = (x: number, y: number, z: number) => {
      const ax = Math.abs(x);
      const d = Math.hypot(Math.hypot(ax - 0.21, y - 0.62) - 0.1, z) - 0.02;
      return Math.max(d, 0.19 - ax);
    };
    const scroll = (x: number, y: number, z: number) => sphere(0.31, 0.62, 0, 0.032)(Math.abs(x), y, z);
    const eagleB = ellipsoid([0, 0.86, 0.01], [0.04, 0.055, 0.045]);
    const eagleH = smoothUnion(0.01, sphere(0, 0.93, 0.025, 0.026), capsule([0, 0.93, 0.045], [0, 0.915, 0.07], 0.01, 0.004));
    const wing = (x: number, y: number, z: number) => rotZ(ellipsoid([0.09, 0.9, -0.01], [0.08, 0.03, 0.02]), 0.7, [0.03, 0.86, 0])(Math.abs(x), y, z);
    const gems = polarY(8, sphere(0.198, 0.52, 0, 0.022));
    const band = torusY(0.52, 0.2, 0.01);
    const laurel = laurelRing(0.42, 0.17, 18, 0.03, 0.4);
    const plinth = union(roundBox([0, 0.06, 0], [0.24, 0.06, 0.2], 0.015), roundBox([0, 0.15, 0], [0.19, 0.035, 0.16], 0.012), revolve([[0.15, 0.18], [0.14, 0.2], [0.12, 0.21]], 1));
    return { body: union(smoothUnion(0.015, urn, handle), scroll, lid, smoothUnion(0.02, eagleB, eagleH, wing), band, laurel), accent: union(gems, plinth), bounds: B };
  },
  sprays: () => {
    // Laurel of the Province: two laurel branches crossed into an open wreath, tied with a ribbon
    const branch = (s: number): SDF => {
      const C: [number, number] = [0, 0.56], R = 0.23;
      const leaves: SDF[] = [];
      for (let i = 0; i < 11; i++) {
        const a = -Math.PI / 2 + 0.25 + i * 0.25;
        const lx = C[0] + s * Math.cos(a) * R, ly = C[1] + Math.sin(a) * R;
        const out = 0.04 * (i % 2 ? 1 : -1);
        const ox = lx + s * Math.cos(a) * out, oy = ly + Math.sin(a) * out;
        leaves.push(rotZ(ellipsoid([ox, oy, 0], [0.022, 0.045, 0.018]), s * a + (i % 2 ? -0.5 : 0.5) * s, [ox, oy, 0]));
      }
      const stem = (x: number, y: number, z: number) => Math.max(Math.hypot(Math.hypot(x, y - C[1]) - R, z) - 0.012, -s * x, y - (C[1] + R * 0.95));
      return union(stem, ...leaves);
    };
    const bow = union(ellipsoid([0.035, 0.335, 0.03], [0.035, 0.022, 0.015]), ellipsoid([-0.035, 0.335, 0.03], [0.035, 0.022, 0.015]), sphere(0, 0.335, 0.035, 0.018),
      capsule([0.01, 0.33, 0.03], [0.07, 0.24, 0.03], 0.012, 0.016), capsule([-0.01, 0.33, 0.03], [-0.07, 0.24, 0.03], 0.012, 0.016));
    const post = capsule([0, 0.12, -0.02], [0, 0.33, -0.02], 0.026);
    const berries = union(sphere(0.12, 0.83, 0.01, 0.016), sphere(-0.12, 0.83, 0.01, 0.016), sphere(0.2, 0.74, 0.01, 0.014), sphere(-0.2, 0.74, 0.01, 0.014));
    return { body: union(branch(1), branch(-1), post, berries), accent: union(bow, pedestal(0.18, 0.12)), bounds: B };
  },
  tabula: () => {
    // Breaker of Records: a tabula ansata (record tablet with dovetail handles) on an easel, enamelled field
    const C = 0.58;
    const slab = roundBox([0, C, 0], [0.24, 0.16, 0.025], 0.012);
    const ansa = (x: number, y: number, z: number) => {
      const ax = Math.abs(x) - 0.24;
      const tri = Math.max(-ax, ax * 1.2 - 0.1 + Math.abs(y - C) * 0.0, Math.abs(y - C) - (0.14 - ax * 1.1), Math.abs(z) - 0.025);
      return tri;
    };
    const rect2 = (x: number, y: number) => { const qx = Math.abs(x) - 0.19, qy = Math.abs(y - C) - 0.11; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - 0.015; };
    const frame = (x: number, y: number, z: number) => Math.max(Math.abs(rect2(x, y)) - 0.014, Math.abs(z - 0.03) - 0.012);
    const field = (x: number, y: number, z: number) => Math.max(rect2(x, y), Math.abs(z - 0.028) - 0.006);
    const lines = (x: number, y: number, z: number) => {
      let d = Infinity;
      for (const [ly, w] of [[0.07, 0.15], [0.025, 0.17], [-0.02, 0.17], [-0.065, 0.11]] as const) d = Math.min(d, capsule([-w, C + ly, 0.036], [w, C + ly, 0.036], 0.009)(x, y, z));
      return d;
    };
    const wreath = (x: number, y: number, z: number) => laurelRing(0, 0.055, 10, 0.02)(x, z - 0.03, y - (C + 0.21));
    const easel = union(capsule([-0.12, 0.13, 0.08], [-0.08, 0.44, 0.02], 0.02), capsule([0.12, 0.13, 0.08], [0.08, 0.44, 0.02], 0.02), capsule([0, 0.13, -0.14], [0, 0.6, -0.04], 0.02), roundBox([0, 0.42, 0.05], [0.2, 0.015, 0.03], 0.008));
    return { body: union(slab, ansa, frame, lines, wreath, easel), accent: union(field, pedestal(0.22, 0.1)), bounds: B };
  },
  stele: () => {
    // Provincial Dynasty: a tall stele with pediment and akroteria, four crowns for four title contests
    const shaft = (x: number, y: number, z: number) => {
      const w = 0.135 - (y - 0.15) * 0.04;
      return Math.max(roundBox([0, 0.48, 0], [0.16, 0.33, 0.045], 0.01)(x, y, z), Math.abs(x) - w);
    };
    const pediment = intersect(roundBox([0, 0.86, 0], [0.16, 0.06, 0.05], 0.008), (x, y) => Math.abs(x) * 0.55 + (y - 0.92));
    const akro = union(sphere(0, 0.93, 0.01, 0.028), sphere(0.15, 0.83, 0.01, 0.022), sphere(-0.15, 0.83, 0.01, 0.022));
    const panel = roundBox([0, 0.48, 0.044], [0.095, 0.29, 0.006], 0.004);
    const crowns = (x: number, y: number, z: number) => {
      let d = Infinity;
      for (const cy of [0.27, 0.41, 0.55, 0.69]) d = Math.min(d, Math.hypot(Math.hypot(x, y - cy) - 0.048, z - 0.055) - 0.013);
      return d;
    };
    const jewels = union(...[0.27, 0.41, 0.55, 0.69].map((cy) => sphere(0, cy, 0.055, 0.016)));
    const base = union(roundBox([0, 0.06, 0], [0.24, 0.06, 0.15], 0.015), roundBox([0, 0.135, 0], [0.2, 0.02, 0.12], 0.01));
    return { body: union(shaft, pediment, akro, crowns, base), accent: union(panel, jewels), bounds: B };
  },
  fallen: () => {
    // Giant Slayer: a giant's crested helmet toppled on its side, the victor's short sword planted beside it
    const helm = (x: number, y: number, z: number) => {
      // modelled upright about the origin, then laid on its side by lay()
      const shell = Math.min(Math.max(ellipsoid([0, 0, 0], [0.17, 0.19, 0.18])(x, y, z), -ellipsoid([0, -0.02, 0], [0.15, 0.17, 0.16])(x, y, z)), Math.max(Math.hypot(x, z) - 0.2, Math.abs(y + 0.1) - 0.012, -(Math.hypot(x, z) - 0.15)));
      const eye = Math.min(roundBox([0.06, -0.02, 0.15], [0.04, 0.018, 0.05], 0.01)(x, y, z), roundBox([-0.06, -0.02, 0.15], [0.04, 0.018, 0.05], 0.01)(x, y, z));
      const nose = roundBox([0, -0.06, 0.155], [0.014, 0.06, 0.02], 0.006)(x, y, z);
      return Math.min(Math.max(shell, -eye, -(y + 0.13)), nose);
    };
    const crest = (x: number, y: number, z: number) => Math.max(Math.abs(x) - 0.04, Math.hypot(y, z + 0.03) - 0.29, -y + 0.08);
    const lay = (f: SDF): SDF => (x, y, z) => {
      // rotate: helmet's +y axis points to -x (lying on its side), centred at (-0.08, 0.32, 0)
      const lx = x + 0.08, ly = y - 0.31;
      const c = Math.cos(-1.35), s = Math.sin(-1.35);
      return f(c * lx - s * ly, s * lx + c * ly, z);
    };
    const blade = (x: number, y: number, z: number) => {
      const t = Math.max(0, Math.min(1, (y - 0.25) / 0.45));
      const w = 0.032 * (1 - t * 0.4) * (t > 0.85 ? (1 - (t - 0.85) * 6) : 1);
      return Math.max(roundBox([0.27, 0.47, 0.05], [0.04, 0.23, 0.01], 0.004)(x, y, z), Math.abs(x - 0.27) - Math.max(0.002, w));
    };
    const blade2 = (x: number, y: number, z: number) => blade(x, 0.95 - y, z);
    const guard = roundBox([0.27, 0.72, 0.05], [0.065, 0.016, 0.03], 0.012);
    const grip = capsule([0.27, 0.74, 0.05], [0.27, 0.84, 0.05], 0.019);
    const pommel = sphere(0.27, 0.865, 0.05, 0.03);
    const ground = union(roundBox([0.02, 0.06, 0], [0.38, 0.06, 0.2], 0.03), ellipsoid([0.27, 0.13, 0.05], [0.07, 0.03, 0.06]));
    return { body: union(lay(helm), blade2, guard, pommel, ground), accent: union(lay(crest), grip), bounds: B };
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
/**
 * v0.3 signature trophies of the twelve new arenas (24-arena indexing), baked
 * as public/trophies/sig-a<arena>.webp so the twelve original sig-<n> files
 * (old indexing) keep their names.
 */
export const NEW_SIG: Record<number, TrophyLook & { name: string }> = {
  1: { name: 'Ludus Yard — Gladiator Helmet', model: 'helmet', metal: 'bronze', accent: '#a8302a' },
  3: { name: 'Rhine Frontier — Timber Fort', model: 'palisade', metal: 'wood', accent: '#b8302a' },
  5: { name: 'Harbour of Ostia — Anchor', model: 'anchor', metal: 'silver', accent: '#c9a35a' },
  7: { name: 'Aqueduct Heights — Aqueduct', model: 'arch', metal: 'silver', accent: '#d9cdb4' },
  9: { name: 'Imperial Baths — Krater', model: 'krater', metal: 'gold', accent: '#2e7d74' },
  11: { name: 'Circus Maximus — Chariot Wheel', model: 'wheel', metal: 'gold', accent: '#2f6a3a' },
  13: { name: 'Great Library — Scroll', model: 'scroll', metal: 'gold', accent: '#e8d9a8' },
  15: { name: 'Capitoline Temple — Temple', model: 'temple', metal: 'gold', accent: '#6e2a3c' },
  17: { name: 'Pantheon — Dome', model: 'dome', metal: 'silver', accent: '#d9b866' },
  19: { name: 'Villa of Tibur — Pigna', model: 'pinecone', metal: 'bronze', accent: '#3f6a3a' },
  21: { name: 'Golden House — Radiate Crown', model: 'radiate', metal: 'imperial', accent: '#7a1e22', glow: true },
  22: { name: 'Sanctum of Victory — Winged Victory', model: 'victory', metal: 'imperial', accent: '#f2e6c8', glow: true },
};
/**
 * v0.4: dedicated art for the 21 v0.3 definitions that used to reuse another
 * sprite (regional crowns, local opens, qualifiers, Masters, provincial and
 * historical honours). Baked as public/trophies/<defId>.webp.
 */
export const V4_ART: Record<string, TrophyLook & { name: string }> = {
  'lopen-lower': { name: 'Provincial Open Plate — bronze patera with regional band', model: 'plate', metal: 'bronze', accent: '#2f6f78' },
  'lopen-upper': { name: 'Provincial Open Cup — silver kylix with regional band', model: 'kylix', metal: 'silver', accent: '#2f6f78' },
  'rcrown-latium': { name: 'The Capitoline Wolf', model: 'wolf', metal: 'bronze', accent: '#8e2a30' },
  'rcrown-campania': { name: 'The Vesuvian Cup', model: 'kantharos', metal: 'gold', accent: '#a8321e' },
  'rcrown-etruria': { name: "The Augur's Lituus", model: 'lituus', metal: 'gold', accent: '#211c1c' },
  'rcrown-gallia': { name: 'The Golden Torc', model: 'torc', metal: 'gold', accent: '#1f4f6e' },
  'rcrown-hispania': { name: 'The Silver of Baetica', model: 'bull', metal: 'silver', accent: '#5f7a34' },
  'rcrown-africa': { name: 'The Lion of Carthage', model: 'lion', metal: 'gold', accent: '#6e2236' },
  'rcrown-aegyptus': { name: 'The Lamp of Pharos', model: 'pharos', metal: 'imperial', accent: '#ff8a2a', glow: true },
  'rcrown-achaea': { name: 'The Olympian Olive', model: 'olive', metal: 'silver', accent: '#5f7a34' },
  rdefense: { name: "Provincial Defender's Torque — scutum with torque", model: 'scutum', metal: 'silver', accent: '#2c5aa0' },
  rmedal: { name: "Provincial Finalist's Medal — rosette phalera", model: 'phalera', metal: 'silver', accent: '#9c1f2a' },
  'qual-t0': { name: "Qualifier's Token I", model: 'token0', metal: 'bronze', accent: '#9c1f1a' },
  'qual-t1': { name: "Qualifier's Token II", model: 'token1', metal: 'silver', accent: '#2c5aa0' },
  'qual-t2': { name: "Qualifier's Token III", model: 'token2', metal: 'gold', accent: '#1f6a4a' },
  'qual-t3': { name: "Qualifier's Token IV", model: 'token3', metal: 'imperial', accent: '#8e1c2c' },
  masters: { name: 'The Imperial Masters Trophy', model: 'grandcup', metal: 'imperial', accent: '#8e1c2c', glow: true },
  rlaurel: { name: 'Laurel of the Province', model: 'sprays', metal: 'silver', accent: '#2f6a3a' },
  'hist-record': { name: 'Breaker of Records — tabula ansata', model: 'tabula', metal: 'gold', accent: '#2c6aa8', glow: true },
  'hist-regional-dynasty': { name: 'Provincial Dynasty — stele of four crowns', model: 'stele', metal: 'gold', accent: '#2c6aa8', glow: true },
  'hist-giant-slayer': { name: "Giant Slayer — the giant's fallen helmet", model: 'fallen', metal: 'gold', accent: '#9c1c1c', glow: true },
};
const TIER_METAL: TrophyLook['metal'][] = ['bronze', 'silver', 'gold', 'imperial'];

export function trophyLook(defId: string, arena?: number, arenaTierIdx?: number): TrophyLook {
  if (V4_ART[defId]) return V4_ART[defId];
  if (defId.startsWith('sig-a')) return NEW_SIG[Number(defId.slice(5))] ?? SIG[0];
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
