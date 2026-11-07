import { useState } from 'react';
import type { Save, WorldState } from '../game/state';
import { newSave } from '../game/career';
import { Portrait } from './components/common';
import { mixSeed } from '../core/rng';
import { backdropUri } from './art';
import { importAll } from '../persist/save';

const LEVELS = [
  { r: 600, label: 'New to chess' },
  { r: 900, label: 'Casual player' },
  { r: 1200, label: 'Club player' },
  { r: 1500, label: 'Strong club' },
  { r: 1800, label: 'Expert' },
];

export function Onboarding({ onDone, notice }: { onDone: (s: Save) => void; notice: string | null }) {
  const [name, setName] = useState('');
  const [female, setFemale] = useState(false);
  const [level, setLevel] = useState(1);
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(notice);
  const seed = mixSeed(name || 'anon', 7);
  const found = () => {
    const nm = name.trim() || 'Marcus Novus';
    setProgress(0);
    const worldSeed = (Math.random() * 2 ** 32) >>> 0;
    const w = new Worker(new URL('../world/world.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ progress?: number; world?: WorldState }>) => {
      if (e.data.progress !== undefined) setProgress(e.data.progress);
      if (e.data.world) {
        w.terminate();
        const s = newSave(e.data.world, nm, female, LEVELS[level].r);
        s.player.portraitSeed = seed;
        onDone(s);
      }
    };
    w.onerror = (e) => setErr('World creation failed: ' + e.message);
    w.postMessage({ seed: worldSeed });
  };
  return (
    <div className="onboard" style={{ backgroundImage: `url("${backdropUri(0)}")` }}>
      <div className="onboard-card">
        <img className="logo" src={new URL('brand/logo-horizontal-tagline.svg', document.baseURI).href} alt="GLADIUS — The Eternal Chess Empire" />
        {progress === null ? (
          <>
            <div className="center"><Portrait seed={seed} female={female} age={22} arena={0} size={96} ring="#e8b04b" /></div>
            <input className="name-in" value={name} maxLength={28} placeholder="Your name" onChange={(e) => setName(e.target.value)} aria-label="Your name" />
            <div className="chips center">
              <button className={'chip' + (!female ? ' on' : '')} onClick={() => setFemale(false)}>Portrait A</button>
              <button className={'chip' + (female ? ' on' : '')} onClick={() => setFemale(true)}>Portrait B</button>
            </div>
            <div className="muted small center">Your chess experience (sets your provisional rating — your first 20 games place you accurately):</div>
            <div className="chips center wrap">
              {LEVELS.map((l, i) => <button key={l.r} className={'chip' + (level === i ? ' on' : '')} onClick={() => setLevel(i)}>{l.label}</button>)}
            </div>
            <button className="btn gold big" onClick={found}>ENTER THE DUST PITS</button>
            <label className="btn small">Restore a backup<input type="file" accept=".json" hidden onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void f.text().then(importAll).then(onDone).catch((x) => setErr((x as Error).message));
            }} /></label>
          </>
        ) : (
          <>
            <div className="muted center">Five thousand competitors are living through eight seasons of history…</div>
            <div className="meter"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>
          </>
        )}
        {err && <div className="error">{err}</div>}
      </div>
    </div>
  );
}
