---
chapter: 7
slug: forks
title: Forks
subtitle: One move, two targets
part: 2
stage: "600–800"
skills: [fork, hanging-pieces, defense, blunder-check]
objectives:
  - Recognize the geometry of knight, pawn, queen, king, bishop and rook forks.
  - Find fork squares by working backwards from two targets.
  - Use forcing moves (checks and captures) that drive pieces onto forkable squares.
  - Spot your opponent's fork threats and keep your own king and pieces off forkable squares.
next_game: Before every move, look for any square from which one of your pieces would attack two loose or more valuable targets at once, and check whether your opponent has such a square against you.
---

You are about to castle when your opponent's knight lands on c7. It checks your king and attacks your rook in the corner. You move the king, the knight takes the rook, and the game is effectively over. Or you are on the other side: your pawn steps forward and suddenly two enemy pieces are attacked, and only one can be saved.

That is a **fork**: one piece attacking two or more targets at the same time. Your opponent has only one move to answer, so usually only one target can be saved. Between 600 and 800, forks decide more games than almost any other tactic, because they are easy to miss and easy to set up. This chapter teaches you to see them, for both sides, before they happen.

## What a fork is, and why it works

A **fork** (also called a **double attack**) is a move that creates two threats at once. The threats can be against pieces, against the king, or a mix such as "check plus an attack on a rook". The defender gets one move. If no single move answers both threats, something is lost.

Three things make a fork work:

1. **Two targets.** Each target must be either *loose* (undefended) or *more valuable* than the forking piece. A knight attacking two defended pawns is not a fork in any useful sense.
2. **A safe forking piece.** If the opponent can simply capture the piece that forks, there is no fork. This is the most common reason "forks" fail at club level.
3. **No single answer.** The opponent must not have one move that saves both targets, for example by moving one target to a square where it protects the other, or by giving a check of their own.

The strongest forks include a **check**, because the check must be answered first. The king moves, and then you collect the second target.

```board
fen: r1b1kbnr/ppN2ppp/2n1q3/8/3P4/8/PPP1BPPP/R1BQK2R b KQkq - 0 9
caption: A family fork. The knight on c7 checks the king and attacks the rook on a8 and the queen on e6. Black must move the king, and White takes the queen.
arrows: c7e8 c7a8 c7e6
squares: c7
orientation: black
```

When a knight forks the king, queen and rooks together, coaches call it a **family fork**. When it hits king and queen, it is a **royal fork**. The names do not matter much. What matters is that the knight on c7 above is attacked by nothing, so Black is simply losing material.

## Knight forks

The knight is the great forking piece for two reasons. It jumps, so it cannot be blocked. And its attack looks nothing like the attack of the other pieces, so a queen and a king standing "safely" can still be hit together by a knight.

### The geometry

A knight always lands on a square of the opposite colour. That gives you a quick filter: **a knight can only fork pieces that stand on squares of the same colour** (both light or both dark), and the knight itself must stand on the other colour. If the king is on a dark square and the queen is on a light square, no knight can fork them.

The second filter is distance. A knight attacks squares two steps away in a "short L". Two targets it can fork are always within four squares of each other, with typical shapes such as:

* **Same rank or file, two squares apart with one square between** (king e8 and rook c8 can both be hit from d6).
* **Four squares apart on a rank** (king e8 and rook a8 can both be hit from c7).
* **A "long L" shape** (king g8 and queen d7 can both be hit from f6; king g8 and queen c6 from e7).

You do not need to memorize these shapes. Lists of shapes are hard to use at the board, and a method is better.

### Working backwards from the targets

Instead of asking "where can my knight go?", ask **"which squares attack both targets?"** and only then "can my knight get there?"

The procedure:

1. Pick two targets: the king plus something valuable or loose.
2. List the squares from which a knight attacks the first target (at most eight).
3. Check which of those also attack the second target. These are the **fork squares**.
4. Ask whether your knight can reach a fork square *now*, and whether that square is guarded.

```board
fen: r4rk1/pp1q1p1p/2n1b1p1/3N4/8/5N2/PPP1QPPP/R4RK1 w - - 0 15
caption: Targets: king on g8, queen on d7. Knight squares that attack g8 are e7, f6 and h6. Of those, only f6 also attacks d7. The knight on d5 can jump there, and with the pawn on g6 instead of g7, nothing guards f6.
arrows: d5f6
red: f6g8 f6d7
squares: f6
```

White plays Nf6+, the king moves, and Nxd7 wins the queen for a knight. Notice how the defensive pawn move ...g6 changed everything: with a pawn on g7, the square f6 would be covered and the fork would not exist. Pawn moves create and remove fork squares all the time.

:::key The fork square is the whole story
A knight fork needs one square that touches both targets. Find that square first. Then ask two questions: can my knight get there (now, or after a check)? And is the square guarded? If it is guarded by a pawn, forget it. If it is guarded by a piece, count: the fork may still win if the target is worth more than the knight.
:::

### What commonly goes wrong

The most common knight-fork mistake at this level is **jumping onto a guarded fork square**. A knight lands on c7 "forking" king and rook, and the queen on d8 simply takes it. Exercise 07-11 is built on exactly this: count the defenders of the fork square before you jump.

The second mistake is **forgetting the forking piece itself**. Your opponent's knight lands on c7 attacking both of your rooks, you panic and move a rook, and only later notice that your queen could have captured the knight. Before you react to a fork, run the safety scan from [Chapter 4](#ch-04): can I take the forking piece? Is it defended?

## Pawn forks

A pawn fork is the cheapest fork of all. A pawn is worth about 1 point; if it forks two minor pieces, you win at least 2 points even if the pawn is captured afterwards.

A pawn attacks the two squares diagonally in front of it, so a pawn fork happens when **two enemy pieces stand side by side, one square apart, on the rank in front of a pawn that can advance safely**. The pawn needs to be safe on its new square, or at least it must not matter if it is taken.

```board
fen: rnbqk2r/ppp2ppp/3bpn2/8/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq - 0 5
caption: The bishop on d6 and the knight on f6 stand on the same rank with one square between them. White plays e5, protected by the pawn on d4, and one of the two pieces is lost.
arrows: e4e5
red: e5d6 e5f6
squares: d6 f6
```

The pattern for Black is the mirror image: White pieces on d3 and f3, for example a bishop on d3 and a knight on f3, can be forked by ...e4. Beginners often develop exactly like this with e3, Bd3 and Nf3 while Black still has pawns on d5 and e5. Exercise 07-02 shows the result.

### When to look for pawn forks

Pawn forks hide in plain sight because the pawn move looks quiet. Make it a habit: **whenever two enemy pieces stand on the same rank with exactly one square between them, look at the pawn that could step between and below them.** Check three things: can the pawn get there in one move, is the square safe (or does it not matter), and can the opponent answer with a check or a capture first?

### The fork trick

The most famous pawn fork in the openings is called the **fork trick**. You give up a knight to remove a central pawn, then win the piece back with a pawn fork. Here it is in the Italian Four Knights, which can arise when White plays 4.Nc3 instead of the 4.d3 recommended in this book's repertoire.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.Nc3 Nxe4 5.Nxe4 d5 6.Bd3 dxe4 7.Bxe4 Bd6
check: engine
caption: Black takes on e4, and after 5.Nxe4 the pawn fork 5...d5 hits the bishop on c4 and the knight on e4. White protects the knight with 6.Bd3, and after 6...dxe4 7.Bxe4 Black has regained the piece with equal chances.
```

```board
fen: r1bqkb1r/ppp2ppp/2n5/3pp3/2B1N3/5N2/PPPP1PPP/R1BQK2R w KQkq - 0 6
caption: The moment of the fork trick, after 5...d5. The pawn attacks c4 and e4 at once. White's best is 6.Bd3, protecting the knight, but after 6...dxe4 7.Bxe4 material is level again.
red: d5c4 d5e4
squares: c4 e4
```

The fork trick is a fair trade, not a winning trap. It does show the principle clearly: a "sacrifice" of a piece is fine if a fork brings it straight back.

:::mistake The fork that can be answered with a check
A fork only works if the opponent has no forcing answer. In the Giuoco Piano, 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.Nxe5? Nxe5 5.d4 tries the fork trick for White: the d-pawn attacks the bishop on c5 and the knight on e5. But Black has 5...Bb4+!, moving one target away *with check*, and after 6.c3 Nxc4 Black keeps the extra piece. Before you play a fork, ask: "Can my opponent move one target with check, or capture something with check?"
:::

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.Nxe5? Nxe5 5.d4 Bb4+ 6.c3 Nxc4 7.cxb4
check: engine
caption: The failed fork trick. Black escaped the pawn fork with a check and is a piece up for a pawn.
```

## Queen forks

The queen moves in eight directions, so she can create a double attack from many squares. Her weakness is value: if either target is defended and can take her, the fork fails. That is why **queen forks almost always combine a check with an attack on a loose piece**, or attack two loose pieces at once.

```board
fen: r1b1r1k1/p2q2pp/1p1p2n1/5p2/2P5/1P3NP1/P3PPBP/R2Q1RK1 w - - 0 15
caption: Black's f-pawn has advanced to f5, opening the a2-g8 diagonal. Qd5+ checks the king through e6 and f7, and attacks the loose rook on a8 through c6 and b7. Whatever Black does, Qxa8 follows.
arrows: d1d5
red: d5g8 d5a8
squares: d5
```

How to find queen forks:

1. **List the loose pieces** on both sides. A loose piece is one with no defender.
2. **Look at your possible checks.** For each check, ask: "From that square, does my queen also attack a loose piece?"
3. **Look along the lines from each loose piece back to the enemy king.** If a single queen square lies on a line to the king *and* a line to the loose piece, that square is a fork square.

The black version is just as common. In Exercise 07-03, White's bishop on g5 pins a knight but has no defender, and ...Qa5+ checks along the diagonal toward e1 while attacking g5 along the fifth rank.

:::key Loose pieces drop off
Coaches have a short slogan for this: **LPDO, "loose pieces drop off"**. A piece with no defender is not lost yet, but it is the raw material of almost every fork. Any time you see a loose piece (yours or your opponent's), stop and look for a double attack on it. Most queen forks in amateur games hit a loose bishop or knight that "was safe" one move earlier.
:::

## King, bishop and rook forks

Every piece can fork. The others simply do it less often.

* **King forks** appear in endgames, where the king is an active piece. A king that steps forward can attack two loose pawns or a loose pawn and a piece at once. The king cannot be blocked, and it can only be driven away by checks. In endgames, keep your pieces and pawns protected, or at least keep them where the enemy king cannot reach both.
* **Bishop forks** usually come with a check along a diagonal. A typical case: once Black's f-pawn has moved, a white bishop on d5 checks the king on g8 and hits a rook on a8 at the same time.
* **Rook forks** often happen on an open rank: a rook check on the back rank that also hits a loose piece on the same rank, or a rook on the seventh rank attacking two pawns.

The thinking is the same for all of them: find two targets that lie on lines (or, for the king, squares) one piece could reach in one move, and check whether that square is safe.

## Setting up a fork

Often the fork is not there yet: one target is on the wrong square. Then you need a **forcing move that drives a piece onto a forkable square**. The usual tools:

* **A capture that must be recaptured.** If only the king can recapture, you have decided where the king will stand.
* **A check that leaves the king one square.** A sacrifice with check can drag the king onto the fork square.
* **A trade of queens.** Trading on d8 or d1 often pulls the king to d8 or d1, where a knight on f7, c7, f2 or c2 is waiting.

The sequence matters. The forcing move must come *first*, because it limits your opponent's choices. If you play the fork first, the opponent gets a free move to escape or to make a forcing move of their own.

## Worked example: getting the move order right

Here is a position of the kind that arises after an early queen's-pawn opening goes wrong for Black. Follow the thinking process, not just the moves.

```board
fen: rnbqk2r/ppp2ppp/5n2/2b3N1/8/8/PPP1PPPP/RNBQKB1R w KQkq - 0 6
caption: White to move. The knight on g5 attacks f7, the d-file is open, and the queens face each other on d1 and d8.
arrows: g5f7
squares: d8 h8 f7
```

**Step 1: checks, captures and threats for both sides.** White has one check, Qxd8+, which is also a capture. White's captures are Qxd8+ and Nxf7 (and Nxh7, which wins only a pawn). Black's threats matter too: Black can trade queens with ...Qxd1+, and the bishop on c5 eyes f2.

**Step 2: look for targets.** The black king is on e8 and the rook on h8. A knight on f7 would attack d8 and h8. So the fork square is f7, and the knight can capture there right now.

**Step 3: candidate one, 6.Nxf7.** It attacks the queen on d8 and the rook on h8. But it is not check, so Black gets a free move, and Black has forcing moves. The queen on d8 is attacked, but it can capture the white queen with check, and Black also has ...Bxf2+.

```line
fen: rnbqk2r/ppp2ppp/5n2/2b3N1/8/8/PPP1PPPP/RNBQKB1R w KQkq - 0 6
moves: 6.Nxf7? Bxf2+ 7.Kxf2 Qxd1
check: engine
caption: The wrong move order. Black ignores the fork, answers with forcing moves, and wins the white queen for a bishop.
```

**Step 4: candidate two, 6.Qxd8+ first.** This capture is check, and the only recapture is 6...Kxd8, because no other black piece reaches d8. Now the king stands on d8, a knight's jump from f7, and the rook is still on h8.

```line
fen: rnbqk2r/ppp2ppp/5n2/2b3N1/8/8/PPP1PPPP/RNBQKB1R w KQkq - 0 6
moves: 6.Qxd8+ Kxd8 7.Nxf7+ Ke8 8.Nxh8
check: engine
caption: Trade first, fork second. The queen trade drives the king to d8, and Nxf7+ forks king and rook. White wins a rook and a pawn.
```

**Step 5: blunder-check.** After 8.Nxh8 the knight is in the corner and may be trapped, but White is already a full rook ahead, so even losing the knight later leaves White clearly winning.

The lesson: **the fork was the same in both lines, but only the forcing move order worked.** Check first, capture first, fork second.

## Defending against forks

Every pattern in this chapter can be used against you. The defensive version of the safety scan from [Chapter 4](#ch-04) adds one question: **"Where can my opponent's knights, pawns and queen go next move, and would they attack two things from there?"**

```board
fen: r1bqkb1r/ppp2ppp/4pn2/3p4/1n1P4/2N1PQ1P/PPP2PP1/R1B1KBNR w KQkq - 1 6
caption: White's queen has left d1, so nothing guards c2. The knight on b4 threatens ...Nxc2+, forking the king and the rook on a1. White must deal with it now, for example with Qd1 or Bb5+.
red: b4c2 c2e1 c2a1
squares: c2
```

If White ignores the threat with a routine developing move, the fork lands:

```line
fen: r1bqkb1r/ppp2ppp/4pn2/3p4/1n1P4/2N1PQ1P/PPP2PP1/R1B1KBNR w KQkq - 1 6
moves: 6.Nge2? Nxc2+ 7.Kd1 Nxa1
check: engine
caption: The knight takes a pawn with check and then the rook on a1. Even if White later traps the knight in the corner, Black has won the exchange and a pawn, and the white king is stuck in the centre.
```

### How to defend

When you spot a fork threat, you have four kinds of answer. Look for them in this order:

1. **Remove or block the forking piece.** Capture it, or attack it so it has to leave.
2. **Guard the fork square.** Put a piece or pawn where it covers the square, as ...Ba5 covers c7 in Exercise 07-06.
3. **Move one of the targets**, ideally to a square where it also protects the other, or with tempo (a check or an attack).
4. **Take the square away first**, as in Exercise 07-07, where White plays e4 before Black can play ...e4.

### Prevention: habits that stop forks before they start

* **Castle early.** An uncastled king on e1 or e8 with rooks still in the corners is the classic target for knight forks on c2, c7, f2 and f7.
* **Watch your queen and king on the same colour.** A queen standing a knight's fork away from your king (king g8 with the queen on d7, fork square f6, or on c6, fork square e7) is a standing invitation. Check the fork squares between them, and whether a pawn or piece covers them.
* **Keep pieces protected.** Loose pieces are what queen forks feed on. When you finish a move, scan for any piece of yours with no defender.
* **Be careful with pawn moves near your king.** Moving a pawn can uncover a fork square, as ...g6 uncovered f6 in the earlier diagram.

:::mistake Reacting to the fork instead of the board
When a fork appears, many players immediately save the more valuable target. Stop for ten seconds first. Can you capture the forking piece? Do you have a check or a bigger threat? Can one move save both targets? Exercise 07-10 shows a "fork" where the right answer is simply to take the knight.
:::

## How to spot forks in your own games

Forks are easy to find once you look for the right features. Train yourself to notice these signals during the game:

* **A loose piece.** Any undefended piece, yours or theirs, is a fork target.
* **An uncastled king with a rook still in the corner.** Look at c2/c7 and f2/f7.
* **King and queen on the same colour squares, close together.** Find the fork squares between them.
* **Two pieces side by side with one square between them** in front of an enemy pawn.
* **An open file or diagonal toward the king**, which allows queen checks that also hit something else.

After each game, go through it once looking only for forks: forks you played, forks you allowed, and forks that were available but missed. Write each one in your mistake journal under "missed-tactic" or "hanging-piece". After a few weeks you will see the same shapes repeating, and that repetition is exactly what builds pattern recognition.

:::nextgame Your fork checkpoint
In your next game, before each move, spend five seconds on two questions: "Is there a square where my knight, pawn or queen would attack two things?" and "Is there such a square for my opponent?" If the answer to the second is yes, deal with it before anything else.
:::

## Practice at the board

Set up each position on a board or in any free chess app's analysis mode. Try the task before moving anything, then check yourself.

1. **Fork squares by hand.** Set up `r4rk1/pp1q1p1p/2n1b1p1/3N4/8/5N2/PPP1QPPP/R4RK1 w - - 0 15`. Without moving a piece, name every square from which a white knight would attack both g8 and d7. (Answer: only f6.) Then put a black pawn on g7 instead of g6 and repeat: the fork disappears.
2. **Pawn fork scan.** Set up `rnbqk2r/ppp2ppp/3bpn2/8/3PP3/2N5/PPP2PPP/R1BQKBNR w KQkq - 0 5`. Find the pawn fork, then play out Black's best defence (...Bb4, attacking the knight on c3) and count the material after White captures on f6.
3. **Move order.** Set up `rnbqk2r/ppp2ppp/5n2/2b3N1/8/8/PPP1PPPP/RNBQKB1R w KQkq - 0 6`. Play 6.Nxf7 and find Black's best reply. Then reset and play 6.Qxd8+ first. Compare the results.
4. **Defensive drill.** Set up `r1bqkb1r/ppp2ppp/4pn2/3p4/1n1P4/2N1PQ1P/PPP2PP1/R1B1KBNR w KQkq - 1 6`. Find three different White moves that stop ...Nxc2+, and one natural move that does not.
5. **Random positions.** Open any of your recent games at move 15. For both sides, list every loose piece and every fork square against the kings. Do this for five positions.

To check yourself, use an engine only *after* you have written down your answer.

## Chapter summary

* A fork is one move that creates two threats. It works when both targets are loose or more valuable than the forking piece, the forking piece is safe, and no single reply answers both threats.
* Knight forks are the most common. A knight forks only pieces on the same colour; find fork squares by working backwards from the two targets, then ask whether the square is guarded.
* Pawn forks hit two pieces standing side by side with one square between them. The fork trick (...Nxe4 and ...d5) uses one to regain a piece.
* Queen forks almost always combine a check with an attack on a loose piece. Loose pieces drop off.
* Kings, bishops and rooks fork too, especially in endgames and along open lines.
* Many forks must be set up: a capture, a check or a queen trade drives a piece onto the fork square. Forcing moves come first, the fork second.
* Defend by removing the forking piece, guarding the fork square, moving a target with tempo, or taking the square away before it is used. Castle early and keep pieces protected.

:::cheat The fork check
1. List the targets: the enemy king, the queen, rooks, and every loose piece.
2. For each pair of targets, find the squares from which one of your pieces would attack both.
3. Ask: can a piece of mine reach that square now, or after a check or forced capture?
4. Check that the square is safe and that the opponent has no forcing answer (a check, a capture, or one move that saves both).
5. Play the forcing moves first and the fork second.
6. Then run the same scan for your opponent before you commit to your move.
:::

@exercises
