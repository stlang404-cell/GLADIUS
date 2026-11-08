import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';
import { registerSW } from 'virtual:pwa-register';
import { queueCeremonies } from './ui/Ceremony';
import { getEngine, activeEngineInfo } from './engine/browserEngine';

registerSW({ immediate: true });
createRoot(document.getElementById('root')!).render(<App />);

// Test hook (only with ?debug): lets the visual harness present ceremonies without playing a full career.
if (new URLSearchParams(location.search).has('debug')) (window as unknown as Record<string, unknown>).__gladiusCeremony = queueCeremonies;
// Test hook (only with ?debug): engine access for the deployment harness (which build runs, offline search).
if (new URLSearchParams(location.search).has('debug')) (window as unknown as Record<string, unknown>).__gladiusEngine = { getEngine, activeEngineInfo };
