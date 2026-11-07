import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Move } from 'chess.js';
import { ChessGame } from '../chess/rules';
import { getEngine } from '../engine/browserEngine';
import { chooseMove, humanDelay, type Persona } from '../engine/persona';
import { createRng, mixSeed, hashString } from '../core/rng';
import { identifyOpening } from '../chess/openings';
import { getSave, mutate, archiveGame, useSave } from './store';
import { Board } from './components/Board';
import { Portrait, Emblem } from './components/common';
import { RANKS, ARENAS } from '../world/arenas';
import { TIME_CONTROLS, type GameRecord } from '../game/state';
import { finishPlayerGame, opponentPersonaElo, type PostGame } from '../game/career';
import { PLAYER_ID } from '../world/calendar';
import { queueAnalysis } from './analysisQueue';
import { sfx } from './sound';
import { PostGameSheet } from './PostGame';
import { STYLE_LABEL } from '../engine/styles';

function fmtClock(ms: number) {
  if (ms <= 0) return '0:00';
  const s = Math.ceil(ms / 1000);
  if (s < 20) return (ms / 1000).toFixed(1);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function GameScreen({ onExit, onAnalyse, onRematch }: { onExit: () => void; onAnalyse: (id: string) => void; onRematch: (oppId: string, tc: string) => void }) {
  const s = useSave();
  const active = s.active;
  const gameRef = useRef<ChessGame | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [fen, setFen] = useState('');
  const [thinking, setThinking] = useState(false);
  const [post, setPost] = useState<{ pg: PostGame; rec: GameRecord } | null>(null);
  const [, force] = useState(0);
  const [confirm, setConfirm] = useState<'resign' | null>(null);
  const [azimuth, setAzimuth] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const cancelled = useRef(false);

  if (active && !gameRef.current) {
    gameRef.current = ChessGame.fromUci(active.record.moves, active.record.startFen);
  }
  const game = gameRef.current;
  const rec = active?.record;
  const color = rec?.playerColor ?? 'w';
  const opp = useMemo(() => (active ? s.world.competitors.find((c) => c.id === active.opponentId) : undefined), [active?.opponentId]); // eslint-disable-line react-hooks/exhaustive-deps
  const tc = TIME_CONTROLS.find((t) => t.id === rec?.tc) ?? TIME_CONTROLS[2];
  const timed = tc.baseSec > 0;

  useEffect(() => {
    if (game) setFen(game.fen());
    cancelled.current = false;
    return () => {
      cancelled.current = true;
      getEngine('play').stop();
    };
  }, [game]);

  const finish = useCallback(() => {
    const g = gameRef.current!;
    const st = g.status();
    const cur = getSave().active!;
    const record: GameRecord = { ...cur.record, result: st.result, termination: st.termination, moves: [...g.uciHistory], san: g.sanHistory() };
    record.opening = record.startFen === cur.record.startFen && record.moves.length ? identifyOpening(record.moves) : null;
    let pg: PostGame | null = null;
    mutate((sv) => {
      pg = finishPlayerGame(sv, record);
      sv.active = null;
    }, { immediate: true });
    void archiveGame(record).then(() => queueAnalysis(record.id, true));
    sfx(pg!.outcome === 'win' ? 'win' : pg!.outcome === 'loss' ? 'loss' : 'draw', getSave().settings);
    setPost({ pg: pg!, rec: record });
  }, []);

  const applyMove = useCallback((uci: string, byPlayer: boolean) => {
    const g = gameRef.current;
    if (!g) return false;
    const sv = getSave();
    const a = sv.active;
    if (!a) return false;
    const mover = g.turn();
    const m = g.playUci(uci);
    if (!m) return false;
    const now = Date.now();
    mutate((x) => {
      const act = x.active!;
      if (timed) {
        act.clockMs[mover] -= now - act.lastTick;
        act.clockMs[mover] += tc.incSec * 1000;
      }
      act.lastTick = now;
      act.record.moves = [...g.uciHistory];
      act.record.san = g.sanHistory();
      act.record.clocks = [...(act.record.clocks ?? []), act.clockMs[mover]];
    }, { immediate: true });
    setLastMove(m);
    setFen(g.fen());
    const st = g.status();
    if (st.inCheck) sfx('check', sv.settings);
    else if (m.isKingsideCastle() || m.isQueensideCastle()) sfx('castle', sv.settings);
    else if (m.captured) sfx('capture', sv.settings);
    else if (m.promotion) sfx('promote', sv.settings);
    else sfx('move', sv.settings);
    void byPlayer;
    if (st.over) finish();
    return true;
  }, [finish, timed, tc.incSec]);

  // Opponent turn.
  useEffect(() => {
    if (!game || !rec || !opp || post) return;
    if (game.status().over || game.turn() === color) return;
    let stop = false;
    setThinking(true);
    const persona: Persona = { elo: opponentPersonaElo(opp), style: opp.style, openingStyles: opp.openingStyles, seed: mixSeed(opp.portraitSeed, hashString(rec.id)) };
    const t0 = Date.now();
    const a = getSave().active;
    const oppClock = a && timed ? a.clockMs[game.turn()] : Infinity;
    const pace = oppClock < 60000 ? 'instant' : getSave().settings.opponentPace; // time management under pressure
    void chooseMove(getEngine('play'), game.fen(), game.uciHistory, persona, { pace, startFen: rec.startFen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w') ? undefined : rec.startFen })
      .then(async (mv) => {
        const rng = createRng(mixSeed(persona.seed, game.ply()));
        const wait = humanDelay(persona.elo, game.ply(), rng, pace) - (Date.now() - t0);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (stop || cancelled.current) return;
        setThinking(false);
        if (!applyMove(mv.uci, false)) console.warn('engine produced illegal move', mv);
      })
      .catch((e) => {
        console.error(e);
        setThinking(false);
      });
    return () => {
      stop = true;
    };
  }, [fen, opp, post]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clocks.
  useEffect(() => {
    if (!timed || post) return;
    const iv = setInterval(() => {
      const g = gameRef.current;
      const a = getSave().active;
      if (!g || !a || g.status().over) return;
      const side = g.turn();
      const left = a.clockMs[side] - (Date.now() - a.lastTick);
      if (left <= 0) {
        g.flag(side);
        mutate((x) => {
          x.active!.clockMs[side] = 0;
        });
        finish();
      } else force((n) => n + 1);
    }, 200);
    return () => clearInterval(iv);
  }, [timed, post, finish]);

  if (post) {
    return (
      <PostGameSheet
        pg={post.pg}
        rec={post.rec}
        onAnalyse={() => onAnalyse(post.rec.id)}
        onRematch={() => onRematch(post.rec.playerColor === 'w' ? post.rec.black.id : post.rec.white.id, post.rec.tc)}
        onContinue={onExit}
      />
    );
  }
  if (!active || !game || !rec) return null;

  const st = game.status();
  const clocks = active.clockMs;
  const liveClock = (side: 'w' | 'b') => (game.turn() === side && !st.over ? clocks[side] - (Date.now() - active.lastTick) : clocks[side]);
  const me = color === 'w' ? rec.white : rec.black;
  const them = color === 'w' ? rec.black : rec.white;
  const oppSide: 'w' | 'b' = color === 'w' ? 'b' : 'w';
  const casual = !rec.rated;
  const tournament = rec.tournamentId ? s.world.tournaments.find((t) => t.id === rec.tournamentId) : null;
  const kindLabel = rec.kind === 'trial' ? 'Promotion Trial' : tournament ? tournament.name : rec.rated ? `Rated · ${tc.label}` : `Casual · ${tc.label}`;

  return (
    <div className="game">
      <div className="game-ctx">{kindLabel}</div>
      <div className="player-bar opp">
        <Portrait seed={them.portraitSeed ?? 1} female={them.female} arena={RANKS[them.rank].arena} size={40} />
        <div className="pb-name">
          <div>{them.name}</div>
          <div className="pb-sub"><Emblem rank={them.rank} size={16} /> {RANKS[them.rank].name} · {them.rating}{opp && <> · {STYLE_LABEL[opp.style]}</>}</div>
        </div>
        {thinking && <div className="thinking" aria-label="thinking"><span /><span /><span /></div>}
        {timed && <div className={'clock' + (game.turn() === oppSide ? ' on' : '') + (liveClock(oppSide) < 20000 ? ' low' : '')}>{fmtClock(liveClock(oppSide))}</div>}
      </div>
      <Board
        fen={fen || game.fen()}
        orientation={color}
        interactive={!st.over && game.turn() === color}
        onMove={(u) => applyMove(u, true)}
        lastMove={lastMove}
        settings={s.settings}
        set={s.settings.pieceSet}
        mate={st.termination === 'checkmate'}
        azimuth={azimuth}
      />
      <div className="player-bar me">
        <Portrait seed={me.portraitSeed ?? 1} female={me.female} arena={RANKS[me.rank].arena} size={40} />
        <div className="pb-name">
          <div>{me.name}</div>
          <div className="pb-sub"><Emblem rank={me.rank} size={16} /> {RANKS[me.rank].name} · {me.rating}</div>
        </div>
        {timed && <div className={'clock' + (game.turn() === color ? ' on' : '') + (liveClock(color) < 20000 ? ' low' : '')}>{fmtClock(liveClock(color))}</div>}
      </div>
      <MoveStrip san={game.sanHistory()} />
      {notice && <div className="notice" onClick={() => setNotice(null)}>{notice}</div>}
      <div className="game-actions">
        {st.claimable.length > 0 && (
          <button className="btn gold" onClick={() => { game.claimDraw(st.claimable[0]); finish(); }}>
            Claim draw ({st.claimable[0] === 'threefold' ? 'repetition' : '50 moves'})
          </button>
        )}
        <button className="btn" onClick={() => {
          // AI accepts a draw only when its own position is not better (engine-judged, never random).
          void getEngine('play').search({ fen: game.fen(), depth: 10 }).then((r) => {
            const sc = r.lines[0]?.score;
            const cpForMover = sc?.mate !== undefined ? (sc.mate > 0 ? 9999 : -9999) : sc?.cp ?? 0;
            const cpForOpp = game.turn() === oppSide ? cpForMover : -cpForMover;
            if (game.ply() >= 30 && cpForOpp <= 30) {
              game.agreeDraw();
              finish();
            } else setNotice(`${them.name} declines the draw.`);
          });
        }} disabled={st.over}>½ Draw</button>
        <button className="btn" onClick={() => setConfirm('resign')} disabled={st.over}>⚐ Resign</button>
        {casual && <button className="btn" onClick={() => { game.undo(); if (game.turn() !== color) game.undo(); mutate((x) => { x.active!.record.moves = [...game.uciHistory]; x.active!.record.san = game.sanHistory(); }); setLastMove(null); setFen(game.fen()); }}>↶ Undo</button>}
        {s.settings.boardMode === '3d' && <button className="btn" aria-label="Rotate camera" onClick={() => setAzimuth((a) => (a > 0.5 ? -0.6 : a + 0.6))}>⟳ View</button>}
        <button className="btn" onClick={onExit} title="The game is saved; resume any time.">⏸ Later</button>
      </div>
      {confirm === 'resign' && (
        <div className="confirm">
          <span>Resign this game?</span>
          <button className="btn red" onClick={() => { game.resign(color); setConfirm(null); finish(); }}>Resign</button>
          <button className="btn" onClick={() => setConfirm(null)}>Cancel</button>
        </div>
      )}
      <div className="arena-tag">{ARENAS[rec.arena].name}</div>
    </div>
  );
}

function MoveStrip({ san }: { san: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollTo({ left: ref.current.scrollWidth, behavior: 'smooth' });
  }, [san.length]);
  const items = [];
  for (let i = 0; i < san.length; i += 2) {
    items.push(
      <span key={i} className="ms-pair">
        <i>{i / 2 + 1}.</i> {san[i]} {san[i + 1] ?? ''}
      </span>,
    );
  }
  return <div className="move-strip" ref={ref}>{items.length ? items : <span className="muted">The game begins.</span>}</div>;
}

export const PLAYER = PLAYER_ID;
