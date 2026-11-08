import * as THREE from 'three';

/**
 * Tiny signed-distance-field sculpting kit + Naive Surface Nets mesher.
 * Pieces are authored as smooth unions of primitives (and revolved 2D
 * profiles), then polygonised once at startup. Normals come from the SDF
 * gradient, so surfaces shade smoothly with no faceting.
 */

export type Vec3 = [number, number, number];
export type SDF = (x: number, y: number, z: number) => number;

export const sphere = (cx: number, cy: number, cz: number, r: number): SDF => (x, y, z) => Math.hypot(x - cx, y - cy, z - cz) - r;

export function ellipsoid(c: Vec3, r: Vec3): SDF {
  // Inigo Quilez's bound-corrected ellipsoid approximation.
  return (x, y, z) => {
    const px = (x - c[0]) / r[0], py = (y - c[1]) / r[1], pz = (z - c[2]) / r[2];
    const k0 = Math.hypot(px, py, pz);
    const k1 = Math.hypot(px / r[0], py / r[1], pz / r[2]);
    return k1 === 0 ? -Math.min(...r) : (k0 * (k0 - 1)) / k1;
  };
}

export function capsule(a: Vec3, b: Vec3, ra: number, rb = ra): SDF {
  const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
  const l2 = bax * bax + bay * bay + baz * baz;
  return (x, y, z) => {
    const pax = x - a[0], pay = y - a[1], paz = z - a[2];
    const h = Math.max(0, Math.min(1, (pax * bax + pay * bay + paz * baz) / l2));
    const dx = pax - bax * h, dy = pay - bay * h, dz = paz - baz * h;
    return Math.hypot(dx, dy, dz) - (ra + (rb - ra) * h);
  };
}

export function roundBox(c: Vec3, half: Vec3, r: number, rotY = 0): SDF {
  const cs = Math.cos(rotY), sn = Math.sin(rotY);
  return (x, y, z) => {
    let px = x - c[0];
    const py = y - c[1];
    let pz = z - c[2];
    if (rotY) {
      const t = cs * px - sn * pz;
      pz = sn * px + cs * pz;
      px = t;
    }
    const qx = Math.abs(px) - half[0] + r, qy = Math.abs(py) - half[1] + r, qz = Math.abs(pz) - half[2] + r;
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
  };
}

export function torusY(cy: number, R: number, r: number): SDF {
  return (x, y, z) => Math.hypot(Math.hypot(x, z) - R, y - cy) - r;
}

/** Revolve a closed 2D profile (r ≥ 0, y) around the Y axis. Points ordered bottom→top along the outside. */
export function revolve(profile: [number, number][], smoothing = 2): SDF {
  // Chaikin-round the outline so sharp profile corners don't alias on the grid.
  let pts = profile;
  for (let s = 0; s < smoothing; s++) {
    const out: [number, number][] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      out.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1], [0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  // Close the polygon along the axis.
  const poly: [number, number][] = [[0, pts[0][1]], ...pts, [0, pts[pts.length - 1][1]]];
  const n = poly.length;
  return (x, y, z) => {
    const px = Math.hypot(x, z);
    const py = y;
    let d = Infinity;
    let inside = false;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const [ax, ay] = poly[j];
      const [bx, by] = poly[i];
      const ex = bx - ax, ey = by - ay;
      const wx = px - ax, wy = py - ay;
      const t = Math.max(0, Math.min(1, (wx * ex + wy * ey) / (ex * ex + ey * ey || 1)));
      const dx = wx - ex * t, dy = wy - ey * t;
      d = Math.min(d, dx * dx + dy * dy);
      if ((ay > py) !== (by > py) && px < ((bx - ax) * (py - ay)) / (by - ay) + ax) inside = !inside;
    }
    return inside ? -Math.sqrt(d) : Math.sqrt(d);
  };
}

export const union = (...fs: SDF[]): SDF => (x, y, z) => {
  let d = Infinity;
  for (const f of fs) d = Math.min(d, f(x, y, z));
  return d;
};

export function smoothUnion(k: number, ...fs: SDF[]): SDF {
  return (x, y, z) => {
    let d = fs[0](x, y, z);
    for (let i = 1; i < fs.length; i++) {
      const b = fs[i](x, y, z);
      const h = Math.max(0, Math.min(1, 0.5 + (0.5 * (b - d)) / k));
      d = b * (1 - h) + d * h - k * h * (1 - h);
    }
    return d;
  };
}

export function smoothSubtract(k: number, a: SDF, b: SDF): SDF {
  return (x, y, z) => {
    const da = a(x, y, z);
    const db = b(x, y, z);
    const h = Math.max(0, Math.min(1, 0.5 - (0.5 * (da + db)) / k));
    return da * (1 - h) - db * h + k * h * (1 - h);
  };
}

export const intersect = (a: SDF, b: SDF): SDF => (x, y, z) => Math.max(a(x, y, z), b(x, y, z));
export const subtract = (a: SDF, b: SDF): SDF => (x, y, z) => Math.max(a(x, y, z), -b(x, y, z));

/** Mirror across the YZ plane (x → |x|) — for bilateral features. */
export const mirrorX = (f: SDF): SDF => (x, y, z) => f(Math.abs(x), y, z);

/** Polar repetition around Y: n copies of f placed by angle. */
export function polarY(n: number, f: SDF, phase = 0): SDF {
  const step = (Math.PI * 2) / n;
  return (x, y, z) => {
    const a = Math.atan2(z, x) - phase;
    const k = Math.round(a / step);
    const ang = -(k * step) - phase;
    const c = Math.cos(ang), s = Math.sin(ang);
    return f(c * x - s * z, y, s * x + c * z);
  };
}

/** Naive Surface Nets with gradient normals and a surface projection step. */
export function meshSDF(f: SDF, min: Vec3, max: Vec3, cell: number): THREE.BufferGeometry {
  const nx = Math.ceil((max[0] - min[0]) / cell) + 1;
  const ny = Math.ceil((max[1] - min[1]) / cell) + 1;
  const nz = Math.ceil((max[2] - min[2]) / cell) + 1;
  const field = new Float32Array(nx * ny * nz);
  const idx = (i: number, j: number, k: number) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++)
    for (let j = 0; j < ny; j++)
      for (let i = 0; i < nx; i++) field[idx(i, j, k)] = f(min[0] + i * cell, min[1] + j * cell, min[2] + k * cell);

  const cellVert = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cidx = (i: number, j: number, k: number) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos: number[] = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const v = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          v[c] = field[idx(i + corners[c][0], j + corners[c][1], k + corners[c][2])];
          if (v[c] < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let sx = 0, sy = 0, sz = 0, cnt = 0;
        for (const [a, b] of edges) {
          if ((v[a] < 0) === (v[b] < 0)) continue;
          const t = v[a] / (v[a] - v[b]);
          sx += corners[a][0] + (corners[b][0] - corners[a][0]) * t;
          sy += corners[a][1] + (corners[b][1] - corners[a][1]) * t;
          sz += corners[a][2] + (corners[b][2] - corners[a][2]) * t;
          cnt++;
        }
        cellVert[cidx(i, j, k)] = pos.length / 3;
        pos.push(min[0] + (i + sx / cnt) * cell, min[1] + (j + sy / cnt) * cell, min[2] + (k + sz / cnt) * cell);
      }
  const index: number[] = [];
  const quad = (a: number, b: number, c: number, d: number, flip: boolean) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) index.push(a, c, b, a, d, c);
    else index.push(a, b, c, a, c, d);
  };
  for (let k = 1; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 0; i < nx - 1; i++) {
        const a = field[idx(i, j, k)] < 0, b = field[idx(i + 1, j, k)] < 0;
        if (a === b) continue;
        quad(cellVert[cidx(i, j - 1, k - 1)], cellVert[cidx(i, j, k - 1)], cellVert[cidx(i, j, k)], cellVert[cidx(i, j - 1, k)], b);
      }
  for (let k = 1; k < nz - 1; k++)
    for (let j = 0; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const a = field[idx(i, j, k)] < 0, b = field[idx(i, j + 1, k)] < 0;
        if (a === b) continue;
        quad(cellVert[cidx(i - 1, j, k - 1)], cellVert[cidx(i - 1, j, k)], cellVert[cidx(i, j, k)], cellVert[cidx(i, j, k - 1)], b);
      }
  for (let k = 0; k < nz - 1; k++)
    for (let j = 1; j < ny - 1; j++)
      for (let i = 1; i < nx - 1; i++) {
        const a = field[idx(i, j, k)] < 0, b = field[idx(i, j, k + 1)] < 0;
        if (a === b) continue;
        quad(cellVert[cidx(i - 1, j - 1, k)], cellVert[cidx(i, j - 1, k)], cellVert[cidx(i, j, k)], cellVert[cidx(i - 1, j, k)], b);
      }
  // Project vertices onto the true surface and compute gradient normals.
  const nrm = new Float32Array(pos.length);
  const e = cell * 0.5;
  for (let p = 0; p < pos.length; p += 3) {
    let x = pos[p], y = pos[p + 1], z = pos[p + 2];
    for (let it = 0; it < 2; it++) {
      const d = f(x, y, z);
      const gx = f(x + e, y, z) - f(x - e, y, z);
      const gy = f(x, y + e, z) - f(x, y - e, z);
      const gz = f(x, y, z + e) - f(x, y, z - e);
      const gl = Math.hypot(gx, gy, gz) || 1;
      const step = Math.max(-cell, Math.min(cell, d));
      x -= (gx / gl) * step;
      y -= (gy / gl) * step;
      z -= (gz / gl) * step;
    }
    pos[p] = x; pos[p + 1] = y; pos[p + 2] = z;
    const gx = f(x + e, y, z) - f(x - e, y, z);
    const gy = f(x, y + e, z) - f(x, y - e, z);
    const gz = f(x, y, z + e) - f(x, y, z - e);
    const gl = Math.hypot(gx, gy, gz) || 1;
    nrm[p] = gx / gl; nrm[p + 1] = gy / gl; nrm[p + 2] = gz / gl;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(index);
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}
