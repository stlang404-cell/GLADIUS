import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadSave, persistSave } from '../persist/save';
import { requestPersistence } from '../persist/db';
import { hasSave, setSave, useVersion, getSave, mutate } from './store';
import { NavCtx, type Nav, type Overlay, type Tab } from './nav';
import { Header } from './Header';
import { TabBar } from './TabBar';
import { ArenaTab } from './tabs/ArenaTab';
import { EmpireTab, ArenaSheet, TournamentSheet, CompetitorSheet } from './tabs/EmpireTab';
import { AcademyTab } from './tabs/AcademyTab';
import { SpectateTab } from './tabs/SpectateTab';
import { LegacyTab, PassportSheet, TrophySheet } from './tabs/LegacyTab';
import { GameScreen } from './GameScreen';
import { AnalysisSheet } from './AnalysisView';
import { Onboarding } from './Onboarding';
import { CeremonyHost } from './Ceremony';
import { toasts } from './store';
import { startGame, playerArena } from '../game/career';
import { backdropUri } from './art';
import { setAmbience } from './sound';
import { getEngine } from '../engine/browserEngine';

export function App() {
  const [boot, setBoot] = useState<'loading' | 'new' | 'ready'>('loading');
  const [bootMsg, setBootMsg] = useState<string | null>(null);
  useVersion();
  useEffect(() => {
    void loadSave().then(({ save, recovered, error }) => {
      if (save) {
        setSave(save);
        setBoot('ready');
        if (recovered) setBootMsg('Your save was damaged; the newest backup was restored.');
      } else {
        if (error) setBootMsg(`Could not read save: ${error}`);
        setBoot('new');
      }
    });
    void requestPersistence();
    // Warm up the opponent engine so the first move is fast.
    setTimeout(() => void getEngine('play').whenReady(), 800);
  }, []);
  if (boot === 'loading') return <div className="splash"><div className="splash-title">GLADIUS</div></div>;
  if (boot === 'new' || !hasSave())
    return <Onboarding notice={bootMsg} onDone={(s) => { setSave(s); void persistSave(s, { backup: true }); setBoot('ready'); }} />;
  return <Shell notice={bootMsg} />;
}

function Shell({ notice }: { notice: string | null }) {
  const [tab, setTab] = useState<Tab>('arena');
  const [overlays, setOverlays] = useState<Overlay[]>([]);
  const [playing, setPlaying] = useState(() => !!getSave().active);
  const [msg, setMsg] = useState(notice);
  const s = getSave();
  const arena = playerArena(s);
  useEffect(() => setAmbience(s.settings.ambience, arena), [s.settings.ambience, arena]);
  useEffect(() => {
    const d = document.documentElement;
    d.dataset.contrast = s.settings.highContrast ? 'high' : 'normal';
    d.dataset.motion = s.settings.reduceMotion ? 'reduce' : 'full';
    d.style.setProperty('--text-scale', String(s.settings.textScale ?? 1));
  }, [s.settings.highContrast, s.settings.reduceMotion, s.settings.textScale]);
  const startVs = useCallback<Nav['startVs']>((oppId, o = {}) => {
    const c = getSave().world.competitors.find((x) => x.id === oppId);
    if (!c || getSave().active) return;
    mutate((x) => startGame(x, c, { kind: o.kind ?? 'challenge', tcId: o.tcId ?? x.settings.defaultTc, rated: o.rated, startFen: o.startFen, color: o.color }));
    setOverlays([]);
    setPlaying(true);
  }, []);
  const nav: Nav = useMemo(() => ({
    tab,
    go: (t) => { setTab(t); setOverlays([]); setPlaying(false); },
    open: (o) => setOverlays((x) => [...x, o]),
    close: () => setOverlays((x) => x.slice(0, -1)),
    play: () => { setOverlays([]); setPlaying(true); },
    startVs,
  }), [tab, startVs]);
  const top = overlays[overlays.length - 1];
  useEffect(() => {
    document.querySelector('.content')?.scrollTo({ top: 0 });
  }, [tab, playing]);
  const inGame = playing && (!!s.active);
  return (
    <NavCtx.Provider value={nav}>
      <div className={'app arena-' + arena} style={{ ['--backdrop' as string]: `url("${backdropUri(arena)}")` }}>
        <div className="app-bg" aria-hidden />
        <Header />
        <main className="content">
          {msg && <div className="notice" onClick={() => setMsg(null)}>{msg}</div>}
          {inGame || (playing && !s.active) ? (
            <GameScreen
              onExit={() => setPlaying(false)}
              onNext={() => { setPlaying(false); setTab('arena'); }}
              onAnalyse={(id) => { setPlaying(false); setTab('academy'); setOverlays([{ kind: 'analysis', gameId: id }]); }}
              onRematch={(oppId, tc) => { setPlaying(false); setTimeout(() => startVs(oppId, { kind: 'challenge', tcId: tc }), 0); }}
            />
          ) : (
            <>
              {tab === 'arena' && <ArenaTab />}
              {tab === 'empire' && <EmpireTab />}
              {tab === 'academy' && <AcademyTab />}
              {tab === 'spectate' && <SpectateTab />}
              {tab === 'legacy' && <LegacyTab />}
            </>
          )}
        </main>
        <TabBar badge={{ arena: s.world.invitations.length || undefined }} />
        {top?.kind === 'passport' && <PassportSheet onClose={nav.close} />}
        {top?.kind === 'trophy' && <TrophySheet awardId={top.awardId} onClose={nav.close} />}
        <CeremonyHost />
        <div className="toasts" aria-live="polite">{toasts.map((t) => <div key={t.id} className={'toast ' + t.kind}>{t.kind === 'achievement' ? 'Achievement · ' : ''}{t.text}</div>)}</div>
        {top?.kind === 'competitor' && <CompetitorSheet id={top.id} onClose={nav.close} />}
        {top?.kind === 'tournament' && <TournamentSheet id={top.id} onClose={nav.close} />}
        {top?.kind === 'arena' && <ArenaSheet index={top.index} onClose={nav.close} />}
        {top?.kind === 'analysis' && <AnalysisSheet gameId={top.gameId} onClose={nav.close} />}
      </div>
    </NavCtx.Provider>
  );
}
