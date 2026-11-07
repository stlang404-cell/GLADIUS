/**
 * v0.3 Empire views over the living-empire API (docs/WORLD_API.md):
 * regional circuits, a filterable Imperial Chronicle and the extra competitor
 * profile facts (region, career stage, ambition, form, championship history,
 * feuds). Everything shown is read from simulated state; nothing is invented.
 */
import { useMemo, useState } from 'react';
import { useSave, mutate } from '../store';
import { useNav } from '../nav';
import { Card, Record, dayLabel } from '../components/common';
import { TrophyImage } from '../components/TrophyImage';
import { ARENAS } from '../../world/arenas';
import { REGIONS, type RegionId } from '../../world/regions';
import { regionsOverview, regionInfo, regionalLeaderboard, competitorProfile } from '../../world/hall';
import { chronicleFilter, CHRONICLE_TAG_LABELS } from '../../world/chronicle';
import { playerRegion, setPlayerRegion } from '../../game/career';
import { TROPHY_BY_ID } from '../../world/trophies';
import { describeFormat } from '../../tournament/formats';
import type { ChronicleTag } from '../../world/types';

const STAGE_LABEL: Record<string, string> = { prospect: 'Prospect', rising: 'Rising', prime: 'In their prime', veteran: 'Veteran', declining: 'Declining', retired: 'Retired' };
const nameOfId = (s: ReturnType<typeof useSave>, id: string) => (id === 'player' ? s.player.name : s.world.competitors.find((c) => c.id === id)?.name ?? '');
const pctFmt = (x: number) => `${(x * 100).toFixed(1)}%`;

export function Regions() {
  const s = useSave();
  const nav = useNav();
  const mine = playerRegion(s);
  const [sel, setSel] = useState<RegionId>(mine as RegionId);
  const overview = useMemo(() => regionsOverview(s.world), [s.world.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const info = useMemo(() => regionInfo(s.world, sel), [s.world.day, sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const board = useMemo(() => regionalLeaderboard(s.world, sel, 12), [s.world.day, sel]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = (id: string | null) => id && id !== 'player' && nav.open({ kind: 'competitor', id });
  return (
    <>
      <div className="region-grid">
        {overview.map((r) => (
          <button key={r.id} className={'region-tile' + (sel === r.id ? ' on' : '') + (mine === r.id ? ' mine' : '')} onClick={() => setSel(r.id as RegionId)}>
            <b>{r.name}</b>
            <span className="muted small">{r.population.toLocaleString()} · {pctFmt(r.share)}</span>
            <span className="small">{r.crownHolderName ? `👑 ${r.crownHolderName}` : 'Crown vacant'}</span>
          </button>
        ))}
      </div>
      <Card title={`${info.def.name} · ${info.def.capital}`}>
        <div className="muted small" style={{ marginTop: -4 }}><i>{info.def.motto}</i></div>
        <div className="row" style={{ marginTop: 10 }}>
          <TrophyImage defId={info.signatureEvent.trophyDef} size={64} alt={info.signatureEvent.trophy} />
          <div className="grow">
            <b>{info.crown.name}</b>
            <div className="muted small">{info.crown.holder ? <span className="link" onClick={() => open(info.crown.holder)}>{info.crown.holderName}</span> : 'Vacant'}{info.crown.holder ? ` · since ${dayLabel(info.crown.since)} · ${info.crown.defenses} def.` : ''}</div>
            <div className="muted small">Signature event: {info.signatureEvent.name} · {describeFormat(info.signatureEvent.format as never)} · {info.signatureEvent.size} players</div>
          </div>
        </div>
        {mine === sel ? <div className="pill gold" style={{ marginTop: 10 }}>Your home circuit</div> : (
          <button className="btn small" style={{ marginTop: 10 }} onClick={() => mutate((x) => { if (!setPlayerRegion(x, sel)) alert('Your circuit is fixed once you have entered a regional event or hold a crown.'); })}>Compete in {info.def.name}</button>
        )}
      </Card>
      <Card title="Regional leaderboard">
        {board.map((r, i) => (
          <div key={r.id} className="leader" onClick={() => open(r.id)}>
            <span className="lnum">{i + 1}</span>
            <span className="grow"><b>{r.name}</b>{r.crown ? ' 👑' : ''}<div className="muted small">{ARENAS[r.arena].name} · {STAGE_LABEL[r.stage] ?? r.stage}</div></span>
            <b>{r.rating}</b>
          </div>
        ))}
      </Card>
      {info.events.length > 0 && (
        <Card title="Regional events">
          {info.events.slice(0, 8).map((e) => (
            <div key={e.id} className="leader" onClick={() => nav.open({ kind: 'tournament', id: e.id })}>
              <TrophyImage defId={e.trophy} size={36} />
              <span className="grow"><b>{e.name}</b><div className="muted small">{e.status} · prestige {e.prestige} · {e.qualification}</div></span>
              <span className="muted small">{e.champion ? nameOfId(s, e.champion) : ''}</span>
            </div>
          ))}
        </Card>
      )}
      {info.champions.length > 0 && (
        <Card title="Crown history">
          {info.champions.slice(0, 10).map((c) => (
            <div key={c.tournamentId} className="leader" onClick={() => open(c.holder)}>
              <span className="grow"><b>{c.holderName}</b><div className="muted small">{dayLabel(c.day)}</div></span>
              <span className="muted small">{c.result}</span>
            </div>
          ))}
        </Card>
      )}
      <Card title="Regional records">
        {([['mostCrowns', 'Most crowns'], ['longestReign', 'Longest reign (days)'], ['mostDefenses', 'Most defences'], ['highestPeak', 'Highest peak Elo'], ['mostEventWins', 'Most event wins']] as const).map(([k, label]) => {
          const row = info.records[k][0];
          return <div key={k} className="leader" onClick={() => row && open(row.holder)}><span className="grow">{label}</span><span>{row ? <><b>{row.name}</b> · {row.value}</> : <span className="muted">—</span>}</span></div>;
        })}
      </Card>
    </>
  );
}

const HEADLINE_TAGS: ChronicleTag[] = ['new-champion', 'regional-champion', 'major-upset', 'legend-defeated', 'historic-defense', 'rating-record', 'prodigy', 'veteran-retirement', 'rival-promoted', 'invitation'] as ChronicleTag[];

export function ChronicleFeed() {
  const s = useSave();
  const [mode, setMode] = useState<'headlines' | 'all' | 'rivals'>('headlines');
  const [tag, setTag] = useState<ChronicleTag | null>(null);
  const [region, setRegion] = useState<string>('');
  const rivals = useMemo(() => Object.keys(s.player.h2h), [s.world.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = useMemo(() => {
    let list = chronicleFilter(s.world.chronicle, {
      tag: tag ?? undefined, region: region || undefined, onlyRivals: mode === 'rivals', rivals, limit: 400,
    });
    if (mode === 'headlines' && !tag) list = list.filter((e) => e.tag || e.kind === 'title' || e.kind === 'player');
    return list.slice(0, 120);
  }, [s.world.day, s.world.chronicle.length, mode, tag, region, rivals]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Card title="Imperial Chronicle">
      <div className="chips">
        {(['headlines', 'all', 'rivals'] as const).map((m) => <button key={m} className={'chip' + (mode === m ? ' on' : '')} onClick={() => setMode(m)}>{{ headlines: 'Headlines', all: 'Everything', rivals: 'You & rivals' }[m]}</button>)}
        <select className="chip" value={tag ?? ''} onChange={(e) => setTag((e.target.value || null) as ChronicleTag | null)} aria-label="Event type">
          <option value="">All events</option>
          {HEADLINE_TAGS.filter((t) => CHRONICLE_TAG_LABELS[t]).map((t) => <option key={t} value={t}>{CHRONICLE_TAG_LABELS[t]}</option>)}
        </select>
        <select className="chip" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region">
          <option value="">All regions</option>
          {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      {items.length === 0 && <div className="muted">Nothing yet — the Chronicle only records what actually happens.</div>}
      {items.map((e, i) => (
        <div key={i} className={'chron ' + e.kind}>
          <div className="grow">
            {e.tag && <span className="chron-tag">{CHRONICLE_TAG_LABELS[e.tag] ?? e.tag}</span>}
            <div>{e.text}</div>
            <div className="muted small">{dayLabel(e.day)}{e.arena !== undefined ? ` · ${ARENAS[e.arena]?.name ?? ''}` : ''}{e.region ? ` · ${REGIONS.find((r) => r.id === e.region)?.name ?? ''}` : ''}</div>
          </div>
        </div>
      ))}
    </Card>
  );
}

/** Career facts for the competitor sheet. */
export function CompetitorCareer({ id }: { id: string }) {
  const s = useSave();
  const nav = useNav();
  const p = useMemo(() => competitorProfile(s.world, id), [s.world.day, id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!p) return null;
  return (
    <div className="cc">
      <div className="opp-meta">
        <span className="pill">{p.regionName}</span>
        <span className="pill">{STAGE_LABEL[p.stage] ?? p.stage}</span>
        <span className="pill">{p.tournamentsPlayed} events</span>
        {p.regionalCrown && <span className="pill gold">Regional crown</span>}
      </div>
      <div className="cc-amb"><b>Ambition</b> {p.ambition.text}{p.ambition.progress ? <div className="meter" style={{ marginTop: 6 }}><span style={{ width: `${Math.min(100, (100 * p.ambition.progress.current) / Math.max(1, p.ambition.progress.target))}%` }} /></div> : null}</div>
      {p.recent.length > 0 && <div className="form-row">{p.recent.slice().reverse().map((r, i) => <span key={i} className={'form ' + r.toLowerCase()}>{r}</span>)}</div>}
      <div className="muted small">{p.retiredDay === null ? p.rankProgress.requirement : ''}</div>
      {p.championshipHistory.length > 0 && (
        <>
          <h4>Championships</h4>
          {p.championshipHistory.slice(0, 6).map((a) => (
            <div key={a.awardId} className="leader" onClick={() => nav.open({ kind: 'trophy', awardId: a.awardId })}>
              <TrophyImage defId={a.defId} size={32} />
              <span className="grow">{TROPHY_BY_ID[a.defId]?.name ?? a.defId}<div className="muted small">{dayLabel(a.day)}{a.finalOpponentName ? ` · vs ${a.finalOpponentName}` : ''}{a.defenseNumber ? ` · defence ${a.defenseNumber}` : ''}</div></span>
              <span className="muted small">{a.result}</span>
            </div>
          ))}
        </>
      )}
      {p.rivalries.length > 0 && (
        <>
          <h4>Rivalries</h4>
          {p.rivalries.slice(0, 4).map((f) => (
            <div key={f.other} className="leader" onClick={() => f.other !== 'player' && nav.open({ kind: 'competitor', id: f.other })}>
              <span className="grow">{f.otherName}<div className="meter" style={{ marginTop: 4, maxWidth: 160 }}><span style={{ width: `${Math.round(Math.min(1, f.intensity / 100) * 100)}%` }} /></div></span>
              <span className="muted small">intensity {Math.round(f.intensity)}</span>
            </div>
          ))}
        </>
      )}
      <Record w={p.record.w} d={p.record.d} l={p.record.l} />
    </div>
  );
}
