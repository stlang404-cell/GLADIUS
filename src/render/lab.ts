// Dev-only art lab (not part of the production build).
//   ?mode=pieces  close-up piece renders     ?mode=board  scripted Board3D for animation tests
import * as THREE from 'three';
import { Chess, type Square } from 'chess.js';
import { loadPieceSet } from './pieceAssets';
import { FINISHES, pieceMaterials, studioEnvironment } from './materials';
import { Board3D, type MoveAnim } from './board3d';
import { ARENAS } from '../world/arenas';
import { parseUci } from '../chess/rules';

const params = new URLSearchParams(location.search);
const el = document.getElementById('c')!;
const W = window as unknown as Record<string, unknown>;

if (params.get('mode') === 'trophies') {
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
} else if (params.get('mode') === 'board') {
  const board = new Board3D(el, ARENAS[Number(params.get('arena') ?? 0)].palette);
  board.setTilt(Number(params.get('tilt') ?? 0.55));
  board.setMoveDuration(Number(params.get('ms') ?? 480));
  const chess = new Chess(params.get('fen') ?? undefined);
  board.setPosition(chess.fen());
  board.onReady = () => (W.__ready = true);
  W.setArena = (i: number) => { board.setPalette(ARENAS[i].palette); board.setArena(i); };
  if (params.get('env') !== null) (W.setArena as (i: number) => void)(Number(params.get('env')));
  const toAnim = (m: ReturnType<Chess['move']>): MoveAnim => {
    const a: MoveAnim = { from: m.from, to: m.to, promotion: m.promotion, captured: !!m.captured };
    if (m.isKingsideCastle()) a.castle = m.color === 'w' ? { rookFrom: 'h1', rookTo: 'f1' } : { rookFrom: 'h8', rookTo: 'f8' };
    if (m.isQueensideCastle()) a.castle = m.color === 'w' ? { rookFrom: 'a1', rookTo: 'd1' } : { rookFrom: 'a8', rookTo: 'd8' };
    if (m.isEnPassant()) a.epSquare = (m.to[0] + m.from[1]) as Square;
    return a;
  };
  /** Deterministic sampling of one move's animation (virtual clock). */
  W.sample = (uci: string, step = 16, extraSquares: string[] = []) => {
    const m = chess.move(parseUci(uci));
    const a = toAnim(m);
    const times: number[] = [];
    for (let t = 0; t <= 3000; t += step) times.push(t);
    const sq = [m.to, ...(a.castle ? [a.castle.rookTo] : []), ...extraSquares] as Square[];
    const res = board.sampleTimeline(() => board.setPosition(chess.fen(), a, chess.isCheckmate()), times, sq);
    return { san: m.san, to: m.to, rookTo: a.castle?.rookTo ?? null, res };
  };
  W.play = (uci: string) => {
    const m = chess.move(parseUci(uci));
    const a: MoveAnim = { from: m.from, to: m.to, promotion: m.promotion, captured: !!m.captured };
    if (m.isKingsideCastle()) a.castle = m.color === 'w' ? { rookFrom: 'h1', rookTo: 'f1' } : { rookFrom: 'h8', rookTo: 'f8' };
    if (m.isQueensideCastle()) a.castle = m.color === 'w' ? { rookFrom: 'a1', rookTo: 'd1' } : { rookFrom: 'a8', rookTo: 'd8' };
    if (m.isEnPassant()) a.epSquare = (m.to[0] + m.from[1]) as Square;
    board.setPosition(chess.fen(), a, chess.isCheckmate());
    board.setHighlights({ selected: null, targets: [], captures: [], lastMove: [m.from, m.to], check: null });
    return m.san;
  };
  W.board = board;
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
