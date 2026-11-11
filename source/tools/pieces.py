#!/usr/bin/env python3
"""Generate the chess piece artwork used by the book and the trainer.

The silhouettes are vector outlines taken from the chess glyphs of the DejaVu Sans
font (Bitstream Vera / DejaVu licence — free to modify and redistribute; see
LICENSES.md). White pieces: the outline glyph (U+2654–2659) drawn in charcoal over an
ivory fill of its outer contours. Black pieces: the solid glyph (U+265A–265F) in
charcoal with the inner detail lines filled ivory so they read at small sizes.

Output: assets/pieces/{w,b}{K,Q,R,B,N,P}.svg and assets/pieces/pieces.json
(viewBox 0 0 100 100 path data, used by the diagram renderer and the web app).
"""
from __future__ import annotations

import json
import pathlib

from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
OUT = ROOT / "assets" / "pieces"

WHITE = {"K": 0x2654, "Q": 0x2655, "R": 0x2656, "B": 0x2657, "N": 0x2658, "P": 0x2659}
BLACK = {"K": 0x265A, "Q": 0x265B, "R": 0x265C, "B": 0x265D, "N": 0x265E, "P": 0x265F}

INK = "#262421"
IVORY = "#FBF8F1"


def contours(font, cp):
    gs = font.getGlyphSet()
    name = font.getBestCmap()[cp]
    rec = RecordingPen()
    gs[name].draw(rec)
    out, cur = [], []
    for op, args in rec.value:
        cur.append((op, args))
        if op in ("closePath", "endPath"):
            out.append(cur)
            cur = []
    if cur:
        out.append(cur)
    return out, gs


def bbox_of(contour):
    xs, ys = [], []
    for op, args in contour:
        for pt in args:
            xs.append(pt[0]); ys.append(pt[1])
    return min(xs), min(ys), max(xs), max(ys)


def signed_area(contour):
    pts = []
    for op, args in contour:
        if args:
            pts.append(args[-1])
    a = 0.0
    for i in range(len(pts)):
        x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % len(pts)]
        a += x1 * y2 - x2 * y1
    return a / 2


def to_path(contour_list, transform):
    pen = SVGPathPen(None)
    tp = TransformPen(pen, transform)
    for c in contour_list:
        for op, args in c:
            getattr(tp, op)(*args)
    import re
    cmds = pen.getCommands()
    return re.sub(r"-?\d+\.\d+", lambda m: f"{float(m.group()):.1f}".rstrip("0").rstrip("."), cmds)


def piece_group(v, color, ink=INK, ivory=IVORY):
    """SVG fragment (100x100 coordinate system) for one piece.

    Black: the glyph as designed (non-zero fill) over an ivory silhouette.
    White: an ivory silhouette with the glyph's detail lines inverted (even-odd of
    silhouette + glyph), so both colours share the same shape and details."""
    base = (f'<path d="{v["outer"]}" fill="{ivory}" stroke="{ink}" stroke-width="3" '
            f'stroke-linejoin="round"/>')
    if color == "w":
        return base + f'<path d="{v["outer"]} {v["all"]}" fill="{ink}" fill-rule="evenodd"/>'
    return base + f'<path d="{v["all"]}" fill="{ink}"/>'


def piece_svg(v, color):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{piece_group(v, color)}</svg>'


def main():
    font = TTFont(FONT)
    # common transform: fit all glyphs into a 100x100 box with the same scale/baseline
    allb = []
    for cp in list(WHITE.values()) + list(BLACK.values()):
        cs, _ = contours(font, cp)
        for c in cs:
            allb.append(bbox_of(c))
    minx = min(b[0] for b in allb); maxx = max(b[2] for b in allb)
    miny = min(b[1] for b in allb); maxy = max(b[3] for b in allb)
    size = max(maxx - minx, maxy - miny)
    scale = 88.0 / size
    pieces = {}
    for p, cp in BLACK.items():
        cs, _ = contours(font, cp)
        bxs = [bbox_of(c) for c in cs]
        gx0 = min(b[0] for b in bxs); gx1 = max(b[2] for b in bxs)
        dx = 50 - ((gx0 + gx1) / 2) * scale
        dy = 6 + maxy * scale
        transform = (scale, 0, 0, -scale, dx, dy)
        # outermost contours = silhouette (not nested inside another contour's bbox)
        def inside(i, j):
            bi, bj = bxs[i], bxs[j]
            return bj[0] <= bi[0] and bj[1] <= bi[1] and bj[2] >= bi[2] and bj[3] >= bi[3] and bi != bj
        outer = [c for i, c in enumerate(cs) if not any(inside(i, j) for j in range(len(cs)) if j != i)]
        pieces[p] = {"outer": to_path(outer, transform), "all": to_path(cs, transform)}
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "pieces.json").write_text(json.dumps(pieces))
    for p, v in pieces.items():
        for color in "wb":
            (OUT / f"{color}{p}.svg").write_text(piece_svg(v, color))
    print("wrote", len(pieces), "pieces to", OUT)


if __name__ == "__main__":
    main()
