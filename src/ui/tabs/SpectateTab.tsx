import { useMemo, useState, useSyncExternalStore } from 'react';
import { useSave } from '../store';
import { useNav } from '../nav';
import { Card, CompetitorPortrait, Emblem } from '../components/common';
import { Board } from '../components/Board';
import { EvalBar } from '../AnalysisView';
import { RANKS, ARENAS } from '../../world/arenas';
import { pendingPairings } from '../../tournament/formats';
import { PLAYER_ID } from '../../world/calendar';
import type { Save } from '../../game/state';
import { broadcastStore, startBroadcast, setPaused, setSpeed, type Feature } from '../broadcast';
import { IconPause, IconPlay, IconRotate } from '../components/icons';

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
  const [viewing, setViewing] = useState(false);
  useSyncExternalStore(broadcastStore.subscribe, broadcastStore.version);
  const current = broadcastStore.get();
  const broadcasts = [...s.library].reverse().filter((id) => s.libraryMeta[id]?.source === 'engine').slice(0, 20);
  if (viewing && current) return <LiveBroadcast onExit={() => setViewing(false)} />;
  return (
    <div className="page">
      <Card title="Live from the empire">
        <div className="muted small">Broadcasts are real engine games played now, move by move, at each competitor's strength. Tournament broadcasts decide the actual result.</div>
      </Card>
      {current && (
        <Card className="feature resume" onClick={() => setViewing(true)}>
          <div className="kicker"><span className="live-dot" /> {current.doneGameId ? `Final ${current.result}` : `In progress · move ${Math.ceil(current.san.length / 2)}`}</div>
          <b>{current.feature.white.name} – {current.feature.black.name}</b>
          <div className="muted small">{current.feature.label}</div>
        </Card>
      )}
      {list.filter((f) => f.id !== current?.feature.id).map((f) => (
        <Card key={f.id} className="feature" onClick={() => { startBroadcast(f); setViewing(true); }}>
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

function LiveBroadcast({ onExit }: { onExit: () => void }) {
  const s = useSave();
  const nav = useNav();
  useSyncExternalStore(broadcastStore.subscribe, broadcastStore.version);
  const b = broadcastStore.get();
  const [showEval, setShowEval] = useState(true);
  const [azimuth, setAz] = useState(0);
  if (!b) return null;
  const f = b.feature;
  return (
    <div className="game spectate">
      <div className="game-main">
        <div className="game-ctx"><span className="live-dot" /> {b.doneGameId ? 'FINAL' : 'LIVE'} · {f.label}</div>
        <div className="player-bar opp"><CompetitorPortrait c={f.black} day={s.world.day} size={44} /><div className="pb-name"><div>{f.black.name}</div><div className="pb-sub">{RANKS[f.black.rank].name} · {f.black.rating}</div></div></div>
        <div className="an-board">
          {showEval && <EvalBar e={b.evalScore} orientation="w" />}
          <div className="an-board-inner"><Board fen={b.fen} orientation="w" interactive={false} lastMove={b.last} settings={s.settings} set={f.arena} arena={f.arena} azimuth={azimuth} /></div>
        </div>
        <div className="player-bar me"><CompetitorPortrait c={f.white} day={s.world.day} size={44} /><div className="pb-name"><div>{f.white.name}</div><div className="pb-sub">{RANKS[f.white.rank].name} · {f.white.rating}</div></div></div>
      </div>
      <div className="game-side">
        <div className="move-strip">{b.san.map((m, i) => <span key={i}>{i % 2 === 0 ? `${i / 2 + 1}. ` : ''}{m} </span>)}</div>
        {b.doneGameId && <div className="notice">Final: {b.result}. <button className="btn small gold" onClick={() => nav.open({ kind: 'analysis', gameId: b.doneGameId! })}>Review</button></div>}
        {s.active && !b.doneGameId && <div className="notice">Paused while your own game is in progress.</div>}
        <div className="game-actions">
          <button className="btn" onClick={() => setPaused(!b.paused)} disabled={!!b.doneGameId}>{b.paused ? <><IconPlay size={18} /> Resume</> : <><IconPause size={18} /> Pause</>}</button>
          {SPEEDS.map((x) => <button key={x} className={'btn small' + (b.speed === x ? ' gold' : '')} onClick={() => setSpeed(x)}>{x}×</button>)}
          <button className={'btn small' + (showEval ? ' gold' : '')} onClick={() => setShowEval((v) => !v)}>Eval</button>
          <button className="btn small" aria-label="Rotate view" onClick={() => setAz((a) => (a > 0.5 ? -0.6 : a + 0.6))}><IconRotate size={18} /></button>
          <button className="btn" onClick={onExit}>Back</button>
        </div>
        {!b.doneGameId && <div className="muted small center">The game continues in the background if you leave.</div>}
      </div>
    </div>
  );
}
