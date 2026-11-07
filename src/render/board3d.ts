import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Chess, type Square } from 'chess.js';
import { pieceGeometries } from './pieces3d';
import { loadPieceSet, type PieceGeoms } from './pieceAssets';
import { FINISHES, pieceMaterials, studioEnvironment, type PieceFinish } from './materials';
import { squaresTexture, frameTexture, glowTexture, type BoardTheme } from './boardTextures';
import { Timeline, ease } from './animation';
import { ARENAS, type Palette } from '../world/arenas';
import { buildArenaEnvironment, arenaKeyLight, type ArenaEnv } from './arenaScene';

export type MoveAnim = { from: Square; to: Square; promotion?: string; captured?: boolean; castle?: { rookFrom: Square; rookTo: Square }; epSquare?: Square };
export type Highlights = {
  selected: Square | null; targets: Square[]; captures: Square[]; lastMove: [Square, Square] | null; check: Square | null;
  hint?: [Square, Square] | null; cursor?: Square | null;
};

type PieceObj = { group: THREE.Group; type: string; color: 'w' | 'b'; square: Square; mats: THREE.Material[] };

const FILES = 'abcdefgh';
const FRAME = 0.62; // frame width in squares
export function sqToXZ(sq: Square): [number, number] {
  return [FILES.indexOf(sq[0]) - 3.5, 3.5 - (Number(sq[1]) - 1)];
}

function mixHex(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = (sh: number) => Math.round(((pa >> sh) & 255) * (1 - t) + ((pb >> sh) & 255) * t);
  return '#' + [16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, '0')).join('');
}

/** Board theme for the 2.5D board: squares are pushed apart in value so ivory and ebony pieces read on both. */
export function themeFromPalette(p: Palette): BoardTheme {
  return { light: mixHex(p.light, '#b89870', 0.22), dark: mixHex(p.dark, '#2a1408', 0.28), frame: p.frame, trim: '#d8a944', ink: '#f1d27a' };
}

/**
 * The 2.5D board: owns rendering and animation only. It displays the FEN it is
 * given, animates the move it is told about, and reports square taps.
 * Renders on demand. The authoritative game state lives elsewhere.
 */
export class Board3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private pieces = new Map<Square, PieceObj>();
  private ghosts = new Set<PieceObj>(); // captured pieces still animating out
  private hl = new THREE.Group();
  private boardGroup = new THREE.Group();
  private clockOverride: number | null = null;
  private tl = new Timeline(() => this.clockOverride ?? performance.now());
  private raf = 0;
  private dirty = true;
  private ro: ResizeObserver;
  private fen = '';
  private orientation: 'w' | 'b' = 'w';
  private tilt = 0.55;
  private azimuth = 0;
  private cam = { elev: 0, az: 0, dist: 0 };
  private camTarget = { elev: 0, az: 0, dist: 0 };
  private palette: Palette;
  private finish: PieceFinish = FINISHES.legio;
  private mats: ReturnType<typeof pieceMaterials>;
  private geoms: PieceGeoms | null = null;
  private pulse: THREE.Mesh | null = null;
  private selectedSq: Square | null = null;
  private showCoords = true;
  private quality: 'high' | 'low';
  private boardPlane!: THREE.Mesh;
  private env: ArenaEnv | null = null;
  private envIndex = -1;
  private keyLight!: THREE.DirectionalLight;
  private framing = 0.97;
  moveMs = 480;
  renders = 0;
  onSquare: (sq: Square) => void = () => {};
  onReady: () => void = () => {};

  constructor(private el: HTMLElement, palette: Palette, opts: { quality?: 'high' | 'low'; finish?: string } = {}) {
    this.palette = palette;
    if (opts.finish && FINISHES[opts.finish]) this.finish = FINISHES[opts.finish];
    this.quality = opts.quality ?? (/iPhone|iPad|Android/.test(navigator.userAgent) ? 'low' : 'high');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.domElement.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.warn('GLADIUS: WebGL context lost'); });
    this.renderer.domElement.addEventListener('webglcontextrestored', () => { this.dirty = true; });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality === 'high' ? 2 : 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    el.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
    this.scene.environment = studioEnvironment(this.renderer);
    this.scene.environmentIntensity = 0.5;
    this.mats = pieceMaterials(this.finish);
    this.buildLights();
    this.scene.add(this.boardGroup);
    this.buildBoard();
    this.scene.add(this.hl);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.resize();
    this.cam = { ...this.camTarget };
    this.renderer.domElement.addEventListener('pointerdown', this.onPointer);
    void loadPieceSet('legio')
      .then((g) => {
        this.geoms = g;
        const fen = this.fen;
        this.clearPieces();
        this.fen = '';
        if (fen) this.setPosition(fen);
        this.onReady();
      })
      .catch((e) => console.warn('Sculpted set unavailable, using fallback pieces', e));
    (window as unknown as { __gladiusBoard?: Board3D }).__gladiusBoard = this;
    this.loop();
  }

  private buildLights() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xfff3df, 0x5a3a28, 0.55));
    const key = new THREE.DirectionalLight(0xfff0da, 2.3);
    this.keyLight = key;
    key.position.set(-4.5, 10, 6);
    key.castShadow = true;
    const sm = this.quality === 'high' ? 2048 : 1536;
    key.shadow.mapSize.set(sm, sm);
    Object.assign(key.shadow.camera, { left: -6.5, right: 6.5, top: 6.5, bottom: -6.5, near: 1, far: 30 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    s.add(key);
    const rim = new THREE.DirectionalLight(0xc8dcff, 0.7);
    rim.position.set(6, 5, -7);
    s.add(rim);
  }

  private buildBoard() {
    const g = this.boardGroup;
    g.clear();
    const theme = themeFromPalette(this.palette);
    const size = 8 + FRAME * 2;
    const flipped = this.orientation === 'b';
    // Upper slab with the painted frame on top.
    const slabMat = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(this.palette.frame).multiplyScalar(0.9), roughness: 0.5, clearcoat: 0.4 });
    const topMat = new THREE.MeshPhysicalMaterial({ map: frameTexture(theme, this.showCoords, flipped, FRAME / size), roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.3, envMapIntensity: 0.4 });
    const slab = new THREE.Mesh(new RoundedBoxGeometry(size, 0.34, size, 4, 0.09), slabMat);
    slab.position.y = -0.17;
    slab.receiveShadow = true;
    slab.castShadow = true;
    g.add(slab);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(size - 0.12, size - 0.12), topMat);
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.0015;
    if (flipped) top.rotation.z = Math.PI;
    top.receiveShadow = true;
    g.add(top);
    // Playing surface.
    const sqMat = new THREE.MeshPhysicalMaterial({ map: squaresTexture(theme), roughness: 0.4, clearcoat: 0.45, clearcoatRoughness: 0.25, envMapIntensity: 0.35 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), sqMat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = 0.004;
    plane.receiveShadow = true;
    this.boardPlane = plane;
    g.add(plane);
    // Gold trim and lower plinth.
    const gold = new THREE.MeshPhysicalMaterial({ color: '#d8a944', metalness: 1, roughness: 0.25 });
    const trim = new THREE.Mesh(new RoundedBoxGeometry(size + 0.16, 0.08, size + 0.16, 3, 0.04), gold);
    trim.position.y = -0.38;
    g.add(trim);
    const plinth = new THREE.Mesh(new RoundedBoxGeometry(size + 0.5, 0.36, size + 0.5, 4, 0.12), new THREE.MeshPhysicalMaterial({ color: new THREE.Color(this.palette.frame).multiplyScalar(0.6), roughness: 0.55, clearcoat: 0.3 }));
    plinth.position.y = -0.6;
    plinth.receiveShadow = true;
    g.add(plinth);
    // Contact shadow under the whole board.
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(size * 1.5, size * 1.5), new THREE.MeshBasicMaterial({ map: glowTexture('soft'), color: 0x000000, transparent: true, opacity: 0.45, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -0.79;
    g.add(shadow);
  }

  /** Surround the board with an arena environment (null = none, transparent background). */
  setArena(index: number | null) {
    if (index === this.envIndex) return;
    if (this.env) {
      this.scene.remove(this.env.group);
      for (const l of this.env.lights) this.scene.remove(l);
      this.env.dispose();
      this.env = null;
    }
    this.envIndex = index ?? -1;
    if (index === null || index < 0) {
      this.scene.background = null;
      this.scene.fog = null;
      this.framing = 0.97;
      this.updateCamera(true);
      return;
    }
    const env = buildArenaEnvironment(index, () => (this.dirty = true));
    this.env = env;
    this.scene.add(env.group);
    for (const l of env.lights) this.scene.add(l);
    this.scene.background = env.background;
    this.scene.fog = env.fog;
    this.renderer.toneMappingExposure = env.exposure;
    const k = arenaKeyLight(index);
    this.keyLight.intensity = k.intensity;
    this.keyLight.color.set(k.color);
    this.framing = 0.86;
    this.fitBackground();
    this.updateCamera(true);
    void ARENAS;
  }

  /** CSS-like "cover" for the backdrop texture. */
  private fitBackground() {
    const t = this.scene.background as THREE.Texture | null;
    if (!t || !(t as THREE.Texture).isTexture) return;
    const imgAspect = 16 / 9;
    const a = this.camera.aspect || 1;
    if (a < imgAspect) {
      t.repeat.set(a / imgAspect, 1);
      t.offset.set((1 - a / imgAspect) / 2, 0);
    } else {
      t.repeat.set(1, imgAspect / a);
      t.offset.set(0, (1 - imgAspect / a) / 2);
    }
  }

  setPalette(p: Palette) {
    this.palette = p;
    this.buildBoard();
    this.dirty = true;
  }

  setFinish(id: string) {
    if (!FINISHES[id] || FINISHES[id] === this.finish) return;
    this.finish = FINISHES[id];
    this.mats = pieceMaterials(this.finish);
    const fen = this.fen;
    this.clearPieces();
    this.fen = '';
    if (fen) this.setPosition(fen);
  }

  setCoords(show: boolean) {
    if (show === this.showCoords) return;
    this.showCoords = show;
    this.buildBoard();
    this.dirty = true;
  }

  setOrientation(o: 'w' | 'b', snap = false) {
    if (o === this.orientation && !snap) return;
    this.orientation = o;
    this.buildBoard();
    this.updateCamera(snap);
  }
  setTilt(t: number) {
    this.tilt = t;
    this.updateCamera();
  }
  setAzimuth(a: number) {
    this.azimuth = a;
    this.updateCamera();
  }
  setMoveDuration(ms: number) {
    this.moveMs = ms;
  }

  private updateCamera(snap = false) {
    const scenic = this.env !== null;
    // Scenic framing: lower camera, board in the lower ~70% of the frame, arena rising behind.
    const elev = (scenic ? THREE.MathUtils.lerp(50, 26, this.tilt) : THREE.MathUtils.lerp(82, 40, this.tilt)) * (Math.PI / 180);
    const az = this.azimuth + (this.orientation === 'w' ? 0 : Math.PI);
    const half = 4 + FRAME + 0.25;
    const corners = [-half, half].flatMap((x) => [-half, half].flatMap((z) => [new THREE.Vector3(x, 0.05, z), new THREE.Vector3(x, -0.78, z)]));
    corners.push(new THREE.Vector3(0, 1.25, -3.5), new THREE.Vector3(0, 1.25, 3.5));
    const top = scenic ? (this.camera.aspect < 0.9 ? 0.6 : 0.5) : this.framing;
    let lo = 4, hi = 80;
    for (let i = 0; i < 26; i++) {
      const mid = (lo + hi) / 2;
      this.placeCamera(elev, az, mid);
      const fits = corners.every((c) => {
        const v = c.clone().project(this.camera);
        return Math.abs(v.x) <= 0.95 && v.y >= -0.96 && v.y <= top && v.z < 1;
      });
      if (fits) hi = mid;
      else lo = mid;
    }
    this.camTarget = { elev, az, dist: hi };
    if (snap) this.cam = { ...this.camTarget };
    this.placeCamera(this.cam.elev, this.cam.az, this.cam.dist);
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.near = hi + 4;
      this.scene.fog.far = hi + 42;
    }
    this.dirty = true;
  }

  private placeCamera(elev: number, az: number, dist: number) {
    const scenic = this.env !== null;
    // Scenic: aim beyond the far edge so the board sits low and the arena fills the top.
    const aimFwd = scenic ? 3.2 : 0.3 * this.tilt;
    const aimY = scenic ? 2.2 : -0.2;
    const lookX = -Math.sin(az) * aimFwd * (scenic ? 1 : -1);
    const lookZ = -Math.cos(az) * aimFwd * (scenic ? 1 : -1);
    this.camera.position.set(Math.sin(az) * Math.cos(elev) * dist, Math.sin(elev) * dist, Math.cos(az) * Math.cos(elev) * dist);
    this.camera.lookAt(lookX, aimY, lookZ);
    this.camera.updateMatrixWorld(true);
  }

  private applyCamera() {
    this.placeCamera(this.cam.elev, this.cam.az, this.cam.dist);
  }

  resize() {
    const w = this.el.clientWidth || 300;
    const h = this.el.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.fitBackground();
    this.updateCamera(this.cam.dist === 0);
  }

  private onPointer = (e: PointerEvent) => {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const meshes: THREE.Object3D[] = [];
    for (const p of this.pieces.values()) meshes.push(p.group);
    const hitPiece = ray.intersectObjects(meshes, true)[0];
    if (hitPiece) {
      let o: THREE.Object3D | null = hitPiece.object;
      while (o && !o.userData.square) o = o.parent;
      if (o?.userData.square) return this.onSquare(o.userData.square as Square);
    }
    const hit = ray.intersectObject(this.boardPlane, false)[0];
    if (hit) {
      const f = Math.floor(hit.point.x + 4);
      const rr = Math.floor(4 - hit.point.z);
      if (f >= 0 && f < 8 && rr >= 0 && rr < 8) this.onSquare((FILES[f] + (rr + 1)) as Square);
    }
  };

  private makePiece(type: string, color: 'w' | 'b', sq: Square): PieceObj {
    const group = new THREE.Group();
    const mats: THREE.Material[] = [];
    const g = this.geoms?.[type];
    if (g) {
      const body = new THREE.Mesh(g.body, color === 'w' ? this.mats.w : this.mats.b);
      body.castShadow = body.receiveShadow = true;
      group.add(body);
      mats.push(body.material as THREE.Material);
      if (g.accent) {
        const a = new THREE.Mesh(g.accent, color === 'w' ? this.mats.metalW : this.mats.metalB);
        a.castShadow = true;
        group.add(a);
      }
    } else {
      const m = new THREE.Mesh(pieceGeometries()[type], color === 'w' ? this.mats.w : this.mats.b);
      m.castShadow = true;
      group.add(m);
    }
    const [x, z] = sqToXZ(sq);
    group.position.set(x, 0, z);
    group.scale.setScalar(0.94);
    // Knights show their sculpted profile, turned slightly toward the opponent.
    if (type === 'n') group.rotation.y = color === 'w' ? 0.55 : Math.PI + 0.55;
    group.userData.square = sq;
    group.userData.baseRotY = group.rotation.y;
    this.scene.add(group);
    return { group, type, color, square: sq, mats };
  }

  private clearPieces() {
    this.tl.skip();
    for (const p of this.pieces.values()) this.scene.remove(p.group);
    for (const p of this.ghosts) this.scene.remove(p.group);
    this.pieces.clear();
    this.ghosts.clear();
  }

  /** Display `fen`. If `anim` describes the move that produced it, animate that move. */
  setPosition(fen: string, anim?: MoveAnim | null, mate = false) {
    this.tl.begin(); // completes any previous animation first
    const D = this.moveMs;
    const target = new Chess(fen);
    let moverLanding = 0;
    if (anim && this.fen && D > 0) {
      const mover = this.pieces.get(anim.from);
      if (mover) {
        const capSq = anim.epSquare ?? anim.to;
        const victim = this.pieces.get(capSq);
        this.pieces.delete(anim.from);
        if (victim && victim !== mover) this.pieces.delete(capSq);
        this.pieces.set(anim.to, mover);
        moverLanding = this.animateMove(mover, anim, victim && victim !== mover ? victim : null);
        if (anim.castle) {
          const rook = this.pieces.get(anim.castle.rookFrom);
          if (rook) {
            this.pieces.delete(anim.castle.rookFrom);
            this.pieces.set(anim.castle.rookTo, rook);
            this.glide(rook, anim.castle.rookFrom, anim.castle.rookTo, D * 0.3, D * 0.9, 0.38);
            moverLanding = Math.max(moverLanding, D * 1.2);
          }
        }
        if (anim.promotion) this.animatePromotion(anim.to, anim.promotion, mover.color, moverLanding);
      }
    }
    // Reconcile with the authoritative position (handles jumps, undo, loads).
    const want = new Map<Square, { type: string; color: 'w' | 'b' }>();
    for (const row of target.board()) for (const p of row) if (p) want.set(p.square, { type: p.type, color: p.color });
    for (const [sq, obj] of [...this.pieces]) {
      const w = want.get(sq);
      const promoting = anim?.promotion && sq === anim.to;
      if (!w || w.color !== obj.color || (w.type !== obj.type && !promoting)) {
        this.scene.remove(obj.group);
        this.pieces.delete(sq);
      }
    }
    for (const [sq, w] of want) if (!this.pieces.has(sq)) this.pieces.set(sq, this.makePiece(w.type, w.color, sq));
    for (const [sq, obj] of this.pieces) {
      obj.square = sq;
      obj.group.userData.square = sq;
    }
    if (!anim || D === 0) {
      for (const [sq, obj] of this.pieces) {
        const [x, z] = sqToXZ(sq);
        obj.group.position.set(x, 0, z);
        obj.group.rotation.set(0, obj.group.userData.baseRotY ?? 0, 0);
      }
    }
    this.fen = fen;
    if (mate) this.topple(target.turn(), moverLanding + D * 0.4);
    this.dirty = true;
  }

  /** Returns the time at which the mover has landed. */
  private animateMove(mover: PieceObj, a: MoveAnim, victim: PieceObj | null): number {
    const D = this.moveMs;
    const [x0, z0] = sqToXZ(a.from);
    const [x1, z1] = sqToXZ(a.to);
    const dist = Math.hypot(x1 - x0, z1 - z0);
    const travel = D * (0.8 + 0.2 * Math.min(dist, 5) / 5);
    const knight = mover.type === 'n';
    const lift = knight ? 0.55 : 0.07;
    if (!victim) {
      this.glide(mover, a.from, a.to, 0, travel, lift);
      return travel;
    }
    // Capture: approach → contact → victim falls → attacker settles.
    const dx = (x1 - x0) / (dist || 1), dz = (z1 - z0) / (dist || 1);
    const stop = Math.max(0, dist - 0.4);
    const px = x0 + dx * stop, pz = z0 + dz * stop;
    const tApproach = travel * 0.72;
    const g = mover.group;
    const baseRot = g.userData.baseRotY ?? 0;
    this.tl.add(0, tApproach, (k) => {
      const e = ease.inOutCubic(k);
      g.position.set(x0 + (px - x0) * e, Math.sin(Math.PI * e) * lift, z0 + (pz - z0) * e);
      g.rotation.set(Math.sin(Math.PI * e) * 0.07 * -dz, baseRot, Math.sin(Math.PI * e) * 0.07 * dx);
    });
    const [vx, vz] = sqToXZ(victim.square);
    const vg = victim.group;
    this.ghosts.add(victim);
    const fade = victim.mats.map((m) => {
      const c = (m as THREE.MeshPhysicalMaterial).clone();
      c.transparent = true;
      return c;
    });
    let swapped = false;
    const vRot = vg.userData.baseRotY ?? 0;
    this.tl.add(tApproach - D * 0.04, D * 0.62, (k) => {
      if (!swapped) {
        let i = 0;
        vg.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (mesh.isMesh && i < fade.length && victim.mats.includes(mesh.material as THREE.Material)) mesh.material = fade[i++];
        });
        swapped = true;
      }
      const e = ease.outCubic(k);
      vg.position.set(vx + dx * 0.32 * e, -0.08 * e + Math.sin(Math.PI * Math.min(1, k * 2)) * 0.05, vz + dz * 0.32 * e);
      vg.rotation.set(e * 1.25 * dz, vRot, -e * 1.25 * dx);
      const o = 1 - ease.inCubic(Math.max(0, (k - 0.35) / 0.65));
      for (const m of fade) m.opacity = o;
      vg.traverse((ob) => {
        const mesh = ob as THREE.Mesh;
        if (mesh.isMesh && !fade.includes(mesh.material as THREE.MeshPhysicalMaterial)) {
          const mm = mesh.material as THREE.MeshPhysicalMaterial;
          if (!mm.userData.faded) {
            const c = mm.clone();
            c.transparent = true;
            c.userData.faded = true;
            mesh.material = c;
          }
          (mesh.material as THREE.MeshPhysicalMaterial).opacity = o;
        }
      });
    }, () => {
      this.scene.remove(vg);
      this.ghosts.delete(victim);
    });
    const tSettle = tApproach + D * 0.08;
    const settleDur = travel * 0.38;
    this.tl.add(tSettle, settleDur, (k) => {
      const e = ease.outCubic(k);
      g.position.set(px + (x1 - px) * e, 0, pz + (z1 - pz) * e);
      g.rotation.set(0, baseRot, 0);
    });
    this.landing(g, tSettle + settleDur);
    return tSettle + settleDur;
  }

  private glide(p: PieceObj, from: Square, to: Square, start: number, dur: number, lift: number) {
    const [x0, z0] = sqToXZ(from);
    const [x1, z1] = sqToXZ(to);
    const dist = Math.hypot(x1 - x0, z1 - z0) || 1;
    const dx = (x1 - x0) / dist, dz = (z1 - z0) / dist;
    const g = p.group;
    const baseRot = g.userData.baseRotY ?? 0;
    this.tl.add(start, dur, (k) => {
      const e = ease.inOutCubic(k);
      const arc = Math.sin(Math.PI * e);
      g.position.set(x0 + (x1 - x0) * e, arc * lift, z0 + (z1 - z0) * e);
      // Lean into the motion for a sense of weight.
      const lean = Math.sin(Math.PI * k) * 0.06;
      g.rotation.set(lean * -dz, baseRot, lean * dx);
    });
    this.landing(g, start + dur);
  }

  /** A tiny settle after arrival — the piece has weight. */
  private landing(g: THREE.Group, at: number) {
    this.tl.add(at, Math.min(160, this.moveMs * 0.3), (k) => {
      const s = 1 - Math.sin(Math.PI * k) * 0.025;
      g.scale.set(0.94 * (2 - s), 0.94 * s, 0.94 * (2 - s));
      if (k >= 1) g.scale.setScalar(0.94);
    });
  }

  private animatePromotion(sq: Square, type: string, color: 'w' | 'b', at: number) {
    const D = this.moveMs;
    const [x, z] = sqToXZ(sq);
    const flare = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: glowTexture('soft'), color: 0xffd36a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    flare.rotation.x = -Math.PI / 2;
    flare.position.set(x, 0.02, z);
    this.scene.add(flare);
    let fresh: PieceObj | null = null;
    this.tl.add(at, D * 0.45, (k) => {
      const old = this.pieces.get(sq);
      if (old && old.type === 'p') old.group.scale.setScalar(0.94 * (1 - ease.inCubic(k)));
      (flare.material as THREE.MeshBasicMaterial).opacity = Math.sin(Math.PI * k) * 0.9;
    }, () => {
      const old = this.pieces.get(sq);
      if (old && old.type === 'p') {
        this.scene.remove(old.group);
        fresh = this.makePiece(type, color, sq);
        this.pieces.set(sq, fresh);
      }
    });
    this.tl.add(at + D * 0.4, D * 0.55, (k) => {
      const p = fresh ?? this.pieces.get(sq);
      if (p) p.group.scale.setScalar(0.94 * Math.max(0.01, ease.outBack(k)));
      (flare.material as THREE.MeshBasicMaterial).opacity = (1 - k) * 0.6;
    }, () => this.scene.remove(flare));
  }

  private topple(loser: 'w' | 'b', delay: number) {
    const k = [...this.pieces.values()].find((p) => p.type === 'k' && p.color === loser);
    if (!k) return;
    const g = k.group;
    const dur = Math.max(700, this.moveMs * 1.6);
    const dir = loser === 'w' ? 1 : -1;
    this.tl.add(delay, dur, (t) => {
      const e = ease.outCubic(t);
      g.rotation.x = dir * e * 1.42;
      g.position.y = Math.sin(Math.PI * Math.min(1, t * 1.2)) * 0.06 + e * 0.1;
    });
  }

  /** Resignation: the resigning king is laid down gently. */
  resign(color: 'w' | 'b') {
    this.tl.begin();
    this.topple(color, 0);
    this.dirty = true;
  }

  setHighlights(h: Highlights) {
    this.hl.clear();
    this.pulse = null;
    const add = (sq: Square, color: number, opacity: number, kind: 'soft' | 'ring' | 'dot' | 'square', scale = 1, y = 0.008, additive = false) => {
      const [x, z] = sqToXZ(sq);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(scale, scale),
        new THREE.MeshBasicMaterial({ map: glowTexture(kind), color, transparent: true, opacity, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending }),
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, y, z);
      m.renderOrder = 2;
      this.hl.add(m);
      return m;
    };
    if (h.lastMove) {
      add(h.lastMove[0], 0xf2c14e, 0.35, 'square', 0.98);
      add(h.lastMove[1], 0xf2c14e, 0.5, 'square', 0.98);
    }
    if (h.hint) {
      add(h.hint[0], 0x4aa8ff, 0.45, 'square', 0.98);
      add(h.hint[1], 0x4aa8ff, 0.6, 'square', 0.98);
    }
    if (h.selected) {
      add(h.selected, 0xffe08a, 0.85, 'ring', 1.05, 0.01, true);
      add(h.selected, 0xffd36a, 0.35, 'soft', 1.3, 0.009, true);
    }
    for (const t of h.targets) add(t, 0xfff2cf, 0.95, 'dot', 0.62, 0.012);
    for (const t of h.captures) add(t, 0xe24a3a, 0.9, 'ring', 1.0, 0.012);
    if (h.check) this.pulse = add(h.check, 0xff3020, 0.8, 'soft', 1.5, 0.011, true);
    if (h.cursor) add(h.cursor, 0x6fd1ff, 0.9, 'ring', 1.0, 0.013);
    this.selectedSq = h.selected;
    this.dirty = true;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    if (this.tl.tick()) this.dirty = true;
    // Smooth camera transitions.
    const c = this.cam, t = this.camTarget;
    let daz = t.az - c.az;
    while (daz > Math.PI) daz -= Math.PI * 2;
    while (daz < -Math.PI) daz += Math.PI * 2;
    if (Math.abs(daz) > 1e-4 || Math.abs(t.elev - c.elev) > 1e-4 || Math.abs(t.dist - c.dist) > 1e-3) {
      c.az += daz * 0.12;
      c.elev += (t.elev - c.elev) * 0.12;
      c.dist += (t.dist - c.dist) * 0.12;
      this.dirty = true;
    }
    // Lift the selected piece slightly.
    for (const [sq, p] of this.pieces) {
      if (this.tl.active) break;
      const want = sq === this.selectedSq ? 0.07 : 0;
      const y = p.group.position.y;
      if (Math.abs(want - y) > 0.001) {
        p.group.position.y = y + (want - y) * 0.25;
        this.dirty = true;
      }
    }
    if (this.pulse) {
      (this.pulse.material as THREE.MeshBasicMaterial).opacity = 0.45 + 0.35 * Math.sin(now / 220);
      this.dirty = true;
    }
    if (this.dirty) {
      this.applyCamera();
      this.renderer.render(this.scene, this.camera);
      this.renders++;
      this.dirty = false;
    }
  };

  /** Finish every running animation instantly. */
  skipAnimations() {
    this.tl.skip();
    this.dirty = true;
  }

  get animating(): boolean {
    return this.tl.active;
  }

  /** Debug/test hook: world position of the piece on a square (or ghost by type). */
  probe(sq: Square): { x: number; y: number; z: number } | null {
    const p = this.pieces.get(sq);
    return p ? { x: p.group.position.x, y: p.group.position.y, z: p.group.position.z } : null;
  }

  /**
   * Test hook: play `apply` (which must call setPosition with an animation)
   * under a virtual clock and sample tracked squares at the given times (ms).
   */
  sampleTimeline(apply: () => void, times: number[], squares: Square[]): { t: number; pos: Record<string, [number, number, number] | null> }[] {
    this.clockOverride = 0;
    apply();
    const out: { t: number; pos: Record<string, [number, number, number] | null> }[] = [];
    for (const t of times) {
      this.clockOverride = t;
      this.tl.tick();
      const pos: Record<string, [number, number, number] | null> = {};
      for (const sq of squares) {
        const p = this.pieces.get(sq);
        pos[sq] = p ? [p.group.position.x, p.group.position.y, p.group.position.z] : null;
      }
      pos['ghosts'] = this.ghosts.size ? [this.ghosts.size, 0, 0] : null;
      out.push({ t, pos });
    }
    this.clockOverride = null;
    this.tl.skip();
    this.dirty = true;
    return out;
  }

  snapshot(type = 'image/png', quality?: number): string {
    this.tl.skip();
    this.applyCamera();
    this.cam = { ...this.camTarget };
    this.applyCamera();
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL(type, quality);
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointer);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

let webglCached: boolean | null = null;
/** Probe WebGL once, then release the probe context (contexts are a scarce resource). */
export function webglAvailable(): boolean {
  if (webglCached !== null) return webglCached;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') || c.getContext('webgl')) as WebGLRenderingContext | null;
    webglCached = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglCached = false;
  }
  return webglCached;
}
