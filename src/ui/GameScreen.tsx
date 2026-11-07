import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Move } from 'chess.js';
import { ChessGame, START_FEN } from '../chess/rules';
import { getEngine } from '../engine/browserEngine';
import { chooseMove, humanDelay, type Persona } from '../engine/persona';
import { createRng, mixSeed, hashString } from '../core/rng';
import { identifyOpening } from '../chess/openings';
import { getSave, mutate, archiveGame, useSave } from './store';
import { Board, animMs } from './components/Board';
import { Portrait, Emblem, Record as WDL } from './components/common';
import { RANKS, ARENAS } from '../world/arenas';
import { TIME_CONTROLS, type GameRecord } from '../game/state';
import { finishPlayerGame, opponentPersonaElo, playerArena, type PostGame } from '../game/career';
import { PLAYER_ID } from '../world/calendar';
import { queueAnalysis } from './analysisQueue';
import { sfx } from './sound';
import { PostGameSheet } from './PostGame';
import { queueCeremonies, type CeremonyItem } from './Ceremony';
import { objectives } from '../game/legacy';
import { STYLE_LABEL } from '../engine/styles';
import { IconFlag, IconHalf, IconUndo, IconRotate, IconPause, IconTrophy } from './components/icons';

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
  const [azimuth, setAzimuth] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const cancelled = useRef(false);

  if (active && !gameRef.current) gameRef.current = ChessGame.fromUci(active.record.moves, active.record.startFen);
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
    if (st.inCheck) sfx('check', sv.settings);
    else if (m.isKingsideCastle() || m.isQueensideCastle()) sfx('castle', sv.settings);
    else if (m.captured) sfx('capture', sv.settings);
    else if (m.promotion) sfx('promote', sv.settings);
    else sfx('move', sv.settings);
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
    void chooseMove(getEngine('play'), game.fen(), game.uciHistory, persona, { pace, startFen: rec.startFen === START_FEN ? undefined : rec.startFen })
      .then(async (mv) => {
        const rng = createRng(mixSeed(persona.seed, game.ply()));
        // Wait at least for the player's move animation to land, so motion never overlaps.
        const minWait = animMs(getSave().settings) + 120;
        const wait = Math.max(minWait, humanDelay(persona.elo, game.ply(), rng, pace)) - (Date.now() - t0);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        if (stop || cancelled.current) return;
        setThinking(false);
        if (!applyMove(mv.uci)) console.warn('engine produced illegal move', mv);
      })
      .catch((e) => {
        console.error(e);
        setThinking(false);
      });
    return () => {
      stop = true;
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
      {s.settings.boardMode === '3d' && <button className="btn" aria-label="Rotate view" onClick={() => setAzimuth((a) => (a > 0.5 ? -0.6 : a + 0.6))}><IconRotate size={18} /></button>}
      <button className="btn" onClick={onExit} title="Saved — resume any time"><IconPause size={18} /> Later</button>
    </div>
  );

  return (
    <div className="game">
      <div className="game-main">
        <div className="game-ctx">{tournament && <IconTrophy size={14} />}{kindLabel}</div>
        <div className="player-bar opp">
          <Portrait seed={them.portraitSeed ?? 1} female={them.female} arena={RANKS[them.rank].arena} size={44} />
          <div className="pb-name">
            <div>{them.name}</div>
            <div className="pb-sub"><Emblem rank={them.rank} size={16} /> {RANKS[them.rank].name} · {them.rating}</div>
          </div>
          {thinking && <div className="thinking" aria-label="thinking"><span /><span /><span /></div>}
          {timed && <div className={'clock' + (game.turn() === oppSide && !disabled ? ' on' : '') + (liveClock(oppSide) < 20000 ? ' low' : '')}>{fmtClock(liveClock(oppSide))}</div>}
        </div>
        <Board
          fen={fen || game.fen()}
          orientation={color}
          interactive={!disabled && game.turn() === color}
          onMove={(u) => applyMove(u)}
          lastMove={lastMove}
          settings={s.settings}
          set={tournament ? tournament.arena : playerArena(s)}
          mate={st.termination === 'checkmate'}
          resigned={resigned}
          azimuth={azimuth}
        />
        <div className="player-bar me">
          <Portrait seed={me.portraitSeed ?? 1} female={me.female} arena={RANKS[me.rank].arena} size={44} />
          <div className="pb-name">
            <div>{me.name}</div>
            <div className="pb-sub"><Emblem rank={me.rank} size={16} /> {RANKS[me.rank].name} · {me.rating}</div>
          </div>
          {timed && <div className={'clock' + (game.turn() === color && !disabled ? ' on' : '') + (liveClock(color) < 20000 ? ' low' : '')}>{fmtClock(liveClock(color))}</div>}
        </div>
        {notice && <div className="notice" onClick={() => setNotice(null)}>{notice}</div>}
        {confirm === 'resign' && (
          <div className="confirm">
            <span>Resign?</span>
            <button className="btn red small" onClick={() => { game.resign(color); setResigned(color); setConfirm(null); finish(); }}>Resign</button>
            <button className="btn small" onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        )}
      </div>
      <div className="game-side">
        <div className="card side-card">
          <div className="kicker">{ARENAS[tournament ? tournament.arena : playerArena(s)].name}</div>
          <div className="row" style={{ marginTop: 6 }}>
            <div className="grow">
              <b>{them.name}</b>
              <div className="muted small">{opp ? `${STYLE_LABEL[opp.style] ?? opp.style} · ${opp.origin}` : ''}</div>
            </div>
            {opp && <div className="small"><WDL w={opp.w} d={opp.d} l={opp.l} /></div>}
          </div>
          {h2h && <div className={isRival ? 'rival-line' : 'muted small'} style={{ marginTop: 6 }}>{isRival ? 'Rival · ' : 'You vs them · '}<WDL {...h2h} /></div>}
        </div>
        <div className="move-strip" aria-label="Moves">
          {san.length === 0 ? <span className="muted">The game begins.</span> : san.map((m, i) => (i % 2 === 0 ? <span key={i} className="ms-pair"><i>{i / 2 + 1}.</i> {m} {san[i + 1] ?? ''}</span> : null))}
        </div>
        {actions}
      </div>
    </div>
  );
}

export const PLAYER = PLAYER_ID;
