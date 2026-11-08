/**
 * Bakes the SDF-sculpted chess set into a compact binary (public/models/<set>.bin):
 * surface nets (fine grid) → meshoptimizer simplification (absolute error bound)
 * → vertex-cache reorder → quantise (uint16 positions, int8 normals) →
 * meshopt vertex/index codecs. Decoded at runtime with three.js's bundled
 * MeshoptDecoder. Run: npm run bake:pieces
 */
import { writeFileSync } from 'node:fs';
import { MeshoptSimplifier, MeshoptEncoder } from 'meshoptimizer';
import { SCULPTS } from '../src/render/pieceSculpt';
import { TROPHY_SCULPTS } from '../src/render/trophySculpt';
import { meshSDF, type SDF, type Vec3 } from '../src/render/sdf';

const CELL = Number(process.env.CELL ?? 0.008);
const ERR = Number(process.env.ERR ?? 0.0009);
const SET = process.env.SET ?? 'legio';
const SOURCE: Record<string, () => { body: SDF; accent: SDF | null; bounds: [Vec3, Vec3] }> = SET === 'trophies' ? TROPHY_SCULPTS : SCULPTS;

type Entry = { piece: string; part: 'body' | 'accent'; vcount: number; icount: number; bmin: number[]; bmax: number[]; pos: [number, number]; nrm: [number, number]; idx: [number, number] };

async function main() {
  await MeshoptSimplifier.ready;
  await MeshoptEncoder.ready;
  const chunks: Uint8Array[] = [];
  let offset = 0;
  const push = (u: Uint8Array): [number, number] => {
    const pad = (4 - (offset % 4)) % 4;
    if (pad) { chunks.push(new Uint8Array(pad)); offset += pad; }
    chunks.push(u);
    const r: [number, number] = [offset, u.length];
    offset += u.length;
    return r;
  };
  const entries: Entry[] = [];
  for (const [piece, make] of Object.entries(SOURCE)) {
    const s = make();
    const parts: ['body' | 'accent', SDF | null, number][] = [['body', s.body, CELL], ['accent', s.accent, CELL * 0.8]];
    for (const [part, f, cell] of parts) {
      if (!f) continue;
      const t0 = Date.now();
      const g = meshSDF(f, s.bounds[0] as Vec3, s.bounds[1] as Vec3, cell);
      const pos = g.attributes.position.array as Float32Array;
      const nrm = g.attributes.normal.array as Float32Array;
      const idx0 = new Uint32Array(g.index!.array);
      const [simp] = MeshoptSimplifier.simplify(idx0, pos, 3, Math.floor(idx0.length * 0.05 / 3) * 3, ERR, ['ErrorAbsolute']);
      const ordered = simp;
      // Compact vertices referenced by the simplified index buffer.
      const remap = new Map<number, number>();
      const newIdx = new Uint32Array(ordered.length);
      const vp: number[] = [];
      const vn: number[] = [];
      for (let i = 0; i < ordered.length; i++) {
        const o = ordered[i];
        let n = remap.get(o);
        if (n === undefined) {
          n = remap.size;
          remap.set(o, n);
          vp.push(pos[o * 3], pos[o * 3 + 1], pos[o * 3 + 2]);
          vn.push(nrm[o * 3], nrm[o * 3 + 1], nrm[o * 3 + 2]);
        }
        newIdx[i] = n;
      }
      const vcount = remap.size;
      const bmin = [Infinity, Infinity, Infinity], bmax = [-Infinity, -Infinity, -Infinity];
      for (let i = 0; i < vcount; i++) for (let c = 0; c < 3; c++) { bmin[c] = Math.min(bmin[c], vp[i * 3 + c]); bmax[c] = Math.max(bmax[c], vp[i * 3 + c]); }
      const q = new Uint16Array(vcount * 4);
      const qn = new Int8Array(vcount * 4);
      for (let i = 0; i < vcount; i++) {
        for (let c = 0; c < 3; c++) {
          q[i * 4 + c] = Math.round(((vp[i * 3 + c] - bmin[c]) / (bmax[c] - bmin[c] || 1)) * 65535);
          qn[i * 4 + c] = Math.round(vn[i * 3 + c] * 127);
        }
      }
      const encPos = MeshoptEncoder.encodeVertexBuffer(new Uint8Array(q.buffer), vcount, 8);
      const encNrm = MeshoptEncoder.encodeVertexBuffer(new Uint8Array(qn.buffer), vcount, 4);
      const encIdx = MeshoptEncoder.encodeIndexBuffer(new Uint8Array(newIdx.buffer), newIdx.length, 4);
      entries.push({ piece, part, vcount, icount: newIdx.length, bmin, bmax, pos: push(encPos), nrm: push(encNrm), idx: push(encIdx) });
      console.log(`${piece}.${part}: ${idx0.length / 3} → ${newIdx.length / 3} tris, ${vcount} verts, ${((encPos.length + encNrm.length + encIdx.length) / 1024).toFixed(1)} KB, ${Date.now() - t0} ms`);
    }
  }
  const header = new TextEncoder().encode(JSON.stringify({ set: SET, version: 1, cell: CELL, error: ERR, entries }));
  const len = new Uint32Array([header.length]);
  const out = new Uint8Array(4 + header.length + offset + 4);
  out.set(new Uint8Array(len.buffer), 0);
  out.set(header, 4);
  let o = 4 + header.length;
  const blobStart = (o + 3) & ~3;
  o = blobStart;
  for (const c of chunks) { out.set(c, o); o += c.length; }
  // Store blob start in the last 4 bytes.
  new DataView(out.buffer).setUint32(out.length - 4, blobStart, true);
  writeFileSync(`public/models/${SET}.bin`, out.subarray(0, Math.max(o, out.length)));
  console.log('total KB', (out.length / 1024).toFixed(1));
}
void main();
