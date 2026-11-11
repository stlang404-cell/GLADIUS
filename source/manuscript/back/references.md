---
kind: back
slug: references
title: Further Reading and References
---

This section lists the research the book relies on, a short list of chess books for each stage, and the free tools that work best with the book's exercises. It ends with a note on how claims in the book were labelled and checked.

## Learning-science and chess-expertise references

These are the studies cited in the book's evidence boxes. Each is a published work; the book uses them for their general findings, not for precise numbers.

* Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks: A review and quantitative synthesis. *Psychological Bulletin*, 132. (Spacing: spreading practice out improves long-term retention.)
* Charness, N., Tuffiash, M., Krampe, R., Reingold, E., & Vasyukova, E. (2005). The role of deliberate practice in chess expertise. *Applied Cognitive Psychology*, 19. (Serious solitary study as a strong predictor of chess skill.)
* Chase, W. G., & Simon, H. A. (1973). Perception in chess. *Cognitive Psychology*, 4. (Strong players perceive familiar patterns, or chunks.)
* de Groot, A. D. (1965). *Thought and Choice in Chess*. The Hague: Mouton. (English edition of the classic think-aloud study of chess players.)
* Ericsson, K. A., Krampe, R. T., & Tesch-Römer, C. (1993). The role of deliberate practice in the acquisition of expert performance. *Psychological Review*, 100. (The original description of deliberate practice.)
* Kornell, N., & Bjork, R. A. (2008). Learning concepts and categories: Is spacing the "enemy of induction"? *Psychological Science*, 19. (Interleaving examples improves classification of new cases.)
* Macnamara, B. N., Hambrick, D. Z., & Oswald, F. L. (2014). Deliberate practice and performance in music, games, sports, education, and professions: A meta-analysis. *Psychological Science*, 25. (Practice matters, but explains only part of the differences between people.)
* Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning: Taking memory tests improves long-term retention. *Psychological Science*, 17. (Retrieval practice: testing yourself beats re-reading.)
* Rohrer, D., & Taylor, K. (2007). The shuffling of mathematics problems improves learning. *Instructional Science*, 35. (Mixed practice outperforms blocked practice on later tests.)

## Recommended chess books by stage

All of these are well-known books that have stayed in print or in wide use for years. Pick one or two per stage; you do not need them all. The one-line reasons are coaching judgment.

### Stage 1 (400–600): rules, safety and first mates

* **Yasser Seirawan, *Play Winning Chess*** (first book of Seirawan's *Winning Chess* series). A friendly, clear introduction to the ideas behind the moves.
* **László Polgár, *Chess: 5334 Problems, Combinations and Games*.** A huge collection; its many mate-in-one and mate-in-two problems are ideal daily practice at this stage and the next.

### Stage 2 (600–800): basic tactics and a first repertoire

* **Yasser Seirawan, *Winning Chess Tactics*.** Explains each tactical motif with clear examples before testing you.
* **Dan Heisman, *Everyone's 2nd Chess Book*.** Practical advice on safety, thinking habits and the mistakes that decide games below 1200.

### Stage 3 (800–1000): thinking, calculation and conversion

* **Irving Chernev, *Logical Chess: Move by Move*.** Complete games with every move explained in plain language; excellent for learning why moves are played.
* **Yasser Seirawan, *Winning Chess Strategies*.** The strategic companion to the tactics volume, at the right level for this stage.

### Stage 4 (1000–1200): activity, structure, plans and rook endings

* **José Raúl Capablanca, *Chess Fundamentals*.** A short classic on endings, middlegame principles and planning by a world champion.
* **Jeremy Silman, *Silman's Complete Endgame Course*.** Endgames organized by rating level, so you learn exactly what you need now and what can wait.

### Stage 5 (1200–1500) and beyond

* **Jesús de la Villa, *100 Endgames You Must Know*.** The essential theoretical endings, including Lucena and Philidor, explained carefully.
* **Axel Smith and Hans Tikkanen, *The Woodpecker Method*.** A large tactics collection designed for repeated solving cycles; best started near the end of this stage.
* **Alexander Kotov, *Think Like a Grandmaster*.** A classic on candidate moves and calculation; read it after Chapters 14, 15 and 24.
* **Aron Nimzowitsch, *My System*.** The famous classic on positional concepts such as blockade, prophylaxis and the open file. Demanding but rewarding once you are comfortable with Chapters 19–25.

## Free tools

### Lichess (lichess.org)

* **Analysis board** (lichess.org/analysis): set up any position, play moves, and switch the engine on or off with one click. To load a position from this book, paste its FEN into the FEN field below the board.
* **Studies** (lichess.org/study): create chapters with positions, comments and questions. A study with one chapter per journal entry is an easy way to store and review your own mistakes (Chapter 28).
* **Puzzle themes** (lichess.org/training/themes): puzzles filtered by theme, such as fork, pin, back-rank mate or endgame, which makes it easy to practise one weakness or to build a mixed set.
* **Practice against the computer and game analysis:** after any game, the analysis view shows engine evaluations; use it only after you have written your own notes.

### Chess.com (chess.com)

* **Analysis board:** paste a FEN or PGN into the load option of the analysis tool to set up a position.
* **Puzzles and lessons:** large puzzle collections and themed lessons; the free tier is enough to support this book.

### How to load a FEN anywhere

A FEN is one line of text such as `r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3`. In almost every chess app, look for an option called "Load FEN", "Set up position", "Paste FEN" or "Board editor". Copy the whole line, including the part after the first space: it says whose move it is, which castling rights remain and whether en passant is possible. If an app refuses the FEN, check that you copied every character.

## Evidence vs. coaching judgment in this book

The book distinguishes two kinds of advice.

* **Established evidence** is marked in `evidence` boxes and always names a real, published source (listed above). These sources mostly study learning and memory in general, or chess expertise in general. Applying them to an adult improving from 400 to 1500 is a reasonable extension, and the book says so where it matters; none of them promises a particular rating.
* **Coaching judgment** is marked in `coach` boxes or labelled in the text. It covers practical rules such as the 1-3-7-21 day review schedule, time budgets for a clock, the "stop after two losses in a row" rule and the frequency-times-cost weakness list. These are the author's recommendations based on common teaching practice, not research findings. Treat them as starting points and adjust them to your own experience.

Ratings mentioned in the book are milestones, not promises, and statistics have not been invented: where no reliable figure exists, the book gives none.

Every position and move sequence in the book was checked by computer. Legality, notation and the correct side to move were verified with the python-chess library, and every exercise solution, every "wrong answer" and every engine-checked line was evaluated with the Stockfish 18 engine. Illustrative positions described as "from a student's game" are constructed teaching positions, not records of real games; real games are only quoted where the players, year and moves are certain.
