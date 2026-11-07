// Dev-only art lab (not part of the production build).
//   ?mode=pieces  close-up piece renders     ?mode=board  scripted Board3D for animation tests
import * as THREE from 'three';
import { loadPieceSet } from './pieceAssets';
import { FINISHES, pieceMaterials, studioEnvironment } from './materials';

const params = new URLSearchParams(location.search);
const el = document.getElementById('c')!;
const W = window as unknown as Record<string, unknown>;

if (params.get('mode') === 'boards') {
  void import('./boardLab').then((m) => {
    m.mountBoardLab(el, params);
    setTimeout(() => (W.__ready = true), 1500);
  });
} else if (params.get('mode') === 'none') {
  W.__ready = true;
} else if (params.get('mode') === 'sprites') {
  // Bake 2D sprites: one transparent render per piece per finish.
  void (async () => {
    const SIZE = Number(params.get('size') ?? 320);
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setPixelRatio(1);
    r.setSize(SIZE, SIZE);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    const scene = new THREE.Scene();
    scene.environment = studioEnvironment(r);
    scene.environmentIntensity = 0.75;
    const key = new THREE.DirectionalLight(0xfff2de, 2.6);
    key.position.set(-2.5, 4, 3.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xd6e6ff, 1.4);
    rim.position.set(3, 2.5, -3);
    scene.add(rim);
    const fill = new THREE.DirectionalLight(0xfff0e0, 0.6);
    fill.position.set(2, 1, 4);
    scene.add(fill);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x705040, 0.45));
    const cam = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.1, 20);
    const elev = (16 * Math.PI) / 180;
    cam.position.set(0, 0.5 + Math.sin(elev) * 6, Math.cos(elev) * 6);
    cam.lookAt(0, 0.5, 0);
    const set = await loadPieceSet();
    const out: Record<string, string> = {};
    for (const fid of (params.get('finishes') ?? 'classical,imperial,marble').split(',')) {
      const m = pieceMaterials(FINISHES[fid]);
      for (const color of ['w', 'b'] as const) {
        for (const t of ['p', 'n', 'b', 'r', 'q', 'k']) {
          const g = set[t];
          const grp = new THREE.Group();
          grp.add(new THREE.Mesh(g.body, color === 'w' ? m.w : m.b));
          if (g.accent) grp.add(new THREE.Mesh(g.accent, color === 'w' ? m.metalW : m.metalB));
          // Common scale: king fills ~92% height; pawn enlarged for readability.
          const s = (t === 'p' ? 1.16 : t === 'n' ? 1.02 : 1) * 0.76;
          grp.scale.setScalar(s);
          if (t === 'n') grp.rotation.y = Math.PI - 0.45; // knights face left, turned slightly to the viewer
          grp.position.y = 0.035;
          scene.add(grp);
          r.render(scene, cam);
          out[`${fid}/${color}${t}`] = r.domElement.toDataURL('image/webp', 0.93);
          scene.remove(grp);
        }
      }
    }
    W.__sprites = out;
    W.__ready = true;
  })();
} else if (params.get('mode') === 'trophy-sprites') {
  void (async () => {
    const { renderTrophy } = await import('./trophyRenderer');
    const { TROPHY_DEFS } = await import('../world/trophies');
    const out: Record<string, string> = {};
    // ?ids=sig-a1,sig-a3 bakes only those sprites (e.g. new art without touching existing files)
    const only = params.get('ids');
    const defs = only ? only.split(',').map((id) => ({ id, arena: undefined as number | undefined, arenaTier: undefined as number | undefined })) : TROPHY_DEFS;
    for (const d of defs) {
      const png = await renderTrophy(d.id, { size: 256, arena: d.arena, arenaTier: d.arenaTier });
      // re-encode as WebP via canvas
      const img = new Image();
      img.src = png;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      c.getContext('2d')!.drawImage(img, 0, 0);
      out[d.id] = c.toDataURL('image/webp', 0.9);
    }
    W.__sprites = out;
    W.__ready = true;
  })();
} else if (params.get('mode') === 'trophies') {
  void (async () => {
    const { renderTrophy } = await import('./trophyRenderer');
    el.style.cssText = 'display:grid;grid-template-columns:repeat(6,1fr);gap:8px;padding:12px;background:#f3e7cf;height:auto';
    const ids = (params.get('ids') ?? 'sig-0,sig-1,sig-2,sig-3,sig-4,sig-5,sig-6,sig-7,sig-8,sig-9,sig-10,sig-11,cup-open-t0,cup-gauntlet-t1,league-t2,invit-t3,medal-t1,defense-t2,laurel-t3,imperial-crown,dist-iron-champion,hist-dynasty,hosted-t0,cup-cup-t2').split(',');
    for (const id of ids) {
      const img = document.createElement('img');
      img.src = await renderTrophy(id, { size: 256 });
      img.style.width = '100%';
      img.title = id;
      el.appendChild(img);
    }
    W.__ready = true;
  })();
} else {
  const r = new THREE.WebGLRenderer({ antialias: true });
  r.setPixelRatio(window.devicePixelRatio);
  r.setSize(el.clientWidth, el.clientHeight);
  r.shadowMap.enabled = true;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(r.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(params.get('bg') ?? '#cdb48c');
  scene.environment = studioEnvironment(r);
  scene.environmentIntensity = 0.55;
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4);
  key.position.set(-3, 6, 4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 });
  key.shadow.bias = -0.0005;
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xfff6e6, 0x6a4a30, 0.5));
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: params.get('ground') ?? '#b98a5c', roughness: 0.8 }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  const cam = new THREE.PerspectiveCamera(Number(params.get('fov') ?? 28), el.clientWidth / el.clientHeight, 0.1, 50);
  const elev = (Number(params.get('elev') ?? 20) * Math.PI) / 180;
  const dist = Number(params.get('dist') ?? 8.5);
  cam.position.set(0, Math.sin(elev) * dist + 0.5, Math.cos(elev) * dist);
  cam.lookAt(0, 0.5, 0);
  const order = (params.get('only') ?? 'pnbrqk').split('');
  void loadPieceSet().then((set) => {
    const m = pieceMaterials(FINISHES[params.get('finish') ?? 'legio'] ?? FINISHES.legio);
    for (const [row, color] of [[0, 'w'], [1, 'b']] as const) {
      order.forEach((t, i) => {
        const g = set[t];
        const grp = new THREE.Group();
        const body = new THREE.Mesh(g.body, color === 'w' ? m.w : m.b);
        body.castShadow = body.receiveShadow = true;
        grp.add(body);
        if (g.accent) {
          const a = new THREE.Mesh(g.accent, color === 'w' ? m.metalW : m.metalB);
          a.castShadow = true;
          grp.add(a);
        }
        grp.position.set((i - (order.length - 1) / 2) * 0.95, 0, row === 0 ? 0.6 : -0.6);
        if (t === 'n') grp.rotation.y = color === 'w' ? 0.5 : Math.PI + 0.5;
        grp.rotation.y += Number(params.get('spin') ?? 0);
        scene.add(grp);
      });
    }
    r.render(scene, cam);
    W.__ready = true;
  });
}
