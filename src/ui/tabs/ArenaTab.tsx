import { useMemo, useState } from 'react';
import { useSave, mutate } from '../store';
import { useNav } from '../nav';
import { Card, CompetitorPortrait, Emblem, Record, compAge } from '../components/common';
import { IconArena, IconRefresh, IconTrophy, IconShield, IconClose } from '../components/icons';
import { RANKS, ARENAS } from '../../world/arenas';
import { TIME_CONTROLS } from '../../game/state';
import {
  suggestOpponents, careerRating, playerTournamentGame, acceptTournament, dismissInvitation, restDays, startGame, playerArena,
} from '../../game/career';
import { STYLE_LABEL } from '../../engine/styles';
import { isProvisional, PROVISIONAL_GAMES } from '../../rating/elo';
import { useArenaArt } from '../components/ArenaArt';
import { CHALLENGE_COST } from '../../game/influence';
import { objectives } from '../../game/legacy';

export function careerObjective(s: ReturnType<typeof useSave>): { title: string; detail: string } {
  const p = s.player;
  const r = careerRating(s);
  if (isProvisional(r)) return { title: 'Placement', detail: `${PROVISIONAL_GAMES - r.games} rated games until your rating is established.` };
  if (p.trial) return { title: 'Promotion Trial', detail: `Win your trial to enter ${ARENAS[RANKS[p.trial.toRank].arena].name}.` };
  const pt = playerTournamentGame(s);
  if (pt) return { title: pt.t.name, detail: 'Your round is waiting.' };
  const next = RANKS[p.rank + 1];
  if (!next) return { title: 'Defend the Throne', detail: 'Hold your titles and push your peak Elo.' };
  const crosses = next.arena > RANKS[p.rank].arena;
  return {
    title: crosses ? `Qualify for ${ARENAS[next.arena].name}` : `Rise to ${next.name}`,
    detail: crosses ? `Reach ${next.floor} Elo to earn a promotion trial (${next.floor - r.rating > 0 ? next.floor - r.rating + ' to go' : 'ready'}).` : `Reach ${next.floor} Elo (${Math.max(0, next.floor - r.rating)} to go).`,
  };
}

export function ArenaTab() {
  const s = useSave();
  const nav = useNav();
  const [salt, setSalt] = useState(0);
  const [tcId, setTcId] = useState(s.settings.defaultTc);
  const sugg = useMemo(() => suggestOpponents(s, salt), [s.world.day, s.player.ratedGames, salt]); // eslint-disable-line react-hooks/exhaustive-deps
  const tg = playerTournamentGame(s);
  const objs = useMemo(() => objectives(s), [s.world.day, s.player.ratedGames, s.world.invitations.length, s.player.rank]); // eslint-disable-line react-hooks/exhaustive-deps
  const obj = objs[0] ?? careerObjective(s);
  const main = sugg[0];
  const arena = playerArena(s);
  const day = s.world.day;
  const invites = s.world.invitations;
  const rival = s.player.rivalId ? s.world.competitors.find((c) => c.id === s.player.rivalId) : null;
  const pickTc = (id: string) => {
    setTcId(id);
    mutate((x) => (x.settings.defaultTc = id));
  };

  const oppAge = main ? compAge(main.c, day) : 0;
  const heroArt = useArenaArt(arena);
  return (
    <div className="arena-home">
      <div className="arena-col">
        <div className="hero" style={{ ['--backdrop' as string]: heroArt }}>
          <div className="hero-shade" />
          <div className="hero-content">
            <div className="kicker">{ARENAS[arena].name} · Objective</div>
            <div className="obj-title">{obj.title}</div>
            <div className="obj-detail">{obj.detail}</div>
            {'progress' in obj && obj.progress && <div className="meter" style={{ maxWidth: 320 }}><span style={{ width: `${Math.round((obj.progress.current / Math.max(1, obj.progress.target)) * 100)}%` }} /></div>}
            {objs.length > 1 && <div className="obj-alts">{objs.slice(1, 4).map((o) => <span key={o.id} className="pill" title={o.detail}>{o.title}</span>)}</div>}
          </div>
        </div>

        {s.active && (
          <Card className="resume" onClick={nav.play}>
            <div className="row between">
              <div><b>Game in progress</b><div className="muted small">{s.active.record.white.name} vs {s.active.record.black.name} · move {Math.ceil(s.active.record.moves.length / 2) || 1}</div></div>
              <button className="btn gold">RESUME</button>
            </div>
          </Card>
        )}

        {!s.active && main && (
          <section className="card opp-card" aria-label="Next opponent">
            <div className="opp-banner" onClick={() => nav.open({ kind: 'competitor', id: main.c.id })}>
              <CompetitorPortrait c={main.c} day={day} size={104} />
              <div className="grow">
                <div className="kicker">{main.label}</div>
                <div className="opp-name">{main.c.name}</div>
                <div className="opp-rank"><Emblem rank={main.c.rank} size={22} /> {RANKS[main.c.rank].name}</div>
                <div className="opp-meta">
                  <span className="pill">{STYLE_LABEL[main.c.style] ?? main.c.style}</span>
                  <span className="pill">{main.c.origin} · {oppAge}</span>
                  <span className="pill"><Record w={main.c.w} d={main.c.d} l={main.c.l} /></span>
                </div>
              </div>
              <div className="opp-elo">{main.c.rating}</div>
            </div>
            <div className="opp-body">
              {s.player.h2h[main.c.id] && (
                <div className="rival-line">{s.player.rivalId === main.c.id ? 'Your rival' : 'Head-to-head'} · <Record {...s.player.h2h[main.c.id]} /></div>
              )}
              <div className="stakes">
                <div className="up"><b>+{main.stakes.win}</b><span>Win</span></div>
                <div className="eq"><b>{main.stakes.draw >= 0 ? '+' : ''}{main.stakes.draw}</b><span>Draw</span></div>
                <div className="down"><b>{main.stakes.loss}</b><span>Loss</span></div>
              </div>
              <div className="chips">
                {TIME_CONTROLS.filter((t) => t.pool !== 'untimed').map((t) => (
                  <button key={t.id} className={'chip' + (tcId === t.id ? ' on' : '')} onClick={() => pickTc(t.id)}>{t.label}</button>
                ))}
              </div>
              <div className="row gap">
                <button className="btn crimson big grow" onClick={() => { mutate((x) => startGame(x, main.c, { kind: 'ranked', tcId })); nav.play(); }}><IconArena size={20} /> PLAY</button>
                <button className="btn" onClick={() => setSalt((n) => n + 1)} aria-label="Find another opponent"><IconRefresh size={20} /></button>
              </div>
            </div>
          </section>
        )}

        {!s.active && sugg.length > 1 && (
          <div className="opp-list">
            {sugg.slice(1).map((o) => (
              <Card key={o.c.id} className="opp-mini">
                <div className="row" onClick={() => nav.open({ kind: 'competitor', id: o.c.id })}>
                  <CompetitorPortrait c={o.c} day={day} size={48} />
                  <div className="grow">
                    <div className="kicker">{o.label}</div>
                    <b>{o.c.name}</b>
                    <div className="muted small">{RANKS[o.c.rank].name} · <b>{o.c.rating}</b> · <span className="w">+{o.stakes.win}</span>/<span className="l">{o.stakes.loss}</span></div>
                  </div>
                  <button className="btn small" onClick={(e) => { e.stopPropagation(); mutate((x) => startGame(x, o.c, { kind: o.c.id === x.player.rivalId ? 'rivalry' : 'challenge', tcId })); nav.play(); }}>Play</button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="arena-col">
        {!s.active && tg && tg.opp && (
          <Card className="tourn-game" title={<><IconTrophy size={16} /> {tg.t.name}</>}>
            <div className="row">
              <CompetitorPortrait c={tg.opp} day={day} size={56} />
              <div className="grow">
                <b>{tg.opp.name}</b>
                <div className="muted small"><Emblem rank={tg.opp.rank} size={16} /> {RANKS[tg.opp.rank].name} · {tg.opp.rating} · you play {tg.color === 'w' ? 'White' : 'Black'}</div>
              </div>
              <button className="btn gold" onClick={() => {
                mutate((x) => startGame(x, tg.opp!, { kind: 'tournament', tcId: tcFor(x.settings.careerPool), color: tg.color, tournamentId: tg.t.id, pairingId: tg.pairingId }));
                nav.play();
              }}>PLAY</button>
            </div>
          </Card>
        )}

        {!s.active && s.player.trial && invites.filter((i) => i.kind === 'trial').map((inv) => {
          const c = s.world.competitors.find((x) => x.id === inv.fromId);
          if (!c) return null;
          return (
            <Card key={inv.id} className="trial" title={<><IconShield size={16} /> Promotion Trial</>}>
              <div className="row">
                <CompetitorPortrait c={c} day={day} size={56} />
                <div className="grow"><b>{c.name}</b><div className="muted small">{inv.detail}</div></div>
                <button className="btn crimson" onClick={() => { mutate((x) => { startGame(x, c, { kind: 'trial', tcId: tcFor(x.settings.careerPool) }); dismissInvitation(x, inv.id); }); nav.play(); }}>FIGHT</button>
              </div>
            </Card>
          );
        })}

        {invites.filter((i) => i.kind !== 'trial').length > 0 && (
          <Card title="Invitations">
            {invites.filter((i) => i.kind !== 'trial').map((inv) => {
              const c = inv.fromId ? s.world.competitors.find((x) => x.id === inv.fromId) : null;
              return (
                <div key={inv.id} className="invite">
                  {c ? <CompetitorPortrait c={c} day={day} size={40} /> : <span className="inv-icon"><IconTrophy size={20} /></span>}
                  <div className="grow">
                    <b>{inv.title}</b>
                    <div className="muted small">{inv.detail} · {inv.stakes}</div>
                  </div>
                  <button className="btn small gold" onClick={() => {
                    if (inv.tournamentId) mutate((x) => acceptTournament(x, inv.tournamentId!));
                    else if (c) { mutate((x) => { startGame(x, c, { kind: inv.kind === 'rivalry' ? 'rivalry' : 'challenge', tcId }); dismissInvitation(x, inv.id); }); nav.play(); }
                  }}>Accept</button>
                  <button className="icon-btn" onClick={() => mutate((x) => dismissInvitation(x, inv.id))} aria-label="Decline"><IconClose size={18} /></button>
                </div>
              );
            })}
          </Card>
        )}

        {rival && (
          <Card title="Rival" onClick={() => nav.open({ kind: 'competitor', id: rival.id })}>
            <div className="row">
              <CompetitorPortrait c={rival} day={day} size={48} />
              <div className="grow"><b>{rival.name}</b><div className="muted small">{RANKS[rival.rank].name} · {rival.rating} · you <Record {...s.player.h2h[rival.id]} /></div></div>
            </div>
            {!s.active && s.player.influence >= CHALLENGE_COST && (
              <button className="btn small" style={{ marginTop: 8 }} onClick={(e) => { e.stopPropagation(); mutate((x) => { x.player.influence -= CHALLENGE_COST; startGame(x, rival, { kind: 'rivalry', tcId }); }); nav.play(); }}>
                Formal challenge · {CHALLENGE_COST} Influence
              </button>
            )}
          </Card>
        )}

        <Card title="More">
          <div className="row gap wrap">
            {main && <button className="btn small" disabled={!!s.active} onClick={() => { mutate((x) => startGame(x, main.c, { kind: 'casual', tcId: 'untimed', rated: false })); nav.play(); }}>Untimed practice</button>}
            {sugg[2] && <button className="btn small" disabled={!!s.active} onClick={() => { mutate((x) => startGame(x, sugg[2].c, { kind: 'casual', tcId, rated: false })); nav.play(); }}>Casual game</button>}
            <button className="btn small" disabled={!!s.active || !!tg} onClick={() => mutate((x) => { restDays(x, 1); })}>Rest a day</button>
            <button className="btn small" disabled={!!s.active || !!tg} onClick={() => mutate((x) => { restDays(x, 7); })}>Rest a week</button>
          </div>
          <div className="muted small" style={{ marginTop: 6 }}>Each finished game moves the empire one day forward.</div>
        </Card>
      </div>
    </div>
  );
}

export function tcFor(pool: string): string {
  return TIME_CONTROLS.find((t) => t.pool === pool)?.id ?? 'rapid-10';
}
