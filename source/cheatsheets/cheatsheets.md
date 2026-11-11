---
kind: cheatsheets
slug: cheat-sheets
title: The Elo Cheat Sheets
---

## 1 · The safety scan: blunder prevention

:::cheat Their last move — three questions
1. **What does it attack?** Count attackers and defenders on that target.
2. **What did it stop defending?** The piece that moved may have been a guard.
3. **What line did it open?** A moved piece can unmask a bishop, rook or queen behind it.
:::

:::cheat My candidate move — the blunder check
1. After my move, list **every check, capture and threat** my opponent has.
2. Does my moved piece **stop guarding** something?
3. Is the destination square **safe**? (attackers vs. defenders, lowest-value attacker)
4. Did I **open a line** to my king or queen?
5. If any answer worries you: pick another candidate.
:::

| Habit | Why it works |
|---|---|
| Sit on your hands until the scan is done | Most blunders are moves played before the check was finished. |
| Say "check, capture, threat" for both sides | Forcing moves are where games are won and lost. |
| Look at the edges and corners of the board | Long diagonals and edge pieces are the most-missed. |
| Write the move down before playing it (OTB) | Gives the scan a natural pause. |
| Play slow games (15+10 or slower) | You cannot build the habit in bullet. |

**Piece values (a guide, not a law):** pawn 1 · knight 3 · bishop 3 · rook 5 · queen 9. A bishop pair is worth a little more in open positions. Activity, king safety and threats can outweigh material.

**Is it safe to take?** Count attackers and defenders on the square; capture with the **lowest-value piece first**; remember that a capture can unmask a new defender (x-ray) or walk into a pin.

## 2 · Tactics recognition

| Motif | Trigger to look for | Typical move |
|---|---|---|
| **Fork** | Two loose pieces (or king + piece) a knight's jump or a queen's line apart | Knight check that also hits a rook |
| **Pin** | Valuable piece behind a less valuable one on a line | Bishop to b5/g5; then attack the pinned piece with a pawn |
| **Skewer** | Valuable piece *in front* of a less valuable one on a line | Rook or bishop check; take what is behind |
| **Discovered attack** | Your piece sits between your long-range piece and a target | Move the front piece with a threat of its own |
| **Double check** | A discovered check where the front piece also checks | King must move — often mate |
| **Removing the defender** | One enemy piece guards everything | Capture, chase or block that guard |
| **Overloading** | One defender with two jobs | Hit one job; the other collapses |
| **Deflection** | A defender that must stay put | Offer material to drag it away |
| **Decoy** | A king or queen that would be forkable/matable on another square | Sacrifice to lure it there |
| **Trapped piece** | A piece with no safe squares (knight on the rim, bishop on a7/h7) | Take away its last square, then attack it |
| **Zwischenzug** | You are "forced" to recapture | First insert a check or bigger threat |
| **Back rank** | King behind unmoved pawns, no luft | Rook or queen to the 8th/1st rank |

```board
fen: r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1
caption: Knight fork — Nc7+ attacks the king and the rook.
arrows: d5c7
blue: c7e8 c7a8
```

```board
fen: 3q4/8/8/8/3k4/8/6K1/7R w - - 0 1
caption: Skewer — Rd1+ and the queen behind the king falls.
arrows: h1d1
blue: d1d8
```

```board
fen: q3k3/8/8/8/4B3/8/8/4R1K1 w - - 0 1
caption: Discovered check — Bxa8+ wins the queen while the rook checks.
arrows: e4a8
red: e1e8
```

```board
fen: 4k3/8/2n5/1B6/8/8/8/4K3 w - - 0 1
caption: Absolute pin — the c6-knight cannot legally move.
red: b5e8
```

## 3 · Checkmate patterns

| Pattern | Picture |
|---|---|
| **Back-rank mate** | Rook/queen on the last rank; king walled in by its own pawns |
| **Smothered mate** | Knight mates a king surrounded by its own pieces (Nf7#, often after Qg8+ Rxg8) |
| **Anastasia's mate** | Knight on e7 + rook/queen on the h-file vs. a king on h7 |
| **Arabian mate** | Rook on h7/h8 protected by a knight on f6 |
| **Boden's mate** | Two crossing bishops vs. a king castled queenside with blocked c- and d-squares |
| **Queen + supporter** | Queen lands next to the king protected by a pawn, bishop or knight (Qg7#, Qh7#) |
| **Ladder (lawnmower)** | Two heavy pieces taking turns to cut off rank after rank |
| **Légal pattern** | Queen sacrifice; three minor pieces deliver mate |

```board
fen: 6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1
caption: Back-rank mate — Rd8#. Prevention: make luft (h3/h6) in time.
arrows: d1d8
```

```board
fen: 6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1
caption: Smothered mate — Nf7#. The king's own pieces take every flight square.
arrows: g5f7
```

## 4 · Opening principles and your repertoire

:::cheat The opening in seven rules
1. Fight for the centre with pawns (e4/d4, …e5/…d5) and pieces.
2. Develop knights and bishops toward the centre; usually knights first.
3. Castle early, usually kingside.
4. Move each piece once in the opening unless there is a concrete reason.
5. Do not bring the queen out early — it gets chased with gain of time.
6. Avoid pointless pawn moves, especially f-pawn moves that open your king.
7. Connect your rooks, then find a plan from the pawn structure.
:::

| You play | Against | Your set-up |
|---|---|---|
| White | 1…e5 | 2.Nf3 Nc6 3.Bc4 — Italian: c3, d3, O-O, Re1, Nbd2–f1–g3, h3 |
| White | 1…c5 (Sicilian) | 2.c3 (Alapin) — aim for d4 |
| White | 1…e6 (French) | 2.d4 d5 3.exd5 exd5 — Bd3, Nf3, O-O, c3, Re1 |
| White | 1…c6 (Caro-Kann) | 2.d4 d5 3.exd5 cxd5 4.Bd3 — c3, Bf4, Nf3 |
| White | 1…d5 (Scandinavian) | 2.exd5 Qxd5 3.Nc3 — gain time on the queen, then d4 |
| Black | 1.e4 | 1…e5 2.Nf3 Nc6; vs 3.Bc4 Bc5; vs 3.Bb5 a6, Nf6, Be7, O-O |
| Black | 1.d4 | 1…d5 with …e6, …Nf6, …Be7, …O-O, …Nbd7/…c6 |
| Black | London (Bf4) | …Nf6, …e6, …c5, …Nc6, …Bd6 |
| Black | anything else | …Nf6, …d5, …e6, …Be7, …O-O |

**Traps to know:** Scholar's mate (Qh5 + Bc4 vs f7) — defend with …g6 or …Qe7 *before* …Nf6 if the queen is on h5, then chase the queen. Fool's mate — never weaken with f3/f6 + g4/g5. Légal's mate — do not take the queen if it allows three minor pieces to mate. 2…f6? is met by 3.Nxe5!.

## 5 · Defensive procedures

:::cheat When something is attacked — the defensive menu
1. **Capture** the attacker (if safe).
2. **Move** the target to a safe, useful square.
3. **Defend** it with a piece (preferably cheaper than the attacker).
4. **Block** the line (interpose), ideally with tempo.
5. **Counter-attack** something bigger — only if you have checked it.
:::

:::cheat Saving bad positions
1. Look for **perpetual check** whenever the enemy king is exposed.
2. Look for **stalemate tricks** when your king has no moves.
3. Activate your worst piece; passive defence usually loses slowly.
4. Keep pieces on when behind; trade when it kills their attack.
5. Make every move ask a question.
:::

## 6 · Endgame essentials

| Ending | What to know |
|---|---|
| K+Q vs K | Restrict the king with the queen a knight's move away; bring your king; **avoid stalemate** |
| K+R vs K | Shrink the box with the rook; use the opposition; waiting moves |
| K+P vs K | King in front of the pawn; key squares; opposition; rook pawn often draws |
| Rule of the square | If the defending king can step into the pawn's square, it catches the pawn |
| Rook endings | Rook **behind** passed pawns; active rook; cut off the king |
| Lucena (winning) | Build a bridge: rook to the 4th rank to block checks |
| Philidor (drawing) | Rook on your 3rd rank until the pawn advances, then check from behind |
| Opposite bishops | Very drawish with few pawns — but strong for the attacker in the middlegame |
| Wrong bishop | Bishop + rook pawn whose promotion square is the wrong colour often draws |

```board
fen: 7k/8/8/p7/5K2/8/8/8 w - - 0 1
caption: Rule of the square — White to move steps into the a5-pawn's square (Ke4) and catches it.
squares: a5 a1 e1 e5
arrows: f4e4
```

```board
fen: 2K5/2P1k3/8/8/8/8/1r6/3R4 w - - 0 1
caption: Lucena position — White wins by Re1+ and then building a bridge on the 4th rank.
arrows: d1e1
```

```board
fen: 4k3/8/r7/4PK2/8/8/8/7R b - - 0 1
caption: Philidor position — Black keeps the rook on the 6th rank; after e6 it goes behind and checks.
squares: a6
```

:::cheat Endgame mindset
1. Activate the king — it is a strong piece now.
2. Passed pawns must be pushed (and blockaded when they are the opponent's).
3. Do not hurry: improve everything before the decisive break.
4. Count tempi in races — exactly.
5. Before trading into a pawn ending, calculate it to the end.
:::

## 7 · Practical game plans

| Phase | Your job | Common mistake |
|---|---|---|
| Opening (moves 1–12) | Develop, castle, fight for the centre, follow your repertoire | Early queen raids, pawn grabbing |
| Early middlegame | Finish development, connect rooks, find a plan from the structure | Starting an attack with two pieces |
| Middlegame | Improve the worst piece, target weaknesses, calculate forcing moves | Moving without a reason |
| Ahead in material | Trade, simplify, stop counterplay | Relaxing and blundering |
| Behind in material | Activity, threats, complications, perpetual | Passive resignation |
| Endgame | King activity, passed pawns, technique | Rushing; stalemating |

**Thinking time.** Spend it on critical moments: captures, checks, pawn breaks, trades into endings and whenever the position changes character. Play obvious recaptures quickly after a quick safety scan.

## 8 · The improvement loop

:::cheat Learn → Solve → Play → Analyze → Fix → Repeat
1. **Learn** one skill (one chapter section).
2. **Solve** exercises on that skill; aim for 80 % first-try accuracy.
3. **Play** slow games and try to use the skill.
4. **Analyze** each game *yourself first*: find the turning points and label the mistakes.
5. **Fix**: add each mistake to your journal; turn it into an exercise.
6. **Repeat**: re-solve misses after 1, 3, 7 and 21 days; mix old and new.
:::

| Mistake category | Study |
|---|---|
| hanging-piece | Ch. 3–4 · safety scan every move |
| missed-tactic | Ch. 7–10, 24 · daily tactics |
| missed-mate | Ch. 5, 11 · mate patterns |
| king-safety | Ch. 6, 21 |
| calculation | Ch. 14–15, 24 |
| opening | Ch. 6, 12–13 |
| endgame | Ch. 5, 18, 23, 26 |
| missed-win / conversion | Ch. 16 |
| positional | Ch. 19, 20, 22, 25 |
| time-psychology | Ch. 27 |
