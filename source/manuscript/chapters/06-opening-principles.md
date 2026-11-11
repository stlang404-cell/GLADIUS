---
chapter: 6
slug: opening-principles
title: Opening Principles and Early Traps
subtitle: Get your pieces out, get your king safe, and do not fall for the classics
part: 1
stage: "400–600"
skills: [opening-principles, opening-traps, castling]
objectives:
  - Apply the core opening principles - centre, development, castling, connected rooks - and know their common exceptions.
  - Avoid the typical beginner errors - early queen moves, moving one piece repeatedly, pointless pawn moves, especially with the f-pawn.
  - Defend against Scholar's Mate and punish the early queen with gains of tempo.
  - Recognize Fool's Mate, Légal's Mate and the Fried Liver danger, and punish early f-pawn moves.
next_game: In the first ten moves of your next game, before each move ask "Does this move develop a piece, fight for the centre, or get my king safe?" and if your opponent's queen or bishop is aiming at f7 (or f2), check that it is defended before you do anything else.
---

A typical game at the 400 level begins like this. White plays 1.e4, Black answers 1...e5, and White brings the queen out on move two to attack f7. Black does not notice, develops a knight to the "natural" square, and is checkmated on move four. In the next game the roles are reversed: the player who has learned to attack f7 brings the queen out early, gets it chased around the board, and loses because no other piece has moved.

The opening is not about memorising long lines. At this level it is about a handful of principles that keep your position healthy, and a handful of traps you must know from both sides. This chapter gives you both. [Chapter 12](#ch-12) and [Chapter 13](#ch-13) then build your actual repertoire on these foundations.

## The three jobs of the opening

Every sound opening plan does the same three jobs in the first ten or so moves:

1. **Fight for the centre.** The four central squares, d4, d5, e4 and e5, are the most valuable squares on the board.
2. **Develop your pieces.** Bring the knights and bishops off the back rank to active squares.
3. **Make your king safe.** Castle, usually on the kingside, and connect your rooks.

If a move does one of these jobs, it is probably a reasonable opening move. If it does none, ask why you are playing it. That single question would save most beginners dozens of games.

### Control the centre

Pieces in the centre reach more squares, and pieces that reach more squares are stronger. A knight on e4 attacks eight squares; a knight on a1 attacks two. The centre is also the crossroads of the board: pieces placed there can switch quickly to either wing.

```board
fen: rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2
caption: After 1.e4 e5 each side has a pawn in the centre. The four central squares are the prize; most good opening moves fight for them.
squares: d4 d5 e4 e5
```

You fight for the centre in two ways: by **occupying** it with pawns (1.e4, 1.d4) and by **controlling** it with pieces that aim at it (a knight on f3 hits e5 and d4). In the repertoire of this book you start with 1.e4 as White and answer 1.e4 with 1...e5 as Black, which puts a pawn in the centre at once.

### Develop: knights usually before bishops

**Development** means moving a piece from its starting square to a square where it does useful work. In the opening, try to move each minor piece once, to a good square, before you move any piece twice.

A strong guideline is **knights before bishops**. Knights have one or two natural squares (f3 and c3 for White, f6 and c6 for Black), and they are needed early to fight for the centre. Bishops have more choices, and it often pays to wait a move to see where the opponent's pieces go before deciding. This is a guideline, not a law: in the Italian Game, for example, White plays 3.Bc4 before the queen's knight comes out, because the bishop has an obvious good square.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O
check: engine
caption: The Giuoco Pianissimo from your White repertoire. Both sides develop, support the centre, and castle within six moves.
```

```board
fen: r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7
caption: After six moves each side has developed two minor pieces, put a pawn in the centre, and castled. The remaining job is to develop the queen's knight and bishop and connect the rooks.
squares: g1 g8
```

### Castle early and connect your rooks

The king in the centre is in danger as soon as the centre opens. **Castling** moves the king to the side, behind a wall of pawns, and brings a rook toward the centre in one move. Aim to castle within the first ten moves in most games. Kingside castling is usually faster because only two pieces need to move out of the way.

Once you have castled, leave the three pawns in front of your king alone for as long as you can. Each of those pawn moves creates a hole that enemy pieces can use later. A common beginner habit is to castle and then push the h-pawn or g-pawn "to make room"; usually this only weakens the shelter you just built. The exception is a quiet h3 (or ...h6) played to stop an annoying pin or to give the king a flight square against back-rank mates, which Chapter 4 showed can matter a great deal.

Queenside castling (O-O-O) is also legal and sometimes good, but it takes longer to prepare, because three pieces must leave the back rank, and the king on c1 (or c8) is often more exposed. Until you have more experience, castle kingside unless you have a clear reason not to.

After castling, finish development until your two rooks see each other along the back rank, with nothing between them. Then the rooks are **connected**: they defend each other and can move to the central files, where they will be needed when the position opens. Connecting the rooks is a good sign that your opening is over.

:::key A ten-move checklist
By about move 10, try to have:
1. At least one pawn in the centre, or pieces controlling it.
2. All four minor pieces developed.
3. Your king castled.
4. Your rooks connected.
If you are far from this, your opponent probably is not, and that is a problem.
:::

### Why f7 and f2 are the weak points

At the start of the game, every pawn in front of the king is defended by at least one other piece, except one. The pawn on f7 is defended only by the king (and the same is true of f2 for White). That makes it the natural first target for an early attack: a queen on h5 or f3, a bishop on c4 and a knight on g5 can all aim at it.

Once you castle kingside, a rook stands on f8 (or f1) and defends the f-pawn as well, and the danger mostly disappears. This is one more reason to castle early: it fixes the weakest square in your position. Until you have castled, treat f7 like a piece that must always be defended at least as many times as it is attacked.

### Counting development

A simple way to judge an opening position is to count developed pieces. Count each knight and bishop that has left its starting square, add one if the king has castled, and compare the totals. If you are two or more moves behind, avoid opening the position and finish developing first. If you are two or more moves ahead and the enemy king is still in the centre, look for ways to open lines: that is when attacks succeed.

This count is a rough tool, not an exact rule. A developed piece on a bad square, such as a knight on the rim at a3 or h6, is worth less than one on a good square. But at this level the count is usually right about who is better.

## What not to do in the opening

The principles above tell you what to do. Most opening disasters at the 400–800 level come from breaking one of the "don'ts" below.

### Don't move the same piece twice without a reason

Every move spent moving a piece that is already developed is a move not spent developing another. Two or three wasted moves in the opening can leave you so far behind that your opponent's attack arrives before your pieces do.

There are good reasons to move a piece twice: to capture something, to escape an attack, or to answer a direct threat. "I want to attack something" is not usually a good reason in the first ten moves, because the attack is often easy to meet and the attacker then has to retreat, losing more time.

### Don't bring the queen out early

The queen is your most valuable piece. If it comes out early, your opponent can attack it with pawns and minor pieces, developing with **tempo** (gaining time: making a useful move that also forces your opponent to react). Each time the queen has to move, your opponent gets a free developing move.

```line
fen: startpos
moves: 1.e4 e5 2.Qh5?! Nc6 3.Bc4 g6 4.Qf3 Nf6 5.Qb3? Nd4
check: engine
diagram: end
caption: White's queen has moved three times. Black has developed two knights with tempo, and 5...Nd4 attacks the queen and threatens ...Nxc2+.
```

Notice that each Black move developed a piece and, at the same time, attacked or blocked the queen. That is how you punish an early queen: not by hunting it with your own queen, but by developing with gains of tempo.

:::coach When is an early queen move fine?
Coaching judgment: an early queen move is fine when it wins material safely, when it answers a direct threat, or when it is part of a known sound opening (such as the Scandinavian, 1.e4 d5 2.exd5 Qxd5). At the 400–800 level, the most common early queen move is the attempt at Scholar's Mate below, and it is much less dangerous once you know how to meet it.
:::

You will meet the same idea in a more respectable form in the Centre Game, 1.e4 e5 2.d4 exd4 3.Qxd4. White's queen recaptures in the centre, and Black develops with tempo at once:

```line
fen: startpos
moves: 1.e4 e5 2.d4 exd4 3.Qxd4 Nc6 4.Qe3 Nf6 5.Nc3 Bb4 6.Bd2 O-O 7.O-O-O Re8
check: engine
caption: Black's knight hits the queen, then the other pieces come out with threats against e4. Black has castled and put a rook on the open e-file while White is still sorting out the queen.
```

Nothing dramatic has happened: no piece has been lost. But Black has gained a lead in development simply by attacking the queen with pieces that wanted to move anyway. That is the normal reward for punishing an early queen, and at this level it often turns into a winning attack a few moves later.

### Don't make pointless pawn moves, especially with the f-pawn

Pawn moves cannot be taken back. In the opening, move the centre pawns (usually the e- and d-pawns) to fight for the centre and open lines for the bishops. Moves like a3, h3, a6 or h6 do not develop anything, and moving the f- or g-pawn early can open lines to your king.

The f-pawn is a special case. On f7 (or f2) it shields the king along the e8-h5 diagonal (e1-h4 for White). Moving it early, especially to f6 or f3, opens that diagonal and takes away the knight's best square.

```board
fen: rnbqkbnr/pppp2pp/5p2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3
caption: 2...f6? defends e5, but it opens the diagonal from h5 to the black king and takes the f6-square from the knight. White can punish it at once.
red: d1h5 h5e8
squares: f6
```

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 f6? 3.Nxe5! fxe5? 4.Qh5+ Ke7 5.Qxe5+ Kf7 6.Bc4+
check: engine
diagram: end
caption: After 3...fxe5? 4.Qh5+ the black king has to walk into the open, and White wins back the knight with a huge attack.
```

The best answer to 3.Nxe5 is 3...Qe7, attacking the knight and the e4-pawn:

```line
fen: rnbqkbnr/pppp2pp/5p2/4N3/4P3/8/PPPP1PPP/RNBQKB1R b KQkq - 0 3
moves: 3...Qe7 4.Nf3 Qxe4+ 5.Be2
check: engine
caption: Black has won the pawn back, but White is well ahead in development and Black's king and queen stand awkwardly in the centre.
```

Either way, 2...f6 has made Black's life hard.

### Exceptions are real

Opening principles are strong guidelines, not laws. Some exceptions you will meet:

* **Capturing material** often justifies moving a piece twice or bringing the queen out, as long as you check the opponent's replies first ([Chapter 4](#ch-04)).
* **Useful small pawn moves** exist: h3 (or ...h6) to stop a pin by an enemy bishop on g4 (or g5), c3 to prepare d4, a6 to stop a piece coming to b5.
* **Established gambits** such as the King's Gambit (1.e4 e5 2.f4) move the f-pawn early on purpose, for concrete reasons. They are not for now.
* **Defending against a direct threat** always comes before any principle.

The principle is the default; concrete reasons override it. If you break a principle, you should be able to say exactly what you gain.

### When your opponent leaves the book

Sooner or later your opponent will play a move you have never seen, often on move two or three. This is where the principles earn their keep. You do not need to know the "theory" of 1.e4 e5 2.Nf3 h6 or 1.e4 e5 2.Nc3 a6. Ask the same questions as always: what does the move attack, what does it no longer defend, and what line did it open? If nothing is attacked, answer with a good developing move toward the centre.

Strange opening moves are usually not traps. They are usually just slow. Punish slowness by developing quickly and castling, and your opponent will be the one with problems by move ten.

## Traps every beginner must know

The traps below are the ones you will actually meet. Learn each from both sides: how to avoid it, and how to punish an opponent who falls into it.

### Scholar's Mate

White brings the queen and the light-squared bishop together against f7, which at the start is defended only by the king.

```line
fen: startpos
moves: 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6?? 4.Qxf7#
check: engine
caption: Scholar's Mate. 3...Nf6?? attacked the queen but did nothing about f7.
```

```board
fen: r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4
caption: Checkmate. The queen on f7 is protected by the bishop on c4, and the king cannot take it or escape.
squares: f7
arrows: c4f7
```

**How to defend.** The rule is simple: when an enemy queen and bishop aim at f7, defend f7 or block the line before you do anything else. Which defence is right depends on where the queen is:

* **Queen on h5** (attacking f7 along the diagonal and e5 along the rank): 3...g6! blocks the queen's line and attacks it. 3...Qe7 also defends both f7 and e5. Do not play 3...Nf6??, because the knight does not block the h5-f7 diagonal.
* **Queen on f3** (attacking f7 along the f-file): now 3...Nf6! is exactly right, because the knight on f6 blocks the f-file and develops to its best square.

```line
fen: startpos
moves: 1.e4 e5 2.Qh5 Nc6 3.Bc4 g6 4.Qf3 Nf6
check: engine
diagram: end
caption: The correct defence. 3...g6 gains time on the queen, and when it goes to f3, 4...Nf6 blocks the f-file and develops. Black is already comfortable.
```

From here White's queen is a target. If White carries on with 5.Qb3, you have seen the answer: 5...Nd4!, developing with a threat.

### Worked example: meeting 2.Qh5

Let us walk through Black's thinking after 1.e4 e5 2.Qh5, using the five-question checklist from [Chapter 4](#ch-04).

```board
fen: rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2
caption: White's queen attacks e5 and eyes f7. What does Black need to do?
red: h5e5 h5f7
orientation: black
```

**What is my opponent threatening?** I ask what the queen attacks. Along the fifth rank it hits my e5-pawn, which has no defender, so Qxe5+ is a threat: a capture with check. Along the diagonal it looks at f7, but f7 is defended by my king and only one White piece attacks it, so that is not yet a threat. If the bishop comes to c4, it will be.

**Are any pieces undefended?** My e5-pawn. White's queen on h5 is undefended too, but I cannot attack it with a pawn right now.

**Do I have forcing moves?** Nothing useful: no checks, no good captures.

**Candidate moves.** I want a move that defends e5 and develops. 2...Nc6 does both. 2...d6 defends e5 but blocks my f8-bishop. 2...Nf6?? develops but drops the pawn with check: 3.Qxe5+.

**What is my opponent's strongest reply to 2...Nc6?** Probably 3.Bc4, threatening Qxf7#. Then I will block with 3...g6, attacking the queen. After 4.Qf3, threatening mate again, 4...Nf6 blocks and develops. Every one of my moves develops and answers a threat, and White's queen has moved three times. I choose 2...Nc6.

That is the whole skill: defend the real threats in time, and let your opponent's early queen give you free moves.

### Fool's Mate

The fastest possible checkmate needs the loser's cooperation: two early pawn moves that open the diagonal to the king.

```line
fen: startpos
moves: 1.f3?! e5 2.g4?? Qh4#
check: engine
caption: Fool's Mate. The f- and g-pawns have moved, and the queen mates along the e1-h4 diagonal.
```

```board
fen: rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3
caption: The final position of Fool's Mate. No White piece can block on g3 or capture the queen.
squares: e1
red: h4e1
```

You will rarely see the exact Fool's Mate, but its pattern is common: if your f- and g-pawns have both moved and the diagonal to your king is open, an enemy queen or bishop can check you with no blocking square. The mirror version, with Black playing ...f6 and ...g5, is punished by Qh5#.

### Légal's Mate

This trap, named after the 18th-century French player Légal, shows that a pinned piece is not always pinned. The bishop on g4 "pins" the knight on f3 to White's queen, but White can move the knight anyway, because the queen sacrifice leads to mate.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 d6 3.Bc4 Bg4 4.Nc3 g6? 5.Nxe5! Bxd1?? 6.Bxf7+ Ke7 7.Nd5#
check: engine
caption: Légal's Mate. After 5...Bxd1?? three White minor pieces mate the king that has not castled. Black's best was 5...dxe5 6.Qxg4, only a pawn down.
```

```board
fen: rn1q1bnr/ppp1kB1p/3p2p1/3NN3/4P3/8/PPPP1PPP/R1BbK2R b KQ - 2 7
caption: The final position. The d5-knight gives check and covers f6; the e5-knight protects the bishop and covers d7; the bishop covers e6 and e8.
squares: e7
```

The lessons go both ways. As Black, when an opponent "blunders" the queen, ask what their pieces can do to your king after you take it. As White, remember that a pin against the queen (not the king) is only a relative pin; the pinned piece can still move if the result is good enough.

### The Fried Liver: why 3...Nf6 4.Ng5 is dangerous

In the Two Knights Defence, 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6, White can attack f7 at once with 4.Ng5. Black's best reply is 4...d5, blocking the bishop. After 5.exd5 the natural recapture is a mistake:

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Ng5 d5 5.exd5 Nxd5? 6.Nxf7! Kxf7 7.Qf3+ Ke6 8.Nc3
check: engine
diagram: end
caption: The Fried Liver Attack. Black's king has been dragged to e6 in the middle of the board, and White's pieces pile up against the pinned knight on d5.
```

```board
fen: r1bqkb1r/ppp2ppp/2n5/3np1N1/2B5/8/PPPP1PPP/RNBQK2R w KQkq - 0 6
caption: After 5...Nxd5? the knight blocks the bishop's diagonal only temporarily. 6.Nxf7! sacrifices the knight to pull the king into the open.
red: g5f7 c4d5
squares: f7
```

Theory says Black should play 5...Na5!, attacking the bishop instead of recapturing, and the resulting positions are sharp but fine for Black. That is a lot to learn and easy to get wrong at the board. For this reason the Black repertoire in this book avoids the whole line: after 1.e4 e5 2.Nf3 Nc6 3.Bc4 you will play 3...Bc5, the Giuoco Piano, instead of 3...Nf6. [Chapter 13](#ch-13) explains it in detail. If you meet 4.Ng5 against 3...Bc5, simply castle: the rook on f8 then defends f7.

:::mistake Copying the opponent's attack
Many players learn Scholar's Mate or the Fried Liver and then play them every game. Against careful defence these attacks leave the attacker's queen and knight out of play and the attacker worse. Learn them so you can defend against them, not as your main weapon.
:::

### Punishing early f-pawn moves

You have already seen the main idea: an early ...f6 or ...f5 by Black (or f3 or f4 by White) opens the diagonal toward the king. When your opponent plays such a move, look at once for a queen check on the opened diagonal, and for captures in the centre that the pawn no longer prevents. In 1.e4 e5 2.Nf3 f6?, 3.Nxe5! works precisely because the queen check on h5 is coming.

:::nextgame Your next game
In the first ten moves, before each move ask "Does this develop, fight for the centre, or make my king safer?" Whenever your opponent's queen or bishop aims at f7 (or f2), check that it is defended before anything else.
:::

## Practice at the board

1. Set up `r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3` and find every Black move that stops Qxf7#. Then play 3...g6 4.Qf3 and find the right defence again. Check yourself with an engine: 3...Nf6?? and 3...d6?? should both show mate.
2. Play the Légal's Mate line from the start position until you can do it from memory. Then play it again with Black's best reply 5...dxe5 and see what Black has lost.
3. Set up `rnbqkbnr/pppp2pp/5p2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3` and play 3.Nxe5 against a friend or engine from both sides. Try 3...fxe5 and 3...Qe7 and see which is better.
4. **Drill:** play five quick games (10+5) against an app at a low level, but with one rule: no queen moves before move 8 unless you are capturing or answering a threat. After each game, count how many moves each side spent on development.

## Chapter summary

* The opening has three jobs: fight for the centre, develop the minor pieces, and castle; finish by connecting the rooks.
* Knights usually come out before bishops; move each piece once before moving one twice.
* An early queen gets chased; punish it by developing with gains of tempo.
* Avoid pointless pawn moves, especially early f-pawn moves that open lines to your king.
* Every principle has exceptions; break one only for a concrete reason you can name.
* Against Scholar's Mate, block or defend f7 according to where the queen stands: ...g6 or ...Qe7 against Qh5, ...Nf6 against Qf3.
* Know Fool's Mate, Légal's Mate and the Fried Liver from both sides; your Black repertoire avoids the Fried Liver with 3...Bc5.

:::cheat Opening move check
1. What is my opponent threatening? Is f7 (or f2) attacked twice?
2. Can I develop a piece toward the centre, preferably a knight?
3. Can I castle, or prepare to castle?
4. Am I moving a piece twice, moving the queen early, or making a pawn move that does not help? If so, can I name the concrete reason?
5. Blunder check: after my move, what can my opponent capture or check?
:::

@exercises
