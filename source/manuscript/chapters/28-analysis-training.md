---
chapter: 28
slug: analysis-training
title: Analyzing Your Games and Training for Life
subtitle: Turning every game into the right training
part: 5
stage: "1200–1500"
skills: [evaluation, blunder-check, calculation, practical]
objectives:
  - Analyze your own games in the right order, recording your thoughts before you use an engine.
  - Find the turning points of a game and classify each mistake with a fixed set of categories.
  - Read engine evaluations sensibly, find the first big swing, and ask why a move was bad.
  - Keep a mistake journal and a prioritized weakness list, and turn mistakes into spaced, mixed review exercises.
  - Understand what ratings, accuracy scores and performance figures can and cannot tell you, and plan your training beyond 1500.
next_game: After your next game, write down your thoughts at the three moments that felt most important before you open any engine, then log every mistake with one category from the list in this chapter.
---

You have reached the last chapter, but not the end of the book's method. Every chapter has ended with the same loop: LEARN, SOLVE, PLAY, ANALYZE, FIX, REPEAT. This chapter is about the second half of that loop, the part most players skip.

Most improving players play far more than they analyze. They glance at the engine's bars, sigh at the blunder on move 23, and click "new game". Two weeks later the same blunder happens again, because nothing has changed in how they think. Players who keep improving treat their own games as their main textbook: they know their typical mistakes, build exercises from their own positions, and review them until the patterns stick. This chapter shows you how.

## The analysis loop at a glance

Here is the whole process. Each step gets its own section below.

1. **Record your thoughts** right after the game, before any engine.
2. **Find the turning points:** the moments where the result was really decided.
3. **Categorize each mistake** using one fixed list.
4. **Check with the engine:** find the first big swing and ask why.
5. **Log it** in your mistake journal.
6. **Prioritize** with a weakness list (how often × how costly).
7. **Fix it** by turning mistakes into exercises and reviewing them on a schedule.

:::coach How much time to spend (coaching judgment)
A useful rule of thumb is to spend at least as long analyzing a serious game as you spent playing it, and to analyze every slow game you play. Fast games are fine for fun, but you do not need to analyze them all; pick the ones where something important happened.
:::

## Step 1: Your thoughts first, the engine second

The most valuable information about a game is not in the moves. It is in your head: what you were afraid of, which candidates you considered, what you missed and why. That information fades within hours, and an engine destroys it in seconds. Once you have seen the "right" move, you cannot honestly remember whether you would have found it.

So before you open any engine, write short notes at the moments that mattered. You do not need beautiful prose. For each moment, answer:

* **What did I think was going on?** ("I thought my attack was faster.")
* **Which candidate moves did I consider?** ("Nxg5 and Bg3.")
* **What was I afraid of?** ("...Qd7 and ...Kg7 defending.")
* **How much time did I use, and how did I feel?** ("Six minutes, nervous, short of time later.")

Use your scoresheet, or an analysis board with the engine switched off. Analyzing with your opponent or a friend helps too: explaining your thinking aloud reveals its gaps.

:::mistake Letting the engine think for you
If the engine is on while you go through the game, you will mostly learn *what* the better move was. You will not learn *why* you missed it, which is the only part that helps in your next game. Turn the engine off for the first pass, every time.
:::

## Step 2: Find the turning points

A **turning point** is a moment where the game changed character: the evaluation swung, a plan began or failed, or one side started to lose control. Most games have only one to three real turning points. Everything else is detail.

Before you use an engine, you can usually find them by asking:

* Where did I first feel uncomfortable, or first feel I was winning?
* Where did I spend the most time?
* Where did material change hands, or the pawn structure change?
* Where did the type of position change (queens off, a pawn break, an ending)?

Mark those moves. They are where your analysis effort belongs.

```board
fen: r1bq1rk1/ppp2pp1/2np1n1p/2b1p3/2B1P2B/2PP1N2/PP3PPP/RN1Q1RK1 b - - 1 8
caption: A typical turning-point candidate. Black is deciding whether to break the pin with ...g5. Pawn moves in front of a castled king cannot be taken back, so this is a moment to slow down and, afterwards, a moment to analyze.
squares: g7 h4
orientation: black
```

## Step 3: Categorize every mistake

A mistake you do not name is hard to fix. This book uses one fixed list of **mistake categories**. Use exactly these labels, and choose the *main* reason when more than one applies:

| Category | Use it when… | Example |
|---|---|---|
| hanging-piece | You left a piece or pawn undefended, or missed that the opponent's was | The student's 6...Ng4? in Exercise 28-04 |
| missed-tactic | A tactic existed (fork, pin, discovered attack…) for you or against you | Exercises 28-05, 28-06, 28-07, 28-10 |
| missed-mate | A forced mate was available, for you or against you | Exercises 28-01, 28-11 |
| king-safety | You weakened your king, or ignored danger to it | Moving pawns in front of a castled king |
| calculation | You saw the right idea but calculated it wrongly | Wrong move order, missed defensive reply |
| opening | The problem came from the opening: a trap, a bad plan, a lost tempo | Exercise 28-04 |
| endgame | You misplayed a known endgame or misjudged a transition to one | Exercise 28-03 |
| missed-win | You had a clearly winning line and played something weaker | Exercise 28-08 |
| conversion | You were winning but let the advantage slip by playing loosely | Exercise 28-09 |
| positional | A plan, structure or piece-placement error with no tactical cause | Bad trade, weak square, passive piece |
| time-psychology | Time trouble, tilt, fear, over-confidence or resigning too early | Exercise 28-02 |

Record the deeper cause. "I blundered because I had ten seconds" is a time-psychology mistake, even though the move itself hung a piece; mention the surface cause in your notes.

## Step 4: Use the engine well

Only now open the engine. An engine is an extraordinary tool, but it answers a different question from the one you need. It tells you what the strongest move was. You need to know what you should change in your thinking.

### How to read evaluations

An engine **evaluation** is a number from White's point of view, measured roughly in pawns. +1.00 means White is about a pawn better; −2.50 means Black is clearly better; a score such as "M4" or "#4" means a forced mate in four moves. The number is the engine's judgment at a certain search depth; it is not a law of nature, and it can change as the engine searches deeper.

For practical purposes at your level, the following bands are a good guide (coaching judgment):

* **Within about ±0.5:** roughly equal; the game is about who plays better from here.
* **About 0.5 to 1.5:** a clear but not decisive advantage.
* **About 1.5 to 3:** a large advantage that usually wins with good technique.
* **Beyond 3, or a mate score:** normally decisive, unless the other side has a tactical rescue.

```board
fen: r1bq1rk1/pppnbppp/4pn2/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R w KQ - 3 7
caption: A normal Queen's Gambit Declined position. Stockfish rates Qc2, Qb3, Rc1 and Bh4 all within about a tenth of a pawn of each other. Differences this small are not mistakes; do not spend your analysis time on them.
```

### Do not obsess over small differences

If the engine prefers +0.6 to your +0.3, that is not a mistake worth logging; at club level such differences are decided by plans, time and nerves. Look for swings of roughly a pawn or more, or swings that change the band the position is in.

### Look for the first big swing

Run the engine through the whole game and find the **first big swing**: the first move where the evaluation changed by roughly a pawn or more against you. Later mistakes often happen *because* of that first one (you were worse, so you became nervous or desperate), so fixing the first swing often fixes several later moves too.

### Ask "why", not just "what"

When the engine shows a better move, play it out and ask:

* **Why was my move bad?** What does the opponent do against it, concretely?
* **Why didn't I consider the better move?** Did I not see it, see it and reject it, or not look at that kind of move at all?
* **What rule would have found it?** ("Check every check." "Look at the opponent's best reply before playing an attacking move.")

The rule is what goes into your journal. The engine's move alone is not enough.

:::example Worked example: analyzing a sacrifice that failed
The student was White in a Giuoco Pianissimo and wrote these notes before opening any engine: "After 8...g5 I remembered that Nxg5 often works against this pawn push. I calculated 9.Nxg5 hxg5 10.Bxg5 and thought my attack would be very strong. Spent four minutes."

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O 7.Bg5 h6 8.Bh4 g5
check: engine
diagram: end
caption: The turning point. Black has driven the bishop back with ...h6 and ...g5. White must choose between the calm 9.Bg3 and the knight sacrifice on g5.
```

**First I check the student's notes against the board.** The idea was a known pattern: when a castled king's pawns advance with ...h6 and ...g5, a knight sacrifice on g5 can sometimes break the position open. The student did calculate a few moves. So the problem is not laziness; something in the evaluation went wrong.

**Next I let the engine speak.** Before 9.Nxg5 the position is roughly equal (about +0.2 for White). After it, the evaluation drops to about −1, a swing of more than a pawn. This is the first big swing of the game.

```line
fen: r1bq1rk1/ppp2p2/2np1n1p/2b1p1p1/2B1P2B/2PP1N2/PP3PPP/RN1Q1RK1 w - - 0 9
moves: 9.Nxg5? hxg5 10.Bxg5 Kg7 11.Qf3 Rh8
check: engine
diagram: end
caption: After 10...Kg7 and 11...Rh8 Black's king is safe and Black's rook uses the open h-file. White has two pawns for the knight but no way to bring more pieces into the attack.
```

**Then I ask why.** Playing the line out shows the reason: White has only the queen and one bishop near the black king. The knight on b1 is far away, the bishop on c4 is not aimed at the kingside, and Black's king simply walks to g7 while the rook takes over the h-file. The pattern needs more attackers than White has here.

**Finally I write the journal entry.** Category: *calculation* (right pattern, wrong assessment of the final position). Rule for next time: "Before a sacrifice, count the attackers that can join in the next two moves; if it is only the queen and one piece, look for the calm move." The calm 9.Bg3 keeps the balance.
:::

The same check, counting the pieces that can join the attack, also explains why the Greek gift sacrifice works in one position and fails in a very similar one:

```board
fen: r1bq1rk1/pp1nbppp/2n1p3/2ppP3/3P4/2PB1N2/PP3PPP/RNBQ1RK1 w - - 0 9
caption: This looks like a textbook Greek gift, but 9.Bxh7+? Kxh7 10.Ng5+ fails because the bishop on e7 covers g5: after 10...Bxg5 11.Bxg5 Qxg5 White has simply lost two pieces for a pawn. Compare Exercise 28-08, where Black has no dark-squared bishop and the sacrifice wins.
squares: e7 g5
red: e7g5
```

## Step 5: The mistake journal

A **mistake journal** is a simple record of every significant mistake, with the position and the lesson. Keep it in a notebook, a spreadsheet or a text file. What matters is that you use the same columns every time, so that patterns become visible.

Here is a template you can copy:

| Date | Game (opponent, colour, time control) | Move | FEN | I played | Better | Category | Why it happened | Rule for next time | Review dates |
|---|---|---|---|---|---|---|---|---|---|
| | | | | | | | | | 1 / 3 / 7 / 21 days |
| | | | | | | | | | 1 / 3 / 7 / 21 days |

And here is the entry from the worked example, filled in:

| Date | Game | Move | FEN | I played | Better | Category | Why it happened | Rule for next time | Review dates |
|---|---|---|---|---|---|---|---|---|---|
| (date) | Club game, White, 30+0 | 9 | `r1bq1rk1/ppp2p2/2np1n1p/2b1p1p1/2B1P2B/2PP1N2/PP3PPP/RN1Q1RK1 w - - 0 9` | Nxg5 | Bg3 | calculation | Remembered a pattern; did not count attackers after ...Kg7 | Count attackers that can join within two moves before sacrificing | ✓ / ✓ / – / – |

Three practical points:

* **Save the FEN.** Every free analysis board can show the FEN of the current position. With the FEN saved, the position becomes an exercise you can set up again at any time.
* **Write the rule in your own words.** "Count attackers before sacrificing" is a rule you will remember; "Bg3 was +0.2" is not.
* **One line per mistake.** A long essay is not more useful. If an entry takes more than two or three minutes, you are writing too much.

## Step 6: The weakness list (frequency × cost)

After ten or twenty analyzed games, your journal will show patterns. Some categories appear again and again; some appear rarely but cost you whole games. A **weakness list** turns that information into a training priority.

For each category, count how often it appeared and estimate how much it cost each time. A simple cost scale works well (coaching judgment):

* **1:** a noticeable but small loss (a good position became equal).
* **2:** a big swing (an equal position became clearly worse, or a win became a draw).
* **3:** it decided the game.

Multiply frequency by average cost to get a priority score. Train the top one or two categories first.

| Category | Times (last 15 games) | Average cost (1–3) | Score (times × cost) | Priority | Training fix | Re-check on |
|---|---|---|---|---|---|---|
| hanging-piece | | | | | | |
| missed-tactic | | | | | | |
| missed-mate | | | | | | |
| king-safety | | | | | | |
| calculation | | | | | | |
| opening | | | | | | |
| endgame | | | | | | |
| missed-win | | | | | | |
| conversion | | | | | | |
| positional | | | | | | |
| time-psychology | | | | | | |

For example, a student might find 6 hanging-piece mistakes with an average cost of 2.5 (score 15), 4 conversion mistakes with an average cost of 2 (score 8), and 3 opening problems with an average cost of 1 (score 3). That student should spend the next month on the blunder-check routine and conversion technique, not on learning more opening theory, however tempting that is.

:::key Train what costs you points
The weakness list protects you from training what you enjoy instead of what you need. Opening study is fun, but if your games are decided by hanging pieces and lost conversions, the list will show it in black and white.
:::

## Step 7: Turn mistakes into exercises

The journal becomes powerful when you use it as a training set. Every entry with a FEN is a ready-made exercise taken from your own games, which makes it more relevant to you than any puzzle collection.

### Building your personal exercise set

1. **Set up the position from the FEN** in an analysis board or on a physical board.
2. **Write the question** you should have asked during the game: "White to move. Is the sacrifice on g5 sound?" or "Black to move. Find the move that saves the game."
3. **Hide the answer** (on the back of a card, in a separate column, or in a study chapter you do not open until you have answered).
4. **Add two or three similar positions** from this book's exercises with the same theme. A tag such as "fork" or "back-rank" makes these easy to find.

A free online study (for example a Lichess study with one chapter per position) is a convenient home for the set.

### The review schedule

Review each new exercise roughly **1, 3, 7 and 21 days** after you create it. If you solve it confidently, move it to the next interval; if you fail it, start again from 1 day. After the 21-day review, put it in a "maintenance" pile that you sample from now and then.

:::coach Why 1, 3, 7 and 21? (coaching judgment)
These exact intervals are a practical choice, not a research finding. Research on spacing (see the evidence box below) shows that spreading reviews out helps long-term retention, and that the best gap depends on how long you want to remember the material. Expanding gaps of a day, a few days, a week and a few weeks are simple to manage and work well in practice. If a different rhythm suits your week better, use it.
:::

### Mix your practice

When you review, **mix the themes**. Do not solve ten forks in a row, then ten pins. In a real game, nobody tells you which theme is on the board; recognizing *which* idea applies is part of the skill. A mixed set (one of your own positions, a fork from [Chapter 7](#ch-07), a rook ending from [Chapter 23](#ch-23), a mate pattern from [Chapter 11](#ch-11)) trains exactly that.

## Why this works: the evidence, and its limits

This chapter's method is built on a small number of well-studied ideas from the science of learning. Here is what they say, and what they do not.

:::evidence Deliberate practice
Ericsson, Krampe and Tesch-Römer (1993), "The role of deliberate practice in the acquisition of expert performance" (*Psychological Review*), described **deliberate practice**: effortful activity designed to improve specific weaknesses, usually with feedback, rather than simply doing the activity for enjoyment. In chess specifically, Charness, Tuffiash, Krampe, Reingold and Vasyukova (2005), "The role of deliberate practice in chess expertise" (*Applied Cognitive Psychology*), found that the amount of serious study alone (studying games, positions and books by yourself) was the strongest predictor of chess skill among the activities they measured.
:::

:::evidence Retrieval practice
Roediger and Karpicke (2006), "Test-enhanced learning: Taking memory tests improves long-term retention" (*Psychological Science*), showed that testing yourself on material produces better long-term retention than spending the same time re-studying it. For chess, this supports solving positions (retrieving the idea) over re-reading annotations.
:::

:::evidence Spacing
Cepeda, Pashler, Vul, Wixted and Rohrer (2006), "Distributed practice in verbal recall tasks: A review and quantitative synthesis" (*Psychological Bulletin*), reviewed a large body of studies and found that spreading study sessions out over time generally produces better retention than massing them together, with the best gap depending on how long the material must be remembered. The research concerns mostly verbal material; applying it to chess positions is a reasonable extension, not a tested result.
:::

:::evidence Interleaving
Kornell and Bjork (2008), "Learning concepts and categories: Is spacing the 'enemy of induction'?" (*Psychological Science*), found that interleaving examples of different categories (in their study, paintings by different artists) improved people's ability to classify new examples. Rohrer and Taylor (2007), "The shuffling of mathematics problems improves learning" (*Instructional Science*), found that mixing different types of mathematics problems in practice led to better test performance than practising one type at a time, even though practice felt harder. Mixed chess exercises aim at the same benefit: learning to recognize which idea fits.
:::

:::evidence The limits of the evidence
Practice is not the whole story. Macnamara, Hambrick and Oswald (2014), "Deliberate practice and performance in music, games, sports, education, and professions: A meta-analysis" (*Psychological Science*), found that deliberate practice explained an important part, but far from all, of the differences between people's performance, and the authors argued that other factors must also matter. There is also very little research on adults improving from 400 to 1500 in particular. So the honest summary is: the methods in this chapter are well supported as ways to learn and remember, but no method guarantees a particular rating, and people improve at different speeds.
:::

## What your numbers mean (and what they do not)

Online chess gives you a flood of numbers. Here is how to read the common ones.

* **Online rating.** Your rating is an estimate of your playing strength *within one rating pool*: one site, one time control. Different sites use different systems and starting points, and their players are different, so a rating on one site does not translate exactly into a rating on another site or into an official over-the-board rating. Ratings also move up and down by chance from game to game; judge trends over months, not days.
* **Puzzle rating.** Your puzzle rating measures how you solve puzzles *when you know there is a puzzle*. It is useful for tracking tactical training, but it is usually not the same number as your playing rating, and it should not be compared with it directly.
* **Engine accuracy scores.** "Accuracy" percentages summarize how close your moves were to the engine's, but they depend heavily on the position. A quiet, simple game can produce a high accuracy score even with poor play, and a wild tactical game can produce a low one even when you played well. Use them as a rough hint, never as a grade.
* **Single-game "performance rating" or "estimated Elo".** Some tools estimate a rating from one game's moves. One game is far too small a sample for that to mean much. It is not your Elo, and a high or low number after one game tells you almost nothing.
* **Real mastery.** The best evidence of real progress is in your games and your journal: fewer hanging pieces, more converted wins, better-chosen plans, categories disappearing from your weakness list.

:::key Measure what you control
You cannot control your rating from one week to the next. You can control how many games you analyze, how many journal entries you review, and whether you ran your blunder-check before every capture. Track those process numbers, and let the rating follow in its own time.
:::

## Beyond 1500: a plan for the long term

This book was designed to take you from your first moves to around 1500, and to leave you with a method that keeps working afterwards. Here is what the next stage of training typically looks like (coaching judgment).

### Play slower games

Classical games, with an hour or more each, are where you practise everything in this book under realistic conditions. If you can, play at least some slow games every month, online or over the board.

### Deepen your openings by understanding, not memorizing

Your repertoire from [Chapter 12](#ch-12) and [Chapter 13](#ch-13) gives you sound positions. The next step is to understand them: the typical plans, pawn breaks and endgames that come from your openings. Collect model games in your lines and play through them.

### Study annotated master games

Play through annotated master games, guessing each move before you look. Books with explained games (see Further Reading) tell you *why*, not just *what*.

### Make endgame study a habit

A small number of endgames come up again and again. Know them so well that you can play them quickly:

```board
fen: 3K4/3P1k2/8/8/8/8/r7/4R3 w - - 0 60
caption: The Lucena position: White wins. The standard method is to bring the rook to the fourth rank to "build a bridge" that shields the king from checks once it leaves d8.
squares: d8 d7
```

```board
fen: 3k4/R7/8/3PK3/8/8/8/7r b - - 0 50
caption: A Philidor-type defence: Black draws by keeping the rook on the sixth rank (...Rh6) until the pawn advances, then checking from behind. Both this and the Lucena position belong in every player's long-term memory.
squares: h6
```

Key squares from [Chapter 18](#ch-18) are part of the same toolkit:

```board
fen: 8/8/8/8/4P3/4K3/8/k7 w - - 0 1
caption: With a pawn on e4, the key squares are d6, e6 and f6. If White's king reaches any of them, the pawn promotes whatever Black does.
squares: d6 e6 f6
```

### Get feedback from people

A coach, a stronger club player or a study partner sees patterns in your games that you cannot. Even occasional lessons add the feedback that deliberate practice needs.

### Join a club or play over the board

Over-the-board chess adds a scoresheet, a real opponent, post-game analysis together and longer time controls. Clubs also give you training partners.

:::nextgame Your analysis assignment
Play one slow game this week. Within an hour of finishing, write notes at the three most important moments with the engine off. Then use the engine to find the first big swing, and make one journal entry with a FEN, a category and a rule. Review that entry tomorrow.
:::

## Practice at the board

1. **Analyze the worked example yourself.** FEN: `r1bq1rk1/ppp2p2/2np1n1p/2b1p1p1/2B1P2B/2PP1N2/PP3PPP/RN1Q1RK1 w - - 0 9`. Before you look at an engine, play 9.Nxg5 hxg5 10.Bxg5 on a board and try to find a way for White to bring a third attacker. Then check with an engine and see how Black defends.
2. **Spot the difference.** Set up the Greek gift diagram above (`r1bq1rk1/pp1nbppp/2n1p3/2ppP3/3P4/2PB1N2/PP3PPP/RNBQ1RK1 w - - 0 9`) and Exercise 28-08's position side by side. Write one sentence explaining why the sacrifice works in one and fails in the other.
3. **Your first ten journal entries.** Take your last five slow games, analyze them using Steps 1 to 4, and log at least ten mistakes with FENs and categories. Fill in the weakness list template.
4. **Build a mixed set.** From your journal and this book's exercises, build a set of twelve positions with at least four different categories. Shuffle them, solve them, and schedule the reviews at 1, 3, 7 and 21 days.
5. **Learn two endgames for life.** Set up the Lucena and Philidor positions above. Play each side against an engine until you can win the Lucena and hold the Philidor three times in a row without hesitation.

## Chapter summary

* Analyze in the right order: your own thoughts first, then turning points, then the engine.
* Use one fixed list of mistake categories (hanging-piece, missed-tactic, missed-mate, king-safety, calculation, opening, endgame, missed-win, conversion, positional, time-psychology), and record the deeper cause.
* Read evaluations in bands; ignore differences of a few tenths; look for the first big swing; ask why your move was bad and why you missed the better one.
* Keep a mistake journal with a FEN, a category and a rule in your own words for every significant mistake.
* Prioritize training with a weakness list: frequency × cost.
* Turn mistakes into exercises, review them on an expanding schedule such as 1, 3, 7 and 21 days, and mix themes when you review.
* Deliberate practice, retrieval practice, spacing and interleaving are well-supported learning principles, but none of them guarantees a rating, and people improve at different speeds.
* Ratings, puzzle ratings, accuracy scores and single-game estimates are different measurements; judge your progress by trends and by your games.

:::cheat The post-game procedure
1. Engine off: write your thoughts at the three most important moments.
2. Mark the turning points: discomfort, long thinks, material or structure changes.
3. Engine on: find the first big swing (about a pawn or more); ignore small differences.
4. For each real mistake, ask why, choose one category, and write a rule in your own words.
5. Log it in the journal with a FEN, and schedule reviews at 1, 3, 7 and 21 days.
6. Every ten to twenty games, update the weakness list and train the top category.
:::

@exercises
