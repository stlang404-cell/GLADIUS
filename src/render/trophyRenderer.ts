import * as THREE from 'three';
import { loadPieceSet } from './pieceAssets';
import { studioEnvironment } from './materials';
import { trophyLook, type TrophyLook } from './trophySculpt';

/**
 * One shared offscreen renderer turns baked trophy models into portrait
 * images (data URLs), cached in memory. WebGL contexts are scarce, so the
 * whole Hall of Honors uses this single context.
 */
const METALS: Record<TrophyLook['metal'], { color: string; roughness: number; metalness: number }> = {
  bronze: { color: '#c0773a', roughness: 0.33, metalness: 1 },
  silver: { color: '#d8dde2', roughness: 0.22, metalness: 1 },
  gold: { color: '#e6b24a', roughness: 0.2, metalness: 1 },
  iron: { color: '#8a9098', roughness: 0.38, metalness: 1 },
  wood: { color: '#9a6334', roughness: 0.6, metalness: 0 },
  imperial: { color: '#f0c25a', roughness: 0.16, metalness: 1 },
};

let renderer: THREE.WebGLRenderer | null = null;
let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
let queue: Promise<unknown> = Promise.resolve();

function setup(size: number) {
  if (renderer) {
    renderer.setSize(size, size, false);
    return;
  }
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  scene = new THREE.Scene();
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 0.9;
  const key = new THREE.DirectionalLight(0xfff0d8, 2.2);
  key.position.set(-2, 4, 3);
  key.castShadow = true;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd6ff, 1.2);
  rim.position.set(2.5, 2, -2.5);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xfff6e6, 0x403020, 0.4));
  camera = new THREE.PerspectiveCamera(26, 1, 0.1, 20);
  camera.position.set(0.55, 0.85, 2.35);
  camera.lookAt(0, 0.5, 0);
}

export function renderTrophy(defId: string, opts: { arena?: number; arenaTier?: number; size?: number; locked?: boolean } = {}): Promise<string> {
  const size = opts.size ?? 256;
  const key = `${defId}|${opts.arena}|${opts.arenaTier}|${size}|${opts.locked ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const p0 = pending.get(key);
  if (p0) return p0;
  const p = (queue = queue.then(async () => {
    const models = await loadPieceSet('trophies');
    setup(size);
    const look = trophyLook(defId, opts.arena, opts.arenaTier);
    const g = models[look.model] ?? models.cup;
    const m = METALS[look.metal];
    const metal = new THREE.MeshPhysicalMaterial({ color: opts.locked ? '#9a8f80' : m.color, roughness: m.roughness, metalness: opts.locked ? 0.2 : m.metalness, clearcoat: 0.4 });
    const accent = new THREE.MeshPhysicalMaterial({ color: opts.locked ? '#7a7066' : look.accent, roughness: 0.35, clearcoat: 0.6, metalness: 0.05 });
    const grp = new THREE.Group();
    const body = new THREE.Mesh(g.body, metal);
    body.castShadow = true;
    grp.add(body);
    if (g.accent) grp.add(new THREE.Mesh(g.accent, accent));
    grp.rotation.y = -0.35;
    scene!.add(grp);
    let glow: THREE.Mesh | null = null;
    if (look.glow && !opts.locked) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d')!;
      const gr = x.createRadialGradient(64, 64, 4, 64, 64, 64);
      gr.addColorStop(0, 'rgba(255,220,120,0.9)');
      gr.addColorStop(1, 'rgba(255,200,80,0)');
      x.fillStyle = gr;
      x.fillRect(0, 0, 128, 128);
      glow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
      glow.position.set(0, 0.55, -0.4);
      glow.lookAt(camera!.position);
      scene!.add(glow);
    }
    renderer!.render(scene!, camera!);
    const url = renderer!.domElement.toDataURL('image/png');
    scene!.remove(grp);
    if (glow) scene!.remove(glow);
    metal.dispose();
    accent.dispose();
    cache.set(key, url);
    pending.delete(key);
    return url;
  })) as Promise<string>;
  pending.set(key, p);
  return p;
}
