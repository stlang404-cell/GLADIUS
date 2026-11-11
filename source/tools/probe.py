#!/usr/bin/env python3
"""Inspect a position while authoring.

  python3 tools/probe.py "FEN" [moves ...] [--depth N] [--multipv K]

Prints the board (from White's side), side to move, legal-check status, the FEN
after any given SAN moves, and Stockfish's top lines (scores from the side to
move's point of view)."""
import argparse, pathlib, sys
import chess
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from chessfmt import board_from, play_sans, tokenize_moves
from engine import CachedEngine, MATE_SCORE

def fmt(cp):
    if abs(cp) >= MATE_SCORE - 1000:
        n = MATE_SCORE - abs(cp); return f"{'+' if cp > 0 else '-'}M{(n + 1) // 2}"
    return f"{cp/100:+.2f}"

ap = argparse.ArgumentParser()
ap.add_argument("fen"); ap.add_argument("moves", nargs="*")
ap.add_argument("--depth", type=int, default=16); ap.add_argument("--multipv", type=int, default=4)
ap.add_argument("--no-engine", action="store_true")
a = ap.parse_args()
b = board_from(a.fen)
if a.moves:
    for mv in play_sans(b, [t for t, _ in tokenize_moves(" ".join(a.moves))]):
        print("  ", b.san(mv)); b.push(mv)
rows = str(b).splitlines()
for i, r in enumerate(rows):
    print(f" {8 - i}  {r}")
print("    a b c d e f g h      (UPPERCASE = White, lowercase = Black)")
print("FEN:", b.fen())
print("to move:", "White" if b.turn else "Black", "| status:", "VALID" if b.status()==chess.STATUS_VALID else repr(b.status()),
      "| check" if b.is_check() else "", "| CHECKMATE" if b.is_checkmate() else "", "| STALEMATE" if b.is_stalemate() else "")
print("legal:", " ".join(sorted(b.san(m) for m in b.legal_moves)))
if not a.no_engine and not b.is_game_over():
    e = CachedEngine(depth=a.depth, cache_file=pathlib.Path(__file__).resolve().parent.parent/"build"/"cache"/"probe.json")
    for t in e.analyse(b, multipv=a.multipv):
        bb = b.copy(); sans = []
        for u in t["pv"][:8]:
            m = chess.Move.from_uci(u); sans.append(bb.san(m)); bb.push(m)
        print(f"  {fmt(t['cp']):>7}  {' '.join(sans)}")
    e.close()
