---
chapter: 4
slug: safety-scan
title: "The Safety Scan: Checks, Captures, Threats"
subtitle: The habit that stops you giving pieces away
part: 1
stage: "400–600"
skills: [hanging-pieces, threats, blunder-check]
objectives:
  - Ask three questions about every move your opponent makes - what does it attack, what does it no longer defend, what line did it open.
  - Find hanging pieces, both yours and your opponent's, before you choose a move.
  - Scan checks, captures and threats for both sides in a fixed order.
  - Run a blunder check on your chosen move before you let go of the piece.
  - Turn the five-question pre-move checklist into a habit.
next_game: After every move your opponent makes, ask "What does it attack, what does it no longer defend, what line did it open?" and before you release your own piece, ask "After this move, what can my opponent capture or check?"
---

Look at almost any game between two players rated around 500 and you will find the same story. Someone leaves a piece where it can be taken for free. Sometimes the opponent takes it; often they do not notice, and two moves later the first player hangs something else. The game is decided not by a plan or a clever combination but by who stops giving material away first.

This chapter teaches the single most valuable habit in chess below 1000: the **safety scan**. It is a short, fixed routine you run every move. It does not require talent or memorised theory, only discipline. Players who run it honestly every move usually find that their results change faster than from any other single improvement. Learn it here, and every later chapter will build on it.

## Why games are lost below 800

At this level most decisive mistakes fall into a few families. A piece is left **hanging** (it can be captured and nobody can recapture). A threat by the opponent is not seen until it is carried out. A move is played without asking what it allows. None of these is a lack of knowledge; you already know how the pieces move. They are lapses of attention.

That is good news, because attention can be trained with a routine. Strong players are not superhuman. They have simply asked the same few questions so many thousands of times that the questions run automatically. Your job in this chapter is to start asking them on purpose, slowly, until they become automatic for you too.

:::coach A note on what to expect
This is coaching judgment, not a measured result: most players who start running a safety scan every move find that their games get longer and their blunders get rarer within a few weeks. The first games will feel slow and awkward. That is normal. You are building a habit, and habits are slow at first.
:::

## Step one: the three questions about your opponent's move

Every move your opponent makes changes the position. Before you think about your own ideas, find out what changed. Three questions cover almost everything:

1. **What does it attack?** Which of your pieces, pawns or squares can the moved piece now capture or hit?
2. **What does it no longer defend?** The piece left a square. What was it guarding there that is now unprotected?
3. **What line did it open?** When a piece or pawn moves, the file, rank or diagonal behind it may open for another piece. What can now see further than before?

Most beginners ask only the first question, and only sometimes. The second and third questions catch the threats that "come from nowhere".

### What does it attack?

```board
fen: r1bqk2r/pppp1ppp/2n2n2/2b1p3/2BPP3/2P2N2/PP3PPP/RNBQK2R b KQkq - 0 5
caption: After 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d4, White's last move attacks the bishop on c5 and the pawn on e5 at the same time.
red: d4c5 d4e5
orientation: black
```

Here the answer to question one is easy to find if you look: the pawn on d4 attacks two things. The usual reply is 5...exd4, removing the attacker. A player who skips the question and plays a "plan" move such as 5...O-O simply loses a piece after 6.dxc5. The opponent's move is the first thing you look at, every time.

### What does it no longer defend?

```board
fen: r1bqkbnr/1pp2ppp/p1p5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5
caption: After 3.Bb5 a6 4.Bxc6 dxc6, the knight that defended e5 has gone. Is 5.Nxe5 a free pawn?
squares: e5
blue: f3e5
```

When White exchanged on c6, the black knight that guarded e5 disappeared. Asking "what is no longer defended?" reveals that the e5-pawn now hangs. But the scan does not stop there. Before taking, White must ask what Black can do in reply:

```line
fen: r1bqkbnr/1pp2ppp/p1p5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5
moves: 5.Nxe5?! Qd4 6.Nf3 Qxe4+ 7.Qe2 Qxe2+ 8.Kxe2
check: engine
diagram: end
caption: Black's queen attacks the knight and the e4-pawn at once, wins the pawn back, and White's king has lost the right to castle.
```

The same question works for your own pieces. When you move a piece, ask what it was guarding before. Many hanging pieces at club level were safe a move earlier, until their only defender wandered off.

### What line did it open?

```board
fen: r1bqk2r/ppp2ppp/2n2n2/3p4/2BPP3/5N2/PP1N1PPP/R2QK2R w KQkq - 0 9
caption: In the Giuoco Piano, 8...d5 attacks the bishop on c4 and the e4-pawn, and it also opens the c8-bishop's diagonal toward g4.
red: d5c4 d5e4
arrows: c8g4
```

A pawn move can attack something directly and, at the same time, unblock a piece behind it. Here 8...d5 hits c4 and e4 and frees the bishop on c8. White's usual answer is 9.exd5 Nxd5, and both sides are fine. A beginner who only noticed "the pawn attacks my bishop" might retreat the bishop and leave e4 hanging.

Discovered lines are dangerous because the piece that does the attacking did not move. Your eyes follow the piece that moved, and the bishop or rook in the background slips past them. Train yourself to look *behind* the moved piece: along the file, rank or diagonal it was standing on.

:::key The three questions
After every opponent move, ask in this order:
1. What does it attack?
2. What does it no longer defend?
3. What line did it open?
Answer all three before you think about your own plans.
:::

## Hanging pieces: yours and theirs

A piece is **hanging** (also called *en prise*) when it can be captured and the capture wins material. The simplest case is a completely undefended piece under attack. A subtler case is a piece defended once but attacked twice, or a piece defended only by something more valuable than its attacker. [Chapter 3](#ch-03) taught you to count attackers and defenders; this chapter makes you do it every move.

### Undefended means target

A piece that has no defender at all is called **loose**. Loose pieces are not hanging yet, because nothing attacks them. But they are the first things to fall when a forcing move appears, because a single check or threat can attack them together with something else. Coaches use a short slogan for this: **loose pieces drop off**.

```board
fen: r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R b KQkq - 0 4
caption: The Evans Gambit, 4.b4. The pawn on b4 is attacked by the bishop and the knight and defended by nothing. It is a deliberate gambit, but the scan must still notice it.
squares: b4
red: c5b4 c6b4
orientation: black
```

In this position White has offered a pawn on purpose, and Black may take it with 4...Bxb4. The point is not this opening; it is the method. Before you move, list your opponent's undefended pieces and pawns, and list your own. Loose pieces are targets for both sides.

A quick way to see them: run your eyes over each piece and ask "if this were captured, could I (or they) take back?" With practice this takes a few seconds per side.

### Your own hanging pieces

Beginners spot their opponent's hanging pieces more easily than their own, because they are hunting. Reverse the habit: the first scan is defensive. After your opponent moves, look at each of your own pieces and ask whether it is attacked and how often it is defended. If something is hanging, deal with it now: move it, defend it, or make a bigger threat.

:::mistake Reacting to the attack and missing the attacker
When your piece is attacked, first check whether you can simply take the attacker. In many club games a knight jumps forward to attack a bishop, the bishop's owner retreats it at once, and nobody notices that the knight was standing on a square defended by a pawn. Ask "can I capture the piece that is attacking me?" before you retreat.
:::

## The forcing-move scan

A **forcing move** is a move that limits your opponent's replies: a **check** (they must answer it), a **capture** (they usually want to recapture), or a **threat** (a move that will win something next turn if ignored). Forcing moves are where tactics live. If there is a winning combination in a position, it almost always starts with one of them.

The forcing-move scan is simple to state: **list every check, every capture and every serious threat, for both sides.** In that order: checks first because they are the most forcing, then captures, then threats.

### Your forcing moves

For your own side, look at each check, even silly ones. Most will be useless, but the one that also attacks a loose piece, or drives the king to a bad square, is the one you are looking for. Then look at every capture and count it out. Then look for moves that create a threat: attacking an undefended piece, threatening mate, or attacking a piece with something less valuable.

```board
fen: rn1qkb1r/ppp2ppp/3p1n2/4p3/2B1P1b1/1QP2N2/PP1P1PPP/RNB1K2R b KQkq - 2 5
caption: After 1.e4 e5 2.Nf3 d6 3.Bc4 Bg4 4.c3 Nf6 5.Qb3, White threatens both Qxb7 and Bxf7+. The bishop left c8, so b7 lost its only defender.
red: b3b7 c4f7
squares: b7 f7
orientation: black
```

The threat scan finds two loose targets for one queen move. Black's best answer is the counter-attack 5...d5, which blocks the bishop's line to f7. A natural developing move fails:

```line
fen: rn1qkb1r/ppp2ppp/3p1n2/4p3/2B1P1b1/1QP2N2/PP1P1PPP/RNB1K2R b KQkq - 2 5
moves: 5...Nc6? 6.Bxf7+ Ke7 7.Qxb7
check: engine
caption: Black loses two pawns and the king is stuck in the centre. Two threats at once are hard to meet with an ordinary move.
```

### Your opponent's forcing moves

Do the same from your opponent's side of the board. What checks do they have right now? What captures? What are they threatening? This is the part of the scan that prevents disasters. If your opponent has a check that forks your king and rook, you need to know it *before* you start a slow plan.

:::key Checks, captures, threats - both sides
1. My checks, my captures, my threats.
2. Their checks, their captures, their threats.
If a forcing move wins material for you, look at it first. If one wins material for them, deal with it first.
:::

### When there is nothing forcing

Often the scan finds nothing: no captures that win, no checks that matter, no threats. That is valuable information too. It means you are free to play a good normal move: develop, castle, improve your worst piece, or put a rook on an open file. Do not invent violence when the position is quiet. Many beginners lose because they launch an attack that is not there and leave pieces behind.

## The blunder check: before you let go

You have scanned the position and chosen a move. One step remains, and it is the step that saves the most games: the **blunder check**. Before you release the piece (or click the mouse), look at the position *after* your move and ask:

> **After my move, what can my opponent capture or check?**

Your move changes the position. It may leave a piece undefended, open a line toward your king, or put a piece on a square where it can be attacked. The scan you ran a minute ago was for the old position. The blunder check is a fresh, short scan of the new one, from your opponent's side.

:::mistake The "obvious" move
The most dangerous move is the one that feels obvious: an automatic recapture, a pawn push that "kicks" a piece, a capture of a free-looking pawn. Because it feels obvious, you skip the check. Make a rule for yourself: the more obvious the move looks, the more carefully you check it.
:::

## A worked example: the knight on g4

Here is the whole routine on one position from a typical Italian Game. Black has just played 9...Ng4. You are White.

```board
fen: r1bq1rk1/bpp2ppp/p1np4/4p3/4P1n1/1BPP1N2/PP1N1PPP/R1BQR1K1 w - - 4 10
caption: Black's last move 9...Ng4 attacks f2, together with the bishop on a7. What should White do?
red: g4f2 a7f2
squares: f2
```

**First, the three questions.** What does 9...Ng4 attack? It hits f2 and h2. The bishop on a7 also aims at f2, so f2 is attacked twice. What does it no longer defend? The knight left f6, so e4 and h7 are less protected, but nothing hangs right now. What line did it open? The d8-queen now sees all the way to h4 along the diagonal; ...Qh4 or ...Qf6 may come later.

**Second, count f2.** Attacked twice (knight and bishop), defended once (the king). The rook on e1 does not defend f2. So Black is threatening 10...Nxf2 or 10...Bxf2+, winning a pawn and wrecking the king's cover. You must do something about it.

**Third, candidate moves.** The natural move is 10.h3, "kicking" the knight. Other ideas are 10.Re2, which defends f2, 10.Rf1, which also defends it, and 10.d4, which blocks the bishop's diagonal toward f2.

**Fourth, the blunder check on 10.h3.** After h3, what can Black capture or check? The knight can capture on f2 anyway. Now f2 is defended only by the king, and the knight on f2 attacks your queen on d1 and the pawns on d3 and h3:

```line
fen: r1bq1rk1/bpp2ppp/p1np4/4p3/4P1n1/1BPP1N2/PP1N1PPP/R1BQR1K1 w - - 4 10
moves: 10.h3? Nxf2! 11.Qe2 Nxd3+ 12.Kh1 Nxe1
check: engine
diagram: end
caption: The "kick" fails. After White recaptures on e1, Black has won a rook and two pawns for the knight, and White's king is exposed.
```

So 10.h3 is a blunder. What about 10.d4? After 10...exd4 White's centre falls apart and f2 is still weak; the engine rates it clearly worse for White. Now check **10.Re2**:

```line
fen: r1bq1rk1/bpp2ppp/p1np4/4p3/4P1n1/1BPP1N2/PP1N1PPP/R1BQR1K1 w - - 4 10
moves: 10.Re2 Kh8 11.h3 Nh6 12.d4
check: engine
caption: The rook defends f2 a second time. Only then does h3 come, and the knight has to retreat to the edge.
```

**Fifth, the opponent's strongest reply.** After 10.Re2, Black's checks: none. Captures: the knight can still take on f2, but now the count has changed.

```line
fen: r1bq1rk1/bpp2ppp/p1np4/4p3/4P1n1/1BPP1N2/PP1NRPPP/R1BQ2K1 b - - 5 10
moves: 10...Nxf2? 11.Rxf2 Bxf2+ 12.Kxf2
check: engine
caption: Black has given two minor pieces for a rook and a pawn, usually a poor trade with so many pieces still on the board.
```

Threats: nothing that works at once, and White's next move h3 will send the knight back. The move passes the check.

That is the whole process: read the opponent's move, count the attacked square, list candidates, and blunder-check the most natural one before playing it. It took a page to write, but at the board it becomes a minute or two.

## The five-question pre-move checklist

Everything in this chapter fits into five questions. Ask them, in order, before every move in a slow game:

1. **What is my opponent threatening?** (The three questions about their last move, plus their checks, captures and threats.)
2. **Are any pieces undefended?** Mine and theirs.
3. **Do I have forcing moves?** Checks, captures and threats that win something.
4. **What changes after my candidate move?** What does my move attack, stop defending, and open?
5. **What is my opponent's strongest reply?** Especially every check and capture.

The first two questions keep you safe. The third finds your chances. The last two are the blunder check. If the answer to question five is "they win material" or "they mate", go back to question three and choose again.

:::evidence Why a routine helps
Psychology research on expertise, such as Adriaan de Groot's *Thought and Choice in Chess* (1965), found that strong players first spend time orienting themselves in the position before they calculate. A fixed checklist is a beginner's way to do the same orientation deliberately. The specific five questions here are coaching judgment, not a tested protocol.
:::

### Which moves deserve the full checklist?

In a slow game, run all five questions every move until it feels routine. Later you can lighten the load: when the position is quiet and nothing has changed, a quick glance at questions 1 and 5 is enough. When pieces are in contact, when the opponent has just captured or checked, or when you are about to capture, run the full list. Those are the moments when games are lost.

## Making the scan a habit

Knowing the checklist is easy. Using it every move, in real games, is the hard part. Habits form through repetition in the situation where you need them. A few practical methods help.

### Sit on your hands

Literally. When it is your move, put your hands under your legs or flat on the table away from the pieces. Only when you have finished the checklist and the blunder check do you reach for the piece. This simple physical rule stops the most common blunder of all: moving on impulse because you "saw" a move.

Over the board, the **touch-move rule** ([Chapter 1](#ch-01)) makes this even more important: if you touch a piece, you must move it. Online, set the app to require a confirmation or turn off "premoves" while you build the habit.

### Play slow games

You cannot learn a five-question routine in a 3-minute game. Play games of at least 15 minutes per side plus a 10-second increment, and preferably longer: 30 minutes or more. Use the time. If you finish a 15-minute game with 12 minutes left, you did not use the checklist.

:::coach Slow down on purpose
Coaching judgment: for the next month, make most of your games 15+10 or slower, and after each game check whether you lost material to something the scan would have found. Blitz is fine for fun, but it trains the opposite habit: moving fast without checking.
:::

### Say it quietly in your head

Give the routine words. Many players find it useful to say, silently, "Attack? Defence? Line?" after the opponent's move, and "Checks, captures?" before releasing their own. The words become a trigger. After a few hundred games you will notice that you ask the questions without deciding to.

### Review your losses with one question

After each game, find the first moment you lost material or missed a free piece. Ask: which question of the checklist would have caught it? Write the answer down. Most players discover that the same one or two questions are the ones they skip. That tells you exactly which habit to work on.

:::nextgame Your next game
Play one slow game (15+10 or longer). After each of your opponent's moves, ask the three questions. Before each of your moves, ask "What can my opponent capture or check after this?" Sit on your hands until you have answered. After the game, count how many moves you checked and how many you skipped.
:::

## Where the scan usually fails

Even players who run a scan miss things in the same few places. Knowing them helps you look there on purpose.

* **Backward moves.** Our eyes move forward, toward the opponent. A queen or bishop that can capture by moving backward, toward its own side, is easy to miss. Include backward captures in your scan.
* **Long-range pieces.** A bishop on b2 or a rook on a1 can strike across the whole board. When you list your opponent's captures, trace every open diagonal and file from their bishops, rooks and queen to the end.
* **The king as an attacker.** Kings capture too. A piece next to the enemy king that is not protected is hanging, even if no other piece attacks it.
* **Stopping after the first threat.** When you find one threat, it is tempting to answer it and stop looking. Many moves create two threats at once. Finish the list before you choose a reply.
* **Your own last move.** The line you opened or the piece you stopped defending with your own previous move is just as dangerous as anything your opponent did. Ask the three questions about your own move, too.

:::drill Thirty seconds, every move
In your next few slow games, give yourself a fixed budget: thirty seconds of scanning after every opponent move, even when the move looks harmless. Most moves will reveal nothing. The few that reveal a threat will win you games.
:::

## Not every free piece is free

One last warning before the exercises. The scan finds hanging pieces, but sometimes a piece is left hanging on purpose. A **poisoned** piece is one that loses if you take it: the capture walks into a mate, a fork, or a bigger loss.

The defence is the blunder check again. When you see a free piece, do not ask only "can I take it?" Ask "after I take it, what are my opponent's checks and captures?" If the capture puts your king on an open line, removes a defender from your back rank, or lands your queen on a square where it can be trapped, the free piece may be bait. [Chapter 6](#ch-06) shows several famous opening traps that work exactly this way.

## Practice at the board

Use a physical board or any free analysis board.

1. Set up `r1bqk2r/pppp1ppp/2n2n2/2b1p3/2BPP3/2P2N2/PP3PPP/RNBQK2R b KQkq - 0 5` (the 5.d4 position). Answer the three questions about White's last move out loud. Then list every Black capture and every Black check. Check yourself: d4 attacks c5 and e5; Black's captures are ...exd4, ...Bxd4 and ...Nxe4, and only ...exd4 is clearly sound.
2. Set up `r1bq1rk1/bpp2ppp/p1np4/4p3/4P1n1/1BPP1N2/PP1N1PPP/R1BQR1K1 w - - 4 10` (the worked example). Without looking at the text, play 10.h3 for White and find Black's best reply. Then play 10.Re2 and do the same. Compare.
3. Take any position from one of your own games. Put a coin on every piece that is undefended, for both sides. Count the coins. Then find one forcing move for each side that attacks a coin.
4. **Drill (10 minutes):** play a game against an engine or app set to a low level, but before every move say the five questions aloud. It is slow and that is the point. Stop after 20 moves.

## Chapter summary

* Most games below 800 are decided by hanging pieces and unseen threats, not by deep ideas.
* After every opponent move ask: What does it attack? What does it no longer defend? What line did it open?
* Undefended pieces are targets; loose pieces drop off when a forcing move appears.
* Scan checks, captures and threats for both sides, in that order.
* When nothing forcing exists, play a sound normal move rather than inventing an attack.
* Before releasing a piece, blunder-check: after my move, what can my opponent capture or check?
* A "free" piece can be poisoned; check your opponent's replies before you take it.
* Build the habit with slow games, sitting on your hands, and reviewing which question you skipped.

:::cheat The safety scan
1. Opponent's move: What does it attack? What does it no longer defend? What line did it open?
2. Undefended pieces: list mine and theirs.
3. Forcing moves: my checks, captures, threats; then theirs.
4. Choose a candidate. What changes after it?
5. Blunder check: after my move, what can my opponent capture or check? If something bad, go back to step 3.
:::

@exercises
