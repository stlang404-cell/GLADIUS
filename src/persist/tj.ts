/**
 * Tabular JSON ("TJ", layout v4): a lossless, more compact JSON form for an
 * array of plain objects that share a few shapes (award registry, history,
 * chronicle, feuds, competitor sub-records).
 *
 *   { "tj": 1, "s": [[key, ...], ...], "d": [[colIndex, ...], ...], "t": [string, ...], "r": [[shape, v0, v1, ...], ...] }
 *
 * `s` lists each distinct key sequence (key order is preserved), `r` holds one
 * row per object. String columns with repeated values (`d`, per shape) store
 * an index into the string table `t` instead of the string. Values are what
 * JSON.stringify would write: keys whose value is undefined / a function /
 * a symbol are dropped, exactly as JSON does, and nested values are left to
 * JSON. Anything else (a non-object element, a `__proto__` key) makes
 * `tjEncode` return the input unchanged, so it is stored as plain JSON.
 *
 * `tjDecode(JSON.parse(JSON.stringify(tjEncode(a))))` deep-equals
 * `JSON.parse(JSON.stringify(a))`, with the same key order.
 */

type Obj = Record<string, unknown>;
export type TJ = { tj: 1; s: string[][]; d: number[][]; t: string[]; r: unknown[][] };

const SKIP = (v: unknown) => v === undefined || typeof v === 'function' || typeof v === 'symbol';

function plain(o: unknown): o is Obj {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return false;
  const p = Object.getPrototypeOf(o);
  return (p === Object.prototype || p === null) && typeof (o as { toJSON?: unknown }).toJSON !== 'function';
}

export function tjEncode(a: readonly unknown[]): TJ | readonly unknown[] {
  if (a.length < 2) return a;
  const shapeIx = new Map<string, number>();
  const shapes: string[][] = [];
  const rows: unknown[][] = new Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const o = a[i];
    if (!plain(o)) return a;
    const keys: string[] = [];
    const row: unknown[] = [0];
    for (const k in o) {
      if (!Object.prototype.hasOwnProperty.call(o, k)) continue;
      const v = o[k];
      if (SKIP(v)) continue;
      if (k === '__proto__') return a;
      keys.push(k);
      row.push(v);
    }
    const sk = keys.join('\u0000');
    let si = shapeIx.get(sk);
    if (si === undefined) {
      si = shapes.length;
      shapeIx.set(sk, si);
      shapes.push(keys);
    }
    row[0] = si;
    rows[i] = row;
  }
  // Dictionary columns: string-only columns of a shape with repeated values.
  const table: string[] = [];
  const tix = new Map<string, number>();
  const dict: number[][] = shapes.map(() => []);
  for (let si = 0; si < shapes.length; si++) {
    const width = shapes[si].length;
    for (let j = 1; j <= width; j++) {
      let n = 0;
      let ok = true;
      const seen = new Set<string>();
      for (const r of rows) {
        if (r[0] !== si) continue;
        const v = r[j];
        if (typeof v !== 'string') {
          ok = false;
          break;
        }
        n++;
        seen.add(v);
      }
      if (!ok || n < 4 || seen.size * 3 > n * 2) continue;
      dict[si].push(j - 1);
      for (const r of rows) {
        if (r[0] !== si) continue;
        const v = r[j] as string;
        let x = tix.get(v);
        if (x === undefined) {
          x = table.length;
          tix.set(v, x);
          table.push(v);
        }
        r[j] = x;
      }
    }
  }
  return { tj: 1, s: shapes, d: dict, t: table, r: rows };
}

export function isTJ(v: unknown): v is TJ {
  return !!v && typeof v === 'object' && !Array.isArray(v) && (v as TJ).tj === 1 && Array.isArray((v as TJ).r);
}

export function tjDecode(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  if (!isTJ(v)) throw new Error('not a TJ value');
  const { s, d, t, r } = v;
  const isDict = s.map((keys, si) => {
    const m = new Uint8Array(keys.length);
    for (const j of d[si] ?? []) m[j] = 1;
    return m;
  });
  // Objects are cloned from a per-shape template made by JSON.parse: adding many properties with
  // keyed stores would leave objects with more than ~16 keys in (slow) dictionary mode in V8.
  const templates = s.map((keys) => (keys.length > 8 ? (JSON.parse(JSON.stringify(Object.fromEntries(keys.map((k) => [k, 0])))) as Obj) : null));
  const out: unknown[] = new Array(r.length);
  for (let i = 0; i < r.length; i++) {
    const row = r[i];
    const si = row[0] as number;
    const keys = s[si];
    const dm = isDict[si];
    const tpl = templates[si];
    const o: Obj = tpl ? { ...tpl } : {};
    for (let j = 0; j < keys.length; j++) {
      const x = row[j + 1];
      o[keys[j]] = dm[j] ? t[x as number] : x;
    }
    out[i] = o;
  }
  return out;
}

/** JSON text of an array, tabular when that is possible. */
export function tjStringify(a: readonly unknown[]): string {
  return JSON.stringify(tjEncode(a));
}
