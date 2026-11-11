"""Shared parsing for the manuscript's chess blocks and exercise files."""
from __future__ import annotations

import json
import pathlib
import re

import chess
import yaml

ROOT = pathlib.Path(__file__).resolve().parent.parent
import os
MANUSCRIPT = pathlib.Path(os.environ.get("ELO_MANUSCRIPT", ROOT / "manuscript"))
EXERCISES = pathlib.Path(os.environ.get("ELO_EXERCISES", ROOT / "exercises"))

ANNOT_RE = re.compile(r"(\?\?|\?!|!\?|!!|\?|!)$")
MOVENUM_RE = re.compile(r"^\d+\.(\.\.)?$|^\d+\.\.\.$|^\d+…$")
RESULT_TOKENS = {"1-0", "0-1", "1/2-1/2", "*"}

FENCE_RE = re.compile(r"^```(board|line)\s*\n(.*?)^```\s*$", re.S | re.M)
FRONT_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n", re.S)


def parse_front(text: str) -> tuple[dict, str]:
    m = FRONT_RE.match(text)
    if not m:
        return {}, text
    return yaml.safe_load(m.group(1)) or {}, text[m.end():]


def parse_kv(body: str) -> dict:
    out = {}
    for line in body.splitlines():
        if not line.strip() or line.strip().startswith("#"):
            continue
        if ":" not in line:
            raise ValueError(f"bad block line (expected key: value): {line!r}")
        k, v = line.split(":", 1)
        out[k.strip().lower()] = v.strip()
    return out


def board_from(fen: str) -> chess.Board:
    if fen.strip().lower() in ("start", "startpos", "initial"):
        return chess.Board()
    return chess.Board(fen.strip())


def tokenize_moves(text: str) -> list[tuple[str, str]]:
    """Split a move string into (san, annotation) pairs, dropping move numbers/results.

    Accepts '1.e4 e5 2.Nf3', '1. e4 e5', '3...Bc5', '12…Qxd4'.
    """
    text = text.replace("…", "...")
    text = re.sub(r"(\d+)\.(\.\.)?(?=\S)", r"\1.\2 ", text)  # '1.e4' -> '1. e4'
    out = []
    for tok in text.split():
        if MOVENUM_RE.match(tok) or tok in RESULT_TOKENS:
            continue
        if re.match(r"^\d+\.+$", tok):
            continue
        ann = ""
        m = ANNOT_RE.search(tok)
        if m:
            ann = m.group(1)
            tok = tok[: m.start()]
        tok = tok.replace("0-0-0", "O-O-O").replace("0-0", "O-O")
        if tok:
            out.append((tok, ann))
    return out


def play_sans(board: chess.Board, sans: list[str]) -> list[chess.Move]:
    """Play SAN moves on a copy; raises ValueError with context on the first illegal move."""
    b = board.copy()
    moves = []
    for i, san in enumerate(sans):
        try:
            mv = b.parse_san(san)
        except ValueError as exc:
            legal = ", ".join(sorted(b.san(m) for m in b.legal_moves))
            raise ValueError(f"move {i + 1} '{san}' is illegal/ambiguous in {b.fen()} "
                             f"({exc}). Legal: {legal}") from None
        moves.append(mv)
        b.push(mv)
    return moves


def iter_chapters():
    for p in sorted((MANUSCRIPT / "chapters").glob("*.md")):
        yield p
    for p in sorted((MANUSCRIPT / "front").glob("*.md")):
        yield p
    back = MANUSCRIPT / "back"
    if back.exists():
        for p in sorted(back.glob("*.md")):
            yield p


def iter_blocks(text: str):
    for m in FENCE_RE.finditer(text):
        line_no = text[: m.start()].count("\n") + 1
        yield m.group(1), parse_kv(m.group(2)), line_no


def load_exercise_files():
    for p in sorted(EXERCISES.glob("*.json")):
        yield p, json.loads(p.read_text())
