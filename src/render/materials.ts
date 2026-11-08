import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * Material library for the 2.5D board. Physically based, lit by a soft studio
 * environment (PMREM of RoomEnvironment) plus a warm key light, so polished
 * ivory, lacquered ebony and gold read as real materials.
 */
export type PieceFinish = {
  id: string;
  name: string;
  light: { color: string; roughness: number; clearcoat: number; sheen?: string; metalness?: number };
  dark: { color: string; roughness: number; clearcoat: number; sheen?: string; metalness?: number };
  metal: { color: string; roughness: number };
  metalDark?: { color: string; roughness: number };
};

export const FINISHES: Record<string, PieceFinish> = {
  classical: {
    id: 'classical', name: 'Ivory & Bronze',
    light: { color: '#f5ecd9', roughness: 0.3, clearcoat: 0.6, sheen: '#fff6e2' },
    dark: { color: '#8a5a2e', roughness: 0.3, clearcoat: 0.5, metalness: 0.85 },
    metal: { color: '#e2b04a', roughness: 0.22 },
    metalDark: { color: '#f0c860', roughness: 0.2 },
  },
  imperial: {
    id: 'imperial', name: 'Imperial Gold & Crimson',
    light: { color: '#e9bd58', roughness: 0.22, clearcoat: 0.6, metalness: 0.9 },
    dark: { color: '#8e1622', roughness: 0.24, clearcoat: 0.9, sheen: '#e05060' },
    metal: { color: '#f6f1e6', roughness: 0.25 },
    metalDark: { color: '#e8b84e', roughness: 0.2 },
  },
  marble: {
    id: 'marble', name: 'Carrara & Nero Marble',
    light: { color: '#f4f2ee', roughness: 0.22, clearcoat: 0.85 },
    dark: { color: '#2a2a2e', roughness: 0.2, clearcoat: 0.9, sheen: '#5a5a66' },
    metal: { color: '#c9ccd2', roughness: 0.2 },
    metalDark: { color: '#d8dbe0', roughness: 0.2 },
  },
  legio: {
    id: 'legio', name: 'Ivory & Ebony',
    light: { color: '#f6ecd9', roughness: 0.3, clearcoat: 0.6, sheen: '#fff4dd' },
    dark: { color: '#3a1d17', roughness: 0.26, clearcoat: 0.85, sheen: '#a0503a' },
    metal: { color: '#e2b04a', roughness: 0.22 },
  },
};

const envCache = new WeakMap<THREE.WebGLRenderer, THREE.Texture>();
export function studioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  let t = envCache.get(renderer);
  if (!t) {
    const pm = new THREE.PMREMGenerator(renderer);
    t = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    envCache.set(renderer, t);
  }
  return t;
}

export function pieceMaterials(f: PieceFinish) {
  const mk = (s: PieceFinish['light']) =>
    new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(s.color), roughness: s.roughness, metalness: s.metalness ?? 0, clearcoat: s.clearcoat, clearcoatRoughness: 0.25,
      sheen: s.sheen ? 0.35 : 0, sheenColor: s.sheen ? new THREE.Color(s.sheen) : undefined, envMapIntensity: 0.9,
    });
  const metal = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(f.metal.color), roughness: f.metal.roughness, metalness: 1, envMapIntensity: 1.3, clearcoat: 0.3 });
  const metalDark = f.metalDark
    ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color(f.metalDark.color), roughness: f.metalDark.roughness, metalness: 1, envMapIntensity: 1.2 })
    : metal;
  return { w: mk(f.light), b: mk(f.dark), metalW: metal, metalB: metalDark };
}
