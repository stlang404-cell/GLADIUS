import { useMemo, useState } from 'react';
import { useSave, mutate } from '../store';
import { useNav } from '../nav';
import { Card, CompetitorPortrait, Emblem, Record, Portrait } from '../components/common';
import { IconArena, IconRefresh, IconTrophy, IconShield, IconClose } from '../components/icons';
import { RANKS, ARENAS } from '../../world/arenas';
import { TIME_CONTROLS, UNTIMED_TC } from '../../game/state';
import { ChessGame, START_FEN } from '../../chess/rules';
import { Board } from '../components/Board';
import { crestUri } from '../art';
import { getSave } from '../store';
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
  const sugg = useMemo(() => suggestOpponents(s, salt), [s.world.day, s.player.ratedGames, salt]); // eslint-disable-line react-hooks/exhaustive-deps
  const tg = playerTournamentGame(s);
  const objs = useMemo(() => objectives(s), [s.world.day, s.player.ratedGames, s.world.invitations.length, s.player.rank]); // eslint-disable-line react-hooks/exhaustive-deps
  const obj = objs[0] ?? careerObjective(s);
  const main = sugg[0];
  const arena = playerArena(s);
  const day = s.world.day;
  const invites = s.world.invitations;
  const rival = s.player.rivalId ? s.world.competitors.find((c) => c.id === s.player.rivalId) : null;

  const heroArt = useArenaArt(arena);
  const me = s.player;
  const previewFen = s.active ? ChessGame.fromUci(s.active.record.moves, s.active.record.startFen).fen() : START_FEN;
  const previewColor = s.active?.record.playerColor ?? 'w';
  const shownOpp = s.active ? s.world.competitors.find((c) => c.id === s.active!.opponentId) : tg?.opp ?? main?.c;
  const play = (fn: () => void) => { mutate(fn); nav.play(); };
  return (
    <div className="stage">
      <div className="stage-main" style={{ ['--backdrop' as string]: heroArt }}>
        <div className="stage-title">
          <img className="stage-crest" src={crestUri(arena)} alt="" />
          <div className="grow">
            <div className="stage-arena">{ARENAS[arena].name}</div>
            <div className="stage-motto">{ARENAS[arena].motto}</div>
          </div>
        </div>
        {shownOpp && (
          <div className="player-bar opp" onClick={() => nav.open({ kind: 'competitor', id: shownOpp.id })} style={{ cursor: 'pointer' }}>
            <CompetitorPortrait c={shownOpp} day={day} size={42} />
            <div className="pb-name"><div>{shownOpp.name}</div><div className="pb-sub"><Emblem rank={shownOpp.rank} size={16} /> {RANKS[shownOpp.rank].name}</div></div>
            <span className="pb-elo">{shownOpp.rating}</span>
          </div>
        )}
        <Board fen={previewFen} orientation={previewColor} interactive={false} settings={s.settings} set={arena} arena={arena} label="Arena board" />
        <div className="player-bar me">
          <Portrait seed={me.portraitSeed} female={me.female} arena={arena} size={42} />
          <div className="pb-name"><div>{me.name}</div><div className="pb-sub"><Emblem rank={me.rank} size={16} /> {RANKS[me.rank].name}</div></div>
          {s.active ? <button className="btn crimson" onClick={nav.play}>RESUME</button>
            : tg && tg.opp ? <button className="btn crimson" onClick={() => play(() => startGame(getSave(), tg.opp!, { kind: 'tournament', tcId: UNTIMED_TC, color: tg.color, tournamentId: tg.t.id, pairingId: tg.pairingId }))}>PLAY ROUND</button>
            : main ? <button className="btn crimson" onClick={() => play(() => startGame(getSave(), main.c, { kind: 'ranked', tcId: UNTIMED_TC }))}><IconArena size={18} /> PLAY</button> : null}
        </div>
      </div>

      <div className="stage-side">
        <div className="card">
          <div className="objective">
            <span className="obj-ico"><IconShield size={20} /></span>
            <div className="grow">
              <div className="obj-title">{obj.title}</div>
              <div className="obj-detail">{obj.detail}</div>
            </div>
          </div>
          {'progress' in obj && obj.progress && <div className="meter"><span style={{ width: `${Math.round((obj.progress.current / Math.max(1, obj.progress.target)) * 100)}%` }} /></div>}
          {objs.length > 1 && <div className="obj-alts">{objs.slice(1, 4).map((o) => <span key={o.id} className="pill" title={o.detail}>{o.title}</span>)}</div>}
        </div>

        {!s.active && tg && tg.opp && (
          <div className="card trial" style={{ borderColor: 'var(--gold)' }}>
            <div className="kicker"><IconTrophy size={12} /> {tg.t.name}</div>
            <div className="muted small" style={{ marginTop: 4 }}>Your round vs {tg.opp.name} · you play {tg.color === 'w' ? 'White' : 'Black'}</div>
          </div>
        )}

        {!s.active && s.player.trial && invites.filter((i) => i.kind === 'trial').map((inv) => {
          const c = s.world.competitors.find((x) => x.id === inv.fromId);
          if (!c) return null;
          return (
            <div key={inv.id} className="card trial">
              <div className="kicker">Promotion Trial</div>
              <div className="row" style={{ marginTop: 8 }}>
                <CompetitorPortrait c={c} day={day} size={44} />
                <div className="grow"><b>{c.name}</b><div className="muted small">{inv.detail}</div></div>
                <button className="btn crimson small" onClick={() => play(() => { startGame(getSave(), c, { kind: 'trial', tcId: UNTIMED_TC }); dismissInvitation(getSave(), inv.id); })}>Fight</button>
              </div>
            </div>
          );
        })}

        {!s.active && main && !tg && (
          <section className="card opp-card" aria-label="Next opponent">
            <div className="opp-banner" onClick={() => nav.open({ kind: 'competitor', id: main.c.id })}>
              <CompetitorPortrait c={main.c} day={day} size={64} />
              <div className="grow">
                <div className="kicker">{main.label}</div>
                <div className="opp-name">{main.c.name}</div>
                <div className="opp-meta">
                  <span className="pill">{STYLE_LABEL[main.c.style] ?? main.c.style}</span>
                  <span className="pill"><Record w={main.c.w} d={main.c.d} l={main.c.l} /></span>
                </div>
              </div>
              <div className="opp-elo">{main.c.rating}</div>
            </div>
            <div className="opp-body">
              {s.player.h2h[main.c.id] && <div className="rival-line">{s.player.rivalId === main.c.id ? 'Your rival' : 'Head-to-head'} · <Record {...s.player.h2h[main.c.id]} /></div>}
              <div className="stakes">
                <div className="up"><b>+{main.stakes.win}</b><span>Win</span></div>
                <div className="eq"><b>{main.stakes.draw >= 0 ? '+' : ''}{main.stakes.draw}</b><span>Draw</span></div>
                <div className="down"><b>{main.stakes.loss}</b><span>Loss</span></div>
              </div>
              <div className="row">
                <button className="btn crimson big grow" onClick={() => play(() => startGame(getSave(), main.c, { kind: 'ranked', tcId: UNTIMED_TC }))}>PLAY</button>
                <button className="btn" onClick={() => setSalt((n) => n + 1)} aria-label="Find another opponent"><IconRefresh size={20} /></button>
              </div>
            </div>
          </section>
        )}

        {!s.active && sugg.length > 1 && (
          <div className="opp-list">
            {sugg.slice(1).map((o) => (
              <div key={o.c.id} className="opp-mini" onClick={() => nav.open({ kind: 'competitor', id: o.c.id })}>
                <CompetitorPortrait c={o.c} day={day} size={40} />
                <div className="grow">
                  <div className="kicker" style={{ color: 'var(--muted)' }}>{o.label}</div>
                  <b>{o.c.name}</b> <span className="muted small">{o.c.rating}</span>
                </div>
                <button className="btn small" onClick={(e) => { e.stopPropagation(); play(() => startGame(getSave(), o.c, { kind: o.c.id === getSave().player.rivalId ? 'rivalry' : 'challenge', tcId: UNTIMED_TC })); }}>Play</button>
              </div>
            ))}
          </div>
        )}

        {invites.filter((i) => i.kind !== 'trial').length > 0 && (
          <Card title="Invitations">
            {invites.filter((i) => i.kind !== 'trial').map((inv) => {
              const c = inv.fromId ? s.world.competitors.find((x) => x.id === inv.fromId) : null;
              return (
                <div key={inv.id} className="invite">
                  {c ? <CompetitorPortrait c={c} day={day} size={38} /> : <span className="inv-icon"><IconTrophy size={20} /></span>}
                  <div className="grow"><b>{inv.title}</b><div className="muted small">{inv.stakes}</div></div>
                  <button className="btn small gold" onClick={() => {
                    if (inv.tournamentId) mutate((x) => acceptTournament(x, inv.tournamentId!));
                    else if (c) play(() => { startGame(getSave(), c, { kind: inv.kind === 'rivalry' ? 'rivalry' : 'challenge', tcId: UNTIMED_TC }); dismissInvitation(getSave(), inv.id); });
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
              <CompetitorPortrait c={rival} day={day} size={44} />
              <div className="grow"><b>{rival.name}</b><div className="muted small">{rival.rating} · <Record {...s.player.h2h[rival.id]} /></div></div>
              {!s.active && s.player.influence >= CHALLENGE_COST && (
                <button className="btn small" onClick={(e) => { e.stopPropagation(); play(() => { getSave().player.influence -= CHALLENGE_COST; startGame(getSave(), rival, { kind: 'rivalry', tcId: UNTIMED_TC }); }); }}>Challenge</button>
              )}
            </div>
          </Card>
        )}

        <div className="row wrap" style={{ gap: 6 }}>
          {main && <button className="btn small" disabled={!!s.active} onClick={() => play(() => startGame(getSave(), main.c, { kind: 'casual', tcId: UNTIMED_TC, rated: false }))}>Casual game</button>}
          <button className="btn small" disabled={!!s.active || !!tg} onClick={() => mutate((x) => { restDays(x, 1); })}>Rest a day</button>
          <button className="btn small" disabled={!!s.active || !!tg} onClick={() => mutate((x) => { restDays(x, 7); })}>Rest a week</button>
        </div>
      </div>
    </div>
  );
}

export function tcFor(pool: string): string {
  return TIME_CONTROLS.find((t) => t.pool === pool)?.id ?? 'rapid-10';
}
