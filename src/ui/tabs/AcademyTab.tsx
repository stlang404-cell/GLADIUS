import { useMemo, useState } from 'react';
import { Chess, type Move } from 'chess.js';
import { useSave, mutate, archiveGame } from '../store';
import { useNav } from '../nav';
import { Card, Record } from '../components/common';
import { Board } from '../components/Board';
import { bookMoves, identifyOpening, openingFamily, OPENINGS } from '../../chess/openings';
import { ENDGAME_DRILLS } from '../../chess/endgames';
import { BUILTIN_PUZZLES } from '../../chess/puzzles';
import { importPgn, validateFen, parseUci, START_FEN } from '../../chess/rules';
import { startGame } from '../../game/career';
import { coachReport } from '../../analysis/coach';
import type { GameRecord } from '../../game/state';
import { queueAnalysis } from '../analysisQueue';
import { CLASS_META } from '../../analysis/classify';

type Sec = 'library' | 'coach' | 'puzzles' | 'endgames' | 'openings' | 'import';

export function AcademyTab() {
  const [sec, setSec] = useState<Sec>('library');
  return (
    <div className="tab-page">
      <div className="seg">
        {(['library', 'coach', 'puzzles', 'endgames', 'openings', 'import'] as Sec[]).map((x) => (
          <button key={x} className={sec === x ? 'on' : ''} onClick={() => setSec(x)}>
            {{ library: 'Games', coach: 'Coach', puzzles: 'Puzzles', endgames: 'Endgames', openings: 'Openings', import: 'PGN/FEN' }[x]}
          </button>
        ))}
      </div>
      {sec === 'library' && <Library />}
      {sec === 'coach' && <Coach />}
      {sec === 'puzzles' && <Puzzles />}
      {sec === 'endgames' && <Endgames />}
      {sec === 'openings' && <Openings />}
      {sec === 'import' && <ImportBox />}
    </div>
  );
}

function Library() {
  const s = useSave();
  const nav = useNav();
  const [filter, setFilter] = useState<'mine' | 'all'>('mine');
  const ids = [...s.library].reverse().filter((id) => filter === 'all' || s.libraryMeta[id]?.playerColor);
  return (
    <>
      <div className="chips">
        <button className={'chip' + (filter === 'mine' ? ' on' : '')} onClick={() => setFilter('mine')}>My games</button>
        <button className={'chip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>All (incl. broadcasts)</button>
      </div>
      {ids.length === 0 && <Card><div className="muted">Your permanent game library is empty. Every finished game is saved here with full analysis.</div></Card>}
      {ids.slice(0, 200).map((id) => {
        const m = s.libraryMeta[id];
        if (!m) return null;
        const res = m.playerColor ? (m.result === '1/2-1/2' ? 'draw' : (m.result === '1-0') === (m.playerColor === 'w') ? 'win' : 'loss') : '';
        return (
          <Card key={id} className={'game-row ' + res} onClick={() => nav.open({ kind: 'analysis', gameId: id })}>
            <div className="row">
              <span className={'res-dot ' + res} />
              <div className="grow">
                <b>{m.white}</b> – <b>{m.black}</b> <span className="muted">{m.result}</span>
                <div className="muted small">{m.opening ?? 'Unclassified opening'} · {m.kind}{m.eloDelta !== undefined ? ` · ${m.eloDelta >= 0 ? '+' : ''}${m.eloDelta}` : ''}</div>
              </div>
              {m.analysed ? <b>{m.accuracy !== undefined ? `${m.accuracy.toFixed(0)}%` : '✓'}</b> : <button className="btn small" onClick={(e) => { e.stopPropagation(); queueAnalysis(id, true); }}>Analyse</button>}
            </div>
          </Card>
        );
      })}
    </>
  );
}

function Coach() {
  const s = useSave();
  const nav = useNav();
  const rep = useMemo(() => coachReport(s), [s.library.length, Object.keys(s.libraryMeta).length, s.coach.positions.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [train, setTrain] = useState<number | null>(null);
  const pos = s.coach.positions.filter((p) => p.solved < 2);
  return (
    <>
      <Card title="Your coach">
        <div className="coach-rec">{rep.recommendation}</div>
        {rep.findings.map((f, i) => (
          <details key={i} className="finding">
            <summary><b>{f.title}</b> <span className="muted">{f.short}</span></summary>
            <div className="muted small">{f.detail}</div>
          </details>
        ))}
        {rep.findings.length === 0 && <div className="muted">Play and analyse a few games — patterns appear after about five analysed games.</div>}
      </Card>
      <Card title={`Training from your games (${pos.length})`}>
        {pos.length === 0 && <div className="muted">Positions where you went wrong will appear here after analysis.</div>}
        {train !== null && pos[train] ? (
          <TrainingBoard
            fen={pos[train].fen}
            solution={[pos[train].bestUci]}
            theme={pos[train].theme}
            onDone={(ok) => {
              const id = pos[train].id;
              mutate((x) => { const p = x.coach.positions.find((q) => q.id === id); if (p) { if (ok) p.solved++; else p.failed++; } });
              setTrain(null);
            }}
            onSource={() => nav.open({ kind: 'analysis', gameId: pos[train].fromGame })}
          />
        ) : (
          <div className="chips wrap">
            {pos.slice(-24).map((p) => (
              <button key={p.id} className="chip" onClick={() => setTrain(pos.indexOf(p))}>{p.theme} · move {Math.floor(p.ply / 2) + 1}{p.failed ? ` ✗${p.failed}` : ''}</button>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}

/** Find-the-best-move trainer. `solution` holds trainee moves at even indices, replies at odd. */
function TrainingBoard({ fen, solution, theme, onDone, onSource }: { fen: string; solution: string[]; theme: string; onDone: (ok: boolean) => void; onSource?: () => void }) {
  const s = useSave();
  const [cur, setCur] = useState(fen);
  const [idx, setIdx] = useState(0);
  const [last, setLast] = useState<Move | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const turn = new Chess(fen).turn();
  const play = (uci: string) => {
    const c = new Chess(cur);
    const want = solution[idx];
    let m: Move;
    try { m = c.move(parseUci(uci)); } catch { return; }
    const ok = uci === want || (c.isCheckmate() && idx === solution.length - 1);
    if (!ok) {
      setMsg('Not quite — try again, or reveal.');
      setFailed(true);
      return;
    }
    setLast(m);
    let fenNow = c.fen();
    let next = idx + 1;
    if (next < solution.length) {
      const r = c.move(parseUci(solution[next]));
      setLast(r);
      fenNow = c.fen();
      next++;
    }
    setCur(fenNow);
    setIdx(next);
    if (next >= solution.length) setMsg(failed ? 'Solved (with a miss).' : '✓ Correct!');
  };
  const done = idx >= solution.length;
  return (
    <div className="trainer">
      <div className="muted">{turn === 'w' ? 'White' : 'Black'} to move · {theme}</div>
      <div className="trainer-board"><Board fen={cur} orientation={turn} interactive={!done} onMove={play} lastMove={last} settings={{ ...s.settings, boardMode: '2d' }} /></div>
      {msg && <div className="notice">{msg}</div>}
      <div className="row gap">
        {!done && <button className="btn small" onClick={() => { setMsg(`Answer: ${new Chess(cur).move(parseUci(solution[idx])).san}`); setFailed(true); }}>Reveal</button>}
        {done && <button className="btn gold small" onClick={() => onDone(!failed)}>Next</button>}
        {!done && <button className="btn small" onClick={() => onDone(false)}>Skip</button>}
        {onSource && <button className="btn small" onClick={onSource}>Source game</button>}
      </div>
    </div>
  );
}

function Puzzles() {
  const [i, setI] = useState(0);
  const [score, setScore] = useState({ ok: 0, bad: 0 });
  const p = BUILTIN_PUZZLES[i % BUILTIN_PUZZLES.length];
  return (
    <Card title={`Tactics · ${score.ok}✓ ${score.bad}✗`}>
      <TrainingBoard key={p.id} fen={p.fen} solution={p.solution} theme={`${p.theme} · ${p.rating}`} onDone={(ok) => { setScore((x) => ({ ok: x.ok + (ok ? 1 : 0), bad: x.bad + (ok ? 0 : 1) })); setI(i + 1); }} />
    </Card>
  );
}

function Endgames() {
  const s = useSave();
  const nav = useNav();
  const strongest = useMemo(() => [...s.world.competitors].filter((c) => c.retiredDay === null).sort((a, b) => b.skill - a.skill)[0], [s.world.day]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Card><div className="muted">Play each position out against a full-strength engine defender. Unrated.</div></Card>
      {ENDGAME_DRILLS.map((d) => (
        <Card key={d.id} className="drill">
          <div className="row">
            <div className="grow"><b>{d.name}</b> <span className="muted">{'★'.repeat(d.difficulty)}</span><div className="muted small">Goal: {d.goal} · {d.hint}</div></div>
            <button className="btn small gold" disabled={!!s.active || !strongest} onClick={() => {
              mutate((x) => startGame(x, strongest!, { kind: 'drill', tcId: 'untimed', rated: false, startFen: d.fen, color: d.fen.split(' ')[1] as 'w' | 'b' }));
              nav.play();
            }}>Train</button>
          </div>
        </Card>
      ))}
    </>
  );
}

function Openings() {
  const s = useSave();
  const [moves, setMoves] = useState<string[]>([]);
  const [last, setLast] = useState<Move | null>(null);
  const c = useMemo(() => { const x = new Chess(); for (const m of moves) x.move(parseUci(m)); return x; }, [moves]);
  const name = identifyOpening(moves);
  const cands = bookMoves(moves);
  const mine = Object.entries(s.player.openingsPlayed).sort((a, b) => b[1].w + b[1].d + b[1].l - (a[1].w + a[1].d + a[1].l)).slice(0, 8);
  const play = (u: string) => {
    const x = new Chess(c.fen());
    try { setLast(x.move(parseUci(u))); setMoves([...moves, u]); } catch { /* illegal */ }
  };
  return (
    <>
      <Card title={name ? `${name.eco} · ${name.name}` : 'Opening explorer'}>
        <div className="trainer-board"><Board fen={c.fen()} orientation="w" interactive onMove={play} lastMove={last} settings={{ ...s.settings, boardMode: '2d' }} /></div>
        <div className="row gap">
          <button className="btn small" onClick={() => { setMoves(moves.slice(0, -1)); setLast(null); }} disabled={!moves.length}>◀ Back</button>
          <button className="btn small" onClick={() => { setMoves([]); setLast(null); }}>Reset</button>
        </div>
        <div className="chips wrap">
          {cands.map((b) => {
            const san = new Chess(c.fen()).move(parseUci(b.uci)).san;
            return <button key={b.uci} className="chip" onClick={() => play(b.uci)} title={b.name}>{san} <span className="muted">{openingFamily(b.name)}</span></button>;
          })}
          {cands.length === 0 && <span className="muted small">Out of book.</span>}
        </div>
        <div className="muted small">{OPENINGS.length} named lines in the book.</div>
      </Card>
      {mine.length > 0 && (
        <Card title="Your repertoire">
          {mine.map(([n, r]) => <div key={n} className="leader"><span className="grow">{n}</span><Record w={r.w} d={r.d} l={r.l} /></div>)}
        </Card>
      )}
    </>
  );
}

function ImportBox() {
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
      const strongest = [...s.world.competitors].filter((c) => c.retiredDay === null).sort((a, b) => b.skill - a.skill)[0];
      mutate((x) => startGame(x, strongest, { kind: 'casual', tcId: 'untimed', rated: false, startFen: t, color: t.split(' ')[1] as 'w' | 'b' }));
      nav.play();
      return;
    }
    try {
      const imp = importPgn(t);
      const g: GameRecord = {
        id: `imp-${Date.now().toString(36)}`, kind: 'casual', rated: false, pool: 'untimed', tc: 'untimed', day: s.world.day, date: new Date().toISOString(),
        white: { id: 'ext-w', name: imp.headers.White ?? 'White', rating: Number(imp.headers.WhiteElo) || 0, rank: 0 },
        black: { id: 'ext-b', name: imp.headers.Black ?? 'Black', rating: Number(imp.headers.BlackElo) || 0, rank: 0 },
        playerColor: null, startFen: imp.startFen, moves: imp.moves,
        san: (() => { const c = new Chess(imp.startFen); return imp.moves.map((m) => c.move(parseUci(m)).san); })(),
        result: (imp.headers.Result as GameRecord['result']) ?? '*', termination: 'ongoing', arena: 0, source: 'player',
        opening: imp.startFen === START_FEN ? identifyOpening(imp.moves) : null,
      };
      await archiveGame(g);
      queueAnalysis(g.id, true);
      nav.open({ kind: 'analysis', gameId: g.id });
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  return (
    <Card title="Import PGN or FEN">
      <textarea className="import" value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste a PGN to analyse it, or a FEN to play it out against the strongest engine." rows={8} />
      {err && <div className="error">{err}</div>}
      <button className="btn gold" onClick={() => void doImport()}>Import</button>
    </Card>
  );
}

export { CLASS_META };
