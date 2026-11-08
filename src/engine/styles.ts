/**
 * Playing styles.
 *
 * v0.2 introduces eight product styles. The six v0.1 ids remain valid values
 * of `PlayStyle` (old saves store them on every competitor) and are mapped to
 * the closest v0.2 style by {@link normalizeStyle}; no save migration needed.
 * New worlds draw from {@link PLAY_STYLES} (the eight v0.2 ids only).
 */
export type ProductStyle =
  | 'attacker' // Tactical attacker
  | 'strategist' // Positional strategist
  | 'defender' // Defensive specialist
  | 'technician' // Endgame technician
  | 'theoretician' // Opening theoretician
  | 'counterattacker' // Counterattacker
  | 'gambiteer' // Dynamic gambiteer
  | 'universal'; // Universal master

/** v0.1 ids, still accepted (old saves). */
export type LegacyStyle = 'aggressive' | 'positional' | 'solid' | 'tactical' | 'defensive';

export type PlayStyle = ProductStyle | LegacyStyle;
export type OpeningStyleTag = 'aggressive' | 'solid' | 'positional' | 'gambit' | 'hypermodern' | 'classical';

export const PLAY_STYLES: ProductStyle[] = ['attacker', 'strategist', 'defender', 'technician', 'theoretician', 'counterattacker', 'gambiteer', 'universal'];
export const LEGACY_STYLES: LegacyStyle[] = ['aggressive', 'positional', 'solid', 'tactical', 'defensive'];
export const ALL_STYLES: PlayStyle[] = [...PLAY_STYLES, ...LEGACY_STYLES];

export const LEGACY_STYLE_MAP: Record<LegacyStyle, ProductStyle> = {
  aggressive: 'gambiteer',
  tactical: 'attacker',
  positional: 'strategist',
  solid: 'technician',
  defensive: 'defender',
};

/** Map any stored style id (v0.1 or v0.2, or garbage) to a v0.2 style. */
export function normalizeStyle(s: string | null | undefined): ProductStyle {
  if (!s) return 'universal';
  if ((PLAY_STYLES as string[]).includes(s)) return s as ProductStyle;
  return LEGACY_STYLE_MAP[s as LegacyStyle] ?? 'universal';
}

const PRODUCT_OPENINGS: Record<ProductStyle, OpeningStyleTag[]> = {
  attacker: ['aggressive', 'classical'],
  strategist: ['positional', 'hypermodern'],
  defender: ['solid', 'classical'],
  technician: ['solid', 'positional'],
  theoretician: ['classical', 'aggressive'],
  counterattacker: ['hypermodern', 'aggressive'],
  gambiteer: ['gambit', 'aggressive'],
  universal: ['classical', 'positional'],
};

/** Opening repertoire tags per style (legacy ids keep their v0.1 repertoires). */
export const STYLE_TO_OPENINGS: Record<PlayStyle, OpeningStyleTag[]> = {
  ...PRODUCT_OPENINGS,
  aggressive: ['aggressive', 'gambit'],
  tactical: ['aggressive', 'classical'],
  positional: ['positional', 'hypermodern'],
  solid: ['solid', 'classical'],
  defensive: ['solid', 'hypermodern'],
};

const PRODUCT_LABEL: Record<ProductStyle, string> = {
  attacker: 'Tactical attacker',
  strategist: 'Positional strategist',
  defender: 'Defensive specialist',
  technician: 'Endgame technician',
  theoretician: 'Opening theoretician',
  counterattacker: 'Counterattacker',
  gambiteer: 'Dynamic gambiteer',
  universal: 'Universal master',
};

/** Display label for every id, legacy ids included (shown under their v0.2 name). */
export const STYLE_LABEL: Record<PlayStyle, string> = {
  ...PRODUCT_LABEL,
  aggressive: PRODUCT_LABEL.gambiteer,
  tactical: PRODUCT_LABEL.attacker,
  positional: PRODUCT_LABEL.strategist,
  solid: PRODUCT_LABEL.technician,
  defensive: PRODUCT_LABEL.defender,
};

export const STYLE_DESCRIPTION: Record<ProductStyle, string> = {
  attacker: 'Hunts the king: checks, sacrifices near the king, pieces swarming the enemy camp.',
  strategist: 'Improves pieces, takes space and outposts, avoids loosening moves.',
  defender: 'Keeps the king safe, restricts the opponent, trades attackers.',
  technician: 'Simplifies when ahead and steers towards favourable endgames; active king.',
  theoretician: 'Deep, mainline opening preparation; plays the book longest.',
  counterattacker: 'When pressed, answers with threats of its own rather than passive defence.',
  gambiteer: 'Gambits and the initiative: development, open lines, tempo moves.',
  universal: 'No preference: plays the position.',
};
