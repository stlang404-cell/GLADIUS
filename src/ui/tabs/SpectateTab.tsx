import { useEffect, useMemo, useRef, useState } from 'react';
import type { Move } from 'chess.js';
import { useSave, mutate, archiveGame, getSave } from '../store';
import { useNav } from '../nav';
import { Card, CompetitorPortrait, Emblem } from '../components/common';
import { Board } from '../components/Board';
import { EvalBar } from '../AnalysisView';
import { ChessGame, START_FEN } from '../../chess/rules';
import { getEngine } from '../../engine/browserEngine';
import { chooseMove, type Persona } from '../../engine/persona';
import { mixSeed, hashString } from '../../core/rng';
import { RANKS, ARENAS } from '../../world/arenas';
import { pendingPairings } from '../../tournament/formats';
import { recordEngineTournamentGame, PLAYER_ID } from '../../world/calendar';
import { hooksFor, opponentPersonaElo, sideFor, newGameId } from '../../game/career';
import { identifyOpening } from '../../chess/openings';
import type { Competitor } from '../../world/types';
import type { GameRecord, Save } from '../../game/state';
import { sfx } from '../sound';
import type { Score } from '../../engine/uci';

type Feature = { id: string; label: string; white: Competitor; black: Competitor; tournamentId?: string; pairingId?: string; arena: number; weight: number };

function features(s: Save): Feature[] {
  const byId = new Map(s.world.competitors.map((c) => [c.id, c]));
  const out: Feature[] = [];
  for (const t of s.world.tournaments) {
    if (t.status !== 'running' || !t.state) continue;
    for (const p of pendingPairings(t.state)) {
      if (!t.featured.includes(p.id) && !(t.kind === 'championship')) continue;
      if (p.white === PLAYER_ID || p.black === PLAYER_ID || !p.black) continue;
      const w = byId.get(p.white);
      const b = byId.get(p.black);
      if (!w || !b) continue;
      out.push({ id: p.id, label: t.name + (p.armageddon ? ' · Armageddon' : p.tiebreakOf ? ' · Tiebreak' : ''), white: w, black: b, tournamentId: t.id, pairingId: p.id, arena: t.arena, weight: t.arena * 10 + (t.kind === 'championship' ? 50 : 0) });
    }
  }
  out.sort((a, b) => b.weight - a.weight);
  if (s.player.rivalId) {
    const r = byId.get(s.player.rivalId);
    if (r) {
      const opp = s.world.competitors.filter((c) => c.retiredDay === null && c.id !== r.id && Math.abs(c.rating - r.rating) < 60)[0];
      if (opp) out.push({ id: 'rival-ex', label: 'Featured rivalry · exhibition (unrated)', white: r, black: opp, arena: RANKS[r.rank].arena, weight: 0 });
    }
  }
  const elite = s.world.competitors.filter((c) => c.retiredDay === null).sort((a, b) => b.rating - a.rating).slice(0, 2);
  if (elite.length === 2) out.push({ id: 'elite-ex', label: 'Elite exhibition (unrated)', white: elite[0], black: elite[1], arena: RANKS[elite[0].rank].arena, weight: 0 });
  return out.slice(0, 16);
}

export function SpectateTab() {
  const s = useSave();
  const nav = useNav();
  const list = useMemo(() => features(s), [s.world.day, s.world.tournaments.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [live, setLive] = useState<Feature | null>(null);
  const broadcasts = [...s.library].reverse().filter((id) => s.libraryMeta[id]?.source === 'engine').slice(0, 20);
  if (live) return <LiveBroadcast f={live} onExit={() => setLive(null)} />;
  return (
    <div className="page">
      <Card title="Live from the empire">
        <div className="muted small">Broadcasts are real engine games played now, move by move, at each competitor's strength. Tournament broadcasts decide the actual result.</div>
      </Card>
      {list.map((f) => (
        <Card key={f.id} className="feature" onClick={() => setLive(f)}>
          <div className="kicker">{f.label} · {ARENAS[f.arena].name}</div>
          <div className="vs-row">
            <div className="vs-side"><CompetitorPortrait c={f.white} day={s.world.day} size={48} /><b>{f.white.name}</b><span className="muted"><Emblem rank={f.white.rank} size={14} /> {f.white.rating}</span></div>
            <div className="vs">VS</div>
            <div className="vs-side"><CompetitorPortrait c={f.black} day={s.world.day} size={48} /><b>{f.black.name}</b><span className="muted"><Emblem rank={f.black.rank} size={14} /> {f.black.rating}</span></div>
          </div>
        </Card>
      ))}
      {broadcasts.length > 0 && (
        <Card title="Replays">
          {broadcasts.map((id) => {
            const m = s.libraryMeta[id];
            return <div key={id} className="leader" onClick={() => nav.open({ kind: 'analysis', gameId: id })}><span className="grow">{m.white} – {m.black}</span><b>{m.result}</b></div>;
          })}
        </Card>
      )}
    </div>
  );
}

const SPEEDS = [0.5, 1, 2, 4];

function LiveBroadcast({ f, onExit }: { f: Feature; onExit: () => void }) {
  const s = useSave();
  const nav = useNav();
  const game = useRef(new ChessGame());
  const [fen, setFen] = useState(START_FEN);
  const [last, setLast] = useState<Move | null>(null);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [evalScore, setEval] = useState<Score | undefined>();
  const [showEval, setShowEval] = useState(true);
  const [done, setDone] = useState<string | null>(null);
  const [azimuth, setAz] = useState(0);
  const ctl = useRef({ paused: false, speed: 1, alive: true });
  ctl.current.paused = paused;
  ctl.current.speed = speed;

  useEffect(() => {
    ctl.current.alive = true;
    const eng = getEngine('spectate');
    const g = game.current;
    const seed = hashString(f.id + s.world.day);
    const persona = (c: Competitor): Persona => ({ elo: opponentPersonaElo(c), style: c.style, openingStyles: c.openingStyles, seed: mixSeed(seed, c.portraitSeed) });
    const pw = persona(f.white);
    const pb = persona(f.black);
    void (async () => {
      await eng.newGame();
      while (ctl.current.alive && !g.status().over && g.ply() < 400) {
        while (ctl.current.paused && ctl.current.alive) await new Promise((r) => setTimeout(r, 150));
        const t0 = Date.now();
        const mv = await chooseMove(eng, g.fen(), g.uciHistory, g.turn() === 'w' ? pw : pb, { pace: 'instant' });
        if (!ctl.current.alive) return;
        const m = g.playUci(mv.uci);
        if (!m) break;
        setLast(m);
        setFen(g.fen());
        sfx(m.captured ? 'capture' : 'move', getSave().settings);
        // Live evaluation of the CURRENT position only — never future moves.
        const ev = await eng.search({ fen: g.fen(), depth: 9 });
        const sc = ev.lines[0]?.score;
        if (sc) setEval(g.turn() === 'w' ? sc : sc.mate !== undefined ? { mate: -sc.mate } : { cp: -(sc.cp ?? 0) });
        const wait = 1400 / ctl.current.speed - (Date.now() - t0);
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
      }
      if (!ctl.current.alive) return;
      if (!g.status().over) g.agreeDraw(); // adjudicated after 200 moves
      const st = g.status();
      const rec: GameRecord = {
        id: newGameId(getSave()), kind: 'spectated', rated: !!f.tournamentId, pool: 'rapid', tc: 'rapid-10', day: getSave().world.day, date: new Date().toISOString(),
        white: sideFor(f.white), black: sideFor(f.black), playerColor: null, startFen: START_FEN, moves: [...g.uciHistory], san: g.sanHistory(),
        result: st.result, termination: st.termination, arena: f.arena, tournamentId: f.tournamentId, pairingId: f.pairingId, source: 'engine',
        opening: identifyOpening(g.uciHistory),
      };
      await archiveGame(rec);
      if (f.tournamentId && f.pairingId) {
        mutate((x) => recordEngineTournamentGame(x.world, f.tournamentId!, f.pairingId!, st.result === '1-0' ? 1 : st.result === '0-1' ? 0 : 0.5, rec.id, hooksFor(x)));
      }
      setDone(rec.id);
    })();
    return () => {
      ctl.current.alive = false;
      eng.stop();
    };
  }, [f]); // eslint-disable-line react-hooks/exhaustive-deps

  const st = game.current.status();
  return (
    <div className="game spectate">
      <div className="game-ctx">● LIVE · {f.label}</div>
      <div className="player-bar opp"><CompetitorPortrait c={f.black} day={s.world.day} size={40} /><div className="pb-name"><div>{f.black.name}</div><div className="pb-sub">{RANKS[f.black.rank].name} · {f.black.rating}</div></div></div>
      <div className="an-board">
        {showEval && <EvalBar e={evalScore} orientation="w" />}
        <div className="an-board-inner"><Board fen={fen} orientation="w" interactive={false} lastMove={last} settings={s.settings} mate={st.termination === 'checkmate'} azimuth={azimuth} /></div>
      </div>
      <div className="player-bar me"><CompetitorPortrait c={f.white} day={s.world.day} size={40} /><div className="pb-name"><div>{f.white.name}</div><div className="pb-sub">{RANKS[f.white.rank].name} · {f.white.rating}</div></div></div>
      <div className="move-strip">{game.current.sanHistory().map((m, i) => <span key={i}>{i % 2 === 0 ? `${i / 2 + 1}. ` : ''}{m} </span>)}</div>
      {done && <div className="notice">Final: {st.result}. <button className="btn small gold" onClick={() => nav.open({ kind: 'analysis', gameId: done })}>Review</button></div>}
      <div className="game-actions">
        <button className="btn" onClick={() => setPaused((p) => !p)} disabled={!!done}>{paused ? '▶ Resume' : '⏸ Pause'}</button>
        {SPEEDS.map((x) => <button key={x} className={'btn small' + (speed === x ? ' gold' : '')} onClick={() => setSpeed(x)}>{x}×</button>)}
        <button className={'btn small' + (showEval ? ' gold' : '')} onClick={() => setShowEval((v) => !v)}>Eval</button>
        <button className="btn small" onClick={() => setAz((a) => (a > 0.5 ? -0.6 : a + 0.6))}>⟳ View</button>
        <button className="btn" onClick={onExit}>✕ Leave</button>
      </div>
      {!done && f.tournamentId && <div className="muted small center">Leaving early hands this game back to the off-screen simulation.</div>}
    </div>
  );
}
