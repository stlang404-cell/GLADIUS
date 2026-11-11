---
chapter: 9
slug: discovered-attacks
title: Discovered Attacks and Double Check
subtitle: The piece that moves and the piece that strikes
part: 2
stage: "600–800"
skills: [discovered-attack, double-check, defense, blunder-check]
objectives:
  - Recognize a battery (a front piece in front of a back piece on the same line) for both sides.
  - Use discovered attacks and discovered checks, choosing the best square for the front piece.
  - Understand why double check can only be answered by a king move, and use it to mate.
  - Spot your opponent's batteries and defuse them before they fire.
next_game: Before every move, look along each of your bishops, rooks and queen to see whether one of your own pieces is standing in the way of a target; and look along your opponent's lines in the same way.
---

Your knight has been sitting on e5 for ten moves, blocking your own rook on e1. Your opponent's king is still on e8. One knight move, any knight move, and the rook gives check. Suddenly your knight has a free move: it can jump to a square where it attacks the queen, even a square where it could normally be captured, because your opponent must deal with the check first.

That is a **discovered attack**: you move one piece and uncover an attack by another. It is the most powerful of the basic tactics, because it creates two threats with one move, and one of them comes from a piece that did not move at all. This chapter shows you how discovered attacks work, why discovered check and double check are so strong, and how to see the hidden lines before your opponent uses them against you.

## Anatomy of a discovered attack

A discovered attack needs two pieces of the same colour on one line:

* The **back piece** is a bishop, rook or queen. It is the piece whose attack will be uncovered.
* The **front piece** stands between the back piece and the target. It can be any piece, even a pawn or the king.

Together they form a **battery**: a line piece with a friendly piece in front of it, aimed at an enemy target. When the front piece moves, the back piece's attack is **discovered**. If the front piece also makes a threat with its move, the opponent faces two threats at once.

```board
fen: r1b2rk1/pp3ppp/2n1pq2/8/3N4/3B4/PB3PPP/R2Q1RK1 w - - 0 14
caption: A battery on the long diagonal. The knight on d4 is the front piece and the bishop on b2 the back piece. Any knight move uncovers an attack on the queen on f6, so the knight can use its move to make a second threat.
arrows: b2f6
blue: d4c6
squares: d4 f6
```

The key idea is this: **the front piece gets a free move.** Your opponent must deal with the uncovered attack, so whatever the front piece does with its move, it does it "for free". If it captures something, threatens something, or gives check, your opponent cannot answer both.

### What the front piece should do

Good uses of the front piece's move, roughly from best to worst:

1. **Give check.** Then the uncovered attack wins whatever it hits, because the check must be answered first.
2. **Capture something.** The front piece takes material, and the back piece's threat means the opponent has no time to recapture.
3. **Attack something valuable**, ideally a second piece that is loose or worth more than the front piece.
4. **Block or cut off the defence** of the target.

A front piece that moves to a "nice" square without a threat wastes the discovery. Your opponent just moves the attacked piece and nothing has been won.

:::key The two-threat test
A discovered attack only wins material if it creates **two** threats: the uncovered attack and the front piece's own threat. Before you play it, name both threats aloud. If you can only name one, your opponent will simply move the target.
:::

### Pawns and kings as front pieces

The front piece does not have to be a knight or a bishop. A **pawn** can be the front piece: a pawn advance that uncovers a rook or bishop, and at the same time attacks a piece, is a discovered attack with the cheapest possible unit. For example, with a white bishop on b2 behind a pawn on d4, the push d4-d5 can uncover an attack on the long diagonal while the pawn itself hits a knight on c6 or e6.

Even the **king** can be a front piece. In endgames a king standing between its own rook and the enemy king can step aside with a discovered check. The rule is the same as always: the move of the front piece should carry a threat of its own.

### What commonly goes wrong

* **Firing too early.** A battery is often stronger as a threat than as a move. If the discovery wins nothing now, keep it loaded; your opponent must spend moves guarding against it, and later a better target may appear.
* **A front-piece move without a threat.** The opponent simply moves the target, and the battery has been used up for nothing.
* **Forgetting the opponent's reply.** If the uncovered attack is not a check, your opponent may answer with a check or a capture of their own before saving the target. Look at their forcing moves before you fire.
* **The target escapes with tempo.** If the attacked piece can move to a square where it attacks something of yours, it may gain the time it needs. Check where the target can go.

## Discovered check

When the back piece's target is the **king**, the uncovered attack is a **discovered check**. This is the most dangerous version, for a simple reason: a check must be answered, so the front piece can go **anywhere**, even to a square where it is attacked, even to a square where it is defended twice. Your opponent cannot capture it while the king is in check, unless the capture itself also deals with the check.

```board
fen: r3kb1r/pp3ppp/2n2n2/q3B3/8/2N5/PPP2PPP/R2QR1K1 w kq - 0 12
caption: The bishop on e5 blocks the rook's line to the king on e8. Every bishop move is check. Bc7+ attacks the queen on a5 through b6, and Black must answer the check first: after ...Be7, Bxa5 wins the queen.
arrows: e5c7 c7a5
red: e1e8
squares: e5
```

When you have a discovered check, take your time. Look at **every square** the front piece can reach and ask what it attacks from there. Usually one square stands out: the one that attacks the queen, or a loose piece, or that captures something valuable. Exercises 09-02 and 09-05 practise exactly this choice.

### The ways a discovered check can fail

Discovered check is not automatically winning. Watch for three defences:

* **The king captures the front piece.** If the front piece moves next to the king onto an unprotected square, the king may take it and step off the line in the same move. In Exercise 09-02, ...Nxf2+ fails to Kxf2 for exactly this reason.
* **The checked side captures the back piece.** A check is answered by capturing the checking piece. If the back piece is loose and something can take it, the discovery fizzles.
* **A block that also defends.** The opponent may interpose a piece on the line that at the same time protects the target of the front piece.

### A famous opening example

The Petrov Defence contains one of the best-known discovered-check traps. After 1.e4 e5 2.Nf3 Nf6 3.Nxe5, Black should play 3...d6 first. If Black copies White with 3...Nxe4?, then 4.Qe2 sets up a battery: queen behind knight on the e-file, aimed at the black king.

```board
fen: rnbqkb1r/pppp1ppp/8/4N3/4n3/8/PPPPQPPP/RNB1KB1R b KQkq - 1 4
caption: After 4.Qe2 the queen and the knight on e5 form a battery against the king on e8. Black must block the e-file at once with 4...Qe7. If the knight on e4 retreats, for example 4...Nf6??, then 5.Nc6+ is a discovered check that attacks the queen.
red: e2e8
squares: e5
orientation: black
```

This book's White repertoire meets the Petrov with 3.Nxe5, so you will see this position. Remember the general lesson for both colours: do not grab pawns on the e-file while your king is still on it. Exercise 09-03 lets you play the winning discovered check.

## Double check

A **double check** happens when the front piece gives check *and* uncovers a check from the back piece, so the king is in check from two pieces at once.

Double check is the most forcing move in chess. Against a single check you have three possible answers: move the king, capture the checking piece, or block the check. Against a double check, **only a king move works**. You cannot capture two pieces with one move, and you cannot block two lines with one piece.

That has two consequences:

1. **The front piece cannot be captured**, no matter how many times it is attacked. A knight can land on a square attacked by two pawns, and it does not matter.
2. **If the king has no safe square, it is checkmate**, even if every checking piece could otherwise be taken.

### How to find double checks

A double check needs a front piece that can give check *from its new square*. So when you have a discovered check available, ask one extra question: **"Can the front piece land on a square from which it also checks the king?"** For a knight in front of a rook on the e-file, those are the squares a knight's jump from the king; for a bishop in front of a rook, the diagonal squares next to the king's diagonals. Because the front piece cannot be captured, you can choose a square that is attacked two or three times. What matters is only whether the king has an escape square afterwards.

### Double check to mate

The most famous double check in chess history is a short game played in Vienna in 1910.

```line
fen: startpos
moves: 1.e4 c6 2.d4 d5 3.Nc3 dxe4 4.Nxe4 Nf6 5.Qd3 e5 6.dxe5 Qa5+ 7.Bd2 Qxe5 8.O-O-O Nxe4?? 9.Qd8+!! Kxd8 10.Bg5+ Kc7 11.Bd8#
check: engine
caption: Réti vs. Tartakower, Vienna 1910. The queen sacrifice drags the king to d8, and 10.Bg5+ is a double check from the bishop and the rook on d1. After 10...Ke8 11.Rd8# is also mate.
```

```board
fen: rnb1kb1r/pp3ppp/2p5/4q3/4n3/3Q4/PPPB1PPP/2KR1BNR w kq - 0 9
caption: The position before 9.Qd8+. White's rook on d1 is behind the queen on the d-file, and the bishop on d2 is ready to swing to g5. The queen sacrifice puts the king on the square where both pieces can check it at once.
arrows: d3d8 d2g5
squares: d8
```

Notice the pattern: the back piece (the rook on d1) and the front piece (the bishop on d2) were already lined up. The queen sacrifice simply put the king where both could reach it. Exercises 09-07 and 09-09 contain double checks that mate in the same way.

## The windmill: discovered check again and again

When a rook and a bishop form a battery against a king in the corner, something remarkable can happen. The rook gives check from g7 (or g2), the king steps into the corner, and then the rook moves *along the rank*, capturing a piece, while the bishop behind it gives discovered check. The king steps out, the rook returns with check, and the cycle repeats. Each turn of this **windmill** wins another piece.

```board
fen: r4r1k/pp3pRp/5B2/8/8/8/PPq2PPP/4Q1K1 w - - 0 25
caption: The rook on g7 is the front piece and the bishop on f6 the back piece, aimed at the king on h8. Every rook move is discovered check. Here a rook move down the g-file, such as Rg3, is even checkmate: g8 and g7 are both covered.
arrows: g7g3
red: f6h8
squares: g7
```

You do not need to memorize windmill positions. Remember the shape: **a rook and a bishop (or queen) lined up on the enemy king, with the rook able to step out and back in.** When you see it, count how many pieces the front piece can collect with discovered checks before the king escapes.

## Spotting batteries: yours and your opponent's

Discovered attacks are missed because the line is "blocked". Your eye sees a bishop behind your own knight and thinks the bishop is doing nothing. Train yourself to see through your own pieces.

The common batteries are:

* **Queen behind bishop** on a diagonal, for example a queen on c2 and a bishop on d3 aimed at h7.
* **Rook behind knight** on a file, for example a rook on e1 and a knight on e5 aimed at the king or queen on e8.
* **Rook or queen behind bishop** on a file, for example a rook on d1 behind a bishop on d3 aimed at a queen on d6.
* **Bishop behind knight** on a diagonal, for example a bishop on b7 behind a knight on e4 aimed at a king on h1.
* **Rook behind pawn**, where a pawn push uncovers the rook (less common, but it happens on open files).

### A classic: queens facing each other on a file

One battery appears in game after game. The queens face each other on an open d-file, and one side has a bishop standing between them, for example a black bishop on d6 between the queens on d8 and d1. If that bishop moves with a threat, such as a capture with check on h2 or a capture of an unprotected piece, the queen behind it attacks the enemy queen, which is lost unless it is defended. The same is true with a rook behind the bishop instead of a queen. So whenever the queens or a queen and a rook share a file with one minor piece between them, both players must check: whose battery is it, and what can the front piece capture or check? Exercises 09-01 and 09-04 are built on this pattern.

### The battery scan

Once per move, run this short scan:

1. **For each of your bishops, rooks and queen**, follow its lines *through* your own pieces. Is there an enemy king, queen, rook or loose piece behind one of your pieces? If so, you have a battery.
2. **For that battery**, list every move of the front piece that comes with a threat: checks first, then captures, then attacks.
3. **Do the same for your opponent.** Follow each enemy line piece through *its* own pieces toward your king and queen.

## Worked example: which knight move?

Here is a typical middlegame position with a battery on the d-file. Follow the thinking process.

```board
fen: r2q1rk1/pp2bppp/2n1bn2/3N4/8/4BNP1/PPQ2PBP/3R1RK1 w - - 0 14
caption: White to move. The rook on d1 and the black queen on d8 are on the same file, and White's own knight on d5 stands between them.
arrows: d1d8
squares: d5
```

**Step 1: find the battery.** Looking along the d-file from the rook on d1, the first piece is my own knight on d5, and behind it is the black queen on d8. So any knight move uncovers an attack on the queen.

**Step 2: list the knight moves with threats.** Checks first: Nxe7+ captures the bishop on e7 with check, and Nxf6+ captures the knight on f6 with check. Then captures and attacks: Nb6 attacks the rook on a8, Nc7 attacks the rook on a8 and the bishop on e6 (but is not check).

**Step 3: what does my opponent do against each?** After Nxe7+, Black recaptures with ...Qxe7, and the queen has left the d-file *with the recapture*. The discovery has fizzled: White keeps some initiative, but the queen is safe. After Nxf6+, Black must answer the check, and the only capture is ...Bxf6, which does not move the queen. Now Rxd8 takes the queen.

```line
fen: r2q1rk1/pp2bppp/2n1bn2/3N4/8/4BNP1/PPQ2PBP/3R1RK1 w - - 0 14
moves: 14.Nxf6+ Bxf6 15.Rxd8 Rfxd8
check: engine
caption: The right knight move: a capture with check that does not let the queen escape. White has won the queen for a rook and a knight.
```

**Step 4: blunder-check.** After 15...Rfxd8, White has queen against rook and knight. Can Black win anything back immediately? The bishop on e6 attacks a2 and the rooks share the d-file, but nothing of White's is loose enough to fall at once. White is clearly winning.

The lesson: **the best front-piece move is one that leaves the target no escape.** A capture with check is ideal, but only if your opponent's answer to the check does not also move the target off the line.

## Defending against discovered attacks

Discovered attacks are hard to defend once they are played, because they come with two threats. The defence happens *before* they are played.

* **Move the target off the line.** If your queen stands on a file or diagonal behind an enemy piece that is aimed at it, move the queen. Exercise 09-06 asks you to do exactly that.
* **Capture or attack the front piece.** If you can take the front piece, the battery is gone. This is often the cleanest defence (Exercise 09-11).
* **Block the line with a protected piece** between the back piece and your target, so that even if the front piece moves, the line stays closed.
* **Keep your king off open lines.** An uncastled king on the e-file is the classic target for discovered checks. Castle early, and do not open the e-file while your king is still on it (the Petrov trap above).
* **Watch the "quiet" enemy piece.** A bishop or rook that seems to be blocked by its own piece is not asleep. Ask: "What happens if the piece in front of it moves?"

:::mistake Only looking at pieces that can move
The most common reason players miss discovered attacks, for both sides, is that they scan only the moves a piece can make, not the lines a piece controls *behind* other pieces. A bishop on b2 with your own knight on d4 in front of it still "sees" f6. Always follow a line piece's lines through friendly pieces.
:::

## How to spot discovered attacks in your own games

* **Look for lined-up pieces.** Any time two of your pieces stand on one line with an enemy target beyond them, mark it. The same for your opponent.
* **Check the king's lines.** Before every move, look along the file, rank and diagonals of both kings. A friendly piece between a line piece and the enemy king is a discovered check waiting to happen.
* **Favour moves with tempo for the front piece.** When you have a battery, list the checks and captures of the front piece first.
* **After the game**, go through your moves and find every battery that existed for either side. Note which were used, which were missed, and which you allowed. Log missed ones in your mistake journal under "missed-tactic".

:::nextgame Your battery checkpoint
In your next game, at least once every five moves, follow each of your bishops, rooks and queen to the edge of the board, *through* your own pieces. Then do the same for your opponent's pieces aimed at your king and queen.
:::

## Practice at the board

Set up each position on a board or in any free chess app. Work out your answer before you move a piece.

1. **The free move.** Set up `r3kb1r/pp3ppp/2n2n2/q3B3/8/2N5/PPP2PPP/R2QR1K1 w kq - 0 12`. List every bishop move. For each, say what it attacks in addition to the discovered check. Which is best?
2. **Which knight move?** Set up `r2q1rk1/pp2bppp/2n1bn2/3N4/8/4BNP1/PPQ2PBP/3R1RK1 w - - 0 14`. Play Nxe7+ and Nxf6+ in turn and compare what White wins.
3. **The Petrov trap.** From the start position, play 1.e4 e5 2.Nf3 Nf6 3.Nxe5 Nxe4 4.Qe2. Try Black's possible fourth moves and find the one that keeps the material balance (4...Qe7). Then play 4...Nf6 and find White's win.
4. **Double check.** Play through Réti vs. Tartakower until you can play it from memory. Then set up the position before 9.Qd8+ and try other White moves to see why only the queen sacrifice works so quickly.
5. **Battery hunting.** Take any of your recent games. At move 10, 15 and 20, find every battery on the board for both sides.

Check yourself with an engine only after you have written down your answers.

## Chapter summary

* A discovered attack moves a front piece and uncovers an attack by a back piece (a bishop, rook or queen) on the same line. Together they form a battery.
* The front piece gets a free move: use it to give check, capture, or attack something, so your opponent faces two threats.
* In a discovered check the front piece can go anywhere, even to an attacked square, because the check must be answered first. Check every square it can reach.
* A double check can only be answered by a king move. The checking pieces cannot be captured, and if the king has no square, it is mate.
* The windmill is a repeated discovered check by a rook and bishop against a cornered king.
* Spot batteries by following each line piece through your own pieces. Do the same for your opponent.
* Defend by moving the target off the line, capturing the front piece, blocking with a protected piece, and keeping your king off open lines.

:::cheat The battery check
1. Follow each of your bishops, rooks and queen through your own pieces: is an enemy king, queen, rook or loose piece behind?
2. If so, list the front piece's moves: checks first, then captures, then attacks.
3. Choose the move that leaves the target no escape and no counter-capture.
4. If the king is the target, check whether the front piece can also give check: a double check forces a king move.
5. Then run the same scan on your opponent's line pieces and defuse any battery aimed at your king or queen.
:::

@exercises
