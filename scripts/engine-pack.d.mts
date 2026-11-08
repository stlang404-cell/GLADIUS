// Types for scripts/engine-pack.mjs (imported by vite.config.ts and tests/helpers/nodeEngine.ts).
export const DEFAULT_PACK_DIR: string;
export const MANIFEST: string;
export const CHUNK_BYTES: number;
export type PackChunk = { file: string; bytes: number; sha256: string };
export type PackFile = { build: string; bytes: number; sha256: string; encoding?: 'gzip'; delta?: { base: string; format: 'GSD1' }; chunks: PackChunk[] };
export type PackManifest = { format: number; engine: string; source: string; license: string; files: Record<string, PackFile> };
export function sha256(buf: Uint8Array): string;
export function makeDelta(base: Buffer, target: Buffer): Buffer;
export function applyDelta(base: Buffer, delta: Buffer): Buffer;
export function buildPack(srcDir: string, outDir?: string): PackManifest;
export function readManifest(packDir?: string): PackManifest | null;
export function verifyPack(packDir?: string): string[];
export function decodeFile(name: string, packDir?: string, cache?: Map<string, Buffer>): Buffer;
export function assemblePack(outDir: string, packDir?: string, names?: string[]): string[];
