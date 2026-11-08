import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Move } from 'chess.js';
import { ChessGame, START_FEN } from '../chess/rules';
import { getEngine, setGameInProgress } from '../engine/browserEngine';
import { isAbortError } from '../engine/uci';
import { chooseMove, humanDelay, type Persona } from '../engine/persona';
import { createRng, mixSeed, hashString } from '../core/rng';
import { identifyOpening } from '../chess/openings';
import { getSave, mutate, archiveGame, useSave, pushToast } from './store';
import { Board, animMs, landingMs } from './components/Board';
import { Portrait, Emblem, Record as WDL } from './components/common';
import { RANKS, ARENAS } from '../world/arenas';
import { TIME_CONTROLS, CLOCKS_ENABLED, type GameRecord } from '../game/state';
import { finishPlayerGame, opponentPersonaElo, playerArena, type PostGame } from '../game/career';
import { PLAYER_ID } from '../world/calendar';
import { queueAnalysis } from './analysisQueue';
import { sfx } from './sound';
import { PostGameSheet } from './PostGame';
import { queueCeremonies, type CeremonyItem } from './Ceremony';
import { objectives, rivalPrep } from '../game/legacy';
import { STYLE_LABEL } from '../engine/styles';
import { IconFlag, IconHalf, IconUndo, IconPause, IconTrophy } from './components/icons';
import { backdropUri, crestUri } from './art';

function fmtClock(ms: number) {
  if (ms <= 0) return '0:00';
  const s = Math.ceil(ms / 1000);
  if (s < 20) return (ms / 1000).toFixed(1);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function GameScreen({ onExit, onAnalyse, onRematch, onNext }: { onExit: () => void; onAnalyse: (id: string) => void; onRematch: (oppId: string, tc: string) => void; onNext: () => void }) {
  const s = useSave();
  const active = s.active;
  const gameRef = useRef<ChessGame | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(null);
  const [fen, setFen] = useState('');
  const [thinking, setThinking] = useState(false);
  const [post, setPost] = useState<{ pg: PostGame; rec: GameRecord } | null>(null);
  const [ending, setEnding] = useState(false);
  const [resigned, setResigned] = useState<'w' | 'b' | null>(null);
  const [, force] = useState(0);
  const [confirm, setConfirm] = useState<'resign' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cancelled = useRef(false);

  if (active && !gameRef.current) gameRef.current = ChessGame.fromUci(active.record.moves, active.record.startFen);
  const game = gameRef.current;
  // Keep the finished game's record while its decisive moment (mate topple / resignation) plays out.
  const lastRec = useRef(active?.record);
  if (active?.record) lastRec.current = active.record;
  const rec = active?.record ?? (ending ? lastRec.current : undefined);
  const color = rec?.playerColor ?? 'w';
  const opp = useMemo(() => (active ? s.world.competitors.find((c) => c.id === active.opponentId) : undefined), [active?.opponentId]); // eslint-disable-line react-hooks/exhaustive-deps
  const tc = TIME_CONTROLS.find((t) => t.id === rec?.tc) ?? TIME_CONTROLS[2];
  // Untimed by design: clocks exist only behind the disabled CLOCKS_ENABLED flag.
  const timed = CLOCKS_ENABLED && tc.baseSec > 0;

  // Engine scheduling: hold post-game analysis while this game is being played.
  useEffect(() => {
    setGameInProgress(!!game && !post);
    return () => setGameInProgress(false);
  }, [game, post]); // eslint-disable-line react-hooks/exhaustive-deps

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
    record.opening = record.startFen === START_FEN && record.moves.length ? identifyOpening(record.moves) : null;
    let pg: PostGame | null = null;
    mutate((sv) => {
      pg = finishPlayerGame(sv, record);
      sv.active = null;
    }, { immediate: true });
    void archiveGame(record).then(() => queueAnalysis(record.id, true));
    // Let the decisive moment play out (mate topple / resignation) before the ceremony.
    const settings = getSave().settings;
    const decisive = st.termination === 'checkmate' || st.termination === 'resignation';
    const wait = settings.reduceMotion ? 0 : decisive ? animMs(settings) * 1.2 + 1100 : 500;
    setEnding(true);
    setTimeout(() => {
      sfx(pg!.outcome === 'win' ? 'win' : pg!.outcome === 'loss' ? 'loss' : 'draw', getSave().settings);
      setPost({ pg: pg!, rec: record });
      const P = pg!;
      const items: CeremonyItem[] = [];
      const next = objectives(getSave())[0]?.title ?? 'Play on';
      if (P.rankAfter > P.rankBefore && !P.rankNote?.startsWith('Placement')) {
        if (RANKS[P.rankAfter].arena > RANKS[P.rankBefore].arena) items.push({ kind: 'arena', arena: RANKS[P.rankAfter].arena, next });
        items.push({ kind: 'promotion', rank: P.rankAfter, next });
      }
      for (const a of P.trophies ?? []) items.push({ kind: 'trophy', award: a });
      if (P.seasonReport) items.push({ kind: 'season', report: P.seasonReport });
      if (items.length) queueCeremonies(items);
      for (const a of P.achievements) pushToast(a, 'achievement');
    }, wait);
  }, []);

  const applyMove = useCallback((uci: string) => {
    const g = gameRef.current;
    if (!g || !getSave().active) return false;
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
    const sv = getSave();
    // The opponent's move is pre-highlighted first: its sound plays when the piece lands.
    const cue = st.inCheck ? 'check' : m.isKingsideCastle() || m.isQueensideCastle() ? 'castle' : m.captured ? 'capture' : m.promotion ? 'promote' : 'move';
    const delay = mover !== (getSave().active?.record.playerColor ?? 'w') ? landingMs(sv.settings) : 0;
    if (delay > 0) setTimeout(() => !cancelled.current && sfx(cue, getSave().settings), delay);
    else sfx(cue, sv.settings);
    if (st.over) finish();
    return true;
  }, [finish, timed, tc.incSec]);

  // Opponent turn.
  useEffect(() => {
    if (!game || !rec || !opp || post || ending) return;
    if (game.status().over || game.turn() === color) return;
    let stop = false;
    setThinking(true);
    const persona: Persona = { elo: opponentPersonaElo(opp), style: opp.style, openingStyles: opp.openingStyles, seed: mixSeed(opp.portraitSeed, hashString(rec.id)) };
    const t0 = Date.now();
    const a = getSave().active;
    const oppClock = a && timed ? a.clockMs[game.turn()] - (Date.now() - a.lastTick) : Infinity;
    const pace = oppClock < 60000 ? 'instant' : getSave().settings.opponentPace;
    const side = game.turn();
    const clock = a && timed ? { myMs: oppClock, oppMs: a.clockMs[side === 'w' ? 'b' : 'w'], incMs: tc.incSec * 1000, moveNumber: Math.floor(game.ply() / 2) + 1 } : undefined;
    const prep = rivalPrep(getSave(), opp.id); // legitimate preparation only: opening choice, never strength
    const ac = new AbortController();
    void chooseMove(getEngine('play', { elo: persona.elo }), game.fen(), game.uciHistory, persona, { pace, clock, prep, signal: ac.signal, startFen: rec.startFen === START_FEN ? undefined : rec.startFen })
      .then(async (mv) => {
        const rng = createRng(mixSeed(persona.seed, game.ply()));
        // Wait at least for the player's move animation to land, so motion never overlaps.
        const minWait = animMs(getSave().settings) + 120;
        const wait = Math.max(minWait, humanDelay(persona.elo, game.ply(), rng, pace, clock)) - (Date.now() - t0);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (stop || cancelled.current) return;
        setThinking(false);
        if (!applyMove(mv.uci)) console.warn('engine produced illegal move', mv);
      })
      .catch((e) => {
        if (isAbortError(e)) return;
        console.error(e);
        setThinking(false);
      });
    return () => {
      stop = true;
      ac.abort();
    };
  }, [fen, opp, post, ending]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clocks.
  useEffect(() => {
    if (!timed || post || ending) return;
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
  }, [timed, post, ending, finish]);

  if (post) {
    return (
      <PostGameSheet
        pg={post.pg}
        rec={post.rec}
        onAnalyse={() => onAnalyse(post.rec.id)}
        onRematch={() => onRematch(post.rec.playerColor === 'w' ? post.rec.black.id : post.rec.white.id, post.rec.tc)}
        onNext={onNext}
      />
    );
  }
  if (!game || !rec || (!active && !ending)) return null;

  const st = game.status();
  const clocks = active?.clockMs ?? { w: 0, b: 0 };
  const lastTick = active?.lastTick ?? Date.now();
  const liveClock = (side: 'w' | 'b') => (game.turn() === side && !st.over && !ending ? clocks[side] - (Date.now() - lastTick) : clocks[side]);
  const me = color === 'w' ? rec.white : rec.black;
  const them = color === 'w' ? rec.black : rec.white;
  const oppSide: 'w' | 'b' = color === 'w' ? 'b' : 'w';
  const casual = !rec.rated;
  const tournament = rec.tournamentId ? s.world.tournaments.find((t) => t.id === rec.tournamentId) : null;
  const kindLabel = rec.kind === 'trial' ? 'Promotion Trial' : tournament ? tournament.name : rec.rated ? `Ranked · ${tc.label}` : `Casual · ${tc.label}`;
  const h2h = opp ? s.player.h2h[opp.id] : undefined;
  const isRival = opp && s.player.rivalId === opp.id;
  const san = game.sanHistory();
  const disabled = st.over || ending;

  const actions = (
    <div className="game-actions">
      {st.claimable.length > 0 && !disabled && (
        <button className="btn gold" onClick={() => { game.claimDraw(st.claimable[0]); finish(); }}>Claim draw</button>
      )}
      <button className="btn" disabled={disabled} title="Offer a draw" onClick={() => {
        // The AI accepts only when the engine judges its own position not better (never random).
        void getEngine('play').search({ fen: game.fen(), depth: 10 }).then((r) => {
          const sc = r.lines[0]?.score;
          const cpForMover = sc?.mate !== undefined ? (sc.mate > 0 ? 9999 : -9999) : sc?.cp ?? 0;
          const cpForOpp = game.turn() === oppSide ? cpForMover : -cpForMover;
          if (game.ply() >= 30 && cpForOpp <= 30) {
            game.agreeDraw();
            finish();
          } else setNotice(`${them.name.split(' ')[0]} declines.`);
        });
      }}><IconHalf size={18} /> Draw</button>
      <button className="btn" disabled={disabled} onClick={() => setConfirm('resign')}><IconFlag size={18} /> Resign</button>
      {casual && (
        <button className="btn" disabled={disabled} onClick={() => {
          game.undo();
          if (game.turn() !== color) game.undo();
          mutate((x) => { x.active!.record.moves = [...game.uciHistory]; x.active!.record.san = game.sanHistory(); });
          setLastMove(null);
          setFen(game.fen());
        }}><IconUndo size={18} /> Undo</button>
      )}
      <button className="btn" onClick={onExit} title="Saved — resume any time, no clock"><IconPause size={18} /> <span className="lbl-long">Pause & leave</span><span className="lbl-short">Pause</span></button>
    </div>
  );

  const controls = (
    <>
      {actions}
      {notice && <div className="notice" onClick={() => setNotice(null)}>{notice}</div>}
      {confirm === 'resign' && (
        <div className="confirm">
          <span>Resign?</span>
          <button className="btn red small" onClick={() => { game.resign(color); setResigned(color); setConfirm(null); finish(); }}>Resign</button>
          <button className="btn small" onClick={() => setConfirm(null)}>Cancel</button>
        </div>
      )}
    </>
  );

  const arenaIdx = tournament ? tournament.arena : playerArena(s);
  const myTurn = !disabled && game.turn() === color;
  return (
    <div className="stage in-game">
      <div className="stage-main" style={{ ['--backdrop' as string]: `url("${backdropUri(arenaIdx)}")` }}>
        <div className="stage-title">
          <img className="stage-crest" src={crestUri(arenaIdx)} alt="" />
          <div className="grow">
            <div className="stage-arena">{ARENAS[arenaIdx].name}</div>
            <div className="stage-motto">{tournament && <IconTrophy size={14} />} {kindLabel}</div>
          </div>
        </div>
        <div className="player-bar opp">
          <Portrait seed={them.portraitSeed ?? 1} female={them.female} arena={RANKS[them.rank].arena} size={42} />
          <div className="pb-name">
            <div>{them.name}</div>
            <div className="pb-sub"><Emblem rank={them.rank} size={16} /> {RANKS[them.rank].name}</div>
          </div>
          {thinking ? <div className="thinking" aria-label="thinking"><span /><span /><span /></div> : <span className="pb-elo">{them.rating}</span>}
          {timed && <div className={'clock' + (game.turn() === oppSide && !disabled ? ' on' : '')}>{fmtClock(liveClock(oppSide))}</div>}
        </div>
        <Board
          fen={fen || game.fen()}
          orientation={color}
          interactive={!disabled && game.turn() === color}
          onMove={(u) => applyMove(u)}
          lastMove={lastMove}
          settings={s.settings}
          set={arenaIdx}
          arena={arenaIdx}
          mate={st.termination === 'checkmate'}
          resigned={resigned}
        />
        <div className="player-bar me">
          <Portrait seed={me.portraitSeed ?? 1} female={me.female} arena={RANKS[me.rank].arena} size={42} />
          <div className="pb-name">
            <div>{me.name}</div>
            <div className="pb-sub"><Emblem rank={me.rank} size={16} /> {RANKS[me.rank].name}</div>
          </div>
          {myTurn ? <span className="turn-tag">Your move</span> : <span className="pb-elo">{me.rating}</span>}
          {timed && <div className={'clock' + (game.turn() === color && !disabled ? ' on' : '')}>{fmtClock(liveClock(color))}</div>}
        </div>
        <div className="stage-controls">{controls}</div>
      </div>
      <div className="stage-side">
        <div className="card">
          <div className="row">
            <Portrait seed={them.portraitSeed ?? 1} female={them.female} arena={RANKS[them.rank].arena} size={52} />
            <div className="grow">
              <b>{them.name}</b>
              <div className="muted small">{opp ? `${STYLE_LABEL[opp.style] ?? opp.style} · ${opp.origin}` : ''}</div>
              {opp && <div className="small"><WDL w={opp.w} d={opp.d} l={opp.l} /></div>}
            </div>
          </div>
          {h2h && <div className={isRival ? 'rival-line' : 'muted small'} style={{ marginTop: 10, marginBottom: 0 }}>{isRival ? 'Rival · ' : 'You vs them · '}<WDL {...h2h} /></div>}
        </div>
        <div className="move-strip" aria-label="Moves">
          {san.length === 0 ? <span className="muted">No moves yet — take all the time you need.</span> : san.map((m, i) => (i % 2 === 0 ? <span key={i} className="ms-pair"><i>{i / 2 + 1}.</i> {m} {san[i + 1] ?? ''}</span> : null))}
        </div>
        <div className="side-controls">{controls}</div>
        {s.player.w + s.player.d + s.player.l === 0 && san.length < 4 && (
          <div className="notice small">Drag a piece or tap it, then its square. No clock — think as long as you like, or leave and resume later.</div>
        )}
      </div>
    </div>
  );
}

export const PLAYER = PLAYER_ID;
