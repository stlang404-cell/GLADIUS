---
chapter: 24
slug: advanced-tactics
title: Advanced Tactics and Calculation
subtitle: Chains of motifs, counter-shots and honest calculation
part: 5
stage: "1200–1500"
skills: [calculation, zwischenzug, desperado, x-ray, interference, clearance, quiet-move, defense, blunder-check]
objectives:
  - Find combinations that chain two motifs, such as a decoy that sets up a fork or a skewer.
  - Use and defend against in-between moves, desperado captures, x-rays, interference and clearance.
  - Spot quiet moves inside combinations and the opponent's best defensive resource.
  - Calculate a small tree of candidate moves, stop when the position is quiet, and evaluate the end honestly.
next_game: Before you play any forcing sequence, list your opponent's checks and captures at every step of it, including the last move, and evaluate the final position as if you were your opponent.
---

At 1200 you already see forks, pins and back-rank mates. Your opponents see them too, which is why the simple one-move shot rarely lands any more. The games you now win and lose are decided by two-step and three-step ideas: a sacrifice that drags a piece onto a forkable square, a check slipped into the middle of an exchange, a capture that looks forced but is not.

This chapter is about those longer ideas and about the calculation that makes them safe. You will learn the advanced motifs, but the real skill is the discipline behind them: at every branch, look for your opponent's best reply, including the annoying in-between check, and judge the final position as it really is, not as you hoped it would be.

## Combinations are chains of motifs

A **combination** is a forcing sequence, usually with a sacrifice, that uses two or more tactical motifs one after the other. The first motif rarely wins anything on its own. Its job is to prepare the second one: to put a piece on the right square, to remove a defender, or to open a line.

The two most common chains are:

* **Deflection or decoy, then fork.** A **deflection** drags a defender away from its job; a **decoy** lures a piece onto a particular square. Once the piece stands where you want it, a knight or queen forks it.
* **Decoy, then skewer.** You force the king onto a line, then attack it with a long-range piece so that, when it steps aside, you capture what stood behind it.

The way to find chains is to work backwards. First you notice a *target pattern*: "if their queen stood on d7, my knight could fork it from f6", or "if their king stood on the seventh rank, my rook would skewer it". Then you ask the second question: "Which forcing move puts it there?"

```board
fen: R7/P4k2/8/8/8/5K2/r7/8 w - - 0 50
caption: White to move. The rook on a8 is stuck in front of the pawn, but Rh8! threatens a8=Q. If Black takes the pawn, the rook on a7 and the king on the seventh rank are lined up.
arrows: a8h8
blue: h8h7
squares: a7 f7
```

This is a classic rook-ending trick and a perfect small chain. White plays 50.Rh8!, threatening 51.a8=Q. If Black grabs the pawn, the king and rook stand on the same rank and White skewers them:

```line
fen: R7/P4k2/8/8/8/5K2/r7/8 w - - 0 50
moves: 50.Rh8 Rxa7? 51.Rh7+
check: engine
caption: The rook check on h7 drives the king off the seventh rank and the rook on a7 falls.
```

Notice the geometry: the trick works because Black's king is on f7. With the king on g7 or h7, Black answers Rh8 with ...Rxa7, because the check on h7 can simply be met by capturing the rook. Recognizing which square makes the chain work is half of the skill.

:::key Work backwards
Look for the pattern first (fork square, skewer line, mating square), then search for the check, capture or threat that forces an enemy piece into that pattern. Most combinations are found in that order, not by trying sacrifices at random.
:::

## The in-between move, in depth

A **zwischenzug** (German for "in-between move") is a move inserted into a sequence that both players expected to go a certain way. Usually it is a check or a threat that must be answered, played *instead of* the "obvious" recapture. When the opponent answers it, the position has changed in your favour, and only then do you recapture.

You met the idea in earlier chapters. At this level you need to use it in two directions: to win material yourself, and to see it coming when you are the one who just captured.

The most instructive example is an old trap in the Albin Countergambit. White grabs material with a capture that looks completely forced, and Black answers with a zwischenzug that comes with check:

```line
fen: startpos
moves: 1.d4 d5 2.c4 e5 3.dxe5 d4 4.e3?! Bb4+ 5.Bd2 dxe3 6.Bxb4?? exf2+ 7.Ke2 fxg1=N+! 8.Ke1 Qh4+
check: engine
caption: Black never recaptured on b4. The check on f2 and the knight promotion with check leave White's king exposed and Black winning.
```

```board
fen: rnbqk1nr/ppp2ppp/8/4P3/1BP5/4p3/PP3PPP/RN1QKBNR b KQkq - 0 6
caption: Black to move after 6.Bxb4??. White expects ...exf2+ to be met by a quiet king move. The real point is that the pawn checks, captures and then promotes, always with tempo.
arrows: e3f2 f2g1
squares: e1 d1
```

Look at what White missed. After 6.Bxb4 White counted: "I took a bishop, Black's pawn on e3 is attacked; I am a piece up." White did not ask the most important question of this chapter: *what checks does my opponent have now?* The answer was ...exf2+, and after it the king can no longer defend the queen on d1 (7.Kxf2 Qxd1), or, after 7.Ke2, a new queen-or-knight appears on g1 with check.

### When to look for a zwischenzug

* **Every time you are about to recapture.** Before taking back, ask: do I have a check, a capture of something bigger, or a mate threat first?
* **Every time your calculation ends with your capture.** The opponent's move after your capture is part of the line. If it is a check, keep calculating.
* **Every time a line "forces" you.** "I must take back" is a feeling, not a rule. List the alternatives anyway.

:::mistake Stopping one move too early
Most missed zwischenzugs happen when a player calculates "I take, he takes, I take, and I am a piece up" and stops. Your opponent gets a move after your last capture too. If that move is a check or a capture, your line is not finished.
:::

## Desperado: sell a lost piece dearly

A **desperado** is a piece that is going to be lost anyway, so it captures something on its way out. Desperados appear when two pieces are attacked at once, or when both sides have pieces hanging in an exchange. The rule is simple: if a piece is doomed, use its last move to take as much as possible, ideally with check or with a new attack.

```board
fen: r1bq1rk1/pp2bppp/2p1p3/3n1n2/4P3/2N2N2/PPP1BPPP/R1BQ1RK1 b - - 0 10
caption: Black to move. White has just played e3-e4, forking both black knights. Retreating one knight loses the other; the doomed knight on d5 must take something first.
red: e4d5 e4f5
arrows: d5c3
```

Black's knight on d5 cannot be saved, so it becomes a desperado: 10...Nxc3! takes a whole knight. After the recapture the second knight on f5 has time to step away:

```line
fen: r1bq1rk1/pp2bppp/2p1p3/3n1n2/4P3/2N2N2/PPP1BPPP/R1BQ1RK1 b - - 0 10
moves: 10...Nxc3 11.bxc3 Nd6
check: engine
caption: Material is level again and Black's position is fine. Any knight retreat on move 10 would have lost a piece.
```

There is a second layer, and it shows how desperados interact with in-between moves. After 10...Nxc3 White might try the zwischenzug 11.Qxd8, trading queens before recapturing. But Black has a desperado of his own: the knight on c3 is still alive and takes with check.

```line
fen: r1bq1rk1/pp2bppp/2p1p3/3n1n2/4P3/2N2N2/PPP1BPPP/R1BQ1RK1 b - - 0 10
moves: 10...Nxc3 11.Qxd8? Nxe2+ 12.Kh1 Rxd8
check: engine
caption: The knight captures again with check before Black recaptures the queen. Black ends up a piece ahead.
```

:::coach Desperado thinking
In my experience, players at this level resolve hanging pieces in the order they notice them. Instead, list every piece that is attacked on both sides, then ask which capture gains the most, and whether it comes with check. The side that captures with tempo usually comes out ahead.
:::

## Lines through pieces: x-ray, interference and clearance

Long-range pieces act along lines. Three motifs are about what happens on those lines when other pieces stand in the way.

### X-ray

An **x-ray** is the power of a piece *through* another piece. A rook behind your queen on a file defends the squares in front of the queen, even though the queen blocks it. The same is true of a rook behind an enemy piece: it attacks the square behind it as soon as the front piece leaves or is captured.

```board
fen: 4r1k1/3q1ppp/p1p5/1p6/8/1P3N2/P3QPPP/4R1K1 w - - 0 24
caption: White to move. Black's rook on e8 is defended by the queen. White's rook on e1 stands behind the queen and x-rays e8 through it.
arrows: e2e8
blue: e1e8
squares: e8
```

```line
fen: 4r1k1/3q1ppp/p1p5/1p6/8/1P3N2/P3QPPP/4R1K1 w - - 0 24
moves: 24.Qxe8+ Qxe8 25.Rxe8#
check: engine
caption: The queen trade is only a means: the rook behind it recaptures with mate on the back rank.
```

When you count attackers and defenders, count x-rays too. A queen with a rook behind it on the same file counts as two attackers on that file.

### Interference

**Interference** means placing a piece on a line between an enemy piece and the square it guards. The defender is still on the board, but its line is cut. The classic case is a passed pawn on the seventh rank: the enemy rook guards the queening square from the side, and you drop a piece on the square between them. If the piece is captured, the pawn usually recaptures and promotes. You will find a clean example of this in the exercises.

To spot interference, look at the defender's line, not at the defender. Ask: "Which squares lie between this piece and the square it protects, and can I put something there with a threat?"

### Clearance

**Clearance** is the opposite: you move your own piece out of the way, usually with a threat or a sacrifice, so that another of your pieces can use the square or the line. A knight standing on a battery's diagonal, a bishop in front of your own rook, a pawn blocking your queen: all of these are candidates for a clearance move.

```board
fen: r4r1k/pb1nqppp/1p6/2p1N3/8/1PQ5/PBP2PPP/4RRK1 w - - 0 18
caption: White to move. The knight on e5 blocks two lines at once: the long diagonal from b2 and c3 to g7, and the e-file from e1 to Black's queen on e7.
arrows: e5g6
blue: c3g7 e1e7
squares: g7 e7
```

We will calculate this position properly in the worked example below. For now, notice the idea: if the knight leaves e5 *with check*, Black has no time to deal with both opened lines.

## Quiet moves inside combinations

A **quiet move** is a move that is not a check or a capture. Inside a combination, a quiet move is often the strongest move precisely because it is unexpected: your opponent is preparing to answer checks, and instead you make a threat that cannot be parried.

Typical quiet moves in combinations are:

* a queen move that creates two threats at once (a mate threat plus a discovered attack);
* a rook lift or king step that brings the last attacker in or takes away the opponent's only check;
* a retreat that keeps a pin or a bind instead of cashing in too early.

Quiet moves are easy to miss because our search naturally runs through checks, captures and threats in that order. The fix is simple: when the forcing moves do not quite work, ask "Is there a move that creates a threat my opponent cannot meet, even though it gives him a free move?" If the free move does not help him, you have found your quiet move.

:::key Checks, captures, threats, then quiet threats
Run the forcing-move scan as usual. When a promising attack seems to fall one move short, run it again looking for *quiet* moves that create two threats. A free move for your opponent is harmless if he has no useful way to spend it.
:::

## The opponent's counter-shot

Every combination has a weak point: your opponent also has moves. The defender's best resources are almost always forcing:

* an **in-between check** (the zwischenzug we met above);
* a **counter-attack** on something bigger than what you are attacking;
* a **desperado** capture by a piece you thought was trapped;
* a **perpetual check** when your king is exposed and you have spent material.

The habit to build is this: at every node of your calculation, before you look at your own next move, list your opponent's checks and captures. If one of them is dangerous, it is the move he will play, so it is the move you must calculate.

:::mistake Calculating your own moves only
A very common pattern in club games: the attacker calculates five of his own moves and two of his opponent's, and the two he chose are the most convenient ones. A strong player calculates the opponent's *most annoying* reply first. If your combination survives that reply, it probably survives the others too.
:::

When you are the defender, the same list is your rescue kit. Down material, with your opponent's king a little open? Look for checks before you look for defensive moves. Several exercises at the end of this chapter test exactly that.

## Calculating trees, not lines

So far we have spoken about lines. Real calculation is a **tree**: at each move there are a few sensible candidates, and each of them branches again. You cannot calculate every branch, so you need a method:

1. **At your move, choose two or three candidates** (forcing moves first).
2. **At your opponent's move, choose his most dangerous replies**, starting with checks and captures.
3. **Stop a branch when the position is quiet**: no checks, no captures that change the material balance, no immediate threats.
4. **Evaluate the quiet position** with material, king safety and activity.
5. **Compare the branches** and pick the move whose *worst* outcome is best for you.

### Worked example: thinking through a tree

Return to the clearance position. White's knight on e5 blocks both the long diagonal and the e-file.

```board
fen: r4r1k/pb1nqppp/1p6/2p1N3/8/1PQ5/PBP2PPP/4RRK1 w - - 0 18
caption: White to move. Candidate moves: Nxd7, Qg3 and Ng6+. Calculate each until the position is quiet.
arrows: e5g6 e5d7
blue: c3g3
```

**First I check the position.** Material is equal. Black's king on h8 is defended by the g7 pawn, which is attacked by my queen and bishop along the diagonal but shielded by my own knight. Black's queen on e7 is on the same file as my rook on e1, again behind my knight. Black's own threats: the knight on d7 attacks my knight on e5, and the queen also attacks it. So my knight is under fire; whatever I do, it should move with a purpose.

**Candidate moves.** The forcing moves are Nxd7 (capture), Ng6+ (check, also a sacrifice), Nxf7+ (check) and Qg3 (threat). Nxf7+ just loses the knight to ...Rxf7, so I keep three.

**Branch 1: 18.Nxd7.** The knight captures and uncovers my rook on the queen. Black must move the queen, for example 18...Qg5, and I am a piece up: Black cannot recapture on d7 and save the queen at the same time. Quiet position, plus a knight. Good, but let me look for more.

**Branch 2: 18.Ng6+.** Check, so Black's replies are few: ...hxg6, ...fxg6 and ...Kg8. I must look at each.

```line
fen: r4r1k/pb1nqppp/1p6/2p1N3/8/1PQ5/PBP2PPP/4RRK1 w - - 0 18
moves: 18.Ng6+ hxg6?? 19.Qxg7#
check: engine
caption: The diagonal is open and g7 falls with mate.
```

```line
fen: r4r1k/pb1nqppp/1p6/2p1N3/8/1PQ5/PBP2PPP/4RRK1 w - - 0 18
moves: 18.Ng6+ Kg8?? 19.Qxg7#
check: engine
caption: Same idea: the king cannot take on g7 because the bishop on b2 guards it.
```

```line
fen: r4r1k/pb1nqppp/1p6/2p1N3/8/1PQ5/PBP2PPP/4RRK1 w - - 0 18
moves: 18.Ng6+ fxg6 19.Rxe7
check: engine
caption: Black's best. With the f-pawn gone the queen guards g7 along the seventh rank, but the e-file has opened and the queen falls.
```

**Stop and evaluate.** After 18...fxg6 19.Rxe7 the position is quiet: no checks, no hanging pieces of note. I have given a knight for the queen, so I am about six points ahead. That is better than branch 1.

**Branch 3: 18.Qg3** threatens Qxg7#, but Black answers 18...Nxe5 19.Bxe5 f5, and although I am still clearly better, I have won less than in branch 2.

**Blunder-check before I move.** In branch 2, after 19.Rxe7, does Black have a counter-shot? Black's checks: none. Captures: ...Bxg2 is answered by Kxg2, and my rook on e7 is defended by nothing but attacked by nothing either. My back rank: Black's rooks are on a8 and f8, not on open files towards my king. The line holds. I play 18.Ng6+.

Notice how small the tree was: three candidates, three replies in the critical branch, and every branch ended in a quiet position that I could count. That is what good calculation at this level looks like.

## Evaluate the final position honestly

The last step of calculation is the one most often skipped. You reach the end of a line, you feel happy, and you play the first move. But the end of the line has to be judged as it is, from your opponent's side as well as your own.

```board
fen: r5k1/ppq2ppp/b7/5r2/4n3/1P2B3/PB3PPP/1Q1RR1K1 b - - 0 21
caption: Black to move. The sacrifice ...Qxh2+ Kxh2 Rh5+ Kg1 Rh1 looks like the famous rook mate. Check the last position honestly before you play it.
red: c7h2
blue: f5h5
squares: h1
```

In this position Black's pieces are all aimed at White's king and the sacrifice looks thematic. Play it through to the end:

```line
fen: r5k1/ppq2ppp/b7/5r2/4n3/1P2B3/PB3PPP/1Q1RR1K1 b - - 0 21
moves: 21...Qxh2+?? 22.Kxh2 Rh5+ 23.Kg1 Rh1+? 24.Kxh1
caption: The rook on h1 is not protected, so the king simply takes it. Black has given away queen and rook for a pawn.
```

The pattern Black remembered needs a piece guarding h1, such as a bishop on the long diagonal or a knight on g3 or f2. Here nothing guards h1. The mistake was not in the calculation of moves; it was in the *evaluation* of the final position. Black saw "rook check on h1" and stopped thinking.

:::key Three questions at the end of every line
1. Is it really over? (No checks or captures left for either side.)
2. What is the material count, honestly?
3. If I were my opponent, what would I play now?
:::

## Blunder-checking in complex positions

In quiet positions, a blunder-check is a quick look at checks, captures and threats. In sharp positions you need a slightly bigger routine, because many pieces are attacked at once:

* **What does my moving piece stop doing?** A queen that leaves the back rank may have been its only guard; a knight that jumps away may have blocked a file.
* **What do x-rays reveal?** If a piece leaves a line, a long-range piece behind it may now attack or defend through the gap.
* **What is the opponent's most forcing reply?** Calculate it first, to the end, before you calculate anything else.
* **Is every piece of mine defended after the move?** Loose pieces are the raw material of combinations.

:::nextgame The two-question habit
In your next game, every time you are about to make a capture or a forcing move, ask two questions out loud in your head: "What does this piece stop guarding?" and "What is his most annoying reply?" Do it even when the move feels obvious.
:::

## Practice at the board

Set up each position on a board or in a free analysis app. Calculate for at most ten minutes without moving the pieces, write down your tree, then check with the engine.

1. **The skewer trick.** `R7/P4k2/8/8/8/5K2/r7/8 w - - 0 50`. Find White's winning move and calculate both of Black's main replies (taking on a7, or checking from the side). Then move Black's king to g7 and check why the trick no longer works.
2. **Desperado with two layers.** `r1bq1rk1/pp2bppp/2p1p3/3n1n2/4P3/2N2N2/PPP1BPPP/R1BQ1RK1 b - - 0 10`. Black to move. Calculate ...Nxc3 against both bxc3 and Qxd8. Then try one of the knight retreats and see how quickly a piece is lost.
3. **The clearance tree.** `r4r1k/pb1nqppp/1p6/2p1N3/8/1PQ5/PBP2PPP/4RRK1 w - - 0 18`. Write the tree for Nxd7, Qg3 and Ng6+, with Black's best reply in each branch. Compare your evaluations with the engine's.
4. **Honest evaluation.** `r5k1/ppq2ppp/b7/5r2/4n3/1P2B3/PB3PPP/1Q1RR1K1 b - - 0 21`. Play the sacrifice on h2 against the engine and see what goes wrong. Then decide which black piece would have to guard h1 for the sacrifice to work, and find a sound move for Black instead.

Check yourself: for each line you calculated, did you write down the opponent's checks and captures at every step? If not, repeat the exercise and do it.

## Chapter summary

* Combinations are chains: the first motif (decoy, deflection, clearance) puts a piece or line in place for the second (fork, skewer, mate). Find the target pattern first, then the forcing move that creates it.
* A zwischenzug is a check or threat inserted before an expected recapture. Look for one every time you are about to recapture, and every time your calculation ends with your own capture.
* A doomed piece should become a desperado and capture something on its way out, preferably with check.
* X-rays count as attackers and defenders; interference cuts a defender's line; clearance vacates a square or line for another piece.
* Quiet moves inside combinations are strong when they create two threats and the opponent's free move does not help him.
* Calculate a tree: two or three candidates for you, the most dangerous replies for your opponent, and stop when the position is quiet.
* Evaluate the end of every line honestly, from your opponent's side, before you play the first move.

:::cheat The calculation routine
1. Scan both sides' checks, captures and threats, and note every loose piece and every line (files, diagonals, x-rays).
2. Look for a target pattern (fork square, skewer line, mating square) and the forcing move that creates it.
3. Choose two or three candidate moves, forcing moves first, and include one quiet move with a double threat.
4. For each candidate, calculate your opponent's most annoying reply first, especially in-between checks and desperado captures.
5. Stop each branch when the position is quiet, count material and king safety, and ask what your opponent would play there.
6. Play the move whose worst branch is best for you, after a final check of what your moving piece stops defending.
:::

@exercises
