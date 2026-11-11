---
chapter: 26
slug: endgame-technique
title: Endgame Technique
subtitle: Kings, passed pawns and the minor-piece endings
part: 5
stage: "1200–1500"
skills: [endgame-technique, minor-piece-endgame, queen-endgame, passed-pawn, bishop-vs-knight, perpetual, conversion]
objectives:
  - Apply the general principles of endgame technique, including king activity, pushing passed pawns and the principle of two weaknesses.
  - Play the main minor-piece endings, the wrong-coloured bishop and opposite-coloured bishops correctly.
  - Know when queen against a pawn on the seventh wins and when the stalemate defence draws.
  - Handle queen endings practically and calculate endgames by counting tempi.
next_game: When the queens come off, bring your king towards the centre at once, find your passed pawn or your opponent's weakest pawn, and count tempi before every pawn race.
---

You reach an endgame a pawn up, or with a better minor piece, and you feel relieved. Twenty moves later it is a draw, or worse. At this level more half-points are lost in "winning" endings than in any other phase, and the reason is rarely a lack of knowledge. It is technique: the king stays at home, a passed pawn waits too long, a pawn is exchanged that should not have been, a check is overlooked.

This chapter gives you the working principles of endgame technique, then the minor-piece endings, the queen against a far-advanced pawn, and practical queen endings. You already know king and pawn endings from [Chapter 18](#ch-18) and rook endings from [Chapter 23](#ch-23); here we build on both.

## The principles of technique

### Activate the king

In the middlegame the king hides. In the endgame, with fewer pieces left to attack it, the king becomes a strong fighting piece, worth roughly a minor piece in many positions. Its jobs are to support your passed pawns, to stop your opponent's, and to attack pawns.

```board
fen: 8/2k3pp/1n6/1B1P4/4K3/8/6PP/8 w - - 0 45
caption: White to move. Bishop against knight with a passed d-pawn. The king belongs on e5, supporting the pawn from in front and eyeing the black kingside.
arrows: e4e5
squares: d6 e6
```

45.Ke5! is the move. From e5 the king supports d5-d6, controls e6 and d6, and prepares to march to the kingside pawns while the knight has to watch the passed pawn.

```line
fen: 8/2k3pp/1n6/1B1P4/4K3/8/6PP/8 w - - 0 45
moves: 45.Ke5 Nc8 46.Bd3 g6 47.Ke6
check: engine
caption: The king supports the pawn and heads for Black's kingside while the knight is tied to d6 and b6. Bishop moves instead of Ke5 would let Black's king reach d6 and blockade.
```

:::key The king first
When the queens come off, ask: "Where would my king be most useful in ten moves?" and start walking. A king that arrives two moves earlier than the opponent's often decides the game on its own.
:::

### Passed pawns must be pushed

A passed pawn is your main winning asset, and it gets stronger the further it advances: it ties down enemy pieces and makes them passive. Two practical rules:

* **Push when the pawn is safe and the push costs the opponent something**, for example when it drives a piece to a worse square or gains a tempo with check.
* **Do not let it be blockaded cheaply.** A pawn that waits on the fourth rank gives the opponent time to put a king or knight in front of it.

The opposite advice also holds: a passed pawn is pushed, not *thrown*. If it advances far beyond the support of your king and pieces, it can simply be rounded up.

### Do not rush, but do not waste chances

**"Do not rush"** is a famous endgame motto. When your opponent has no counterplay, improve your pieces fully before committing, because committal moves (pawn exchanges, sacrifices) are irreversible. A good practical method is to make the "free" improving moves first: king to the centre, rooks or minor pieces to their best squares, pawns away from the colour of the enemy bishop.

The second half of the advice is just as important: *do not throw away the chances the opponent might give you*. While you improve, choose moves that set problems. A move that keeps your position just as good but gives the opponent a chance to go wrong is better than one that gives him nothing to think about.

:::coach Technique is calm
My coaching advice: in a winning endgame, write down in one sentence what your plan is and which counterplay you must prevent. If you cannot say it, you are not ready for committal moves. Make an improving move instead.
:::

### The principle of two weaknesses

A single weakness can usually be defended: the defender puts his pieces around it, and your attack stalls. The **principle of two weaknesses** says that you win by creating a *second* weakness far away from the first. The defender's pieces cannot be on both sides at once, and something gives.

The most common second weakness is an **outside passed pawn**: a passed pawn far from the other pawns, which drags the enemy king or knight away.

```board
fen: 8/p4pp1/1p1k3p/8/1n2N3/1P2K1PP/5P2/8 b - - 0 40
caption: Black to move. Black's two pawns against one on the queenside will produce an outside passed pawn. While White's king and knight stop it, Black's king goes to the kingside: two weaknesses, one on each wing.
arrows: a7a5
squares: b3
```

Black is clearly better here. The plan is simple to state: create a passed a-pawn, push it to draw White's pieces to the queenside, then use the king against the weakened kingside pawns.

## Minor-piece endings

### Knight against pawns

The knight is the worst piece against a far-advanced passed pawn, especially a rook pawn, because it has so few squares near the edge. Two rules help:

* **A knight in front of a pawn**, on its path, usually holds it easily.
* **A knight chasing a pawn** must count moves exactly. Count the knight moves to a square on the pawn's path, and remember that the knight needs both time and a safe square: a knight move to a square next to the enemy king may simply be captured.

Typical knight resources are worth knowing by heart. A knight that cannot reach the pawn's path can sometimes reach a square from which it *checks* the enemy king and then jumps in front of the pawn, gaining the decisive tempo. And a knight defending against a rook pawn on the seventh is in real danger, because from the corner it can be cut off from almost every useful square. When you are the side with the pawn, aim for the rook's file and keep your king between the knight and the queening square.

As the side with the knight against several pawns, a good defence is often to attack the pawns from behind or from the side, where the knight cannot be shouldered away, while your king blockades from in front.

### Bishop against knight

The middlegame guidelines from [Chapter 25](#ch-25) still apply, and they become stronger in the endgame. With pawns on both wings and an open board, the bishop is usually better: it guards one wing from a distance while the king attacks on the other. With pawns on one wing only, especially if they are fixed, the knight is often as good or better, because it can attack pawns of either colour.

### Good bishop against bad bishop

With bishops of the same colour, the side whose pawns stand on the *other* colour has the good bishop. The winning method in such endings is almost always the same: the king invades on the colour that the bad bishop cannot control, and the bad bishop's pawns become targets. The defender must keep his king active and look for a pawn break that changes the structure; passive waiting usually loses.

A practical checklist for the defender with the bad bishop: keep your king as active as the pawns allow, place your pawns (if any can still move) on the colour of the enemy bishop so that they are protected by the structure rather than by your bishop, and look for the one pawn break that can open a second front. A bad bishop that defends one weak pawn may hold; a bad bishop that must defend two will not.

### Converting extra material

Most technical endings are about converting an extra pawn or a better piece. The methods from [Chapter 16](#ch-16) apply directly: trade pieces rather than pawns, keep pawns on both wings when you are ahead (they make the opponent's defence harder), and avoid leaving your pawns on the colour of your own bishop where they can be blockaded. Before each exchange ask: "Is the ending after this trade easier to win than the one I have now?" If the answer is not a clear yes, keep improving instead.

### The wrong-coloured bishop and the rook pawn

King, bishop and rook pawn against a lone king is a famous exception: if the bishop does not control the queening square (a light-squared bishop with an h-pawn, since h8 is dark), and the defending king reaches the corner, it is a draw. The king cannot be driven out of h8 without stalemate.

```board
fen: 7k/8/7P/5K2/8/3B4/8/8 w - - 0 60
caption: A dead draw. The bishop cannot control h8, the king cannot be forced out of the corner, and pushing h7 only stalemates. The engine shows a small plus, but no progress is possible.
squares: h8
```

The consequence works in both directions. As the attacker, you must keep the defending king *away from the corner*, usually by cutting it off with the bishop on the diagonal that leads to the corner. As the defender, run for the corner, even at the cost of other pawns. And remember: the same applies to the a-pawn with the "wrong" dark-squared bishop, since a8 is light.

## Opposite-coloured bishops

When the bishops run on different colours, the endgame becomes famously drawish. Each bishop controls squares the other can never contest, so the defender can set up an unbreakable **blockade**: the king stands in front of the passed pawns, and the bishop controls the squares of its colour on which the pawns would have to advance. Even two extra pawns are often not enough.

Practical rules for these endings:

* **For the defender:** put the king in front of the pawns, keep the bishop on a long diagonal that crosses the pawns' path, and do not grab pawns if it lets the passed pawns run.
* **For the attacker:** you usually need two passed pawns far apart, two or more files, so that the defending king and bishop cannot both stop them. Connected pawns that are already blockaded rarely win.
* **In the middlegame the opposite is true**: as we saw in [Chapter 25](#ch-25), opposite-coloured bishops favour the attacker, because the defender's bishop cannot guard the squares the attack needs.

:::mistake Trading into a drawn ending
A frequent way to throw away a winning middlegame is to trade pieces "to simplify" and end up in an opposite-coloured bishop ending a pawn or two ahead. Before trading the last minor pieces, check which bishops will remain.
:::

## Queen against a pawn on the seventh

A queen normally beats a pawn easily, but a pawn on the seventh rank supported by its king is a special case.

### Centre pawns and knight pawns: the queen wins

The method against a centre pawn or a knight pawn is a staircase of checks and attacks that forces the defending king to stand **in front of its own pawn**. Each time that happens, the pawn cannot move, and the attacking king gains a tempo to step closer. Repeat until the king is close enough to help win the pawn or mate.

```board
fen: K7/8/8/8/4Q3/8/6p1/5k2 w - - 0 60
caption: White to move. The g-pawn is on the seventh, but with checks the queen either wins it or drives the king in front of it, then the white king approaches.
arrows: e4f4
squares: g1
```

```line
fen: K7/8/8/8/4Q3/8/6p1/5k2 w - - 0 60
moves: 60.Qf4+ Ke2 61.Qg3 Kf1 62.Qf3+ Kg1 63.Kb7
check: engine
caption: The checks drive the king to g1, in front of its own pawn. That gives White the free move Kb7, and the process repeats until the white king arrives.
```

### Bishop pawns and rook pawns: the stalemate defence

Against a **bishop pawn** or a **rook pawn** on the seventh, the defence has a stalemate resource, and with the attacking king far away the game is a draw.

```board
fen: 8/8/8/4K3/8/1Q6/2p5/k7 w - - 0 60
caption: White to move. Against the c-pawn Black's king has gone to a1 instead of protecting the pawn. If Qxc2, it is stalemate, so White cannot make progress.
red: b3c2
squares: a1
```

```line
fen: 8/8/8/4K3/8/1Q6/2p5/k7 w - - 0 60
moves: 60.Qa3+ Kb1 61.Qb3+ Ka1
check: engine
caption: Every time White checks, Black returns to the corner. White never gets the free move needed to bring the king closer.
```

With a rook pawn the defence is even simpler: the defending king hides in front of the pawn in the corner, and the attacker has to be careful not to stalemate.

The exception to the exception: if the attacking king is **already close**, the queen and king together win even against these pawns, usually by a mating net. The rule of thumb is that the queen wins against a bishop or rook pawn only when the king is near enough to take part within a few moves; count it.

## Queen endings in practice

Queen endings are the most tactical endings. Practical advice:

* **Perpetual check is everywhere.** The defending side's best hope is usually a perpetual, and the attacking side's main job is to avoid it.
* **King safety still matters.** The attacker's king needs shelter, often in front of or beside the enemy pawns, so that checks run out.
* **Centralize the queen.** A queen in the centre both attacks and defends against checks.
* **A passed pawn far advanced** is worth more than material elsewhere: it ties the enemy queen down.

```board
fen: 6k1/5p2/6p1/8/3Q3P/6P1/2q2P1K/8 b - - 0 50
caption: Black to move. White is a pawn up, but White's king is open and Black's queen is active. The engine sees this as close to equal: the checks are the defence.
arrows: c2c6
```

:::nextgame Count the checks
In your next queen ending, before every move, count your opponent's checks. If he has more than two in a row, ask where your king could hide and whether your move takes away one of them.
:::

## Calculating in the endgame

Endgame calculation is different from middlegame calculation: lines are longer, but there are fewer pieces and fewer branches. Three tools do most of the work:

1. **Count tempi.** In any race, count how many moves each side needs to promote, and include checks that gain or lose a tempo. Many "obvious" races are decided by one tempo.
2. **Use geometry.** The rule of the square, the knight's route, the king's diagonal shortcuts: shapes on the board let you skip move-by-move calculation.
3. **Look for the only move.** In sharp endings, often only one move holds or wins. When the position is critical, list *all* candidate moves, including king moves and quiet bishop moves, before you choose.

A short example of tempo counting: your passed a-pawn stands on a4, the enemy king is on e5, and it is your move. The pawn needs four moves to queen (a5, a6, a7, a8). The king needs to reach the a8 corner or the pawn's path: from e5 to b7 is three king moves (d6, c7, b7). Because you move first, the pawn reaches a5, a6, a7 while the king reaches d6, c7, b7, and the king arrives in time. Move the king one file further away and the result changes. Counting like this takes ten seconds and replaces a lot of guessing; the rule of the square from [Chapter 18](#ch-18) is a shortcut for exactly this count.

## Common technical mistakes

Most lost half-points in good endings come from a handful of habits. Recognize them in your own games:

* **The passive king.** The king stays on g1 "for safety" while the opponent's king marches into the centre. Unless there are still queens or heavy mating threats, the safety argument no longer applies.
* **Trading the wrong pawns.** When you are ahead, pawn trades bring the opponent closer to a draw (a lone extra minor piece cannot win). Trade pieces; keep pawns.
* **Hurrying the passed pawn.** The pawn runs ahead of its support and is collected by the enemy king or knight. Advance it when the king or a piece can follow it.
* **Allowing the "bad" ending.** A trade that leads to opposite-coloured bishops, to the wrong-coloured bishop with a rook pawn, or to a lost pawn ending can turn a win into a draw or a loss in one move.
* **Ignoring the opponent's checks.** In queen and rook endings the defender's main weapon is the check. Ask before every move how many checks your opponent has.
* **Playing on autopilot.** Technique is not the same as playing fast. A winning ending still needs a blunder-check on every move.

:::mistake "Any move wins"
When the position is winning, players stop calculating. Then a single careless move, such as a pawn push that gives up a key square or a king step into a fork, throws away the work of the whole game. In a won ending, the blunder-check matters more, not less, because there is no more counterplay to warn you.
:::

## A worked example: choosing the winning move

Return to the bishop-against-knight position from the start of the chapter.

**First I check the material and the pawns.** Material is level in pawns, with bishop against knight. My trump is the passed d-pawn; Black has two kingside pawns against my two.

**Then I look at the opponent's resources.** Black wants to blockade the pawn with the king on d6. Black's knight on b6 attacks d5 and is close to the queening path.

**Candidate moves.** 45.Ke5 (activate the king), 45.d6+ (push the pawn), 45.Bc6 or 45.Be8 (improve the bishop).

**45.d6+?** looks forcing, but after 45...Kxd6 the pawn is simply gone: my king on e4 is too far away to protect it. A passed pawn is pushed with support, not thrown.

**45.Bc6** keeps the bishop active, but after 45...Kd6 Black's king blockades and my king cannot get past. The engine evaluates this as only slightly better for White.

**45.Ke5!** prevents ...Kd6, supports d6 next move and keeps the king close to Black's kingside pawns. After 45...Nc8 46.Bd3 g6 47.Ke6, the pawn is safe, my king is close to Black's pawns and the knight is reduced to guarding d6.

**Blunder-check.** Does Black have a knight fork or check? From b6 the knight reaches d7 (check on e5) and c4 (check on e5). After 45.Ke5 Nd7+ my king steps to e6 or d4 and the knight has abandoned the queenside; 45...Nxd5 is met by 46.Kxd5. No danger. I play 45.Ke5.

## Practice at the board

1. **King activation.** `8/2k3pp/1n6/1B1P4/4K3/8/6PP/8 w - - 0 45`. Play White against an engine and win. Then repeat with 45.Bc6 instead of 45.Ke5 and see how much harder it becomes.
2. **Wrong-coloured bishop.** `7k/8/7P/5K2/8/3B4/8/8 w - - 0 60`. Try to win against the engine for ten moves and convince yourself it is impossible. Then set the position up again with Black's king on e8 instead of h8 and work out which squares your bishop must control to keep the king out of the corner.
3. **Queen against a pawn.** `K7/8/8/8/4Q3/8/6p1/5k2 w - - 0 60`. Win against the engine. Then move the pawn to c2 and the black king to b2, keep White's king on a8, and see why the same method only draws.
4. **Two weaknesses.** `8/p4pp1/1p1k3p/8/1n2N3/1P2K1PP/5P2/8 b - - 0 40`. Play Black against the engine and win by creating a passed a-pawn and then switching to the kingside.

Check yourself: did you activate your king within the first three moves of each ending? If not, replay the ending and do it.

## Chapter summary

* In the endgame the king is a fighting piece: bring it to the centre and towards the pawns at once.
* Passed pawns must be pushed when it is safe and costs the opponent something, but not thrown forward without support.
* Do not rush: make all useful improving moves before committal ones, and choose moves that give the opponent chances to go wrong.
* Win by creating a second weakness far from the first; an outside passed pawn is the most common one.
* Bishops prefer pawns on both wings; knights are poor against far-advanced rook pawns; a good bishop wins by king invasion on the other colour.
* King, wrong-coloured bishop and rook pawn draw if the defending king reaches the corner; opposite-coloured bishop endings are drawish even with extra pawns.
* Queen against a centre or knight pawn on the seventh wins; against a bishop or rook pawn the stalemate defence draws unless the attacking king is close.
* In queen endings, perpetual check is the main defensive resource; count checks before every move.

:::cheat The endgame routine
1. Activate the king: decide where it is most useful in ten moves and start walking.
2. Find the trumps: your passed pawns and the opponent's weakest pawns; plan a second weakness.
3. Improve every piece before committal moves, and keep setting problems.
4. Before any trade, check which ending remains (opposite bishops, wrong-coloured bishop, lost pawn ending).
5. In races and sharp positions, count tempi and list all candidates, including quiet king and bishop moves; in queen endings, count the opponent's checks.
:::

@exercises
