import { useMemo, useState } from 'react';
import { useSave, mutate } from '../store';
import { useNav } from '../nav';
import { Card, CompetitorPortrait, Emblem, Record } from '../components/common';
import { RANKS, ARENAS } from '../../world/arenas';
import { TIME_CONTROLS } from '../../game/state';
import {
  suggestOpponents, careerRating, playerTournamentGame, acceptTournament, dismissInvitation, restDays, startGame, playerArena,
} from '../../game/career';
import { STYLE_LABEL } from '../../engine/styles';
import { isProvisional, PROVISIONAL_GAMES } from '../../rating/elo';
import { backdropUri } from '../art';
import { CHALLENGE_COST } from '../../game/influence';

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
  const obj = careerObjective(s);
  const main = sugg[0];
  const arena = playerArena(s);
  const day = s.world.day;
  const invites = s.world.invitations;
  const rival = s.player.rivalId ? s.world.competitors.find((c) => c.id === s.player.rivalId) : null;
  const pickTc = (id: string) => {
    setTcId(id);
    mutate((x) => (x.settings.defaultTc = id));
  };

  return (
    <div className="tab-page arena-tab">
      <div className="hero" style={{ backgroundImage: `url("${backdropUri(arena)}")` }}>
        <div className="hero-shade" />
        <div className="hero-content">
          <div className="hero-obj">
            <div className="kicker">Objective</div>
            <div className="obj-title">{obj.title}</div>
            <div className="obj-detail">{obj.detail}</div>
          </div>
        </div>
      </div>

      {s.active && (
        <Card className="resume" onClick={nav.play}>
          <div className="row between">
            <div><b>Game in progress</b><div className="muted">{s.active.record.white.name} vs {s.active.record.black.name} · move {Math.ceil(s.active.record.moves.length / 2) || 1}</div></div>
            <button className="btn gold">RESUME</button>
          </div>
        </Card>
      )}

      {!s.active && tg && tg.opp && (
        <Card className="tourn-game" title={<>🏆 {tg.t.name}</>}>
          <div className="row">
            <CompetitorPortrait c={tg.opp} day={day} size={56} />
            <div className="grow">
              <b>{tg.opp.name}</b>
              <div className="muted"><Emblem rank={tg.opp.rank} size={16} /> {RANKS[tg.opp.rank].name} · {tg.opp.rating} · you play {tg.color === 'w' ? 'White' : 'Black'}</div>
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
          <Card key={inv.id} className="trial" title={<>⚜ Promotion Trial</>}>
            <div className="row">
              <CompetitorPortrait c={c} day={day} size={56} />
              <div className="grow"><b>{c.name}</b><div className="muted">{inv.detail}</div></div>
              <button className="btn gold" onClick={() => { mutate((x) => { startGame(x, c, { kind: 'trial', tcId: tcFor(x.settings.careerPool) }); dismissInvitation(x, inv.id); }); nav.play(); }}>FIGHT</button>
            </div>
          </Card>
        );
      })}

      {!s.active && main && (
        <Card className="next-opp" title="Next opponent">
          <div className="opp-main" onClick={() => nav.open({ kind: 'competitor', id: main.c.id })}>
            <CompetitorPortrait c={main.c} day={day} size={96} />
            <div className="grow">
              <div className="opp-name">{main.c.name}</div>
              <div className="opp-rank"><Emblem rank={main.c.rank} size={22} /> {RANKS[main.c.rank].name} · <b>{main.c.rating}</b></div>
              <div className="muted">{STYLE_LABEL[main.c.style]} · {main.c.origin} · <Record w={main.c.w} d={main.c.d} l={main.c.l} /></div>
              {s.player.h2h[main.c.id] && <div className="muted">You vs them: <Record {...s.player.h2h[main.c.id]} /></div>}
            </div>
          </div>
          <div className="stakes">
            <span className="up">Win +{main.stakes.win}</span>
            <span>Draw {main.stakes.draw >= 0 ? '+' : ''}{main.stakes.draw}</span>
            <span className="down">Loss {main.stakes.loss}</span>
          </div>
          <div className="chips">
            {TIME_CONTROLS.filter((t) => t.pool !== 'untimed').map((t) => (
              <button key={t.id} className={'chip' + (tcId === t.id ? ' on' : '')} onClick={() => pickTc(t.id)}>{t.label}</button>
            ))}
          </div>
          <div className="row gap">
            <button className="btn gold big grow" onClick={() => { mutate((x) => startGame(x, main.c, { kind: 'ranked', tcId })); nav.play(); }}>⚔ PLAY RANKED</button>
            <button className="btn" onClick={() => setSalt((n) => n + 1)} aria-label="Find another opponent">↻</button>
          </div>
        </Card>
      )}

      {!s.active && sugg.length > 1 && (
        <div className="opp-list">
          {sugg.slice(1).map((o) => (
            <Card key={o.c.id} className="opp-mini">
              <div className="row" onClick={() => nav.open({ kind: 'competitor', id: o.c.id })}>
                <CompetitorPortrait c={o.c} day={day} size={44} />
                <div className="grow">
                  <div className="kicker">{o.label}</div>
                  <b>{o.c.name}</b>
                  <div className="muted">{RANKS[o.c.rank].name} · {o.c.rating} · +{o.stakes.win}/{o.stakes.loss}</div>
                </div>
              </div>
              <button className="btn small" onClick={() => { mutate((x) => startGame(x, o.c, { kind: o.c.id === x.player.rivalId ? 'rivalry' : 'challenge', tcId })); nav.play(); }}>Challenge</button>
            </Card>
          ))}
        </div>
      )}

      {invites.filter((i) => i.kind !== 'trial').length > 0 && (
        <Card title="Invitations">
          {invites.filter((i) => i.kind !== 'trial').map((inv) => {
            const c = inv.fromId ? s.world.competitors.find((x) => x.id === inv.fromId) : null;
            return (
              <div key={inv.id} className="invite">
                {c ? <CompetitorPortrait c={c} day={day} size={36} /> : <span className="inv-icon">📜</span>}
                <div className="grow">
                  <b>{inv.title}</b>
                  <div className="muted">{inv.detail} · {inv.stakes}</div>
                </div>
                <button className="btn small gold" onClick={() => {
                  if (inv.tournamentId) mutate((x) => acceptTournament(x, inv.tournamentId!));
                  else if (c) { mutate((x) => { startGame(x, c, { kind: inv.kind === 'rivalry' ? 'rivalry' : 'challenge', tcId }); dismissInvitation(x, inv.id); }); nav.play(); }
                }}>Accept</button>
                <button className="btn small" onClick={() => mutate((x) => dismissInvitation(x, inv.id))} aria-label="Decline">✕</button>
              </div>
            );
          })}
        </Card>
      )}

      <div className="grid2">
        {rival && (
          <Card title="Rival" onClick={() => nav.open({ kind: 'competitor', id: rival.id })}>
            <div className="row">
              <CompetitorPortrait c={rival} day={day} size={44} />
              <div className="grow"><b>{rival.name}</b><div className="muted">{rival.rating} · you <Record {...s.player.h2h[rival.id]} /></div></div>
            </div>
            {!s.active && s.player.influence >= CHALLENGE_COST && (
              <button className="btn small" onClick={(e) => { e.stopPropagation(); mutate((x) => { x.player.influence -= CHALLENGE_COST; startGame(x, rival, { kind: 'rivalry', tcId }); }); nav.play(); }}>
                Formal challenge (−{CHALLENGE_COST} Influence)
              </button>
            )}
          </Card>
        )}
        <Card title="Casual">
          <div className="muted">Unrated games — undo allowed. Untimed play for study.</div>
          <div className="row gap wrap">
            {main && <button className="btn small" disabled={!!s.active} onClick={() => { mutate((x) => startGame(x, main.c, { kind: 'casual', tcId: 'untimed', rated: false })); nav.play(); }}>Untimed vs {main.c.name.split(' ')[0]}</button>}
            {sugg[2] && <button className="btn small" disabled={!!s.active} onClick={() => { mutate((x) => startGame(x, sugg[2].c, { kind: 'casual', tcId, rated: false })); nav.play(); }}>Casual {TIME_CONTROLS.find((t) => t.id === tcId)?.label}</button>}
          </div>
        </Card>
        <Card title="Calendar">
          <div className="muted">Every game you finish moves the empire one day forward. You can also let time pass.</div>
          <div className="row gap">
            <button className="btn small" disabled={!!s.active || !!tg} onClick={() => mutate((x) => { restDays(x, 1); })}>Rest 1 day</button>
            <button className="btn small" disabled={!!s.active || !!tg} onClick={() => mutate((x) => { restDays(x, 7); })}>Rest 7 days</button>
          </div>
        </Card>
      </div>
    </div>
  );
}

export function tcFor(pool: string): string {
  return TIME_CONTROLS.find((t) => t.pool === pool)?.id ?? 'rapid-10';
}
