---
chapter: 19
slug: piece-activity
title: Piece Activity
subtitle: Count the squares, find the worst piece, improve it
part: 4
stage: "1000–1200"
skills: [piece-activity, outpost, open-file, bishop-vs-knight, planning]
objectives:
  - Judge whether a piece is active or passive by counting the squares and targets it controls.
  - Find your worst-placed piece and a concrete route to improve it.
  - Recognize outposts, good and bad bishops, and knights stranded on the rim.
  - Use rooks on open and half-open files, double them, and invade the seventh rank.
  - Centralize the king in the endgame and trade your bad pieces for your opponent's good ones.
next_game: When there is no tactic on the board, ask "which of my pieces is doing the least?" and spend your move improving that piece — after a blunder check.
---

You have reached the position every improving player knows. No checks, no captures, no threats. Nothing is hanging. Your opponent has made a quiet move and you stare at the board, wanting to "do something". So you push a pawn, or shuffle a rook, and ten moves later you are worse without having blundered anything.

Between 1000 and 1200, more games are lost this way than you might think. The cure is not a secret plan. It is one question that always has an answer: **which of my pieces is doing the least, and where would it do more?** This chapter teaches you to measure activity, spot the pieces that matter most, and make the quiet improving move that strong players seem to find by instinct.

## Active and passive pieces

A piece is **active** when it controls many squares, attacks targets, or restricts the enemy. It is **passive** when it only defends, is blocked by its own pawns, or has few safe squares to go to. Piece values from [Chapter 3](#ch-03) are averages: a knight is "worth three" only when it has squares. A trapped knight is worth much less, a dominant one much more.

The simplest way to judge activity at the board is to count. For each piece ask:

* **Squares:** how many safe squares can it move to?
* **Targets:** does it attack anything — weak pawns, key squares, the king's zone?
* **Future:** can it get to a better square in one or two moves?

```board
fen: 5k2/p3bppp/1p1p4/4p3/2P1P3/2N5/PP3PPP/6K1 w - - 0 25
caption: Equal material, unequal pieces. White's knight is heading for d5, where no black pawn can ever attack it. Black's bishop on e7 is hemmed in by its own pawns on d6 and e5.
arrows: c3d5
squares: d5 d6 e5
```

Count in this position. White's knight on c3 has six squares now, and it can jump to d5, from where it would attack b6, c7, e7 and f6. Black's bishop on e7 has only four squares, all on the edge of the action, and its own pawns on d6 and e5 sit on the colour it needs. On paper material is equal. In practice White is playing with a better piece, and the engine agrees that White is clearly more comfortable.

:::key Activity is a number you can count
Count squares and targets for each piece. The side whose pieces have more of both is usually the side with the better position, even when material is equal.
:::

### The worst-placed piece

Strong players use a simple trick in quiet positions: they look for their **worst-placed piece** and ask how to improve it. This works because a position is only as strong as its weakest link. One sleeping rook or a bishop staring at its own pawns can be the difference between pressure and passivity.

The procedure is short. Count each of your pieces' squares and targets. Pick the one doing the least. Then find a route — usually two or three moves — to a square where it would do more. Before you play the first move of the route, run your blunder check: is the route safe, and what is your opponent threatening meanwhile?

The worst-placed piece is often a knight on the edge of the board, a bishop behind its own pawns, or a rook still on its starting square while the game happens elsewhere. In the endgame it is very often the king, still sheltering on g1 when it should be walking to the centre.

:::mistake Improving a piece that is already fine
A common error is to move your best piece again because it is the one you like looking at. If your queen is already active, moving it to an "even better" square while a rook sleeps on a1 wastes a tempo. Improve the worst piece, not the favourite.
:::

## Knights: outposts and the rim

### Outposts

An **outpost** is a square in or near the opponent's half of the board that **cannot be attacked by an enemy pawn**. Ideally it is also **supported by one of your own pawns**, so that if the opponent trades a piece for the occupant, you can recapture with a pawn. Knights love outposts, because a knight needs to be close to the action and hates being chased by pawns.

```board
fen: r3r1k1/1p2bppp/p2p4/3Np3/4P3/8/PPP2PPP/R4RK1 w - - 0 20
caption: d5 is a model outpost. Black has no c-pawn and the e-pawn has already passed e6, so no black pawn can attack d5; White's e4 pawn supports the knight.
squares: d5
arrows: e4d5
```

To check whether a square is an outpost, look at the enemy pawns on the two **adjacent files**. For d5 that means Black's c- and e-pawns. If neither can ever reach c6 or e6 to attack d5 — because they have advanced past, been exchanged, or are blocked — the square is a permanent home. Black's only way to remove the knight is to give up a piece for it.

This is why the pawn move ...e5 in the Sicilian or the Italian has a cost: it gains space and controls d4, but it gives up control of d5 for ever. Pawns cannot move backwards, a theme we return to in [Chapter 20](#ch-20).

### Knights on the rim

"A knight on the rim is dim" is one of the oldest chess sayings, and it is usually right. A knight in the centre controls eight squares; on the edge it controls four, and in the corner only two. Worse, a knight on the edge has few retreats, which makes it easy to trap.

```board
fen: r2q1rk1/1b2bppp/p1pp1n2/n3p3/4P3/2PB1N2/PP1N1PPP/R1BQR1K1 w - - 0 12
caption: Black's knight on a5 has no safe square. b3 and c4 are covered, b7 and c6 are blocked by Black's own pieces. White to move traps it with a pawn.
arrows: b2b4
red: a5b3 a5c4
squares: a5
```

Look at the knight's possible squares: b3 (covered by the a2 pawn and the knight on d2), c4 (covered by the bishop and the knight), b7 (Black's own bishop) and c6 (Black's own pawn). After b2-b4 it has nowhere to go.

```line
fen: r2q1rk1/1b2bppp/p1pp1n2/n3p3/4P3/2PB1N2/PP1N1PPP/R1BQR1K1 w - - 0 12
moves: 12.b4 Qc7 13.bxa5
check: engine
caption: The knight is lost; Black's best is to accept it and look for counterplay a piece down.
```

The lesson for your own games has two sides. Before you put a knight on the edge, check its way back. And when your opponent's knight goes to the rim, count its retreats — a pawn move may win it.

:::coach When the rim is fine
Coaching judgment: a knight on the edge is acceptable when it has a specific job and a clear way back — for example ...Na5 to trade off a bishop on b3, or Nh4 to jump to f5. It is a temporary visit, not a home. If you cannot name the job and the route back, do not go.
:::

## Bishops: good, bad and blocked

A bishop moves on one colour only. Your own pawns therefore decide much of its future. A **good bishop** has its own centre pawns on the *other* colour, so its diagonals are open. A **bad bishop** has its own centre pawns fixed on its *own* colour, so it bites on granite and mostly defends.

```board
fen: 2r2k2/3b1p1p/p3p1p1/1p1pP3/1P1P1P2/P2B2P1/5K1P/2R5 w - - 0 30
caption: Same-coloured bishops, very different futures. All of Black's pawns stand on light squares, so the d7-bishop can only defend them. White's pawns are on dark squares and the d3-bishop attacks b5 and g6.
squares: d7 d3
arrows: d3b5
```

"Bad" does not mean useless. A bad bishop often defends its pawns perfectly well. The problem is that it cannot attack anything, so its owner must sit and wait while the other side improves. In an endgame that difference often decides the game.

What can you do about a bad bishop?

* **Trade it.** Offer an exchange for your opponent's good bishop (a French Defence player plays ...b6 and ...Ba6 to trade the light-squared bishops).
* **Put it outside the pawn chain.** Bring it out *before* the pawns lock it in — in the French, some players develop the bishop to b7 or via d7-e8-h5.
* **Change the pawn structure.** A pawn break such as ...f6 or ...c5 can open lines for it.

And from the other side: if your opponent has a bad bishop, keep the pawns where they are, avoid trading your good minor piece for it, and play on the colour it cannot cover.

:::key Trade bad pieces, keep good ones
When you can exchange your worst piece for your opponent's best piece, the position usually improves for you even though "material is equal". Ask before every exchange: which piece leaves the board, and which one stays?
:::

## Rooks: files, doubling and the seventh rank

Rooks are often the last pieces to join the game. They need open lines. An **open file** has no pawns of either colour on it; a **half-open file** has only the opponent's pawn on it, which gives your rook a target.

Three rules of thumb cover most rook decisions at this level:

1. **Put rooks on open files** — or on the file you expect to open after a pawn exchange. The first rook to arrive usually owns the file.
2. **Double them.** Two rooks on the same file are much stronger than one each; the front rook can invade while the rear rook supports it.
3. **Aim for the seventh rank.** A rook on the seventh (the second, for Black) attacks pawns that cannot be defended by other pawns, and it cuts the enemy king off on the back rank.

```board
fen: r4rk1/pp3ppp/2p1pn2/8/3P4/4PN2/PPR2PPP/2R3K1 w - - 0 20
caption: White's rooks are doubled on the half-open c-file and aim at c6. Black's rooks are still looking for a job.
squares: c6
arrows: c2c6
```

```board
fen: r4b1k/pp3pp1/2p4p/8/4N3/2P4P/PP3PP1/3R2K1 w - - 0 24
caption: White owns the only open file. Rd7 puts the rook on the seventh rank, where it attacks b7 and f7 and ties Black's pieces to their defence.
arrows: d1d7
squares: b7 f7
```

```line
fen: r4b1k/pp3pp1/2p4p/8/4N3/2P4P/PP3PP1/3R2K1 w - - 0 24
moves: 24.Rd7 Re8 25.f3
check: engine
caption: Black's rook finally becomes active, but White calmly covers e2 and keeps the rook on the seventh. Black must spend the next moves defending b7 and f7.
```

Two more ideas belong here briefly. A **rook lift** brings a rook from the first rank up the board and sideways — for example Re1-e3-g3 or Rf1-f3-h3 — to attack the king when the files are closed; [Chapter 21](#ch-21) shows it in action. And in the endgame, an **active rook** behind enemy lines is often worth more than a pawn. If you must choose between passively guarding a pawn and counter-attacking with the rook, look hard at the counter-attack first. [Chapter 23](#ch-23) develops this.

:::mistake The rook that never moves
Count how many games you finish with a rook still on a1 or h1. Before move 20, ask once: "Have both my rooks found a file?" If not, the next quiet move should probably be a rook move.
:::

## The king and queen in the endgame

In the middlegame the king hides. When the queens come off and only a few pieces remain, mating attacks become unlikely and the king turns into a strong fighting piece. It should walk to the centre, where it supports its own pawns, attacks the opponent's, and stops passed pawns.

Count king moves in such endings. If your king needs four moves to reach the centre and your opponent's needs three, a "useful" pawn move on the wing usually just hands him the race. The exercises at the end of this chapter include two king races, one for each colour.

The same principle applies to the queen in a queen ending: a queen in the centre covers both wings, gives fewer free checks to the opponent and can switch to attack in one move. A queen in the corner usually ends up defending.

## Space

**Space** is the territory behind your pawn chain where your pieces can move freely. If your pawns stand on the fourth and fifth ranks and your opponent's on the second and third, you have more room to manoeuvre, and he may find his pieces stepping on each other's toes.

Two practical rules follow:

* **With more space, avoid unnecessary exchanges.** Every trade gives the cramped side more room to breathe.
* **With less space, look for exchanges and pawn breaks.** Trading a pair of minor pieces, or striking at the opponent's pawn chain, frees your position.

Space is an advantage only if you use it. Pawns pushed too far can become targets, and space is not worth weakening your own king for.

## Worked example: getting the knight to its outpost

Let us put the chapter together in one position. Follow the thinking, not just the moves.

```board
fen: r4rk1/1p2bppp/p2p1n2/4p1B1/4P3/2N5/PPP2PPP/3R1RK1 w - - 0 15
caption: White to move. Queens are off. White's knight wants d5; Black's knight on f6 guards that square.
squares: d5
arrows: c3d5
```

**Evaluate.** First the safety scan: no white piece is attacked, and Black threatens nothing immediate. Now count activity. White's rook on d1 already presses on d6, the bishop pins nothing but annoys the f6-knight, and the knight on c3 would be magnificent on d5 — an outpost, since Black has no c-pawn and the e-pawn has passed e6. Black's worst piece is the bishop on e7, which is hemmed in by d6 and e5. Black's weakness is the backward pawn on d6, defended only by that bishop.

**Plan.** The plan is obvious: knight to d5. The question is how. The square d5 is guarded by one black piece, the knight on f6. If White simply plays Nd5, that knight can take.

**Candidate moves.** 15.Nd5, 15.Bxf6, and a quiet developing move such as 15.Rfe1.

**Opponent's best reply to each.** Check 15.Nd5 first, because it is the move you want to play:

```line
fen: r4rk1/1p2bppp/p2p1n2/4p1B1/4P3/2N5/PPP2PPP/3R1RK1 w - - 0 15
moves: 15.Nd5? Nxd5 16.Bxe7 Nxe7
check: engine
caption: The routine move loses a piece. The knight on d5 was not yet on an outpost: an enemy piece could still take it, and the exchange on e7 does not come back with check.
```

Now 15.Bxf6. Giving the bishop for the knight looks like a concession, but it removes the only defender of d5 *and* deflects the e7-bishop, which is also the only defender of d6.

```line
fen: r4rk1/1p2bppp/p2p1n2/4p1B1/4P3/2N5/PPP2PPP/3R1RK1 w - - 0 15
moves: 15.Bxf6 Bxf6 16.Rxd6
check: engine
diagram: end
caption: White wins the d6 pawn, and the knight still has d5 waiting. Black's remaining bishop cannot challenge a knight on a light square.
```

**Move.** 15.Bxf6. The blunder check is short: after 15...Bxf6 nothing of White's hangs, and if Black does not recapture he is simply a piece down. The thinking pattern is the one to copy: you wanted a square, you counted who guards it, and you removed the guard first. The bishop-for-knight trade also made sense in the language of this chapter — White traded a bishop that had no outpost for the piece that defended the key square, leaving his best piece against Black's worst.

:::example What the worked example teaches
* An outpost is only safe when no enemy *piece* can simply take the occupant for free.
* "Remove the guard, then occupy" is a two-step plan you can use with knights, rooks and even the king.
* Trading a good-looking piece is correct when it leaves your best piece facing their worst.
:::

## Finding activity in your own games

When you review a game (see [Chapter 28](#ch-28)), stop at every quiet move and answer two questions: *which of my pieces had the fewest squares?* and *did my move improve it?* You will usually find the same culprits game after game — a bishop locked behind your pawns, a rook that waited until move 30, a king that stayed home in the endgame. That pattern is your training plan.

A second habit: before every exchange, name the pieces. "My bad bishop for his good knight" is a trade you want. "My active knight for his passive bishop" is one you should refuse unless it wins something concrete.

:::nextgame In your next game
On every quiet move, point (mentally) at your worst piece before choosing your move. If you can improve it safely, do it. In the endgame, move your king toward the centre at the first safe moment.
:::

## Practice at the board

Set up each position on a board or in a free analysis app and play it out against a friend or the engine at a modest level.

1. **The knight race.** FEN `5k2/p3bppp/1p1p4/4p3/2P1P3/2N5/PP3PPP/6K1 w - - 0 25`. Play White. Get your knight to d5 and your king to d3, then try to win the b6 or a7 pawn. Then swap sides and try to hold with Black. Notice how little the bad bishop can do.
2. **The seventh rank.** FEN `r4b1k/pp3pp1/2p4p/8/4N3/2P4P/PP3PP1/3R2K1 w - - 0 24`. Play White: 24.Rd7, and keep the rook on the seventh as long as possible. Check yourself: after ten moves, how many black pawns have you won, and how many black pieces are stuck defending?
3. **King march.** FEN `5k2/pp3ppp/2n5/8/8/2N1K3/PP3PPP/8 b - - 0 30`. Play Black twice against a friend or the engine: once starting with 30...Ke7, once with 30...a5. Compare where the kings stand five moves later.
4. **Square count drill.** Take any middlegame from your recent games. For each piece, write down how many safe squares it has. Circle the lowest number. Ask the engine whether improving that piece was a good idea.

## Chapter summary

* A piece is active when it has squares, targets and a future; count them.
* In quiet positions, find your worst-placed piece and improve it — after a blunder check.
* An outpost is a square no enemy pawn can attack, ideally supported by your own pawn. Remove any piece that guards it before you occupy it.
* Knights on the rim have few squares and few retreats; count the retreats before you go there, and look for traps when your opponent does.
* A bad bishop is blocked by its own pawns on its colour. Trade it, get it outside the chain, or change the structure.
* Rooks belong on open and half-open files; double them and aim for the seventh rank.
* In the endgame the king is a fighting piece: centralize it early.
* Trade your bad pieces for your opponent's good ones; with more space, avoid unnecessary trades.

:::cheat Piece activity — the quiet-move procedure
1. Safety scan first: checks, captures and threats for both sides.
2. Count squares and targets for each of your pieces; name your worst piece.
3. Find a two- or three-move route that improves it (outpost, open file, seventh rank, centre).
4. If an enemy piece guards the target square, plan to remove or exchange it first.
5. Before any exchange, ask which piece leaves and which stays — trade bad for good.
6. Blunder-check the first move of the route, then play it.
:::

@exercises
