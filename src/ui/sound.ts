import type { Settings } from '../game/state';
import { ARENAS } from '../world/arenas';

/** Procedural WebAudio sound — no audio files to download or cache. */
let ctx: AudioContext | null = null;
function ac(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slide = 0) {
  const a = ac();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function knock(gain: number, freq = 180) {
  const a = ac();
  if (!a) return;
  const len = Math.floor(a.sampleRate * 0.06);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 6);
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq * 6;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start();
  tone(freq, 0.08, 'sine', gain * 0.4);
}

export type Sfx = 'move' | 'capture' | 'check' | 'castle' | 'select' | 'win' | 'loss' | 'draw' | 'promote' | 'fanfare' | 'start';

export function sfx(kind: Sfx, s: Settings) {
  if (!s.sound) return;
  switch (kind) {
    case 'move': return knock(0.5);
    case 'select': return tone(660, 0.05, 'sine', 0.04);
    case 'capture': knock(0.8, 140); return tone(220, 0.12, 'triangle', 0.08, 0.02, -80);
    case 'castle': knock(0.5); return knock(0.5);
    case 'check': return tone(880, 0.18, 'square', 0.05, 0, 120);
    case 'promote': [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'triangle', 0.08, i * 0.07)); return;
    case 'start': [392, 523].forEach((f, i) => tone(f, 0.25, 'triangle', 0.08, i * 0.12)); return;
    case 'win':
    case 'fanfare': [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.35, 'sawtooth', 0.045, i * 0.09)); return;
    case 'draw': [440, 440].forEach((f, i) => tone(f, 0.3, 'sine', 0.06, i * 0.2)); return;
    case 'loss': [392, 330, 262].forEach((f, i) => tone(f, 0.4, 'triangle', 0.06, i * 0.16)); return;
  }
}

let ambient: { stop: () => void } | null = null;
/** Each arena has its own slow procedural drone identity. */
export function setAmbience(on: boolean, arena: number) {
  ambient?.stop();
  ambient = null;
  if (!on) return;
  const a = ac();
  if (!a) return;
  const def = ARENAS[arena].ambience;
  const g = a.createGain();
  g.gain.value = 0.018;
  const lfo = a.createOscillator();
  const lg = a.createGain();
  lfo.frequency.value = def.tempo * 0.1;
  lg.gain.value = 0.01;
  lfo.connect(lg).connect(g.gain);
  const oscs = [1, 1.5, 2.003].map((m) => {
    const o = a.createOscillator();
    o.type = def.type;
    o.frequency.value = def.base * m;
    const f = a.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 600;
    o.connect(f).connect(g);
    o.start();
    return o;
  });
  g.connect(a.destination);
  lfo.start();
  ambient = { stop: () => { oscs.forEach((o) => o.stop()); lfo.stop(); g.disconnect(); } };
}
