"""Book model and HTML rendering shared by the PDF, EPUB and web builds.

render modes:
  pdf  - inline SVG diagrams, page-number cross references
  epub - diagrams written to image files, XHTML-safe output
  web  - inline SVG with data-fen hooks for the interactive trainer
"""
from __future__ import annotations

import html
import json
import pathlib
import re

import chess
import markdown
import yaml

from chessfmt import (EXERCISES, MANUSCRIPT, ROOT, board_from, iter_blocks, parse_front, parse_kv,
                      play_sans, tokenize_moves)
from diagram import render as render_svg

BUILD = ROOT / "build"

BOX_LABELS = {
    "key": "Key idea", "cheat": "Cheat code", "mistake": "Common mistake",
    "nextgame": "In your next game", "evidence": "Evidence", "coach": "Coaching judgment",
    "drill": "Board drill", "example": "Worked example", "note": "Note",
}
TYPE_LABELS = {
    "tactic": "Tactic", "mate": "Checkmate", "defense": "Defence", "blunder-check": "Blunder check",
    "opening": "Opening", "endgame": "Endgame", "quiet": "Quiet move", "strategy": "Strategy",
    "evaluation": "Evaluation", "counting": "Counting", "rules": "Rules", "vision": "Board vision",
    "conversion": "Conversion", "calculation": "Calculation",
}
STAGE_OF_PART = {}


# ----------------------------------------------------------------------------- helpers
def esc(s: str) -> str:
    return html.escape(s, quote=True)


def ex_label(ex_id: str) -> str:
    a, b = ex_id.split("-")
    a = a if a.startswith("T") else str(int(a))
    return f"{a}.{int(b)}"


def format_line(board: chess.Board, moves: list[chess.Move], anns: list[str] | None = None,
                web: bool = False) -> str:
    """SAN with correct move numbers; optional per-move FEN hooks for the web app."""
    b = board.copy()
    parts = []
    anns = anns or [""] * len(moves)
    for i, (mv, ann) in enumerate(zip(moves, anns)):
        san = b.san(mv)
        num = ""
        if b.turn == chess.WHITE:
            num = f"{b.fullmove_number}."
        elif i == 0:
            num = f"{b.fullmove_number}…"
        b.push(mv)
        text = esc(san + ann)
        if web:
            text = f'<span class="mv" data-fen="{esc(b.fen())}" data-uci="{mv.uci()}">{text}</span>'
        parts.append(f'<span class="mn">{num}</span>{text}' if num else text)
    return " ".join(parts)


def describe_position(board: chess.Board) -> str:
    """Accessible alt text: side to move and piece list."""
    names = {"K": "K", "Q": "Q", "R": "R", "B": "B", "N": "N", "P": ""}
    def side(color):
        items = []
        for pt in (chess.KING, chess.QUEEN, chess.ROOK, chess.BISHOP, chess.KNIGHT, chess.PAWN):
            for sq in sorted(board.pieces(pt, color)):
                items.append(names[chess.piece_symbol(pt).upper()] + chess.square_name(sq))
        return ", ".join(items)
    return (f"Chess diagram. {'White' if board.turn else 'Black'} to move. "
            f"White: {side(chess.WHITE)}. Black: {side(chess.BLACK)}.")


class Diagrams:
    """Collects diagrams; inline SVG (pdf/web) or files (epub)."""

    def __init__(self, mode: str, img_dir: pathlib.Path | None = None, img_prefix: str = "images/"):
        self.mode = mode
        self.n = 0
        self.img_dir = img_dir
        self.img_prefix = img_prefix
        self.files = []

    def figure(self, fen, caption_html="", arrows=(), red=(), blue=(), squares=(), orientation="white",
               cls="diagram", label_html="", last_move=None):
        self.n += 1
        uid = f"g{self.n}"
        board = board_from(fen)
        if self.mode == "web":
            j = lambda xs: " ".join(xs)  # noqa: E731
            cap = f"<figcaption>{label_html}{caption_html}</figcaption>" if (caption_html or label_html) else ""
            return (f'<figure class="{cls}" data-fen="{esc(board.fen())}" data-orientation="{orientation}" '
                    f'data-arrows="{j(arrows)}" data-red="{j(red)}" data-blue="{j(blue)}" data-squares="{j(squares)}" '
                    f'data-lastmove="{last_move or ""}"><div class="board-wrap" role="img" '
                    f'aria-label="{esc(describe_position(board))}"></div>{cap}</figure>')
        alt = describe_position(board)
        svg = render_svg(board.fen(), arrows=arrows, red=red, blue=blue, squares=squares,
                         orientation=orientation, uid=uid, title=None, last_move=last_move)
        if self.mode == "epub":
            name = f"d{self.n:04d}.svg"
            (self.img_dir / name).write_text(svg)
            self.files.append(name)
            pic = f'<img src="{self.img_prefix}{name}" alt="{esc(alt)}" class="board-img"/>'
        else:
            pic = svg.replace("<svg ", f'<svg aria-label="{esc(alt)}" ', 1)
        data = f' data-fen="{esc(board.fen())}" data-orientation="{orientation}"' if self.mode == "web" else ""
        cap = f"<figcaption>{label_html}{caption_html}</figcaption>" if (caption_html or label_html) else ""
        return f'<figure class="{cls}"{data}><div class="board-wrap">{pic}</div>{cap}</figure>'


def md_inline(text: str) -> str:
    out = markdown.markdown(text, extensions=["smarty"])
    return re.sub(r"^<p>(.*)</p>$", r"\1", out.strip(), flags=re.S)


def md_block(text: str) -> str:
    return markdown.markdown(text, extensions=["tables", "sane_lists", "smarty", "attr_list"])


def strip_tags(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s)


# ----------------------------------------------------------------------------- model
class Book:
    def __init__(self):
        self.meta = yaml.safe_load((MANUSCRIPT / "book.yaml").read_text())
        self.chapters = {}
        for p in sorted((MANUSCRIPT / "chapters").glob("*.md")):
            front, body = parse_front(p.read_text())
            front["body"] = body
            front["path"] = p
            self.chapters[int(front["chapter"])] = front
        self.docs = {}
        for sub in ("front", "back"):
            d = MANUSCRIPT / sub
            if d.exists():
                for p in sorted(d.glob("*.md")):
                    front, body = parse_front(p.read_text())
                    front["body"] = body
                    self.docs[front.get("slug", p.stem)] = front
        self.sets = {}
        for p in sorted(EXERCISES.glob("*.json")):
            compiled = BUILD / "compiled" / p.name
            src = compiled if compiled.exists() and compiled.stat().st_mtime >= p.stat().st_mtime else p
            data = json.loads(src.read_text())
            self.sets[str(data["chapter"])] = data
        for part in self.meta["parts"]:
            for c in part["chapters"]:
                STAGE_OF_PART[c] = part["stage"]

    def exercise_set(self, key) -> dict | None:
        return self.sets.get(str(key))

    def all_exercises(self):
        for key, s in self.sets.items():
            for ex in s["exercises"]:
                yield key, ex


# ----------------------------------------------------------------------------- markdown with chess blocks
BOX_RE = re.compile(r"^:::(\w+)[ \t]*(.*?)\n(.*?)^:::[ \t]*$", re.S | re.M)


class Renderer:
    def __init__(self, book: Book, mode: str, diagrams: Diagrams):
        self.book = book
        self.mode = mode
        self.dg = diagrams
        self.cheats = []  # (chapter, title, html)

    # -- chess blocks
    def board_block(self, kv):
        sp = lambda k: kv.get(k, "").replace(",", " ").split()  # noqa: E731
        return self.dg.figure(kv["fen"], md_inline(kv.get("caption", "")), arrows=sp("arrows"), red=sp("red"),
                              blue=sp("blue"), squares=sp("squares") + sp("marks"),
                              orientation=kv.get("orientation", "white"))

    def line_block(self, kv):
        board = board_from(kv.get("fen", "startpos"))
        toks = tokenize_moves(kv.get("moves", ""))
        moves = play_sans(board, [t for t, _ in toks])
        line_html = format_line(board, moves, [a for _, a in toks], web=self.mode == "web")
        data = f' data-start="{esc(board.fen())}"' if self.mode == "web" else ""
        out = f'<div class="line"{data}><p class="moves">{line_html}</p>'
        if kv.get("diagram", "").lower() in ("end", "yes", "true"):
            b = board.copy()
            for m in moves:
                b.push(m)
            out += self.dg.figure(b.fen(), md_inline(kv.get("caption", "")),
                                  orientation=kv.get("orientation", "white"),
                                  last_move=moves[-1].uci() if moves else None)
        elif kv.get("caption"):
            out += f'<p class="line-caption">{md_inline(kv["caption"])}</p>'
        return out + "</div>"

    def render_body(self, text: str, chapter: int | None = None) -> str:
        """Markdown + chess blocks + boxes -> HTML."""
        stash = {}

        def put(h):
            k = f"XSTASHX{len(stash)}X"
            stash[k] = h
            return f"\n\n{k}\n\n"

        def fence(m):
            kind, body = m.group(1), m.group(2)
            kv = parse_kv(body)
            return put(self.board_block(kv) if kind == "board" else self.line_block(kv))

        text = re.sub(r"^```(board|line)\s*\n(.*?)^```\s*$", fence, text, flags=re.S | re.M)

        def box(m):
            kind, title, inner = m.group(1), m.group(2).strip(), m.group(3)
            inner_html = self.render_body(inner, chapter)
            label = BOX_LABELS.get(kind, kind.title())
            if kind == "cheat" and chapter is not None:
                self.cheats.append((chapter, title, inner_html))
            t = f'<span class="box-title">{md_inline(title)}</span>' if title else ""
            return put(f'<aside class="box box-{kind}"><p class="box-head"><span class="box-label">'
                       f'{label}</span>{t}</p>{inner_html}</aside>')

        text = BOX_RE.sub(box, text)
        text = text.replace("@exercises", "")
        out = md_block(text)
        for k, v in stash.items():
            out = out.replace(f"<p>{k}</p>", v).replace(k, v)
        return out

    # -- chapter
    def chapter_html(self, n: int) -> str:
        ch = self.book.chapters[n]
        cid = f"ch-{n:02d}"
        body = self.render_body(ch["body"], n)
        body = self.number_headings(body, cid)
        obj = "".join(f"<li>{md_inline(o)}</li>" for o in ch.get("objectives", []))
        sub = f'<p class="chapter-subtitle">{esc(ch.get("subtitle", ""))}</p>' if ch.get("subtitle") else ""
        opener = (f'<header class="chapter-opener"><p class="chapter-kicker">Chapter {n}'
                  f'<span class="stage-badge">Stage {esc(str(ch.get("stage", "")))}</span></p>'
                  f'<h1 class="chapter-title" id="{cid}">{esc(ch["title"])}</h1>{sub}'
                  f'<div class="objectives"><p class="obj-head">You will learn to</p><ul>{obj}</ul></div>'
                  + (f'<aside class="box box-nextgame opener-next"><p class="box-head"><span class="box-label">'
                     f'In your next game</span></p><p>{md_inline(ch["next_game"])}</p></aside>'
                     if ch.get("next_game") else "") + "</header>")
        ex = self.exercises_html(n)
        return f'<section class="chapter" id="sec-{cid}" data-chapter="{n}">{opener}{body}{ex}</section>'

    @staticmethod
    def number_headings(body, cid):
        count = {"n": 0}

        def h2(m):
            count["n"] += 1
            attrs, inner = m.group(1), m.group(2)
            return f'<h2 id="{cid}-{count["n"]}"{attrs}>{inner}</h2>'
        body = re.sub(r"<h2([^>]*)>(.*?)</h2>", h2, body)
        return body

    # -- exercises
    def exercise_card(self, ex, web=False):
        board = chess.Board(ex["fen"])
        orient = "white" if board.turn == chess.WHITE else "black"
        dots = "●" * ex["difficulty"] + "○" * (5 - ex["difficulty"])
        lab = ex_label(ex["id"])
        head = (f'<span class="ex-num">{lab}</span><span class="ex-type">{TYPE_LABELS.get(ex["type"], ex["type"])}'
                f'</span><span class="ex-diff" title="difficulty {ex["difficulty"]} of 5">{dots}</span>')
        fig = self.dg.figure(ex["fen"], "", orientation=orient, cls="diagram ex-diagram")
        sol_link = ""
        if self.mode == "pdf":
            sol_link = f'<a class="sol-link" href="#sol-{ex["id"]}">Solution</a>'
        elif self.mode == "epub":
            sol_link = f'<a class="sol-link" href="#sol-{ex["id"]}">Solution</a>'
        return (f'<div class="exercise" id="ex-{ex["id"]}"><p class="ex-head">{head}</p>{fig}'
                f'<p class="ex-q">{md_inline(ex["question"])} {sol_link}</p></div>')

    def exercises_html(self, key, heading="Exercises", intro=None):
        s = self.book.exercise_set(key)
        if not s:
            return ""
        is_test = str(key).startswith("T")
        sid = f"ex-set-{key}"
        intro = intro or ("Set up each position on a board or solve it from the diagram. Decide on your move "
                          "<em>and</em> the opponent's best reply before you check. Record your result: "
                          "first-try correct, correct after the hint, or missed.")
        cl = [self.exercise_card(ex) for ex in s["exercises"]]
        if self.mode == "pdf":
            rows = []
            for i in range(0, len(cl), 2):
                pair = cl[i:i + 2] + ([""] if len(cl[i:i + 2]) == 1 else [])
                rows.append("<tr>" + "".join(f'<td class="ex-cell">{c}</td>' for c in pair) + "</tr>")
            cards = f'<table class="ex-table">{"".join(rows)}</table>'
        else:
            cards = "".join(cl)
        hints = "".join(f'<li><span class="ex-num">{ex_label(ex["id"])}</span> {md_inline(ex["hint"])}</li>'
                        for ex in s["exercises"] if ex.get("hint"))
        hints_html = (f'<div class="hints"><p class="hints-head">Hints</p><ul>{hints}</ul></div>' if hints else "")
        tag = "h1" if is_test else "h2"
        return (f'<section class="exercise-set" id="{sid}"><{tag} class="ex-set-title" id="{sid}-h">{heading}</{tag}>'
                f'<p class="ex-intro">{intro}</p><div class="ex-grid">{cards}</div>{hints_html}</section>')

    def solution_html(self, ex):
        board = chess.Board(ex["fen"])
        moves = play_sans(board, ex["solution"])
        line = format_line(board, moves)
        acc = [a for a in ex.get("accept_by_ply", [[]])[0] if a != ex["solution"][0]] if ex.get("accept_by_ply") else []
        acc += [a for a in ex.get("accept", []) if a not in acc]
        acc_html = (f'<p class="sol-alt"><strong>Also correct:</strong> {esc(", ".join(acc))}</p>' if acc else "")
        wrong = "".join(f'<li><strong>{esc(w["move"])}?</strong> {md_inline(w["why"])}</li>'
                        for w in ex.get("wrong", []))
        wrong_html = f'<div class="sol-wrong"><p class="sol-wrong-head">Tempting but wrong</p><ul>{wrong}</ul></div>' if wrong else ""
        back = ""
        if self.mode == "pdf":
            back = f'<a class="back-link" href="#ex-{ex["id"]}">Exercise {ex_label(ex["id"])}</a>'
        elif self.mode == "epub":
            back = f'<a class="back-link" href="#ex-{ex["id"]}">↩ Exercise</a>'
        return (f'<div class="solution" id="sol-{ex["id"]}"><p class="sol-head"><span class="ex-num">'
                f'{ex_label(ex["id"])}</span> <span class="sol-line">{line}</span>{back}</p>'
                f'<p class="sol-expl">{md_inline(ex["explanation"])}</p>{acc_html}{wrong_html}'
                f'<p class="sol-obj"><span>Skill:</span> {md_inline(ex["objective"])}</p></div>')

    def solutions_section(self, key, title):
        s = self.book.exercise_set(key)
        if not s:
            return ""
        items = "".join(self.solution_html(ex) for ex in s["exercises"])
        return f'<section class="sol-set" id="sol-set-{key}"><h2 id="sol-set-{key}-h">{esc(title)}</h2>{items}</section>'

    # -- docs
    def doc_html(self, slug, cls="doc"):
        d = self.book.docs[slug]
        body = self.render_body(d["body"])
        body = self.number_headings(body, f"doc-{slug}")
        return (f'<section class="{cls}" id="doc-{slug}"><h1 class="doc-title" id="{slug}">{esc(d["title"])}</h1>'
                f'{body}</section>')
