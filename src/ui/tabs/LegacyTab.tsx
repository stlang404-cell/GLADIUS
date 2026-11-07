import { useEffect, useMemo, useState } from 'react';
import { useSave, mutate, setSave, getSave } from '../store';
import { useNav } from '../nav';
import { Card, Emblem, Portrait, Record, Sparkline, Stat, Sheet, dayLabel, pct } from '../components/common';
import { RANKS, ARENAS } from '../../world/arenas';
import { ACHIEVEMENTS } from '../../game/achievements';
import { trophyUri, pieceUri } from '../art';
import { careerRating, bestRating } from '../../game/career';
import { exportAll, importAll, listBackups, restoreBackup, wipeAll } from '../../persist/save';
import { requestPersistence } from '../../persist/db';
import { downloadText } from '../AnalysisView';
import { POOLS } from '../../rating/elo';
import type { Settings } from '../../game/state';
import { PLAYER_ID } from '../../world/calendar';

type Sec = 'profile' | 'trophies' | 'collection' | 'history' | 'settings' | 'saves';

export function LegacyTab() {
  const [sec, setSec] = useState<Sec>('profile');
  return (
    <div className="tab-page">
      <div className="seg">
        {(['profile', 'trophies', 'collection', 'history', 'settings', 'saves'] as Sec[]).map((x) => (
          <button key={x} className={sec === x ? 'on' : ''} onClick={() => setSec(x)}>
            {{ profile: 'Profile', trophies: 'Honours', collection: 'Collection', history: 'Career', settings: 'Settings', saves: 'Saves' }[x]}
          </button>
        ))}
      </div>
      {sec === 'profile' && <Profile />}
      {sec === 'trophies' && <Honours />}
      {sec === 'collection' && <Collection />}
      {sec === 'history' && <Career />}
      {sec === 'settings' && <SettingsPanel />}
      {sec === 'saves' && <Saves />}
    </div>
  );
}

export function Profile() {
  const s = useSave();
  const nav = useNav();
  const p = s.player;
  const r = careerRating(s);
  const hist = p.ratingHistory.filter((h) => h.pool === s.settings.careerPool).map((h) => h.rating);
  const rivals = Object.entries(p.h2h).sort((a, b) => b[1].w + b[1].d + b[1].l - (a[1].w + a[1].d + a[1].l)).slice(0, 6);
  const recent = s.library.slice(-10).map((id) => s.libraryMeta[id]).filter((m) => m?.playerColor);
  const form = recent.map((m) => (m.result === '1/2-1/2' ? 'd' : (m.result === '1-0') === (m.playerColor === 'w') ? 'w' : 'l'));
  const openings = Object.entries(p.openingsPlayed).sort((a, b) => b[1].w + b[1].d + b[1].l - (a[1].w + a[1].d + a[1].l)).slice(0, 4);
  const analysed = Object.values(s.libraryMeta).filter((m) => m.playerColor && m.accuracy !== undefined);
  const avgAcc = analysed.length ? analysed.reduce((a, m) => a + (m.accuracy ?? 0), 0) / analysed.length : null;
  return (
    <>
      <Card className="passport">
        <div className="row">
          <Portrait seed={p.portraitSeed} female={p.female} arena={RANKS[p.rank].arena} size={92} ring="#e8b04b" />
          <div className="grow">
            <div className="pp-name">{p.name}</div>
            <div className="opp-rank"><Emblem rank={p.rank} size={28} /> {RANKS[p.rank].name} <span className="muted">· {ARENAS[RANKS[p.rank].arena].name}</span></div>
            <div className="muted">Enlisted {dayLabel(p.createdDay)} · now {dayLabel(s.world.day)}</div>
          </div>
        </div>
        <div className="stats-grid">
          <Stat label="Elo" value={r.rating} sub={`peak ${r.peak}`} />
          <Stat label="Best ever" value={bestRating(s)} />
          <Stat label="Influence" value={p.influence} sub={`prestige ${p.prestige}`} />
          <Stat label="Games" value={p.w + p.d + p.l} sub={<Record w={p.w} d={p.d} l={p.l} />} />
          <Stat label="Score" value={`${pct(p.w, p.d, p.l)}%`} />
          <Stat label="Tournaments" value={p.tournamentsWon} sub={`${p.tournamentsPlayed} played`} />
          <Stat label="Championships" value={p.championships} sub={p.titles.length ? 'title holder' : undefined} />
          <Stat label="Accuracy" value={avgAcc !== null ? `${avgAcc.toFixed(1)}%` : '—'} />
        </div>
        <div className="form-row">{form.map((f, i) => <span key={i} className={'form ' + f}>{f.toUpperCase()}</span>)}</div>
        <Sparkline values={hist.slice(-120)} w={320} h={60} />
        <div className="muted small">{POOLS.map((pl) => `${pl} ${p.ratings[pl].rating}${p.ratings[pl].games < 20 ? '?' : ''}`).join(' · ')}</div>
      </Card>
      {rivals.length > 0 && (
        <Card title="Head-to-head">
          {rivals.map(([id, h]) => {
            const c = s.world.competitors.find((x) => x.id === id);
            return c ? (
              <div key={id} className="leader" onClick={() => nav.open({ kind: 'competitor', id })}>
                <span className="grow">{c.name}{id === p.rivalId ? ' ⚔ rival' : ''}</span>
                <Record {...h} />
              </div>
            ) : null;
          })}
        </Card>
      )}
      {openings.length > 0 && <Card title="Favourite openings">{openings.map(([n, o]) => <div key={n} className="leader"><span className="grow">{n}</span><Record w={o.w} d={o.d} l={o.l} /></div>)}</Card>}
    </>
  );
}

export function PassportSheet({ onClose }: { onClose: () => void }) {
  return <Sheet title="Imperial Passport" onClose={onClose}><Profile /></Sheet>;
}

function Honours() {
  const s = useSave();
  const won = s.world.history.filter((h) => h.winner === PLAYER_ID);
  const got = ACHIEVEMENTS.filter((a) => s.player.achievements[a.id] !== undefined).length;
  return (
    <>
      <Card title={`Trophy hall (${won.length})`}>
        {won.length === 0 && <div className="muted">No trophies yet. Enter an Open from the Arena invitations.</div>}
        <div className="trophies">
          {won.map((h) => <div key={h.id} className="trophy"><img src={trophyUri(h.arena)} width={64} height={64} alt="" /><b>{h.name}</b><span className="muted">{dayLabel(h.endDay)}</span></div>)}
        </div>
      </Card>
      <Card title={`Achievements ${got}/${ACHIEVEMENTS.length}`}>
        <div className="ach-grid">
          {ACHIEVEMENTS.map((a) => {
            const d = s.player.achievements[a.id];
            return <div key={a.id} className={'ach' + (d !== undefined ? ' got' : '')}><b>{d !== undefined ? '🏅' : '○'} {a.name}</b><span className="muted small">{a.desc}</span></div>;
          })}
        </div>
      </Card>
    </>
  );
}

function Collection() {
  const s = useSave();
  return (
    <Card title="Boards & pieces">
      <div className="muted small">One collection per arena. Unlock by entering an arena or winning its tournaments — unlocks are permanent, even after demotion.</div>
      <div className="sets">
        {ARENAS.map((a) => {
          const has = s.player.unlockedSets.includes(a.index);
          const on = s.settings.pieceSet === a.index;
          return (
            <button key={a.index} className={'set' + (on ? ' on' : '') + (has ? '' : ' locked')} disabled={!has} onClick={() => mutate((x) => { x.settings.pieceSet = a.index; x.settings.boardSet = a.index; })}>
              <div className="set-board" style={{ background: `linear-gradient(135deg, ${a.palette.light} 50%, ${a.palette.dark} 50%)`, borderColor: a.palette.frame }}>
                <img src={pieceUri('k', 'w', a.index)} alt="" /><img src={pieceUri('n', 'b', a.index)} alt="" />
              </div>
              <span>{has ? a.name.replace('The ', '') : '🔒 ' + a.name.replace('The ', '')}</span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

function Career() {
  const s = useSave();
  const p = s.player;
  const played = s.world.history.filter((h) => h.playerPlace !== undefined).slice(-30).reverse();
  return (
    <>
      <Card title="Rank history">
        {[...p.rankHistory].reverse().slice(0, 40).map((h, i) => (
          <div key={i} className="leader"><Emblem rank={h.rank} size={22} /><span className="grow">{RANKS[h.rank].name}</span><span className="muted">{h.reason} · {dayLabel(h.day)}</span></div>
        ))}
      </Card>
      <Card title="Tournament record">
        {played.length === 0 && <div className="muted">No tournaments yet.</div>}
        {played.map((h) => <div key={h.id} className="leader"><span className="grow">{h.name}</span><b>#{h.playerPlace}</b><span className="muted">/{h.size}</span></div>)}
      </Card>
    </>
  );
}

function Toggle({ k, label }: { k: keyof Settings; label: string }) {
  const s = useSave();
  return (
    <label className="toggle">
      <input type="checkbox" checked={!!s.settings[k]} onChange={(e) => mutate((x) => ((x.settings as Record<string, unknown>)[k] = e.target.checked))} />
      <span>{label}</span>
    </label>
  );
}

function Choice<K extends keyof Settings>({ k, label, options }: { k: K; label: string; options: [Settings[K], string][] }) {
  const s = useSave();
  return (
    <div className="choice">
      <span>{label}</span>
      <div className="chips">
        {options.map(([v, l]) => <button key={String(v)} className={'chip' + (s.settings[k] === v ? ' on' : '')} onClick={() => mutate((x) => (x.settings[k] = v))}>{l}</button>)}
      </div>
    </div>
  );
}

function SettingsPanel() {
  const s = useSave();
  return (
    <Card title="Settings">
      <Choice k="boardMode" label="Board" options={[['3d', '2.5D sculpted'], ['2d', 'Classical 2D']]} />
      <Choice k="animSpeed" label="Animation" options={[['fast', 'Fast'], ['balanced', 'Balanced'], ['cinematic', 'Cinematic']]} />
      <div className="choice"><span>Camera tilt</span><input type="range" min={0} max={1} step={0.05} value={s.settings.cameraTilt} onChange={(e) => mutate((x) => (x.settings.cameraTilt = Number(e.target.value)))} /></div>
      <Choice k="opponentPace" label="Opponent pace" options={[['natural', 'Natural'], ['instant', 'Instant']]} />
      <Choice k="careerPool" label="Career rating" options={[['blitz', 'Blitz'], ['rapid', 'Rapid'], ['classical', 'Classical']]} />
      <Toggle k="showLegal" label="Show legal moves" />
      <Toggle k="showCoords" label="Coordinates" />
      <Toggle k="autoQueen" label="Auto-queen" />
      <Toggle k="sound" label="Sound effects" />
      <Toggle k="ambience" label="Arena ambience" />
      <Toggle k="reduceMotion" label="Reduce motion" />
      <Toggle k="highContrast" label="High contrast" />
      <div className="muted small">Your career rank follows the chosen career rating. Each time control keeps its own rating pool.</div>
    </Card>
  );
}

function Saves() {
  const s = useSave();
  const [backups, setBackups] = useState<{ key: string; savedAt: string; ok: boolean }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string>('');
  useEffect(() => {
    void listBackups().then(setBackups);
    void navigator.storage?.persisted?.().then(setPersisted);
    void navigator.storage?.estimate?.().then((e) => setUsage(`${((e.usage ?? 0) / 1048576).toFixed(1)} MB used`));
  }, []);
  const size = useMemo(() => (JSON.stringify(s).length / 1048576).toFixed(1), [s.world.day]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Card title="Save">
        <div className="muted small">Saved automatically on this device (IndexedDB) after every move. Career + world ≈ {size} MB · {usage}. Saves are not shared between devices — use Export/Import to move your career.</div>
        <div className="muted small">Storage protection: {persisted === null ? 'unknown' : persisted ? 'persistent ✓' : 'best-effort (browser may clear under pressure)'}{!persisted && <button className="btn small" onClick={() => void requestPersistence().then(setPersisted)}>Request</button>}</div>
        <div className="row gap wrap">
          <button className="btn gold" onClick={() => void exportAll(getSave()).then((t) => downloadText(`gladius-backup-${new Date().toISOString().slice(0, 10)}.json`, t, 'application/json'))}>Export backup</button>
          <label className="btn">Import backup<input type="file" accept=".json,application/json" hidden onChange={(e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            void f.text().then(importAll).then((sv) => { setSave(sv); setMsg('Backup imported.'); }).catch((err) => setMsg('Import failed: ' + (err as Error).message));
          }} /></label>
        </div>
        {msg && <div className="notice">{msg}</div>}
      </Card>
      <Card title="Automatic backups">
        {backups.length === 0 && <div className="muted small">Rolling backups are written every few games.</div>}
        {backups.map((b) => (
          <div key={b.key} className="leader"><span className="grow">{new Date(b.savedAt).toLocaleString()}</span><span>{b.ok ? '✓' : '✗ damaged'}</span>
            {b.ok && <button className="btn small" onClick={() => void restoreBackup(b.key).then((sv) => { setSave(sv); setMsg('Backup restored.'); })}>Restore</button>}</div>
        ))}
      </Card>
      <Card title="Danger zone">
        <button className="btn red" onClick={() => { if (confirm('Delete this career and world permanently? Export first if unsure.')) void wipeAll().then(() => location.reload()); }}>Delete career</button>
      </Card>
      <Card title="About">
        <div className="muted small">GLADIUS v0.1 · Chess engine: Stockfish 19 (lite, single-threaded WASM build by Nathan Rugg), GPL-3.0 — see engine/STOCKFISH-LICENSE.txt. Rules: chess.js (BSD-2). Rendering: three.js (MIT). All art is procedurally generated and original. GLADIUS is distributed under GPL-3.0-or-later.</div>
      </Card>
    </>
  );
}
