import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { UciEngine, type UciTransport, type EngineOptions } from '../../src/engine/uci';
import { BUILDS, type BuildId } from '../../src/engine/builds';
import { assemblePack, readManifest } from '../../scripts/engine-pack.mjs';

const require = createRequire(import.meta.url);

/**
 * Where to find Stockfish builds for tests and benchmarks:
 *   1. public/engine (what the app ships),
 *   2. $GLADIUS_SF_DIR (e.g. the bin/ folder of `npm pack stockfish@19.0.1`),
 *   3. node_modules/stockfish/bin.
 * The folder must contain a package.json with {"type":"commonjs"} for in-process use.
 */
export function findBuild(id: BuildId): string | null {
  const file = BUILDS[id].js;
  const dirs = [
    path.resolve(__dirname, '../../public/engine'),
    process.env.GLADIUS_SF_DIR,
    path.resolve(__dirname, '../../node_modules/stockfish/bin'),
  ].filter(Boolean) as string[];
  for (const d of dirs) {
    const p = path.join(d, file);
    if (fs.existsSync(p) && fs.existsSync(p.replace(/\.js$/, '.wasm'))) return p;
  }
  return fromPack(id);
}

/**
 * 4. The committed engine pack (public/engine/pack): big-net builds are reassembled
 * (gunzip + delta, SHA-256 verified) once into node_modules/.cache/gladius-engine,
 * so a fresh clone runs the full-strength benches without any download.
 */
function fromPack(id: BuildId): string | null {
  const b = BUILDS[id];
  const m = readManifest();
  if (!m || !m.files[b.wasm]) return null;
  const dir = path.resolve(__dirname, '../../node_modules/.cache/gladius-engine');
  const js = path.resolve(__dirname, '../../public/engine', b.js);
  if (!fs.existsSync(js)) return null;
  const wasm = path.join(dir, b.wasm);
  if (!fs.existsSync(wasm) || fs.statSync(wasm).size !== m.files[b.wasm].bytes) {
    try {
      assemblePack(dir, undefined, [b.wasm]);
    } catch {
      return null;
    }
  }
  fs.copyFileSync(js, path.join(dir, b.js));
  fs.writeFileSync(path.join(dir, 'package.json'), '{"type":"commonjs"}');
  return path.join(dir, b.js);
}

let inProcessUsed = false;

/**
 * In-process transport (single-threaded builds only). The emscripten glue only
 * supports ONE instance per Node process (a second instance looks for
 * `stockfish.wasm`), so callers should use it once; see nodeEngine().
 */
export function inProcessTransport(jsPath: string): UciTransport {
  inProcessUsed = true;
  const factory = require(jsPath);
  const eng = factory();
  let listener: (l: string) => void = () => {};
  eng.listener = (l: string) => listener(l);
  return {
    send: (c) => eng.processCommand(c),
    setListener: (cb) => (listener = cb),
    terminate: () => {
      try {
        eng.terminate();
      } catch {
        /* ignore */
      }
    },
  };
}

/**
 * Child-process transport: `node stockfish-19*.js` speaks UCI on stdin/stdout.
 * Works for every build including the multi-threaded ones (worker_threads).
 */
export function processTransport(jsPath: string): UciTransport & { pid?: number } {
  const ch = spawn(process.execPath, [jsPath], { stdio: ['pipe', 'pipe', 'ignore'] });
  let listener: (l: string) => void = () => {};
  let onErr: (e: Error) => void = () => {};
  let buf = '';
  let dead = false;
  ch.stdout.setEncoding('utf8');
  ch.stdout.on('data', (d: string) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const l = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (l) listener(l);
    }
  });
  ch.on('exit', (code) => {
    dead = true;
    onErr(new Error(`engine process exited (${code})`));
  });
  ch.on('error', (e) => onErr(e));
  ch.stdin.on('error', () => undefined);
  return {
    pid: ch.pid,
    send: (c) => {
      if (!dead) ch.stdin.write(c + '\n');
    },
    setListener: (cb) => (listener = cb),
    setErrorListener: (cb) => (onErr = cb),
    terminate: () => {
      onErr = () => {};
      if (!dead) {
        try {
          ch.stdin.write('quit\n');
        } catch {
          /* ignore */
        }
        setTimeout(() => ch.kill('SIGKILL'), 200).unref();
      }
    },
  };
}

/** Resident memory of a process in MB (Linux), or -1. */
export function processRssMB(pid?: number): number {
  if (!pid) return -1;
  try {
    const s = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
    return Math.round(Number(s.match(/VmRSS:\s+(\d+)/)![1]) / 1024);
  } catch {
    return -1;
  }
}

/**
 * Default test engine: Stockfish 19 lite single-threaded, in-process (as before)
 * for the first instance; further instances, other builds and restarts run as
 * child processes (`node stockfish-19-*.js`).
 */
export function nodeEngine(build: BuildId = 'lite-single', opts: EngineOptions & { process?: boolean } = {}): UciEngine {
  const p = findBuild(build);
  if (!p) throw new Error(`Stockfish build ${build} not found (set GLADIUS_SF_DIR)`);
  // In-process only for the first lite-single engine of this process (fast unit tests);
  // every other engine — and every restart — gets its own child process.
  let first = !(opts.process ?? (build !== 'lite-single')) && !inProcessUsed;
  return new UciEngine(() => {
    if (first) {
      first = false;
      return inProcessTransport(p);
    }
    return processTransport(p);
  }, opts);
}
