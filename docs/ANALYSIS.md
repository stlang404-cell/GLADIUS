# GLADIUS — Analysis, classification & skill model (v0.3)

All numbers here are produced by the code in `src/analysis/`; the formulas are documented in comments next to the implementation.

## Pipeline
- Post-game only. The active (or any unfinished) game is never analysed; the queue re-checks this when a job starts (`integrity.ts`). The opening explorer and FEN play-outs are locked during a rated game; importing a PGN that reaches the live position is refused.
- Each position is searched once at a fixed depth with **MultiPV 3** (analysis only — play uses MultiPV 1). Results are deterministic at a fixed depth (tested).
- Stored per move: up to three candidate lines, phase, motif tags (hangs / allowsMate / missedMate / missedWin / onlyMove / recapture / sacrifice / bookExit), and a short explanation built from those tags.
- Stored per game: accuracy per side and per phase, book exit, endgame review, puzzle candidates. Analyses are cached and never recomputed; older-version analyses can be re-run. Interrupted analyses restart from scratch after reload (`resumePendingAnalysis`, called at start-up); partial results are never stored.

## Estimated accuracy (not equivalent to any proprietary system)
- Win% = 50 + 50·(2/(1+e^(−0.00368208·cp)) − 1); mate = 100 / 0.
- Move accuracy = 103.1668·e^(−0.04354·Δ) − 3.1669 + 1, where Δ is the win% lost by the mover.
- Game accuracy = mean of the volatility-weighted mean and the harmonic mean of move accuracies.
- Reliability tag: **high** depth ≥ 14 and ≥ 30 moves per side; **medium** depth ≥ 11 and ≥ 15; otherwise **low**.

## Move classes (checked in order)
| Class | Rule |
|---|---|
| Forced | only legal move |
| Book | still in the identified opening line and Δ < 5 |
| Brilliant | best (or Δ ≤ 2) **and** a verified sacrifice: static exchange shows ≥ 2 pawns offered and the engine line confirms it; not a recapture; not in an already decided position (both best and 2nd-best ≥ 90%); win% after ≥ 40 |
| Great | best, 2nd-best ≥ 15 win% worse, win% before ≥ 25; not a recapture, free capture, mate-in-1 or forced evasion |
| Best | engine top move or within 1 win% |
| Missed win | forced mate not kept, or ≥ 75% → ≤ 55% |
| Excellent / Good | Δ < 2 / Δ < 5 |
| Inaccuracy / Mistake / Blunder | 5–10 / 10–15 / ≥ 15 |

## Training from real mistakes
A puzzle is created only when the best move beats the 2nd-best by ≥ 10 win% (or is the only mate) and keeps ≥ 35%; each further trainee move is added only if a MultiPV-2 search confirms the same margin (≤ 3 moves). Only a clean solve counts; wrong move, reveal or skip is a failure.

## Skill profile (`skills.ts`)
Dimensions: opening, tactics, positional, endgame, defence, conversion, recovery, blunder avoidance, consistency, plus accuracy by opponent Elo band. Each shows the **measured** value with its sample size and an **estimate** shrunk toward 50 for small samples: estimate = 50 + (raw − 50)·n/(n + K). Nothing is shown without analysed games.

## Known limits
Lite Stockfish at depth 11–14 can miss deep sacrifices (the reliability tag says so); strict puzzle margins yield few puzzles; MultiPV 3 makes analysis ~1.5–2× slower (≈30 s for 100 plies at depth 13 in headless Chromium).
