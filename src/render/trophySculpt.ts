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
const TIER_METAL: TrophyLook['metal'][] = ['bronze', 'silver', 'gold', 'imperial'];

export function trophyLook(defId: string, arena?: number, arenaTierIdx?: number): TrophyLook {
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
