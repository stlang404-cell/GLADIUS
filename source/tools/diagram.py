"""SVG chess diagram renderer for the book (PDF + EPUB) and static web pages."""
from __future__ import annotations

import json
import math
import pathlib

import chess

ROOT = pathlib.Path(__file__).resolve().parent.parent
PIECES = json.loads((ROOT / "assets" / "pieces" / "pieces.json").read_text())

LIGHT = "#F3EBDC"
DARK = "#C2A57D"
INK = "#262421"
IVORY = "#FBF8F1"
FRAME = "#2E2B27"
GOLD = "#C9A227"
ARROW = {"arrows": "#2F7D4F", "red": "#B23A2E", "blue": "#2E5E8C"}

SQ = 100
MARGIN = 34  # room for coordinates


def _piece_defs(prefix: str, used: set[str]) -> str:
    out = []
    for key in sorted(used):
        color, p = key[0], key[1]
        v = PIECES[p]
        base = (f'<path d="{v["outer"]}" fill="{IVORY}" stroke="{INK}" stroke-width="3" '
                f'stroke-linejoin="round"/>')
        if color == "w":
            body = base + f'<path d="{v["outer"]} {v["all"]}" fill="{INK}" fill-rule="evenodd"/>'
        else:
            body = base + f'<path d="{v["all"]}" fill="{INK}"/>'
        out.append(f'<g id="{prefix}{key}">{body}</g>')
    return "".join(out)


def _arrow(x1, y1, x2, y2, color, knight=False):
    """Arrow from square centre to square centre (svg coords)."""
    width = 13
    head = 34
    parts = []
    if knight:
        # L-shaped: go along the longer leg first
        if abs(x2 - x1) > abs(y2 - y1):
            mx, my = x2, y1
        else:
            mx, my = x1, y2
        parts.append(f'<path d="M{x1:.1f},{y1:.1f} L{mx:.1f},{my:.1f}" stroke="{color}" stroke-width="{width}" '
                     f'stroke-linecap="round" fill="none" opacity="0.82"/>')
        x1, y1 = mx, my
    ang = math.atan2(y2 - y1, x2 - x1)
    ex, ey = x2 - math.cos(ang) * head * 0.9, y2 - math.sin(ang) * head * 0.9
    parts.append(f'<path d="M{x1:.1f},{y1:.1f} L{ex:.1f},{ey:.1f}" stroke="{color}" stroke-width="{width}" '
                 f'stroke-linecap="{"butt" if knight else "round"}" fill="none" opacity="0.82"/>')
    hx, hy = x2 - math.cos(ang) * 6, y2 - math.sin(ang) * 6
    bx, by = hx - math.cos(ang) * head, hy - math.sin(ang) * head
    px, py = -math.sin(ang) * head * 0.62, math.cos(ang) * head * 0.62
    parts.append(f'<path d="M{hx:.1f},{hy:.1f} L{bx + px:.1f},{by + py:.1f} L{bx - px:.1f},{by - py:.1f} Z" '
                 f'fill="{color}" opacity="0.82"/>')
    return "".join(parts)


def render(fen: str, arrows=(), red=(), blue=(), squares=(), orientation: str = "white",
           uid: str = "d", coords: bool = True, show_turn: bool = True, title: str | None = None,
           last_move: str | None = None) -> str:
    """Return a standalone SVG string for the position."""
    board = chess.Board() if fen in ("startpos", "start") else chess.Board(fen)
    flip = orientation == "black"
    total = 8 * SQ + 2 * MARGIN
    extra = 0
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
           f'viewBox="0 0 {total} {total + extra}" class="chessboard" role="img"'
           + (f' aria-label="{title}"' if title else "") + ">"]
    if title:
        out.append(f"<title>{title}</title>")
    used = set()
    for sq, pc in board.piece_map().items():
        used.add(("w" if pc.color else "b") + pc.symbol().upper())
    out.append(f"<defs>{_piece_defs(uid + '-', used)}</defs>")
    out.append(f'<rect x="0" y="0" width="{total}" height="{total}" fill="{IVORY}"/>')
    out.append(f'<rect x="{MARGIN - 7}" y="{MARGIN - 7}" width="{8 * SQ + 14}" height="{8 * SQ + 14}" '
               f'fill="{FRAME}" rx="3"/>')

    def xy(sq):
        f, r = chess.square_file(sq), chess.square_rank(sq)
        if flip:
            f, r = 7 - f, 7 - r
        return MARGIN + f * SQ, MARGIN + (7 - r) * SQ

    hl = set()
    for s in squares:
        hl.add(chess.parse_square(s))
    lm = set()
    if last_move:
        lm = {chess.parse_square(last_move[:2]), chess.parse_square(last_move[2:4])}
    for sq in chess.SQUARES:
        x, y = xy(sq)
        light = (chess.square_file(sq) + chess.square_rank(sq)) % 2 == 1
        out.append(f'<rect x="{x}" y="{y}" width="{SQ}" height="{SQ}" fill="{LIGHT if light else DARK}"/>')
        if sq in lm:
            out.append(f'<rect x="{x}" y="{y}" width="{SQ}" height="{SQ}" fill="#E8C766" opacity="0.45"/>')
        if sq in hl:
            out.append(f'<rect x="{x + 4}" y="{y + 4}" width="{SQ - 8}" height="{SQ - 8}" fill="none" '
                       f'stroke="{GOLD}" stroke-width="8" rx="4"/>')
    if board.is_check():
        ksq = board.king(board.turn)
        x, y = xy(ksq)
        out.append(f'<circle cx="{x + SQ / 2}" cy="{y + SQ / 2}" r="{SQ * 0.47}" fill="#C0392B" opacity="0.28"/>')
    for sq, pc in board.piece_map().items():
        x, y = xy(sq)
        key = ("w" if pc.color else "b") + pc.symbol().upper()
        out.append(f'<use xlink:href="#{uid}-{key}" href="#{uid}-{key}" '
                   f'transform="translate({x + 6},{y + 6}) scale(0.88)"/>')
    for kind, lst in (("blue", blue), ("red", red), ("arrows", arrows)):
        for a in lst:
            s1, s2 = chess.parse_square(a[:2]), chess.parse_square(a[2:4])
            x1, y1 = xy(s1); x2, y2 = xy(s2)
            df = abs(chess.square_file(s1) - chess.square_file(s2))
            dr = abs(chess.square_rank(s1) - chess.square_rank(s2))
            out.append(_arrow(x1 + SQ / 2, y1 + SQ / 2, x2 + SQ / 2, y2 + SQ / 2, ARROW[kind],
                              knight=sorted((df, dr)) == [1, 2]))
    if coords:
        files = "abcdefgh"
        for i in range(8):
            f = files[7 - i] if flip else files[i]
            r = str(i + 1) if flip else str(8 - i)
            out.append(f'<text x="{MARGIN + i * SQ + SQ / 2}" y="{total - 9}" text-anchor="middle" '
                       f'font-family="Inter, DejaVu Sans, sans-serif" font-size="21" fill="#6B655C">{f}</text>')
            out.append(f'<text x="{MARGIN / 2 - 3}" y="{MARGIN + i * SQ + SQ / 2 + 7}" text-anchor="middle" '
                       f'font-family="Inter, DejaVu Sans, sans-serif" font-size="21" fill="#6B655C">{r}</text>')
    if show_turn:
        # side-to-move marker at the right edge, on the mover's side of the board
        white_bottom = not flip
        mover_bottom = (board.turn == chess.WHITE) == white_bottom
        cy = MARGIN + 8 * SQ - 14 if mover_bottom else MARGIN + 14
        fill = "#FFFFFF" if board.turn == chess.WHITE else INK
        out.append(f'<circle cx="{total - MARGIN / 2 + 3}" cy="{cy}" r="9" fill="{fill}" '
                   f'stroke="{INK}" stroke-width="2.5"/>')
    out.append("</svg>")
    return "".join(out)


if __name__ == "__main__":
    svg = render("r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4",
                 arrows=["h5f7", "c4f7"], red=["f6h5"], squares=["f7"], blue=["g1f3", "b1c3"], uid="t")
    out = pathlib.Path("/tmp/claude-0/-home-user-GLADIUS/46658154-dfa0-5ff9-8036-21a7f1b4a01c/scratchpad/d.svg")
    out.write_text(svg)
    print(len(svg))
