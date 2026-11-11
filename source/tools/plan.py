#!/usr/bin/env python3
"""Generate the 90-day plan (build/plan/plan.json) from the book structure.

Schedule (coaching judgment, see the workbook introduction):
  Days  1–21  Stage 1  chapters 1–6    (milestone test T1 on day 21)
  Days 22–49  Stage 2  chapters 7–13   (T2 on day 49)
  Days 50–70  Stage 3  chapters 14–18  (T3 on day 70)
  Days 71–90  Stage 4  chapters 19–23  (T4 on day 90)
Every 7th day is a weekly evaluation and review day. Stage 5 (chapters 24–28) follows
after day 90 using the same daily structure ("Phase Two").
"""
from __future__ import annotations

import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from book import BUILD, Book, ex_label  # noqa: E402

STAGES = [
    {"stage": 1, "range": "400–600", "days": (1, 21), "test": "T1",
     "alloc": [(1, 2), (2, 2), (3, 3), (4, 4), (5, 3), (6, 4)]},
    {"stage": 2, "range": "600–800", "days": (22, 49), "test": "T2",
     "alloc": [(7, 3), (8, 3), (9, 3), (10, 4), (11, 4), (12, 4), (13, 3)]},
    {"stage": 3, "range": "800–1000", "days": (50, 70), "test": "T3",
     "alloc": [(14, 3), (15, 4), (16, 3), (17, 4), (18, 4)]},
    {"stage": 4, "range": "1000–1200", "days": (71, 90), "test": "T4",
     "alloc": [(19, 3), (20, 4), (21, 3), (22, 3), (23, 4)]},
]

GAME_FOCUS = {
    1: "Play carefully by the full rules: castle at least once and say 'check' to yourself when giving one.",
    2: "Write down every move (or keep the app's move list) and replay the game from your notation afterwards.",
    3: "Before every capture, count attackers and defenders on that square.",
    4: "Run the safety scan before every single move. Goal: no piece left hanging.",
    5: "If you reach K+Q or K+R vs K, mate without stalemate; otherwise practise the mate vs. an engine after the game.",
    6: "Follow the opening principles: develop, castle by move 10, no early queen raids.",
    7: "Look for forks — yours and your opponent's — at every move.",
    8: "Notice every pin on the board; before moving a pinned piece, check what is behind it.",
    9: "Look for batteries and pieces that could move with discovered attack.",
    10: "Ask of every enemy piece: what is its job? Look for overloaded defenders.",
    11: "Check the enemy king's flight squares every few moves; make luft for your own king in time.",
    12: "Play your White repertoire; after the game, find where you left the plan.",
    13: "Play your Black repertoire; check the first 10 moves against the chapter afterwards.",
    14: "Name 2–3 candidate moves at every non-obvious position before choosing.",
    15: "At each forcing sequence, visualise the final position before you play the first move.",
    16: "If you get ahead, trade pieces and stop counterplay instead of hunting for more.",
    17: "When you are worse, look for the most active defence and for perpetual/stalemate resources.",
    18: "Before trading into a pawn ending, count it out. After the game, replay any K+P ending from the chapter.",
    19: "Every few moves, find your worst piece and improve it.",
    20: "Before every pawn move, ask what squares it gives up forever.",
    21: "Track king safety for both sides; count attackers vs. defenders around each king.",
    22: "At each quiet moment: evaluate, name the weakest enemy target, pick a 2–3-move plan.",
    23: "If you reach a rook ending, keep your rook active and behind passed pawns.",
}


def chapter_sections(ch) -> list[str]:
    return [re.sub(r"[*_`]", "", m.group(1)).strip()
            for m in re.finditer(r"^##\s+(.+)$", ch["body"], re.M)
            if not re.match(r"(Practice at the board|Chapter summary)", m.group(1))]


def split(seq, k):
    """Split seq into k nearly equal consecutive chunks."""
    n = len(seq)
    out, start = [], 0
    for i in range(k):
        end = start + (n - start) // (k - i)
        out.append(seq[start:end])
        start = end
    return out


def time_options(kind, ex_ids, ch=None, game=True):
    """Concrete task lists for the 15/30/60/90-minute options."""
    exs = ("exercises " + ", ".join(ex_label(e) for e in ex_ids)) if ex_ids else "your review queue"
    if kind == "study":
        return {
            "15": [("solve", f"Solve {exs} (write your answer before checking)."),
                   ("learn", "Read the assigned section (finish tomorrow if needed).")],
            "30": [("review", "Review queue: re-solve misses due today (1/3/7/21-day intervals)."),
                   ("learn", "Read the assigned section with a board; play through every line."),
                   ("solve", f"Solve {exs}.")],
            "60": [("review", "Review queue (10 min)."),
                   ("learn", "Read the assigned section with a board (20 min)."),
                   ("solve", f"Solve {exs} (15 min)."),
                   ("play", "Play one slow game (10+5 or slower) or a training position vs. the engine (15 min)."),
                   ] if game else [],
            "90": [("review", "Review queue (15 min)."),
                   ("learn", "Read the assigned section with a board (25 min)."),
                   ("solve", f"Solve {exs} (15 min)."),
                   ("play", "Play one slow game (15+10 or slower) (25 min)."),
                   ("analyze", "Analyse the game yourself first, then with the engine; journal any mistake (10 min).")],
        }
    if kind == "consolidate":
        return {
            "15": [("solve", f"Solve {exs}."), ("fix", "Re-solve today's misses once more.")],
            "30": [("solve", f"Solve {exs}."), ("review", "Review queue."),
                   ("fix", "Write one mistake-journal entry from your exercises or games.")],
            "60": [("solve", f"Solve {exs} (15 min)."), ("review", "Review queue (10 min)."),
                   ("play", "Play one slow game applying the chapter (25 min)."),
                   ("analyze", "Analyse it yourself first; journal mistakes (10 min).")],
            "90": [("solve", f"Solve {exs} (15 min)."), ("review", "Review queue (15 min)."),
                   ("play", "Play one slow game applying the chapter (35 min)."),
                   ("analyze", "Analyse it: self first, engine second (15 min)."),
                   ("fix", "Turn your biggest mistake into a journal exercise (10 min).")],
        }
    raise ValueError(kind)


def main():
    book = Book()
    days = []
    for st in STAGES:
        d0, d1 = st["days"]
        study_days = []
        for ch_n, k in st["alloc"]:
            ch = book.chapters.get(ch_n)
            secs = chapter_sections(ch) if ch else []
            exset = book.exercise_set(ch_n)
            ex_ids = [e["id"] for e in exset["exercises"]] if exset else []
            sec_chunks = split(secs, k) if secs else [[] for _ in range(k)]
            # exercises: spread over the chapter's days, the last day gets the remainder
            ex_chunks = split(ex_ids, k)
            for i in range(k):
                last = i == k - 1
                study_days.append({
                    "chapter": ch_n, "chapter_title": ch["title"] if ch else f"Chapter {ch_n}",
                    "part_of_chapter": f"{i + 1}/{k}",
                    "kind": "consolidate" if (last and k > 2) else "study",
                    "read": sec_chunks[i], "exercises": ex_chunks[i],
                    "game_focus": GAME_FOCUS.get(ch_n, ""),
                })
        # weekly review days: every 7th day of the program
        it = iter(study_days)
        week_chapters = []
        for d in range(d0, d1 + 1):
            if d % 7 == 0 or d == 90:
                is_stage_end = d == d1
                test = st["test"] if is_stage_end else None
                rec_ids = []
                for c in sorted(set(week_chapters)):
                    s = book.exercise_set(c)
                    if s:
                        hard = sorted(s["exercises"], key=lambda e: -e["difficulty"])[:2]
                        rec_ids += [e["id"] for e in hard]
                day = {"day": d, "week": (d - 1) // 7 + 1, "stage": st["stage"], "range": st["range"],
                       "type": "milestone" if is_stage_end else "weekly",
                       "title": f"Stage {st['stage']} milestone test" if is_stage_end else f"Week {(d - 1) // 7 + 1} evaluation",
                       "chapters": sorted(set(week_chapters)), "test": test, "check_exercises": rec_ids}
                opts = {
                    "15": [("test" if test else "review", f"Take the Stage {st['stage']} Test ({test}) — no moving pieces."
                            if test else f"Weekly check: re-solve {', '.join(ex_label(e) for e in rec_ids[:4]) or 'this week’s misses'}.")],
                    "30": [("test" if test else "review", f"Take the Stage {st['stage']} Test ({test})." if test
                            else f"Weekly check: re-solve {', '.join(ex_label(e) for e in rec_ids) or 'this week’s misses'} cold."),
                           ("fix", "Update your weakness list (top 3 categories by frequency × cost).")],
                    "60": [("test" if test else "review", f"Take the Stage {st['stage']} Test ({test}) (30 min)." if test
                            else f"Weekly check: {', '.join(ex_label(e) for e in rec_ids) or 'this week’s misses'} (20 min)."),
                           ("analyze", "Re-read your journal entries from this week (10 min)."),
                           ("fix", "Update the weakness list and choose next week's remedial focus (10 min)."),
                           ("play", "Play one slow game with no new material — just the checklist (20 min).")],
                    "90": [("test" if test else "review", f"Take the Stage {st['stage']} Test ({test}) (35 min)." if test
                            else f"Weekly check: {', '.join(ex_label(e) for e in rec_ids) or 'this week’s misses'} (25 min)."),
                           ("analyze", "Re-read this week's journal; replay your games quickly (15 min)."),
                           ("fix", "Update the weakness list; schedule remedial work (10 min)."),
                           ("play", "Play one slow game and analyse it (40 min).")],
                }
                day["options"] = {k: [{"kind": a, "text": b} for a, b in v] for k, v in opts.items()}
                days.append(day)
                week_chapters = []
            else:
                sd = next(it, None)
                if sd is None:
                    raise SystemExit(f"stage {st['stage']}: ran out of study days at day {d}")
                week_chapters.append(sd["chapter"])
                opts = time_options(sd["kind"], [f"{e}" for e in sd["exercises"]])
                if not opts["60"]:
                    opts["60"] = time_options("study", sd["exercises"])["90"][:4]
                day = {"day": d, "week": (d - 1) // 7 + 1, "stage": st["stage"], "range": st["range"],
                       "type": sd["kind"], "chapter": sd["chapter"], "chapter_title": sd["chapter_title"],
                       "title": f"Ch. {sd['chapter']} · {sd['chapter_title']} ({sd['part_of_chapter']})",
                       "read": sd["read"], "exercises": sd["exercises"], "game_focus": sd["game_focus"],
                       "options": {k: [{"kind": a, "text": b} for a, b in v] for k, v in opts.items()}}
                days.append(day)
        if next(it, None) is not None:
            raise SystemExit(f"stage {st['stage']}: study days left over")
    assert len(days) == 90 and [d["day"] for d in days] == list(range(1, 91))
    plan = {
        "days": days,
        "benchmarks": {
            "21": ["Stage 1 Test: 12/15 or better.", "Last 5 slow games: on average no more than one piece left hanging per game.",
                   "Can deliver K+Q vs K and K+R vs K mate against an engine or friend without stalemate.",
                   "Castles by move 10 in most games."],
            "49": ["Stage 2 Test: 11/15 or better.", "Chapter accuracy ≥ 80 % first try on chapters 7–11.",
                   "Plays the repertoire's first 6–8 moves without checking the book.",
                   "In analysis, finds at least one missed tactic per game yourself before the engine."],
            "70": ["Stage 3 Test: 11/15 or better.", "Wins K+P vs K with the opposition from the key positions.",
                   "Converts a +5 (piece up) position against an engine set to a moderate level.",
                   "Uses a candidate-move list at every critical moment."],
            "90": ["Stage 4 Test: 10/15 or better.", "Holds the Philidor and wins the Lucena against the engine.",
                   "Can name a plan from the pawn structure in a quiet position.",
                   "Has a weakness list with three ranked items and a remedial plan for each."],
        },
    }
    out = BUILD / "plan" / "plan.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(plan, indent=1, ensure_ascii=False))
    print("plan:", out, len(days), "days")


if __name__ == "__main__":
    main()
