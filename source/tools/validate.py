#!/usr/bin/env python3
"""Validate every chess position, move and exercise in the manuscript.

Usage:
  python3 tools/validate.py                      # everything, default depth
  python3 tools/validate.py exercises/07-forks.json manuscript/chapters/07-forks.md
  python3 tools/validate.py --depth 14 FILE...   # quicker drafting pass
  python3 tools/validate.py --no-engine FILE...  # legality/schema only

Exit code is non-zero when any ERROR is found. WARNINGS must be reviewed.
Compiled exercise data (with engine-derived acceptable moves per ply) is
written to build/compiled/<stem>.json for the book and app builders.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys

import chess

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from chessfmt import (ROOT, board_from, iter_blocks, iter_chapters, load_exercise_files,  # noqa: E402
                      parse_front, play_sans, tokenize_moves)
from engine import MATE_SCORE, CachedEngine  # noqa: E402

TYPES = {"tactic", "mate", "defense", "blunder-check", "opening", "endgame", "quiet",
         "strategy", "evaluation", "counting", "rules", "vision", "conversion", "calculation"}
GOALS = {"mate", "win", "best", "only", "draw"}
REQUIRED = ["id", "type", "difficulty", "fen", "question", "solution", "goal",
            "explanation", "objective", "tags"]
SQUARES = set(chess.SQUARE_NAMES)

WIN_MIN = 200          # a "win" solution must be at least +2.00
WIN_MARGIN = 150       # ... and at least 1.50 better than any non-accepted alternative
WIN_MARGIN_BIG = 300   # ... or 3.00 better when the alternative is also clearly winning
BEST_TOL = 50          # a "best" solution must be within 0.50 of the engine's top move
ONLY_MARGIN = 120      # an "only" move must beat every alternative by 1.20
WRONG_MIN = 80         # a listed wrong answer must be at least 0.80 worse ("best"/"only")
DRAW_TOL = 90          # a "draw" solution must evaluate within +-0.90
ALSO_GOOD = 25         # engine moves this close to the solution count as acceptable in the app
LINE_DROP = 110        # an un-annotated move in a checked line may not lose more than 1.10


class Report:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def err(self, where, msg):
        self.errors.append(f"ERROR   {where}: {msg}")

    def warn(self, where, msg):
        self.warnings.append(f"WARNING {where}: {msg}")


def fmt(cp):
    if cp is None:
        return "?"
    if abs(cp) >= MATE_SCORE - 1000:
        n = MATE_SCORE - abs(cp)
        return f"{'+' if cp > 0 else '-'}M{(n + 1) // 2}"
    return f"{cp / 100:+.2f}"


def check_board_basic(board: chess.Board, where: str, rep: Report):
    status = board.status()
    if status != chess.STATUS_VALID:
        rep.err(where, f"invalid position ({status!r}): {board.fen()}")
        return False
    if board.is_game_over():
        rep.err(where, f"position is already game over: {board.fen()}")
        return False
    return True


def validate_exercise(ex: dict, where: str, eng: CachedEngine | None, rep: Report, depth: int) -> dict:
    out = dict(ex)
    for k in REQUIRED:
        if k not in ex or ex[k] in (None, "", []):
            rep.err(where, f"missing field '{k}'")
    if rep_has_missing(ex):
        return out
    if ex["type"] not in TYPES:
        rep.err(where, f"unknown type {ex['type']!r}")
    if ex["goal"] not in GOALS:
        rep.err(where, f"unknown goal {ex['goal']!r}")
    if not (isinstance(ex["difficulty"], int) and 1 <= ex["difficulty"] <= 5):
        rep.err(where, "difficulty must be an integer 1-5")
    if len(ex["explanation"]) < 60:
        rep.warn(where, "explanation is very short")
    try:
        board = chess.Board(ex["fen"])
    except ValueError as exc:
        rep.err(where, f"bad FEN: {exc}")
        return out
    if not check_board_basic(board, where, rep):
        return out
    q = ex["question"].lower()
    side = "white" if board.turn == chess.WHITE else "black"
    other = "black" if side == "white" else "white"
    if f"{other} to move" in q or f"{other} to play" in q:
        rep.err(where, f"question says {other} to move but FEN has {side} to move")
    sol = [s for s, _ in tokenize_moves(" ".join(ex["solution"]))]
    try:
        sol_moves = play_sans(board, sol)
    except ValueError as exc:
        rep.err(where, f"solution: {exc}")
        return out
    accept_first = []
    for a in ex.get("accept", []):
        try:
            accept_first.append(board.parse_san(a))
        except ValueError:
            rep.err(where, f"accept move {a!r} illegal")
    wrong_moves = []
    for w in ex.get("wrong", []):
        if not isinstance(w, dict) or "move" not in w or "why" not in w:
            rep.err(where, "each wrong answer needs {move, why}")
            continue
        try:
            wm = board.parse_san(w["move"])
        except ValueError:
            rep.err(where, f"wrong move {w['move']!r} illegal")
            continue
        if wm == sol_moves[0] or wm in accept_first:
            rep.err(where, f"wrong move {w['move']} is also the solution/accepted")
        wrong_moves.append((w["move"], wm))
    if not ex.get("wrong"):
        rep.warn(where, "no common wrong answers listed")
    # normalised SAN for output
    b2 = board.copy()
    norm = []
    for mv in sol_moves:
        norm.append(b2.san(mv))
        b2.push(mv)
    out["solution"] = norm
    out["side"] = side
    final = b2
    if ex["goal"] == "mate":
        n = ex.get("mate_in")
        if not isinstance(n, int):
            rep.err(where, "goal 'mate' needs integer mate_in")
        else:
            if len(sol_moves) != 2 * n - 1:
                rep.err(where, f"mate_in {n} needs {2 * n - 1} plies in solution, got {len(sol_moves)}")
            if not final.is_checkmate():
                rep.err(where, "solution line does not end in checkmate")
    if len(sol_moves) % 2 == 0:
        rep.warn(where, "solution ends with the opponent's move; normally end on the solver's move")

    if eng is None:
        out["accept_by_ply"] = [[norm[i]] if i % 2 == 0 else [] for i in range(len(norm))]
        return out

    # ---------------- engine checks ----------------
    k = min(6, max(4, 2 + len(accept_first) + len(wrong_moves)))
    top = eng.analyse(board, multipv=k, depth=depth)
    if not top:
        rep.err(where, "engine returned nothing")
        return out
    best = top[0]
    first = sol_moves[0]
    ev_first = next((t for t in top if t["move"] == first.uci()), None) or eng.eval_move(board, first, depth)
    cpF = ev_first["cp"]
    out["engine"] = {"depth": depth, "best": board.san(chess.Move.from_uci(best["move"])), "best_eval": fmt(best["cp"]),
                     "solution_eval": fmt(cpF),
                     "top": [{"san": board.san(chess.Move.from_uci(t["move"])), "eval": fmt(t["cp"])} for t in top]}
    accepted_uci = {first.uci()} | {m.uci() for m in accept_first}
    alts = [t for t in top if t["move"] not in accepted_uci]
    alt = alts[0] if alts else None
    goal = ex["goal"]
    acc_first_san = [norm[0]] + [board.san(m) for m in accept_first]

    if goal == "mate":
        n = ex.get("mate_in")
        if ev_first["mate"] != n:
            rep.err(where, f"engine: {norm[0]} gives mate={ev_first['mate']} (cp {fmt(cpF)}), expected mate in {n}")
        for t in alts:
            if t["mate"] is not None and 0 < t["mate"] <= (n or 0):
                rep.err(where, f"alternative mate in {t['mate']} with "
                               f"{board.san(chess.Move.from_uci(t['move']))}; add to 'accept' or change position")
    elif goal == "win":
        if cpF < WIN_MIN:
            rep.err(where, f"solution {norm[0]} evaluates {fmt(cpF)} (< {fmt(WIN_MIN)}); not a clear win")
        if best["cp"] - cpF > 60 and best["move"] not in accepted_uci:
            if best["mate"] is not None and best["mate"] > 0 and (ev_first["mate"] is None):
                rep.err(where, f"engine finds forced mate ({fmt(best['cp'])}) with "
                               f"{board.san(chess.Move.from_uci(best['move']))}; solution only {fmt(cpF)}")
            elif best["cp"] - cpF > 150:
                rep.err(where, f"engine prefers {board.san(chess.Move.from_uci(best['move']))} "
                               f"({fmt(best['cp'])}) over solution ({fmt(cpF)})")
            else:
                rep.warn(where, f"engine slightly prefers {board.san(chess.Move.from_uci(best['move']))} "
                                f"({fmt(best['cp'])} vs {fmt(cpF)})")
        if alt is not None:
            margin = min(cpF, MATE_SCORE - 2000) - min(alt["cp"], MATE_SCORE - 2000)
            need = WIN_MARGIN_BIG if alt["cp"] >= 300 else WIN_MARGIN
            if margin < need:
                rep.err(where, f"not unique: {board.san(chess.Move.from_uci(alt['move']))} also gives "
                               f"{fmt(alt['cp'])} vs solution {fmt(cpF)}; add to 'accept' (if it is genuinely "
                               f"the same idea) or rework the position")
    elif goal in ("best", "only"):
        if best["cp"] - cpF > BEST_TOL and best["move"] not in accepted_uci:
            rep.err(where, f"solution {norm[0]} ({fmt(cpF)}) is not best; engine: "
                           f"{board.san(chess.Move.from_uci(best['move']))} {fmt(best['cp'])}")
        if goal == "only" and alt is not None and cpF - alt["cp"] < ONLY_MARGIN:
            rep.err(where, f"'only' move not unique: {board.san(chess.Move.from_uci(alt['move']))} "
                           f"{fmt(alt['cp'])} vs {fmt(cpF)}")
    elif goal == "draw":
        if abs(cpF) > DRAW_TOL:
            rep.err(where, f"draw solution evaluates {fmt(cpF)}")

    # wrong answers must really be worse
    for san, wm in wrong_moves:
        ev = next((t for t in top if t["move"] == wm.uci()), None) or eng.eval_move(board, wm, depth)
        need = {"mate": 1, "win": WIN_MARGIN, "best": WRONG_MIN, "only": WRONG_MIN, "draw": 150}[goal]
        if goal == "mate":
            if ev["mate"] is not None and 0 < ev["mate"] <= (ex.get("mate_in") or 0):
                rep.err(where, f"'wrong' move {san} also mates")
        elif min(cpF, MATE_SCORE - 2000) - min(ev["cp"], MATE_SCORE - 2000) < need:
            rep.err(where, f"'wrong' move {san} evaluates {fmt(ev['cp'])}, not clearly worse than "
                           f"solution {fmt(cpF)}")
        out.setdefault("wrong_eval", {})[san] = fmt(ev["cp"])

    # walk the line: defender replies sensible; solver alternatives that the app may accept
    accept_by_ply = []
    b = board.copy()
    for i, mv in enumerate(sol_moves):
        if i % 2 == 0:
            acc = set([b.san(mv)])
            if i == 0:
                acc |= set(acc_first_san)
            node = top if i == 0 else eng.analyse(b, multipv=3, depth=max(12, depth - 2))
            ref = cpF if i == 0 else (next((t["cp"] for t in node if t["move"] == mv.uci()), None))
            if ref is None:
                ref = eng.eval_move(b, mv, max(12, depth - 2))["cp"]
            if i > 0 and node and node[0]["cp"] - ref > 150 and goal in ("win", "mate"):
                rep.warn(where, f"ply {i + 1}: {b.san(mv)} ({fmt(ref)}) weaker than "
                                f"{b.san(chess.Move.from_uci(node[0]['move']))} ({fmt(node[0]['cp'])})")
            for t in node:
                m = chess.Move.from_uci(t["move"])
                if goal == "mate":
                    if t["mate"] is not None and t["mate"] > 0 and t["cp"] >= ref:
                        acc.add(b.san(m))
                elif goal == "win" and i == 0:
                    pass  # first move of a win puzzle: only listed answers
                elif t["cp"] >= ref - ALSO_GOOD and (goal != "win" or t["cp"] >= WIN_MIN):
                    if i > 0 or goal in ("best", "draw"):
                        acc.add(b.san(m))
            accept_by_ply.append(sorted(acc))
        else:
            node = eng.analyse(b, multipv=1, depth=max(12, depth - 2))
            if node:
                bestd = node[0]
                evm = eng.eval_move(b, mv, max(12, depth - 2))
                if bestd["cp"] - evm["cp"] > 150 and bestd["mate"] is None:
                    rep.warn(where, f"ply {i + 1}: defender reply {b.san(mv)} ({fmt(evm['cp'])}) is much weaker "
                                    f"than {b.san(chess.Move.from_uci(bestd['move']))} ({fmt(bestd['cp'])}); "
                                    f"explain or use the stronger defence")
            accept_by_ply.append([])
        b.push(mv)
    out["accept_by_ply"] = accept_by_ply
    return out


def rep_has_missing(ex):
    return any(k not in ex or ex[k] in (None, "", []) for k in REQUIRED)


def validate_exercise_file(path: pathlib.Path, data: dict, eng, rep: Report, depth: int, seen: dict):
    compiled = dict(data)
    compiled["exercises"] = []
    ids = set()
    for k in ("chapter", "title", "exercises"):
        if k not in data:
            rep.err(path.name, f"missing top-level '{k}'")
    for ex in data.get("exercises", []):
        where = f"{path.name}#{ex.get('id', '?')}"
        if ex.get("id") in ids:
            rep.err(where, "duplicate id")
        ids.add(ex.get("id"))
        try:
            key = " ".join(chess.Board(ex["fen"]).fen().split()[:4])
            if key in seen:
                rep.err(where, f"same position as {seen[key]}")
            seen[key] = where
        except Exception:
            pass
        compiled["exercises"].append(validate_exercise(ex, where, eng, rep, depth))
    if eng is not None:  # only engine-checked data may feed the book and app builds
        out = ROOT / "build" / "compiled" / path.name
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(compiled, indent=1, ensure_ascii=False))
    return compiled


def validate_markdown(path: pathlib.Path, eng, rep: Report, depth: int):
    text = path.read_text()
    front, body = parse_front(text)
    if path.parent.name == "chapters":
        for k in ("chapter", "title", "slug", "part", "stage", "objectives"):
            if k not in front:
                rep.err(path.name, f"front matter missing '{k}'")
    n_boards = n_lines = 0
    for kind, kv, line_no in iter_blocks(text):
        where = f"{path.name}:{line_no}"
        if kind == "board":
            n_boards += 1
            if "fen" not in kv:
                rep.err(where, "board block without fen")
                continue
            try:
                b = board_from(kv["fen"])
            except ValueError as exc:
                rep.err(where, f"bad FEN {kv['fen']!r}: {exc}")
                continue
            if b.status() != chess.STATUS_VALID:
                rep.err(where, f"invalid position {b.status()!r}: {kv['fen']}")
            for key in ("arrows", "red", "blue", "squares", "marks"):
                for tok in kv.get(key, "").replace(",", " ").split():
                    sqs = [tok[:2], tok[2:4]] if key in ("arrows", "red", "blue") else [tok]
                    if key in ("arrows", "red", "blue") and len(tok) != 4:
                        rep.err(where, f"arrow {tok!r} must be like e2e4")
                    for s in sqs:
                        if s not in SQUARES:
                            rep.err(where, f"bad square {s!r} in {key}")
            if kv.get("orientation", "white") not in ("white", "black"):
                rep.err(where, "orientation must be white or black")
            if "caption" not in kv:
                rep.warn(where, "board without caption")
        else:
            n_lines += 1
            try:
                b = board_from(kv.get("fen", "startpos"))
            except ValueError as exc:
                rep.err(where, f"bad FEN: {exc}")
                continue
            toks = tokenize_moves(kv.get("moves", ""))
            if not toks:
                rep.err(where, "line block without moves")
                continue
            try:
                moves = play_sans(b, [t for t, _ in toks])
            except ValueError as exc:
                rep.err(where, str(exc))
                continue
            if kv.get("check", "").lower() == "engine" and eng is not None:
                bb = b.copy()
                for (san, ann), mv in zip(toks, moves):
                    if bb.is_game_over():
                        break
                    node = eng.analyse(bb, multipv=1, depth=min(depth, 16))
                    if node:
                        evm = eng.eval_move(bb, mv, min(depth, 16))
                        drop = min(node[0]["cp"], MATE_SCORE - 2000) - min(evm["cp"], MATE_SCORE - 2000)
                        # long mating lines: the best move is a forced mate but the single-move search
                        # only sees "+8": both are decisive, so this is not an instructional error
                        decisive = node[0]["mate"] is not None and node[0]["mate"] > 0 and evm["cp"] >= 800
                        if drop > LINE_DROP and ann not in ("?", "??", "?!") and not decisive:
                            rep.err(where, f"{bb.fullmove_number}{'.' if bb.turn else '...'}{san} loses "
                                           f"{drop / 100:.2f} (engine {bb.san(chess.Move.from_uci(node[0]['move']))} "
                                           f"{fmt(node[0]['cp'])} vs {fmt(evm['cp'])}); annotate with ?/?? if intended")
                        if ann in ("?", "??") and drop < 60:
                            rep.warn(where, f"{san}{ann} marked as a mistake but engine drop is only {drop / 100:.2f}")
                    bb.push(mv)
    return n_boards, n_lines


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="*")
    ap.add_argument("--depth", type=int, default=18)
    ap.add_argument("--no-engine", action="store_true")
    ap.add_argument("--quiet", action="store_true", help="only print problems and summary")
    args = ap.parse_args()

    rep = Report()
    files = [pathlib.Path(f).resolve() for f in args.files]
    if not files:
        files = [p for p, _ in load_exercise_files()] + list(iter_chapters())
    eng = None
    stem = files[0].stem if len(files) == 1 else ("all" if not args.files else files[0].stem + "-plus")
    if not args.no_engine:
        eng = CachedEngine(depth=args.depth, cache_file=ROOT / "build" / "cache" / f"{stem}.json")
    seen = {}
    n_ex = n_boards = n_lines = 0
    try:
        for f in files:
            if f.suffix == ".json":
                data = json.loads(f.read_text())
                c = validate_exercise_file(f, data, eng, rep, args.depth, seen)
                n_ex += len(c["exercises"])
                if not args.quiet:
                    for ex in c["exercises"]:
                        e = ex.get("engine", {})
                        print(f"  {ex.get('id')}: {' '.join(ex.get('solution', []))}  "
                              f"[sol {e.get('solution_eval', '-')}, best {e.get('best', '-')} {e.get('best_eval', '-')}]"
                              f"  accept={ex.get('accept_by_ply', [[]])[0]}")
            elif f.suffix == ".md":
                nb, nl = validate_markdown(f, eng, rep, args.depth)
                n_boards += nb
                n_lines += nl
    finally:
        if eng:
            eng.close()
    for line in rep.errors + rep.warnings:
        print(line)
    print(f"\nSUMMARY: {n_ex} exercises, {n_boards} diagrams, {n_lines} move lines checked; "
          f"{len(rep.errors)} errors, {len(rep.warnings)} warnings")
    sys.exit(1 if rep.errors else 0)


if __name__ == "__main__":
    main()
