/**
 * v0.3 Legacy views: chess performance and career history for the profile,
 * and the permanent Hall of Fame. All values come from stored games, analyses
 * and simulation records (src/game/careerStats.ts, src/analysis/skills.ts,
 * src/world/hall.ts); empty states say so instead of guessing.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSave } from '../store';
import { useNav } from '../nav';
import { Card, Record as WDLRecord, Sparkline, dayLabel } from '../components/common';
import { ARENAS, RANKS } from '../../world/arenas';
import { hallOfFame, playerCareerRecords, notableUpsets } from '../../world/hall';
import { computeCareerStats, type WDL } from '../../game/careerStats';
import { computeSkillProfile, type SkillProfile } from '../../analysis/skills';
import { CLASS_META } from '../../analysis/classify';
import { getGame } from '../../persist/save';
import type { GameRecord, MoveClass } from '../../game/state';

/** Loads the player's stored games (newest `limit`), lazily and once per library size. */
function useMyGames(limit = 400): GameRecord[] | null {
  const s = useSave();
  const ids = useMemo(() => s.library.filter((id) => s.libraryMeta[id]?.playerColor).slice(-limit), [s.library.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [recs, setRecs] = useState<GameRecord[] | null>(null);
  useEffect(() => {
    let live = true;
    void Promise.all(ids.map((id) => getGame(id))).then((xs) => live && setRecs(xs.filter((x): x is GameRecord => !!x)));
    return () => { live = false; };
  }, [ids, Object.values(s.libraryMeta).filter((m) => m.analysed).length]); // eslint-disable-line react-hooks/exhaustive-deps
  return recs;
}

const pct = (x: number | null, d = 0) => (x === null ? '—' : `${(x * 100).toFixed(d)}%`);
const scoreLine = (x: WDL) => (x.games ? <><WDLRecord w={x.w} d={x.d} l={x.l} /> <span className="muted small">· {pct(x.score)}</span></> : <span className="muted small">no games</span>);
const QUALITY: MoveClass[] = ['brilliant', 'great', 'best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder'];

export function ChessPerformance() {
  const nav = useNav();
  const recs = useMyGames();
  const stats = useMemo(() => (recs ? computeCareerStats(recs) : null), [recs]);
  const skills: SkillProfile | null = useMemo(() => (recs ? computeSkillProfile(recs) : null), [recs]);
  if (!stats) return <Card title="Chess performance"><div className="muted">Loading your games…</div></Card>;
  if (!stats.games) return <Card title="Chess performance"><div className="muted">Play a game — every statistic here is computed from your stored games.</div></Card>;
  const q = stats.quality.total;
  const qTotal = QUALITY.reduce((a, k) => a + (q[k] ?? 0), 0);
  return (
    <>
      <Card title="Chess performance">
        <div className="lx-tiles">
          <div><b>{stats.accuracy.avg !== null ? `${stats.accuracy.avg.toFixed(1)}%` : '—'}</b><span>avg accuracy</span></div>
          <div><b>{stats.accuracy.recent !== null ? `${stats.accuracy.recent.toFixed(1)}%` : '—'}</b><span>last 5</span></div>
          <div><b>{stats.quality.blundersPerGame !== null ? stats.quality.blundersPerGame.toFixed(2) : '—'}</b><span>blunders / game</span></div>
          <div><b>{stats.quality.mistakesPerGame !== null ? stats.quality.mistakesPerGame.toFixed(2) : '—'}</b><span>mistakes / game</span></div>
        </div>
        <div className="muted small">{stats.analysed} of {stats.games} games analysed · accuracy is an engine-based estimate (see Academy)</div>
        {stats.accuracy.series.length > 1 && <Sparkline values={stats.accuracy.series.map((x) => x.acc)} w={320} h={48} color="#527EAA" />}
        {qTotal > 0 && (
          <>
            <div className="lx-qbar" aria-label="Move quality distribution">
              {QUALITY.filter((k) => q[k]).map((k) => <span key={k} title={`${CLASS_META[k].label}: ${q[k]}`} style={{ flex: q[k], background: CLASS_META[k].color }} />)}
            </div>
            <div className="lx-qleg">{QUALITY.filter((k) => q[k]).map((k) => <span key={k}><i style={{ background: CLASS_META[k].color }} />{CLASS_META[k].label} {(100 * (q[k] ?? 0) / qTotal).toFixed(0)}%</span>)}</div>
          </>
        )}
      </Card>
      <Card title="Results">
        <div className="leader"><span className="grow">All games</span>{scoreLine(stats.overall)}</div>
        <div className="leader"><span className="grow">With White</span>{scoreLine(stats.asWhite)}</div>
        <div className="leader"><span className="grow">With Black</span>{scoreLine(stats.asBlack)}</div>
        <div className="leader"><span className="grow">Reached an endgame</span>{scoreLine(stats.endgames)}</div>
        <h4>Against opponents rated…</h4>
        {stats.vsBands.map((b) => <div key={b.label} className="leader"><span className="grow">{b.label}</span>{scoreLine(b.wdl)}</div>)}
        <h4>Games</h4>
        <div className="muted small">
          Average {stats.length.avgMoves?.toFixed(0) ?? '—'} moves · shortest win {stats.length.shortestWin ?? '—'} · longest {stats.length.longestGame ?? '—'} · decisive {pct(stats.length.decisiveShare)}
          <br />Best win streak {stats.streaks.bestWin} · longest unbeaten {stats.streaks.unbeaten} · current {stats.streaks.current.kind ? `${stats.streaks.current.n}${stats.streaks.current.kind}` : '—'}
        </div>
        <button className="btn small" style={{ marginTop: 10 }} onClick={() => nav.go('academy')}>Open game library</button>
      </Card>
      {skills && skills.games > 0 && (
        <Card title="Strengths & weaknesses">
          <div className="muted small" style={{ marginBottom: 6 }}>Measured from {skills.games} analysed games. The bar is an estimate pulled toward average when the sample is small.</div>
          {skills.dims.map((d) => (
            <div key={d.key} className="lx-skill">
              <div className="row between"><b>{d.label}{skills.strongest === d.key ? ' · strongest' : skills.weakest === d.key ? ' · focus' : ''}</b><span className="muted small">{d.confidence} confidence</span></div>
              <div className="meter"><span style={{ width: `${d.estimate ?? 0}%`, background: skills.weakest === d.key ? 'var(--crimson)' : undefined }} /></div>
              <div className="muted small">{d.evidence}</div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

export function CareerHistory() {
  const s = useSave();
  const nav = useNav();
  const p = s.player;
  const ranks = p.rankHistory ?? [];
  const promos = ranks.filter((r, i) => i > 0 && r.rank > ranks[i - 1].rank).length;
  const demos = ranks.filter((r, i) => i > 0 && r.rank < ranks[i - 1].rank).length;
  const arenaFirst = useMemo(() => {
    const m = new Map<number, number>();
    for (const r of ranks) { const a = RANKS[r.rank]?.arena; if (a !== undefined && !m.has(a)) m.set(a, r.day); }
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [ranks.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const reigns = s.world.reigns.filter((r) => r.holder === 'player');
  const upsets = useMemo(() => (s.world.upsets ?? []).filter((u) => u.winner === 'player' || u.loser === 'player').slice(-6).reverse(), [s.world.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const rec = useMemo(() => playerCareerRecords(s), [s.world.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const elo = p.ratingHistory.map((h) => h.rating);
  return (
    <>
      <Card title="Career history">
        {elo.length > 1 ? <Sparkline values={elo.slice(-200)} w={320} h={70} color="#A92D3A" /> : <div className="muted small">Your Elo chart starts after your first rated game.</div>}
        <div className="lx-tiles">
          <div><b>{promos}</b><span>promotions</span></div>
          <div><b>{demos}</b><span>demotions</span></div>
          <div><b>{rec.tournamentsWon}/{rec.tournamentsPlayed}</b><span>events won</span></div>
          <div><b>{rec.championships}</b><span>arena titles</span></div>
        </div>
        <h4>Arena progression</h4>
        <div className="lx-arenas">
          {ARENAS.map((a) => {
            const f = arenaFirst.find((x) => x[0] === a.index);
            return <span key={a.index} className={'lx-arena' + (f ? ' on' : '')} title={f ? `${a.name} · reached ${dayLabel(f[1])}` : a.name}>{a.index + 1}</span>;
          })}
        </div>
        <h4>Rank changes</h4>
        {ranks.length === 0 && <div className="muted small">None yet.</div>}
        {ranks.slice(-8).reverse().map((r, i) => (
          <div key={i} className="leader"><span className="grow">{RANKS[r.rank]?.name}<div className="muted small">{r.reason}</div></span><span className="muted small">{dayLabel(r.day)}</span></div>
        ))}
      </Card>
      {(reigns.length > 0 || upsets.length > 0) && (
        <Card title="Reigns & upsets">
          {reigns.map((r) => <div key={r.titleId + r.from} className="leader"><span className="grow">{s.world.titles.find((t) => t.id === r.titleId)?.name ?? r.titleId}<div className="muted small">{dayLabel(r.from)} – {r.to === null ? 'present' : dayLabel(r.to)}</div></span><span className="muted small">{r.defenses} def.</span></div>)}
          {upsets.map((u, i) => (
            <div key={i} className="leader" onClick={() => nav.open({ kind: 'competitor', id: u.winner === 'player' ? u.loser : u.winner })}>
              <span className="grow">{u.winner === 'player' ? `Beat ${u.loserName} (${u.loserRating})` : `Upset by ${u.winnerName} (${u.winnerRating})`}<div className="muted small">{u.tournamentName} · {dayLabel(u.day)}</div></span>
            </div>
          ))}
        </Card>
      )}
      <Card title="All-time standing">
        {(['peak-elo', 'championships', 'tournament-wins', 'longest-reign', 'consecutive-defenses'] as const).map((k) => (
          <div key={k} className="leader"><span className="grow">{{ 'peak-elo': 'Peak Elo', championships: 'Championships', 'tournament-wins': 'Tournament wins', 'longest-reign': 'Longest reign', 'consecutive-defenses': 'Consecutive defences' }[k]}</span><span>{rec.allTimeRank[k] ? <b>#{rec.allTimeRank[k]}</b> : <span className="muted small">not in top 100</span>}</span></div>
        ))}
      </Card>
    </>
  );
}

export function HallOfFame() {
  const s = useSave();
  const nav = useNav();
  const lists = useMemo(() => hallOfFame(s.world, 10, s), [s.world.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const [key, setKey] = useState(lists[0]?.key ?? '');
  const list = lists.find((l) => l.key === key) ?? lists[0];
  const upsets = useMemo(() => notableUpsets(s.world, 10), [s.world.day]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="hall">
      <h2 style={{ margin: '2px 0 4px' }}>Hall of Fame</h2>
      <div className="muted small" style={{ marginBottom: 10 }}>Permanent records of the empire. Retired competitors keep their place; anyone — you included — can surpass them.</div>
      <div className="chips">{lists.map((l) => <button key={l.key} className={'chip' + (l.key === list?.key ? ' on' : '')} onClick={() => setKey(l.key)}>{l.label}</button>)}</div>
      {list && (
        <Card title={list.label}>
          <div className="muted small" style={{ marginTop: -4, marginBottom: 6 }}>{list.criteria}</div>
          {list.key === 'notable-upsets' ? upsets.map((u, i) => (
            <div key={i} className="leader"><span className="lnum">{i + 1}</span><span className="grow"><b>{u.winnerName}</b> ({u.winnerRating}) beat {u.loserName} ({u.loserRating})<div className="muted small">{u.tournamentName} · {dayLabel(u.day)}</div></span></div>
          )) : list.rows.length === 0 ? <div className="muted">No one has qualified yet.</div> : list.rows.map((r, i) => (
            <div key={r.holder + i} className={'leader' + (r.holder === 'player' ? ' me' : '')} onClick={() => r.holder !== 'player' && s.world.competitors.some((c) => c.id === r.holder) && nav.open({ kind: 'competitor', id: r.holder })}>
              <span className="lnum">{i + 1}</span>
              <span className="grow"><b>{r.name}</b>{r.retired ? <span className="pill" style={{ marginLeft: 6 }}>Legend</span> : null}{r.detail ? <div className="muted small">{r.detail}</div> : null}</span>
              <b>{r.value}</b>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
