---
chapter: 23
slug: rook-endgames
title: Rook Endgames
subtitle: The endings you will actually reach
part: 4
stage: "1000–1200"
skills: [rook-endgame, endgame-technique, passed-pawn, defense]
objectives:
  - Keep your rook active and put it behind passed pawns, yours and your opponent's.
  - Cut off the defending king by a file or rank before you push the pawn.
  - Win the Lucena position by building a bridge.
  - Draw the Philidor position with third-rank defence and checks from behind.
  - Defend from the long side and count tempi in rook-against-pawn races.
next_game: When a rook endgame appears, ask first "Which rook is more active?" and "Can I cut off the enemy king?" before you push a single pawn.
---

You have traded queens, then minor pieces, and now each side has a rook and a handful of pawns. Maybe you are a pawn up and expect to win. Maybe you are a pawn down and expect to lose. At club level both expectations are often wrong, because rook endgames reward a few specific techniques much more than they reward material.

Rook endgames are widely regarded as the most common type of endgame, because rooks are usually the last pieces to be traded. The good news is that a small amount of knowledge goes a long way: two famous positions, a handful of rules of thumb and the habit of keeping your rook busy will save you many half-points and win you many more. This chapter gives you exactly that toolkit.

## Why rook endgames are different

In a king-and-pawn ending ([Chapter 18](#ch-18)) a single tempo decides everything. In a rook ending the rook is a long-range piece that can check from far away, attack pawns from behind and cut the enemy king off from the action. That makes rook endings more forgiving for the defender and more technical for the attacker.

Three questions guide almost every decision:

1. **Which rook is more active?** An **active rook** attacks pawns, gives checks, or cuts off the enemy king. A **passive rook** is stuck defending a pawn or blocking a passed pawn from in front.
2. **Where are the kings?** A king that is cut off from the passed pawn cannot help to stop it.
3. **Where are the passed pawns, and where are the rooks relative to them?**

:::key The activity rule
In rook endgames, activity is usually worth more than a pawn. A coaching rule that serves club players well: if you must choose between keeping a pawn with a passive rook and giving up the pawn to activate the rook, look very hard at the active option first.
:::

## Active rook, passive rook

Look at the position below. Material is level, but the rooks are doing very different jobs.

```board
fen: r5k1/pR3ppp/8/8/8/6P1/P4PKP/8 w - - 0 1
caption: Material is equal, but White's rook on the seventh rank attacks a7 and cramps Black's king, while Black's rook on a8 is tied to the defence of the a-pawn.
arrows: b7a7 b7f7
red: a8a7
squares: b7 a8
```

White's rook sits on the **seventh rank** (the second rank from Black's point of view), where it attacks pawns that cannot easily be defended by other pawns and keeps the black king on the back rank. Black's rook can only stand guard on a8. The engine rates this position as only slightly better for White, so it is not a win, but it is clear who is playing for two results. If Black lets the passivity become permanent, the slight edge grows.

What commonly goes wrong: the defender clings to every pawn. You put your rook behind your weak pawn "to keep material," and your opponent's rook and king then do whatever they want. In your own games, look for moments where your rook spent many moves guarding one pawn. That is a sign you chose passivity.

### Rooks belong behind passed pawns

The most famous rook-endgame guideline is usually credited to the German master and teacher Siegbert Tarrasch: **rooks belong behind passed pawns** — both your own and your opponent's.

```board
fen: r7/5pk1/6p1/P6p/7P/6P1/5PK1/R7 w - - 0 1
caption: White's rook on a1 is behind the a-pawn; Black's rook on a8 is in front of it. Every step the pawn takes gives White's rook more room and Black's rook less.
arrows: a1a5 a5a6
red: a8a6
squares: a1 a8
```

Why does it work? A rook behind its own passed pawn supports the pawn on every square of its journey and gains scope as the pawn advances. A rook in front of an enemy passed pawn is a blocker that loses scope as the pawn advances: with the pawn on a7, Black's rook is chained to the a-file in front of it, and every move it makes must watch for tricks. In the diagram the engine evaluates White as clearly winning: White's king walks to the kingside and eats pawns, because Black's rook and king are both busy with the a-pawn.

The same idea works in defence. If your opponent has a passed pawn, try to get your rook behind it, not in front of it. Exercise 23-07 shows a pawn-down position that is saved precisely by this.

:::mistake Blocking a passed pawn with your rook from the front
It feels safe to stand in front of the pawn. It is usually the most passive square on the board. An exception: when the pawn is a rook pawn on the seventh rank and your king sits on g7 or h7, the rook in front is part of a known drawing set-up. Even then you must watch for the skewer trick in Exercise 23-01.
:::

## Cutting off the king

Before you push your passed pawn, ask whether you can **cut off** the enemy king: place your rook on a file (or rank) that the king cannot cross. A king that cannot reach the pawn cannot stop it, and the defending rook alone usually cannot hold.

```board
fen: r7/8/6k1/8/3P4/3K4/8/4R3 w - - 0 1
caption: White's rook on the e-file cuts the black king off by two files. The white king will escort the d-pawn, and the engine rates this as a clear win.
arrows: e1e8
squares: e4 e5 e6 e7 e8
```

The wall on the e-file means the black king cannot reach d7 or d8. White's king will walk forward with the pawn, using the pawn and the rook as shields from checks. When the king is cut off by only one file, the defender has more chances: the king can attack the pawn from the side, and the defending rook may find enough checks. Then the exact position of every piece matters.

:::coach How many files?
Coaching judgment, not a law: with the defender's king cut off by **two or more files**, the attacker usually wins with a centre or knight pawn. With a **one-file** cut-off, the result depends on how far the pawn has advanced and where the rooks are, so you need to calculate. Either way, cutting off first and pushing second is almost always the right order.
:::

How to execute it: find the file between the enemy king and your pawn, and put your rook there, ideally from a distance so the king cannot attack it. Then bring your own king forward in front of the pawn. Push the pawn only when the king has prepared its path.

What commonly goes wrong: you push the pawn first because it feels like progress, and the enemy king walks across in front of it. Exercises 23-03 and 23-10 punish exactly that.

## The Lucena position: building a bridge

Sooner or later a successful cut-off leads to the most important winning position in rook endings. It is traditionally named after the fifteenth-century Spanish author Luis Ramírez de Lucena, although chess historians doubt that he actually published it. The name has stuck regardless of who found it first.

In the **Lucena position** the attacker's pawn is on the seventh rank, his king stands on the queening square in front of it, the defending king is cut off by at least one file, and the defending rook waits to give checks.

```board
fen: 1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1
caption: The Lucena position. White's king is stuck in front of the pawn: if it steps out, Black checks from the side. The solution is to build a bridge.
arrows: c1d1 d1d4
red: a2a8
squares: b8 d4
```

White's problem is simple: the king cannot get out. The black king covers c7 and c8, and the black rook controls the a-file. Even if the king could step out, the rook would check it from the side. White's solution has two steps:

1. **Drive the enemy king one more file away** with a check: Rd1+.
2. **Build a bridge**: put the rook on the fourth rank, so that it can later block the rook's checks.

```line
fen: 1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1
moves: 1.Rd1+ Ke7 2.Rd4
check: engine
diagram: end
caption: Step one and step two: the check pushes the black king to the e-file, and the rook goes to the fourth rank, ready to become the bridge.
```

Now the king walks out. The line below shows the natural defence, with Black checking for as long as possible. (The engine actually prefers to give up the rook for the pawn at some point, because the checks lead to mate faster; the bridge method is the same either way.)

```line
fen: 1K6/1P2k3/8/8/3R4/8/r7/8 b - - 3 2
moves: 2...Ra1 3.Kc7 Rc1+ 4.Kb6 Rb1+ 5.Kc6 Rc1+ 6.Kb5 Rb1+ 7.Rb4
diagram: end
caption: The bridge is complete. The rook on b4 blocks the last check, and the pawn will promote.
```

Walk through the logic. After 2.Rd4 White threatens to bring the king out. Black waits with 2...Ra1, and the king comes out with 3.Kc7. Black checks from the side and from behind, but each check drives the king down towards the rook on the fourth rank. After 7.Rb4 there are no more useful checks, and the pawn queens. Why the fourth rank? Because the king needs that many squares to step down the board before the rook can interpose without being captured.

:::key Lucena in one sentence
Check the defending king away, put your rook on the fourth rank, walk your king out, and use the rook as a shield.
:::

Practise this until you can do it without thinking. At the board you will reach the Lucena with little time on the clock, and knowing the method turns a nervous ending into a routine win.

## The Philidor position: third-rank defence

If the Lucena is the attacker's dream, the **Philidor position** is the defender's. It is named after the eighteenth-century French player and composer François-André Danican Philidor, who analysed it. The idea is simple enough to learn in five minutes and important enough to save you many games.

The defending king stands on the queening square, or next to it. The attacker's pawn has not yet reached the sixth rank. The defending rook stands on its **third rank** (the sixth rank for Black), stopping the attacking king from advancing.

```board
fen: 4k3/7R/1r6/3KP3/8/8/8/8 w - - 0 1
caption: The Philidor position. Black's rook on b6 stops the white king from reaching d6 or e6 (the pawn on e5 cannot shield it yet). If the pawn advances, the rook drops back and checks from behind.
arrows: b6f6
squares: d6 e6 e8
```

The defence has two stages:

* **Stage 1.** Keep the rook on the sixth rank (Black's third rank). The white king cannot advance because the rook covers the sixth. White's only way to make progress is to push the pawn to e6.
* **Stage 2.** The moment the pawn reaches e6, the king could hide in front of it, but the pawn has also taken away its own shelter. Now the rook goes to the far end of the board, to the first rank, and checks from behind. The white king has nowhere to hide.

```line
fen: 4k3/7R/1r6/3KP3/8/8/8/8 w - - 0 1
moves: 1.e6 Rb1 2.Kd6 Rd1+ 3.Ke5 Re1+ 4.Kd6 Rd1+
check: engine
diagram: end
caption: The checks from behind never end. If the king runs to the rook, it leaves the pawn behind.
```

:::mistake Waiting on the back rank
The most common club-level loss in this ending is the passive rook on the back rank. If the white king is allowed to reach the sixth rank, the defence hangs by a thread: with White's king on d6, pawn on e5, rook on h7, and Black's rook on b8 and king on e8 (Black to move), only ...Rb6+ saves the game; every other move loses. Do not live that close to the edge. Third rank first; checks from behind when the pawn moves.
:::

What if your king is not on the queening square at all? Then step one is to get it there. Exercise 23-04 shows that a king that is not yet on the queening square can still save the game, provided it heads there at once and your rook does not try to do the king's job.

## Checking distance and the short side

Sometimes the defending king cannot stay in front of the pawn, and the defence relies on side checks. Side checks only work if the rook is far enough away. If the rook checks from too close, the attacking king walks up to it and the checks stop.

That leads to the idea of the **short side** and the **long side**. A pawn divides the board into two sides. For an e-pawn, the f-, g- and h-files are the short side (three files), and the a- to d-files are the long side (four files).

:::key The short-side rule
When you are defending and your king is pushed off the queening square, move the king to the **short side** and keep your rook on the **long side**. The rook then has room to check from at least three files away, which is usually enough to keep the attacking king from approaching.
:::

```board
fen: 5k2/7R/3KP3/8/8/8/8/r7 b - - 0 1
caption: Black to move. The king is on the short side (f8), the rook on the long side (a-file). Ra6+ starts checking from three files away, and the engine confirms the draw.
arrows: a1a6
red: e6e7
squares: f8 a6
orientation: black
```

Here White threatens e7+. Black's king is on the short side, so the rook can check from the long side: 1...Ra6+ and the king has no good way to approach. Checking from behind with 1...Rd1+ also holds here. Exercise 23-06 shows the same idea with the pawn on the other side of the board. If the roles were reversed, with the king on the long side and the rook squeezed onto the short side, the checks would often come from too close.

What commonly goes wrong: defenders send the king towards the "big" side because there seems to be more room there, and then the rook has nowhere to check from. Flip the instinct: king short, rook long.

## Rook against pawn: count the race

When the defender gives up the rook for the last pawn, or the attacker has to give up the rook for a dangerous pawn, you reach **rook against pawn**. The rook is worth far more than a pawn, but a far-advanced pawn supported by its king can force a draw. The outcome depends on counting.

```board
fen: 8/8/8/7K/4k3/4p3/8/2R5 w - - 0 1
caption: White to move. The rook alone cannot win the pawn; the white king must arrive in time. Only Kg4, heading for f2, wins.
arrows: h5g4 g4g3
red: e3e2
squares: f2 e1
```

Ask three questions:

1. **How many moves does the pawn need to promote?**
2. **How many moves does my king need to reach the pawn (or the square in front of it)?**
3. **Can my rook cut the enemy king off from the pawn**, along a rank or a file, to win time?

In the diagram the pawn needs two moves to queen, and the rook already controls e1 from c1. White's king needs to reach f2 or d2 in time to help the rook. Only 1.Kg4! does it. After 1...e2 2.Kg3 the king reaches f2 next. Any rook move wastes the tempo: after ...e2 and ...Kf3 the black king supports the pawn, and the rook must give itself up.

There are a few tricks worth knowing too. A rook can stop a pawn on the seventh by attacking it from in front while also covering the squares the defending king needs (Exercise 23-08). Sometimes the defending side can under-promote to a knight with check to avoid a skewer. And often the defender's king should stay *beside* or *in front of* its pawn, not behind it, so that the attacking king cannot cut it off.

:::drill Count before you move
Set up the diagram above. Before touching a piece, write down how many moves the pawn needs and how many your king needs. Then play Kg4 against an engine at full strength and check that you can win the pawn. Repeat with the white king on h6: now it is one step too slow, and the engine shows a draw. One tempo is the whole difference.
:::

## A worked example: thinking through a rook ending

Here is a full thinking process for a typical situation. Look at this position with White to move.

```board
fen: 8/k7/8/3P4/4K3/8/r7/2R5 w - - 0 1
caption: White to move. The pawn is on d5; the black king is far away on a7. What is the plan?
arrows: c1b1
blue: d5d6
squares: b7 c8
```

**Step 1: Material and pawns.** White has a rook and a passed d-pawn; Black has only a rook. A win is possible but not automatic: rook and pawn against rook is often a draw.

**Step 2: The kings.** White's king is right next to the pawn. Black's king is on a7, three files from the d-file. Can it get back? It wants b7, c7 or c8, and then d8.

**Step 3: Candidate moves.** The tempting move is 1.d6, because pushing passed pawns feels like progress. The other candidates are king moves such as 1.Ke5 and the rook move 1.Rb1, which puts a wall on the b-file.

**Step 4: The opponent's best reply.** After 1.d6 Kb7, Black's king heads for c8 and d8, or Black's rook starts checking, and the engine confirms that White has nothing. After 1.Rb1, the black king cannot cross the b-file at all. Black can check with the rook, but White's king will walk up the board with the pawn, and the black rook alone cannot stop both.

**Step 5: Decide.** 1.Rb1 wins; 1.d6 lets the win slip away.

```line
fen: 8/k7/8/3P4/4K3/8/r7/2R5 w - - 0 1
moves: 1.Rb1 Rh2 2.Ke5 Rh5+ 3.Ke6 Rh6+ 4.Kd7 Rh7+ 5.Kc6
check: engine
caption: After the cut-off the white king advances with the pawn. Once the king reaches c6 or c7, the checks run out and the pawn marches.
```

The same thinking applies in almost every rook ending: material, kings, candidate moves including the boring rook move that cuts off the king, the opponent's best reply, decision.

## "All rook endings are drawn"

There is an old chess saying that all rook endings are drawn. It is half joke and half truth. The truth: a rook ending with an extra pawn is often a draw, especially when all the pawns are on one side of the board, or when the defender's rook is active. The joke: it is not literally true, and believing it makes you give up too easily as the attacker or relax too early as the defender.

:::coach What the saying should mean for you
Coaching judgment: when you are a pawn down in a rook ending, do not resign in your head. Activate your rook, get it behind passed pawns, keep your king near the pawns that matter, and you will save many positions. When you are a pawn up, do not assume the win: you need the cut-off, the Lucena method and patience. The side that knows more technique wins most of the "drawn" rook endings at club level.
:::

How to identify this in your own games: after each game that reached a rook ending, ask three questions. Was my rook active or passive? Did I cut off the king before pushing? Did I know whether the critical position was a Lucena or a Philidor? Record any "no" in your mistake journal under *endgame*.

## Practice at the board

Rook endgames are learned with your hands. Use a physical board or any free chess app with an engine "play from position" feature.

1. **Lucena drill.** Set up `1K6/1P1k4/8/8/8/8/r7/2R5 w - - 0 1`. Play White against the engine at full strength. Win five times in a row, including after you vary the first move (for example, put the white rook on h1 and the black rook on h2). Your goal is to build the bridge without thinking.
2. **Philidor drill.** Set up `4k3/7R/1r6/3KP3/8/8/8/8 b - - 0 1` and play Black. Keep the rook on the sixth rank until the pawn moves, then go to the first rank and check from behind. Then set up `1r2k3/7R/3K4/4P3/8/8/8/8 b - - 0 1`, where the white king has already reached d6, and find the only saving move (the mistake box above gives it away, so first try without looking).
3. **Short-side drill.** Set up `5k2/7R/3KP3/8/8/8/8/r7 b - - 0 1`. Hold the draw as Black against the engine. Then swap sides and try to beat the engine's defence: watch how it keeps its king on the short side.
4. **Cut-off drill.** From `r7/8/6k1/8/3P4/3K4/8/4R3 w - - 0 1`, win as White. Then move the black king to f5, only one file away: the engine still finds a win, but only with precise play. Find the first move yourself, then check.
5. **Check yourself.** After each attempt, ask the engine where the evaluation changed. If you lost the thread, find the move and write down the rule you broke.

## Chapter summary

* Rook endgames are the most common endgames, and technique matters more than a single pawn.
* Activity first: an active rook usually outweighs a pawn; a rook stuck defending a pawn or blocking from the front is passive.
* Rooks belong behind passed pawns — yours and your opponent's.
* Cut the enemy king off by a file or rank before you push the pawn; two files usually wins, one file needs calculation.
* Lucena: check the king away, put your rook on the fourth rank, walk the king out, block the last check.
* Philidor: king on the queening square, rook on the third rank; once the pawn advances, check from behind.
* Defend with the king on the short side and the rook on the long side, checking from a distance.
* Rook against pawn is a race: count the pawn's moves, your king's moves and the cut-off possibilities.

:::cheat Rook endgame procedure
1. Compare the rooks: which is active, which is passive? Activate yours, even at the cost of a pawn.
2. Find the passed pawns and put your rook behind them (yours or theirs).
3. Attacking: cut off the enemy king by a file or rank before pushing; aim for the Lucena and build the bridge.
4. Defending: king in front of the pawn, rook on the third rank (Philidor); when the pawn advances, check from behind.
5. If your king is pushed aside, go to the short side and check from the long side.
6. In rook-against-pawn races, count tempi for the pawn and both kings before you move.
:::

@exercises
