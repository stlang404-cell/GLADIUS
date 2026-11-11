#!/usr/bin/env python3
"""Rasterize the vector cover to build/cover/cover.jpg (EPUB) and app icons."""
import pathlib, subprocess, sys
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from book import BUILD, ROOT, Book, esc  # noqa
from build_pdf import font_faces  # noqa
from cover import COVER_CSS, cover_html, cover_svg  # noqa

def main():
    out = BUILD / "cover"; out.mkdir(parents=True, exist_ok=True)
    meta = Book().meta
    css = font_faces() + COVER_CSS + "html,body{margin:0;padding:0;} .cover{width:672px;height:960px;} " \
          ".cover .art,.cover .art svg{width:672px;height:960px;}"
    css = css.replace("7in", "672px").replace("10in", "960px")
    page = out / "cover.html"
    page.write_text(f"<!DOCTYPE html><html><head><meta charset='utf-8'><style>{css}</style></head><body>{cover_html(meta)}</body></html>")
    png = out / "cover.png"
    subprocess.run(["node", str(ROOT / "tools" / "rasterize.js"), str(page), str(png), "672", "960", "2.5"], check=True)
    im = Image.open(png).convert("RGB")
    im.save(out / "cover.jpg", quality=88, optimize=True, progressive=True)
    im.resize((420, 600), Image.LANCZOS).save(out / "cover-small.jpg", quality=86, optimize=True)
    # app icon: king on staircase crop -> square icon from a dedicated svg
    icon_svg = out / "icon.html"
    import json
    P = json.loads((ROOT / "assets" / "pieces" / "pieces.json").read_text())["K"]
    svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">'
           f'<rect width="512" height="512" fill="#1E1C1A"/>'
           + "".join(f'<rect x="{116 + i * 56}" y="{440 - (j + 1) * 56}" width="56" height="56" '
                     f'fill="{"#C9A227" if (i + j) % 2 == 0 else "#3A352E"}"/>' for i in range(5) for j in range(i + 1))
           + f'<g transform="translate(323,72) scale(0.9)"><path d="{P["outer"]}" fill="#C9A227" stroke="#C9A227" '
             f'stroke-width="3"/><path d="{P["outer"]} {P["all"]}" fill="#1E1C1A" fill-rule="evenodd" opacity="0.55"/></g></svg>')
    icon_svg.write_text(f"<!DOCTYPE html><html><body style='margin:0'>{svg}</body></html>")
    (out / "icon.svg").write_text(svg)
    big = out / "icon-512.png"
    subprocess.run(["node", str(ROOT / "tools" / "rasterize.js"), str(icon_svg), str(big), "512", "512", "1"], check=True)
    ic = Image.open(big).convert("RGB")
    for s in (192, 180, 32):
        ic.resize((s, s), Image.LANCZOS).save(out / f"icon-{s}.png", optimize=True)
    print("cover + icons in", out)

if __name__ == "__main__":
    main()
