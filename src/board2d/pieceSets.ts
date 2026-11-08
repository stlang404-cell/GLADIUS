/**
 * GLADIUS piece collections (v0.3). Each set is a distinct hand-illustrated
 * design baked to public/pieces/<folder>/<color><type>.webp by
 * `node scripts/bake-sprites.mjs pieces` (src/render/vectorPieces.ts).
 *
 * Set ids are stored in saves (settings.pieceStyle); ids from older builds
 * map onto current sets through normalizePieceStyle(). Cosmetic only.
 */
export type PieceSetId = 'classical' | 'marble' | 'imperial';

/** How a set is earned. `arena` = highest arena reached (or unlocked set). */
export type PieceUnlock = { always: true } | { arena: number };

export type PieceSet = {
  id: PieceSetId;
  name: string;
  description: string;
  unlock: PieceUnlock;
  folder: string; // under public/pieces/
  /** Light and dark materials, for labels and accessibility text. */
  materials: [string, string];
};

export const PIECE_SETS: PieceSet[] = [
  {
    id: 'classical',
    name: 'Legio',
    description: 'The official GLADIUS set: ivory and ebony with gilded trim — crested legionary pawns, an SPQR tower, a plumed warhorse, augur mitre, a pearl coronet queen and the laurel-domed king under the cross-orb.',
    unlock: { always: true },
    folder: 'classical',
    materials: ['Ivory', 'Ebony'],
  },
  {
    id: 'marble',
    name: 'Senate Marble',
    description: 'Carrara and Nero Marquina carved as Roman architecture: column-drum pawns, crenellated Senate-gate rooks, a sculpted horse bust, Vestal-flame bishops, an Ionic queen with a pearl coronet and a Corinthian king under a laurel dome.',
    unlock: { arena: 4 },
    folder: 'marble',
    materials: ['Carrara marble', 'Nero marble'],
  },
  {
    id: 'imperial',
    name: 'Praetorian Guard',
    description: 'Burnished steel against oxblood lacquer, gilded: centurion-crested legionaries, gate towers with a shield boss, an armoured warhorse, the flamen’s apex, a radiate-crowned queen and the helm-crowned aquila king.',
    unlock: { arena: 10 },
    folder: 'imperial',
    materials: ['Steel', 'Oxblood'],
  },
];

export const DEFAULT_PIECE_SET: PieceSetId = 'classical';

/** Older or alternative ids that map onto current sets. */
const ALIASES: Record<string, PieceSetId> = {
  legio: 'classical',
  ivory: 'classical',
  senate: 'marble',
  carrara: 'marble',
  praetorian: 'imperial',
  gold: 'imperial',
};

export function pieceSetById(id: string | undefined | null): PieceSet | undefined {
  if (!id) return undefined;
  const k = (PIECE_SETS.some((s) => s.id === id) ? id : ALIASES[id]) as PieceSetId | undefined;
  return k ? PIECE_SETS.find((s) => s.id === k) : undefined;
}

/**
 * Map a stored settings.pieceStyle onto a current choice: a set id, or
 * 'board' ("match each board"). Unknown ids fall back to the default set;
 * a missing value means "match each board" (the historical default).
 */
export function normalizePieceStyle(id: string | undefined | null): PieceSetId | 'board' {
  if (id === undefined || id === null || id === '' || id === 'board') return 'board';
  return pieceSetById(id)?.id ?? DEFAULT_PIECE_SET;
}

/** Whether a set is earned, given the highest arena reached / unlocked. */
export function isPieceSetUnlocked(id: string, topArena: number): boolean {
  const s = pieceSetById(id);
  if (!s) return false;
  return 'always' in s.unlock ? true : topArena >= s.unlock.arena;
}

export function pieceSetLabel(s: PieceSet): string {
  return 'always' in s.unlock ? s.name : `${s.name} · arena ${s.unlock.arena + 1}`;
}
