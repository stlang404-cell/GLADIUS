import { backdropUri } from '../art';

/** CSS url() for an arena's illustrated backdrop. */
export function useArenaArt(index: number): string {
  return `url("${backdropUri(index)}")`;
}
