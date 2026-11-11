---
chapter: 5
slug: basic-mates
title: The Basic Checkmates
subtitle: Finishing the game when you are far ahead
part: 1
stage: "400–600"
skills: [basic-mates, stalemate, opposition]
objectives:
  - Checkmate with king and queen against king, using the box and knight's-distance method, without stalemating.
  - Checkmate with king and rook against king by shrinking the box, using opposition and waiting moves.
  - Mate with two rooks (or rook and queen) using the ladder, keeping the pieces out of the king's reach.
  - Recognize and avoid the three classic errors - stalemate, endless checks, and forgetting your own king.
next_game: When you reach a won ending with a queen or rook against a lone king, do not check; first build a box, bring your king, and before every move near the edge ask "Is it check, and if not, does my opponent still have a legal move?"
---

You have played well, won your opponent's pieces one by one, and now you have a queen and king against a lone king. Your opponent refuses to resign. Thirty moves later the game is a draw: either you stalemated them, or you ran out of time chasing their king around the board with checks.

This happens constantly at the 400 to 800 level, and every lost half-point hurts. The good news is that the basic checkmates are pure technique. There is no guesswork, just a method you can learn in an evening and use for the rest of your life. This chapter teaches the three mates you must know cold: queen, rook, and two rooks (or rook and queen). Master them on a board until you can do them without thinking.

## Why technique beats talent here

When the opponent has only a king, there are no tactics to find and nothing to calculate deeply. The only question is whether you know the procedure. Players who do not know it try to mate by giving checks, because checks feel forcing. But a lone king can almost always step out of a check, and endless checks just push it around the board.

The method is the opposite: **restrict first, check last**. You build a cage around the enemy king, shrink it step by step, bring your own king close, and only then give the final check. Every mate in this chapter follows that pattern.

:::key Three rules for every basic mate
1. Restrict the king; do not chase it.
2. Your king must help. A queen or rook alone cannot mate a king in the middle of the board.
3. Near the edge, before every move ask: is it check? If not, does my opponent still have a legal move?
:::

## King and queen against king

The queen is so powerful that this mate is fast once you know the method: with best play it never takes more than ten moves from any position. The danger is not failing to mate; it is stalemate.

### Step 1: build the box

The queen controls a whole file and a whole rank at once, plus diagonals. Placed correctly, it cuts the board in two and keeps the enemy king inside a rectangle. That rectangle is called the **box**.

```board
fen: 8/8/8/3k4/8/2Q5/8/K7 b - - 0 1
caption: The queen on c3 keeps the king off the c-file and the third rank. The king is boxed into the area from d4 to h8, and the box will shrink.
squares: c3
arrows: c3c8 c3h3
```

### Step 2: shrink the box at a knight's distance

The simplest way to shrink the box is the **knight's-distance method**: after each king move, put your queen a knight's move away from the enemy king. From there the queen covers the squares around the king without standing next to it, and the king is pushed toward the edge. As soon as the king is on the edge and boxed into two files or two ranks, stop moving the queen and bring your king.

```line
fen: 8/8/8/3k4/8/2Q5/8/K7 b - - 0 1
moves: 1...Ke4 2.Qf6 Kd5 3.Qe7 Kd4 4.Qe6 Kc5 5.Qd7 Kc4 6.Qd6 Kc3 7.Qd5 Kb4 8.Kb2 Ka4 9.Kc3 Ka3 10.Qa8#
check: engine
diagram: end
caption: The queen follows the king at a knight's distance until it is trapped on the a- and b-files; then White's king walks up and the queen mates.
```

Notice what White did *not* do: no checks until the last move. Each queen move took squares away. When the king reached the a- and b-files, the queen stayed on d5, guarding the fifth rank and the c-file, and White's king came to c3 to cover b2, b3 and b4.

### Step 3: the final patterns

There are two common mating patterns with king and queen. In the first, the queen stands directly in front of the enemy king, protected by your king. In the second, the queen checks along the edge while your king covers the escape squares from in front.

```board
fen: 1k6/1Q6/1K6/8/8/8/8/8 b - - 0 1
caption: The "kiss": the queen on b7 checks and covers every square around the king, and White's king protects her. This is checkmate.
squares: b7
```

For the edge pattern, picture the black king on b8 and your king on b6: a queen check from anywhere on the eighth rank (for example Qd8 or Qe8) is mate, because your king covers a7, b7 and c7.

### The stalemate trap

Stalemate happens most often at the moment you think the game is over. The enemy king is in the corner, your queen takes away its last squares, and you have forgotten to give check.

```board
fen: 8/8/8/4K3/8/8/3Q4/k7 w - - 0 1
caption: The black king is trapped on a1 and b1. 1.Qc2?? or 1.Qb3?? takes away every square without giving check: stalemate. The win requires the king.
red: d2c2
squares: a1 b1
```

The cure is a rule: once the king is on the edge and boxed in, **your queen stops moving** until your king has arrived. A queen that keeps "improving" near a cornered king is a stalemate waiting to happen.

## Worked example: the corner

Let us think through the position in the last diagram move by move, the way you should at the board.

**First I ask where the black king can go.** It is on a1. The queen on d2 controls the whole second rank, so a2 and b2 are covered. The only free square is b1. On b1, the king could go back to a1, or to c1, but the queen covers c1 diagonally. So the king is stuck shuttling between a1 and b1. The box is as small as it gets.

**Next I ask what the queen must not do.** Any queen move that takes away b1 without giving check is stalemate. Qc2 covers b1 and a2; Qb3 covers a2, b1 and b2. Both leave Black with no legal move. So the queen stays where it is.

**Now I bring the king.** My king goes toward c3, where it will protect the queen on b2: 1.Kd4 Kb1 2.Kc3 Ka1. Before each king move I check that Black still has a move. After 1.Kd4 Black has b1. After 2.Kc3, Black's king on b1 has only a1 (c2, b2 and a2 are covered, and c1 is covered by the queen), so it is not stalemate.

**Finally I look for checks that mate.** With the king on a1 and my king on c3, 3.Qb2# is the kiss mate: the queen on b2 is protected by the king and covers a1's neighbours. I also check: 3.Qd1+ Ka2 would let the king out, so b2 is the right square.

```line
fen: 8/8/8/4K3/8/8/3Q4/k7 w - - 0 1
moves: 1.Kd4 Kb1 2.Kc3 Ka1 3.Qb2#
check: engine
caption: Queen stays still, king comes, then mate. Three moves, no risk.
```

## King and rook against king

The rook mate takes longer, up to 16 moves with perfect play and usually more in practice, but the method is just as reliable. The rook controls only a file and a rank, so your king is needed much earlier, and the key idea is **opposition**.

### The box and the cut-off

The rook cuts the enemy king off along a file or rank. In the next diagram the rook on a6 keeps the black king on the seventh and eighth ranks. That is the box. Your job is to make it smaller, one rank at a time, until the king is on the edge.

```board
fen: 8/2k5/R7/3K4/8/8/8/8 w - - 0 1
caption: The rook on a6 cuts the black king off on the seventh and eighth ranks. White's king will now try to stand directly opposite the black king.
arrows: a6h6
squares: c7
```

### Opposition: when to check

Two kings stand in **opposition** when they are on the same file (or rank) with exactly one square between them. When the kings are in opposition and the rook gives check along the rank behind the enemy king, the king cannot step forward (your king covers those squares) and must go back one rank. That is how the box shrinks.

If the enemy king refuses to stand opposite yours, you follow it sideways with your king. If following would only repeat, you make a **waiting move** with the rook: a rook move along its rank, far from the enemy king, that keeps the box exactly as it is and passes the move to your opponent. Then the king has to step into opposition or toward the corner.

```line
fen: 8/2k5/R7/3K4/8/8/8/8 w - - 0 1
moves: 1.Kc5 Kb7 2.Rh6 Kc7 3.Rh7+ Kd8 4.Kd6 Ke8 5.Ke6 Kf8 6.Kf6 Kg8 7.Rb7 Kh8 8.Kg6 Kg8 9.Rb8#
check: engine
diagram: end
caption: The rook checks only when the kings face each other (move 3 and the final mate). In between, White's king follows and the rook steps away when attacked.
```

Look at moves 1 to 3. After 1.Kc5 the kings face each other, so Black moves away with 1...Kb7, attacking the rook. The rook simply goes to the other end of its rank, 2.Rh6, where the king can never reach it. When the king returns to c7, the kings are in opposition again and 3.Rh7+ pushes it to the eighth rank.

### The waiting move near the corner

```board
fen: 6k1/7R/5K2/8/8/8/8/8 w - - 0 7
caption: Black's king on g8 attacks the rook on h7. 7.Rb7 saves the rook and keeps the box: Black can only go to h8 or f8, and either way the mate comes soon.
red: g8h7
arrows: h7b7
```

This position from the line is worth a closer look. If Black now plays 7...Kf8, the kings are in opposition and 8.Rb8# follows. After 7...Kh8, White's king steps to g6, leaving Black only g8, and the rook mates on the back rank.

:::mistake Checking from too close
A rook check with the rook next to the enemy king, and no protection, just loses the rook. Keep the rook far away from the enemy king, at the other end of its rank or file. It works just as well from there.
:::

## Two rooks, or rook and queen: the ladder

With two heavy pieces you do not need your king at all. The **ladder** (also called the lawnmower) uses the two pieces on neighbouring ranks or files. One guards a rank, the other gives check on the next rank, and they leapfrog each other until the king is on the edge.

```board
fen: 8/8/8/8/8/6k1/1R6/R6K w - - 0 1
caption: Two rooks start the ladder. The rook on b2 guards the second rank; the a1-rook will check on the third, and so on up the board.
arrows: a1a3 b2b4
```

```line
fen: 8/8/8/8/8/6k1/1R6/R6K w - - 0 1
moves: 1.Ra3+ Kf4 2.Rb4+ Ke5 3.Ra5+ Kd6 4.Rb6+ Kc7 5.Rh6 Kb7 6.Rg5 Kc7 7.Rg7+ Kd8 8.Rh8#
check: engine
diagram: end
caption: When the king walks toward the rooks (moves 4 and 5), switch them to the far side of the board, then continue the ladder.
```

The only skill is the switch. The black king walked toward the rooks to attack them. Instead of checking into its arms, White moved each rook to the far side (5.Rh6 and 6.Rg5) and then carried on. The same method works with a queen and a rook, or with two queens after a promotion.

## Other mates: two bishops, bishop and knight

King with two bishops against a king is also a forced win, and king, bishop and knight against a king is a forced win too, though it can take more than 30 moves and needs a special technique. Both are much rarer in real games than the three mates above. They are worth learning eventually, but not now. Two knights cannot force mate against a lone king, and a single minor piece cannot mate at all.

:::coach What to study when
Coaching judgment: queen, rook and two-rook mates come up in real games every month at this level. The two-bishop mate is a good exercise later in Stage 2 or 3. Learn the bishop-and-knight mate only when you are above about 1500 and want a challenge; it appears so rarely that the time is better spent on tactics and rook endgames.
:::

## The three classic errors

### Error 1: stalemate

You have seen it twice already. It happens in queen endings far more than in rook endings, because the queen covers so many squares. The defence is the question in the key box: before every move near a cornered king, ask "Is it check? If not, does my opponent have a legal move?" Also remember that blocked pawns do not help: if your opponent has a pawn that cannot move, it does not count as a legal move.

### Error 2: chasing with checks

Checks feel active, but against a lone king they usually let it out of the box. A check is useful only when it pushes the king back (as with the rook in opposition) or mates. If you have given three checks in a row and the king is still in the middle, stop and build a box.

### Error 3: forgetting the king

Neither the queen nor the rook can mate a king on its own in the middle of the board, and even on the edge the queen needs help in most positions. Bring your king early. In the rook mate, the king is half the method. In the queen mate, the king is the final step, and the moment to bring it is when the enemy king is trapped on the edge.

:::mistake Running out of time
In a game with a clock, the basic mates must be fast. If your own time runs out while your opponent has only a king, the game is usually scored as a draw, because a lone king can never checkmate you. All your earlier good play is wasted. Practise until you can mate with king and queen in well under a minute and with king and rook in under two.
:::

## Practice at the board

Use a physical board or any analysis board, and play against yourself or a friend who defends as well as possible. An engine set to full strength makes the best defender.

1. Set up `8/8/8/3k4/8/2Q5/8/K7 b - - 0 1`. Play the queen mate with the knight's-distance method. Count your moves; aim for under 12. Then try again from `4k3/8/8/8/8/8/8/3QK3 w - - 0 1`.
2. Set up `8/8/8/4K3/8/8/3Q4/k7 w - - 0 1`. Find every queen move that stalemates. Then mate in three.
3. Set up `8/2k5/R7/3K4/8/8/8/8 w - - 0 1`. Mate with the rook. Say "opposition, check" or "follow" or "wait" out loud before each move.
4. Set up `4k3/8/8/8/8/8/8/R3K3 w - - 0 1` and mate with the rook from scratch. A defender who heads for the centre makes it take longer; aim for under 25 moves.
5. Set up `8/8/8/8/8/6k1/1R6/R6K w - - 0 1` and run the ladder. Then put the black king on d4 instead and see when you must switch the rooks.

Check yourself: if you ever stalemate or lose the rook, start the position again. Do each exercise until you can do it three times in a row without a mistake.

## Chapter summary

* Against a lone king, restrict first and check last.
* King and queen: box the king, follow it at a knight's distance to the edge, then freeze the queen and bring your king.
* The final queen patterns are the protected "kiss" and the edge check with your king in front.
* King and rook: cut the king off, bring your king, check when the kings stand in opposition, and use waiting moves with the rook from far away.
* Two rooks (or queen and rook) mate with the ladder; switch the pieces to the far side when the king approaches.
* Before every move near a cornered king: is it check, and if not, does my opponent have a legal move?
* Two bishops and bishop-and-knight mates exist but are rare; learn them later.

:::cheat Mating a lone king
1. Box: cut the king off with your queen or rook.
2. Shrink: queen at a knight's distance; rook with checks only when the kings face each other.
3. Bring your king. Wait with the rook (far away) when needed.
4. Before every move near the edge: is it check? Does the opponent have a legal move?
5. Mate with the protected queen, the edge check, or the ladder.
:::

@exercises
