---
chapter: 8
slug: pins-skewers
title: Pins and Skewers
subtitle: Attacking along the line
part: 2
stage: "600–800"
skills: [pin, skewer, defense, blunder-check]
objectives:
  - Tell an absolute pin from a relative pin, and know which pinned pieces may legally move.
  - Exploit a pin by attacking the pinned piece again, especially with a pawn.
  - Break a pin by interposing, moving the back piece, counter-attacking, or unpinning with tempo.
  - Recognize skewers of king and rook or king and queen, including the rook-endgame skewer that promotes a pawn.
next_game: Whenever two enemy pieces, or an enemy piece and the king, stand on the same line, look for a bishop, rook or queen move onto that line; and before you count a piece as a defender, check whether it is pinned.
---

Your opponent's bishop lands on b5 and suddenly your knight on c6 cannot move: behind it, on the same diagonal, stands your king. A pawn walks up to attack the knight and there is nothing you can do. Or, the other way round, you "pin" a knight to your opponent's queen, grab a pawn, and the knight jumps away anyway, because your opponent has seen that moving it wins more than it loses.

Pins and skewers are attacks along a line: a rank, a file or a diagonal. They are the second big family of tactics after forks, and they work only with the pieces that move in lines: bishops, rooks and queens. This chapter teaches you to create them, exploit them, escape them, and, just as important, to know when a pin is not really a pin.

## What a pin is

A **pin** is an attack on a piece that cannot move, or should not move, because a more valuable piece stands behind it on the same line. The attacking piece is the **pinner**, the piece in front is the **pinned piece**, and the piece behind is the one being protected.

There are two kinds, and the difference matters enormously.

### Absolute pins

In an **absolute pin**, the piece behind is the king. Moving the pinned piece would expose the king to check, so the move is **illegal**. The pinned piece cannot move at all, except along the line of the pin (a pinned rook on a file may still slide along that file, and may even capture the pinner).

```board
fen: r1bqkbnr/ppp2ppp/2np4/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4
caption: After 1.e4 e5 2.Nf3 Nc6 3.Bb5 d6, the knight on c6 is absolutely pinned. The bishop on b5, the knight and the king on e8 are on one diagonal, so the knight may not move until something changes.
arrows: b5e8
squares: c6
```

A typical consequence: a piece that is absolutely pinned **does not defend anything**. In the diagram, if a black piece stood on d4 or e5 relying on the knight for protection, it would in fact be unprotected. Exercise 08-01 is built on this.

### Relative pins

In a **relative pin**, the piece behind is not the king but something valuable, usually the queen or a rook. Moving the pinned piece is legal; it just loses the piece behind, *unless the move creates a bigger threat*.

```board
fen: rnbqkb1r/ppp2ppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR b KQkq - 3 4
caption: The Queen's Gambit Declined after 1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5. The bishop pins the knight on f6 to the queen on d8. The pin is relative: the knight may move, but if it does, Bxd8 wins the queen unless Black has something better.
arrows: g5d8
squares: f6
```

This is one of the most common pins in chess, and you will meet it from both sides of your repertoire: Black plays this Queen's Gambit Declined set-up, and as White you will often see ...Bg4 pinning your knight on f3 to your queen.

:::mistake Thinking a relatively pinned piece cannot move
The most expensive pin mistake at this level is treating a relative pin as if it were absolute. A piece pinned to the queen *can* move, and if it moves with a capture, a check or a mate threat, the "pin" may cost the pinner far more than the queen is worth. Before you rely on a pin, ask: "If the pinned piece moves anyway, what does it attack or threaten?"
:::

## Two famous traps: the pinned piece that moved

The best way to remember the mistake above is to see it punished twice, once from each side.

### The Légal trap

The trap is named after Légal, an eighteenth-century French master. Black pins White's knight to the queen, and White moves the knight anyway.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 d6 3.Bc4 Bg4 4.Nc3 g6? 5.Nxe5! Bxd1?? 6.Bxf7+ Ke7 7.Nd5#
check: engine
diagram: end
caption: Black took the queen and was mated by three minor pieces. The knight on f3 was only pinned to the queen, so it was free to move.
```

Black's correct reply to 5.Nxe5 is 5...dxe5, and after 6.Qxg4 White has won a pawn. That is the price of the mistake 4...g6; it is a lot less than being mated. Exercise 08-05 asks you to find this defence.

### The Elephant Trap

Now the same idea from Black's side, in the Queen's Gambit Declined. White thinks the knight on f6 is pinned and grabs a pawn on d5.

```line
fen: startpos
moves: 1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Nbd7 5.cxd5 exd5 6.Nxd5?? Nxd5! 7.Bxd8 Bb4+ 8.Qd2 Bxd2+ 9.Kxd2 Kxd8
check: engine
caption: The Elephant Trap. Black's knight ignores the pin, and after the queen trade Black is a piece up.
```

After 6...Nxd5 Black has won a knight, and the only thing hanging is Black's queen. If White takes it with 7.Bxd8, the check 7...Bb4+ forces 8.Qd2, Black wins White's queen back, and finishes a piece ahead. Exercises 08-06 and 08-11 test this trap from both sides.

## Exploiting a pin

Once a piece is pinned, it is a sitting target. The pinned piece cannot run, so the usual plan is simple: **attack it again**.

### Attack the pinned piece with a pawn

The most effective attacker is a pawn. A pawn is worth less than any piece, so if it attacks a pinned piece, the defender cannot solve the problem by "protecting" the piece: the pawn takes it anyway, and gives up only a pawn in return.

```board
fen: r1bqr1k1/ppp2ppp/2n2n2/3p4/8/1Q1BB3/PPPN1PPP/R3K2R b KQ - 4 10
caption: Black's rook on e8 pins the bishop on e3 to the white king. The pawn on d5 is ready to step forward and attack the pinned bishop. Exercise 08-04 asks you to find the move.
arrows: e8e1
blue: d5d4
squares: e3
orientation: black
```

How to recognize this chance:

1. Find every pinned piece on the board (for both sides).
2. For each one, ask: "Which of my pawns could attack it in one move?"
3. Check that the pawn's new square is not simply lost to a capture that also solves the problem, and that the opponent cannot break the pin with tempo first.

### Pile up on the pinned piece

If no pawn is available, attack the pinned piece with more pieces than can defend it. A pinned knight on f6 attacked by a bishop on g5 can be hit again by a knight on d5 or e4, or by a rook on the f-file. Because the pinned piece cannot leave, every new attacker counts. A typical example is the Bg5 pin on a knight on f6: White adds Nd5, and if the pawn on e4 can advance to e5, the knight is attacked by a pawn as well. Black's usual defences are to interpose a piece (...Be7), to ask the bishop a question with ...h6, or to move the queen off the d8-h4 diagonal so that the knight is free again.

### What goes wrong when you exploit a pin

Three errors waste most pins at this level.

* **Releasing the pin too early.** Capturing the pinned piece with the pinner (for example Bxc6+ or Bxf6) often just trades a bishop for a knight. The pin is worth most while it lasts, because it ties your opponent down. Capture only when it wins material or leaves real damage. In Exercise 08-09 the strong plan keeps the bishop on the pinning diagonal.
* **Giving the opponent time to castle.** An absolute pin against an uncastled king disappears the moment the king castles. If you have a pawn that can attack the pinned piece, use it *now*, before the king escapes. Exercise 08-03 is exactly this race.
* **Forgetting the counter-attack.** The pinned side may answer your attack with a threat of their own: a check, an attack on your queen, or a capture of the pinner. Before you push the pawn, look at your opponent's forcing moves just as you would for a fork.

### Pinned pieces do not defend

Whenever you count attackers and defenders (as in [Chapter 3](#ch-03)), **leave out every absolutely pinned defender**. A piece pinned to the king cannot capture anything off the line. A relatively pinned defender can capture, but only at the cost of the piece behind it, so count it with care.

## The danger: a pinned piece is not a dead piece

Pinned pieces lose their freedom to move, but they keep some powers. Two of them catch players out again and again.

**A pinned piece still controls squares for king moves.** The king may never move onto a square attacked by an enemy piece, and it does not matter whether that enemy piece is pinned. A pinned piece can therefore still "defend" a square next to the enemy king.

```board
fen: r3k2r/pp3ppp/6q1/8/8/4n3/PP3P1P/Q3R2K b kq - 0 30
caption: The knight on e3 is pinned to the black king by the rook on e1. But it still guards g2, so ...Qg2 is checkmate: the white king cannot capture a queen that is protected, even by a pinned piece.
arrows: g6g2
red: e1e8
squares: g2 e3
orientation: black
```

```line
fen: r3k2r/pp3ppp/6q1/8/8/4n3/PP3P1P/Q3R2K b kq - 0 30
moves: 30...Qg2#
check: engine
caption: The pinned knight defends the mating square.
```

**A pinned piece can still give check, and can move along the pin line.** A rook pinned on a file can slide up and down that file, and may capture the pinner if it is unprotected. A pinned bishop can capture a pinning bishop on the same diagonal. Always check whether the pinned piece can simply take the pinner.

## Breaking a pin

When one of your own pieces is pinned, you have four kinds of answer. Look for them in roughly this order, and look early: a pin is usually easy to break *before* the opponent has piled up on it.

1. **Counter-attack the pinner.** Ask the pinning piece a question: ...h6 against a bishop on g5, or a3 against a bishop on b4. The pinner must take, retreat, or keep the pin and allow a pawn advance like ...g5.
2. **Interpose a piece** between the pinner and the piece behind. Against Bg5 pinning a knight on f6, ...Be7 means the knight is now only "pinned" to a bishop.
3. **Move the piece behind.** Moving the queen off the line, or castling the king off the e-file, turns the pinned piece into a free piece. Castling is the easiest unpinning move in chess.
4. **Unpin with tempo.** The best way to move the back piece is with a threat of your own: a queen move that gives check, or attacks something, so the opponent has no time to exploit the pin.

```board
fen: r2qk2r/ppp2ppp/2np1n2/2b1p3/2B1P1b1/2PP1N2/PP3PPP/RNBQ1RK1 w kq - 2 7
caption: A Giuoco Pianissimo position with ...Bg4 pinning White's knight on f3 to the queen. There is no immediate danger. White can ask the bishop a question with h3, or calmly continue with Re1 and Nbd2 and break the pin later.
arrows: g4d1
blue: h2h3
squares: f3
```

### The ...Bb4 pin

The mirror image of the Bg5 pin is the bishop pin on c3 (or ...Bb4 by Black against a knight on c3). When White's d-pawn has left d2 and the king is still on e1, the pin is absolute, and the knight stops defending the squares around it.

```board
fen: r1bqk2r/pppp1ppp/2n2n2/8/1b1NP3/2N5/PPP2PPP/R1BQKB1R w KQkq - 1 6
caption: The Scotch Four Knights after 1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 Nf6 5.Nc3 Bb4. The knight on c3 is pinned to the king, so it no longer really defends e4: Black threatens ...Nxe4.
arrows: b4e1
red: f6e4
squares: c3 e4
orientation: black
```

This is part of your repertoire as Black (see [Chapter 13](#ch-13)). White's best answer is 6.Nxc6 bxc6 7.Bd3, defending e4 with a piece that is not pinned. A careless developing move such as 6.Be2 allows 6...Nxe4, because the pinned knight cannot take back.

### Pins along files

Rooks and queens pin along files and ranks. The two lines to watch most are:

* **The e-file toward an uncastled king.** Once the e-pawns have gone, any piece on the e-file in front of a king on e1 or e8 can be pinned by a rook or queen. Castle early.
* **The file or diagonal between a queen and a king.** A queen standing on the same line as its own king, with only one piece between them, is a pin waiting to happen.

```board
fen: r1b1kbnr/ppp1qppp/2np4/8/8/2N2N2/PPP2PPP/R1BQRBK1 w kq - 0 7
caption: Black's queen on e7 stands between the rook on e1 and the king on e8. It is absolutely pinned. Nd5 attacks it a second time, and Black must give the queen for a rook.
arrows: c3d5
red: e1e8
squares: e7
```

A queen pinned to a king is lost as soon as a cheaper piece attacks it. The defence is prevention: never put your queen on the same line as your king when an enemy rook or bishop can reach that line.

## Skewers

A **skewer** is a pin in reverse. The more valuable piece stands *in front*. It is attacked, it must move (or must move because it is the king in check), and the piece behind it is captured.

Skewers are most deadly when the front piece is the king, because a check must be answered. The classic targets are:

* **King and rook** on the same rank, file or diagonal.
* **King and queen**, which usually wins the queen outright.
* **Queen and rook**, where the queen must move and the rook falls.

```board
fen: 6r1/p4k2/1p4p1/2b4p/7P/1P3NP1/P3BPK1/8 w - - 0 35
caption: The king on f7 and the rook on g8 share the diagonal a2-g8. Bc4+ checks the king; when it steps away, Bxg8 wins the exchange.
arrows: e2c4
red: c4g8
squares: f7 g8
```

### Skewers that fail

A skewer needs the piece behind to be worth taking. If the rook behind the king is protected, "winning" it costs your skewering piece, and you have only traded. Check also that the front piece has no counter-blow: a king in check may be able to capture the checking piece, or block the check with a piece that defends the target behind it. And a queen attacked by a skewer may be able to move with check, which gives your opponent time to save the piece behind.

### How to spot skewers

Skewers come from looking along lines *through* the king. For each enemy king:

1. Look along all eight lines from the king (two diagonals, the rank and the file, in both directions).
2. Note any valuable enemy piece standing on one of these lines beyond the king with nothing in between.
3. Ask whether one of your line pieces can give check on that line from the other side, on a safe square that cannot be blocked.

The same scan finds pins: if the piece on the line is *between* you and the king, it is a pin; if the king is between you and the piece, it is a skewer.

## Rook-and-king skewers in endgames

In rook endgames, kings and rooks often stand on open ranks and files, and the skewer is one of the most important tactical ideas. The best-known version is the skewer that promotes a pawn.

```board
fen: R7/P5k1/6p1/7p/4p2P/6P1/r4PK1/8 w - - 0 45
caption: White's rook stands in front of the a-pawn, Black's rook behind it. With the black king on g7, Black has good drawing chances: the king covers h7 and g7, so the skewer trick does not work.
arrows: a7a8
squares: g7 h7
```

The defending king belongs on g7 or h7 in this kind of position. If it wanders onto another square of the seventh rank, such as f7 or e7, White has a trick: the rook leaves a8 sideways, for example Rh8, threatening to promote. If Black takes the pawn with the rook, Rh7+ skewers the king and the rook on a7. Exercise 08-07 shows the idea in action.

The general lesson for endgames: **whenever your king and rook stand on the same line, ask whether your opponent can check along it.** Many rook endgames are lost not by deep mistakes but by one careless king move onto the rook's rank or file.

## Worked example: is the pinned knight really pinned?

Here is the position just before the Légal trap. Black has pinned White's knight to the queen with ...Bg4 and has just played 4...g6. White to move. Follow the thinking.

```board
fen: rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5
caption: White to move. The knight on f3 is pinned to the queen on d1, but only relatively. The pawn on e5 is defended by the d6 pawn.
arrows: g4d1
squares: f3 e5 f7
```

**Step 1: what is pinned, and how?** The knight on f3 is pinned to the queen. It is a relative pin, so the knight may legally move.

**Step 2: checks, captures, threats.** White's captures are Nxe5 and Bxf7+. Bxf7+ Kxf7 just loses a bishop for a pawn. Nxe5 takes a pawn and unpins the knight by moving it, but it hangs the queen on d1.

**Step 3: what does the moving piece threaten?** After Nxe5, the knight attacks f7. Together with the bishop on c4 and the knight on c3, which can jump to d5, White has a mating pattern if the black king is forced to e7.

**Step 4: the opponent's best reply.** If Black takes the queen with 5...Bxd1??, then 6.Bxf7+ Ke7 7.Nd5# is mate, as the line above showed. Black's best is 5...dxe5, and after 6.Qxg4 White has won a clean pawn and Black has a weakened kingside.

```line
fen: rn1qkbnr/ppp2p1p/3p2p1/4p3/2B1P1b1/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 5
moves: 5.Nxe5! dxe5 6.Qxg4
check: engine
caption: With best defence, the "pinned" knight's move wins a pawn. If Black grabs the queen instead, it is mate.
```

**Step 5: blunder-check.** Is there anything Black can do that refutes 5.Nxe5? The checks for Black are none; the only big capture is the queen, which loses. So 5.Nxe5 is safe and strong.

The lesson works in both directions. As the pinner, never assume a relatively pinned piece will stay still. As the pinned side, look for the moment when moving the pinned piece wins more than it loses.

## How to spot pins and skewers in your own games

* **Same-line scan.** Whenever two enemy pieces, or an enemy piece and the king, stand on the same rank, file or diagonal, look for your bishop, rook or queen reaching that line.
* **Pinned-defender check.** When you count the defenders of a square, ask of each defender: "Is it pinned?" Leave out pieces pinned to the king.
* **Uncastled king on an open file.** Look for pieces on the e-file in front of the king, for both sides.
* **King and rook in the endgame.** Before every king move in a rook ending, check whether the king will stand on the same line as your own rook.
* **Before you rely on a pin.** Ask what the pinned piece would attack if it moved anyway.

After each game, look for one moment where a pin or skewer was available or was allowed. Log it in your mistake journal under "missed-tactic" or, if a pinned piece fooled you, under "calculation".

:::nextgame Your pin checkpoint
In your next game, every time your opponent puts a bishop, rook or queen on a line that runs toward your king or queen, stop and ask two questions: "What is between them?" and "Can I break the line now, before it costs me anything?"
:::

## Practice at the board

Set up each position on a board or in any free chess app. Decide your answer before you move anything.

1. **Absolute or relative?** Set up `r1bqkbnr/ppp2ppp/2np4/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 4` and `rnbqkb1r/ppp2ppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR b KQkq - 3 4`. For each, name the pinned piece and say whether it may legally move. Then find one way for the pinned side to break the pin.
2. **Attack with a pawn.** Set up `r1bqr1k1/ppp2ppp/2n2n2/3p4/8/1Q1BB3/PPPN1PPP/R3K2R b KQ - 4 10`. Find Black's winning pawn move, then play every White reply you can think of and check that Black still wins a piece.
3. **The pinned defender.** Set up `r3k2r/pp3ppp/6q1/8/8/4n3/PP3P1P/Q3R2K b kq - 0 30`. Explain to yourself why ...Qg2 is mate even though the knight on e3 is pinned.
4. **Both traps.** Play through the Légal trap and the Elephant Trap from the start position three times each, once as the winner and once as the loser, until you can do it without the book.
5. **Rook-ending skewer.** Set up `R7/P5k1/6p1/7p/4p2P/6P1/r4PK1/8 w - - 0 45`. Move the black king from g7 to f7 and find White's win. Then put it back on g7 and convince yourself that the same trick fails.

Check yourself with an engine only after you have written down your answers.

## Chapter summary

* A pin attacks a piece that cannot or should not move because a more valuable piece stands behind it. Only bishops, rooks and queens pin.
* In an absolute pin the piece behind is the king and the pinned piece may not leave the line; it defends nothing off the line. In a relative pin the pinned piece may move, and sometimes should.
* Exploit a pin by attacking the pinned piece again, ideally with a pawn, and by piling up attackers.
* Break a pin by counter-attacking the pinner, interposing, moving the piece behind (castling is the easiest), or unpinning with tempo. Do it early.
* A pinned piece still controls squares around the enemy king and can still move along the pin line or capture the pinner.
* The Légal trap and the Elephant Trap show the cost of assuming a relatively pinned piece will stay put.
* A skewer attacks a valuable piece in front, usually the king, to win the piece behind it. In rook endgames, watch every king move onto your own rook's line, and know the skewer trick that promotes a pawn.

:::cheat The line check
1. List every line (rank, file, diagonal) that runs through an enemy king or queen.
2. On each line, find what stands between, and what stands behind.
3. A piece between your line piece and the king or queen is pinned: attack it again, preferably with a pawn.
4. A king or queen in front of another piece can be skewered: find a safe check or attack along the line.
5. Before relying on a pin, ask what the pinned piece would do if it moved anyway.
6. Run the same scan for your own king and queen, and break dangerous pins early.
:::

@exercises
