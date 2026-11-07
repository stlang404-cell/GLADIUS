import {
  type SDF, type Vec3, revolve, smoothUnion, union, sphere, ellipsoid, capsule, roundBox, torusY, subtract, smoothSubtract,
  intersect, polarY,
} from './sdf';

/**
 * GLADIUS default set — "Legio" — authored as signed distance fields.
 * Units: one board square = 1. y up, base centred at origin. Knights face +x.
 * Every piece = a body (ivory / ebony material) + an accent (gold).
 * Silhouettes follow Staunton proportions so pieces read instantly, with
 * Roman motifs on top: galea crest (pawn), bastion (rook), cavalry mane
 * (knight), augur's mitre (bishop), corona (queen), cross-orb crown (king).
 */

export type PieceSculpt = { body: SDF; accent: SDF | null; bounds: [Vec3, Vec3]; height: number };

const base = (top: number, r = 0.355): [number, number][] => [
  [r - 0.02, 0], [r, 0.012], [r, 0.045], [r - 0.025, 0.062], [r - 0.06, 0.075], [r - 0.045, 0.092], [r - 0.08, 0.112], [r - 0.1, top],
];

function rotZ(f: SDF, ang: number, pivot: Vec3): SDF {
  const c = Math.cos(-ang), s = Math.sin(-ang);
  return (x, y, z) => {
    const dx = x - pivot[0], dy = y - pivot[1];
    return f(pivot[0] + c * dx - s * dy, pivot[1] + s * dx + c * dy, z);
  };
}
/** Non-uniform squash along z (horse heads are narrow). Distance is conservatively rescaled. */
function squashZ(f: SDF, k: number): SDF {
  return (x, y, z) => f(x, y, z / k) * Math.min(1, k);
}
const halfSpaceAbove = (y0: number): SDF => (_x, y) => y0 - y;
const halfSpaceBelow = (y0: number): SDF => (_x, y) => y - y0;

export function pawn(): PieceSculpt {
  const body = smoothUnion(
    0.03,
    revolve([...base(0.13, 0.33), [0.2, 0.18], [0.14, 0.26], [0.105, 0.34], [0.125, 0.37], [0.17, 0.385], [0.17, 0.4], [0.1, 0.415]]),
    sphere(0, 0.5, 0, 0.125),
  );
  // Galea: helmet dome brim + transverse crest (worn front-to-back here for readability).
  const brim = torusY(0.475, 0.12, 0.022);
  // Crest: a fan-shaped plume standing on the helmet, running front to back.
  const crest = intersect(
    intersect((x, y) => Math.abs(Math.hypot(x, y - 0.49) - 0.155) - 0.05, (_x, _y, z) => Math.abs(z) - 0.026),
    halfSpaceAbove(0.53),
  );
  return { body, accent: union(brim, crest), bounds: [[-0.36, -0.01, -0.36], [0.36, 0.7, 0.36]], height: 0.69 };
}

export function rook(): PieceSculpt {
  const tower = revolve([...base(0.13), [0.235, 0.17], [0.205, 0.26], [0.195, 0.5], [0.215, 0.56], [0.255, 0.6], [0.255, 0.78]]);
  const hollow = (x: number, y: number, z: number) => Math.max(Math.hypot(x, z) - 0.17, 0.705 - y);
  const notches = polarY(5, roundBox([0.26, 0.79, 0], [0.12, 0.07, 0.045], 0.01));
  const door = capsule([0, 0.2, 0.2], [0, 0.33, 0.2], 0.05);
  const window = capsule([0, 0.43, 0.2], [0, 0.48, 0.2], 0.028);
  const body = smoothSubtract(0.012, subtract(subtract(tower, hollow), notches), union(door, window));
  const band = intersect(torusY(0.565, 0.222, 0.022), (x, y, z) => -1 + 0 * (x + y + z));
  return { body, accent: union(torusY(0.585, 0.233, 0.02), band), bounds: [[-0.37, -0.01, -0.37], [0.37, 0.82, 0.37]], height: 0.78 };
}

export function knight(): PieceSculpt {
  const pedestal = revolve([...base(0.13), [0.245, 0.17], [0.225, 0.22], [0.0, 0.24]]);
  const chest = squashZ(ellipsoid([0.05, 0.33, 0], [0.2, 0.14, 0.17]), 0.9);
  const neck = squashZ(capsule([-0.05, 0.27, 0], [0.0, 0.58, 0], 0.17, 0.125), 0.8);
  const crestOfNeck = squashZ(capsule([-0.1, 0.36, 0], [-0.04, 0.66, 0], 0.09, 0.08), 0.75);
  const skull = squashZ(rotZ(ellipsoid([0.09, 0.68, 0], [0.17, 0.11, 0.12]), -0.62, [0.09, 0.68, 0]), 0.85);
  const muzzle = squashZ(capsule([0.12, 0.64, 0], [0.31, 0.49, 0], 0.095, 0.072), 0.85);
  const cheek = ellipsoid([0.06, 0.6, 0], [0.12, 0.09, 0.095]);
  const ears = (x: number, y: number, z: number) => capsule([-0.01, 0.76, 0.05], [-0.05, 0.88, 0.06], 0.034, 0.01)(x, y, Math.abs(z));
  let head = smoothUnion(0.06, pedestal, chest, neck, crestOfNeck, cheek, skull, muzzle);
  head = smoothUnion(0.025, head, ears);
  const eyes = (x: number, y: number, z: number) => sphere(0.13, 0.7, 0.092, 0.026)(x, y, Math.abs(z));
  const nostrils = (x: number, y: number, z: number) => sphere(0.325, 0.51, 0.04, 0.021)(x, y, Math.abs(z));
  const mouth = rotZ(roundBox([0.29, 0.455, 0], [0.06, 0.007, 0.09], 0.004), -0.6, [0.29, 0.455, 0]);
  const body = smoothSubtract(0.014, head, union(eyes, nostrils, mouth));
  // Gold cavalry mane: plume lobes hugging the arched back of the neck, plus a forelock.
  const manePath: [number, number][] = [[-0.165, 0.36], [-0.16, 0.45], [-0.145, 0.54], [-0.115, 0.625], [-0.075, 0.7], [-0.03, 0.765]];
  const lobes: SDF[] = manePath.map(([cx, cy]) => ellipsoid([cx, cy, 0], [0.05, 0.055, 0.036]));
  const forelock = ellipsoid([0.03, 0.8, 0], [0.04, 0.035, 0.035]);
  const mane = smoothUnion(0.03, ...lobes, forelock);
  const collar = torusY(0.2, 0.232, 0.018);
  return { body, accent: union(mane, collar), bounds: [[-0.38, -0.01, -0.38], [0.38, 0.95, 0.38]], height: 0.9 };
}

export function bishop(): PieceSculpt {
  const stem = revolve([...base(0.13), [0.2, 0.18], [0.14, 0.27], [0.1, 0.42], [0.09, 0.54], [0.16, 0.565], [0.16, 0.585], [0.09, 0.6]]);
  const headProfile = revolve([[0.0, 0.58], [0.1, 0.6], [0.145, 0.66], [0.155, 0.72], [0.14, 0.79], [0.1, 0.86], [0.05, 0.91], [0.0, 0.93]]);
  const slit = rotZ(roundBox([0.07, 0.8, 0], [0.12, 0.016, 0.3], 0.006), 0.75, [0.07, 0.8, 0]);
  const body = smoothSubtract(0.008, smoothUnion(0.025, stem, headProfile), slit);
  const tip = sphere(0, 0.95, 0, 0.038);
  const laurel = torusY(0.665, 0.148, 0.02);
  const collar = torusY(0.575, 0.162, 0.017);
  return { body, accent: union(tip, laurel, collar), bounds: [[-0.36, -0.01, -0.36], [0.36, 1.0, 0.36]], height: 0.99 };
}

export function queen(): PieceSculpt {
  const body = revolve([
    ...base(0.13, 0.365), [0.23, 0.18], [0.16, 0.3], [0.115, 0.48], [0.1, 0.62], [0.17, 0.645], [0.17, 0.67], [0.11, 0.69],
    [0.13, 0.74], [0.19, 0.84], [0.21, 0.9], [0.15, 0.92], [0.09, 0.96], [0.0, 0.98],
  ]);
  const points = polarY(9, capsule([0.2, 0.88, 0], [0.235, 0.985, 0], 0.03, 0.016));
  const pearls = polarY(9, sphere(0.238, 1.0, 0, 0.03));
  const band = torusY(0.885, 0.205, 0.024);
  const orb = sphere(0, 1.04, 0, 0.055);
  const collar = torusY(0.66, 0.172, 0.018);
  return { body: smoothUnion(0.02, body, sphere(0, 0.95, 0, 0.1)), accent: union(smoothUnion(0.015, band, points), pearls, orb, collar), bounds: [[-0.38, -0.01, -0.38], [0.38, 1.12, 0.38]], height: 1.1 };
}

export function king(): PieceSculpt {
  const body = revolve([
    ...base(0.13, 0.37), [0.235, 0.18], [0.165, 0.32], [0.12, 0.52], [0.11, 0.68], [0.18, 0.705], [0.18, 0.73], [0.12, 0.75],
    [0.15, 0.8], [0.2, 0.92], [0.2, 0.97], [0.14, 1.0], [0.08, 1.02], [0.0, 1.03],
  ]);
  // Laurel crown: a band of leaf lobes around the brow.
  const leaves = polarY(14, ellipsoid([0.205, 0.94, 0], [0.025, 0.05, 0.03]));
  const band = torusY(0.925, 0.2, 0.02);
  const crossV = roundBox([0, 1.15, 0], [0.032, 0.115, 0.032], 0.012);
  const crossH = roundBox([0, 1.17, 0], [0.095, 0.03, 0.03], 0.012);
  const orb = sphere(0, 1.05, 0, 0.06);
  const collar = torusY(0.715, 0.182, 0.018);
  const accent = union(smoothUnion(0.02, band, leaves), smoothUnion(0.02, orb, crossV, crossH), collar);
  return { body, accent, bounds: [[-0.39, -0.01, -0.39], [0.39, 1.29, 0.39]], height: 1.27 };
}

export const SCULPTS: Record<string, () => PieceSculpt> = { p: pawn, n: knight, b: bishop, r: rook, q: queen, k: king };
// Unused helpers kept for future collections.
export const _helpers = { halfSpaceBelow };
