---
chapter: 2
slug: notation-vision
title: "Reading the Board: Notation and Board Vision"
subtitle: Name every square, then see every line
part: 1
stage: "400–600"
skills: [notation, vision]
objectives:
  - Read and write standard algebraic notation, including captures, checks, castling, promotion and disambiguation.
  - Keep a scoresheet and load any game (PGN) or position (FEN) into a free app.
  - See the full reach of every piece, including long diagonals, sideways rook moves, backward moves and knight jumps.
  - Scan the whole board, edges included, before every move.
next_game: Before each move, trace every line from your opponent's last-moved piece and from each of your long-range pieces to the edge of the board, and look backwards as well as forwards.
---

You are White. Your opponent plays a knight to the edge of the board, attacking your bishop. You look at the bishop, find a safe square for it, and move it. After the game, the engine shows that your queen could simply have taken the knight. It was undefended, and your queen had been looking at it the whole time from the other side of the board.

This is the most common way games are lost below 1000: not through a deep combination, but because a player did not see a line that was already there. This chapter teaches two linked skills. The first is notation, the language that lets you read this book, record your games and load positions into any app. The second is **board vision**: the habit of seeing the full reach of every piece on the board.

## The language of the board

### Squares, files and ranks

Every square has a two-character name. The letter gives the **file** (the column, a to h, from White's left to right) and the number gives the **rank** (the row, 1 to 8, from White's side). White's pieces start on ranks 1 and 2, Black's on ranks 7 and 8.

```board
fen: rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1
caption: After 1.e4, the white pawn stands on e4: the e-file, fourth rank. The corner squares are a1 and h1 for White, a8 and h8 for Black.
arrows: e2e4
squares: e4 a1 h1 a8 h8
```

Two tips make square names automatic. First, the squares are named from White's side even when you play Black; d4 is always the same square. Second, a1 is always a dark square, so the light-squared diagonal from h1 runs to a8, and the dark-squared diagonal from a1 runs to h8. Those two **long diagonals** come up again and again.

:::drill Name the squares
With a board in front of you, have someone call out ten squares, or use the coordinate trainer in any free app. Touch each square within two seconds. Then do it again from Black's side of the board. Ten minutes a day for a week is enough for most people.
:::

### Writing a move

A move is written as the piece letter followed by the square it lands on. The letters are **K** (king), **Q** (queen), **R** (rook), **B** (bishop) and **N** (knight, because K is taken). Pawns have no letter, so `e4` means a pawn moves to e4, and `Nf3` means a knight moves to f3.

The other symbols:

* **Capture:** an `x` before the square. `Bxf7` means a bishop captures on f7. A pawn capture gives the file the pawn came from: `exd5`.
* **Check:** a `+` after the move, as in `Bb5+`. **Checkmate:** a `#`, as in `Qxf7#`.
* **Castling:** `O-O` kingside, `O-O-O` queenside (some sources use zeros: 0-0).
* **Promotion:** the square, `=`, and the new piece: `e8=Q`, or `bxa8=N+` for a capture that promotes to a knight with check.
* **En passant:** written as an ordinary pawn capture to the square where the pawn lands, such as `exd6`.

Moves are numbered in pairs: `1.e4 e5` is White's first move and Black's reply. When a sentence starts from a Black move, it uses three dots: `5...Nf6` means "Black's fifth move was knight to f6".

### Disambiguation: which piece moved?

Sometimes two identical pieces could move to the same square. Then you add the file (or, if that is not enough, the rank) the piece came from. In the line below, both of White's knights could go to d2, so White writes which one did.

```line
fen: startpos
moves: 1.d4 d5 2.c4 e6 3.Nf3 Nf6 4.Nbd2
check: engine
diagram: end
caption: Both the b1-knight and the f3-knight could reach d2, so the move is written 4.Nbd2: the knight from the b-file.
```

When two pieces stand on the same file, you use the rank instead.

```board
fen: 3r2k1/5ppp/8/8/8/4R3/5PPP/4R1K1 w - - 0 30
caption: Both rooks can move to e2. If the rook on e1 goes there, write R1e2; if the rook on e3 goes there, write R3e2. Writing just Re2 would be ambiguous.
arrows: e1e2
blue: e3e2
```

### Annotation symbols

Books and apps add symbols after moves to give an opinion. This book uses only six: `!` (a good move), `!!` (a brilliant move), `?` (a mistake), `??` (a blunder), `!?` (interesting, worth trying) and `?!` (dubious). They are opinions, not part of the move.

## Scoresheets, PGN and FEN

### Keeping a scoresheet

Over the board, in serious games you write down every move on a **scoresheet**, usually in two columns, White's moves on the left. Online, the app records the game for you, but writing it down for a few games is excellent practice, and you will need the skill at any club or tournament.

Here is a short, sound opening as you would write it.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Bxc6 dxc6 5.O-O f6 6.d4 exd4 7.Nxd4 c5 8.Nb3 Qxd1 9.Rxd1
check: engine
diagram: end
caption: The Exchange Variation of the Ruy Lopez. On a scoresheet: 1. e4 e5, 2. Nf3 Nc6, 3. Bb5 a6, and so on. Note the captures (4.Bxc6, 8...Qxd1) and the castling move 5.O-O.
```

Three habits help. Write your move before you play it, and look at it once more as a last check (many clubs allow this). Write the move number on every line so you can find your place again. And if you lose track, ask the arbiter or your opponent at a calm moment to compare scoresheets; do not guess.

:::mistake Writing the square you came from
Beginners often write `Ng1f3` or `Ne5` when they meant the knight landed on f3. Standard notation records only the destination square (plus disambiguation when needed). The square you write is the square where the piece now stands.
:::

### PGN: a game in a text file

**PGN** (Portable Game Notation) is simply a game written in the notation you have just learned, with a few labelled lines on top such as the players' names, the date and the result. Every chess app can export your games as PGN and import a PGN you paste in. When you want to analyze a game you played over the board, type up your scoresheet in PGN form, paste it into a free analysis board, and step through it.

### FEN: a position in one line

**FEN** (Forsyth–Edwards Notation) describes a single position. Every diagram and exercise in this book gives one, so that you can load it into an app. Here is the position after 1.e4:

`rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1`

Read it in six parts, separated by spaces:

1. **The pieces**, rank by rank from the eighth rank down to the first, separated by `/`. Capital letters are White pieces, small letters Black, `P`/`p` are pawns, and a digit counts empty squares. `4P3` means four empty squares, a white pawn, three empty squares: the pawn on e4.
2. **Side to move:** `w` or `b`. Here Black is to move.
3. **Castling rights:** `K` and `Q` for White's kingside and queenside, `k` and `q` for Black's; `-` if nobody can castle.
4. **En passant square**, if a pawn has just moved two squares and can be captured; otherwise `-`. (Some apps write e3 here after 1.e4 even though no capture is possible.)
5. **Half-move clock** for the fifty-move rule.
6. **Move number.**

You will rarely need to write a FEN by hand. What matters is that you can paste one into an app's "Load FEN" or "Set up position" box, and check that the side to move is right before you start thinking.

:::key The two things to check after loading a FEN
Is the correct side to move? Is the board shown from that side? Many apps show the position from White's side by default; flip the board when you are solving as Black.
:::

## Board vision: seeing every line

Knowing how the pieces move is not the same as seeing where they reach. **Board vision** is the ability to see, quickly and completely, every square each piece attacks, for both sides. Weak board vision produces the classic beginner losses: a queen captured from across the board, a knight fork nobody noticed, a backward bishop move that never entered the player's mind.

The good news is that board vision is trainable. It improves fast with deliberate practice, because the same geometric patterns appear in game after game.

### Lines of force

Think of every queen, rook and bishop as sending out **lines of force**: rays that run along its files, ranks and diagonals until they hit a piece. The ray "sees" every empty square and the first piece it meets. If that first piece is an enemy piece, it is attacked. If it is your own piece, it is defended.

The rays of long-range pieces are easiest to underestimate when they are long. A bishop on b2 attacks h8 just as surely as it attacks c3. A queen on d1 attacks h5 even though it is four squares away and pointing at the "wrong" side of the board.

```board
fen: r1bqk1nr/ppp2ppp/2nb4/1B1pp3/8/1P2P3/PBPP1PPP/RN1QK1NR w KQkq - 2 5
caption: A standard position from Larsen's Opening (1.b3). White's bishop on b2 sends a ray down the long dark diagonal and presses on e5. If the e5-pawn ever moves, the ray reaches g7 and h8.
arrows: b2e5
squares: g7 h8
```

### Knight geometry

The knight is the piece that most often surprises players, because it does not move in straight lines. Three facts make it easier to see:

* **It always changes colour.** A knight on a light square attacks only dark squares, and the other way round. If the enemy king and queen both stand on dark squares, a knight on a light square might fork them; a knight on a dark square cannot.
* **It reaches eight squares from the centre, but only two from a corner.** A knight on d4 controls b3, b5, c2, c6, e2, e6, f3 and f5. A knight on a1 controls only b3 and c2. That is the reason behind the saying "a knight on the rim is dim"; it is also why knights on the rim are often left undefended.
* **It is slow over distance.** To move one square diagonally, a knight needs two moves; to reach a square two diagonal steps away it may need four. When you plan a knight route, count the jumps instead of guessing.

```board
fen: 8/8/8/8/3N4/8/8/K6k w - - 0 1
caption: The eight squares a knight on d4 attacks. All of them are light squares, while d4 is dark. Picture this star every time you look at a knight.
arrows: d4b5 d4c6 d4e6 d4f5 d4f3 d4e2 d4c2 d4b3
```

:::drill The knight's tour of targets
Place a knight on any square and two "targets" (coins work) on other squares. Find the shortest route by which the knight could attack both at once. Count the jumps aloud. Repeat ten times with different squares.
:::

### Ranks, files and diagonals

Rooks are usually pictured going up and down files. They are just as strong sideways along ranks, and players miss sideways captures surprisingly often, especially when the target is on the far edge. Bishops and queens have the same problem with diagonals that run backwards, towards their own side of the board.

A useful exercise: for each of your long-range pieces, trace all of its rays to the edge of the board, in every direction, including backwards. Backward moves are hard to see for a simple reason: in most games, pieces move forward, so your eyes learn to look forward.

```line
fen: startpos
moves: 1.e4 e5 2.Qh5?! Nc6 3.Bc4 g6 4.Qf3 Nf6
check: engine
diagram: end
caption: A typical beginner line. After 3...g6 hits the queen, the backward move 4.Qf3 renews the threat on f7. Black must see the new line from f3 to f7, and 4...Nf6 blocks it.
```

### Edge pieces

Pieces on the a-file, h-file, first rank and eighth rank are missed far more often than central ones. Your eyes are drawn to the middle of the board, and edge pieces sit at the end of the rays, where your attention fades. They also tend to be undefended, because few pieces can reach the edge to protect them.

```board
fen: r1bqkb1r/ppp2ppp/5n2/n2Pp1N1/2B5/8/PPPP1PPP/RNBQK2R w KQkq - 1 6
caption: A main line of the Two Knights Defence. Black's knight on a5 attacks the bishop on c4. Knights on the edge like this one are where players most often fail to look, both when attacking and when defending.
arrows: a5c4
squares: a5
```

### Five common blind spots

Most vision errors fall into a handful of families. Learn to look for them by name:

* **The piece behind the piece.** When a piece moves off a line, the piece behind it suddenly attacks along that line. A bishop on b2 behind a knight on c3, or a rook behind a pawn on an open file, can come to life in one move. Chapter 9 calls this a discovered attack.
* **The square just vacated.** When you move a piece, the square it leaves can become an entry point for the opponent, and the lines it was blocking open up. Look at the empty square, not only at the new one.
* **Long queen moves with check.** The queen can give check from far away, and checks that also attack something else are among the most common ways to lose a piece. Queen moves such as Qa4+ (along the a4-e8 diagonal) and Qh5+ (along the h5-e8 diagonal) catch players again and again in the opening.
* **The knight fork squares near the king.** Before your king has castled, c7 and f7 (for Black) and c2 and f2 (for White) are the classic knight targets, because a knight landing there often attacks the king and a rook together.
* **Your own pieces' defensive duties.** Vision is not only about attacking. If you do not see that your bishop is the only piece guarding a square, you will move it and leave that square undefended.

When you review a game, try to name the blind spot behind each missed move. Naming the pattern makes it far easier to recognize next time.

### Visualizing without moving

In a game you cannot move the pieces to test an idea; you must see the position after the move in your head. Start small. Before each move in a training game, picture the board after your move and answer one question: *what does each of my opponent's pieces attack now?* The square your piece leaves can open a line, and the square it goes to can block one.

:::coach Train vision in short daily doses
Coaching judgment: ten minutes a day of easy vision drills (naming squares, knight routes, "what does this piece attack?") does more for a beginner than an hour once a week. The skill is closer to reading speed than to knowledge.
:::

## Scanning the whole board

Board vision becomes useful when it turns into a routine. The **board scan** takes ten to twenty seconds:

1. **What did my opponent's last move change?** Trace every ray from the piece that moved, and every ray it opened by leaving its old square.
2. **What do the enemy long-range pieces see?** Queen, rooks, bishops: trace each one to the edges, including backwards.
3. **Where can the enemy knights jump?** Picture their stars.
4. **Now look at my own pieces the same way**, and especially at the edges and corners.

Chapter 4 turns this into the full safety scan of checks, captures and threats. For now, the goal is simply to see everything that is on the board.

### Worked example: a hidden diagonal

The next position arises after a common Queen's Gambit Declined move order. White looks at the pawn on d5.

```board
fen: r1bqkb1r/pppn1ppp/5n2/3p2B1/3P4/2N5/PP2PPPP/R2QKBNR w KQkq - 0 6
caption: White to move. The d5-pawn is attacked by the knight on c3 and seems to be pinned: if the knight on f6 recaptures, White's bishop takes the queen. Is 6.Nxd5 safe?
arrows: c3d5
blue: g5d8
squares: d5
```

Here is the thinking process White should run before taking.

First I check the material: the d5-pawn is attacked once (by my knight) and defended once (by the knight on f6). The f6-knight appears unable to recapture, because if it moves my bishop on g5 takes the queen on d8.

Next I look at my opponent's best reply, not just the reply I want. After 6.Nxd5, Black can still play 6...Nxd5, accepting the loss of the queen. Then after 7.Bxd8, what does Black have? I scan Black's long-range pieces. The bishop on f8 looks along the diagonal e7, d6, c5, b4 to a3, and from b4 it would see c3, d2 and e1, where my king stands. The c3-square is now empty, because my knight left it.

So the line is 7...Bb4+, a check from the far side of the board, and after 8.Qd2 Bxd2+ 9.Kxd2 Kxd8, Black has won a piece. The move 6.Nxd5 is a blunder. This trap is so well known that it has a name, the Elephant Trap.

```line
fen: r1bqkb1r/pppn1ppp/5n2/3p2B1/3P4/2N5/PP2PPPP/R2QKBNR w KQkq - 0 6
moves: 6.Nxd5?? Nxd5 7.Bxd8 Bb4+ 8.Qd2 Bxd2+ 9.Kxd2 Kxd8
check: engine
diagram: end
caption: The Elephant Trap. The hidden diagonal f8 to b4 to e1 decides: Black gave the queen and won it back with a check, ending a piece up.
```

The lesson is not the trap itself. It is the scan: when your piece leaves a square (here c3), ask what new lines that opens for your opponent, and trace every enemy ray towards your king, however far away the attacker stands.

:::mistake Looking only where the action is
Most vision errors happen because the player looked only at the part of the board where the last few moves were played. The decisive piece is often sitting quietly on the other side: a bishop on its home square, a rook on the back rank, a queen that has not moved for ten moves.
:::

## How to find vision errors in your own games

When you go through a lost game, look for these signs:

* **The losing move was a capture or attack from far away**, a long diagonal or a whole rank or file, that you did not consider.
* **The capture came backwards**, towards the side that made it.
* **An edge piece**, yours or your opponent's, was hanging for more than one move.
* **A knight fork** appeared on a square you never pictured.

Mark these in your mistake journal under *missed tactic* or *hanging piece*, and note the geometry: "long diagonal", "backward move", "edge piece", "knight". After a few weeks, you will see which kind of line you miss most, and you can drill it.

## Practice at the board

1. **Notation fluency.** Play through the Ruy Lopez line in this chapter on a real board, reading only the notation. Then write the moves on a sheet of paper from memory. Check yourself against the book.
2. **Load a position.** In a free app, load `r1bqkb1r/pppn1ppp/5n2/3p2B1/3P4/2N5/PP2PPPP/R2QKBNR w KQkq - 0 6` and play the Elephant Trap line. Then reload it and play the normal developing move 6.e3 instead, keeping the c3-knight where it blocks the diagonal from b4 to e1.
3. **Ray tracing.** Set up any middlegame position from one of your games. For each queen, rook and bishop on the board, both colours, place your finger on the piece and slide it along every ray to the first piece it meets. Say aloud what it attacks and what it defends.
4. **Knight stars.** Put a knight on each of these squares in turn and name its targets without moving it: a1, b1, d4, e5, h8. Check by moving it in an app.
5. **Edge sweep.** At the end of each training game, before resigning or agreeing a draw, look slowly along the a-file, the h-file, and both back ranks. Count the pieces you had not noticed.

Check yourself: if you can name every square a piece attacks in under five seconds, your vision is in good shape for the next chapters.

## Chapter summary

* Every square has a fixed name: file letter, then rank number, always from White's side.
* Moves are piece letter plus destination: `x` for captures, `+` for check, `#` for mate, `O-O`/`O-O-O` for castling, `=Q` for promotion. Add the file or rank of departure when two identical pieces could make the move.
* PGN records a whole game; FEN records one position. Paste either into any free app, then check the side to move.
* Long-range pieces send rays to the edge of the board; trace them all, including backwards and sideways.
* Knights always change square colour, are weakest on the edge, and are slow over distance; picture their eight-square star.
* Edge pieces and backward moves are where most vision errors happen.
* Before each move, scan what your opponent's last move changed and what every long-range piece sees.

:::cheat The board scan
1. Trace every ray from the piece my opponent just moved, and from the square it left.
2. Trace every enemy queen, rook and bishop to the edge, forwards, sideways and backwards.
3. Picture every enemy knight's star of squares.
4. Look along both edges and both back ranks for loose pieces.
5. Repeat steps 2 to 4 for my own pieces to find my chances.
:::

Now solve the exercises below. Then play two slow games, keep a scoresheet for both, and run the board scan before every move. Afterwards, load each game as PGN into a free app and check which lines you missed.

@exercises
