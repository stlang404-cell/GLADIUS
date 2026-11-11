"""Cover artwork: a rising staircase of board squares (the five stages) crowned by a king.

cover_svg() returns the artwork (shapes only, no text) in a 700x1000 viewBox so it can be
placed full-bleed on a 7x10in page; cover_html() adds the typography as HTML.
"""
from __future__ import annotations

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PIECES = json.loads((ROOT / "assets" / "pieces" / "pieces.json").read_text())

BG = "#1E1C1A"
GOLD = "#C9A227"
GOLD_SOFT = "#8C7322"
IVORY = "#F4EDDC"


def cover_svg() -> str:
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 1000" preserveAspectRatio="xMidYMid slice">',
           f'<rect width="700" height="1000" fill="{BG}"/>']
    # faint full-board texture in the lower half
    sq = 46
    x0, y0 = 350 - 4 * sq, 520
    for r in range(8):
        for f in range(8):
            if (r + f) % 2 == 0:
                out.append(f'<rect x="{x0 + f * sq}" y="{y0 + r * sq}" width="{sq}" height="{sq}" '
                           f'fill="{IVORY}" opacity="0.035"/>')
    # staircase: 5 columns of squares, heights 1..5, alternating tones
    step_w = 48
    base_y = 905
    sx = 350 - 2.5 * step_w
    for i in range(5):
        h = i + 1
        for j in range(h):
            light = (i + j) % 2 == 0
            out.append(f'<rect x="{sx + i * step_w}" y="{base_y - (j + 1) * step_w}" width="{step_w}" '
                       f'height="{step_w}" fill="{GOLD if light else IVORY}" opacity="{0.92 if light else 0.14}"/>')
    # thin gold outline of the staircase
    pts = [(sx, base_y)]
    for i in range(5):
        pts += [(sx + i * step_w, base_y - (i + 1) * step_w), (sx + (i + 1) * step_w, base_y - (i + 1) * step_w)]
    pts += [(sx + 5 * step_w, base_y)]
    out.append('<polyline points="' + " ".join(f"{x},{y}" for x, y in pts) +
               f'" fill="none" stroke="{GOLD}" stroke-width="1.6"/>')
    # king on the top step
    v = PIECES["K"]
    kx, ky = sx + 4 * step_w - 6, base_y - 5 * step_w - 66
    out.append(f'<g transform="translate({kx},{ky}) scale(0.64)">'
               f'<path d="{v["outer"]}" fill="{GOLD}" stroke="{GOLD}" stroke-width="3" stroke-linejoin="round"/>'
               f'<path d="{v["all"]}" fill="{BG}" opacity="0.0"/>'
               f'<path d="{v["outer"]} {v["all"]}" fill="{BG}" fill-rule="evenodd" opacity="0.55"/></g>')
    # frame
    out.append(f'<rect x="28" y="28" width="644" height="944" fill="none" stroke="{GOLD}" stroke-width="1.2" opacity="0.8"/>')
    out.append(f'<rect x="36" y="36" width="628" height="928" fill="none" stroke="{GOLD}" stroke-width="0.5" opacity="0.5"/>')
    out.append("</svg>")
    return "".join(out)


COVER_CSS = """
.cover { position: relative; width: 7in; height: 10in; overflow: hidden; background: #1E1C1A; margin: 0; }
.cover .art { position: absolute; left: 0; top: 0; width: 7in; height: 10in; }
.cover .art svg { width: 7in; height: 10in; display: block; }
.cover .txt { position: absolute; left: 0.6in; right: 0.6in; top: 1.05in; hyphens: none; text-align: center; color: #F4EDDC; }
.cover .kicker { font-family: Inter, sans-serif; font-size: 9pt; letter-spacing: 0.42em; text-transform: uppercase;
                 color: #C9A227; margin: 0 0 0.32in; font-weight: 600; }
.cover .t1 { font-family: "Cormorant Garamond", Georgia, serif; font-weight: 500; font-size: 26pt; letter-spacing: 0.5em;
             margin: 0; color: #F4EDDC; text-transform: uppercase; padding-left: 0.5em; }
.cover .t2 { font-family: "Cormorant Garamond", Georgia, serif; font-weight: 700; font-size: 50pt; letter-spacing: 0.12em; hyphens: none; -webkit-hyphens: none; white-space: nowrap;
             margin: 0.04in 0 0; color: #F4EDDC; line-height: 1; text-transform: uppercase; padding-left: 0.14em; }
.cover .rule { width: 1.1in; height: 1.5pt; background: #C9A227; margin: 0.3in auto 0.26in; }
.cover .sub { font-family: "Cormorant Garamond", Georgia, serif; font-style: italic; font-size: 17pt; color: #E7DDC6;
              margin: 0; line-height: 1.3; }
.cover .range { font-family: Inter, sans-serif; font-size: 11pt; letter-spacing: 0.3em; color: #C9A227;
                margin-top: 0.24in; font-weight: 600; }
.cover .arr { font-family: "DejaVu Sans", sans-serif; font-weight: 400; }
.cover .foot { position: absolute; bottom: 0.62in; left: 0; right: 0; text-align: center; font-family: Inter, sans-serif;
               font-size: 7.5pt; letter-spacing: 0.32em; text-transform: uppercase; color: #B9AE98; }
"""


def cover_html(meta: dict) -> str:
    return (f'<div class="cover"><div class="art">{cover_svg()}</div><div class="txt">'
            f'<p class="kicker">A complete chess improvement system</p>'
            f'<p class="t1">The</p><p class="t2">Elo<br/>Blueprint</p><div class="rule"></div>'
            f'<p class="sub">Learn · Solve · Play · Analyze · Fix · Repeat</p>'
            f'<p class="range">400 <span class="arr">→</span> 1500</p></div>'
            f'<p class="foot">{meta.get("publisher", "")} · {meta.get("edition", "")}</p></div>')
