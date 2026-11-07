import * as THREE from 'three';
import { Chess, type Square } from 'chess.js';
import { pieceGeometries } from './pieces3d';
import type { Palette } from '../world/arenas';

export type MoveAnim = { from: Square; to: Square; promotion?: string; captured?: boolean; castle?: { rookFrom: Square; rookTo: Square }; epSquare?: Square };
export type Highlights = { selected: Square | null; targets: Square[]; captures: Square[]; lastMove: [Square, Square] | null; check: Square | null; hint?: [Square, Square] | null };
export type AnimSpeedMs = { move: number; lift: number };

type PieceObj = { mesh: THREE.Mesh; type: string; color: 'w' | 'b'; square: Square };
type Tween = { t0: number; dur: number; update: (k: number) => void; done?: () => void };

const FILES = 'abcdefgh';

function sqToXZ(sq: Square): [number, number] {
  const f = FILES.indexOf(sq[0]);
  const r = Number(sq[1]) - 1;
  return [f - 3.5, 3.5 - r];
}

function ease(k: number) {
  return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
}

/**
 * Interactive 2.5D board renderer. Owns no chess logic: it displays the FEN it
 * is given, animates the move it is told about, and reports square taps.
 * Renders on demand (only while something changes) to save battery.
 */
export class Board3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private pieces = new Map<Square, PieceObj>();
  private squares: THREE.Mesh[] = [];
  private hl = new THREE.Group();
  private tweens: Tween[] = [];
  private raf = 0;
  private dirty = true;
  private materials: Record<string, THREE.MeshStandardMaterial>;
  private boardGroup = new THREE.Group();
  private ro: ResizeObserver;
  private fen = '';
  private orientation: 'w' | 'b' = 'w';
  private tilt = 0.55;
  private azimuth = 0;
  private palette: Palette;
  private checkPulse: THREE.Mesh | null = null;
  private quality: 'high' | 'low';
  onSquare: (sq: Square) => void = () => {};
  speed: AnimSpeedMs = { move: 260, lift: 0.25 };

  constructor(private el: HTMLElement, palette: Palette, opts: { quality?: 'high' | 'low' } = {}) {
    this.palette = palette;
    this.quality = opts.quality ?? (window.devicePixelRatio > 2 || /iPhone|Android/.test(navigator.userAgent) ? 'low' : 'high');
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.quality === 'high' ? 2 : 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    el.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.touchAction = 'none';
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    this.materials = this.makeMaterials();
    this.buildScene();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(el);
    this.resize();
    this.renderer.domElement.addEventListener('pointerdown', this.onPointer);
    this.loop();
  }

  private makeMaterials() {
    const p = this.palette;
    const metal = p.pieceMetal;
    return {
      w: new THREE.MeshStandardMaterial({ color: new THREE.Color(p.pieceLight), roughness: 0.38 - metal * 0.15, metalness: metal * 0.6 }),
      b: new THREE.MeshStandardMaterial({ color: new THREE.Color(p.pieceDark), roughness: 0.32 - metal * 0.12, metalness: metal * 0.7 }),
      light: new THREE.MeshStandardMaterial({ color: new THREE.Color(p.light), roughness: 0.55 }),
      dark: new THREE.MeshStandardMaterial({ color: new THREE.Color(p.dark), roughness: 0.5 }),
      frame: new THREE.MeshStandardMaterial({ color: new THREE.Color(p.frame), roughness: 0.45, metalness: 0.2 }),
      trim: new THREE.MeshStandardMaterial({ color: new THREE.Color(p.accent2.startsWith('#e') || p.accent2.startsWith('#f') ? p.accent2 : '#d4a640'), roughness: 0.3, metalness: 0.85 }),
    };
  }

  private buildScene() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight(0xfff4e0, 0x403020, 0.85));
    const key = new THREE.DirectionalLight(0xffefd8, 2.2);
    key.position.set(-4, 9, 5);
    key.castShadow = true;
    const sm = this.quality === 'high' ? 2048 : 1024;
    key.shadow.mapSize.set(sm, sm);
    key.shadow.camera.left = -6;
    key.shadow.camera.right = 6;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -6;
    key.shadow.bias = -0.0004;
    key.shadow.radius = 4;
    s.add(key);
    const rim = new THREE.DirectionalLight(0xbfd8ff, 0.6);
    rim.position.set(5, 4, -6);
    s.add(rim);
    s.add(this.boardGroup);
    this.buildBoard();
    s.add(this.hl);
  }

  private buildBoard() {
    const g = this.boardGroup;
    g.clear();
    this.squares = [];
    const sqGeo = new THREE.BoxGeometry(1, 0.12, 1);
    for (let f = 0; f < 8; f++)
      for (let r = 0; r < 8; r++) {
        const light = (f + r) % 2 === 1;
        const m = new THREE.Mesh(sqGeo, light ? this.materials.light : this.materials.dark);
        m.position.set(f - 3.5, -0.06, 3.5 - r);
        m.receiveShadow = true;
        m.userData.square = FILES[f] + (r + 1);
        g.add(m);
        this.squares.push(m);
      }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(9.1, 0.3, 9.1), this.materials.frame);
    frame.position.y = -0.2;
    frame.receiveShadow = true;
    g.add(frame);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(8.24, 0.04, 8.24), this.materials.trim);
    trim.position.y = -0.03;
    g.add(trim);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(9.5, 0.25, 9.5), this.materials.frame);
    plinth.position.y = -0.45;
    g.add(plinth);
    g.add(this.coordLabels());
  }

  private coordLabels(): THREE.Group {
    const grp = new THREE.Group();
    const mk = (txt: string) => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = this.palette.accent2;
      ctx.font = 'bold 40px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, 32, 34);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      m.rotation.x = -Math.PI / 2;
      return m;
    };
    for (let i = 0; i < 8; i++) {
      const fl = mk(FILES[i]);
      fl.position.set(i - 3.5, 0.06, 4.27);
      grp.add(fl);
      const rk = mk(String(i + 1));
      rk.position.set(-4.27, 0.06, 3.5 - i);
      grp.add(rk);
    }
    grp.name = 'coords';
    return grp;
  }

  setPalette(p: Palette) {
    this.palette = p;
    this.materials = this.makeMaterials();
    this.buildBoard();
    const fen = this.fen;
    this.clearPieces();
    this.fen = '';
    this.setPosition(fen);
  }

  setCoords(show: boolean) {
    const c = this.boardGroup.getObjectByName('coords');
    if (c) c.visible = show;
    this.dirty = true;
  }

  setOrientation(o: 'w' | 'b') {
    this.orientation = o;
    this.updateCamera();
  }
  setTilt(t: number) {
    this.tilt = t;
    this.updateCamera();
  }
  /** Rotate the view around the board (radians, relative to the player's side). */
  setAzimuth(a: number) {
    this.azimuth = a;
    this.updateCamera();
  }

  private updateCamera() {
    const aspect = this.camera.aspect;
    const elev = THREE.MathUtils.lerp(85, 38, this.tilt) * (Math.PI / 180);
    const fitW = aspect < 1 ? 10.2 / aspect : 10.2;
    const dist = fitW / (2 * Math.tan((this.camera.fov * Math.PI) / 360)) * (0.92 + 0.1 * this.tilt);
    const az = this.azimuth + (this.orientation === 'w' ? 0 : Math.PI);
    this.camera.position.set(Math.sin(az) * Math.cos(elev) * dist, Math.sin(elev) * dist, Math.cos(az) * Math.cos(elev) * dist);
    this.camera.lookAt(0, -0.2, 0.25 * this.tilt * (this.orientation === 'w' ? 1 : -1) * Math.cos(this.azimuth));
    this.dirty = true;
  }

  resize() {
    const w = this.el.clientWidth || 300;
    const h = this.el.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.updateCamera();
  }

  private onPointer = (e: PointerEvent) => {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    // Intersect the board plane so taps on tall pieces map to their square.
    const piecesHit = ray.intersectObjects([...this.pieces.values()].map((p) => p.mesh), false)[0];
    if (piecesHit) {
      const sq = (piecesHit.object.userData.square as Square) ?? null;
      if (sq) return this.onSquare(sq);
    }
    const hit = ray.intersectObjects(this.squares, false)[0];
    if (hit) this.onSquare(hit.object.userData.square as Square);
  };

  private makePiece(type: string, color: 'w' | 'b', sq: Square): PieceObj {
    const mesh = new THREE.Mesh(pieceGeometries()[type], this.materials[color]);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const [x, z] = sqToXZ(sq);
    mesh.position.set(x, 0, z);
    mesh.scale.setScalar(type === 'p' ? 0.95 : 1.05);
    // Knights face the opponent.
    if (type === 'n') mesh.rotation.y = color === 'w' ? -0.45 : Math.PI + 0.45;
    mesh.userData.square = sq;
    this.scene.add(mesh);
    return { mesh, type, color, square: sq };
  }

  private clearPieces() {
    for (const p of this.pieces.values()) this.scene.remove(p.mesh);
    this.pieces.clear();
  }

  private finishTweens() {
    for (const t of this.tweens) {
      t.update(1);
      t.done?.();
    }
    this.tweens = [];
  }

  /** Display `fen`. If `anim` describes the move that led here, animate it. */
  setPosition(fen: string, anim?: MoveAnim | null, mate = false) {
    this.finishTweens();
    const target = new Chess(fen);
    if (anim && this.fen) {
      const mover = this.pieces.get(anim.from);
      if (mover) {
        const capSq = anim.epSquare ?? anim.to;
        const victim = this.pieces.get(capSq);
        if (victim && victim !== mover) this.captureOut(victim);
        this.pieces.delete(anim.from);
        if (capSq !== anim.to) this.pieces.delete(capSq);
        this.pieces.set(anim.to, mover);
        this.slide(mover, anim.from, anim.to, mover.type === 'n' ? 0.6 : this.speed.lift, () => {
          if (anim.promotion) this.promote(anim.to, anim.promotion);
        });
        if (anim.castle) {
          const rook = this.pieces.get(anim.castle.rookFrom);
          if (rook) {
            this.pieces.delete(anim.castle.rookFrom);
            this.pieces.set(anim.castle.rookTo, rook);
            this.slide(rook, anim.castle.rookFrom, anim.castle.rookTo, 0.35);
          }
        }
      }
    }
    // Reconcile with the authoritative position (handles any desync / jumps).
    const want = new Map<Square, { type: string; color: 'w' | 'b' }>();
    for (const row of target.board()) for (const p of row) if (p) want.set(p.square, { type: p.type, color: p.color });
    for (const [sq, obj] of [...this.pieces]) {
      const w = want.get(sq);
      if (!w || w.color !== obj.color || (w.type !== obj.type && !(anim?.promotion && sq === anim.to))) {
        this.scene.remove(obj.mesh);
        this.pieces.delete(sq);
      }
    }
    for (const [sq, w] of want) if (!this.pieces.has(sq)) this.pieces.set(sq, this.makePiece(w.type, w.color, sq));
    for (const [sq, obj] of this.pieces) {
      obj.square = sq;
      obj.mesh.userData.square = sq;
    }
    this.fen = fen;
    if (mate) this.topple(target.turn());
    this.dirty = true;
  }

  private slide(p: PieceObj, from: Square, to: Square, lift: number, done?: () => void) {
    const [x0, z0] = sqToXZ(from);
    const [x1, z1] = sqToXZ(to);
    const dist = Math.hypot(x1 - x0, z1 - z0);
    const dur = this.speed.move * (0.75 + Math.min(dist, 6) * 0.08);
    this.tweens.push({
      t0: performance.now(), dur,
      update: (k) => {
        const e = ease(k);
        p.mesh.position.set(x0 + (x1 - x0) * e, Math.sin(Math.PI * e) * lift * Math.min(1, 0.4 + dist * 0.2), z0 + (z1 - z0) * e);
      },
      done,
    });
  }

  private captureOut(v: PieceObj) {
    const mat = (v.mesh.material as THREE.MeshStandardMaterial).clone();
    mat.transparent = true;
    v.mesh.material = mat;
    const y0 = v.mesh.position.y;
    this.tweens.push({
      t0: performance.now(), dur: this.speed.move * 1.1,
      update: (k) => {
        mat.opacity = 1 - k;
        v.mesh.position.y = y0 - k * 0.5;
        v.mesh.rotation.z = k * 0.6;
      },
      done: () => this.scene.remove(v.mesh),
    });
  }

  private promote(sq: Square, type: string) {
    const old = this.pieces.get(sq);
    if (!old) return;
    this.scene.remove(old.mesh);
    const np = this.makePiece(type, old.color, sq);
    this.pieces.set(sq, np);
    np.mesh.scale.setScalar(0.01);
    this.tweens.push({ t0: performance.now(), dur: 420, update: (k) => np.mesh.scale.setScalar(0.01 + 1.04 * ease(k)) });
  }

  private topple(loser: 'w' | 'b') {
    const k = [...this.pieces.values()].find((p) => p.type === 'k' && p.color === loser);
    if (!k) return;
    this.tweens.push({ t0: performance.now() + this.speed.move, dur: 900, update: (t) => { k.mesh.rotation.z = (Math.PI / 2.2) * ease(Math.max(0, t)); k.mesh.position.y = 0.12 * ease(Math.max(0, t)); } });
  }

  setHighlights(h: Highlights) {
    this.hl.clear();
    this.checkPulse = null;
    const add = (sq: Square, color: string, opacity: number, kind: 'fill' | 'dot' | 'ring' = 'fill') => {
      const [x, z] = sqToXZ(sq);
      let geo: THREE.BufferGeometry;
      if (kind === 'dot') geo = new THREE.CircleGeometry(0.16, 24);
      else if (kind === 'ring') geo = new THREE.RingGeometry(0.36, 0.47, 32);
      else geo = new THREE.PlaneGeometry(0.98, 0.98);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.005, z);
      this.hl.add(m);
      return m;
    };
    if (h.lastMove) {
      add(h.lastMove[0], '#f4cf5a', 0.32);
      add(h.lastMove[1], '#f4cf5a', 0.45);
    }
    if (h.hint) {
      add(h.hint[0], '#4fb4ff', 0.4);
      add(h.hint[1], '#4fb4ff', 0.55);
    }
    if (h.selected) add(h.selected, '#7ad36b', 0.55);
    for (const t of h.targets) add(t, '#1d3b12', 0.45, 'dot');
    for (const t of h.captures) add(t, '#b0201a', 0.75, 'ring');
    if (h.check) this.checkPulse = add(h.check, '#ff2a1a', 0.6);
    this.dirty = true;
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const now = performance.now();
    if (this.tweens.length) {
      const keep: Tween[] = [];
      for (const t of this.tweens) {
        const k = Math.min(1, Math.max(0, (now - t.t0) / t.dur));
        t.update(k);
        if (k >= 1) t.done?.();
        else keep.push(t);
      }
      this.tweens = keep;
      this.dirty = true;
    }
    if (this.checkPulse) {
      (this.checkPulse.material as THREE.MeshBasicMaterial).opacity = 0.35 + 0.3 * Math.sin(now / 180);
      this.dirty = true;
    }
    if (this.dirty) {
      this.renderer.render(this.scene, this.camera);
      this.dirty = false;
    }
  };

  /** Skip any running animation instantly. */
  skipAnimations() {
    this.finishTweens();
    this.dirty = true;
  }

  dispose() {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.renderer.domElement.removeEventListener('pointerdown', this.onPointer);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}

export function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}
