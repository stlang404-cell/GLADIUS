/** Trophy portrait: pre-rendered artwork baked from the sculpted trophy models (public/trophies). */
export function TrophyImage({ defId, size = 96, locked, alt = '' }: { defId: string; arena?: number; arenaTier?: number; size?: number; locked?: boolean; alt?: string }) {
  return (
    <img
      className={'trophy-img' + (locked ? ' locked' : '')}
      src={new URL(`trophies/${defId}.webp`, document.baseURI).href}
      width={size}
      height={size}
      alt={alt}
      loading="lazy"
    />
  );
}
