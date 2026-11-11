"""Stockfish access for the build/validation pipeline.

Stockfish 18 (WASM build from the `stockfish` npm package) is run under Node.js
as a UCI subprocess, so validation needs no native engine binary. The full
(NNUE, single-threaded) flavour is used here; the browser trainer ships the
"lite" flavour.
"""
from __future__ import annotations

import json
import os
import pathlib
import shutil

import chess
import chess.engine

ROOT = pathlib.Path(__file__).resolve().parent.parent
SF_DIR = ROOT / "node_modules" / "stockfish" / "bin"
SF_FULL = SF_DIR / "stockfish-18-single.js"
CACHE_FILE = ROOT / "build" / "engine-cache.json"

MATE_SCORE = 100000


def open_engine(hash_mb: int = 128) -> chess.engine.SimpleEngine:
    node = shutil.which("node")
    if not node:
        raise RuntimeError("node is required to run the Stockfish WASM engine")
    if not SF_FULL.exists():
        raise RuntimeError(f"Stockfish not found at {SF_FULL}; run `npm install` in source/")
    eng = chess.engine.SimpleEngine.popen_uci([node, str(SF_FULL)], cwd=str(SF_DIR))
    eng.configure({"Hash": hash_mb})
    return eng


def score_cp(score: chess.engine.PovScore, pov: chess.Color) -> int:
    """Centipawn score from `pov`'s point of view; mates map to +-(MATE_SCORE - plies)."""
    return score.pov(pov).score(mate_score=MATE_SCORE)


class CachedEngine:
    """Engine wrapper with a persistent JSON cache keyed on (fen, depth, multipv, moves)."""

    def __init__(self, depth: int = 18, hash_mb: int = 128, cache_file: pathlib.Path | None = None):
        self.depth = depth
        self.hash_mb = hash_mb
        self._eng = None
        self.cache = {}
        self.cache_file = pathlib.Path(cache_file) if cache_file else CACHE_FILE
        if self.cache_file.exists():
            try:
                self.cache = json.loads(self.cache_file.read_text())
            except Exception:
                self.cache = {}
        self.dirty = 0

    @property
    def eng(self):
        if self._eng is None:
            self._eng = open_engine(self.hash_mb)
        return self._eng

    def analyse(self, board: chess.Board, multipv: int = 1, depth: int | None = None,
                moves: list[chess.Move] | None = None) -> list[dict]:
        """Return list of {move, cp, mate, pv} from side-to-move POV, best first."""
        depth = depth or self.depth
        key = f"{board.fen()}|{depth}|{multipv}|{','.join(m.uci() for m in moves) if moves else ''}"
        if key in self.cache:
            return self.cache[key]
        if board.is_game_over():
            return []
        legal = board.legal_moves.count()
        mpv = min(multipv, legal) if not moves else min(multipv, len(moves))
        infos = self.eng.analyse(board, chess.engine.Limit(depth=depth), multipv=mpv,
                                 root_moves=moves or None)
        if isinstance(infos, dict):
            infos = [infos]
        out = []
        for info in infos:
            if "pv" not in info or not info["pv"]:
                continue
            sc = info["score"].pov(board.turn)
            out.append({
                "move": info["pv"][0].uci(),
                "cp": sc.score(mate_score=MATE_SCORE),
                "mate": sc.mate(),
                "pv": [m.uci() for m in info["pv"][:12]],
            })
        self.cache[key] = out
        self.dirty += 1
        if self.dirty >= 20:
            self.save()
        return out

    def eval_move(self, board: chess.Board, move: chess.Move, depth: int | None = None) -> dict:
        """Evaluate one specific root move (POV of side to move before the move)."""
        res = self.analyse(board, multipv=1, depth=depth, moves=[move])
        return res[0] if res else {"move": move.uci(), "cp": 0, "mate": None, "pv": [move.uci()]}

    def save(self):
        self.cache_file.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.cache_file.with_suffix(f".{os.getpid()}.tmp")
        tmp.write_text(json.dumps(self.cache))
        os.replace(tmp, self.cache_file)
        self.dirty = 0

    def close(self):
        self.save()
        if self._eng is not None:
            try:
                self._eng.quit()
            except Exception:
                pass
            self._eng = None


if __name__ == "__main__":
    e = CachedEngine(depth=16)
    b = chess.Board("r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 2 3")
    print(e.analyse(b, multipv=3))
    e.close()
