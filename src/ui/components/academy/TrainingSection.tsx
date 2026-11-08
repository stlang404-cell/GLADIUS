import { useMemo, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import { useSave, mutate } from '../../store';
import { useNav } from '../../nav';
import { Board } from '../Board';
import { bookMoves, identifyOpening, openingFamily, OPENINGS } from '../../../chess/openings';
import { ENDGAME_DRILLS, ENDGAME_GUIDE } from '../../../chess/endgames';
import { BUILTIN_PUZZLES, acceptsMove } from '../../../chess/puzzles';
import { parseUci } from '../../../chess/rules';
import { startGame } from '../../../game/career';
import { explorerLocked } from '../../../analysis/integrity';
import { asX, recordAttempt, type CoachStateX, type TrainingPositionX } from '../../../analysis/types';
import { repertoire } from '../../../analysis/weakness';
import { useGameRecords, usePlayerGameIds } from './useGames';

export type TrainSub = 'mistakes' | 'tactics' | 'endgames' | 'openings';
const SUBS: [TrainSub, string][] = [['mistakes', 'Mistakes'], ['tactics', 'Tactics'], ['endgames', 'Endgames'], ['openings', 'Openings']];

const THEME_LABEL: Record<string, string> = { tactic: 'Tactics', mate: 'Mates', endgame: 'Endgame', opening: 'Opening', conversion: 'Conversion', defence: 'Defence' };

export function TrainingSection({ sub, setSub, theme, setTheme, focusDrill, onReview }: {
  sub: TrainSub; setSub: (s: TrainSub) => void; theme: string | null; setTheme: (t: string | null) => void; focusDrill: string | null; onReview: (gameId: string, ply?: number) => void;
}) {
  return (
    <>
      <div className="ac-subseg" role="tablist">
        {SUBS.map(([k, l]) => <button key={k} role="tab" aria-selected={sub === k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>)}
      </div>
      {sub === 'mistakes' && <Mistakes theme={theme} setTheme={setTheme} onReview={onReview} />}
      {sub === 'tactics' && <Tactics />}
      {sub === 'endgames' && <Endgames focus={focusDrill} />}
      {sub === 'openings' && <Openings />}
    </>
  );
}

/** Find-the-best-move trainer. `solution` holds trainee moves at even indices, replies at odd. */
export function TrainingBoard({ fen, solution, caption, onDone, onSource, extra }: {
  fen: string; solution: string[]; caption: string; onDone: (ok: boolean) => void; onSource?: () => void; extra?: string;
}) {
  const s = useSave();
  const [cur, setCur] = useState(fen);
  const [idx, setIdx] = useState(0);
  const [last, setLast] = useState<Move | null>(null);
  const [msg, setMsg] = useState<{ t: string; tone: 'ok' | 'bad' | 'info' } | null>(null);
  const [failed, setFailed] = useState(false);
  const turn = new Chess(fen).turn();
  const play = (uci: string) => {
    const c = new Chess(cur);
    if (!acceptsMove(cur, solution, idx, uci)) {
      setMsg({ t: 'Not this one. Try again.', tone: 'bad' });
      setFailed(true);
      return;
    }
    let m: Move;
    try { m = c.move(parseUci(uci)); } catch { return; }
    setLast(m);
    let next = idx + 1;
    if (c.isCheckmate()) next = solution.length;
    else if (next < solution.length) {
      setLast(c.move(parseUci(solution[next])));
      next++;
    }
    setCur(c.fen());
    setIdx(next);
    setMsg(next >= solution.length ? { t: failed ? 'Solved, after a miss.' : 'Correct.', tone: 'ok' } : { t: 'Good. Keep going.', tone: 'info' });
  };
  const done = idx >= solution.length;
  return (
    <div className="ac-trainer">
      <div className="ac-trainer-cap"><span className={'ac-pawn ' + turn} /> <b>{turn === 'w' ? 'White' : 'Black'} to move</b><span className="muted">{caption}</span></div>
      <div className="ac-trainer-board"><Board fen={cur} orientation={turn} interactive={!done} onMove={play} lastMove={last} settings={s.settings} /></div>
      {msg && <div className={'ac-msg ' + msg.tone}>{msg.t}</div>}
      {done && extra && <div className="muted small ac-center">{extra}</div>}
      <div className="ac-row gap wrap ac-center">
        {!done && <button className="btn small" onClick={() => { setMsg({ t: `Answer: ${new Chess(cur).move(parseUci(solution[idx])).san}`, tone: 'info' }); setFailed(true); }}>Reveal</button>}
        {done ? <button className="btn gold small" onClick={() => onDone(!failed)}>Next</button> : <button className="btn small" onClick={() => onDone(false)}>Skip</button>}
        {onSource && <button className="btn small" onClick={onSource}>Source game</button>}
      </div>
    </div>
  );
}

function sanLine(fen: string, line: string[]) {
  const c = new Chess(fen);
  const out: string[] = [];
  for (const u of line) { try { out.push(c.move(parseUci(u)).san); } catch { break; } }
  return out.join(' ');
}

function Mistakes({ theme, setTheme, onReview }: { theme: string | null; setTheme: (t: string | null) => void; onReview: (gameId: string, ply?: number) => void }) {
  const s = useSave();
  const [cur, setCur] = useState<string | null>(null);
  const all = s.coach.positions as TrainingPositionX[];
  const due = all.filter((p) => p.solved < 2);
  const themes = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of due) m.set(p.theme, (m.get(p.theme) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [due.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const calc = due.filter((p) => (p.line?.length ?? 1) >= 3).length;
  const pool = due.filter((p) => !theme || (theme === 'calc' ? (p.line?.length ?? 1) >= 3 : p.theme === theme)).sort((a, b) => b.failed - a.failed || (b.v ?? 0) - (a.v ?? 0) || b.ply - a.ply);
  const p = cur ? all.find((x) => x.id === cur) : null;
  const meta = p ? s.libraryMeta[p.fromGame] : null;
  const opp = meta ? (meta.playerColor === 'w' ? meta.black : meta.white) : null;
  const playedSan = p ? sanLine(p.fen, [p.playedUci]) : '';
  if (p) {
    const solution = p.line?.length ? p.line : [p.bestUci];
    return (
      <div className="ac-card">
        <TrainingBoard
          key={p.id}
          fen={p.fen}
          solution={solution}
          caption={`${THEME_LABEL[p.theme] ?? p.theme}${opp ? ` · vs ${opp}` : ''} · move ${Math.floor(p.ply / 2) + 1}`}
          extra={`You played ${playedSan}. Engine line: ${sanLine(p.fen, solution)}${p.margin ? ` · next best ${p.margin.toFixed(0)}% worse` : ''}`}
          onDone={(ok) => {
            mutate((x) => { const q = x.coach.positions.find((y) => y.id === p.id); if (q) recordAttempt(q as TrainingPositionX, ok); });
            const nxt = pool.filter((x) => x.id !== p.id)[0];
            setCur(nxt ? nxt.id : null);
          }}
          onSource={() => onReview(p.fromGame, p.ply)}
        />
      </div>
    );
  }
  return (
    <>
      <div className="ac-card ac-hero-train">
        <div className="grow">
          <div className="ac-big">{due.length}</div>
          <div className="muted small">positions from your own mistakes · {all.length - due.length} mastered</div>
        </div>
        <button className="btn gold" disabled={pool.length === 0} onClick={() => setCur(pool[0].id)}>Train</button>
      </div>
      {themes.length > 0 && (
        <div className="ac-chips">
          <button className={'ac-chip' + (!theme ? ' on' : '')} onClick={() => setTheme(null)}>All {due.length}</button>
          {themes.map(([t, n]) => <button key={t} className={'ac-chip' + (theme === t ? ' on' : '')} onClick={() => setTheme(t)}>{THEME_LABEL[t] ?? t} {n}</button>)}
          {calc > 0 && <button className={'ac-chip' + (theme === 'calc' ? ' on' : '')} onClick={() => setTheme('calc')}>Calculation {calc}</button>}
        </div>
      )}
      {due.length === 0 && <div className="ac-empty">Analysed games turn your mistakes into puzzles here. Only positions with one clearly best move are kept.</div>}
      <div className="ac-grid">
        {pool.slice(0, 12).map((q) => {
          const mm = s.libraryMeta[q.fromGame];
          return (
            <button key={q.id} className="ac-tile" onClick={() => setCur(q.id)}>
              <span className="ac-k">{THEME_LABEL[q.theme] ?? q.theme}</span>
              <b>Move {Math.floor(q.ply / 2) + 1}</b>
              <span className="muted small">{mm ? `vs ${mm.playerColor === 'w' ? mm.black : mm.white}` : ''}{q.failed ? ` · ✗${q.failed}` : ''}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function Tactics() {
  const s = useSave();
  const practice = (s.coach as CoachStateX).practice ?? {};
  const list = useMemo(() => [...BUILTIN_PUZZLES].sort((a, b) => a.rating - b.rating), []);
  // Start at the first puzzle not yet solved cleanly.
  const [i, setI] = useState(() => Math.max(0, list.findIndex((p) => !(practice[p.id]?.ok > 0))));
  const [score, setScore] = useState({ ok: 0, bad: 0 });
  const p = list[i % list.length];
  const mastered = list.filter((q) => practice[q.id]?.ok > 0).length;
  return (
    <div className="ac-card">
      <div className="ac-row"><span className="ac-k grow">Tactics · {i % list.length + 1}/{list.length} · {mastered} solved</span><span className="ac-score"><b className="ok">{score.ok}</b> · <b className="bad">{score.bad}</b></span></div>
      <TrainingBoard key={p.id} fen={p.fen} solution={p.solution} caption={`${p.theme.replace(/([A-Z])/g, ' $1').toLowerCase()} · ${p.rating}`} onDone={(ok) => {
        setScore((x) => ({ ok: x.ok + (ok ? 1 : 0), bad: x.bad + (ok ? 0 : 1) }));
        mutate((x) => {
          const c = x.coach as typeof x.coach & CoachStateX;
          const e = (c.practice ??= {})[p.id] ?? { a: 0, ok: 0, last: 0 };
          c.practice[p.id] = { a: e.a + 1, ok: e.ok + (ok ? 1 : 0), last: Date.now() };
        });
        setI(i + 1);
      }} />
    </div>
  );
}

function Endgames({ focus }: { focus: string | null }) {
  const s = useSave();
  const nav = useNav();
  const ids = usePlayerGameIds(120);
  const analysedIds = ids.filter((id) => s.libraryMeta[id]?.analysed);
  const { games } = useGameRecords(analysedIds);
  const strongest = useMemo(() => [...s.world.competitors].filter((c) => c.retiredDay === null).sort((a, b) => b.skill - a.skill)[0], [s.world.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const rec = useMemo(() => {
    const score = new Map<string, number>();
    for (const g of games.values()) {
      const a = asX(g.analysis);
      const r = a?.endgameReview;
      if (!r || !g.playerColor) continue;
      const err = a?.phases?.endgame[g.playerColor].errors ?? 0;
      for (const d of ENDGAME_GUIDE[r.type]?.drills ?? []) score.set(d, (score.get(d) ?? 0) + 1 + err);
    }
    return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([d]) => d).slice(0, 3);
  }, [games]);
  const order = [...ENDGAME_DRILLS].sort((a, b) => (b.id === focus ? 1 : 0) - (a.id === focus ? 1 : 0) || (rec.includes(b.id) ? 1 : 0) - (rec.includes(a.id) ? 1 : 0) || a.difficulty - b.difficulty);
  const locked = !!s.active;
  return (
    <>
      {locked && <div className="ac-msg info">Finish your current game to start a drill.</div>}
      <div className="ac-list">
        {order.map((d) => (
          <div key={d.id} className={'ac-card ac-drill' + (d.id === focus ? ' focus' : '')}>
            <div className="grow">
              <div className="ac-row gap"><b>{d.name}</b>{(rec.includes(d.id) || d.id === focus) && <span className="ac-tag">For you</span>}</div>
              <div className="muted small">{d.goal === 'win' ? 'Win' : 'Draw'} · {'★'.repeat(d.difficulty)}<span className="ac-dim">{'★'.repeat(5 - d.difficulty)}</span></div>
              <div className="muted small ac-hint">{d.hint}</div>
            </div>
            <button className="btn small gold" disabled={locked || !strongest} onClick={() => {
              mutate((x) => startGame(x, strongest!, { kind: 'drill', tcId: 'untimed', rated: false, startFen: d.fen, color: d.fen.split(' ')[1] as 'w' | 'b' }));
              nav.play();
            }}>Train</button>
          </div>
        ))}
      </div>
    </>
  );
}

function Openings() {
  const s = useSave();
  const [moves, setMoves] = useState<string[]>([]);
  const [last, setLast] = useState<Move | null>(null);
  const ids = usePlayerGameIds(400);
  const { games } = useGameRecords(ids);
  const rep = useMemo(() => repertoire([...games.values()]), [games]);
  const c = useMemo(() => { const x = new Chess(); for (const m of moves) x.move(parseUci(m)); return x; }, [moves]);
  const locked = explorerLocked(s);
  const name = identifyOpening(moves);
  const cands = bookMoves(moves);
  const play = (u: string) => {
    const x = new Chess(c.fen());
    try { setLast(x.move(parseUci(u))); setMoves([...moves, u]); } catch { /* illegal */ }
  };
  return (
    <>
      {locked ? (
        <div className="ac-card ac-lock"><b>Explorer locked</b><div className="muted small">Opening books are closed while a rated game is in progress.</div></div>
      ) : (
        <div className="ac-card">
          <div className="ac-row"><span className="ac-k grow">{name ? name.eco : 'Explorer'}</span><span className="muted small">{OPENINGS.length} lines</span></div>
          <div className="ac-op-name">{name ? name.name : 'Starting position'}</div>
          <div className="ac-trainer-board"><Board fen={c.fen()} orientation="w" interactive onMove={play} lastMove={last} settings={s.settings} /></div>
          <div className="ac-chips">
            {cands.slice(0, 8).map((b) => {
              const san = new Chess(c.fen()).move(parseUci(b.uci)).san;
              return <button key={b.uci} className="ac-chip" onClick={() => play(b.uci)} title={b.name}><b>{san}</b> <span className="muted">{openingFamily(b.name)}</span></button>;
            })}
            {cands.length === 0 && <span className="muted small">Out of book.</span>}
          </div>
          <div className="ac-row gap">
            <button className="btn small" onClick={() => { setMoves(moves.slice(0, -1)); setLast(null); }} disabled={!moves.length}>Back</button>
            <button className="btn small" onClick={() => { setMoves([]); setLast(null); }} disabled={!moves.length}>Reset</button>
          </div>
        </div>
      )}
      <div className="ac-card">
        <span className="ac-k">Your repertoire</span>
        {rep.length === 0 && <div className="muted small ac-mt">Play a few games to see your openings.</div>}
        {rep.slice(0, 10).map((r) => {
          const n = r.w + r.d + r.l;
          return (
            <div key={r.family + r.color} className="ac-rep">
              <span className={'ac-pawn sm ' + r.color} />
              <span className="grow ac-ellipsis">{r.family}</span>
              <span className="ac-wdl" aria-label={`${r.w} wins, ${r.d} draws, ${r.l} losses`}>
                <i className="w" style={{ flex: r.w }} /><i className="d" style={{ flex: r.d }} /><i className="l" style={{ flex: r.l }} />
              </span>
              <span className="ac-rep-n">{Math.round(((r.w + r.d / 2) / n) * 100)}%</span>
              <span className="ac-rep-acc muted">{r.acc !== null ? `${r.acc.toFixed(0)}` : '—'}</span>
            </div>
          );
        })}
        {rep.length > 0 && <div className="muted small ac-mt">Score · opening accuracy</div>}
      </div>
    </>
  );
}
