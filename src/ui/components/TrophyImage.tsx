import { useEffect, useState } from 'react';
import { renderTrophy } from '../../render/trophyRenderer';
import { trophyUri } from '../art';

/** 2.5D-rendered trophy portrait (falls back to the vector trophy while rendering or without WebGL). */
export function TrophyImage({ defId, arena, arenaTier, size = 96, locked, alt = '' }: { defId: string; arena?: number; arenaTier?: number; size?: number; locked?: boolean; alt?: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    renderTrophy(defId, { arena, arenaTier, size: size > 140 ? 384 : 256, locked }).then((u) => live && setSrc(u)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [defId, arena, arenaTier, size, locked]);
  return <img className="trophy-img" src={src ?? trophyUri(arena ?? 0)} width={size} height={size} alt={alt} style={src ? undefined : { opacity: 0.35, filter: 'grayscale(1)' }} />;
}
