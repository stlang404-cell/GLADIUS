---
chapter: 1
slug: rules
title: The Rules, Completely
subtitle: Every rule you need, including the ones most beginners get wrong
part: 1
stage: "400–600"
skills: [rules, castling, en-passant, promotion, stalemate, basic-mates]
objectives:
  - Set up the board correctly and know exactly how every piece moves and captures.
  - Tell check, checkmate and stalemate apart at a glance.
  - Know every condition for castling, en passant and promotion, including underpromotion.
  - Recognize every way a game can be drawn, and avoid stalemating an opponent you are beating.
  - Follow touch-move, resigning and clock etiquette in over-the-board play.
next_game: Before you castle, capture en passant or promote, run the rule checklist from this chapter; and when you are far ahead, check that your opponent still has a legal move before you play yours.
---

In a club game, a player with a queen against a lone king spends twenty moves chasing it around the board, then plays a natural-looking queen move. The opponent smiles, says "stalemate", and offers a handshake. The game is a draw. In another game, someone wants to castle, sees that their rook is attacked, decides castling must be illegal, and plays a worse move instead.

These are not rare accidents. Players rated 400 to 800 lose a surprising number of half-points and points simply because they are unsure of a rule. This chapter removes that uncertainty. Even if you have played for years, read it with a board in front of you. Most players find at least one rule they had slightly wrong.

## The board and the starting position

The board has 64 squares in eight rows and eight columns. The columns are called **files** and are lettered a to h from White's left to right. The rows are called **ranks** and are numbered 1 to 8 from White's side. Every square therefore has a name, such as e4 or g7. Chapter 2 builds on this.

Two rules decide how the board is placed:

* **Light square on the right.** Each player has a light square in the corner nearest their right hand (h1 for White, a8 for Black). If the corner on your right is dark, turn the board 90 degrees.
* **Queen on her colour.** The white queen starts on the light square d1; the black queen starts on the dark square d8. The kings stand next to them on the e-file.

The rest follows: rooks in the corners, knights next to the rooks, bishops next to the knights, and a row of eight pawns in front.

```board
fen: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1
caption: The starting position. h1 is a light square, the white queen stands on light d1, and the black queen on dark d8. White always moves first.
squares: h1 d1 d8
```

:::mistake The swapped king and queen
The most common set-up error is placing the king and queen the wrong way round. Online this cannot happen, but over the board it happens often, and a game played from a wrong set-up can be invalid. Check "queen on her colour" before every game.
:::

## How the pieces move and capture

A piece **captures** by moving onto a square occupied by an enemy piece and removing it from the board. You can never capture your own pieces, and only the knight can jump over other pieces.

* **King (K):** one square in any direction. The king may never move onto a square attacked by an enemy piece. Kings can therefore never stand next to each other.
* **Queen (Q):** any number of squares along a file, rank or diagonal, as long as the path is clear.
* **Rook (R):** any number of squares along a file or rank.
* **Bishop (B):** any number of squares along a diagonal. A bishop stays on its starting colour for the whole game, so each side has a light-squared bishop and a dark-squared bishop.
* **Knight (N):** an L-shape, two squares in one direction and then one square at right angles. The knight jumps over anything in its way, and always lands on a square of the opposite colour.
* **Pawn:** moves straight forward one square, or two squares on its very first move if both squares are empty. A pawn captures differently from how it moves: one square diagonally forward. A pawn never moves or captures backwards, and a pawn blocked by any piece directly in front of it cannot move straight ahead.

The pawn is the piece beginners most often get wrong. It cannot capture straight ahead, and it cannot move diagonally unless it is capturing. Two pawns facing each other on the same file are both stuck until something changes.

## Check, checkmate and stalemate

A king is in **check** when it is attacked by an enemy piece. You must get out of check immediately. There are only three ways:

1. **Move the king** to a square that is not attacked.
2. **Capture the checking piece.**
3. **Block** the check by putting a piece between the checker and the king (impossible against a knight or a pawn, or when the checker is adjacent).

You are never allowed to make a move that leaves or puts your own king in check. Saying "check" aloud is not required by the rules.

**Checkmate** is check with no legal way out. The game ends immediately and the side delivering checkmate wins. The king is never actually captured.

**Stalemate** is the opposite situation: the side to move is *not* in check, but has no legal move at all. The game ends immediately as a **draw**. Stalemate is the reason a lone king can sometimes save a hopeless position.

```board
fen: 7k/6Q1/5K2/8/8/8/8/8 b - - 0 1
caption: Checkmate. The black king is attacked by the queen on g7, cannot capture it because the white king defends it, and has no safe square.
arrows: f6g7
squares: h8
```

```board
fen: 7k/8/5KQ1/8/8/8/8/8 b - - 0 1
caption: Stalemate, a draw. Black is not in check, but every square next to the black king is covered by the queen on g6. Black has no legal move.
squares: g8 g7 h7
```

These two positions differ by a single square. In the first, White played the queen to g7 with check. In the second, White played it to g6, and threw away a completely winning position.

:::key The "does my opponent have a move?" check
When you are far ahead, especially when your opponent has only a king or a king and blocked pawns, ask before every move: *after my move, does my opponent have at least one legal move, or am I giving check?* If the answer is "no legal move and no check", your move is stalemate.
:::

## Castling

**Castling** is the only move in which two pieces move at once. The king moves two squares towards one of its rooks, and that rook jumps over the king to the square on the king's other side.

* **Kingside castling** (written `O-O`): White's king goes from e1 to g1 and the rook from h1 to f1. For Black, e8 to g8 and h8 to f8.
* **Queenside castling** (written `O-O-O`): White's king goes from e1 to c1 and the rook from a1 to d1. For Black, e8 to c8 and a8 to d8.

Castling usually puts your king behind a wall of pawns and brings a rook towards the centre. It is one of the most important moves of the opening. Over the board, touch the king first and move it two squares; then move the rook.

### The full conditions

Castling is legal only if **all** of these are true:

1. **The king has never moved** during the game, not even once and back again.
2. **The rook you castle with has never moved.**
3. **Every square between the king and that rook is empty.** For queenside castling that includes the b-square (b1 or b8).
4. **The king is not in check** right now.
5. **The king does not pass through an attacked square.** For kingside castling that is f1 (or f8); for queenside castling it is d1 (or d8).
6. **The king does not land on an attacked square** (g1 or c1; g8 or c8). This is just the normal rule that you may not move into check.

Just as important are the things that do **not** stop you from castling:

* **The rook may be attacked**, and it may pass over an attacked square.
* **On the queenside, b1 (or b8) may be attacked.** Only the king's path matters, and the king never crosses the b-square.
* **Having been in check earlier** does not matter, as long as the king did not move to get out of it.

```board
fen: 1r1q1rk1/p1p2ppp/2n1pn2/3p4/2bP1B2/2N1PN2/P1PQ1PPP/R3K2R w KQ - 0 10
caption: White cannot castle kingside, because the bishop on c4 attacks f1, a square the king must cross. Queenside castling is legal, even though the black rook attacks b1.
red: c4f1 b8b1
arrows: e1c1
squares: f1 b1
```

### Worked example: can I castle?

Take the diagram above and run the checklist the way you would at the board.

First I check whether the king or the rooks have moved. Online, the app keeps track; over the board, you must remember, and a scoresheet helps. In this position neither has moved, so both castling options remain possible.

Next I look at the squares between the king and each rook. On the kingside, f1 and g1 are empty. On the queenside, b1, c1 and d1 are empty too.

Is my king in check now? I look along every line into e1: the e-file is blocked by my pawn on e3, the diagonals are blocked by my own pawns and queen, and no black knight is near. No check.

Now the key step: which squares will the king cross or land on, and are any of them attacked? For kingside castling, the king crosses f1 and lands on g1. The black bishop on c4 looks down the diagonal d3–e2–f1. Both d3 and e2 are empty, so f1 is attacked. Kingside castling is illegal.

For queenside castling, the king crosses d1 and lands on c1. The black queen on d8 points down the d-file, but her own pawn on d5 blocks her. Nothing else reaches c1 or d1. The rook on b8 attacks b1, but the king never goes to b1. Queenside castling is legal.

That four-step check (moved? empty? in check? path attacked?) takes a few seconds once you are used to it. Do it every time you are unsure, rather than giving up a good castling move or attempting an illegal one.

:::mistake "My rook is attacked, so I can't castle"
This is the commonest castling misunderstanding. The rule is about the king's safety only. You can castle with a rook that is under attack, and castling is often the best way to save it, because it moves the rook and the king in one go.
:::

## En passant

**En passant** (French for "in passing") is a special pawn capture. It exists because of the pawn's two-square first move: without it, a pawn could sneak past an enemy pawn that would have captured it if it had moved only one square.

The rule: if a pawn moves two squares forward from its starting square and lands directly beside an enemy pawn, that enemy pawn may capture it **as if it had moved only one square**. The capturing pawn moves diagonally to the square the other pawn passed over, and the pawn that moved two squares is removed.

Two conditions are easy to forget:

* **Only immediately.** En passant is allowed only on the very next move. If you play something else, the right is gone for that pawn.
* **Only from the fifth rank.** The capturing pawn must already stand on its fifth rank: rank 5 for a White pawn, rank 4 for a Black pawn. That is the only place where an enemy pawn can arrive next to it with a two-square move.

```line
fen: startpos
moves: 1.e4 e6 2.e5 d5 3.exd6 Bxd6
check: engine
diagram: end
caption: After 2...d5 the black pawn passed d6, next to White's pawn on e5. White captured en passant with 3.exd6, landing on d6 and removing the pawn from d5. Black recaptured with the bishop.
```

The same rule works for Black. In the next diagram White has just played c2-c4, passing the c3-square, which the black pawn on d4 attacks.

```board
fen: rnbqkbnr/ppp1pppp/8/8/2Pp4/5NP1/PP1PPP1P/RNBQKB1R b KQkq c3 0 3
caption: Black to move may capture en passant with 3...dxc3, landing on c3 and removing the pawn from c4. If Black plays any other move first, the chance is gone.
arrows: d4c3
squares: c4
```

En passant is written like any pawn capture, using the square where the capturing pawn lands: `exd6`. Some books add "e.p.". Taking en passant is never compulsory, unless it is your only legal move.

:::drill Find the en passant squares
Set up a white pawn on e5 and black pawns on d7 and f7. Move the d-pawn to d5 and capture en passant. Reset, move the f-pawn to f5, and capture en passant on f6. Then try with a black pawn on d4 and a white pawn going from c2 to c4 or from e2 to e4.
:::

## Promotion and underpromotion

When a pawn reaches the far end of the board (the eighth rank for White, the first rank for Black) it must immediately **promote**: you replace it with a queen, rook, bishop or knight of your own colour. It cannot stay a pawn, and it cannot become a king. You may promote to a second queen even if your first queen is still on the board. Over the board, if no spare queen is at hand, stop the clock and ask the arbiter for one; an upside-down rook counts as a rook, not a queen.

The promotion is part of the same move. A pawn that promotes with a capture or with check is written `e8=Q`, `dxc8=Q+`, or `g1=N+`.

Almost always you choose a queen. Choosing anything else is called **underpromotion**, and there are two main reasons for it:

* **To avoid stalemate.** A new queen can cover so many squares that the enemy king has no legal move. A rook covers fewer.
* **To win with a knight fork or check.** A knight attacks squares no queen can reach, so promoting to a knight with check can fork the king and another piece.

```board
fen: 8/8/8/8/8/5k2/5p1K/8 b - - 0 60
caption: Black to move. 1...f1=Q?? is stalemate: the white king on h2 has no legal move. 1...f1=R leaves the h3 square free, and King and Rook against King is an easy win.
red: f2f1
squares: g1 g2 g3 h1 h3
```

:::key Promotion checklist
Before you promote: (1) Is a queen stalemate? (2) Would a knight give a check or fork that wins more? (3) Otherwise, take the queen.
:::

## The ways a game can be drawn

A game is drawn in any of these ways:

* **Stalemate:** the side to move has no legal move and is not in check.
* **Threefold repetition:** the same position occurs three times, with the same player to move and the same castling and en passant possibilities. The repetitions need not come in a row. Over the board, the player about to make the move that repeats the position, or who has just seen it repeat, claims the draw from the arbiter; most apps declare it automatically.
* **The fifty-move rule:** fifty moves by each player have been played without any capture and without any pawn move. Again, over the board you claim it; apps usually apply it automatically.
* **Insufficient material:** neither side can possibly checkmate. The standard cases are king against king, king and bishop against king, king and knight against king, and king and bishop against king and bishop with both bishops on the same colour.
* **Agreement:** one player offers a draw and the other accepts. Over the board, offer a draw just after making your move and before pressing the clock.

```board
fen: 8/8/4k3/8/8/2N5/4K3/8 w - - 0 70
caption: Insufficient material. A king and knight cannot force checkmate, and no checkmate is even possible against a lone king, so the game is drawn at once.
squares: c3
```

The most useful drawing weapon in practice is **perpetual check**: a series of checks that the opponent cannot escape. The same position soon repeats three times, and the game is drawn. When you are losing badly, look for it. When you are winning, keep a square for your king where the checks stop.

```line
fen: 6k1/5ppp/8/8/8/1q6/5PPP/2R2RK1 b - - 0 30
moves: 30...Qb6?? 31.Rc8+ Qd8 32.Rxd8#
diagram: end
caption: A reminder that checkmate ends everything. Black, with a queen against two rooks, ignored the back rank. A move such as 30...h6, giving the king a square, was necessary.
```

:::coach Do not offer draws out of fear
Coaching judgment: at this level, positions that look dangerous are often still full of play, and opponents miss winning moves all the time. Offer or accept a draw only when the position is genuinely equal and simplified, or when a perpetual check is on the board.
:::

## Touch-move, resigning, and the clock

These rules matter mainly over the board. Online, the app enforces them for you.

* **Touch-move.** If you deliberately touch one of your own pieces, you must move it, provided it has a legal move. If you deliberately touch an opponent's piece, you must capture it if you legally can. Once you have let go of a piece on a legal square, the move is made and cannot be changed.
* **Adjusting.** To straighten a piece without having to move it, say "I adjust" (or "j'adoube") *before* you touch it.
* **Resigning.** You may end the game at any time by resigning, which counts as a loss. Say "I resign", stop the clock, or offer your hand. At this level, coaching judgment is to resign rarely: opponents stalemate, blunder and run out of time far more often than you expect.
* **The clock.** In timed games, each player has a clock. Make your move with one hand and press your clock with the same hand. If your time runs out, you lose, unless your opponent has no possible way to checkmate you, in which case the game is drawn.

Timed play is optional in this book. When you do play with a clock, choose slow time limits (see "How to Use This Book"), and learn the time-management ideas in [Chapter 27](#ch-27) before worrying about speed.

## A short opening example

Here is how castling fits into a normal opening. Both sides develop a knight and a bishop, which clears the squares between king and rook, and White castles on move four.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.O-O Nf6 5.d3 d6
check: engine
diagram: end
caption: White castled on move 4 after clearing f1 and g1. Black can castle next move for the same reason: the knight and bishop have left f8 and g8.
```

Notice what made castling possible: the knight left g1 and the bishop left f1. Developing your kingside pieces first is the fastest route to a safe king, which is one reason the opening principles in [Chapter 6](#ch-06) put development first.

## Practice at the board

You can do all of these with a physical set or any free analysis board. To load a position, use the "Set up position" or "Load FEN" option and paste the FEN.

1. **Castling checklist.** Load `1r1q1rk1/p1p2ppp/2n1pn2/3p4/2bP1B2/2N1PN2/P1PQ1PPP/R3K2R w KQ - 0 10`. Try to castle kingside in the app: it should refuse. Castle queenside: it should accept. Now move the black bishop from c4 to d7 (in the board editor) and check kingside castling again. Explain to yourself why it is now legal.
2. **En passant both ways.** From the starting position, play `1.e4 Nf6 2.e5 d5` and capture en passant. Then play `1.d4 e5 2.d5 c5` and check that `3.dxc6` is possible. Finally, in the same line, play a waiting move first and confirm the app no longer allows the capture.
3. **Stalemate traps.** Load `7k/8/5K2/8/8/8/8/6Q1 w - - 0 1`. Find the mate in one, and also find the queen move that stalemates. Then load `8/8/8/8/8/5k2/5p1K/8 b - - 0 60` and play `f1=R`, then win the rook ending against a friend or an engine.
4. **Perpetual check.** Set up a position where you have only a queen and your opponent has queen and rook, with your opponent's king a little exposed. Try to give checks forever. Notice how often the king can hide, and which pawn moves would have given it shelter.

Check yourself by asking: could I explain each rule to a friend, including the exceptions? If not, re-read that section.

## Chapter summary

* Set up with the light square on your right and the queen on her colour.
* You must escape check by moving the king, capturing the checker, or blocking. Checkmate wins; stalemate draws.
* Castling needs an unmoved king and rook, empty squares between them, and a king that is not in check and does not cross or land on an attacked square. The rook, and b1/b8, may be attacked.
* En passant is possible only immediately after the two-square pawn move, and only by a pawn on its fifth rank.
* A pawn on the last rank must promote; underpromote when a queen would stalemate or a knight wins more.
* Draws come from stalemate, threefold repetition, the fifty-move rule, insufficient material, and agreement. Perpetual check is the practical way to force a repetition.
* Over the board, touch-move applies, and you lose on time unless your opponent cannot possibly mate.

:::cheat Special-move checklist
1. **Before castling:** have the king or this rook moved? Are the squares between them empty? Am I in check? Does the king cross or land on an attacked square?
2. **After an enemy pawn moves two squares next to your pawn on your fifth rank:** consider capturing en passant now, because next move it is too late.
3. **Before promoting:** would a queen be stalemate? Would a knight give a winning check or fork? Otherwise choose a queen.
4. **When far ahead:** after my move, does my opponent have a legal move or am I giving check? If neither, it is stalemate.
5. **When far behind:** look for perpetual check and stalemate tricks before resigning.
:::

Now solve the exercises below. Then play two slow games, and in each one apply the checklist at least once, even if only to confirm that a castling move is legal.

@exercises
