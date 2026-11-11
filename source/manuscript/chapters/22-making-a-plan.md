---
chapter: 22
slug: making-a-plan
title: Making a Plan
subtitle: What to do when there is nothing to calculate
part: 4
stage: "1000–1200"
skills: [planning, evaluation, prophylaxis, pawn-structure, piece-activity]
objectives:
  - Evaluate a position with a short checklist instead of a vague feeling.
  - Find targets: weak pawns, weak squares, bad pieces and an exposed king.
  - Choose a plan from the pawn structure, and improve your worst piece.
  - Ask "What does my opponent want?" and stop it when it matters (prophylaxis).
  - Make short, concrete plans of two or three moves, and change them when the position changes.
next_game: When there is no tactic for either side, run the evaluation checklist, name your worst piece and your opponent's main idea, and choose a move that improves the first or stops the second.
---

You have castled, developed your pieces, and checked for tactics. Nothing hangs. Nobody threatens anything. Now what? Many players at this level freeze here, or they play a "random sensible move," or they launch an attack that the position does not support. A few moves later they are worse and do not know why.

This chapter gives you a way to decide what to do in quiet positions. It is not magic and it is not a twenty-move master plan. It is a short routine: evaluate, find targets, read the pawn structure, improve your worst piece, and check what your opponent wants. Masters do this almost automatically. You can learn to do it deliberately, and with practice it becomes quick.

## What a plan is (and is not)

A **plan** is a short sequence of moves with a purpose: "put my knight on f5," "push b4 and b5 to weaken the c6-pawn," "trade my bad bishop." A good plan comes *from the position*: it uses something that is already there, such as a weak pawn, an open file or a badly placed enemy piece.

A plan is not a dream. "I will attack the king, sacrifice on h7 and mate him" is not a plan if the pieces are not there and the position does not ask for it. At club level the most useful plans are **two or three moves long**. You make the plan, play it, then look again.

:::key Short plans beat long dreams
Coaching judgment: a 2–3 move plan that improves your position is worth far more than a 20-move scheme. Positions change every time your opponent moves. Plan a little, then re-evaluate.
:::

## Step 1: Evaluate with a checklist

To make a plan you first need to know what is going on. Instead of a vague "I think I'm fine," walk through a fixed list. This is your **evaluation checklist**:

1. **Material.** Count it (see [Chapter 3](#ch-03)). Is anyone ahead? Is there an imbalance, such as bishop against knight?
2. **King safety.** Whose king is more exposed? Are there holes or open files near either king? (See [Chapter 21](#ch-21).)
3. **Piece activity.** Which pieces are active, and which are passive or blocked? Which is each side's worst piece? (See [Chapter 19](#ch-19).)
4. **Pawn structure.** Isolated, doubled, backward or passed pawns? Pawn majorities? Which pawn breaks are possible? (See [Chapter 20](#ch-20).)
5. **Space.** Whose pawns are further advanced, giving more room behind them?
6. **Files and key squares.** Who controls the open files, the important diagonals, and the squares that pawns can no longer guard?
7. **Threats.** What does each side threaten *right now*?

The last item is a safety check. If there is a threat or a tactic, deal with it first: tactics come before strategy. The checklist is for positions where your safety scan ([Chapter 4](#ch-04)) finds nothing urgent.

```board
fen: r1bqr1k1/pp2bpp1/2n2n1p/3p4/3N4/2N1B1P1/PP2PPBP/R2Q1RK1 w - - 2 12
caption: Run the checklist. Material is equal and both kings are safe, but Black has an isolated pawn on d5. White's pieces aim at it, and the d4-square in front of it is a perfect home for a white piece.
arrows: g2d5 c3d5 d4c6
squares: d5 d4
```

Here is the checklist in action:

* **Material:** equal.
* **King safety:** both kings are castled and safe.
* **Activity:** both sides are well developed. White's bishop on g2 already presses on d5.
* **Pawn structure:** Black has an **isolated pawn** on d5 (a pawn with no friendly pawns on the neighbouring files). It cannot be defended by another pawn, and the square in front of it, d4, can never be attacked by a black pawn.
* **Space:** roughly equal; Black's d-pawn gives a little central space.
* **Files and squares:** the c-file is open, and White can use it; d4 belongs to White.
* **Threats:** none for either side.

The verdict: the position is balanced, with a small, lasting edge for White because of the target on d5 and the square on d4. That verdict already suggests a plan: keep a piece on d4, put a rook on the c-file, and line up more pieces against d5. The engine's favourite move here is Rc1, taking the open file, which fits that plan.

:::mistake Skipping the checklist and "just playing"
Many games are lost not by blunders but by a series of moves without a purpose. If you cannot say in one sentence why you are playing a move, you probably skipped the evaluation. Run the seven items, even quickly. In your own games, look for stretches of three or four moves where you could not explain your idea afterwards.
:::

## Step 2: Find the targets

A plan usually means attacking something. Strategic targets are the long-term weaknesses in the enemy camp. There are four main kinds.

### Weak pawns

A **weak pawn** is one that cannot easily be defended by another pawn and can be attacked by pieces: isolated pawns, backward pawns (a pawn that has fallen behind its neighbours and cannot safely advance), and doubled pawns. Weak pawns are good targets because the opponent must defend them with pieces, and pieces that defend are not doing anything else.

### Weak squares

A **weak square** (or **hole**) is a square that the opponent's pawns can no longer attack. A knight that lands on such a square, especially in the centre or near the enemy king, is often worth more than a rook there.

```board
fen: r2q1rk1/1p1nbppp/p2pbn2/4p3/4P3/1NN1B3/PPP1BPPP/R2Q1RK1 w - - 0 11
caption: Black's pawns on d6 and e5 can no longer cover d5, so d5 is a hole, and the d6-pawn is backward. White's plan writes itself: control d5, put a piece there, and keep Black from playing ...d5.
arrows: c3d5 e4d5
squares: d5 d6
```

In this structure White's pieces are drawn to d5. If a white knight lands there and cannot be removed, Black will be passive for a long time. Black, for his part, wants the freeing move ...d5, which would remove both weaknesses at once. That is the key to the position: one side wants d5, the other wants to play ...d5.

### Bad pieces

A **bad piece** is one that has no good squares and little prospect of finding any. The classic example is the **bad bishop**: a bishop blocked by its own pawns, which stand on squares of the bishop's colour.

```board
fen: r1b2rk1/pp1nbppp/1qn1p3/2ppP3/3P4/2PB1N2/PP1N1PPP/R1BQ1RK1 w - - 0 9
caption: Black's bishop on c8 is hemmed in by its own pawns on e6 and d5, all on light squares. White's light-squared bishop on d3, by contrast, has an open diagonal towards Black's king.
arrows: d3h7
red: c8e6
squares: c8 e6 d5
```

When the opponent has a bad piece, try to keep it bad: do not trade it, and do not open the position for it. When *you* have a bad piece, either improve it (bring it outside the pawn chain, or break the chain with a pawn move) or trade it for one of the opponent's good pieces.

### An exposed king

Holes and open lines near the king are long-term targets too. Pawn moves in front of your own castled king create squares that can never be covered by pawns again.

```board
fen: r1bq1rk1/bpp2p2/p1np1n1p/4p1p1/4P3/1BPP1NB1/PP1N1PPP/R2Q1RK1 w - - 0 11
caption: Black's ...h6 and ...g5 chased White's bishop but left holes on f5 and h5. They are long-term targets: a white knight on f5 would be a thorn next to Black's king.
arrows: d2f1 f1e3 e3f5
squares: f5 h5
```

No attack is possible right now, and the engine rates the position as only slightly better for White. But the holes will not go away. White's plan for the next few moves is clear: reroute a knight towards f5 and see whether Black can ever challenge it.

:::nextgame Name the target
In your next game, at the first quiet moment, finish this sentence aloud in your head: "The biggest weakness in my opponent's position is ____." If you cannot name one, look for your own worst piece instead (Step 4).
:::

## Step 3: Let the pawn structure suggest the plan

Pawns are the slowest pieces and the hardest to move back, so the pawn structure changes slowly. That makes it a reliable guide to planning. Here are a few classic pairings of structure and plan. They are guidelines, not laws: tactics and piece placement can always override them.

| Structure | Typical plan |
|---|---|
| Opponent has an isolated pawn | Blockade the square in front of it, trade pieces, attack the pawn |
| You have a pawn majority on one wing | Advance it to create a passed pawn |
| Opponent's pawns on one wing are fewer but healthy (Carlsbad, see below) | Minority attack: advance your smaller group to create a weakness |
| Locked centre | Play where your pawns point: attack on the side where you have more space |
| Hole in the opponent's camp | Put a knight there |
| Open file | Put a rook on it, double rooks, aim for the seventh rank |

The Carlsbad structure (named after a well-known tournament town where it was often seen) is the clearest example of a structure that dictates a plan.

```board
fen: r1bqrnk1/pp2bppp/2p2n2/3p2B1/3P4/2NBPN2/PPQ2PPP/R4RK1 w - - 8 11
caption: The Carlsbad structure: White's d4/e3 against Black's d5/c6. White's standard plan is the minority attack: b4 and b5, exchanging on c6 to leave Black with a weak pawn.
arrows: b2b4 b4b5
squares: c6 d5
```

White has two queenside pawns (a and b) against Black's three (a, b and c). Why would the smaller group attack? Because when White plays b5 and exchanges on c6, Black is left with either an isolated d5-pawn or a backward c6-pawn on a half-open file. A weak pawn has been *created* where none existed.

```line
fen: r1bqrnk1/pp2bppp/2p2n2/3p2B1/3P4/2NBPN2/PPQ2PPP/R4RK1 w - - 8 11
moves: 11.Rab1 Ng6 12.b4 a6 13.a4 Ne4 14.Bxe7 Qxe7
check: engine
caption: White prepares b5 with Rab1, b4 and a4. Black's ...a6 is prophylaxis against b5, and ...Ne4 looks for counterplay in the centre.
```

Exercise 22-02 asks you to find this plan, and Exercise 22-07 shows Black's prophylactic answer.

## Step 4: Improve your worst piece

When you cannot find a target, or you are not sure what to do, use the most practical planning question in chess:

> **Which of my pieces is doing the least, and how can I improve it?**

This idea is widely taught and works at every level. Your position is only as strong as your weakest piece. A rook still on its starting square, a knight on the rim, a bishop staring at its own pawns: each of these is a whole piece you are not using.

```board
fen: r1bqr1k1/bpp2pp1/p1np1n1p/4p3/4P3/1BPP1N1P/PP1N1PP1/R1BQR1K1 w - - 2 11
caption: White's worst piece is the knight on d2, which blocks the c1-bishop. The standard Italian manoeuvre Nf1-g3 (or e3) brings it to the kingside, where it eyes f5.
arrows: d2f1 f1g3 g3f5
squares: d2
```

How to execute it:

1. List your pieces and give each a quick grade: active, OK or poor.
2. Pick the poorest one and find its best realistic square: one where it attacks something, controls a key square or defends something important.
3. Find the route, square by square, and check that each step is tactically safe.

What commonly goes wrong: you move your *best* piece again because it is the one you are looking at. A knight that is already on a great square does not need another move. Moves with the passive pieces are usually the ones that improve your position most.

### "Do nothing" moves that improve

Sometimes the best move is a small one that does not change the structure: a king step to safety, a rook to a better file, a pawn move that gives the king **luft** (an escape square, so that back-rank mates are no longer possible), or a quiet retreat that prepares a manoeuvre. These moves look like "doing nothing," but they make every later plan stronger.

:::coach Patience is a skill
Coaching judgment: at this level, the player who is happy to make a quiet improving move, rather than forcing the action, usually ends up with the better position. If the position does not call for action, improve a piece and wait for your opponent to create a weakness.
:::

## Step 5: Prophylaxis — what does my opponent want?

**Prophylaxis** means preventing your opponent's plan before it happens. The idea was developed and popularised by Aron Nimzowitsch in the early twentieth century, and it is one of the most important habits a strategic player can have.

The procedure is a single question, asked every move in quiet positions:

> **If it were my opponent's move right now, what would they play?**

If their best move would hurt you, consider stopping it first. If it would not, carry on with your own plan.

```board
fen: r1bq1rk1/bpp2ppp/p1np1n2/4p3/4P3/1BPP1N2/PP3PPP/RNBQR1K1 w - - 2 9
caption: If it were Black's move, ...Ng4 (hitting f2 together with the a7-bishop) or ...Bg4 (pinning the f3-knight) would be annoying. The quiet h3 rules out both and gives the king luft. The engine rates it among White's best moves.
arrows: h2h3
red: f6g4 c8g4
squares: g4
```

Prophylaxis is not passivity. A good prophylactic move often improves your own position at the same time: h3 here also makes the later Nbd2-f1-g3 manoeuvre safe. The best prophylactic moves are the ones that **stop the opponent's idea and fit your own plan**.

What commonly goes wrong:

* Ignoring the question. You play your plan, your opponent plays his, and his was faster.
* Overdoing it. You stop every possible idea and never make progress. Stop the opponent's *main* idea, then return to your plan.

Exercises 22-06, 22-07 and 22-11 are all about asking this question. In two of them, the opponent's idea is a concrete threat that only one move stops.

## Imbalances: what makes the two sides different

Another useful way to plan is to list the **imbalances**: the differences between White's and Black's positions. Material, minor pieces (bishop or knight), pawn structure, space, development, open files, king safety, the initiative. This way of thinking has been popularised especially by the American author and coach Jeremy Silman.

The point is that a plan should use *your* favourable imbalances. If you have the bishop and your opponent has the knight, open the position. If you have the knight and he has a bad bishop, keep the position closed and find an outpost. If you have more space, avoid exchanges, because the side with less space is cramped and wants to trade. If your opponent has a lead in development, keep the position closed until you catch up.

:::key Imbalances in one question
"What do I have that my opponent does not, and how do I make it matter?" The answer is usually your plan.
:::

## When the position changes, change the plan

A plan is a tool, not a promise. Every time your opponent changes the pawn structure, trades a piece or creates a threat, run the checklist again. Good players change plans without regret.

Typical moments to re-evaluate:

* A pawn break opens or closes the centre.
* A piece trade removes the piece your plan depended on (for example, your opponent trades your good knight).
* Your opponent creates a weakness of his own somewhere else.
* A tactic appears.

The Carlsbad structure shows a typical switch. White's minority attack is a good plan while Black's pawns stand on c6 and d5. But in the line shown in Step 3, Black answered with ...Ne4, and once White exchanges on e4 the pawn structure changes, and so must the plan.

```line
fen: r1b1r1k1/1p2qppp/p1p3n1/3p4/PP1Pn3/2NBPN2/2Q2PPP/1R3RK1 w - - 0 15
moves: 15.Bxe4 dxe4 16.Nd2
check: engine
diagram: end
caption: After the exchanges on e4 the d5-pawn has gone, so the old target has changed. The knight and the queen on c2 now both hit the e4-pawn, Black must defend it (the engine's choice is ...f5), and White's new plan is to press against e4 and use the open d-file and the c5-square.
```

Nothing was wrong with White's first plan. The position changed, and the checklist produced a new one.

## Worked example: planning a quiet Italian

Let us put the whole routine together. This is the Giuoco Pianissimo from your White repertoire ([Chapter 12](#ch-12)), after 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O 7.Re1 a6 8.Bb3 Ba7. White is to move (see the diagram in Step 5).

**First I check for tactics.** Checks, captures, threats: none for White. If it were Black's move, ...Ng4 would attack f2 twice (knight and bishop), and ...Bg4 would pin my knight. Neither is deadly, but both are annoying.

**Now the checklist.** Material: equal. King safety: both castled, both fine. Activity: my b1-knight and c1-bishop are undeveloped; Black's c8-bishop is too. Pawn structure: symmetrical and closed; no weaknesses yet. Space: equal. Files: no open files. Threats: none.

**Targets.** None in Black's camp yet. That means the plan will be about *improvement*, not attack.

**Worst piece.** The knight on b1. Its best realistic square is g3 (via d2 and f1), where it eyes f5 and h5 and defends my king. The route is safe.

**Opponent's idea.** ...Ng4 or ...Bg4. A quiet h3 stops both.

**Candidate moves.** h3 (prophylaxis plus luft), Nbd2 (start the manoeuvre at once), and perhaps d4 (a central break). The opponent's best reply to d4 is ...Bg4 with pressure on d4, and Black is comfortable. h3 first and Nbd2 next fits all my answers.

```line
fen: r1bq1rk1/bpp2ppp/p1np1n2/4p3/4P3/1BPP1N2/PP3PPP/RNBQR1K1 w - - 2 9
moves: 9.h3 h6 10.Nbd2 Re8 11.Nf1 Be6 12.Bc2
check: engine
diagram: end
caption: A two-step plan carried out: prophylaxis with h3, then the knight heads for g3. White keeps the bishop with Bc2. Now Black's ...d5 break is the critical question (Exercise 22-03).
```

Notice how short each plan was. h3 and the first two steps of Nbd2-f1-g3 took three moves. Meanwhile the position changed (Black's bishop came to e6, offering a trade on b3), so White re-evaluated and chose Bc2 to keep the bishop. The knight will finish its journey to g3 next. That is planning at club level: a few purposeful moves, then look again.

:::evidence Plans and pattern knowledge
Research on chess expertise suggests that strong players recognise familiar structures quickly and retrieve typical plans for them, rather than calculating everything from scratch. The classic studies are Adriaan de Groot's *Thought and Choice in Chess* (1965, English edition) and William Chase and Herbert Simon's "Perception in Chess" (*Cognitive Psychology*, 1973). Practical consequence: learning a handful of standard structures and their plans pays off in many games.
:::

## How to find planning mistakes in your own games

After each game, look for the quiet moments, not just the blunders:

* Find two or three moves where nothing tactical was happening. Could you say what your plan was?
* Ask: what was my worst piece at that moment? Did I improve it?
* Ask: what did my opponent want? Did I let him do it for free?
* Use an engine afterwards to see which plans it preferred, but write down the *idea*, not just the move. "Engine wanted b4 here: minority attack" is a lesson; "engine wanted b4" is not.

Record planning errors in your mistake journal under *positional*.

## Practice at the board

1. **Checklist drill.** Set up `r1bqr1k1/pp2bpp1/2n2n1p/3p4/3N4/2N1B1P1/PP2PPBP/R2Q1RK1 w - - 2 12` (the isolated-pawn position). Write the seven checklist items on paper in under three minutes. Then compare with the evaluation in this chapter and with an engine's top three moves.
2. **Worst-piece drill.** Set up `r1bqr1k1/bpp2pp1/p1np1n1p/4p3/4P3/1BPP1N1P/PP1N1PP1/R1BQR1K1 w - - 2 11`. Grade every white piece as active, OK or poor, then find a route for the poorest piece. Check with the engine whether its first choice matches your piece.
3. **Prophylaxis drill.** In any position from your own games, before each move, play "your opponent's move" on the board first (give him a free move). What did he do? Was it dangerous? Then put the pieces back and decide whether to prevent it.
4. **Structure drill.** Set up the Carlsbad position `r1bqrnk1/pp2bppp/2p2n2/3p2B1/3P4/2NBPN2/PPQ2PPP/R4RK1 w - - 8 11` and play the minority attack against an engine at a moderate level. Your goal is simply to create a weak black pawn on the queenside and attack it.
5. **Play.** In your next three games, write your plan in two or three words on your scoresheet (or in your head) at move 15: "knight to f5," "minority attack," "rook to c-file." Check after the game whether you followed it, and whether it was right.

## Chapter summary

* A plan is a short, purposeful sequence of moves that uses something already in the position; aim for 2–3 moves, then re-evaluate.
* Evaluate with the checklist: material, king safety, activity, pawn structure, space, files and key squares, threats.
* Look for targets: weak pawns, weak squares, bad pieces and an exposed king.
* Let the pawn structure suggest the plan; standard structures have standard plans.
* When in doubt, improve your worst piece; quiet improving moves are often the strongest.
* Prophylaxis: ask what your opponent wants and stop his main idea, ideally with a move that also helps your plan.
* List the imbalances and play to make your favourable ones matter.
* When the position changes, change the plan.

:::cheat Planning procedure for quiet positions
1. Safety first: checks, captures and threats for both sides. Tactics before strategy.
2. Run the checklist: material, kings, activity, pawns, space, files/squares, threats.
3. Name one target in your opponent's camp (weak pawn, hole, bad piece, exposed king).
4. If there is no target, name your worst piece and find it a better square.
5. Ask "What does my opponent want?" and stop it if it hurts you.
6. Choose a 2–3 move plan that fits the pawn structure; re-evaluate after each change.
:::

@exercises
