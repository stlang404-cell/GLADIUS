import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Sculpted chess pieces built procedurally (lathe profiles + extruded knight)
 * so the whole set is original, tiny to ship, and crisp at any resolution.
 * Units: one board square = 1.0.
 */

type P = [number, number]; // [radius, height]

function lathe(points: P[], segments = 40): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), segments);
  g.computeVertexNormals();
  return g;
}

function smooth(points: P[], steps = 3): P[] {
  // Chaikin smoothing for soft sculpted contours.
  let pts = points;
  for (let s = 0; s < steps; s++) {
    const out: P[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i];
      const [x1, y1] = pts[i + 1];
      out.push([0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1], [0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

const BASE: P[] = [[0, 0], [0.36, 0], [0.37, 0.03], [0.36, 0.07], [0.31, 0.09], [0.32, 0.12], [0.27, 0.14]];

function pawn(): THREE.BufferGeometry {
  const body = smooth([...BASE, [0.2, 0.18], [0.14, 0.3], [0.11, 0.4], [0.17, 0.44], [0.17, 0.46], [0.1, 0.48], [0.13, 0.52], [0.14, 0.58], [0.12, 0.64], [0.07, 0.68], [0, 0.69]]);
  return lathe(body);
}

function rook(): THREE.BufferGeometry {
  const body = lathe(smooth([...BASE, [0.24, 0.18], [0.2, 0.3], [0.19, 0.55], [0.24, 0.6], [0.25, 0.66], [0.25, 0.78], [0, 0.78]], 2));
  const parts = [body];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const m = new THREE.BoxGeometry(0.11, 0.1, 0.09);
    m.rotateY(-a + Math.PI / 2);
    m.translate(Math.cos(a) * 0.2, 0.83, Math.sin(a) * 0.2);
    parts.push(m.toNonIndexed() as THREE.BufferGeometry);
  }
  return merge(parts);
}

function bishop(): THREE.BufferGeometry {
  const body = smooth([...BASE, [0.2, 0.18], [0.13, 0.35], [0.1, 0.52], [0.17, 0.55], [0.17, 0.58], [0.1, 0.6], [0.14, 0.66], [0.15, 0.74], [0.12, 0.84], [0.06, 0.92], [0.03, 0.95], [0.05, 0.98], [0.03, 1.01], [0, 1.02]]);
  const g = lathe(body);
  // laurel band
  const band = new THREE.TorusGeometry(0.135, 0.018, 8, 32);
  band.rotateX(Math.PI / 2);
  band.translate(0, 0.72, 0);
  return merge([g, band]);
}

function queen(): THREE.BufferGeometry {
  const body = smooth([...BASE, [0.23, 0.18], [0.15, 0.38], [0.11, 0.62], [0.19, 0.66], [0.19, 0.69], [0.12, 0.71], [0.15, 0.78], [0.21, 0.92], [0.17, 0.95], [0.08, 0.98], [0.06, 1.02], [0, 1.03]]);
  const parts: THREE.BufferGeometry[] = [lathe(body)];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const s = new THREE.SphereGeometry(0.032, 12, 8);
    s.translate(Math.cos(a) * 0.19, 0.95, Math.sin(a) * 0.19);
    parts.push(s);
  }
  const top = new THREE.SphereGeometry(0.05, 16, 10);
  top.translate(0, 1.07, 0);
  parts.push(top);
  return merge(parts);
}

function king(): THREE.BufferGeometry {
  const body = smooth([...BASE, [0.23, 0.18], [0.15, 0.4], [0.12, 0.66], [0.2, 0.7], [0.2, 0.73], [0.13, 0.75], [0.16, 0.82], [0.2, 0.96], [0.12, 1.0], [0.07, 1.02], [0, 1.03]]);
  const parts: THREE.BufferGeometry[] = [lathe(body)];
  const v = new THREE.BoxGeometry(0.06, 0.22, 0.06);
  v.translate(0, 1.13, 0);
  const h = new THREE.BoxGeometry(0.17, 0.06, 0.06);
  h.translate(0, 1.15, 0);
  parts.push(v, h);
  // laurel wreath
  const band = new THREE.TorusGeometry(0.175, 0.02, 8, 32);
  band.rotateX(Math.PI / 2);
  band.translate(0, 0.9, 0);
  parts.push(band);
  return merge(parts);
}

function knight(): THREE.BufferGeometry {
  const base = lathe(smooth([...BASE, [0.23, 0.18], [0.2, 0.24], [0, 0.24]], 2));
  // Horse head silhouette (side profile), extruded and bevelled.
  const s = new THREE.Shape();
  const pts: P[] = [
    [-0.2, 0.22], [0.2, 0.22], [0.17, 0.36], [0.12, 0.48], [0.14, 0.58], [0.2, 0.66], [0.26, 0.7], [0.27, 0.76], [0.22, 0.8],
    [0.12, 0.8], [0.05, 0.86], [0.02, 0.94], [-0.03, 0.9], [-0.06, 0.95], [-0.1, 0.88], [-0.17, 0.8], [-0.22, 0.66], [-0.24, 0.5], [-0.22, 0.36],
  ];
  s.moveTo(pts[0][0], pts[0][1]);
  const sm = smooth([...pts, pts[0]], 2);
  for (const [x, y] of sm.slice(1)) s.lineTo(x, y);
  const head = new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.03, bevelSegments: 3, curveSegments: 6 });
  head.translate(0, 0, -0.1);
  // eye dimples are implied by lighting; add a mane crest
  const mane = new THREE.BoxGeometry(0.05, 0.4, 0.07);
  mane.rotateZ(0.5);
  mane.translate(-0.15, 0.68, 0);
  return merge([base, head.toNonIndexed(), mane.toNonIndexed()]);
}

function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const norm = parts.map((p) => {
    const g = p.index ? p.toNonIndexed() : p;
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.attributes.normal) g.computeVertexNormals();
    return g;
  });
  const m = mergeGeometries(norm, false)!;
  m.computeBoundingBox();
  return m;
}

let cache: Record<string, THREE.BufferGeometry> | null = null;
export function pieceGeometries(): Record<string, THREE.BufferGeometry> {
  if (!cache) cache = { p: pawn(), n: knight(), b: bishop(), r: rook(), q: queen(), k: king() };
  return cache;
}
