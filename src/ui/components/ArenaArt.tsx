import { useEffect, useState } from 'react';
import { arenaPortrait } from '../../render/arenaPortrait';
import { webglAvailable } from '../../render/board3d';
import { backdropUri } from '../art';

/** Returns a CSS url() for the arena: the 3D portrait once rendered, the painted backdrop meanwhile. */
export function useArenaArt(index: number): string {
  const [url, setUrl] = useState<string>(() => backdropUri(index));
  useEffect(() => {
    let live = true;
    setUrl(backdropUri(index));
    if (webglAvailable()) {
      const t = setTimeout(() => {
        void arenaPortrait(index).then((u) => live && setUrl(u)).catch(() => undefined);
      }, 300);
      return () => {
        live = false;
        clearTimeout(t);
      };
    }
    return () => {
      live = false;
    };
  }, [index]);
  return `url("${url}")`;
}
