export type PlayStyle = 'aggressive' | 'positional' | 'solid' | 'tactical' | 'defensive' | 'universal';
export type OpeningStyleTag = 'aggressive' | 'solid' | 'positional' | 'gambit' | 'hypermodern' | 'classical';
export const PLAY_STYLES: PlayStyle[] = ['aggressive', 'positional', 'solid', 'tactical', 'defensive', 'universal'];
export const STYLE_TO_OPENINGS: Record<PlayStyle, OpeningStyleTag[]> = {
  aggressive: ['aggressive', 'gambit'],
  tactical: ['aggressive', 'classical'],
  positional: ['positional', 'hypermodern'],
  solid: ['solid', 'classical'],
  defensive: ['solid', 'hypermodern'],
  universal: ['classical', 'positional'],
};
export const STYLE_LABEL: Record<PlayStyle, string> = {
  aggressive: 'Aggressor', positional: 'Strategist', solid: 'Fortress', tactical: 'Tactician', defensive: 'Defender', universal: 'Universal',
};
