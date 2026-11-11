---
chapter: 10
slug: removing-defender
title: Removing the Defender, Overloading, Deflection and Decoys
subtitle: Every defender has a job. Make it fail.
part: 2
stage: "600–800"
skills: [removing-defender, overloading, deflection, decoy, trapped-piece]
objectives:
  - List the duties of each enemy defender and spot the one that is doing too much.
  - Win material by capturing, chasing or blocking a defender.
  - Use deflection and decoy sacrifices to drag pieces off key squares or onto bad ones.
  - Trap pieces by counting their escape squares before you attack them.
  - Combine these ideas with forks, pins and discovered attacks from Chapters 7–9.
next_game: For each enemy piece that defends something, ask "what is its job?" — and if one piece has two jobs, look for a forcing move that makes it choose.
---

You have a fork in mind. Your knight could land on c7 and hit the king and the rook. Then you notice the bishop on d6 guarding c7, sigh, and play something else. A few moves later your opponent's position has become solid and the chance has gone.

Stronger players don't give up so quickly. When a defender stands in their way, they ask a simple question: *can I get rid of it?* They might capture it, chase it away, cut it off, or give it a second job it cannot handle. Tactics are seldom made of a single trick. Usually there is one move that prepares the trick by taking out a guard. This chapter teaches you to see those preparing moves. They turn "nearly a tactic" into a won game, and at 600–800 they are everywhere.

## What is each piece doing?

Up to now you have mostly asked "what is attacked?" and "what is undefended?". This chapter adds a deeper question: **what is each defender actually doing?**

A **duty** is a job a piece performs for its side: guarding another piece, guarding a square (for example a square where mate could happen), or blocking a line. Most pieces have one or two duties at any moment. A piece's duty can be more important than its value. A knight worth three points can be the only thing standing between its king and mate.

Here is the procedure we will use for the whole chapter. Pick the enemy piece that is defending something important and write down (in your head) its duty list:

1. Which of my targets does it defend?
2. Which squares does it guard: back rank, mating squares, forking squares, promotion squares?
3. Is it the *only* defender of any of these?

When a piece is the only defender of something valuable, it is a target. When a piece has two important duties, it is **overloaded**, and you are probably one forcing move away from winning material.

:::key Defenders are targets
If a piece is the only thing holding the enemy position together, attack that piece rather than the thing it protects. Capture it, chase it, block it, or overload it.
:::

```board
fen: r1br2k1/pp3ppp/1q6/3n4/2B5/5NQ1/PPP2PPP/R3R1K1 w - - 0 18
caption: Duty list for the rook on d8: it guards the knight on d5 and the back rank. One rook, two jobs.
arrows: c4d5
red: d8d5 d8e8
squares: d8 e8
```

Look at Black's rook on d8. Its duties: it defends the knight on d5, and it covers e8, the only square through which White's rook could invade the back rank. Black's king has no **luft** (an escape square created by moving a pawn in front of the king). So the rook is overloaded, and White simply takes the knight:

```line
fen: r1br2k1/pp3ppp/1q6/3n4/2B5/5NQ1/PPP2PPP/R3R1K1 w - - 0 18
moves: 18.Bxd5 Rxd5?? 19.Re8#
check: engine
diagram: end
caption: The rook could defend the knight or the back rank, not both. Recapturing loses the game at once.
```

If Black does not recapture, White is a clean piece up. The duty list told you where to look before you calculated a single line.

## Removing the defender

**Removing the defender** means getting rid of the piece that guards your real target. There are three main ways to do it: capture it, chase it, or block it.

### Capture the defender

The most direct method is to take the defender, even if the trade looks equal on its own. A bishop for a knight is a fair exchange. A bishop for a knight that was the only guard of h7 or of a forking square is a winning exchange.

```board
fen: r1bq1rk1/pppp1ppp/2n2n2/1B2b3/8/3P1N2/PPP2PPP/RNBQ1RK1 w - - 0 8
caption: The bishop on e5 is attacked by the knight on f3 and defended only by the knight on c6. Capture the defender.
arrows: b5c6 f3e5
red: c6e5
squares: c6 e5
```

Black's bishop on e5 has exactly one guard, the knight on c6. White takes it: 8.Bxc6. If 8...dxc6, then 9.Nxe5 wins the bishop. Black's best try is to grab a pawn on the way out, but it doesn't save the material:

```line
fen: r1bq1rk1/pppp1ppp/2n2n2/1B2b3/8/3P1N2/PPP2PPP/RNBQ1RK1 w - - 0 8
moves: 8.Bxc6 Bxb2 9.Bxb2 dxc6
check: engine
caption: White has won a knight and bishop for a bishop and a pawn: a clean piece for a pawn.
```

This is why your counting from [Chapter 3](#ch-03) must include a question about duties. If you count "bishop takes knight, pawn takes bishop, even trade", you miss the follow-up: once the knight is gone, something else falls, or a mate appears. The trade is only the first half of the combination.

:::mistake Counting the trade, not the consequence
Beginners often reject Bxf6 or Bxc6 because "it gives up my good bishop". Ask what the captured piece was *guarding*. If its disappearance wins material or mates, the bishop has done its job.
:::

### Chase the defender

Sometimes you cannot capture the defender, but you can attack it with something cheaper, usually a pawn. A defender that has to run away is no longer defending.

```board
fen: r4rk1/pbq1bppp/1pp1pn2/8/3PP3/2PQ1N2/PPB2PPP/R1B1R1K1 w - - 0 12
caption: White's queen and bishop aim at h7. Only the knight on f6 defends it. The e-pawn can chase the knight away.
arrows: e4e5 d3h7
red: f6h7
squares: h7 f6
```

Here White's queen on d3 and bishop on c2 form a **battery** (two pieces lined up on the same line, the front one supported by the one behind). The knight on f6 is the only guard of h7. The pawn push e4-e5 attacks the knight, and every square the knight can run to abandons h7.

```line
fen: r4rk1/pbq1bppp/1pp1pn2/8/3PP3/2PQ1N2/PPB2PPP/R1B1R1K1 w - - 0 12
moves: 12.e5 g6 13.exf6 Bxf6
check: engine
caption: Black has to block the diagonal with ...g6, and White collects the knight for a pawn.
```

If the knight moves, for example 12...Nd5, then 13.Qxh7# ends the game. Black's best is to give up the knight with 12...g6 and stay a piece down. The pawn push was decisive, but only because you had first noticed the knight's duty.

### Block the defender

The third method is to cut the line between the defender and what it defends. If a rook on d8 protects a piece on d2 along the d-file, a piece of yours planted on d5 can break that connection. This is called **interference**. It is less common at this level than capturing or chasing, and you will meet it again in [Chapter 24](#ch-24). For now, add it to your question: *can I capture it, chase it, or get in its way?*

## Overloaded pieces

An **overloaded piece** is a defender with two duties that cannot both be carried out. You exploit it by forcing it to perform one duty, and then you take advantage of the other.

The rook on d8 in the first diagram was overloaded. Here are the most common overloaded defenders you will meet:

- **The back-rank rook.** It guards the first or eighth rank *and* a piece somewhere on its file or rank.
- **The queen guarding two pieces.** A queen often protects two loose pieces at once. Capture one, and if she recaptures, the other falls.
- **The pawn guarding two squares.** A pawn on g7 that guards both f6 and h6 cannot be in two places.
- **The king.** A king that defends a piece next to it and also has to stay on a particular square can be overloaded by a check.

To exploit an overload, you usually begin with a capture or a check on one of the two duties. That forces the defender to choose, and you take whatever it leaves behind.

:::coach Look for the word "only"
In my coaching experience, the fastest way to find overloads is to say the word "only" out loud while you scan. "This rook is the only guard of the back rank. It is also the only guard of the knight." Two "only"s on the same piece means there is very likely a tactic.
:::

## Deflection: force the defender away

**Deflection** is closely related to overloading. You force a defender to leave its post, usually with a check, a capture it must answer, or a sacrifice it must accept. The difference is mainly in how you think about it. With overloading, you notice the defender has two jobs. With deflection, you look for a forcing move that pulls it away from its one critical job.

The defender you deflect can be any piece, including a pawn or the king. Kings are especially easy to deflect because a check must be answered. If the king is the only defender of a piece, a check that drags the king away usually wins that piece.

One of the most useful deflections at this level is against a defender that guards a promotion square.

```board
fen: 3r4/p2P1pkp/1p4p1/1B6/4b3/8/P4PPP/2R3K1 w - - 0 30
caption: Black's rook on d8 blocks the d-pawn. A rook offer on c8 deflects it.
arrows: c1c8
red: d8d7
squares: d8 c8
```

The rook on d8 has one job: stop the pawn on d7 from becoming a queen. White's bishop on b5 protects the pawn, so Black cannot simply take it. Now 30.Rc8! attacks the rook. If 30...Rxc8, then 31.dxc8=Q. If the rook leaves the d-file, the pawn promotes on d8.

```line
fen: 3r4/p2P1pkp/1p4p1/1B6/4b3/8/P4PPP/2R3K1 w - - 0 30
moves: 30.Rc8 Rxd7 31.Bxd7
check: engine
caption: The best Black can do is give up the rook for the pawn. White is a whole rook ahead.
```

:::mistake Deflecting with a piece that can be ignored
A deflecting move must be forcing. If your opponent can say "no thanks" and play something useful, nothing has been deflected. Checks, captures that must be answered, and threats to queen or mate are forcing. A quiet attack on a defended piece usually isn't.
:::

## Decoy: lure a piece onto a bad square

A **decoy** (also called **attraction**) is the mirror image of deflection. Instead of pulling a defender *away* from a good square, you lure an enemy piece, often the king, *onto* a bad square. Usually you do it with a sacrifice the opponent must accept.

Why would a square be bad? Most often because a fork, skewer or mate works there. A knight fork of the king and queen only works if the king stands on the right square. A decoy puts it there.

```board
fen: 5rk1/ppR3pp/4p1q1/8/3Nn3/1Q2P3/PP4PP/6K1 b - - 0 24
caption: A knight on d2 would fork a king on f1 and the queen on b3. Black can force the king to f1.
arrows: f8f1 e4d2
red: d2b3
squares: f1 d2 b3
orientation: black
```

From d2, Black's knight attacks b3 and f1. White's king is on g1, so it is safe from that knight, for now. The rook sacrifice 24...Rf1+ leaves the king only one legal reply, capturing the rook, which brings it to the forking square.

```line
fen: 5rk1/ppR3pp/4p1q1/8/3Nn3/1Q2P3/PP4PP/6K1 b - - 0 24
moves: 24...Rf1+ 25.Kxf1 Nd2+ 26.Kf2 Nxb3 27.axb3
check: engine
caption: Black gave a rook and won a queen. The decoy made the fork happen with check.
```

In this particular position 24...Nd2 at once is also strong, because the knight hits b3 and f1 together and the rook backs it up. But the pattern to remember is the decoy: *if the fork works only with the king on a certain square, look for a check or a sacrifice that forces the king there.* You will see it again with the king on h1 and h8, and in many mating attacks in [Chapter 11](#ch-11).

:::key Deflection vs. decoy
Deflection: drag a defender *away from* a square it must guard. Decoy: drag a piece *onto* a square where it gets hit. Both use forcing moves, and both start from the same question: "Which square would I like this piece to be on — or not be on?"
:::

## Trapped pieces: remove the escape squares

So far we have taken away a piece's *defence*. The same thinking works on its *escape squares*. A **trapped piece** is one that is attacked and has no safe square to go to. You win it not by attacking it harder, but by checking that every exit is covered first.

There are three classic situations at this level.

**The greedy bishop.** A bishop that captures a rook's pawn deep in enemy territory, typically on a2, a7, h2 or h7, can be shut in by a single pawn move. For example, a black bishop that takes on a2 relies on the diagonal a2-g8 to get out. If White plays b3, protected by the c2-pawn, the diagonal is closed and the bishop may have no way home.

**The knight on the rim.** A knight on the edge controls only four squares, or even two in the corner. If you cover those squares first, a single pawn attack wins it. (Exercise 10-05 is a perfect example.)

**The queen hunt.** A queen that grabs a pawn far from home, especially the b2- or b7-pawn, can run short of squares. Developing moves with gain of time, like Nb5, Rb1 or Nc3-a4, can trap her outright.

```line
fen: startpos
moves: 1.d4 d5 2.Bf4 c5 3.e3 Qb6 4.Nc3 Qxb2? 5.Nxd5
check: engine
diagram: end
caption: Black's queen has grabbed b2 and is far from home. White threatens Nc7+ and Rb1, and the queen soon runs out of squares.
```

:::cheat Before you attack a piece, count its exits
1. Name every square the piece can move to.
2. Cross out the squares your pieces or pawns cover.
3. Cross out the squares its own pieces block.
4. If none are left, find the cheapest attacker — usually a pawn — and attack it.
5. Check your attacker is protected and that the opponent has no strong counter-attack in the meantime.
:::

The same procedure protects your own pieces. Before your bishop takes on a7 or your queen takes on b7, count its way back. If you cannot name a safe escape route, the "free" pawn is probably bait.

## Combining the ideas

Removing the defender rarely stands alone. It is the preparation; the payoff is usually a motif you already know from Chapters 7–9: a fork, a pin, a discovered attack, or mate. The skill is to see the two-step plan: "This fork would work *if* that piece were gone."

A useful habit is to work backwards. Look for the tactic you *wish* you had: a fork square, a mating square, a skewer line. Then ask what stops it. The answer is the defender, and the defender is your new target.

### Worked example: the fork that needs help

Let's walk through a position the way you should think at the board.

```board
fen: r1b1k2r/ppp2ppp/2nbqn2/1N6/5B2/5N2/PPP1BPPP/R2Q1RK1 w kq - 0 9
caption: White to move. A knight on c7 would fork the king, queen and rook. What stops it?
arrows: b5c7 f4d6
red: d6c7
squares: c7 e8 e6 a8
```

**Step 1: checks, captures, threats.** I look at my forcing moves first. Nxd6+ is a check and a capture. Bxd6 is a capture. Nc7+ is a check. Nxa7 is a capture.

**Step 2: what would I like to happen?** Nc7+ catches my eye immediately. From c7 the knight would attack e8, e6 and a8: the king, the queen and a rook. That is the tactic I *wish* I had.

**Step 3: what stops it?** If I play Nc7+ now, the bishop on d6 just takes my knight: Bxc7. So the bishop on d6 is the guard of c7. I check the rest of Black's pieces: the queen on e6 does not cover c7, nor do the knights. The bishop is the *only* defender of the forking square.

**Step 4: can I remove the defender?** I have two ways to capture it: Nxd6+ and Bxd6. After 9.Nxd6+ cxd6 my knight is gone, so there is no fork any more. After 9.Bxd6 the knight stays on b5, ready to jump.

**Step 5: what is Black's best reply?** If 9...cxd6, the c7-square is unguarded and 10.Nc7+ forks king, queen and rook. If Black does not recapture, I am a piece up. Black's most stubborn try is to recapture with the queen and give it up for my knight:

```line
fen: r1b1k2r/ppp2ppp/2nbqn2/1N6/5B2/5N2/PPP1BPPP/R2Q1RK1 w kq - 0 9
moves: 9.Bxd6 Qxd6 10.Nxd6+ cxd6
check: engine
caption: Black has given the queen for a bishop and knight. White is close to winning.
```

**Step 6: blunder-check.** Before playing 9.Bxd6, I make sure Black has no check or capture that changes things, for example a capture of my queen or a mate threat. There isn't one. I play it.

Notice what happened. The fork was the idea, but removing the defender was the move. Without the duty list, it would have been easy to see Nc7+ fail and move on.

## How to spot these ideas in your games

These motifs hide in plain sight because the decisive move often looks like an ordinary exchange or a pointless sacrifice. Here is how to train your eye.

**When you are attacking.** After you have looked at checks, captures and threats ([Chapter 4](#ch-04)), go through the enemy defenders one by one and make a duty list for the important ones. Pay special attention to:

- the piece guarding the back rank;
- the piece guarding the square in front of the castled king (h7, g7, h2, g2);
- any piece that defends two other pieces;
- any piece guarding a square where you have a fork.

**When you are defending.** Do the same for your own pieces. Ask "Is any of my pieces overloaded? Is my back rank guarded by one piece that is also doing something else?" Making luft with h3 or g3 at a quiet moment removes a duty from your rooks forever.

**When you analyse your games.** Whenever you lose material to a tactic, ask which of your pieces was overloaded or deflected. Record it in your mistake journal under "missed-tactic" or "hanging-piece" and note the defender that failed. After a few games you will see the same patterns repeating, usually the back rank and the overloaded queen.

:::nextgame The "two jobs" scan
In every game this week, at least once per phase (opening, middlegame, endgame), stop and name the duties of your opponent's most important defender. If it has two jobs, spend a minute looking for a forcing move that makes it choose.
:::

## Practice at the board

Set up each position on a board or in any free analysis app. Try to solve it without moving the pieces, then play out your answer against the engine (or a friend) to check it.

1. **Overloaded rook.** `r1br2k1/pp3ppp/1q6/3n4/2B5/5NQ1/PPP2PPP/R3R1K1 w - - 0 18`. Name the two duties of the rook on d8, then win a piece. Check: Black must not be able to recapture without allowing mate.
2. **Chasing the defender.** `r4rk1/pbq1bppp/1pp1pn2/8/3PP3/2PQ1N2/PPB2PPP/R1B1R1K1 w - - 0 12`. Find the pawn move. Then try every knight move for Black and prove each one loses to Qxh7#.
3. **Deflecting a blockader.** `3r4/p2P1pkp/1p4p1/1B6/4b3/8/P4PPP/2R3K1 w - - 0 30`. Find the rook move that wins. Play through all three Black replies: take, run, or capture the pawn.
4. **Remove the guard of the fork.** `r1b1k2r/ppp2ppp/2nbqn2/1N6/5B2/5N2/PPP1BPPP/R2Q1RK1 w kq - 0 9`. Play the worked example from the Black side against a friend or engine and try every defence. Does any of them hold?
5. **Your own games.** Take your last three losses. For each tactic you suffered, mark the defender that failed and write its two duties next to the move.

:::drill Duty cards
Take any middlegame position from your games. For each piece on both sides, write one short line: "Nf6: guards h7 and d5." Pieces with two important lines are your tactical targets — or your weaknesses.
:::

## Chapter summary

- Every defender has duties: guarding pieces, guarding squares, blocking lines. Its duty can matter more than its point value.
- Removing the defender means capturing, chasing or blocking the piece that guards your real target.
- An overloaded piece has two duties it cannot fulfil at once. Force it to perform one, then exploit the other.
- Deflection drags a defender away from its post with a forcing move; a decoy lures a piece onto a square where a fork, skewer or mate works.
- Trapped pieces are won by covering every escape square first, then attacking with the cheapest piece.
- These ideas are usually the preparing move; the payoff is a fork, pin, discovered attack or mate from Chapters 7–9 and 11.
- Work backwards: find the tactic you wish you had, then ask what stops it.

:::cheat The duty-list procedure
1. After checks, captures and threats, pick the enemy pieces that defend something important.
2. For each, list its duties: which pieces and which squares it guards.
3. Mark any piece that is the *only* defender of something valuable, and any piece with *two* duties.
4. Find a forcing move (capture, check, threat) that removes, chases, blocks, deflects or overloads that piece.
5. Calculate the opponent's best reply, then blunder-check before you play.
:::

@exercises
