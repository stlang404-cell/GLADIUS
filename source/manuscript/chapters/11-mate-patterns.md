---
chapter: 11
slug: mate-patterns
title: Checkmate Patterns
subtitle: Recognize the picture, then play the moves
part: 2
stage: "600–800"
skills: [mate-patterns, back-rank, smothered-mate, king-safety, attack, defense]
objectives:
  - Recognize the most common mating patterns from their key ingredients.
  - Use sacrifices (deflection and decoy) to force a known pattern onto the board.
  - Judge when the Greek gift sacrifice Bxh7+ is likely to work.
  - Spot a weakened king — your opponent's and your own — before the mate happens.
  - Defend against these patterns with luft, extra defenders and counter-checks.
next_game: When the enemy king is short of squares, picture the mating patterns from this chapter and ask which one is "nearly there" — and do the same for your own king.
---

At 600–800, many games are decided by a mate that one player never saw coming. A rook slides to the back rank. A knight hops to f7 and the king, buried behind its own pieces, cannot move. The loser often had plenty of material. What they lacked was the picture.

Strong players do not calculate every mate from scratch. They recognize **mating patterns**: small arrangements of a few pieces that occur again and again. When they see two or three of the ingredients on the board, they know which moves to look for. In this chapter you will learn the most important patterns, the sacrifices that force them, and the warning signs that a king, yours or your opponent's, is about to be caught.

## How to use mating patterns

A pattern is not a position to memorize. It is a short list of ingredients:

- where the king is,
- which of its flight squares are blocked by its own pieces,
- which squares the attacker controls,
- and which piece gives the final check.

At the board you look for two or three of the ingredients. Then you ask: "Can I force the rest?" Usually the answer involves a check or a sacrifice that drags the king or a defender into place. That is where [Chapter 10](#ch-10) comes in: deflection and decoy are the engines that drive most mating combinations.

:::key A mate needs two things
Every checkmate has a **checking piece** and a **net**: the squares around the king that are covered or blocked. When you study a pattern, notice who gives check and who builds the net. Often the king's own pieces build half of it.
:::

## The back-rank mate

The **back-rank mate** happens when a rook or queen checks the king along its first rank (the eighth rank for Black) and the king cannot step forward because its own pawns are in the way. It is the most common mate at club level, by a long way.

```board
fen: 3r2k1/pQ3ppp/8/8/8/2P5/P4PPP/6K1 b - - 0 30
caption: White's queen has gone pawn-hunting on b7. Nothing guards the first rank and the king has no luft: 30...Rd1# ends the game.
arrows: d8d1
squares: f2 g2 h2 d1
orientation: black
```

The ingredients are simple: an open file for the rook, a king boxed in by its own pawns, and no defender of the back rank. When you see a king castled behind three unmoved pawns, start checking which of its pieces guard the back rank. If the answer is "one rook", that rook is overloaded the moment it is also asked to guard something else (see [Chapter 10](#ch-10)).

The attacker's most common tool is a **deflecting sacrifice** on the back rank: a queen or rook offers itself to drag the last defender away, and the second heavy piece mates. You will find several in the exercises.

### Prevention: luft

The cure is cheap. **Luft** (German for "air") is an escape square for the king, made by moving one of the pawns in front of it, usually h3 (or ...h6 for Black). In the diagram above, if White's h-pawn stood on h3, 30...Rd1+ would just be a check and the king would walk to h2.

:::coach When to make luft
Coaching judgment: in most middlegames, a quiet moment once the heavy pieces have come out is the right time for h3 or g3. You don't have to do it on move 8, but once the rooks are fighting over open files, a king without luft is a liability.
:::

:::mistake The greedy queen
The most common way to lose to a back-rank mate is to send your queen off to grab a pawn on the other side of the board, as White did with Qxb7 above. Before you take a far-away pawn, ask what your queen was guarding.
:::

## Smothered mate

A **smothered mate** is a knight check against a king that is completely surrounded by its own pieces. Since knights jump, the check cannot be blocked; since the king has no free squares, it cannot run. The classic case is a king in the corner on h8 with a rook on g8 and pawns on g7 and h7.

The famous route to it is sometimes called **Philidor's legacy**: knight check, double check to drive the king into the corner, a queen sacrifice on g8, and the knight mates on f7. Here is the final phase.

```board
fen: r6k/pp4pp/7N/8/8/1Q6/PP3PPP/6K1 w - - 0 25
caption: The knight on h6 guards g8. The queen sacrifice on g8 forces the rook to block the king's last square.
arrows: b3g8 h6f7
squares: g8 f7
```

```line
fen: r6k/pp4pp/7N/8/8/1Q6/PP3PPP/6K1 w - - 0 25
moves: 25.Qg8+ Rxg8 26.Nf7#
check: engine
diagram: end
caption: Smothered mate. Black's own rook and pawns fill every square around the king.
```

Remember the ingredients: the king in the corner, its neighbours occupied, a knight that can reach f7 (or f2 for White's king), and a queen on the a2-g8 diagonal (or a7-g1). If you see a king on h8 with a rook on g8, look for knight checks on f7. The same picture works for Black against a white king on h1: ...Qg1+, Rxg1, ...Nf2#.

## Knight-and-rook mates: Anastasia and Arabian

Rooks and knights work well together near the edge of the board. Two patterns are worth knowing by name.

### Anastasia's mate

In **Anastasia's mate**, a knight on e7 (or e2 for Black) covers g8 and g6, the king is on h7 hemmed in by its own g7-pawn, and a rook or queen mates on the h-file.

```board
fen: 5r2/pp2Nppk/8/7R/8/8/PP3PPP/6K1 b - - 0 21
caption: Anastasia's mate. The knight takes g8 and g6, the g7-pawn blocks, and the rook checks along the h-file.
arrows: h5h7
squares: g8 g6 g7
orientation: white
```

To get there, the attacker often sacrifices on h7 to open the file and decoy the king: Qxh7+ Kxh7, then a rook swings to the h-file with mate. The key question is "Can my rook reach the h-file in one move?"

### The Arabian mate

The **Arabian mate** is the oldest known pattern: rook and knight against a king in the corner. The rook checks from the square next to the king, and the knight both protects the rook and covers the remaining flight square.

```board
fen: 7k/pp5R/5N2/8/8/8/PP3PPP/6K1 b - - 0 30
caption: Arabian mate. The rook on h7 checks, the knight on f6 protects it and covers g8; the rook covers g7.
squares: h7 g8 g7
orientation: white
```

A related idea is the **hook mate**: a rook gives check next to the king, protected by a knight, which is itself protected by a pawn, while the king's own pawn blocks its escape. You will not need its exact geometry often, but remember the lesson. A rook protected by a knight is very hard to drive away from the king.

## Bishop mates: Boden's mate and the two-bishop net

Bishops attack from far away, so their mates often look surprising. The best-known is **Boden's mate**: two bishops on criss-crossing diagonals against a king that has castled queenside.

```board
fen: 2kr4/p2n1ppp/B1p5/8/5B2/8/PPP2PPP/6K1 b - - 0 15
caption: Boden's mate. The bishop on a6 checks along a6-c8, the bishop on f4 covers b8 and c7, and Black's own rook and knight block d8 and d7.
arrows: a6c8 f4b8
squares: b7 b8 c7 d7 d8
orientation: white
```

Typically the attacker sacrifices the queen on c6 (or c3 for Black) to force ...bxc6 and open the diagonal to the king. The ingredients: a king on c8 (or c1), its own pieces on d7 and d8, one bishop able to control b8 and c7, and the other able to reach a6.

More generally, a **mating net** with minor pieces is any position where bishops and knights between them cover all the king's squares. These nets are easy to overlook because no single piece seems dangerous. When the enemy king is short of squares, count which squares *each* of your minor pieces covers. Sometimes the net is already complete and you only need a check.

## Queen mates near the king: h7, g7 and the supporting pawn

Most mating attacks against a castled king end with the queen on h7 or g7 (h2 or g2 against White). The queen cannot do it alone: she needs a partner that protects her on the mating square.

The most common partners are:

- **A bishop on the b1-h7 diagonal**, supporting Qxh7#. This is the "Q + B battery" you met in [Chapter 10](#ch-10).
- **A knight on g5**, supporting Qxh7# or Qh7#.
- **A pawn on f6 (or h6)**, supporting Qg7#. This picture, with a pawn wedged deep in front of the king and the queen landing next to it, is a version of what older books call **Damiano's mate**.

```board
fen: 6k1/pp3pQp/5Pp1/8/8/8/5PPP/6K1 b - - 0 25
caption: The pawn on f6 protects the queen on g7. The king cannot take, and f8 and h8 are covered by the queen.
squares: g7 f6 f8 h8
orientation: white
```

:::key The advanced pawn is a dagger
A pawn on f6 (or f3 against White) next to a castled king is worth far more than one point. It covers g7 and e7 and prepares Qg7# or Qh6 with mate on g7. When you can safely plant a pawn there, the enemy king is usually in serious trouble.
:::

### Worked example: the quiet queen move

Let's see how to think when one of these patterns is "nearly there".

```board
fen: r4rk1/pp3p1p/2p2Pp1/1q6/8/8/PPPQ1PPP/4R1K1 w - - 0 22
caption: White to move. The pawn on f6 is the dagger. Which square does the queen need?
arrows: d2h6
red: b5e2
squares: g7 f6
```

**Step 1: checks, captures, threats.** I have no useful checks. Qd8 is not a check (the rook on f8 is in the way). There are no good captures. Black's queen on b5 attacks b2 and e2, but nothing is hanging that matters.

**Step 2: which pattern is nearly there?** My pawn on f6 already covers g7. If my queen reaches g7, it will be protected by the pawn, and the king on g8 cannot go to f8 (its own rook) or h8 (covered by the queen). That is the f6-pawn pattern.

**Step 3: can the queen get there?** From d2, the queen reaches h6 in one move. From h6 she threatens Qg7#.

**Step 4: what is Black's best defence?** I look for every way Black could stop Qg7#: something guarding g7, something blocking, or a check that changes everything. Black's pieces are far away. Black's only "defence" is a desperate check, 22...Qf1+, which my king simply captures. Then nothing can stop the mate.

```line
fen: r4rk1/pp3p1p/2p2Pp1/1q6/8/8/PPPQ1PPP/4R1K1 w - - 0 22
moves: 22.Qh6 Qf1+ 23.Kxf1 c5 24.Qg7#
check: engine
diagram: end
caption: A quiet queen move that mates. The pawn on f6 did half the work.
```

**Step 5: blunder-check.** Before playing 22.Qh6, I check that Black has no check that wins my queen or gives perpetual. There is only the queen sacrifice on f1. I play it.

The lesson: a quiet move can be stronger than any check when it creates a mate threat the opponent cannot meet. Recognizing the pattern told me which square to aim for.

## The corridor and epaulette mates

When a king is stuck in a "corridor", it can only move along one line, and a single long-range piece can cut it off. The back-rank mate is the most common corridor mate, but the same thing happens on files and diagonals, for example a king on the edge of the board with its own pieces in front of it.

The **epaulette mate** is a special case: the king's own rooks (or other pieces) stand on both sides of it, like the shoulder decorations on a uniform. A queen check from two squares in front is then mate.

```board
fen: 3rkr2/pp4pp/4Q3/8/8/8/PP3PPP/6K1 b - - 0 25
caption: Epaulette mate. Black's rooks on d8 and f8 block the king's sideways escape; the queen on e6 covers d7, e7 and f7.
squares: d8 f8 d7 e7 f7
orientation: white
```

You will not see the exact epaulette often, but the idea, that the king's own pieces form part of the net, appears in almost every mate in this chapter.

## The Légal pattern: a recap

Several of the best-known opening traps, the kind discussed in [Chapter 6](#ch-06), are based on a pin to the queen rather than the king. The most famous is **Légal's pattern**: White ignores a pin on the knight, gives up the queen, and mates with minor pieces. The typical finish is a bishop check on f7 followed by a knight mate on d5.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 d6 3.Bc4 Nc6 4.Nc3 Bg4 5.h3 Bh5? 6.Nxe5 Bxd1?? 7.Bxf7+ Ke7 8.Nd5#
check: engine
diagram: end
caption: Three minor pieces against a king that left home. Black should have played 6...Nxe5, losing only a pawn.
```

The pattern to remember: a pin to the *queen* is not absolute. If breaking it lets you deliver mate or win more than the queen, the pin is only an illusion.

## The Greek gift: Bxh7+

The **Greek gift** is the classic bishop sacrifice on h7 (or ...Bxh2+ for Black) against a castled king. The usual follow-up is Ng5+ and Qh5, bringing the knight and queen to the king with gain of time. It is one of the most important attacking ideas in chess, and also one of the easiest to get wrong. Treat this section as an introduction; you will study attacks on the king in depth in [Chapter 21](#ch-21).

```board
fen: r1bq1rk1/pp1n1ppp/2n1p3/2bpP3/5B2/2NB1N2/PPP2PPP/R2QK2R w KQ - 2 9
caption: The typical Greek-gift set-up: bishop on d3, knight on f3, queen ready for h5, pawn on e5 keeping a black knight off f6.
arrows: d3h7 f3g5 d1h5
squares: h7 f6 g5 h5
```

### The conditions

Coaching judgment, based on the ingredients that appear in most successful examples: check these before you sacrifice.

1. **A bishop on the b1-h7 diagonal** that can capture on h7 with check.
2. **A knight that can reach g5** with check after ...Kxh7, and that cannot simply be captured there for free.
3. **A queen that can reach h5** (or the h-file) quickly, usually from d1 via an open d1-h5 diagonal.
4. **No black knight on f6** (or one that can be driven away, typically by a pawn on e5) and no black bishop or queen that can defend h7 or cover h5.
5. **A plan against each king move**: ...Kg8, ...Kg6 and ...Kh6, and also against declining the sacrifice with ...Kh8.

If several of these are missing, the sacrifice is usually unsound. If all are present, it often wins outright.

```line
fen: startpos
moves: 1.e4 e6 2.d4 d5 3.Nc3 Nf6 4.e5 Nfd7 5.Nf3 c5 6.dxc5 Nc6 7.Bf4 Bxc5 8.Bd3 O-O? 9.Bxh7+ Kxh7 10.Ng5+ Kg8 11.Qh5
check: engine
diagram: end
caption: White threatens Qh7#. Black has to give up the queen with 11...Qxg5 to stop the mate.
```

:::mistake Sacrificing on hope
The most common Greek-gift mistake is to play Bxh7+ because "it looks like the textbook" when one ingredient is missing, for example a black knight that can come back to f6, or a bishop on e7 that captures on g5. Before you sacrifice, play through ...Kg8, ...Kg6 and declining with ...Kh8 in your head. If you can't find a strong answer to one of them, keep the bishop.
:::

## Recognizing a weakened king

Patterns tell you *how* to mate. The first step is to notice *when* a king is vulnerable. Run this checklist on both kings, yours and your opponent's, whenever the position changes:

- **Flight squares.** How many safe squares does the king have? Zero or one is a red flag.
- **Pawn shield.** Have the pawns in front of the king moved? Each move creates holes (squares no pawn can protect), especially f6, g6, h6 for Black and f3, g3, h3 for White.
- **Missing defenders.** Is the f6-knight (or f3-knight) gone? It is the most important defender of a castled king.
- **Attackers nearby.** Count your pieces that can reach the king's area in one or two moves. Three attackers against one defender usually means a tactic is close.
- **Open lines.** Is there an open file toward the king, or a long diagonal pointed at it?
- **Back rank.** Is the back rank guarded by more than one piece, and does the king have luft?

:::nextgame The two-king scan
Once every few moves, run the weakened-king checklist on *both* kings. If the enemy king scores badly, look for one of the patterns from this chapter. If yours scores badly, spend a move on defence before you attack.
:::

## Defending against mating patterns

Knowing the patterns also makes you a better defender. Most mates can be prevented a move or two in advance, cheaply, if you recognize what is coming. Your main tools:

- **Make luft** before the back rank becomes a problem.
- **Add a defender** to the mating square, ideally with gain of time, for example a knight to f6 attacking a queen on h5.
- **Block the attacking line**, for instance ...g6 against a bishop on the b1-h7 diagonal.
- **Trade off a key attacker**, such as the bishop or knight that supports the queen.
- **Look for counter-checks.** A check against the attacking king can sometimes break the whole combination.

### A defender's question: which pattern is my opponent building?

Every pattern in this chapter can also be read from the defender's side. If your king is on h8 with a rook on g8, an enemy knight that can reach f7 is a smothered-mate warning. If your king has castled queenside and your c-pawn has moved, look at the a6-c8 diagonal for a Boden-style bishop check. If an enemy pawn has arrived on f6 (or f3 against your king), the g7 square is under permanent pressure and you will often need a piece dedicated to guarding it. A knight that lands on e7 next to your king on h8 or h7 means the h-file must stay closed.

The idea is to recognize the picture one or two moves *before* it is complete, while a cheap defensive move still works. Once the final sacrifice is on the board, it is usually too late. Many club games are lost not because the defender missed the final combination, but because they made a careless pawn move or traded off their best defender a few moves earlier.

The danger in defence is the "natural move" that ignores the threat: a developing move or a pawn grab while the queen and bishop line up against h7. Every time your opponent's move creates a battery aimed at your king, stop and count attackers and defenders of the target square.

## Practice at the board

Set up each position on a board or in an analysis app. Solve it first without moving the pieces, then check with the engine.

1. **Back rank with and without luft.** `3r2k1/pQ3ppp/8/8/8/2P5/P4PPP/6K1 b - - 0 30`. Play 30...Rd1#. Then move White's h-pawn to h3 and see why the same move is only a check.
2. **Smothered mate.** `r6k/pp4pp/7N/8/8/1Q6/PP3PPP/6K1 w - - 0 25`. Find the two-move mate. Then put the knight on f7 and the black king on g8 and find Philidor's full sequence (Nh6+, Kh8, Qg8+, Rxg8, Nf7#), with the queen on c4.
3. **The quiet queen move.** `r4rk1/pp3p1p/2p2Pp1/1q6/8/8/PPPQ1PPP/4R1K1 w - - 0 22`. Find the mate. Try every Black defence you can think of.
4. **Greek gift test.** Play through the Greek gift line above from move 8. At move 9 try declining with 9...Kh8 instead of taking. Is White still better? Ask the engine and compare with your own judgment.
5. **Build the nets.** On an empty board, place only the pieces needed for Anastasia's, the Arabian, Boden's and the epaulette mate. If you can set each one up from memory, you own the pattern.

:::drill Pattern flashcards
Make a card for each pattern in this chapter: draw the final position and list its ingredients on the back. Review the cards before each tournament game for a week.
:::

## Chapter summary

- Mating patterns are short lists of ingredients: the king's position, its blocked squares, the attacker's controlled squares, and the checking piece.
- The back-rank mate is the most common club mate; luft and a second back-rank defender prevent it.
- Smothered mate (with Philidor's queen sacrifice on g8) and the knight-and-rook mates (Anastasia's, Arabian, hook) show how knights exploit kings blocked by their own pieces.
- Bishops mate from long range: Boden's mate and minor-piece nets are easy to miss, so count every square your minor pieces cover.
- Queen mates on h7 and g7 need a partner: a bishop, a knight on g5, or a pawn on f6.
- The Greek gift Bxh7+ works only when its ingredients are present; check every king move and the option of declining before you sacrifice.
- Run the weakened-king checklist on both kings and defend early: luft, extra defenders, blocked lines and counter-checks.

:::cheat Finding (and stopping) a mate
1. Count the enemy king's flight squares and note which are blocked by its own pieces.
2. Name the pattern that is "nearly there" and the ingredient that is missing.
3. Look for a check, sacrifice or quiet threat that supplies the missing ingredient — usually a deflection or decoy.
4. Calculate the opponent's best defence, including counter-checks and declining a sacrifice.
5. Run the same scan on your own king before you commit to the attack.
:::

@exercises
