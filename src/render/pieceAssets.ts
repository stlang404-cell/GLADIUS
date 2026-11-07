import * as THREE from 'three';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * Loads a baked piece collection (see scripts/bake-pieces.ts). Each piece has
 * a `body` geometry (ivory/ebony) and an optional `accent` geometry (metal).
 */
export type PieceGeoms = Record<string, { body: THREE.BufferGeometry; accent: THREE.BufferGeometry | null; height: number }>;

type Entry = { piece: string; part: 'body' | 'accent'; vcount: number; icount: number; bmin: number[]; bmax: number[]; pos: [number, number]; nrm: [number, number]; idx: [number, number] };

const cache = new Map<string, Promise<PieceGeoms>>();

export function decodePieceBin(buf: ArrayBuffer): Promise<PieceGeoms> {
  return MeshoptDecoder.ready.then(() => {
    const dv = new DataView(buf);
    const hlen = dv.getUint32(0, true);
    const header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hlen))) as { entries: Entry[] };
    const blobStart = dv.getUint32(buf.byteLength - 4, true);
    const out: PieceGeoms = {};
    for (const e of header.entries) {
      const src = (r: [number, number]) => new Uint8Array(buf, blobStart + r[0], r[1]);
      const q = new Uint16Array(e.vcount * 4);
      MeshoptDecoder.decodeVertexBuffer(new Uint8Array(q.buffer), e.vcount, 8, src(e.pos));
      const qn = new Int8Array(e.vcount * 4);
      MeshoptDecoder.decodeVertexBuffer(new Uint8Array(qn.buffer), e.vcount, 4, src(e.nrm));
      const idx = new Uint32Array(e.icount);
      MeshoptDecoder.decodeIndexBuffer(new Uint8Array(idx.buffer), e.icount, 4, src(e.idx));
      const pos = new Float32Array(e.vcount * 3);
      const nrm = new Float32Array(e.vcount * 3);
      for (let i = 0; i < e.vcount; i++) {
        for (let c = 0; c < 3; c++) {
          pos[i * 3 + c] = e.bmin[c] + (q[i * 4 + c] / 65535) * (e.bmax[c] - e.bmin[c]);
          nrm[i * 3 + c] = qn[i * 4 + c] / 127;
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
      g.setIndex(new THREE.BufferAttribute(e.vcount > 65535 ? idx : new Uint16Array(idx), 1));
      g.computeBoundingBox();
      g.computeBoundingSphere();
      const slot = (out[e.piece] ??= { body: g, accent: null, height: e.bmax[1] });
      if (e.part === 'body') {
        slot.body = g;
        slot.height = e.bmax[1];
      } else slot.accent = g;
    }
    return out;
  });
}

export function loadPieceSet(name = 'legio'): Promise<PieceGeoms> {
  let p = cache.get(name);
  if (!p) {
    const url = new URL(`models/${name}.bin`, document.baseURI).href;
    p = fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`piece set ${name}: HTTP ${r.status}`);
        return r.arrayBuffer();
      })
      .then(decodePieceBin);
    cache.set(name, p);
  }
  return p;
}
