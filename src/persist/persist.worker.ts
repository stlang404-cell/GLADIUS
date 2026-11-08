/// <reference lib="webworker" />
import { buildBackupFromDb, exportTextFromDb } from './offload';

/**
 * Persistence worker (v0.4): builds backup snapshots and export files from the
 * committed parts in IndexedDB, so the 25–30 MB of serialisation, checksums and
 * gzip never run on the main thread. Requests: { id, cmd: 'backup' | 'export' }.
 */
const ctx = self as unknown as DedicatedWorkerGlobalScope;
ctx.onmessage = async (e: MessageEvent<{ id: number; cmd: string }>) => {
  const { id, cmd } = e.data;
  try {
    if (cmd === 'backup') {
      const b = await buildBackupFromDb();
      ctx.postMessage({ id, ok: true, value: b }, b ? [b.data] : []);
    } else if (cmd === 'export') {
      ctx.postMessage({ id, ok: true, value: await exportTextFromDb() });
    } else if (cmd === 'ping') {
      ctx.postMessage({ id, ok: true, value: 'pong' });
    } else throw new Error('unknown command ' + cmd);
  } catch (err) {
    ctx.postMessage({ id, ok: false, error: String((err as Error)?.message ?? err) });
  }
};
