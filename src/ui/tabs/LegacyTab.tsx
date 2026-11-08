import { ChessPerformance, CareerHistory, HallOfFame, TournamentResults, GameHistory } from './legacyExtras';
import { PROVISIONAL_GAMES } from '../../rating/elo';
import { placementStatus } from '../../game/placement';
import { sigDefFor } from '../../world/trophies';
import { isPieceSetUnlocked, pieceSetById } from '../../board2d/pieceSets';
import { useEffect, useMemo, useState } from 'react';
import { useSave, mutate, setSave, getSave } from '../store';
import { useNav } from '../nav';
import { Card, Emblem, Portrait, Record, Sparkline, Stat, Sheet, dayLabel, pct } from '../components/common';
import { RANKS, ARENAS, TOP_ARENA } from '../../world/arenas';
import { achievementProgress, CATEGORY_LABELS } from '../../game/achievements';
import { awardsFor, trophyCabinet, rarityOf, allAwards, awardsByDef, TROPHY_BY_ID } from '../../world/trophies';
import { legacyTimeline, rivalries, championshipPrivileges } from '../../game/legacy';
import { TrophyImage } from '../components/TrophyImage';
import { PIECE_STYLES, pieceSrc, type PieceStyle } from '../components/Board';
import { ALL_THEMES, boardImages } from '../../board2d/themes';
import { careerRating, bestRating } from '../../game/career';
import { exportAll, importAll, listBackups, restoreBackup, wipeAll, persistSave, whenSaved } from '../../persist/save';
import { requestPersistence } from '../../persist/db';
import { downloadText } from '../AnalysisView';
import { engineStatus, installEnginePack, cancelEnginePack, verifyEnginePack, removeEnginePack, onEngineStatus } from '../../engine/browserEngine';
import type { Settings } from '../../game/state';
import { PLAYER_ID } from '../../world/calendar';

type Sec = 'profile' | 'honors' | 'achievements' | 'timeline' | 'collection' | 'settings' | 'saves' | 'fame';

export function LegacyTab() {
  const [sec, setSec] = useState<Sec>('profile');
  return (
    <div className="page">
      <div className="seg">
        {(['profile', 'honors', 'fame', 'achievements', 'timeline', 'collection', 'settings', 'saves'] as Sec[]).map((x) => (
          <button key={x} className={sec === x ? 'on' : ''} onClick={() => setSec(x)}>
            {{ profile: 'Profile', honors: 'Hall of Honors', fame: 'Hall of Fame', achievements: 'Achievements', timeline: 'Timeline', collection: 'Collection', settings: 'Settings', saves: 'Saves' }[x]}
          </button>
        ))}
      </div>
      {sec === 'profile' && <Profile />}
      {sec === 'honors' && <HallOfHonors />}
      {sec === 'fame' && <HallOfFame />}
      {sec === 'achievements' && <Achievements />}
      {sec === 'timeline' && <Timeline />}
      {sec === 'collection' && <Collection />}
      {sec === 'settings' && <SettingsPanel />}
      {sec === 'saves' && <Saves />}
    </div>
  );
}

const TIER_ORDER: Record<string, number> = { legendary: 4, epic: 3, rare: 2, common: 1 };

export function Profile() {
  const s = useSave();
  const nav = useNav();
  const p = s.player;
  const r = careerRating(s);
  const pl = placementStatus(s);
  const prov = !!pl || r.games < PROVISIONAL_GAMES;
  const hist = p.ratingHistory.filter((h) => h.pool === s.settings.careerPool).map((h) => h.rating);
  const rivals = useMemo(() => rivalries(s, 5), [s.world.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const recent = s.library.slice(-10).map((id) => s.libraryMeta[id]).filter((m) => m?.playerColor);
  const form = recent.map((m) => (m.result === '1/2-1/2' ? 'd' : (m.result === '1-0') === (m.playerColor === 'w') ? 'w' : 'l'));
  const openings = Object.entries(p.openingsPlayed).sort((a, b) => b[1].w + b[1].d + b[1].l - (a[1].w + a[1].d + a[1].l)).slice(0, 6);
  const analysed = Object.values(s.libraryMeta).filter((m) => m.playerColor && m.accuracy !== undefined);
  const avgAcc = analysed.length ? analysed.reduce((a, m) => a + (m.accuracy ?? 0), 0) / analysed.length : null;
  const trophies = useMemo(() => awardsFor(s.world, PLAYER_ID), [s.world.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const featured = [...trophies].sort((a, b) => (TIER_ORDER[TROPHY_BY_ID[b.defId]?.tier] ?? 0) - (TIER_ORDER[TROPHY_BY_ID[a.defId]?.tier] ?? 0) || b.day - a.day)[0];
  const ach = useMemo(() => achievementProgress(s), [s.world.day, Object.keys(p.achievements).length]); // eslint-disable-line react-hooks/exhaustive-deps
  const got = ach.filter((a) => a.unlockedDay !== null).length;
  const priv = championshipPrivileges(s);
  return (
    <>
      <Card className="passport">
        <div className="row wrap">
          <Portrait seed={p.portraitSeed} female={p.female} arena={RANKS[p.rank].arena} size={96} />
          <div className="grow">
            <div className="pp-name">{p.name}</div>
            <div className="opp-rank"><Emblem rank={p.rank} size={30} /> {RANKS[p.rank].name} <span className="muted">· {ARENAS[RANKS[p.rank].arena].name}</span></div>
            <div className="muted small">Enlisted {dayLabel(p.createdDay)} · now {dayLabel(s.world.day)}</div>
            {priv.titles.length > 0 && <div className="opp-meta">{priv.titles.map((t) => <span key={t.titleId} className="pill crimson">{t.name} · {t.defenses} def.</span>)}</div>}
          </div>
          {featured && (
            <button className="shelf-item" onClick={() => nav.open({ kind: 'trophy', awardId: featured.awardId })} title="Featured honour">
              <TrophyImage defId={featured.defId} arena={featured.arena} size={96} />
              <span>{TROPHY_BY_ID[featured.defId]?.name}</span>
            </button>
          )}
        </div>
        <div className="stats-grid">
          <Stat label={prov ? 'Elo · provisional' : 'Elo'} value={prov ? `${r.rating}?` : r.rating} sub={pl ? `placement ${pl.games}/${pl.of}` : prov ? `${r.games}/${PROVISIONAL_GAMES} games` : r.peak > 0 ? `peak ${r.peak}` : 'peak —'} />
          <Stat label="Influence" value={p.influence} sub={`prestige ${p.prestige}`} />
          <Stat label="Games" value={p.w + p.d + p.l} sub={<Record w={p.w} d={p.d} l={p.l} />} />
          <Stat label="Score" value={p.w + p.d + p.l ? `${pct(p.w, p.d, p.l)}%` : "—"} />
          <Stat label="Titles" value={p.championships} />
          <Stat label="Trophies" value={trophies.length} />
          <Stat label="Achievements" value={`${got}/${ach.length}`} />
          <Stat label="Accuracy" value={avgAcc !== null ? `${avgAcc.toFixed(1)}%` : '—'} />
        </div>
        <div className="form-row">{form.map((f, i) => <span key={i} className={'form ' + f}>{f.toUpperCase()}</span>)}</div>
        <Sparkline values={hist.slice(-120)} w={320} h={60} color="#9c1f1a" />
        <div className="muted small">{pl ? `Placement: ${pl.games} of ${pl.of} rated games played${pl.performance !== null ? ` · performance ${Math.round(pl.performance)}` : ''}. Your rating and starting grade are set from these games (up to Decanus I).` : prov ? `Provisional rating — ${PROVISIONAL_GAMES - r.games} more rated games to establish it.` : r.peak > 0 ? `Best ever ${bestRating(s)} · peak ${r.peak}` : ''}</div>
      </Card>
      {rivals.length > 0 && (
        <Card title="Rivalries">
          {rivals.map((rv) => (
            <div key={rv.id} className="leader" onClick={() => nav.open({ kind: 'competitor', id: rv.id })}>
              <span className="grow">{rv.name}{rv.id === p.rivalId ? ' · rival' : ''}</span>
              {rv.championshipBattles ? <span className="pill crimson">{rv.championshipBattles} title</span> : null}
              {rv.tournamentEncounters ? <span className="pill">{rv.tournamentEncounters} events</span> : null}
              <Record w={rv.w} d={rv.d} l={rv.l} />
            </div>
          ))}
        </Card>
      )}
      {openings.length > 0 && <Card title="Opening results">{openings.map(([n, o]) => <div key={n} className="leader"><span className="grow">{n}</span><Record w={o.w} d={o.d} l={o.l} /></div>)}</Card>}
      <ChessPerformance />
      <TournamentResults />
      <CareerHistory />
      <GameHistory />
    </>
  );
}

export function PassportSheet({ onClose }: { onClose: () => void }) {
  return <Sheet title="Imperial Passport" onClose={onClose}><Profile /></Sheet>;
}

function HallOfHonors() {
  const s = useSave();
  const nav = useNav();
  const [cat, setCat] = useState<string>('all');
  const [arena, setArena] = useState<number | null>(null);
  const [rar, setRar] = useState<string>('all');
  const [sort, setSort] = useState<'recent' | 'rarity'>('recent');
  const cabinet = useMemo(() => trophyCabinet(s.world, PLAYER_ID), [s.world.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const all = useMemo(() => awardsFor(s.world, PLAYER_ID), [s.world.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const cats = [...new Set(cabinet.map((c) => c.def.category))];
  let list = cabinet.filter((c) => (cat === 'all' || c.def.category === cat) && (rar === 'all' || c.def.tier === rar) && (arena === null || c.latest.arena === arena));
  list = sort === 'recent' ? list.sort((a, b) => b.latest.day - a.latest.day) : list.sort((a, b) => (TIER_ORDER[b.def.tier] ?? 0) - (TIER_ORDER[a.def.tier] ?? 0));
  const signatureWon = new Set(all.filter((a) => a.defId.startsWith('sig-')).map((a) => a.defId));
  return (
    <div className="hall">
      <h2 style={{ margin: '2px 0 4px' }}>Hall of Honors</h2>
      <div className="muted small">{all.length} awards · {cabinet.length} distinct honours · every one earned in competition</div>
      <div className="chips">
        <button className={'chip' + (sort === 'recent' ? ' on' : '')} onClick={() => setSort('recent')}>Recent</button>
        <button className={'chip' + (sort === 'rarity' ? ' on' : '')} onClick={() => setSort('rarity')}>Rarest</button>
        <select className="chip" value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category">
          <option value="all">All kinds</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="chip" value={rar} onChange={(e) => setRar(e.target.value)} aria-label="Rarity">
          <option value="all">Any rarity</option>{['common', 'rare', 'epic', 'legendary'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="chip" value={arena ?? ''} onChange={(e) => setArena(e.target.value === '' ? null : Number(e.target.value))} aria-label="Arena">
          <option value="">All arenas</option>{ARENAS.map((a) => <option key={a.index} value={a.index}>{a.name}</option>)}
        </select>
      </div>
      {list.length === 0 && <div className="muted" style={{ padding: 20, textAlign: 'center' }}>No honours yet. Win a tournament — every trophy you earn will stand here forever.</div>}
      <div className="shelf">
        {list.map((c) => (
          <button key={c.def.id} className={'shelf-item' + (c.current ? ' current' : '')} onClick={() => nav.open({ kind: 'trophy', awardId: c.latest.awardId })}>
            {c.count > 1 && <span className="count">×{c.count}</span>}
            <TrophyImage defId={c.def.id} arena={c.latest.arena} size={92} />
            <span>{c.def.name}</span>
            <span className={'rarity ' + c.def.tier}>{c.def.tier}</span>
          </button>
        ))}
      </div>
      <h4>The {ARENAS.length} signature trophies</h4>
      <div className="shelf">
        {ARENAS.map((a) => (
          <div key={a.index} className="shelf-item" title={a.trophy}>
            <TrophyImage defId={sigDefFor(a.index)} arena={a.index} size={80} locked={!signatureWon.has(sigDefFor(a.index))} />
            <span>{a.trophy}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TrophySheet({ awardId, onClose }: { awardId: string; onClose: () => void }) {
  const s = useSave();
  const nav = useNav();
  const a = allAwards(s.world).find((x) => x.awardId === awardId);
  if (!a) return <Sheet title="Trophy" onClose={onClose}><div className="muted">Not found.</div></Sheet>;
  const def = TROPHY_BY_ID[a.defId];
  const rarity = rarityOf(s.world, a.defId);
  const mine = awardsFor(s.world, a.holder).filter((x) => x.defId === a.defId).sort((x, y) => y.day - x.day);
  const history = awardsByDef(s.world, a.defId).slice(-12).reverse();
  return (
    <Sheet title={def?.name ?? 'Trophy'} onClose={onClose}>
      <div className="hall-feature">
        <TrophyImage defId={a.defId} arena={a.arena} size={170} />
        <div>
          <span className={'rarity ' + (def?.tier ?? '')}>{def?.tier}{rarity ? ` · ${rarity.label}` : ''}</span>
          <h3 style={{ margin: '4px 0' }}>{def?.name}</h3>
          <div className="muted small">{def?.desc}</div>
          <div style={{ marginTop: 6 }}><b>{a.holderName}</b> · {a.result}{a.finalOpponentName ? ` vs ${a.finalOpponentName}` : ''}</div>
          <div className="muted small">{ARENAS[a.arena].name} · Season {a.season + 1} · {dayLabel(a.day)}{a.defenseNumber ? ` · defence #${a.defenseNumber}` : ''}{a.current ? ' · currently held' : ''}</div>
        </div>
      </div>
      {mine.length > 1 && <><h4>Won {mine.length} times</h4>{mine.map((m) => <div key={m.awardId} className="leader"><span className="grow">Season {m.season + 1} · {m.result}</span><span className="muted">{dayLabel(m.day)}</span></div>)}</>}
      {a.gameIds.length > 0 && (
        <>
          <h4>Games</h4>
          <div className="chips">{a.gameIds.map((g, i) => <button key={g} className="chip" onClick={() => nav.open({ kind: 'analysis', gameId: g })}>Replay {i + 1}</button>)}</div>
        </>
      )}
      <h4>Recent holders</h4>
      {history.map((h) => <div key={h.awardId} className="leader"><span className="grow">{h.holderName}</span><span className="muted">S{h.season + 1} · {h.result}</span></div>)}
    </Sheet>
  );
}

function Achievements() {
  const s = useSave();
  const prog = useMemo(() => achievementProgress(s), [s.world.day, Object.keys(s.player.achievements).length]); // eslint-disable-line react-hooks/exhaustive-deps
  const [only, setOnly] = useState<'all' | 'got' | 'open'>('all');
  const byCat = new Map<string, typeof prog>();
  for (const a of prog) {
    if (only === 'got' && a.unlockedDay === null) continue;
    if (only === 'open' && a.unlockedDay !== null) continue;
    const k = a.def.category;
    byCat.set(k, [...(byCat.get(k) ?? []), a]);
  }
  const got = prog.filter((a) => a.unlockedDay !== null).length;
  return (
    <Card title={`Achievements · ${got}/${prog.length}`}>
      <div className="meter"><span style={{ width: `${(got / prog.length) * 100}%` }} /></div>
      <div className="chips">
        {(['all', 'open', 'got'] as const).map((k) => <button key={k} className={'chip' + (only === k ? ' on' : '')} onClick={() => setOnly(k)}>{{ all: 'All', open: 'In progress', got: 'Unlocked' }[k]}</button>)}
      </div>
      {[...byCat.entries()].map(([cat, list]) => (
        <div key={cat}>
          <div className="ach-cat"><h4 style={{ margin: 0 }}>{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] ?? cat}</h4><span className="muted small">{list.filter((a) => a.unlockedDay !== null).length}/{list.length}</span></div>
          <div className="ach-grid">
            {list.map((a) => (
              <div key={a.def.id} className={'ach' + (a.unlockedDay !== null ? ' got' : '')}>
                <div className="row between"><b>{a.def.name}</b><span className={'rarity ' + a.def.rarity}>{a.def.rarity}</span></div>
                <span className="muted small">{a.def.desc}</span>
                {a.unlockedDay !== null ? <span className="small" style={{ color: 'var(--win)', fontWeight: 700 }}>Unlocked {dayLabel(a.unlockedDay)}</span>
                  : a.target > 1 ? <><div className="meter"><span style={{ width: `${a.fraction * 100}%` }} /></div><span className="muted small">{a.current}/{a.target}</span></> : null}
              </div>
            ))}
          </div>
        </div>
      ))}
    </Card>
  );
}

function Timeline() {
  const s = useSave();
  const nav = useNav();
  const tl = useMemo(() => legacyTimeline(s).slice().reverse().slice(0, 200), [s.world.day]); // eslint-disable-line react-hooks/exhaustive-deps
  const reports = (s.player.seasonReports ?? []).slice().reverse();
  const played = s.world.history.filter((h) => h.playerPlace !== undefined).slice(-20).reverse();
  return (
    <>
      {reports.length > 0 && (
        <Card title="Seasons">
          {reports.slice(0, 8).map((r) => (
            <div key={r.season} className="leader">
              <span className="grow"><b>Season {r.season + 1}</b> · {r.w}–{r.d}–{r.l}{r.trophies.length ? ` · ${r.trophies.length} trophies` : ''}</span>
              <span className={r.ratingEnd >= r.ratingStart ? 'w' : 'l'}>{r.ratingEnd >= r.ratingStart ? '+' : ''}{r.ratingEnd - r.ratingStart}</span>
              <b>{r.ratingEnd}</b>
            </div>
          ))}
        </Card>
      )}
      <Card title="Your legacy">
        {tl.length === 0 && <div className="muted">Your story begins with your first game.</div>}
        <div className="timeline">
          {tl.map((e, i) => (
            <div key={i} className={'tl-item ' + e.kind} onClick={() => e.kind === 'trophy' && e.ref && nav.open({ kind: 'trophy', awardId: e.ref })}>
              <div>{e.text}</div>
              <div className="muted">{dayLabel(e.day)}</div>
            </div>
          ))}
        </div>
      </Card>
      {played.length > 0 && <Card title="Tournament record">{played.map((h) => <div key={h.id} className="leader"><span className="grow">{h.name}</span><b>#{h.playerPlace}</b><span className="muted">/{h.size}</span></div>)}</Card>}
    </>
  );
}

/** Cosmetic collections: boards unlock with arenas, piece sets with career milestones. Never affects chess. */
function pieceUnlocked(s: ReturnType<typeof useSave>, id: string): boolean {
  const top = Math.max(...s.player.unlockedSets, RANKS[s.player.peakRank].arena);
  return isPieceSetUnlocked(id, top);
}

function unlockArenaName(id: string): string {
  const u = pieceSetById(id)?.unlock;
  return u && 'arena' in u ? (ARENAS[u.arena]?.name ?? '').replace(/^The /, '') : '';
}

function Collection() {
  const s = useSave();
  const unlockedArenas = new Set([...s.player.unlockedSets, ...Array.from({ length: RANKS[s.player.peakRank].arena + 1 }, (_, i) => i)]);
  const current = s.settings.boardTheme ?? 'arena';
  const pieces = s.settings.pieceStyle ?? 'board';
  const reachedThrone = RANKS[s.player.peakRank].arena >= TOP_ARENA || s.player.titles.includes(`title-${TOP_ARENA}`);
  return (
    <>
      <Card title="Piece sets">
        <div className="sets">
          {[{ id: 'board', name: "Board's own" }, ...PIECE_STYLES].map((p) => {
            const has = p.id === 'board' || pieceUnlocked(s, p.id);
            return (
              <button key={p.id} className={'set' + (pieces === p.id ? ' on' : '') + (has ? '' : ' locked')} disabled={!has} onClick={() => mutate((x) => (x.settings.pieceStyle = p.id))}>
                <div className="set-board" style={{ background: 'linear-gradient(135deg, #F3EEE3 50%, #CFC4AE 50%)' }}>
                  {p.id === 'board' ? <span className="muted small">Matches each board</span> : <><img src={pieceSrc(p.id as PieceStyle, 'w', 'k')} alt="" /><img src={pieceSrc(p.id as PieceStyle, 'b', 'n')} alt="" /><img src={pieceSrc(p.id as PieceStyle, 'w', 'q')} alt="" /></>}
                </div>
                <span>{p.name}{has ? '' : ` · ${unlockArenaName(p.id)}`}</span>
              </button>
            );
          })}
        </div>
      </Card>
      <Card title="Boards">
        <div className="sets">
          <button className={'set' + (current === 'arena' ? ' on' : '')} onClick={() => mutate((x) => (x.settings.boardTheme = 'arena'))}>
            <div className="set-board" style={{ background: 'linear-gradient(135deg, #FAF8F3, #E6E1D6)' }}><span className="muted small">Each arena's signature board</span></div>
            <span>Arena signature</span>
          </button>
          {ALL_THEMES.map((t) => {
            const has = t.id === 'laurel' ? reachedThrone : unlockedArenas.has(t.arena);
            const img = boardImages(t, 256);
            return (
              <button key={t.id} className={'set' + (current === t.id ? ' on' : '') + (has ? '' : ' locked')} disabled={!has} onClick={() => mutate((x) => (x.settings.boardTheme = t.id))}>
                <div className="set-board" style={{ backgroundImage: `url(${img.squares})`, boxShadow: `0 0 0 4px ${t.frame}` }}>
                  <img src={pieceSrc(t.pieces, 'w', 'k')} alt="" /><img src={pieceSrc(t.pieces, 'b', 'q')} alt="" />
                </div>
                <span>{t.name}{has ? '' : ` · ${t.id === 'laurel' ? 'Eternal Throne' : ARENAS[t.arena].name.replace('The ', '')}`}</span>
              </button>
            );
          })}
        </div>
        <div className="muted small">Cosmetic only. Unlocked collections are kept forever, even after demotion.</div>
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
      <Choice k="animSpeed" label="Piece movement" options={[['fast', 'Fast'], ['balanced', 'Balanced'], ['majestic', 'Majestic'], ['custom', 'Custom']]} />
      {s.settings.animSpeed === 'custom' && <div className="choice"><span>Move duration · {s.settings.animMs ?? 480} ms</span><input type="range" min={150} max={1200} step={10} value={s.settings.animMs ?? 480} onChange={(e) => mutate((x) => (x.settings.animMs = Number(e.target.value)))} /></div>}
      <div className="choice"><span>Text size · {Math.round((s.settings.textScale ?? 1) * 100)}%</span><input type="range" min={0.9} max={1.3} step={0.05} value={s.settings.textScale ?? 1} onChange={(e) => mutate((x) => (x.settings.textScale = Number(e.target.value)))} /></div>
      <Choice k="opponentPace" label="Opponent pace" options={[['natural', 'Natural'], ['instant', 'Instant']]} />
      <Toggle k="showLegal" label="Show legal moves" />
      <Toggle k="showCoords" label="Coordinates" />
      <Toggle k="autoQueen" label="Auto-queen" />
      <Toggle k="sound" label="Sound effects" />
      <Toggle k="ambience" label="Arena ambience" />
      <Toggle k="reduceMotion" label="Reduce motion" />
      <Toggle k="highContrast" label="High contrast" />
      <EngineCard />
      <div className="muted small">GLADIUS is untimed: you always have unlimited thinking time, and games can be left and resumed without penalty.</div>
    </Card>
  );
}

/** Start a fresh zero-progress career without losing the current one: download + snapshot first. */
function NewCareerCard() {
  const s = useSave();
  const [step, setStep] = useState<'idle' | 'confirm' | 'saving'>('idle');
  const [download, setDownload] = useState(true);
  const p = s.player;
  const begin = async () => {
    setStep('saving');
    const cur = getSave();
    if (download) downloadText(`gladius-${cur.player.name.replace(/\W+/g, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`, await exportAll(cur), 'application/json');
    await persistSave(cur, { backup: true, full: true });
    await whenSaved();
    window.dispatchEvent(new Event('gladius:new-career'));
  };
  return (
    <Card title="Career">
      <div className="leader"><span className="grow"><b>Continue: {p.name}</b><div className="muted small">{RANKS[p.rank].name} · {ARENAS[RANKS[p.rank].arena].name} · {p.w}–{p.d}–{p.l}</div></span><span className="pill gold">Active</span></div>
      {step === 'idle' && <button className="btn" style={{ marginTop: 10 }} onClick={() => setStep('confirm')}>Start a new career…</button>}
      {step !== 'idle' && (
        <div className="notice" style={{ marginTop: 10 }}>
          <div>A new career starts at zero: Arena I, grade 1 of 72, no record, no Influence, no honours, provisional rating. {p.name}&rsquo;s career is snapshotted to Automatic backups first{download ? ' and downloaded as a file' : ''}, so it can be restored.</div>
          <label className="row" style={{ gap: 8, marginTop: 8 }}><input type="checkbox" checked={download} onChange={(e) => setDownload(e.target.checked)} /> Download a backup file first (recommended)</label>
          <div className="row gap" style={{ marginTop: 10 }}>
            <button className="btn crimson" disabled={step === 'saving' || !!s.active} onClick={() => void begin()}>{step === 'saving' ? 'Saving…' : 'Start new career'}</button>
            <button className="btn" onClick={() => setStep('idle')}>Cancel</button>
          </div>
          {s.active && <div className="muted small" style={{ marginTop: 6 }}>Finish or leave your current game first.</div>}
        </div>
      )}
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
      <NewCareerCard />
      <Card title="Danger zone">
        <button className="btn red" onClick={() => { if (confirm('Delete this career and world permanently? Export first if unsure.')) void wipeAll().then(() => location.reload()); }}>Delete career</button>
      </Card>
      <Card title="About">
        <div className="muted small">GLADIUS v0.4 · Chess engine: Stockfish 19 WASM (lite and full-net builds by Nathan Rugg; the active build is shown above), GPL-3.0 — see engine/STOCKFISH-LICENSE.txt. Rules: chess.js (BSD-2). All art is original and generated in this project. GLADIUS is distributed under GPL-3.0-or-later.</div>
      </Card>
    </>
  );
}

function EngineCard() {
  // Engine identification + engine pack (full-strength Stockfish 19) status, download and verification.
  const [st, setSt] = useState(() => engineStatus());
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => onEngineStatus(() => setSt(engineStatus())), []);
  const { pack, elite, play, plan } = st;
  const mb = (n: number) => `${Math.round(n / 1048576)} MB`;
  const have = pack.state === 'installed' || pack.state === 'bundled';
  const phone = plan.deviceClass !== 'desktop';
  return (
    <div className="choice">
      <span>Chess engine</span>
      <div className="muted small">Opponents ≥ 2700: <b>{elite.label}</b>{elite.fullStrength ? '' : ' — full-strength engine not active'}{elite.onFallback ? ' (fallback after an engine failure)' : ''}</div>
      <div className="muted small">Other opponents &amp; analysis: {play.label} · net {play.netFile} · {elite.crossOriginIsolated ? 'threads available' : 'single-threaded host'}</div>
      <div className="muted small">
        Full-strength engine pack: {pack.state === 'bundled' ? 'bundled with this app' : pack.state === 'installed' ? `installed (${pack.files.length} build${pack.files.length > 1 ? 's' : ''}, SHA-256 verified)` : pack.state === 'downloading' ? `downloading ${mb(pack.loaded)} / ${mb(pack.total)}${pack.phase && pack.phase !== 'download' ? ` · ${pack.phase}` : ''}` : pack.state === 'failed' ? `failed — ${pack.error}` : pack.state === 'checking' ? 'checking…' : st.bigNetBroken ? 'disabled (it crashed on this device)' : 'not installed'}
        {pack.verified ? ` · verify: ${pack.verified.bad.length ? 'damaged files removed' : 'OK'}` : ''}
        {msg ? ` · ${msg}` : ''}
      </div>
      {pack.state === 'downloading' ? (
        <button className="btn small" onClick={() => cancelEnginePack()}>Cancel download</button>
      ) : !have ? (
        <button className="btn small" disabled={pack.state === 'checking'} onClick={() => {
          if (phone && !confirm('The full-strength engine is a ~79 MB download and uses ~0.5 GB of memory while it plays. On phones it is experimental. Install?')) return;
          setMsg(null);
          void installEnginePack({ force: true }).then((ok) => setMsg(ok ? 'ready — used for opponents ≥ 2700' : null));
        }}>Install full-strength engine (~79 MB, works offline)</button>
      ) : pack.state === 'installed' ? (
        <>
          <button className="btn small" onClick={() => void verifyEnginePack().then(() => setSt(engineStatus()))}>Verify</button>{' '}
          <button className="btn small" onClick={() => { if (confirm('Remove the full-strength engine from this device?')) void removeEnginePack(); }}>Remove</button>
        </>
      ) : null}
    </div>
  );
}
