# The Elo Blueprint — Content Guide (authoring specification)

This file defines how every chapter and exercise of *The Elo Blueprint* is written.
The same sources build the PDF, the EPUB, and the interactive trainer, so the
format rules are strict. **Every position and every move sequence is machine-checked
by `tools/validate.py` (python-chess legality + Stockfish 18).**

## 1. Reader and promise

* Reader: an adult or teen rated ~400 who knows how the pieces move (more or less),
  is motivated, and wants a coach-quality system to reach 1500 and keep growing.
* Every chapter must answer: **"What will this teach me to recognize, decide, or
  execute better in my next game?"** That answer goes in front matter `next_game`.
* Teach *how to think*, not just facts. Give procedures the reader can run at the board.
* The loop is **LEARN → SOLVE → PLAY → ANALYZE → FIX → REPEAT**. Each chapter ends by
  pointing the reader into SOLVE (exercises) and PLAY (a concrete game assignment).

## 2. Voice and editorial rules

* Clear, warm, direct, adult. Second person ("you"). Short paragraphs (2–5 sentences).
* No filler, no repetitive motivational speeches, no hype, no emojis.
* Define jargon the first time it appears in a chapter, in plain words (**bold** the term).
* Notation: English SAN letters — K Q R B N; pawns have no letter. Examples: `Nf3`,
  `exd5`, `O-O`, `O-O-O`, `e8=Q`, `Qxf7#`, `Bb5+`. White moves `12.Nf3`, Black moves
  `12...Nf6`. Use `...` (three periods) for Black. Capitalize **White** and **Black**
  when they mean the players.
* Evaluation words over symbols. Allowed annotation symbols: `!` `?` `!!` `??` `!?` `?!`.
* Heuristics are heuristics: say "usually", "a strong guideline", "an exception is…".
  Never present a rule of thumb as an infallible law.
* Distinguish **established evidence** (with a real citation you are certain exists:
  author, year, title) from **coaching judgment** (label it as such). Never invent
  studies, quotations, page numbers, ratings, or statistics. If unsure, don't cite.
* Historical games: only quote a real game if you are *certain* of every move, the
  players, and the year (e.g. Morphy vs. Duke of Brunswick & Count Isouard, Paris 1858).
  Otherwise present the position as an *illustrative position* without attribution.
  Constructed instructional positions are preferred and perfectly fine.
* Never claim a position is from a specific game unless it is.
* Ratings are milestones, not prerequisites. Do not promise rating gains.

## 3. Chapter file format (`manuscript/chapters/NN-slug.md`)

```markdown
---
chapter: 7
slug: forks
title: Forks
subtitle: One move, two targets
part: 2
stage: "600–800"
skills: [fork]                      # tags from the skill vocabulary (section 6)
objectives:
  - Recognize the geometry of knight, queen, pawn and king forks.
  - Find forcing moves that set up a fork (checks that drive the king onto a forkable square).
  - Avoid placing your own king and pieces on forkable squares.
next_game: Before every move, look for any square from which one of your pieces would attack two undefended or more valuable targets at once.
---

Opening paragraph(s): a concrete, recognizable game situation. No heading.

## First section heading
...
```

Required structure for a chapter (headings may be renamed to suit the topic):

1. Untitled opening (≤ 150 words): why this matters in real games at this level.
2. Teaching sections (`##`, with `###` subsections). For each concept cover:
   what it is · why it matters · when to recognize it · how to execute it ·
   what commonly goes wrong · how to identify it in your own games.
3. At least one **worked example** walked through move by move as a *thinking process*
   ("First I check… the candidate moves are… the opponent's best reply is…").
4. `## Practice at the board` — instructions that work with a physical board or any
   free chess app: positions to set up (give the FEN), what to try, how to check yourself.
5. `## Chapter summary` — 5–8 bullets.
6. A `:::cheat` box with the chapter's decision procedure (3–7 numbered steps).
7. The line `@exercises` on its own line, last. The builder inserts the exercise set
   here (problems) and puts the solutions in the book's Solutions section.

Length: **3,000–4,500 words** of prose per chapter (openings chapters may run longer).
Diagrams: **6–10 per chapter**, each one doing real teaching work.

### 3.1 Diagram block

````markdown
```board
fen: r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4
caption: White threatens Qxf7#. Black's last move, 3...Nf6??, ignored the threat.
arrows: h5f7 c4f7
red: f6h5
squares: f7
orientation: white
```
````

* `fen` (required): full FEN, correct side to move, castling rights and en-passant square.
* `caption` (required): one or two sentences that say what to look at.
* `arrows` (green, the good idea), `red` (danger / opponent's threat), `blue` (alternative):
  space-separated `from+to` pairs like `e2e4`.
* `squares`: highlighted squares (gold). `orientation`: `white` (default) or `black`.
  Show the board from the side the reader is playing in that example.

### 3.2 Move-line block (validated for legality; optionally engine-checked)

````markdown
```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O
check: engine
diagram: end
caption: The Giuoco Pianissimo: development first, then a slow central plan.
```
````

* `fen`: `startpos` or a FEN. `moves`: SAN with move numbers (numbers must match the FEN's
  fullmove number; when the line starts with Black, begin with e.g. `5...Nf6`).
* `check: engine` — every move without `?`/`??`/`?!` must not lose more than ~1.1 pawns
  according to Stockfish. **Use `check: engine` on every opening line and every
  "correct play" variation.** Mark intentional errors (`4...Nf6??`).
* `diagram: end` renders a diagram of the final position (needs `caption`).
* Inline moves in prose are fine (`after 5...d6 White castles`) but any sequence of
  three or more moves that the reader should play through belongs in a `line` block.

### 3.3 Callout boxes

```markdown
:::key The point
Short paragraph or list.
:::
```

Types: `key` (key idea), `cheat` (decision procedure — numbered list), `mistake`
(common mistake), `nextgame` (do this in your next game), `evidence` (research note,
with citation), `coach` (coaching judgment), `drill` (a quick exercise for the board),
`example` (worked example wrapper, optional). The text after the type is the box title.

### 3.4 Links

Chapters have anchors `#ch-NN` (two digits), e.g. `[Chapter 7](#ch-07)`. Use them
for cross references. Do not link to the web except in the Further Reading section.

## 4. Exercise files (`exercises/NN-slug.json`)

```json
{
  "chapter": 7,
  "title": "Forks",
  "exercises": [
    {
      "id": "07-01",
      "type": "tactic",
      "difficulty": 2,
      "fen": "…",
      "question": "White to move. Win material with a fork.",
      "solution": ["Nc7+", "Kd8", "Nxa8"],
      "goal": "win",
      "accept": [],
      "explanation": "Nc7+ checks the king and attacks the rook on a8 at the same time…",
      "wrong": [{"move": "Nxf6", "why": "Wins a pawn but lets Black consolidate; the rook was available."}],
      "hint": "Which checks do you have?",
      "objective": "Recognize a knight fork of king and rook.",
      "tags": ["fork"]
    }
  ]
}
```

Field rules:

* `id`: `NN-XX` (chapter, two-digit index). Stage tests use `T1-01` … `T5-15`.
* `type`: one of `tactic mate defense blunder-check opening endgame quiet strategy
  evaluation counting rules vision conversion calculation`.
* `difficulty`: 1 (first exposure) … 5 (hard for a 1500).
* `fen`: valid, legal, the correct side to move, realistic-looking (no impossible
  pawn structures, sensible material, kings not in illegal check).
* `question`: begins with "White to move." or "Black to move." then the task.
  Mix the question style: "Win material", "Find the safest move", "Your opponent just
  played …Bc5. What is the best response?", "Which move saves the game?", "Choose a
  plan move", "Is the pawn on e5 safe to take? Play the right move." Each exercise must
  have ONE move-based answer (the trainer is interactive).
* `solution`: SAN list starting with the solver's move. Alternating solver/opponent.
  End on the solver's move. Keep lines short (1–5 solver moves) and **forcing**.
  Opponent replies must be the best defense (the validator warns otherwise).
* `goal`: how the engine checks it —
  * `mate`: needs `mate_in`; the line must end in checkmate; no other first move may
    mate as fast unless listed in `accept`.
  * `win`: the first move must evaluate ≥ +2.00 and beat every non-accepted alternative
    by ≥ 1.50 (≥ 3.00 if the alternative is also winning). Make sure there is enough
    material left that the win is real (K+N vs K is a draw!).
  * `only`: a defensive/only move: within 0.50 of the engine's best and ≥ 1.20 better
    than any other move.
  * `best`: within 0.50 of the engine's best (for quiet, strategic, opening moves).
    Several moves may be fine; list well-known equal alternatives in `accept`.
  * `draw`: the solution holds the draw (|eval| ≤ 0.90) — every `wrong` move must lose.
* `accept`: other first moves that are genuinely also correct for the same reason.
* `wrong`: 1–3 tempting wrong answers that a 400–1500 player would really play, each
  with a one-sentence `why`. **The engine checks that they really are worse.**
* `explanation`: 2–5 sentences. Say what to notice, why the move works, and the key
  line. Do not just restate the move.
* `hint`: one short nudge (optional but recommended).
* `objective`: the transferable skill.
* `tags`: from the skill vocabulary below (first tag = primary skill).
* `review_note` (optional): justification if you keep a validator warning.

Mix within each chapter: ~60% skill-specific, ~20% defence/blunder-check
(spot the opponent's idea), ~20% review of earlier chapters' skills. Include
positions with **no tactic** where the right answer is a sound quiet move.
Spread difficulty: about 3×d1, 3×d2, 3×d3, 2×d4 (+ d5 in later stages).
Use realistic middlegame/endgame positions, not just bare kings with two pieces.
Vary the side to move (roughly half Black).

**Count: 11 exercises per chapter** (chapter files), **15 per stage test**.

## 5. Workflow (mandatory)

1. Construct each position with `python3 tools/probe.py "FEN" [moves] --depth 16`.
   It prints the board (UPPERCASE = White), legality, all legal moves, and
   Stockfish's top lines. **Look at the board printout** — it is the easiest way
   to catch a misplaced piece. You can also build a position by playing moves from a
   FEN or `startpos`: `python3 tools/probe.py startpos 1.e4 e5 2.Nf3`.
2. Validate while drafting:
   `python3 tools/validate.py --depth 16 exercises/NN-slug.json manuscript/chapters/NN-slug.md`
3. Fix every ERROR. Fix or justify (`review_note`) every WARNING. Rework positions
   rather than weakening the claim in the text.
4. Make sure the *prose claims* about diagrams are true: if a caption says "White wins
   a piece", probe it.
5. Never edit files outside your assignment. Never edit tools/.

## 6. Skill vocabulary (tags)

rules, castling, en-passant, promotion, stalemate, notation, vision, counting,
hanging-pieces, threats, blunder-check, basic-mates, opening-principles,
opening-traps, fork, pin, skewer, discovered-attack, double-check,
removing-defender, overloading, deflection, decoy, trapped-piece, x-ray,
interference, clearance, desperado, zwischenzug, mate-patterns, back-rank,
smothered-mate, repertoire-white, repertoire-black, candidate-moves, calculation,
quiet-move, conversion, defense, perpetual, king-pawn-endgame, opposition,
rook-endgame, minor-piece-endgame, queen-endgame, endgame-technique,
piece-activity, outpost, open-file, pawn-structure, passed-pawn, king-safety,
attack, planning, prophylaxis, bishop-vs-knight, evaluation, practical.

Mistake categories (used by the game-analysis and mistake-journal system):
hanging-piece, missed-tactic, missed-mate, king-safety, calculation, opening,
endgame, missed-win, conversion, positional, time-psychology.

## 7. Book map (for cross references)

| # | Title | Stage |
|---|---|---|
| 1 | The Rules, Completely | 400–600 |
| 2 | Reading the Board: Notation and Board Vision | 400–600 |
| 3 | Piece Values and Counting | 400–600 |
| 4 | The Safety Scan: Checks, Captures, Threats | 400–600 |
| 5 | The Basic Checkmates | 400–600 |
| 6 | Opening Principles and Early Traps | 400–600 |
| 7 | Forks | 600–800 |
| 8 | Pins and Skewers | 600–800 |
| 9 | Discovered Attacks and Double Check | 600–800 |
| 10 | Removing the Defender, Overloading, Deflection and Decoys | 600–800 |
| 11 | Checkmate Patterns | 600–800 |
| 12 | Your Repertoire as White | 600–800 |
| 13 | Your Repertoire as Black | 600–800 |
| 14 | How to Think: Candidate Moves and the Move-Selection Routine | 800–1000 |
| 15 | Calculation Fundamentals | 800–1000 |
| 16 | Converting a Winning Position | 800–1000 |
| 17 | Defense and Resourcefulness | 800–1000 |
| 18 | King and Pawn Endgames | 800–1000 |
| 19 | Piece Activity | 1000–1200 |
| 20 | Pawn Structure Essentials | 1000–1200 |
| 21 | King Safety and Attacking the King | 1000–1200 |
| 22 | Making a Plan | 1000–1200 |
| 23 | Rook Endgames | 1000–1200 |
| 24 | Advanced Tactics and Calculation | 1200–1500 |
| 25 | Middlegame Strategy | 1200–1500 |
| 26 | Endgame Technique | 1200–1500 |
| 27 | Practical Play and Psychology | 1200–1500 |
| 28 | Analyzing Your Games and Training for Life | 1200–1500 |

Opening repertoire (decided — chapters 12/13 develop it, others may refer to it):
* **White:** 1.e4. vs 1...e5: 2.Nf3 Nc6 3.Bc4 — Italian Game with c3/d3 (Giuoco
  Pianissimo); vs 3...Nf6 play 4.d3 (calm, sidesteps the Two Knights' sharp theory).
  vs Petrov 2...Nf6: 3.Nxe5 d6 4.Nf3. vs Philidor 2...d6: 3.d4. vs Sicilian: 2.c3 (Alapin).
  vs French: 3.exd5 (Exchange) after 1.e4 e6 2.d4 d5. vs Caro-Kann: 3.exd5 cxd5 4.Bd3
  (Exchange). vs Scandinavian: 2.exd5 Qxd5 3.Nc3. vs Pirc/Modern: Nc3, Nf3, Be2, O-O.
  vs Alekhine: 2.e5 Nd5 3.d4 d6 4.Nf3.
* **Black vs 1.e4:** 1...e5 2.Nf3 Nc6. vs 3.Bc4: 3...Bc5 (Giuoco Piano). vs 3.Bb5:
  3...a6 4.Ba4 Nf6 5.O-O Be7 (Closed Ruy, main ideas only). vs 3.d4: 3...exd4 4.Nxd4 Nf6
  (Scotch). vs early Qh5 / Bc4 (Scholar's attempts): ...g6/...Qe7/...Nf6 at the right moment.
  vs 2.Nc3 / 2.d4 / 2.f4: simple principled replies.
* **Black vs 1.d4:** 1...d5 with a Queen's Gambit Declined set-up (...e6, ...Nf6, ...Be7,
  ...O-O, ...c6/...Nbd7). vs London (2.Bf4): ...Nf6, ...e6, ...c5. vs 1.c4 / 1.Nf3 /
  others: ...Nf6, ...d5, ...e6, ...Be7, ...O-O.
