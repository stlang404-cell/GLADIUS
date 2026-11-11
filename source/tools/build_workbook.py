#!/usr/bin/env python3
"""Build THE-90-DAY-CHESS-ACCELERATOR.pdf from build/plan/plan.json + plan/accelerator-intro.md."""
from __future__ import annotations

import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from book import BUILD, ROOT, Book, Diagrams, Renderer, esc, ex_label  # noqa: E402
from build_pdf import font_faces  # noqa: E402
from chessfmt import parse_front  # noqa: E402
from cover import COVER_CSS, cover_svg  # noqa: E402

CATS = ["hanging-piece", "missed-tactic", "missed-mate", "king-safety", "calculation", "opening", "endgame",
        "missed-win", "conversion", "positional", "time-psychology"]
KIND = {"learn": "Learn", "solve": "Solve", "play": "Play", "analyze": "Analyze", "fix": "Fix",
        "review": "Review", "test": "Test"}

CSS = """
@page { size: letter; margin: 0.6in 0.65in 0.65in; background: #FFFFFF;
  @top-right { content: string(dayhead); font-family: Inter, sans-serif; font-size: 7pt; letter-spacing: 0.15em;
               text-transform: uppercase; color: #8B8378; }
  @bottom-center { content: counter(page); font-family: Inter, sans-serif; font-size: 8pt; color: #57514A; } }
@page cover { margin: 0; background: #1E1C1A; @top-right { content: none; } @bottom-center { content: none; } }
html { font-size: 9.6pt; }
body { margin: 0; }
.cover { page: cover; width: 8.5in; height: 11in; }
.cover .art, .cover .art svg { width: 8.5in; height: 11in; }
.cover .txt { top: 1.4in; }
.cover .t2 { font-size: 40pt; }
.cover .foot { bottom: 0.3in; }
.intro { break-before: page; }
.intro h1 { font-size: 2.4em; bookmark-level: 1; string-set: dayhead "How it works"; margin-top: 0; }
.intro h2 { bookmark-level: 2; }
.intro .box { break-inside: avoid; }
.overview { break-before: page; }
.overview h1 { bookmark-level: 1; string-set: dayhead "Overview"; margin-top: 0; }
.overview table { font-size: 7pt; margin: 0; }
.overview td, .overview th { padding: 0.008in 0.04in; line-height: 1.2; }
.day { break-before: page; }
.day-head { border-bottom: 2px solid #B08D2E; padding-bottom: 0.06in; margin-bottom: 0.1in; }
.day-kicker { font-family: Inter, sans-serif; font-size: 7.5pt; letter-spacing: 0.16em; text-transform: uppercase; color: #7E6219; margin: 0; font-weight: 600; }
.day-title { font-size: 21pt; margin: 0.02in 0 0; border: none; bookmark-level: 2; }
.stage-h { bookmark-level: 1; bookmark-label: attr(data-label); }
.focus { display: block; margin: 0 0 0.08in; }
.focus p { margin: 0 0 0.04in; }
.lbl { font-family: Inter, sans-serif; font-size: 7pt; letter-spacing: 0.12em; text-transform: uppercase; color: #7E6219; font-weight: 700; margin-right: 0.4em; }
.opts { width: 100%; border-collapse: separate; border-spacing: 0.06in 0; margin: 0.06in -0.06in 0.1in; table-layout: fixed; }
.opts td { background: #F5EFE2; border-radius: 4px; padding: 0.06in 0.07in; vertical-align: top; font-size: 7.9pt; border: none; line-height: 1.3; }
.opts th { background: none; font-family: Inter, sans-serif; font-size: 7.5pt; letter-spacing: 0.1em; color: #2A2724; border: none; padding: 0 0.07in 0.03in; }
.task { margin: 0 0 0.05in; padding-left: 0.16in; text-indent: -0.16in; }
.task .k { font-family: Inter, sans-serif; font-size: 6.6pt; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #7E6219; }
.box2 { border: 1px solid #CFC3A8; border-radius: 4px; padding: 0.08in 0.12in; margin-bottom: 0.1in; }
.rec { width: 100%; font-size: 8.6pt; }
.rec td { border-bottom: 1px solid #DDD3BE; height: 0.3in; vertical-align: bottom; padding: 0.02in 0.04in; }
.cats { font-size: 7.6pt; line-height: 1.9; }
.cats span { display: inline-block; margin-right: 0.14in; white-space: nowrap; }
.write { border-bottom: 1px solid #DDD3BE; height: 0.34in; }
.bench li { margin-bottom: 0.08in; }
.chk { font-family: "DejaVu Sans", sans-serif; }
.grid td { border: 1px solid #DDD3BE; height: 0.27in; }
.grid th { font-size: 7pt; }
.records { break-before: page; }
.records h1 { bookmark-level: 1; margin-top: 0; string-set: dayhead content(text); }
.phase2 { break-before: page; }
.phase2 h1 { bookmark-level: 1; margin-top: 0; string-set: dayhead "Phase Two"; }
.chart { width: 100%; }
"""


def chk():
    return '<span class="chk">☐</span>'


def tasks_html(opts):
    cells = []
    for k in ("15", "30", "60", "90"):
        items = "".join(f'<p class="task">{chk()} <span class="k">{KIND.get(t["kind"], t["kind"])}</span> '
                        f'{esc(t["text"])}</p>' for t in opts.get(k, []))
        cells.append(f"<td>{items}</td>")
    return ('<table class="opts"><tr><th>15 MIN</th><th>30 MIN</th><th>60 MIN</th><th>90 MIN</th></tr>'
            f'<tr>{"".join(cells)}</tr></table>')


def record_box(weekly=False):
    cats = "".join(f"<span>{chk()} {c}</span>" for c in CATS)
    return (f'<div class="box2"><p><span class="lbl">Record</span> Date ____________  Option used: 15 / 30 / 60 / 90</p>'
            f'<table class="rec"><tr><td>Exercises attempted: ____  First-try correct: ____  With hint: ____</td></tr>'
            f'<tr><td>Game: result W / D / L · time control ______ · opening ______________________</td></tr></table>'
            f'<p style="margin-top:0.08in"><span class="lbl">Mistakes today</span></p><p class="cats">{cats}</p>'
            f'<p><span class="lbl">One thing I learned</span></p><div class="write"></div>'
            f'<p style="margin-top:0.06in"><span class="lbl">Tomorrow I will</span></p><div class="write"></div></div>')


def day_page(d, book, plan):
    stage_bm = ""
    if d["day"] in (1, 22, 50, 71):
        stage_bm = (f'<span class="stage-h" data-label="Stage {d["stage"]} · {esc(d["range"])} (days '
                    f'{d["day"]}–)"></span>')
    head = (f'<div class="day-head">{stage_bm}<p class="day-kicker">Day {d["day"]} · Week {d["week"]} · Stage {d["stage"]} '
            f'({esc(d["range"])})</p><h1 class="day-title" style="string-set: dayhead \'Day {d["day"]}\'">'
            f'Day {d["day"]} — {esc(d["title"])}</h1></div>')
    body = []
    if d["type"] in ("study", "consolidate"):
        read = "; ".join(d.get("read") or []) or "chapter summary and cheat code"
        exs = ", ".join(ex_label(e) for e in d.get("exercises", [])) or "review queue"
        body.append(f'<div class="focus"><p><span class="lbl">Read</span> Chapter {d["chapter"]}: {esc(read)}</p>'
                    f'<p><span class="lbl">Solve</span> Exercises {esc(exs)}</p>'
                    f'<p><span class="lbl">Play with this focus</span> {esc(d.get("game_focus", ""))}</p></div>')
        body.append(tasks_html(d["options"]))
        body.append(record_box())
    else:
        chs = ", ".join(str(c) for c in d.get("chapters", []))
        exs = ", ".join(ex_label(e) for e in d.get("check_exercises", []))
        body.append(f'<div class="focus"><p><span class="lbl">This week</span> Chapters {esc(chs)}</p>'
                    + (f'<p><span class="lbl">Re-test</span> {esc(exs)} — solve cold, no hints.</p>' if exs else "")
                    + (f'<p><span class="lbl">Milestone</span> Stage {d["stage"]} Test ({esc(d["test"])}, 15 positions, '
                       f'in the book after Part {d["stage"]}).</p>' if d.get("test") else "") + "</div>")
        body.append(tasks_html(d["options"]))
        rows = "".join(f"<tr><td>Chapter {c}</td><td></td><td></td><td></td></tr>" for c in d.get("chapters", []))
        body.append('<div class="box2"><p><span class="lbl">Weekly evaluation</span></p>'
                    '<table class="grid"><tr><th>Chapter</th><th>Exercises first-try %</th><th>Re-test score</th>'
                    f'<th>Decision (continue / review / repeat)</th></tr>{rows}</table>'
                    '<p>Games this week: W ___ D ___ L ___   ·   Online rating now: ______</p>'
                    '<p><span class="lbl">Top 3 mistake categories (frequency × cost)</span></p>'
                    '<div class="write"></div><div class="write"></div><div class="write"></div>'
                    '<p style="margin-top:0.06in"><span class="lbl">Adaptation for next week (see "Weekly evaluation and adaptation")</span></p>'
                    '<div class="write"></div></div>')
        if d.get("test"):
            bench = plan["benchmarks"].get(str(d["day"]), [])
            items = "".join(f"<li>{chk()} {esc(b)}</li>" for b in bench)
            body.append(f'<div class="box2"><p><span class="lbl">Milestone benchmarks</span> Stage test score: ____ / 15</p>'
                        f'<ul class="bench" style="list-style:none;padding-left:0">{items}</ul>'
                        '<p>If you meet most benchmarks, start the next stage. If not, repeat the weakest '
                        'chapter\'s consolidation day and re-take the test in a week.</p></div>')
    return f'<section class="day">{head}{"".join(body)}</section>'


def overview(plan):
    rows = []
    for d in plan["days"]:
        rows.append(f'<tr><td>{d["day"]}</td><td>{d["week"]}</td><td>{d["stage"]}</td><td>{esc(d["title"])}</td>'
                    f'<td>{chk()}</td></tr>')
    half = (len(rows) + 1) // 2
    t = lambda rs: ('<table><tr><th>Day</th><th>Wk</th><th>St</th><th>Session</th><th>Done</th></tr>'  # noqa: E731
                    + "".join(rs) + "</table>")
    return (f'<section class="overview"><h1>The 90 days at a glance</h1><table style="table-layout:fixed">'
            f'<tr><td style="border:none;padding-right:0.15in;vertical-align:top">{t(rows[:half])}</td>'
            f'<td style="border:none;vertical-align:top">{t(rows[half:])}</td></tr></table></section>')


def records():
    game_rows = "".join("<tr>" + "<td></td>" * 7 + "</tr>" for _ in range(26))
    games = ('<section class="records"><h1>Game log</h1><p>One row per slow game. "Turning point" = the move number '
             'where the evaluation changed most (fill in after your own analysis).</p><table class="grid"><tr>'
             '<th>Date</th><th>Colour</th><th>Opening</th><th>Result</th><th>Time ctrl</th><th>Turning point</th>'
             f'<th>Mistake categories</th></tr>{game_rows}</table></section>')
    j_rows = "".join("<tr>" + "<td></td>" * 6 + "</tr>" for _ in range(22))
    journal = ''.join(f'<section class="records"><h1>Mistake journal {i}</h1><p>Write the position (FEN or a sketch) '
                      'only when you want to re-solve it; the trainer can do this for you automatically.</p>'
                      '<table class="grid"><tr><th>Date</th><th>Game / move</th><th>What I played</th>'
                      '<th>What was better</th><th>Category</th><th>Lesson (one sentence)</th></tr>'
                      f'{j_rows}</table></section>' for i in (1, 2, 3))
    w_rows = "".join(f"<tr><td>{i}</td>" + "<td></td>" * 5 + "</tr>" for i in range(1, 9))
    weak = ('<section class="records"><h1>Weakness list</h1><p>Rank categories by <strong>frequency × cost</strong> '
            '(cost: 1 = small inaccuracy, 2 = lost a pawn, 3 = lost a piece or the game). Work on the top item for a '
            'week, then re-rank.</p><table class="grid"><tr><th>#</th><th>Category</th><th>Count (4 wks)</th>'
            f'<th>Avg cost</th><th>Score</th><th>Remedial plan</th></tr>{w_rows}</table>')
    weeks = "".join(f"<th>W{i}</th>" for i in range(1, 14))
    pct_rows = "".join(f"<tr><th>{p}%</th>" + "<td></td>" * 13 + "</tr>" for p in range(100, -1, -10))
    weak += ('<h1 style="margin-top:0.3in">Progress chart</h1><p>Each week, mark your first-try exercise accuracy with '
             'a dot and connect the dots. Mark your rating in the bottom rows.</p>'
             f'<table class="grid chart"><tr><th></th>{weeks}</tr>{pct_rows}'
             f'<tr><th>Rating</th>{"<td></td>" * 13}</tr><tr><th>Games</th>{"<td></td>" * 13}</tr></table></section>')
    return games + journal + weak


def phase_two():
    rows = [(24, "Advanced Tactics and Calculation"), (25, "Middlegame Strategy"), (26, "Endgame Technique"),
            (27, "Practical Play and Psychology"), (28, "Analyzing Your Games and Training for Life")]
    trs = "".join(f"<tr><td>{(i * 7) + 1}–{(i + 1) * 7}</td><td>Chapter {n} · {esc(t)}</td>"
                  f"<td>Days 1–3 read + exercises; days 4–6 exercises, games, analysis; day 7 evaluation</td></tr>"
                  for i, (n, t) in enumerate(rows))
    return ('<section class="phase2"><h1>Phase Two: Stage 5 (1200–1500)</h1>'
            '<p>After day 90, continue with the same daily structure for five more weeks, one chapter per week, '
            'then take the Stage 5 Test. From then on, use the training plan in Chapter 28: two to four slow games '
            'a week with full self-analysis, daily mixed review from your journal and the trainer\'s queue, and one '
            'study theme per month chosen from your weakness list.</p>'
            f'<table><tr><th>Days</th><th>Chapter</th><th>Pattern</th></tr>{trs}</table></section>')


def build_html():
    book = Book()
    plan = json.loads((BUILD / "plan" / "plan.json").read_text())
    r = Renderer(book, "pdf", Diagrams("pdf"))
    _, intro = parse_front((ROOT / "plan" / "accelerator-intro.md").read_text())
    cover = (f'<div class="cover" style="position:relative;overflow:hidden;background:#1E1C1A"><div class="art" '
             f'style="position:absolute;left:0;top:0">{cover_svg()}</div><div class="txt"><p class="kicker">'
             f'A companion to The Elo Blueprint</p><p class="t1">The 90-Day</p><p class="t2">Chess<br/>Accelerator</p>'
             f'<div class="rule"></div><p class="sub">Daily assignments · weekly evaluations · practice records</p>'
             f'<p class="range">Day 1 <span class="arr">→</span> Day 90</p></div>'
             f'<p class="foot">{esc(book.meta["publisher"])}</p></div>')
    intro_html = f'<section class="intro"><h1>How to use this workbook</h1>{r.render_body(intro)}</section>'
    days = "".join(day_page(d, book, plan) for d in plan["days"])
    css = font_faces() + (ROOT / "assets" / "css" / "book-base.css").read_text() + COVER_CSS + CSS
    return (f'<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>The 90-Day Chess Accelerator</title>'
            f'<meta name="author" content="{esc(book.meta["publisher"])}"/><style>{css}</style></head><body>'
            f'{cover}{intro_html}{overview(plan)}{days}{records()}{phase_two()}</body></html>')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(BUILD / "dist" / "THE-90-DAY-CHESS-ACCELERATOR.pdf"))
    args = ap.parse_args()
    import weasyprint
    h = build_html()
    (BUILD / "pdf").mkdir(parents=True, exist_ok=True)
    (BUILD / "pdf" / "workbook.html").write_text(h)
    doc = weasyprint.HTML(string=h, base_url=str(ROOT)).render()
    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    doc.write_pdf(str(out))
    print("workbook:", out, len(doc.pages), "pages", out.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
