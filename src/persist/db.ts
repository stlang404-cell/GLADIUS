/** Tiny promise wrapper over IndexedDB (no dependency). */
const DB_NAME = 'gladius';
/**
 * v1: kv (single-document save), games, backups.
 * v2: + parts (split save format: manifest + per-part records). Upgrading
 *     keeps every v1 store and record; the v1 save is migrated on first load.
 */
const DB_VERSION = 2;
export const STORES = ['kv', 'games', 'backups', 'parts'] as const;
export type StoreName = (typeof STORES)[number];

let dbp: Promise<IDBDatabase> | null = null;

export function openDb(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    req.onsuccess = () => {
      const db = req.result;
      // Another tab is upgrading: step aside rather than block it.
      db.onversionchange = () => {
        db.close();
        dbp = null;
      };
      resolve(db);
    };
    req.onerror = () => reject(req.error);
    req.onblocked = () => console.warn('GLADIUS database upgrade is waiting for another tab to close');
  });
  dbp.catch(() => (dbp = null));
  return dbp;
}

export function resetDbHandle() {
  dbp = null;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = fn(t.objectStore(store));
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error ?? new Error('Transaction aborted'));
      }),
  );
}

export const idb = {
  get: <T>(store: StoreName, key: string) => tx<T | undefined>(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>),
  put: (store: StoreName, key: string, value: unknown) => tx(store, 'readwrite', (s) => s.put(value, key)),
  del: (store: StoreName, key: string) => tx(store, 'readwrite', (s) => s.delete(key)),
  keys: (store: StoreName) => tx<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys()),
  all: <T>(store: StoreName) => tx<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>),
  clear: (store: StoreName) => tx(store, 'readwrite', (s) => s.clear()),
};

/** `n`: approximate size in bytes (used to spread large commits over several tasks). */
export type Op = { store: StoreName; key: string; value?: unknown; del?: boolean; n?: number };
/**
 * v0.4: puts are issued in batches of about this many bytes; the next batch is
 * issued from the success callback of the previous one (same transaction), so
 * the browser's synchronous structured-clone of a large commit is split over
 * several tasks instead of one long one.
 */
export const PUT_BATCH_BYTES = 1 << 20;

/** Test instrumentation: counts and an optional fault (abort after N puts). */
export const dbStats = { txs: 0, puts: 0, dels: 0, batches: 0, putKeys: [] as string[] };
export const dbFaults: { abortAfterPuts: number | null; crash: boolean; dead: boolean } = { abortAfterPuts: null, crash: false, dead: false };

export class CommitConflict extends Error {
  constructor() {
    super('The save was changed by another tab or window');
    this.name = 'CommitConflict';
  }
}

/**
 * Apply puts and deletes in ONE readwrite transaction (atomic in IndexedDB:
 * either all land or none do). `gc`: also delete every key of that store not
 * in `keep` (used when the previous layout is unknown). `guard`: read a record
 * first and abort with CommitConflict unless `test` accepts it (optimistic
 * concurrency against another tab writing the same save).
 */
export function commitOps(
  ops: Op[],
  gc?: { store: StoreName; keep: Set<string> },
  guard?: { store: StoreName; key: string; test: (v: unknown) => boolean },
): Promise<void> {
  const stores = new Set<StoreName>(ops.map((o) => o.store));
  if (gc) stores.add(gc.store);
  if (guard) stores.add(guard.store);
  if (stores.size === 0) return Promise.resolve();
  if (dbFaults.dead) return Promise.reject(new Error('simulated crash: process is gone'));
  return openDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const t = db.transaction([...stores], 'readwrite');
        dbStats.txs++;
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error);
        let conflict = false;
        t.onabort = () => reject(conflict ? new CommitConflict() : (t.error ?? new Error('Transaction aborted')));
        if (!guard) return apply();
        const g = t.objectStore(guard.store).get(guard.key);
        g.onsuccess = () => {
          if (guard.test(g.result)) return apply();
          conflict = true;
          t.abort();
        };
        function apply() {
          let i = 0;
          let puts = 0;
          const step = () => {
            let budget = 0;
            while (i < ops.length) {
              const o = ops[i++];
              const s = t.objectStore(o.store);
              if (o.del) {
                s.delete(o.key);
                dbStats.dels++;
                continue;
              }
              if (dbFaults.abortAfterPuts !== null && puts >= dbFaults.abortAfterPuts) {
                dbFaults.abortAfterPuts = null;
                if (dbFaults.crash) dbFaults.dead = true;
                t.abort(); // simulated crash: nothing of this transaction survives
                return;
              }
              const r = s.put(o.value, o.key);
              puts++;
              dbStats.puts++;
              dbStats.putKeys.push(o.key);
              budget += o.n ?? 0;
              if (budget >= PUT_BATCH_BYTES && i < ops.length) {
                dbStats.batches++;
                r.onsuccess = step;
                return;
              }
            }
            if (gc) {
              const s = t.objectStore(gc.store);
              const r = s.getAllKeys();
              r.onsuccess = () => {
                for (const k of r.result as string[]) if (!gc.keep.has(k)) s.delete(k);
              };
            }
          };
          step();
        }
      }),
  );
}

/** Read many keys of one store in one transaction. */
export function getMany<T>(store: StoreName, keys: string[]): Promise<(T | undefined)[]> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const t = db.transaction(store, 'readonly');
        const s = t.objectStore(store);
        const out: (T | undefined)[] = new Array(keys.length);
        keys.forEach((k, i) => {
          const r = s.get(k);
          r.onsuccess = () => (out[i] = r.result as T | undefined);
        });
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error ?? new Error('Transaction aborted'));
      }),
  );
}

/** Ask the browser not to evict our data under storage pressure (important on iOS). */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}
