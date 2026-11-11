---
chapter: 18
slug: king-pawn-endgames
title: King and Pawn Endgames
subtitle: Every tempo counts
part: 3
stage: "800–1000"
skills: [king-pawn-endgame, opposition, passed-pawn]
objectives:
  - Use the rule of the square to judge pawn races instantly.
  - Win and defend king and pawn against king with key squares and the opposition.
  - Recognize the rook-pawn draw, outflanking, and the idea of losing a move.
  - Use outside and protected passed pawns, and execute the classic pawn breakthrough.
  - Count tempi in pawn races and calculate before trading into a pawn ending.
next_game: Before you trade the last pieces, count the pawn ending that follows; when you are in one, put your king in front of your pawns and ask who has the opposition.
---

The rooks come off, the last minor pieces disappear, and suddenly only kings and pawns are left. Many players at this level relax here: "It's just pawns." Then they push the wrong pawn, walk the king to the wrong square, and a winning position turns into a draw, or a draw into a loss.

King and pawn endings are the most concrete part of chess. There are no hidden tactics with knights and no long-range bishops, and the number of moves is small enough that you can often calculate to the end. That is exactly why they are unforgiving: a single wasted tempo usually decides the game. The good news is that a handful of ideas (the square, the opposition, key squares, and counting) cover most of what you will meet in your games. This chapter teaches those ideas and the habits to use them.

## Why pawn endings are different

In a pawn ending the king is your strongest piece. It attacks pawns, escorts its own pawns and blocks enemy ones. The king that gets to the centre first, or into the enemy pawns first, usually wins.

The second difference is that **tempo** (a single move of time) matters more than anywhere else. In a middlegame, wasting a move is a small inaccuracy. In a pawn ending, having to move can be fatal. The situation where any move worsens your position is called **zugzwang**, a German word meaning "compulsion to move". Many pawn endings are won by putting the opponent in zugzwang.

The third difference is permanence. Once you trade into a pawn ending, there is no way back: you cannot bring a rook back to save you. That is why strong players treat the decision to enter a pawn ending as a calculation, not a reflex.

## The rule of the square

The first skill is judging whether a king can catch a passed pawn. Counting moves works, but there is a faster tool. Draw an imaginary square: one side runs from the pawn to its promotion square, and the square extends sideways towards the defending king. If the defending king is inside the square, or can step into it with the move, it catches the pawn. If not, the pawn queens.

```board
fen: 8/6k1/8/p7/5K2/8/8/8 w - - 0 1
caption: The square of the a5-pawn is a5-a1-e1-e5. White to move steps into it with Ke4 and catches the pawn; with Black to move, ...a4 shrinks the square and the white king is too late.
squares: a5 a1 e1 e5
arrows: f4e4
orientation: white
```

With White to move, the king walks straight into the pawn's path:

```line
fen: 8/6k1/8/p7/5K2/8/8/8 w - - 0 1
moves: 1.Ke4 a4 2.Kd3 a3 3.Kc2 a2 4.Kb2
check: engine
caption: The king stays inside the shrinking square all the way and captures the pawn on a2 next.
```

Three details cause most mistakes with the square:

* **A pawn on its starting rank** can move two squares at once. Draw the square as if the pawn were already one rank further forward.
* **Obstacles.** If your own pawns stand in the king's path, the geometry lies. The king has to walk around them.
* **Support.** The square only applies to a pawn running alone. If the enemy king can escort its pawn, you are no longer in a race but in a king-and-pawn fight, which the rest of this chapter covers.

:::key The square in one sentence
If your king is inside the square of the pawn (counting the move), it catches the pawn; if it is outside, it does not. Check it before every pawn race.
:::

## King and pawn against king

This is the basic ending that all others reduce to. One side has a king and a single pawn; the other has only a king. The result depends on where the kings stand and whose move it is. Master it and you will know, many moves ahead, whether trading into a pawn ending wins.

### The king leads, the pawn follows

The most common beginner mistake is pushing the pawn and hoping. Pawns cannot protect themselves, and a pawn that runs ahead of its king is usually blockaded and lost. The right method is the opposite: your king goes in front of the pawn and clears the way.

A useful guideline: with any pawn except a rook pawn, if your king stands on the sixth rank directly in front of its pawn, you win no matter who is to move.

```line
fen: 4k3/8/4K3/4P3/8/8/8/8 w - - 0 1
moves: 1.Kd6 Kd8 2.e6 Ke8 3.e7 Kf7 4.Kd7
diagram: end
caption: The king on the sixth controls the promotion path. After 4.Kd7 nothing stops e8=Q.
```

### Key squares

**Key squares** are squares that, once your king reaches one of them, guarantee the win regardless of who moves. For a pawn on the second, third or fourth rank (not a rook pawn), the key squares are the three squares two ranks directly in front of the pawn. For a pawn on e4 they are d6, e6 and f6.

```board
fen: 8/4k3/8/8/4P3/8/4K3/8 w - - 0 1
caption: The key squares of the e4-pawn are d6, e6 and f6. White's task is to get the king to one of them; Black's task is to prevent it.
squares: d6 e6 f6
orientation: white
```

The rule above covers pawns on their second, third and fourth ranks, which is where most of your real endings start. As the pawn advances further, the key squares move forward with it and become easier for the attacker to reach, but the method stays the same: name the squares your king needs, then fight for them.

Thinking in key squares simplifies everything. You stop asking "can I push the pawn?" and start asking "can my king reach a key square?" The defender asks the mirror question: "can I keep the enemy king away from those squares?"

### The opposition

The main tool for fighting over key squares is the **opposition**. Two kings stand in opposition when they face each other on the same file (or rank) with one square between them. The side that does *not* have to move "has the opposition": the other king must give way.

```board
fen: 8/4k3/8/4K3/4P3/8/8/8 b - - 0 1
caption: The kings are in opposition. With Black to move, Black must step aside and White's king reaches a key square. With White to move, the same position is only a draw.
squares: d6 e6 f6
arrows: e5f6 e5d6
orientation: white
```

With Black to move, every king move gives up one of the key squares:

```line
fen: 8/4k3/8/4K3/4P3/8/8/8 b - - 0 1
moves: 1...Kd7 2.Kf6 Kd8 3.Kf7 Kc7 4.e5
caption: Black stepped left, so White's king went right to f6 and then f7, controlling the pawn's path.
```

With White to move in the diagram, White can only shuffle; if 1.Kd5 Kd7 or 1.Kf5 Kf7, Black keeps facing the white king and the pawn never gets through. Always notice whose move it is: in pawn endings the same position can be a win or a draw depending on that alone.

### Defending: stay in front

The defender's recipe is simple to say: keep your king directly in front of the pawn, and when the enemy king approaches, take the opposition. When you are pushed back, retreat straight backwards (for example from e7 to e8), not to the side, so that you can take the opposition again when the white king advances.

Here is the drawn version of the opposition diagram, with White to move. Watch how Black always answers the white king by facing it.

```line
fen: 8/4k3/8/4K3/4P3/8/8/8 w - - 0 1
moves: 1.Kd5 Kd7 2.e5 Ke7 3.e6 Ke8 4.Kd6 Kd8 5.e7+ Ke8 6.Ke6
check: engine
caption: Black kept the opposition every time the white king stepped forward. The final position is stalemate.
```

```board
fen: 4k3/4P3/4K3/8/8/8/8/8 b - - 0 1
caption: The defender's goal. Black to move has no legal move: stalemate. If White had played anything else on move 6, the black king would have captured the pawn.
squares: e8
orientation: white
```

This final picture is worth remembering. If you can reach it as the defender, you have drawn. If you are the attacker and you see it coming, you went wrong earlier: usually you pushed the pawn before the king had reached a key square.

:::mistake Pushing the pawn too early
When the attacking king is beside or behind its pawn, pushing usually throws away the spare tempo you need later for the opposition. Bring the king forward first. A pawn on its second or third rank is a reserve of waiting moves; do not spend them until you need them.
:::

### The rook-pawn exception

Rook pawns (a- and h-pawns) are special. If the defending king reaches the corner in front of the pawn, the attacker cannot drive it out: the only way to force it out of the corner would stalemate it.

```board
fen: k7/8/P7/1K6/8/8/8/8 w - - 0 1
caption: Black's king sits on a8. White can try Kb6, but after ...Kb8 and a7+ Ka8, any further king move either releases Black or gives stalemate. It is a draw.
squares: a8
orientation: white
```

So when you are down a pawn in a pawn ending, it is often worth trading so that your opponent is left with only a rook pawn. And when you are the one ahead, keep the pawn that is not on the edge.

## Winning tricks: outflanking and losing a move

Real pawn endings usually have more than one pawn, and the kings fight over a target. Two ideas appear again and again.

### Distant opposition and outflanking

Opposition also works at a distance: kings on the same file with three or five squares between them, with the other side to move, are in **distant opposition**. If you hold the distant opposition, you can usually turn it into the direct opposition as the kings approach.

A quick way to check distant opposition on a file: count the squares between the kings. If the number is odd (one, three or five) and it is your opponent's move, you have the opposition. If it is even, or it is your move, you do not. The same counting works on ranks.

When direct confrontation does not work, the attacker goes around. **Outflanking** means using the opposition on one side to step past the enemy king on the other side. Here is a typical case with blocked pawns.

```board
fen: 8/3k4/2p5/2P5/4K3/8/8/8 w - - 0 1
caption: White wants the c6-pawn. The c5-pawn takes d6 and b6 away from Black's king. The direct 1.Ke5 Ke7 meets the opposition, but 1.Kf5! goes around.
arrows: e4f5
red: e4e5
orientation: white
```

```line
fen: 8/3k4/2p5/2P5/4K3/8/8/8 w - - 0 1
moves: 1.Kf5 Kc8 2.Ke5 Kc7 3.Ke6 Kb8 4.Kd7
diagram: end
caption: The white king reached e6 and d7. Next comes Kd6 or Kxc6, and the c-pawn falls.
```

If Black answers 1.Kf5 with 1...Ke7, then 2.Ke5! puts Black in zugzwang: the black king must leave, and the white king walks to d6. Notice the trick: White's king went e4–f5–e5, taking two moves to reach e5, so that it arrived there with Black to move.

### Triangulation, simply

That last idea has a name. **Triangulation** means making a small detour (often around three squares in a triangle) to lose a move on purpose, so that a position you want arises with the *opponent* to move. It works when your king has room to manoeuvre and the enemy king does not, because it must stay on a small set of defending squares.

Why can one king lose a move and the other not? Usually because the defending king has only two good squares, and it must answer every attacking move by going to the matching square. The attacking king, with more room, can take a three-move route back to the same square while the defender can only shuttle between two. After the detour, the same position stands on the board, but with the defender to move.

You do not need to memorize triangulation positions at this stage. Remember the question it answers: "This position wins if it were my opponent's move. Can my king waste a move, while theirs cannot?" When the answer is yes, look for a detour.

:::coach Coaching judgment
Club players lose far more pawn endings by ignoring whose move it is than by any lack of theory. Before every move in a pawn ending, ask: "If I play this, who has the opposition?"
:::

## Passed pawns that win pawn endings

When both sides have several pawns, the endgame is decided by the quality of passed pawns. A **passed pawn** has no enemy pawns in front of it on its own or the adjacent files.

### The outside passed pawn

An **outside passed pawn** is a passed pawn far away from the other pawns. Its strength is not that it queens by itself, but that it lures the enemy king away. While the defender's king runs to stop it, your king eats the pawns on the other side.

```board
fen: 8/8/3k2p1/7p/P2K3P/6P1/8/8 w - - 0 1
caption: White's a-pawn is an outside passed pawn. White pushes it, Black's king must go after it, and the white king feasts on the kingside.
arrows: a4a5 d4e5
orientation: white
```

### Worked example: thinking through the outside passer

Let us run the thinking process on the diagram.

First I count material: White has three pawns, Black two. Next I look for the decisive plan, not a single move. The black king is the only defender for both the a-pawn and the kingside pawns, so it cannot do both jobs.

My candidate moves are 1.a5 (push the decoy) and 1.Ke4 (approach the kingside first). Both ideas look good, so I calculate the most forcing one, 1.a5. The natural reply is to go after the pawn: 1...Kc6. Now my king heads for the kingside: 2.Ke5 Kb5 3.Kf6. Black can grab the a-pawn, but it takes time, and the black king is far from the action.

Then I check the race at the end. After my king takes on g6, the h5-pawn falls next, and my h-pawn is much closer to queening than anything Black has. The plan works.

```line
fen: 8/8/3k2p1/7p/P2K3P/6P1/8/8 w - - 0 1
moves: 1.a5 Kc6 2.Ke5 Kb5 3.Kf6 Ka6 4.Kxg6
diagram: end
caption: The decoy worked. White's king has entered Black's pawns and the h5-pawn falls next.
```

### The protected passed pawn

A **protected passed pawn** is a passed pawn defended by another pawn. The enemy king can never take it, so it must keep watching it forever. That ties the defender's king down while your king is free to go anywhere.

```board
fen: 8/8/3k2p1/pP3p1p/P2K3P/6P1/8/8 w - - 0 1
caption: The b5-pawn is passed and protected by a4. Black's king must stay near it, so White's king walks to the kingside (Ke3, Kf4, Kg5) and wins the black pawns.
squares: b5
arrows: d4e3 e3f4 f4g5
orientation: white
```

### The pawn breakthrough

Sometimes a group of pawns can force a passed pawn by sacrifice. The classic case is three pawns against three, facing each other with one rank between them.

```board
fen: 7k/ppp5/8/PPP5/8/8/8/7K w - - 0 1
caption: White to move wins with 1.b6!, a pawn sacrifice that forces open a path for one of White's pawns. The kings are too far away to interfere.
arrows: b5b6
orientation: white
```

```line
fen: 7k/ppp5/8/PPP5/8/8/8/7K w - - 0 1
moves: 1.b6 cxb6 2.a6 bxa6 3.c6
diagram: end
caption: After 3.c6 the c-pawn runs to c8. If 1...axb6, then 2.c6! bxc6 3.a6 works the same way.
```

The pattern to remember: the middle pawn goes first, then the pawn on the side where the capture happened. Breakthroughs also work for the defender's opponent, so when your pawns face a pawn majority, check whether the enemy has one before you let the kings wander away.

## Pawn races: counting tempi

When both sides have passed pawns and the kings cannot catch them, you are in a **pawn race**. Count, do not guess. For each pawn, count the moves to queen. Remember who moves first. Then look one step further: does the new queen give check, or control the other pawn's queening square?

```board
fen: 5k2/8/8/7p/P7/8/8/K7 w - - 0 1
caption: Both pawns need four moves. White moves first, queens on a8 with check, and the new queen also covers h1 along the long diagonal.
arrows: a4a8
squares: a8 h1
orientation: white
```

```line
fen: 5k2/8/8/7p/P7/8/8/K7 w - - 0 1
moves: 1.a5 h4?! 2.a6 h3 3.a7 h2 4.a8=Q+
caption: White queens with check, and after the king moves, Qxh1 or simply covering h1 stops the black pawn. Black's best was to give up the race, but the result is the same.
```

Counting races is also how you decide *whether* to race at all. Sometimes the right move is not to push your own pawn but to bring your king one step closer to the enemy pawn first, entering its square, and only then run. Compare the two plans by counting both: how many moves until each side queens, and can either king catch the other pawn along the way? If both pawns queen, ask what the resulting queen ending looks like; an extra pawn or a queen that arrives with check usually decides it.

:::mistake Forgetting the second step
Counting "who queens first" is not enough. Check whether the first new queen gives check or controls the other pawn's queening square, and whether the other pawn can queen with check. One extra tempo there flips the result.
:::

## Trading into a pawn ending

Everything in this chapter leads to one practical decision. You are in a rook or minor-piece ending and you have the chance to trade the last pieces. Should you?

Pieces give counterplay; pawn endings are pure. If you are winning the pawn ending, trading is usually the cleanest way to convert, and it removes all your opponent's tricks. If the pawn ending is a draw or a loss, trading throws away every chance you had. So the rule is: **trade into a pawn ending only when you have calculated it**, at least to the point where you can name the plan that wins (outside passer, protected passer, better king, opposition).

Your quick checklist before the trade:

1. After the trade, whose king is closer to the centre and to the pawns?
2. Does anyone get an outside or protected passed pawn?
3. Count any pawn race with the square and with tempi.
4. Who will have the opposition when the kings meet?

If you cannot answer these, keep the pieces and look for another way. Defending players should apply the same test in reverse: do not trade into a pawn ending just because you are tired of defending. You can see that in action in [Chapter 17](#ch-17).

## Finding these ideas in your own games

Pawn endings in your own games rarely look like textbook diagrams at first. They usually arise from a rook or minor-piece ending a few moves earlier, which is exactly where the important decision was made. When you analyze a game that reached a pawn ending, go back to the moment of the last trade and ask three questions.

* **Was the trade calculated?** Did you (or your opponent) know the pawn ending was won, or was it a hopeful swap?
* **Where did the tempo go?** Find the first move where a king went to the wrong side, or a pawn was pushed while the king was still behind it. In most lost pawn endings there is exactly one such moment.
* **Which pattern was hiding?** Square, opposition, rook pawn, outside passer, breakthrough. Name it and record it in your mistake journal under "endgame".

A useful habit during the game: whenever only kings and pawns are left, slow down. The position is simple enough that a few minutes of counting will usually tell you the truth, and one careless move can never be repaired.

## Practice at the board

Pawn endings are ideal for practice because a friend, a coach or a free engine can play the other side. Set up each position, play it out several times with both colours, and check your result.

* **Opposition drill.** Set up `8/4k3/8/4K3/4P3/8/8/8 w - - 0 1`. Play it with Black to move (White should win) and with White to move (Black should draw). Switch sides. Do it until you win and draw it without thinking.
* **Square drill.** Set up `8/6k1/8/p7/5K2/8/8/8 w - - 0 1`. Before moving, say aloud whether the king catches the pawn. Then move the white king one square further away and test again.
* **Rook pawn.** Set up `k7/8/P7/1K6/8/8/8/8 w - - 0 1` and try to win as White against an engine. You will not, and you will see why.
* **Outflanking.** Set up `8/3k4/2p5/2P5/4K3/8/8/8 w - - 0 1` and win the c6-pawn against a defender. Then try it after 1.Ke5 to feel the difference.
* **Breakthrough.** Set up `7k/ppp5/8/PPP5/8/8/8/7K w - - 0 1` and play 1.b6. Try every Black reply.
* **Outside passer.** Set up `8/8/3k2p1/7p/P2K3P/6P1/8/8 w - - 0 1` and win it against an engine set to full strength.

To check yourself, use an engine or an endgame tablebase after you finish, not during. Write down any position where your result differed from the correct one and replay it the next day.

## Chapter summary

* In pawn endings the king is a fighting piece: centralize it and lead with it.
* The rule of the square tells you instantly whether a king catches a lone passed pawn.
* In king and pawn against king, the attacker wins by reaching a key square; the defender draws by staying in front and taking the opposition.
* Rook pawns are usually drawn if the defending king reaches the corner.
* When direct opposition fails, outflank; when you need the opponent to move, look for a way to lose a move (triangulation).
* Outside and protected passed pawns win pawn endings by tying the enemy king down; three against three can be broken through with the middle pawn.
* In races, count the moves, remember who moves first, and check whether a queen arrives with check or covers the other queening square.
* Trade into a pawn ending only when you have calculated it.

:::cheat Pawn ending procedure
1. Count: material, passed pawns, and the square of every passed pawn.
2. Kings first: bring your king towards the centre and in front of your pawns.
3. Name the key squares and ask who has the opposition with the move.
4. Look for a decoy (outside passer), a breakthrough, or a protected passer.
5. In a race, count tempi including checks and control of the queening squares.
6. Before trading into a pawn ending, run steps 1-5 on the position after the trade.
:::

@exercises
