import { useMemo, useState } from 'react';
import { useSave, mutate } from '../store';
import { useNav } from '../nav';
import { Card, CompetitorPortrait, Emblem, Record, Sheet, Sparkline, dayLabel } from '../components/common';
import { ARENAS, RANKS } from '../../world/arenas';
import { standings, describeFormat, matchOutcome, type Pairing } from '../../tournament/formats';
import { PLAYER_ID } from '../../world/calendar';
import { acceptTournament, playerArena, playerWithdraw, hostInvitational, startGame } from '../../game/career';
import { hostCostFor } from '../../game/legacy';
import { STYLE_LABEL } from '../../engine/styles';
import type { Save, WorldTournament } from '../../game/state';
import { compAge } from '../components/common';
import { TrophyImage } from '../components/TrophyImage';
import { useArenaArt } from '../components/ArenaArt';
import { crestUri } from '../art';
import { signatureTheme } from '../../board2d/themes';
import { TROPHY_BY_ID } from '../../world/trophies';
import { recordLeaders, RECORD_LABELS, ALL_RECORD_KEYS, competitorHonours, type RecordKey } from '../../world/records';
import { rivalPrep } from '../../game/legacy';
import { IconCrown, IconTrophy, IconStar, IconArena, IconShield, IconLaurel } from '../components/icons';
import type React from 'react';

type Section = 'arenas' | 'tournaments' | 'leaders' | 'hall' | 'chronicle';

export function EmpireTab() {
  const [sec, setSec] = useState<Section>('arenas');
  return (
    <div className="page">
      <div className="seg">
        {(['arenas', 'tournaments', 'leaders', 'hall', 'chronicle'] as Section[]).map((x) => (
          <button key={x} className={sec === x ? 'on' : ''} onClick={() => setSec(x)}>
            {{ arenas: 'Arenas', tournaments: 'Tournaments', leaders: 'Leaders', hall: 'Champions', chronicle: 'Chronicle' }[x]}
          </button>
        ))}
      </div>
      {sec === 'arenas' && <Arenas />}
      {sec === 'tournaments' && <Tournaments />}
      {sec === 'leaders' && <Leaders />}
      {sec === 'hall' && <Hall />}
      {sec === 'chronicle' && <Chronicle />}
    </div>
  );
}

function nameOf(s: Save, id: string | null) {
  if (!id) return '—';
  if (id === PLAYER_ID) return s.player.name;
  return s.world.competitors.find((c) => c.id === id)?.name ?? 'Unknown';
}

function ArenaCard({ index, mine, onClick, children }: { index: number; mine: boolean; onClick: () => void; children: React.ReactNode }) {
  const art = useArenaArt(index);
  return <div className={'arena-card' + (mine ? ' mine' : '')} style={{ backgroundImage: art }} onClick={onClick}>{children}</div>;
}

function Arenas() {
  const s = useSave();
  const nav = useNav();
  const counts = useMemo(() => {
    const n = new Array(12).fill(0);
    for (const c of s.world.competitors) if (c.retiredDay === null) n[RANKS[c.rank].arena]++;
    return n;
  }, [s.world.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const mine = playerArena(s);
  return (
    <div className="arena-grid">
      {ARENAS.map((a) => {
        const title = s.world.titles[a.index];
        const locked = a.index > mine && !s.player.unlockedSets.includes(a.index);
        return (
          <ArenaCard key={a.id} index={a.index} mine={a.index === mine} onClick={() => nav.open({ kind: 'arena', index: a.index })}>
            <div className="ac-num">{['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'][a.index]}</div>
            {locked && <div className="ac-lock"><IconShield size={16} /></div>}
            {a.index === mine && <div className="ac-here">YOU ARE HERE</div>}
            <div className="ac-body">
              <img className="ac-crest" src={crestUri(a.index)} alt="" />
              <div className="ac-name">{a.name}</div>
              <div className="ac-meta">{a.floor}+ Elo · {counts[a.index]} competitors</div>
              <div className="ac-champ"><IconCrown size={13} /> {nameOf(s, title.holder)}</div>
            </div>
          </ArenaCard>
        );
      })}
    </div>
  );
}

export function ArenaSheet({ index, onClose }: { index: number; onClose: () => void }) {
  const s = useSave();
  const nav = useNav();
  const a = ARENAS[index];
  const art = useArenaArt(index);
  const title = s.world.titles[index];
  const reigns = s.world.reigns.filter((r) => r.titleId === title.id).slice(-12).reverse();
  const top = s.world.competitors.filter((c) => c.retiredDay === null && RANKS[c.rank].arena === index).sort((x, y) => y.rating - x.rating).slice(0, 10);
  return (
    <Sheet title={a.name} onClose={onClose} wide>
      <div className="arena-banner" style={{ backgroundImage: art }}>
        <div className="ab-card">
          <img src={crestUri(index)} width={56} height={56} alt="" />
          <TrophyImage defId={`sig-${index}`} arena={index} size={72} alt={a.trophy} />
          <div><div className="kicker">{a.trophy}</div><i>{a.motto}</i><div className="muted small">Signature board: {signatureTheme(index).name}</div></div>
        </div>
      </div>
      <div className="ranks3">
        {[0, 1, 2].map((t) => {
          const r = RANKS[index * 3 + t];
          return (
            <div key={t} className={'rank3' + (s.player.rank === r.index ? ' mine' : '')}>
              <Emblem rank={r.index} size={56} />
              <b>{r.name}</b>
              <span className="muted">{r.meaning}</span>
              <span>{r.floor}+</span>
            </div>
          );
        })}
      </div>
      <div className="muted small">Promotion within an arena follows your Elo. Entering the next arena requires winning a Promotion Trial — or reaching 150 Elo above its floor. Fall 100 below the arena floor to be demoted. Unlocked collections are kept forever.</div>
      <h4>Reigning champion</h4>
      <div className="row">{title.holder && title.holder !== PLAYER_ID ? (() => { const c = s.world.competitors.find((x) => x.id === title.holder); return c ? <><CompetitorPortrait c={c} day={s.world.day} /><div className="grow" onClick={() => nav.open({ kind: 'competitor', id: c.id })}><b>{c.name}</b><div className="muted">since {dayLabel(title.since)} · {title.defenses} defenses</div></div></> : null; })() : <b>{title.holder === PLAYER_ID ? `${s.player.name} (you)` : 'Vacant'}</b>}</div>
      <h4>Title lineage</h4>
      <ol className="lineage">{reigns.map((r, i) => <li key={i}><b>{r.holderName}</b> <span className="muted">{dayLabel(r.from)} → {r.to === null ? 'present' : dayLabel(r.to)} · {r.defenses} def.</span></li>)}</ol>
      <h4>Top competitors</h4>
      <LeaderRows list={top} />
    </Sheet>
  );
}

function LeaderRows({ list }: { list: Save['world']['competitors'] }) {
  const s = useSave();
  const nav = useNav();
  return (
    <div className="leaders">
      {list.map((c, i) => (
        <div key={c.id} className="leader" onClick={() => nav.open({ kind: 'competitor', id: c.id })}>
          <span className="pos">{i + 1}</span>
          <CompetitorPortrait c={c} day={s.world.day} size={32} />
          <span className="grow">{c.name}{c.titles.length ? <IconCrown size={14} /> : null}</span>
          <Emblem rank={c.rank} size={20} />
          <b>{c.rating}</b>
        </div>
      ))}
    </div>
  );
}

function Leaders() {
  const s = useSave();
  const [arena, setArena] = useState<number | null>(null);
  const list = useMemo(
    () => s.world.competitors.filter((c) => c.retiredDay === null && (arena === null || RANKS[c.rank].arena === arena)).sort((a, b) => b.rating - a.rating).slice(0, 100),
    [s.world.day, arena], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const r = s.player.ratings[s.settings.careerPool].rating;
  const above = s.world.competitors.filter((c) => c.retiredDay === null && c.rating > r).length;
  return (
    <Card>
      <div className="muted">Your position in the empire: <b>#{above + 1}</b> of {s.world.competitors.filter((c) => c.retiredDay === null).length + 1}</div>
      <div className="chips scroll">
        <button className={'chip' + (arena === null ? ' on' : '')} onClick={() => setArena(null)}>All</button>
        {ARENAS.map((a) => <button key={a.index} className={'chip' + (arena === a.index ? ' on' : '')} onClick={() => setArena(a.index)}>{a.name.replace('The ', '')}</button>)}
      </div>
      <LeaderRows list={list} />
    </Card>
  );
}

function Tournaments() {
  const s = useSave();
  const nav = useNav();
  const mine = playerArena(s);
  const [filter, setFilter] = useState<'mine' | 'all'>('mine');
  const ts = s.world.tournaments.filter((t) => filter === 'all' || t.arena === mine);
  const order = { running: 0, scheduled: 1, complete: 2 } as const;
  const sorted = [...ts].sort((a, b) => order[a.status] - order[b.status] || a.startDay - b.startDay).slice(0, 80);
  return (
    <>
      <div className="row between">
        <div className="chips">
          <button className={'chip' + (filter === 'mine' ? ' on' : '')} onClick={() => setFilter('mine')}>My arena</button>
          <button className={'chip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>All arenas</button>
        </div>
        <button className="btn small" disabled={s.player.influence < hostCostFor(s) || !!s.active} onClick={() => mutate((x) => { const id = hostInvitational(x); if (id) nav.open({ kind: 'tournament', id }); })}>
          Host invitational · {hostCostFor(s)} Influence
        </button>
      </div>
      {sorted.map((t) => (
        <Card key={t.id} className={'tourn ' + t.status} onClick={() => nav.open({ kind: 'tournament', id: t.id })}>
          <div className="row">
            <TrophyImage defId={t.kind === 'championship' ? `sig-${t.arena}` : t.kind === 'league' ? `league-t${Math.min(3, Math.floor(t.arena / 3))}` : t.kind === 'invitational' ? `invit-t${Math.min(3, Math.floor(t.arena / 3))}` : `cup-open-t${Math.min(3, Math.floor(t.arena / 3))}`} arena={t.arena} size={44} />
            <div className="grow">
              <b>{t.name}</b>
              <div className="muted">{describeFormat(t.format, t.state ?? undefined)} · {t.status === 'scheduled' ? `starts ${dayLabel(t.startDay)}` : t.status === 'running' ? `round ${(t.state?.rounds.length ?? 0)}` : `won by ${nameOf(s, t.state?.winner ?? null)}`}</div>
            </div>
            {t.playerEntered && <span className="pill gold">Entered</span>}
          </div>
        </Card>
      ))}
    </>
  );
}

export function TournamentSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useSave();
  const nav = useNav();
  const t = s.world.tournaments.find((x) => x.id === id);
  if (!t) return <Sheet title="Tournament" onClose={onClose}><div className="muted">This tournament has been archived.</div></Sheet>;
  const canEnter = t.status === 'scheduled' && !t.playerEntered && t.arena === playerArena(s) && (t.kind === 'open' || t.kind === 'league' || s.world.invitations.some((i) => i.tournamentId === t.id));
  return (
    <Sheet title={t.name} onClose={onClose} wide>
      <div className="row between">
        <div className="muted">{ARENAS[t.arena].name} · {describeFormat(t.format, t.state ?? undefined)} · prize {t.prize} Influence</div>
        {canEnter && <button className="btn gold small" onClick={() => mutate((x) => acceptTournament(x, t.id))}>Enter</button>}
        {t.playerEntered && t.status !== 'complete' && !t.playerWithdrawn && t.kind !== 'championship' && <button className="btn small" onClick={() => mutate((x) => playerWithdraw(x, t.id))}>Withdraw</button>}
      </div>
      {!t.state && <div className="muted">Starts {dayLabel(t.startDay)}. Entrants are chosen by standing when it begins.</div>}
      {t.state && <TournamentBody t={t} />}
      {t.featured.length > 0 && t.status === 'running' && <button className="btn blue" onClick={() => { onClose(); nav.go('spectate'); }}>Watch featured games</button>}
    </Sheet>
  );
}

function TournamentBody({ t }: { t: WorldTournament }) {
  const s = useSave();
  const nav = useNav();
  const st = t.state!;
  const rows = standings(st);
  const elim = t.format === 'single-elim' || t.format === 'double-elim';
  const name = (id: string | null) => (id === null ? 'bye' : id === PLAYER_ID ? 'You' : nameOf(s, id));
  const pairingLine = (p: Pairing) => {
    const o = matchOutcome(p);
    return (
      <div key={p.id} className={'pairing' + (p.white === PLAYER_ID || p.black === PLAYER_ID ? ' me' : '')}>
        <span className={o === 'white' ? 'win' : ''} onClick={() => p.white !== PLAYER_ID && nav.open({ kind: 'competitor', id: p.white })}>{name(p.white)}</span>
        <span className="res">{p.black === null ? 'bye' : p.result === null ? 'vs' : p.result === 1 ? '1–0' : p.result === 0 ? '0–1' : '½–½'}{p.armageddon ? ' (Arm.)' : p.tiebreakOf ? ' (TB)' : ''}{t.gameIds[p.id] ? ' ♟' : ''}</span>
        <span className={o === 'black' ? 'win' : ''} onClick={() => p.black && p.black !== PLAYER_ID && nav.open({ kind: 'competitor', id: p.black })}>{name(p.black)}</span>
      </div>
    );
  };
  if (t.format === 'match-series') {
    const [a, b] = st.entrants;
    const score = (id: string) => st.rounds.flat().reduce((acc, p) => acc + (p.result === null ? 0 : p.white === id ? p.result : p.black === id ? 1 - p.result : 0), 0);
    return (
      <>
        <div className="match-score"><b>{name(a)}</b> <span>{score(a)} – {score(b)}</span> <b>{name(b)}</b></div>
        {st.rounds.map((r, i) => <div key={i}>{r.map(pairingLine)}</div>)}
        {st.complete && <div className="pill gold">Champion: {name(st.winner)}</div>}
      </>
    );
  }
  return (
    <>
      {!elim && (
        <table className="standings">
          <thead><tr><th>#</th><th>Name</th><th>Pts</th><th>W-D-L</th><th title="Tie-break">TB</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={r.id === PLAYER_ID ? 'me' : ''}>
                <td>{r.place}</td><td>{name(r.id)}</td><td><b>{r.points}</b></td><td>{r.wins}-{r.draws}-{r.losses}</td><td>{(t.format === 'swiss' ? r.buchholz : r.sonnebornBerger).toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className={elim ? 'bracket' : 'rounds'}>
        {st.rounds.map((r, i) => (
          <div key={i} className="round">
            <div className="kicker">{elim ? roundName(i, st.rounds.length, st.complete) : `Round ${i + 1}`}</div>
            {r.map(pairingLine)}
          </div>
        ))}
      </div>
      {st.complete && <div className="pill gold">Winner: {name(st.winner ?? rows[0]?.id ?? null)}</div>}
    </>
  );
}

function roundName(i: number, n: number, complete: boolean) {
  if (complete && i === n - 1) return 'Final';
  return `Round ${i + 1}`;
}

function Hall() {
  const s = useSave();
  const nav = useNav();
  const [key, setKey] = useState<RecordKey>('championships');
  const rows = useMemo(() => recordLeaders(s.world, key, 15, s.player), [s.world.day, key]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <Card title="Reigning champions">
        {[...s.world.titles].reverse().map((t) => {
          const reign = s.world.reigns.find((r) => r.titleId === t.id && r.to === null);
          return (
            <div key={t.id} className="leader" onClick={() => t.holder && t.holder !== PLAYER_ID && nav.open({ kind: 'competitor', id: t.holder })}>
              <TrophyImage defId={`sig-${t.arena}`} arena={t.arena} size={40} />
              <span className="grow"><b>{nameOf(s, t.holder)}</b><div className="muted small">{t.name}</div></span>
              <span className="muted small">{reign ? `${s.world.day - reign.from} days` : ''} · {t.defenses} def.</span>
            </div>
          );
        })}
      </Card>
      <Card title="Hall of Records">
        <div className="chips scroll">
          {ALL_RECORD_KEYS.map((k) => <button key={k} className={'chip' + (key === k ? ' on' : '')} onClick={() => setKey(k)}>{RECORD_LABELS[k]}</button>)}
        </div>
        {rows.map((r, i) => (
          <div key={r.holder + i} className="leader" onClick={() => r.holder !== PLAYER_ID && s.world.competitors.some((c) => c.id === r.holder) && nav.open({ kind: 'competitor', id: r.holder })}>
            <span className="pos">{i + 1}</span>
            <span className="grow"><b>{r.name}</b>{r.retired ? <span className="muted small"> · retired</span> : null}{r.detail ? <div className="muted small">{r.detail}</div> : null}</span>
            <b className="num">{r.value}</b>
          </div>
        ))}
      </Card>
    </>
  );
}

const TAG_ICON: Record<string, () => React.ReactElement> = {
  'new-champion': () => <IconCrown size={16} />, comeback: () => <IconCrown size={16} />, 'record-broken': () => <IconStar size={16} />,
  'elite-upset': () => <IconArena size={16} />, 'tournament-upset': () => <IconTrophy size={16} />, 'rival-promoted': () => <IconShield size={16} />,
  prodigy: () => <IconStar size={16} />, breakthrough: () => <IconStar size={16} />, 'fall-from-elite': () => <IconShield size={16} />, retirement: () => <IconLaurel size={16} />,
};

function Chronicle() {
  const s = useSave();
  const [all, setAll] = useState(false);
  const items = [...s.world.chronicle].reverse().filter((e) => all || e.tag || e.kind === 'title' || e.kind === 'player').slice(0, 120);
  return (
    <Card title="Imperial Chronicle">
      <div className="chips"><button className={'chip' + (!all ? ' on' : '')} onClick={() => setAll(false)}>Headlines</button><button className={'chip' + (all ? ' on' : '')} onClick={() => setAll(true)}>Everything</button></div>
      {items.map((e, i) => {
        const Ico = TAG_ICON[e.tag ?? ''] ?? (() => (e.kind === 'title' ? <IconCrown size={16} /> : <IconTrophy size={16} />));
        return (
          <div key={i} className={'chron ' + e.kind}>
            <span className="chron-ico"><Ico /></span>
            <div className="grow"><div>{e.text}</div><div className="muted small">{dayLabel(e.day)}{e.arena !== undefined ? ` · ${ARENAS[e.arena].name}` : ''}</div></div>
          </div>
        );
      })}
    </Card>
  );
}

export function CompetitorSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const s = useSave();
  const nav = useNav();
  const c = s.world.competitors.find((x) => x.id === id);
  if (!c) return null;
  const h = s.player.h2h[c.id];
  const hon = competitorHonours(s.world, c.id);
  const prep = rivalPrep(s, c.id);
  const age = compAge(c, s.world.day);
  const traj = c.skill > c.rating + 40 ? 'Rising' : c.skill < c.rating - 40 ? 'Slipping' : age < c.peakAge ? 'Developing' : age > c.peakAge + 6 ? 'Veteran' : 'At their peak';
  const ambition = c.titles.length ? 'Defend the crown' : c.rating > RANKS[c.rank].floor + 150 ? 'Win promotion' : c.form > 0.2 ? 'Ride the hot streak' : c.form < -0.2 ? 'Rebuild confidence' : 'Climb the ladder';
  return (
    <Sheet title={c.name} onClose={onClose}>
      <div className="row">
        <CompetitorPortrait c={c} day={s.world.day} size={96} />
        <div className="grow">
          <div className="opp-rank"><Emblem rank={c.rank} size={24} /> {RANKS[c.rank].name}</div>
          <div><b>{c.rating}</b> <span className="muted">peak {c.peak}</span></div>
          <div className="muted">{c.origin} · age {age} · {STYLE_LABEL[c.style]}</div>
          <div className="muted">{c.retiredDay !== null ? `Retired ${dayLabel(c.retiredDay)}` : `${traj} · ${ambition}`}</div>
        </div>
      </div>
      <div className="stats-row">
        <div><Record w={c.w} d={c.d} l={c.l} /><span className="muted"> record</span></div>
        <div className="row" style={{ gap: 4 }}><IconTrophy size={16} /> {c.tournamentsWon}</div>
        <div className="row" style={{ gap: 4 }}><IconCrown size={16} /> {c.championships}</div>
        <div>Prestige {hon?.prestige ?? 0}</div>
        <div>Form {c.form > 0.15 ? '▲' : c.form < -0.15 ? '▼' : '◆'}</div>
      </div>
      <Sparkline values={c.ratingHistory.map((x) => x[1])} w={300} h={50} />
      <div className="muted small">Strengths: {c.strengths.join(', ')} · Weaknesses: {c.weaknesses.join(', ')}</div>
      {c.prep?.vsPlayerOpenings.length ? <div className="muted small">Has prepared against your {c.prep.vsPlayerOpenings[0]}.</div> : null}
      {h && <div>You vs {c.name.split(' ')[0]}: <Record {...h} /></div>}
      {hon && hon.awards.length > 0 && (
        <>
          <h4>Trophies · {hon.victories} victories{hon.championships ? ` · ${hon.championships} titles` : ''}</h4>
          <div className="shelf">
            {[...hon.awards].sort((x, y) => y.day - x.day).slice(0, 8).map((aw) => (
              <button key={aw.awardId} className={'shelf-item' + (aw.current ? ' current' : '')} onClick={() => nav.open({ kind: 'trophy', awardId: aw.awardId })}>
                <TrophyImage defId={aw.defId} arena={aw.arena} size={64} />
                <span>{TROPHY_BY_ID[aw.defId]?.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {prep.basis && <div className="muted small">Preparation vs you: {prep.basis}</div>}
      {c.retiredDay === null && !s.active && (
        <button className="btn crimson" onClick={() => { mutate((x) => startGame(x, c, { kind: 'challenge', tcId: x.settings.defaultTc })); onClose(); nav.play(); }}><IconArena size={18} /> Challenge</button>
      )}
      <div className="muted small">Ratings of simulated competitors come from real results — off-screen games are statistically resolved from hidden playing strength; broadcast and player games are played move by move.</div>
    </Sheet>
  );
}
