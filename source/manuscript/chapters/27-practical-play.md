---
chapter: 27
slug: practical-play
title: Practical Play and Psychology
subtitle: Playing the opponent, the clock and yourself, as well as the board
part: 5
stage: "1200–1500"
skills: [practical, blunder-check, conversion, defense]
objectives:
  - Spend thinking time where it matters, and handle a clock and time trouble without hope moves (if you play with a clock).
  - Recognize tilt and use a stop rule and a reset routine so one bad game does not become five.
  - Make sound decisions about draw offers, resignation and playing on, with good etiquette.
  - When winning, kill counterplay before collecting material; when losing, set problems the engine would also approve of.
  - Run the "sit on your hands" check before every move that feels obvious, especially after a gift or a big gain.
next_game: Before every move that feels obvious, especially after you win material or your opponent leaves something hanging, sit on your hands and name your opponent's best reply to it.
---

You have spent twenty-six chapters learning chess. This one is about something slightly different: playing *games*. Games are played by tired, hopeful, nervous people with clocks, ratings and egos. At 1200–1500 the evidence of this is everywhere. Players lose won positions because they relaxed after winning a piece. They take a "free" bishop and get mated on the back rank. They resign positions that had a stalemate trick, and they lose four games in a row because they kept clicking "new game" while angry.

None of that is a lack of chess knowledge. It is a lack of *practical* skill: deciding where to spend effort, keeping your emotions out of your moves, and handling the moments when the game changes. These skills can be trained just like tactics.

## Thinking time: where to spend it

This book never requires you to play with a clock. Untimed games, or very slow games, are a perfectly good way to improve, and many of the habits in this chapter work without one. But most club and online chess is timed, so here is how to use a clock well when you have one.

### The budget idea

A **time control** is the amount of thinking time each player gets, such as "15+10": fifteen minutes each, plus ten seconds added after every move. That added time is the **increment**. Without an increment, a game can be lost on time however good your position is; with one, a scramble is survivable if your moves stay simple.

A useful way to think about the clock is as a budget. You will not spend the same amount on every move, so decide roughly where the money goes:

* **Known opening moves:** quickly. If you have played the position many times, a few seconds per move is enough.
* **Critical moments:** this is where most of your time belongs (see below).
* **Simple, forced moves** (recaptures, the only legal reply to a check): quickly, after a short safety check.
* **A reserve:** keep some time for the ending. The ending is where many won games are thrown away in a scramble.

:::coach A starting budget (coaching judgment)
For a 15+10 game, a reasonable target is to spend no more than about two minutes on the opening, to have at least a third of your time left when the middlegame becomes simple, and never to spend more than three or four minutes on one move unless the game is decided by it. These numbers are a starting point, not a law. Adjust them after you look at your own clock usage in [Chapter 28](#ch-28).
:::

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O 7.Re1 a6 8.Bb3 Ba7 9.h3 h6 10.Nbd2 Re8
check: engine
diagram: end
caption: A familiar Giuoco Pianissimo structure. Nothing is attacked and both sides have normal plans. This is a position to play at a steady pace, not to burn ten minutes on.
```

### Recognizing a critical moment

A **critical moment** is a position where the choice you make now changes the character of the game, and a mistake will be hard to repair. You cannot afford to think deeply on every move, so learn the signs that say "this one matters":

1. **Forcing moves exist** for either side: checks, captures, or threats against big pieces.
2. **A transition is possible:** a queen trade, a trade into a king and pawn ending, or opening the position with a pawn break.
3. **Your opponent's last move surprised you.** A surprise means your plan was based on a picture that has just changed.
4. **The evaluation could swing.** One side is about to win material, or a king is suddenly exposed.
5. **You feel the urge to play fast** because the move is "obvious". This is the most dangerous sign of all, and it gets its own section later in this chapter.

When you see two or more of these signs, slow down and run your full move-selection routine from [Chapter 14](#ch-14): threats, candidate moves, calculate the forcing ones, blunder-check.

### Time trouble without hope

**Time trouble** means having so little time that you cannot think normally. The typical bad habit is the **hope move**: a move whose only merit is a cheap threat that you *hope* your opponent will miss. Hope moves feel active, but they usually make your position worse if the opponent sees the threat, and a stronger opponent usually does.

```line
fen: startpos
moves: 1.e4 e5 2.Bc4 Nc6 3.Qh5 g6 4.Qf3 Nf6 5.Qb3?! Nd4
check: engine
diagram: end
caption: Three queen moves, three one-move threats against f7, and three calm answers. Now 5...Nd4 hits the queen and c2: the hope moves have only cost White time.
```

In time trouble, follow a simplified routine instead:

* **Checks, captures and threats for the opponent first.** Five seconds is enough to see a mate in one or a hanging queen.
* **Prefer moves you understand.** Recapture, trade when ahead, defend when attacked, and keep the king covered.
* **Make the safe move rather than the brilliant one.** A move that keeps your position intact is worth more than a combination you cannot check.
* **Use the increment.** If you have an increment, play the simple moves quickly to build time back.

:::mistake Spending your time in the wrong place
A very common pattern at club level is to spend eight minutes choosing between two equally good developing moves in the opening, then lose a won ending with thirty seconds on the clock. If your games keep ending in scrambles, the fix is almost always earlier in the game: play known positions faster.
:::

## Tilt and emotional control

**Tilt** is a poker word for playing badly because you are upset. In chess it looks like this: you lose a game you should have won, immediately start another, play too fast and too aggressively, lose again, and repeat. Your chess knowledge has not changed between the first game and the fifth. Your judgment has.

Common signs of tilt:

* You start a new game within seconds of losing the last one.
* You want to "win your rating back" rather than play a good game.
* You play your moves faster than usual, or play openings you do not normally play.
* You feel angry at your opponent, the site, or yourself while you are moving.

:::coach The two-losses stop rule (coaching judgment)
After two losses in a row, stop playing rated games for the session. Do something else: go for a walk, solve a few easy puzzles, or analyze the two games. This rule is a coaching habit, not a research finding, but it is cheap insurance. Almost nobody plays their best chess immediately after two painful defeats, and the rating points you save are real.
:::

A simple **reset routine** between games helps even when you are not tilting. Stand up, drink some water, and before the next game ask one question: "What is my one focus for this game?" (for example, "blunder-check every capture"). This turns your next game back into practice instead of revenge.

## Stronger and weaker opponents

### Playing someone stronger

Against a stronger player, two opposite errors are common. Some players freeze and play passively, assuming every move of the opponent is deep. Others try wild complications from move one. Both throw away your best weapon, which is simply playing good chess.

* **Trust your calculation, not their rating.** If you check a pawn carefully and it is free, take it. Stronger players also make mistakes; they just make fewer of them. Exercise 27-07 shows a case where the "suspicious" pawn really is free.
* **Keep the game normal.** Play your repertoire, develop, castle. You will learn more from a sound game you lose than from a gamble.
* **Do not offer early draws out of fear.** You are there to learn and to win if they slip.

### Playing someone weaker

Against a weaker player, the danger is **overpressing**: trying to win too quickly, or forcing play in an equal position until it becomes a lost one.

* **Be patient.** A weaker opponent is more likely to make mistakes in a long game, so give them the chance.
* **Do not play "for tricks".** Tricks are what weaker players fall for, but playing for them means making slightly bad moves on purpose. Sound pressure produces the mistakes for you.
* **Accept that a draw is sometimes the correct result.** If the position is dead equal, pressing on with a bad move to avoid the draw is how upsets happen.

## Draw offers and when to keep playing

A **draw offer** is a proposal that the game end as a draw. In over-the-board play, the correct procedure under the FIDE Laws of Chess is to make your move, offer the draw, and then press your clock. Your opponent may accept, decline by saying so, or decline by simply making a move. Offering repeatedly after one refusal is poor etiquette and can be treated as annoying the opponent.

When you are *offered* a draw, treat it as information. Your opponent thinks the position is no better than equal for them, or they are tired, or short of time. Before you answer:

1. **Run your safety scan as if it were your move.** A draw offer often comes at a moment when the opponent has missed something (Exercise 27-03).
2. **Ask who is better, and who has the easier position to play.** A small edge in a simple position is worth playing on for.
3. **Check the clocks.** If your opponent is short of time and you are not, playing on is usually right.
4. **Then decide.** If the position is genuinely equal and dry, a draw is a perfectly respectable result.

```board
fen: 8/5pk1/6p1/3b3p/7P/4B1P1/5PK1/8 w - - 0 45
caption: Opposite-coloured bishops with equal, symmetrical pawns. Neither side can create a passed pawn or attack anything. Accepting a draw here is sensible chess, not cowardice.
squares: d5 e3
```

:::key Draw decisions in one line
Play on when you have a safe edge, the easier position, or more time. Accept when the position is equal and dry and you have nothing to play for. Never accept a draw without first looking at the board.
:::

## Resignation etiquette

**Resigning** means conceding the game. At the board you can say "I resign", stop the clock, or offer your hand. Online you click the resign button. Letting your clock run out in a hopeless position, or simply leaving, is considered rude in both settings.

When should you resign? A practical guideline at 1200–1500 is: resign when you are completely lost *and* you have checked for your last resources: stalemate, perpetual check, a fortress, or an opponent who is very short of time. Before then, playing on is not rude. Your opponent has to prove the win, and at this level many wins are not proved.

```board
fen: 6k1/5ppp/8/8/8/8/5PPP/3R2K1 b - - 0 40
caption: Black is a whole rook down with no passed pawns and no counterplay. Against an opponent of your level or above, resigning here is reasonable; playing on for twenty moves hoping for a blunder mostly wastes both players' time.
```

Compare that with a position that looks hopeless but is not:

```board
fen: 8/8/8/2b5/8/7p/5k2/7K w - - 0 70
caption: White is a bishop and a pawn down, but the h-pawn queens on a light square and Black's bishop is dark-squared. If White's king shuttles between h1 and h2, Black cannot force it out. This is a known draw, and resigning would throw half a point away.
squares: h1
```

## When you are worse: set problems

When you are worse, your goal changes. You are no longer looking for the objectively best plan to win; you are looking for the move that keeps the game alive and gives your opponent the most chances to go wrong. This is called **setting problems**. It is not the same as hope chess, because the moves you choose must still be sound. A swindle that loses immediately when the opponent sees it is just a quicker loss.

Good practical defence usually means:

* **Keep the pieces that give counterplay.** Avoid trades that lead to simple, lost endings, such as a king and pawn ending a pawn down against an outside passed pawn (Exercise 27-08).
* **Create a concrete threat every move if you can.** Your opponent must spend time and energy answering it, and each answer is another chance to err.
* **Look for drawing mechanisms.** Perpetual check, stalemate, a fortress, opposite-coloured bishops, or a rook ending with all pawns on one side. Exercise 27-04 is a stalemate rescue a rook down.
* **Keep the position complicated, but not lost.** A position with many pieces and some tactics is harder for your opponent than a clean technical ending.
* **Use the clock if you have one.** If your opponent is short of time, simple solid moves that keep threats on the board can be more effective than a desperate sacrifice.

Stalemate is the most common last-chance resource. Here is the pattern that you, as the stronger side, must also know:

```board
fen: 7k/8/6K1/8/8/8/8/5Q2 w - - 0 70
caption: White to move. 70.Qf7?? takes every square and leaves Black with no legal move: stalemate. 70.Qf8# ends the game properly. When your opponent has only a king, give check or leave him a move.
red: f1f7
arrows: f1f8
```

:::mistake Resigning too early
Many players at this level resign positions with a stalemate trick or a perpetual check still on the board. Before resigning, ask two questions: "Can I give checks forever?" and "If my last mobile piece disappeared, would I have any legal moves?"
:::

## When you are winning: do not relax

The most expensive emotion in chess is relief. You win a piece, the hard part seems over, and your attention drops just as your opponent starts looking for tricks. A player who is losing has nothing to lose by trying everything, so this is exactly the moment to *raise* your attention.

Conversion was covered in detail in [Chapter 16](#ch-16). The practical rules are:

1. **Name your opponent's last chance.** Ask, "If I were them, how would I try to save this game?" Usually there are only one or two ideas: a back-rank trick, a perpetual check, a passed pawn, or an attack on your king.
2. **Kill that chance first.** A flight square for your king, a queen trade, a blockade. Only then continue with your own plan.
3. **Trade pieces, not pawns.** Every trade of pieces reduces the opponent's chances of counterplay; pawns are what you will eventually win with.
4. **Prefer the simple win to the brilliant one.** You get the same point for both.

:::example Worked example: a piece up, five minutes left
```board
fen: r3r1k1/pp3ppp/2p5/7q/4P1b1/1BNP1N2/PP1Q1PPP/R4RK1 w - - 0 16
caption: White to move, a knight and a pawn up. Black's queen and bishop are both aimed at White's kingside, and ...Bxf3 would damage White's pawns. How do you convert safely?
arrows: d2f4
red: g4f3 h5h2
```

**First I check what my opponent wants.** Black's pieces point at f3 and h2. If ...Bxf3 and I recapture with the g-pawn, my king is open and Black's queen gets a target. That is Black's only real idea.

**Next, my candidate moves.** I can see Ng5 (moving the knight with an attack on f7), h3 (asking the bishop), Bxf7+ (grabbing a pawn with check), and Qf4 (offering a queen trade).

**Then I compare them practically.** Bxf7+ looks forcing, but after 16...Qxf7 I have given a bishop for a pawn and must find more tactics to justify it. Ng5 is strong but leaves a complicated position with queens on. Qf4 offers a trade: if Black takes nothing, my queen defends f3 and h2; if Black plays ...Bxf3, I recapture with the queen and the queens come off.

**Finally I blunder-check Qf4.** Is the queen safe on f4? Nothing attacks it. Does it allow a check or a capture? ...Bxf3 is met by Qxf3, keeping my pawn structure intact.

```line
fen: r3r1k1/pp3ppp/2p5/7q/4P1b1/1BNP1N2/PP1Q1PPP/R4RK1 w - - 0 16
moves: 16.Qf4 Bxf3 17.Qxf3 Qxf3 18.gxf3
check: engine
diagram: end
caption: Queens are off and White is a clean piece up. Black's attacking chances have disappeared with the queens.
```

Stockfish slightly prefers 16.Ng5, but 16.Qf4 keeps an overwhelming advantage and is far easier to play with little time. In a practical game, choosing the move you can fully check is often the stronger decision.
:::

## The "sit on your hands" check

The phrase comes from an old piece of chess advice: when you have found a move you like, physically sit on your hands so that you cannot play it immediately. Then look at the board once more, this time from your opponent's side.

This habit matters most in exactly the situations where you want to move fast:

* **Your opponent has just left something hanging.** Before you take it, ask what they gain if you do (Exercises 27-01 and 27-06).
* **You have just won material.** Ask what their best reply would be if they were desperate (Exercise 27-02).
* **The move is a natural recapture or a "free" pawn grab.** Check whether a stronger in-between move exists for them.

```board
fen: 3r2k1/pp3ppp/1qn5/3B4/8/2P5/PPQ2PPP/4R1K1 b - - 0 22
caption: White's bishop on d5 seems to be a gift. But after 22...Rxd5?? the rook has left the back rank and 23.Re8# is mate, because Black's king has no flight square.
red: e1e8
squares: d5 e8
```

:::key The sit-on-your-hands routine
1. You have found a move. Do not play it yet.
2. Imagine it on the board. List your opponent's checks, captures and threats in that new position.
3. Ask: "What is the most annoying reply?" Name one concrete move.
4. If you have a good answer to it, play your move. If not, look for a different move.
:::

The check takes about fifteen seconds. Over a season of games it will save more points than any opening you could study in the same time.

## Game day and online routine

What happens before and around a game affects the moves you make. None of the following is mysterious, and much of it is coaching judgment rather than research, but it is consistently useful.

### Before you play

* **Sleep.** A long game after a short night is a test of concentration you have already half failed. If you are exhausted, an unrated game or a training session is a better choice than a rated game.
* **Eat and drink sensibly.** Hunger and thirst late in a long game make you impatient. Have water and a light snack available in long over-the-board games.
* **Warm up.** Solve five easy puzzles before you play. The aim is not to train; it is to switch on your pattern recognition.
* **Decide on one focus.** "Blunder-check every capture" or "spend my time at critical moments" is enough.

### During a session

* **Play one game at a time,** with no other tabs, messages or videos. Divided attention is a reliable source of blunders.
* **Take breaks.** Stand up between games. In a long game, a minute away from the board during your opponent's turn can reset your focus.
* **Apply the stop rule.** Two losses in a row ends the rated session.
* **Prefer slower time controls for improvement.** Fast games are fun, but games with time to think are where you practise the habits in this book.

### After you play

* **Write down your thoughts before you open an engine.** This is the start of the analysis loop in [Chapter 28](#ch-28).
* **Record the result without judging yourself.** A loss with three good decisions and one blunder is useful information, not a verdict on your talent.

:::nextgame Your practical game plan
In your next game, pick one practical focus: either "sit on my hands before every capture" or "stop after two losses in a row". Write it at the top of your scoresheet or on a sticky note next to your screen, and check afterwards whether you kept to it.
:::

## Practice at the board

Set these positions up on a board or in any free analysis app (Lichess's analysis board and Chess.com both let you paste a FEN). Use them to practise practical decisions, not just tactics.

1. **The free bishop.** FEN: `3r2k1/pp3ppp/1qn5/3B4/8/2P5/PPQ2PPP/4R1K1 b - - 0 22`. Black to move. Before you think about the bishop, name White's best reply to ...Rxd5. Then find a move that keeps everything safe (a flight square for your king is a good start). Check with an engine.
2. **Stalemate or mate.** FEN: `7k/8/6K1/8/8/8/8/5Q2 w - - 0 70`. Find every queen move that stalemates and every queen move that mates in one. Say the rule aloud: "give check or leave him a move."
3. **The draw that looks lost.** FEN: `8/8/8/2b5/8/7p/5k2/7K w - - 0 70`. Play White against an engine or a friend for ten moves. Keep your king on h1 and h2 and see whether Black can make progress.
4. **The convert-and-trade drill.** FEN: `r3r1k1/pp3ppp/2p5/7q/4P1b1/1BNP1N2/PP1Q1PPP/R4RK1 w - - 0 16`. Play White against an engine at a moderate level with a five-minute clock. Your goal is not to find the best move but to trade queens and win without allowing a single check against your king.
5. **The timed routine.** Play three games at a slow time control. After each game, mark on your scoresheet the moves where you spent the most time. Were they the critical moments, or just the moments when you were unsure about an opening move?

## Chapter summary

* Spend thinking time at critical moments: when forcing moves exist, when a transition is possible, or when your opponent's move surprised you.
* In time trouble, play simple, safe moves and do not rely on hope moves that only work if your opponent misses a one-move threat.
* Tilt is real. A stop rule (coaching judgment: two losses in a row) and a short reset routine protect your rating and your learning.
* Against stronger players, trust your calculation; against weaker players, be patient and avoid overpressing.
* Before answering a draw offer, look at the board as if it were your move. Accept equal, dry positions; play on when you have a safe edge or more time.
* Resign only when you are lost and have checked for stalemate, perpetual check and fortresses. Never let the clock run out on purpose.
* When winning, name and kill the opponent's last chance before collecting more material; when losing, keep sound counterplay and look for drawing mechanisms.
* Sit on your hands before every obvious move, especially after a gift or a big gain.

:::cheat Practical decision procedure
1. Is this a critical moment (forcing moves, a transition, a surprise)? If yes, slow down and use your full routine.
2. What is my opponent trying to do? Name their best idea or last chance.
3. If I am winning: stop their idea first, then trade pieces and simplify.
4. If I am losing: keep sound counterplay, avoid trades into lost endings, look for perpetual check and stalemate.
5. Before playing the move, sit on your hands: what is the most annoying reply?
6. Between games: after two losses in a row, stop the rated session.
:::

@exercises
