import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { findBuild } from '../../helpers/nodeEngine';

/** Persist a benchmark result (JSON) under tests/bench/results/ with machine info. */
export function saveResult(name: string, data: unknown) {
  const dir = path.resolve(__dirname, '../results');
  fs.mkdirSync(dir, { recursive: true });
  const meta = { date: new Date().toISOString(), node: process.version, cpus: os.cpus().length, cpu: os.cpus()[0]?.model, memGB: Math.round(os.totalmem() / 2 ** 30) };
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify({ meta, data }, null, 1));
}

export const envInt = (k: string, d: number) => (process.env[k] ? Number(process.env[k]) : d);

/** Exact engine files used by the benches: build → size + sha256 of the .wasm actually loaded. */
export function engineIds() {
  const out: Record<string, { file: string; bytes: number; sha256: string }> = {};
  for (const id of ['lite-single', 'lite-mt', 'full-single', 'full-mt'] as const) {
    const js = findBuild(id);
    if (!js) continue;
    const buf = fs.readFileSync(js.replace(/\.js$/, '.wasm'));
    out[id] = { file: path.basename(js), bytes: buf.length, sha256: createHash('sha256').update(buf).digest('hex') };
  }
  return { package: 'npm stockfish@19.0.1 (Stockfish 19, nmrugg/stockfish.js)', files: out };
}
