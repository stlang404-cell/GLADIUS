import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/** Persist a benchmark result (JSON) under tests/bench/results/ with machine info. */
export function saveResult(name: string, data: unknown) {
  const dir = path.resolve(__dirname, '../results');
  fs.mkdirSync(dir, { recursive: true });
  const meta = { date: new Date().toISOString(), node: process.version, cpus: os.cpus().length, cpu: os.cpus()[0]?.model, memGB: Math.round(os.totalmem() / 2 ** 30) };
  fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify({ meta, data }, null, 1));
}

export const envInt = (k: string, d: number) => (process.env[k] ? Number(process.env[k]) : d);
