# GLADIUS — Analysis, classification & skill model (v0.4)

All numbers here are produced by the code in `src/analysis/`; the formulas are documented in comments next to the implementation. The v0.4 section supersedes v0.3 where they disagree.

## v0.4 — making analysis trustworthy

### Investigation: the Opera Game's 15.Bxd7+ (lite engine)
Position before the move: `4kb1r/p2r1ppp/4qn2/1B2p1B1/4P3/1Q6/PPP2PPP/2KR4 w k - 2 15`. Lite single-threaded Stockfish 19, MultiPV 3, Node 22:
* **Depth 11** (phones / ≤ 4 GB): the root's top three are Bxf6 +8.12, Qxe6+ +5.23, Kb1 +3.42 — **Bxd7+ is not among them**, so v0.3 valued it from the search *after* the move, where Black's best is 15…Nxd7 at −2.83. Loss 22.9 win% → **Blunder**, accuracy W 89.5 / B 88.5, and ply 28 was a "critical moment".
* The after-move search misjudges the position up to depth 14 (Nxd7 −2.8 … −3.6): it prunes 16.Qb8+!! Nxb8 17.Rd8# (a queen "sacrifice" giving check). From **depth 16** Black's best is Qxd7 (−11.6) and Nxd7 is mated (…Ke7 M−4 at depth 18).
* **Depth 12–14**: Bxd7+ enters the root MultiPV (+10.6/+10.1/+12.5) and is classed Best — but the shown evaluation after it was still +2.7, i.e. the root and the after-move search disagreed by 22–25 win%. v0.3 presented both as certain.
* Root cause: shallow searches of the position after a deep combination, plus classification mixing two searches without checking that they agree.

With v0.4 verification at depth 11: Bxd7+ is searched at 15, still inconsistent (root +10 vs after +3.4), escalated to **19**, where both agree: **Best, high confidence**, provenance "verified (was Blunder)", 2.9 M nodes; 16.Qb8+ stays **Brilliant (high)**; accuracy W 97.4 / B 88.9; no false critical moment. At depths 12 / 13 / 14 (where it was "Best" with instability 25 / 22 / 25 win%) the same move is verified at 20 / 17 / 18 and becomes high confidence (shown evaluation +11.4 instead of +2.7). Cost for the 33-ply game (Node, lite, single runs on a shared 4-core box): 2.8 s → 22 s at depth 11, 4.6 s → 18 s at 12, 9 s → 21 s at 13, 18 s → 41 s at 14; in headless Chromium (desktop plan, depth 13) the whole analysis incl. verification took 48 s, and a player-requested deeper search of 15.Bxd7+ 2.3 s.

### Verification pass (`analyzer.ts`)
1. Every position is searched once (fixed depth, MultiPV 3) as before; each search now also records the principal line's win% at every completed depth (`trace`) and the nodes searched.
2. Candidates, in priority order: Brilliant/Great claims; played sacrifices (≥ 2 pawns offered by static exchange) within 2 win% of best; every Mistake/Blunder/Missed win (by size); then any other move whose confidence is low (unstable). At most 12 moves per game (8 at depth ≤ 11), 3 M nodes per search, 40 M nodes per game.
3. For each candidate both the position before the move (best + alternatives) and the position after the played move (its refutation) are re-searched at depth + 4 (MultiPV 3). While unstable — spread > 5 win% over the last three iterations on either position, or root value of the played move vs after-move value differing by > 8 win% — both are searched again 4 plies deeper, at most twice, never beyond min(depth + 8, 22).
4. Deep results replace shallow ones and all moves are re-classified (pure `buildMoves`); a second round verifies claims that only appear after the first. If shallow and deep disagree, the deep verdict is used and the old class is kept as provenance (`verified.from`).
5. The analysis engine is the `analysis` role (full net when the plan gives it one — desktop with the pack installed and ≥ 8 GB); its `activeEngineInfo('analysis').label` is stored with every verification.
6. Results stay reproducible: fixed depths and node caps, fixed order, single-threaded (tested, verification included).

### Confidence model (`confidence.ts`)
Per move: `depth` (shallower of the two searches judging it; finished positions are exact), `nodes`, `instab` = max(depth volatility, root-vs-after inconsistency) in win%, and `conf`:
* forced / book → high;
* volatility > 10 or inconsistency > 15 → **low**;
* Mistake/Blunder/Miss whose loss minus the instability is < 5 (noise could erase it) → low;
* a claim (Brilliant, Great, Mistake, Blunder, Miss) that was not verified → at most **medium** ("unverified");
* volatility ≤ 5, inconsistency ≤ 8 and depth ≥ 11 → **high**; otherwise medium.

Low-confidence claims are shown as **Unclear** (∞, grey) with an uncertain explanation; a low-confidence Brilliant/Great is stored as Best/Excellent with `claim` kept, so no stored count ever credits an unconfirmed brilliancy. Analyses made before v0.4 have no confidence (treated as before, marked stale, re-analysable).

### What uses confidence
| Consumer | Rule |
|---|---|
| Review UI | class badge via `displayClass` ("Unclear" for low claims, "unverified"/"low confidence" pill), per-move line "depth · nodes · verified (was …) · confidence · engine"; per game "N moves verified to depth D · N unclear" + engine label |
| Evaluation graph | low-confidence points are hollow dashed rings (grey for Unclear claims) + a legend; tapping still jumps to the ply |
| Critical moments | loss ≥ 12 win% within one search AND the position evaluations show at least half of it AND not low confidence AND instability ≤ 10 (engine noise and two-search disagreements are excluded) |
| PGN | NAG only for high confidence; medium is one step softer (!! → !, ?? → ?); low has **no NAG** and the comment starts "Unclear:". Claims and changed verdicts carry "(depth D, verified, X confidence)"; the Annotator header names the verification depth |
| Puzzles | only from **high-confidence** Mistake/Blunder/Miss (plus the v0.3 uniqueness margin, re-checked on the deep lines) |
| Recommendations, biggest moments, missed tactics, weakness & skill statistics, endgame/opening review | only trusted moves (high, or pre-v0.4); unclear moves are counted separately and suggest "Analyse deeper" |
| Achievements | `confidentCounts(analysis, startFen)` / `isConfidentBrilliant(move)`: positive classes only when high; errors always (an unclear error still blocks "Flawless") |
| Reliability tag | v0.3 rule; a game whose claims were all verified with no Unclear move and ≥ 30 moves per side is high from depth 11; every two Unclear moves lower it one step |

### Accuracy (changes)
The formulas are unchanged. Accuracy is now computed *after* verification (deep values replace shallow ones where verified) and is reproducible. The win% series is read back from the stored moves (`winSeriesOf`), so a deeper re-search updates accuracy, counts, phases and critical moments consistently. Mates: side to move mated = 0, mate for = 100; centipawns are clamped to ±1000 before the logistic.

### Deeper analysis on request
"Analyse deeper" on the move card queues a search of the position before the move and after the played move at max(game depth + 8, move depth + 6) (≤ 30, one +4 escalation if unstable, 25 M nodes per search). It runs before queued full analyses, can be cancelled (the engine search is aborted, nothing is stored), is refused — and re-checked at start and before storing — while any game is in progress, and only for finished, analysed games (`deepenBlockReason`). The move and the moves depending on the re-searched positions are re-classified; provenance is stored (`verified = { by: 'user', depth, nodes, from, at, engine }`), the summary and the game's puzzles are refreshed, and never-attempted training positions whose mistake was not confirmed are removed. All new persisted fields are optional.

### Opening and endgame review
`openingReview` finds the real book exit — the side's first move that is not among the book's continuations (v0.3 used the end of the deepest *named* line, so "Left the book with d4 · theory: d4" could happen) — lists the theory moves there, says when the opponent left first, and whether the exit cost win% (trusted moves only). `endgameSummary` counts only trusted endgame errors and mentions unclear ones.

### Tests
`tests/analysis.verify.test.ts` (real lite engine, ≈ 60 s): Opera Game 15.Bxd7+ is a Blunder without verification and Best/high with it (verified deeper, Qb8+ Brilliant/high, no false critical moment, no `??`); reproducibility with verification; player-requested deepening (provenance, summary, untouched moves, JSON round-trip, cancellation); queue → IndexedDB persistence and refusal during a game. `tests/analysis.confidence.test.ts`: confidence rules, Unclear display, demotion of unstable brilliancies, achievement counts, PGN NAG rules, critical moments vs noise, trusted-only findings, reliability, opening/endgame review, integrity. `tests/analysis.engine.test.ts`: the trap game's puzzle assertion now requires high confidence (Nxf7's refutation is not unique at depth 14, so no puzzle is made from it), plus a missed mate in one that does become a verified puzzle.

## v0.3 (still valid where not superseded)

### Pipeline
- Post-game only. The active (or any unfinished) game is never analysed; the queue re-checks this when a job starts (`integrity.ts`). The opening explorer and FEN play-outs are locked during a rated game; importing a PGN that reaches the live position is refused.
- Each position is searched once at a fixed depth with **MultiPV 3** (analysis only — play uses MultiPV 1). Results are deterministic at a fixed depth (tested).
- Stored per move: up to three candidate lines, phase, motif tags (hangs / allowsMate / missedMate / missedWin / onlyMove / recapture / sacrifice / bookExit), and a short explanation built from those tags.
- Stored per game: accuracy per side and per phase, book exit, endgame review, puzzle candidates. Analyses are cached and never recomputed; older-version analyses can be re-run. Interrupted analyses restart from scratch after reload (`resumePendingAnalysis`, called at start-up); partial results are never stored.

### Estimated accuracy (not equivalent to any proprietary system)
- Win% = 50 + 50·(2/(1+e^(−0.00368208·cp)) − 1); mate = 100 / 0.
- Move accuracy = 103.1668·e^(−0.04354·Δ) − 3.1669 + 1, where Δ is the win% lost by the mover.
- Game accuracy = mean of the volatility-weighted mean and the harmonic mean of move accuracies.
- Reliability tag: **high** depth ≥ 14 and ≥ 30 moves per side; **medium** depth ≥ 11 and ≥ 15; otherwise **low**.

### Move classes (checked in order)
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

### Training from real mistakes
A puzzle is created only when the best move beats the 2nd-best by ≥ 10 win% (or is the only mate) and keeps ≥ 35%; each further trainee move is added only if a MultiPV-2 search confirms the same margin (≤ 3 moves). Only a clean solve counts; wrong move, reveal or skip is a failure.

### Skill profile (`skills.ts`)
Dimensions: opening, tactics, positional, endgame, defence, conversion, recovery, blunder avoidance, consistency, plus accuracy by opponent Elo band. Each shows the **measured** value with its sample size and an **estimate** shrunk toward 50 for small samples: estimate = 50 + (raw − 50)·n/(n + K). Nothing is shown without analysed games.

## Known limits (v0.4)
Lite Stockfish at depth 11–14 can miss deep sacrifices; v0.4 verifies claims and unstable moves, but only up to 12 moves per game (8 on phones) and depth ≤ 22 / 3 M nodes per search — a deep idea in a move the shallow search calls "Best" with a stable evaluation is not re-searched. Verification adds roughly 1–2.5× to the analysis time on sharp games. Strict puzzle margins yield few puzzles (fewer still now that only high-confidence mistakes count). MultiPV 3 makes analysis ~1.5–2× slower (≈30 s for 100 plies at depth 13 in headless Chromium, before verification). Confidence thresholds (5/8/10/15 win%) are judgement calls checked on a handful of classic games, not fitted on data.
