import { useEffect, useMemo, useState } from 'react';
import { Chess } from 'chess.js';
import { useSave, mutate, archiveGame } from '../../store';
import { useNav } from '../../nav';
import { ARENAS } from '../../../world/arenas';
import { identifyOpening, openingFamily } from '../../../chess/openings';
import { importPgn, validateFen, parseUci, START_FEN } from '../../../chess/rules';
import { startGame } from '../../../game/career';
import type { GameRecord } from '../../../game/state';
import { queueAnalysis, onAnalysisProgress, progress } from '../../analysisQueue';
import { importBlockReason } from '../../../analysis/integrity';
import { dayLabel } from '../common';
import { useGameRecords, resultOf } from './useGames';

type Res = 'all' | 'win' | 'draw' | 'loss';
type Period = 'all' | '7' | '30' | '90';
const PAGE = 30;

function fmtDate(iso: string | undefined, day: number) {
  if (!iso) return dayLabel(day);
  const d = new Date(iso);
  return isNaN(d.getTime()) ? dayLabel(day) : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Permanent game library with search and filters (opponent, result, opening, arena, date). */
export function GamesSection({ onReview }: { onReview: (id: string) => void }) {
  const s = useSave();
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Res>('all');
  const [arena, setArena] = useState<number | 'all'>('all');
  const [fam, setFam] = useState<string>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const [shown, setShown] = useState(PAGE);
  const [, tick] = useState(0);
  useEffect(() => onAnalysisProgress(() => tick((x) => x + 1)), []);
  const ids = useMemo(
    () => [...s.library].reverse().filter((id) => s.libraryMeta[id] && (scope === 'all' || s.libraryMeta[id].playerColor)).slice(0, 400),
    [s.library.length, scope, s.libraryMeta], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const { games } = useGameRecords(ids);
  const families = useMemo(() => {
    const m = new Map<string, number>();
    for (const id of ids) {
      const o = s.libraryMeta[id]?.opening;
      if (o) m.set(openingFamily(o), (m.get(openingFamily(o)) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f);
  }, [ids]); // eslint-disable-line react-hooks/exhaustive-deps
  const arenas = useMemo(() => [...new Set([...games.values()].map((g) => g.arena))].sort((a, b) => a - b), [games]);
  const now = Date.now();
  const needle = q.trim().toLowerCase();
  const list = ids.filter((id) => {
    const m = s.libraryMeta[id];
    const g = games.get(id);
    if (res !== 'all' && resultOf(m) !== res) return false;
    if (fam !== 'all' && (!m.opening || openingFamily(m.opening) !== fam)) return false;
    if (arena !== 'all' && g?.arena !== arena) return false;
    if (period !== 'all') {
      const t = g ? Date.parse(g.date) : NaN;
      if (isNaN(t) || now - t > Number(period) * 864e5) return false;
    }
    if (needle && !`${m.white} ${m.black} ${m.opening ?? ''}`.toLowerCase().includes(needle)) return false;
    return true;
  });
  const unanalysed = ids.filter((id) => !s.libraryMeta[id].analysed && s.libraryMeta[id].playerColor);
  const filtered = res !== 'all' || fam !== 'all' || arena !== 'all' || period !== 'all' || !!needle;
  return (
    <>
      <div className="ac-filters">
        <input className="ac-search" type="search" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Search opponent or opening" aria-label="Search games" />
        <div className="ac-seg-mini" role="radiogroup" aria-label="Result">
          {(['all', 'win', 'draw', 'loss'] as Res[]).map((r) => (
            <button key={r} role="radio" aria-checked={res === r} className={res === r ? 'on ' + r : r} onClick={() => setRes(r)}>{{ all: 'All', win: 'Won', draw: 'Drawn', loss: 'Lost' }[r]}</button>
          ))}
        </div>
        <div className="ac-selects">
          <select value={String(arena)} onChange={(e) => setArena(e.target.value === 'all' ? 'all' : Number(e.target.value))} aria-label="Arena">
            <option value="all">All arenas</option>
            {arenas.map((a) => <option key={a} value={a}>{ARENAS[a]?.name.replace(/^The /, '') ?? `Arena ${a + 1}`}</option>)}
          </select>
          <select value={fam} onChange={(e) => setFam(e.target.value)} aria-label="Opening">
            <option value="all">All openings</option>
            {families.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="Date">
            <option value="all">Any date</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <select value={scope} onChange={(e) => setScope(e.target.value as 'mine' | 'all')} aria-label="Scope">
            <option value="mine">My games</option>
            <option value="all">+ Broadcasts</option>
          </select>
        </div>
      </div>
      <div className="ac-row ac-count">
        <span className="grow muted small">{list.length} {list.length === 1 ? 'game' : 'games'}{filtered ? ' found' : ''}</span>
        {filtered && <button className="ac-link" onClick={() => { setQ(''); setRes('all'); setArena('all'); setFam('all'); setPeriod('all'); }}>Clear</button>}
        {!filtered && unanalysed.length > 1 && <button className="ac-link" onClick={() => unanalysed.forEach((id) => queueAnalysis(id))}>Analyse all ({unanalysed.length})</button>}
      </div>
      {ids.length === 0 && <div className="ac-empty">Every finished game is kept here for good, with its analysis.</div>}
      <div className="ac-list">
        {list.slice(0, shown).map((id) => {
          const m = s.libraryMeta[id];
          const g = games.get(id);
          const r = resultOf(m);
          const opp = m.playerColor ? (m.playerColor === 'w' ? m.black : m.white) : `${m.white} – ${m.black}`;
          const p = progress.get(id);
          return (
            <div key={id} className={'ac-game ' + r} role="button" tabIndex={0} onClick={() => onReview(id)} onKeyDown={(e) => e.key === 'Enter' && onReview(id)}>
              <span className={'ac-res ' + r}>{r === 'win' ? 'W' : r === 'loss' ? 'L' : r === 'draw' ? '½' : m.result === '1-0' ? '1–0' : m.result === '0-1' ? '0–1' : '½'}</span>
              <div className="ac-game-main">
                <div className="ac-game-top">
                  {m.playerColor && <span className={'ac-pawn sm ' + m.playerColor} />}
                  <b className="ac-ellipsis">{opp}</b>
                  {m.eloDelta !== undefined && <span className={'ac-delta ' + (m.eloDelta >= 0 ? 'up' : 'down')}>{m.eloDelta >= 0 ? '+' : '−'}{Math.abs(m.eloDelta)}</span>}
                </div>
                <div className="ac-game-sub ac-ellipsis">{m.opening ? openingFamily(m.opening) : 'Unnamed opening'} · {g ? `${ARENAS[g.arena]?.name.replace(/^The /, '') ?? ''} · ` : ''}{fmtDate(g?.date, m.day)}</div>
              </div>
              {m.analysed ? (
                m.accuracy !== undefined ? <span className="ac-accpill">{m.accuracy.toFixed(0)}</span> : <span className="ac-accpill muted">✓</span>
              ) : p !== undefined ? (
                <span className="ac-ring" style={{ ['--p' as string]: `${Math.round(p * 100)}` }} aria-label={`Analysing ${Math.round(p * 100)}%`} />
              ) : (
                <button className="ac-ib wide" onClick={(e) => { e.stopPropagation(); queueAnalysis(id, true); }}>Analyse</button>
              )}
            </div>
          );
        })}
      </div>
      {list.length > shown && <button className="btn ac-wide ac-mt" onClick={() => setShown(shown + PAGE)}>Show more</button>}
      <ImportBox onReview={onReview} />
    </>
  );
}

function ImportBox({ onReview }: { onReview: (id: string) => void }) {
  const s = useSave();
  const nav = useNav();
  const [text, setText] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const doImport = async () => {
    setErr(null);
    const t = text.trim();
    if (!t) return;
    if (!t.includes('[') && !/\d\./.test(t)) {
      const e = validateFen(t);
      if (e) return setErr(e);
      const block = importBlockReason(s, { fen: t });
      if (block) return setErr(block);
      const strongest = [...s.world.competitors].filter((c) => c.retiredDay === null).sort((a, b) => b.skill - a.skill)[0];
      mutate((x) => startGame(x, strongest, { kind: 'casual', tcId: 'untimed', rated: false, startFen: t, color: t.split(' ')[1] as 'w' | 'b' }));
      nav.play();
      return;
    }
    try {
      const imp = importPgn(t);
      const block = importBlockReason(s, imp);
      if (block) return setErr(block);
      const g: GameRecord = {
        id: `imp-${Date.now().toString(36)}`, kind: 'casual', rated: false, pool: 'untimed', tc: 'untimed', day: s.world.day, date: new Date().toISOString(),
        white: { id: 'ext-w', name: imp.headers.White ?? 'White', rating: Number(imp.headers.WhiteElo) || 0, rank: 0 },
        black: { id: 'ext-b', name: imp.headers.Black ?? 'Black', rating: Number(imp.headers.BlackElo) || 0, rank: 0 },
        playerColor: null, startFen: imp.startFen, moves: imp.moves,
        san: (() => { const c = new Chess(imp.startFen); return imp.moves.map((m) => c.move(parseUci(m)).san); })(),
        result: imp.headers.Result && imp.headers.Result !== '*' ? (imp.headers.Result as GameRecord['result']) : '1/2-1/2', termination: 'agreement', arena: 0, source: 'player',
        opening: imp.startFen === START_FEN ? identifyOpening(imp.moves) : null,
      };
      await archiveGame(g);
      queueAnalysis(g.id, true);
      setText('');
      onReview(g.id);
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <details className="ac-card ac-import">
      <summary>Import PGN or FEN</summary>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a PGN to analyse it, or a FEN to play it out." rows={5} />
      {err && <div className="ac-msg bad">{err}</div>}
      <button className="btn gold ac-wide" onClick={() => void doImport()} disabled={!text.trim()}>Import</button>
    </details>
  );
}
