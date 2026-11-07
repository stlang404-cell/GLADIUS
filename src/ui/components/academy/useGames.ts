import { useEffect, useMemo, useState } from 'react';
import type { GameRecord, LibraryMeta } from '../../../game/state';
import { getGame } from '../../../persist/save';
import { useSave } from '../../store';

/**
 * Full GameRecords for library ids, loaded lazily from IndexedDB and cached
 * per (id, analysed, accuracy) so a finished analysis refreshes the entry.
 * Nothing here is persisted: weakness tracking and charts are derived from
 * the permanent library on demand.
 */
const cache = new Map<string, { key: string; g: GameRecord }>();
const keyOf = (m: LibraryMeta) => `${m.analysed ? 1 : 0}:${m.accuracy ?? ''}:${m.result}`;

export function useGameRecords(ids: string[]): { games: Map<string, GameRecord>; loading: boolean } {
  const s = useSave();
  const sig = ids.map((id) => id + '@' + (s.libraryMeta[id] ? keyOf(s.libraryMeta[id]) : '')).join('|');
  const [ver, setVer] = useState(0);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let live = true;
    const need = ids.filter((id) => {
      const m = s.libraryMeta[id];
      const c = cache.get(id);
      return m && (!c || c.key !== keyOf(m));
    });
    if (need.length === 0) return;
    setLoading(true);
    void Promise.all(
      need.map((id) =>
        getGame(id).then((g) => {
          const m = getMeta(id);
          if (g && m) cache.set(id, { key: keyOf(m), g });
        }),
      ),
    ).then(() => {
      if (!live) return;
      setLoading(false);
      setVer((v) => v + 1);
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  const games = useMemo(() => {
    const out = new Map<string, GameRecord>();
    for (const id of ids) {
      const c = cache.get(id);
      if (c) out.set(id, c.g);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, ver]);
  return { games, loading };
  function getMeta(id: string) {
    return s.libraryMeta[id];
  }
}

/** The player's own games (newest first), capped. */
export function usePlayerGameIds(cap = 400): string[] {
  const s = useSave();
  return useMemo(() => [...s.library].reverse().filter((id) => s.libraryMeta[id]?.playerColor).slice(0, cap), [s.library.length, s.libraryMeta]); // eslint-disable-line react-hooks/exhaustive-deps
}

export function resultOf(m: Pick<LibraryMeta, 'result' | 'playerColor'>): 'win' | 'draw' | 'loss' | '' {
  if (!m.playerColor || m.result === '*') return '';
  if (m.result === '1/2-1/2') return 'draw';
  return (m.result === '1-0') === (m.playerColor === 'w') ? 'win' : 'loss';
}
