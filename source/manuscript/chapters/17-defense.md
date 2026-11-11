---
chapter: 17
slug: defense
title: Defense and Resourcefulness
subtitle: Making your opponent earn the point
part: 3
stage: "800–1000"
skills: [defense, perpetual, stalemate, practical]
objectives:
  - Name the opponent's threat before choosing a move, every time.
  - Choose from the full defensive menu - capture, move, defend, block, counter-attack, interpose with tempo.
  - Prefer active defence and avoid trades that help the opponent, especially into lost pawn endings.
  - Recognize saving resources - perpetual check, stalemate and simple fortresses.
  - Keep creating practical chances when behind, and decide honestly when to resign.
next_game: Every time your opponent moves, ask "What does this threaten?" and, when you are worse, look for checks, counter-threats and drawing resources before you defend passively.
---

You are a piece down in move 25. Your opponent's rooks are coming, and your first instinct is to trade everything and hope, or to resign. Five moves later the game is over.

At the 800–1000 level, games are rarely won by perfect play. They are won by the player who makes the second-to-last mistake. That means defence matters as much as attack: every move you make your opponent find is another chance for them to go wrong. Good defenders are not passive. They spot threats early, answer them with the most useful move, avoid trades that help the opponent, and know the saving tricks of chess: perpetual check, stalemate and the fortress. This chapter teaches that toolkit and the attitude that goes with it.

## Step one: name the threat

You cannot defend against a threat you have not seen. The safety scan from [Chapter 4](#ch-04) and the move-selection routine from [Chapter 14](#ch-14) both start with the same question, and it is the heart of defence: **after my opponent's move, what does it threaten?**

Ask it in a fixed order:

1. Does the move give check, or prepare a check?
2. Does it capture, or threaten to capture, something of mine?
3. Does it threaten mate or a tactic (fork, pin, discovered attack)?
4. What did the moved piece stop defending, and what new lines did it open?

A **threat** is a move your opponent wants to play next that would hurt you. Some threats are loud (an attacked queen), some are quiet (a rook that will land on your back rank). Say the threat out loud in your head, in words: "He threatens Qxf7 mate." Players who name the threat almost never blunder into it; players who only "feel" it often do.

:::nextgame Say the threat
In your next game, after every move by your opponent, finish the sentence "This threatens ..." before you look at your own ideas. If the answer is "nothing", say that too.
:::

## The defensive menu

Once the threat is named, you have a menu of possible answers. Beginners usually see only one item on it (move the attacked piece away). Strong defenders check all of them and pick the best.

1. **Capture the attacker.** If the attacking piece can be taken safely, that is often the strongest answer, because it removes the threat and wins material.
2. **Move the target.** Step the attacked piece to a safe and, ideally, useful square.
3. **Defend the target.** Add a defender so that the capture loses material for your opponent.
4. **Block the line.** Put something between a long-range attacker and its target.
5. **Counter-attack.** Make a threat of your own that is at least as big as theirs.
6. **Interpose with tempo.** Block or defend with a move that also attacks something, so your opponent has to spend a move answering you.

Check them in roughly this order, captures and forcing moves first, as you would in any candidate-move search. Then compare the candidates by asking which one leaves your position best.

```board
fen: r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3
caption: White threatens Qxf7#. Black has several good answers: ...g6 blocks the queen's line and attacks it, ...Qe7 or ...Qf6 defends f7, ...Nh6 also defends. The natural developing move ...Nf6?? ignores the threat.
arrows: g7g6 d8e7
red: h5f7 c4f7
squares: f7
orientation: black
```

Each menu item is available here. The best is the one that does two jobs: 3...g6 blocks the h5–f7 line *and* attacks the queen, so White must move it again. That is interposing with tempo.

```line
fen: startpos
moves: 1.e4 e5 2.Bc4 Nc6 3.Qh5 g6 4.Qf3 Nf6
check: engine
caption: After 3...g6 4.Qf3 the queen renews the threat on f7, and 4...Nf6 blocks again while developing. Black is already comfortable.
```

```line
fen: startpos
moves: 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7#
caption: The classic Scholar's Mate. 3...Nf6 attacks the queen but ignores the bigger threat.
```

### Interposing with tempo

The last item on the menu deserves extra attention because it is so efficient. When a long-range piece (queen, rook or bishop) attacks along a line, look for a blocking move that also creates a threat. A pawn that blocks and attacks the checking piece, a knight that interposes and forks, a bishop that blocks a check and pins: each of these defends and wins a tempo in the same move. The same idea works against checks. When you are checked, the three answers are to move the king, capture the checking piece, or interpose. Before you move the king, always look for a capture or a blocking move that also attacks something.

### The size of a counter-attack

A counter-attack only works if your threat is at least as big as the one you are ignoring. A threat to win a queen does not help if your opponent can mate you first. A threat to win a knight does not help if your opponent wins your queen. Before you choose a counter-attack, compare the two threats honestly: whose threat lands first, and what is it worth?

:::mistake The irrelevant counter-threat
A common pattern at this level: your opponent threatens mate, you see a nice attack on their queen, and you play it. They give mate. Always ask "Is my threat bigger, or does theirs come first?" Mate is bigger than everything; check is faster than everything.
:::

### When two pieces are attacked

Sometimes the threat is a double attack: a fork or a pawn hitting two of your pieces at once. The menu still applies, but two items become especially important.

* **The desperado.** If one of the attacked pieces is lost anyway, let it capture something on its way out, ideally with check. Your opponent must recapture, and you gain the time to save the other piece.
* **The in-between move.** Before you recapture or retreat, ask whether you have a check or a bigger threat first (a **zwischenzug**, German for "in-between move"). Forcing moves change the order of events, and the order of events decides who wins material.

Both ideas come from the same habit: before you accept that you must lose something, look at every forcing move you have.

## Defend actively

When two defences both hold, prefer the active one: the move that keeps your pieces working, creates counterplay or gains time. Passive defence (pieces huddled around a weakness) tends to get worse with every move, because the attacker can keep adding pressure while you have nothing to do.

### Worked example: a knight under attack

This position comes from the Scotch Game, which you may play as Black ([Chapter 13](#ch-13)). White has just played 6.e5, attacking the knight on f6.

```board
fen: r1bqkb1r/p1pp1ppp/2p2n2/4P3/8/8/PPP2PPP/RNBQKB1R b KQkq - 0 6
caption: White's e-pawn attacks the knight. Retreat it, or find something more active? Notice the open e-file and the white king on e1.
red: e5f6
arrows: d8e7
orientation: black
```

Here is how to think it through.

**First I name the threat.** The pawn attacks my knight; next move it will take it. There is no check or mate threat.

**Then I list the menu.** I cannot capture the attacker. Moving the knight gives four candidates: ...Nd5, ...Ne4, ...Ng8, ...Nh5. Defending the knight does not help, because the attacker is a pawn: if it takes, I lose a knight for a pawn anyway. Blocking is impossible. That leaves counter-attack.

**Next I look for a counter-attack.** The e5-pawn stands on the e-file in front of the white king. If I put my queen on e7, the pawn is pinned: exf6 would expose the king to check, so it is illegal. The queen also attacks e5 itself.

**Now I check White's best reply.** White must defend the pawn and the king's file. The usual answer is 7.Qe2, blocking the file. Then my knight can retreat to d5 at leisure, and my queen already stands on an active square.

**Finally I compare.** The retreat 6...Nd5 is also playable, but 6...Qe7 gains a tempo and keeps more options. The passive 6...Ng8 just loses time.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 Nf6 5.Nxc6 bxc6 6.e5 Qe7 7.Qe2 Nd5 8.c4 Ba6
check: engine
diagram: end
caption: Black's pieces are active: the knight is safe, the bishop pins the c4-pawn to the queen, and White must keep watching the e-file.
```

The lesson is not this particular line. It is the routine: name the threat, run the whole menu, look for a counter-attack, check the opponent's best reply, and then compare.

## Do not panic-trade

When you are under pressure, trading pieces feels like relief. Sometimes it is: trading your opponent's most dangerous attacking piece is often the best defence of all. But trades are not automatically good for the defender. Ask what each trade does.

* **Trades that help you:** removing an attacker near your king, removing the piece that creates a threat, or reaching an ending your opponent cannot win (for example a known draw).
* **Trades that help your opponent:** any trade when you are behind in material (the side ahead wants simplification, as you saw in [Chapter 16](#ch-16)), trading your active pieces for their passive ones, and above all trading into a lost pawn ending.

```board
fen: 3r4/4kp2/4p1p1/7p/7P/6P1/5PK1/3R4 w - - 0 1
caption: White is a pawn down. With rooks on, an active rook gives White a comfortable draw. After 1.Rxd8? Kxd8 the pawn ending is lost: Black's king and extra pawn decide.
red: d1d8
orientation: white
```

In rook endings, the defender's rook is usually the reason the position holds. A pawn down with rooks on, you have checks, counterattacks on pawns and the chance to cut the enemy king off. In the pawn ending you have none of these. [Chapter 18](#ch-18) shows how to calculate pawn endings; the defensive rule is simple: **never trade into a pawn ending you have not calculated, and especially not when you are behind.**

The same logic applies in the middlegame. If your opponent is attacking your king, trading their most active attacker (often the queen) is excellent defence, even at a small cost. If instead your opponent is a piece up and offers to trade queens, that trade helps them, because your best chance was counterplay with the queen. So before every trade, ask one question: "After this exchange, whose pieces are left, and who is happier?"

:::key When simplification helps the opponent
Trades help the side with more material, the side with the better pawn structure, and the side whose king is more active. If that is your opponent, keep pieces on and look for activity.
:::

## Saving resources

Sometimes the position is objectively lost, but chess has a few escape hatches. They come up in real games far more often than you might think, mostly because the winning side relaxes.

### Perpetual check

**Perpetual check** is a series of checks the opponent cannot escape. The game is drawn, usually by threefold repetition. You look for it when the enemy king has few safe squares and your queen (sometimes with a rook or knight) can reach checking squares that cover them all.

```board
fen: 8/1p4pk/p7/8/8/1P6/q1r2PPP/3Q2K1 w - - 0 1
caption: White is a rook down and Black threatens ...Rc1. But the black king has only h7 and g8. 1.Qh5+ Kg8 2.Qe8+ Kh7 3.Qh5+ is perpetual check.
arrows: d1h5 h5e8
squares: g8 h7
orientation: white
```

```line
fen: 8/1p4pk/p7/8/8/1P6/q1r2PPP/3Q2K1 w - - 0 1
moves: 1.Qh5+ Kg8 2.Qe8+ Kh7 3.Qh5+ Kg8 4.Qe8+
check: engine
caption: Black cannot block on h6 or f8 and cannot run. The position repeats and the game is drawn.
```

How do you find perpetuals? When you are worse, scan for checks every move, especially against a king whose pawn shield has been broken. List the enemy king's flight squares and ask whether two or three checking squares cover them all. Then check that the opponent cannot block a check with a piece. In the diagram, the tempting 1.Qd3+ also checks, but after 1...g6 the black king walks out via h6 and g5, and the perpetual is gone.

### Stalemate

**Stalemate** (no legal move, not in check) is a draw. When your king has no moves and your pawns are blocked, every remaining piece you own is a possible stalemate weapon: if you can force your opponent to capture it, the game is drawn.

```board
fen: k7/p1Q5/P7/1N6/3q4/7P/6P1/7K b - - 0 1
caption: Black is lost: White threatens Qb7# or Qb8#. But the black king has no legal move and the a7-pawn is blocked. 1...Qg1+! forces 2.Kxg1, and Black is stalemated.
arrows: d4g1
squares: a8
orientation: black
```

```line
fen: k7/p1Q5/P7/1N6/3q4/7P/6P1/7K b - - 0 1
moves: 1...Qg1+ 2.Kxg1
check: engine
caption: Stalemate. Black also has other checks that draw here, but the queen sacrifice ends the game at once.
```

Stalemate is also the main defensive idea in many endings. One classic case: a queen against a pawn on the seventh rank on the a-, c-, f- or h-file is often a draw, because the defending king can hide in front of or beside the pawn where the attacker can only stalemate it.

```board
fen: 8/8/8/8/8/2Q5/p4K2/1k6 w - - 0 1
caption: Queen against a rook pawn on the seventh. If White checks, Black goes to a1; then any quiet approach by the white king is answered by stalemate. With the white king this far away, it is a draw.
squares: a1
orientation: white
```

### The fortress

A **fortress** is a defensive set-up the opponent cannot break, even with extra material. At this level, learn one simple fortress: a rook pawn with the "wrong" bishop.

```board
fen: 7k/8/7P/6K1/8/3B4/8/8 w - - 0 1
caption: White has an extra bishop and pawn, but the h-pawn queens on h8, a dark square, and the bishop is light-squared. The black king sits in the corner and can never be driven out. It is a draw.
squares: h8
orientation: white
```

The defender's job is simply to get the king to the corner square (or next to it) in time. If you are ever a piece down with only a rook pawn left for your opponent, check the colour of their bishop and the queening square: you may be able to draw by running to the corner.

:::evidence Theory note
The wrong-coloured bishop and rook pawn draw, and the queen against rook or bishop pawn on the seventh, are standard results covered in every endgame manual, for example Jeremy Silman, *Silman's Complete Endgame Course* (2007).
:::

## When you are behind

Being worse is not the same as being lost. The practical question is: how do I make winning as hard as possible for my opponent?

* **Seek activity.** An active piece is worth more than a pawn when you are defending. Put rooks on open files and behind passed pawns, and centralize your king in the endgame.
* **Create threats.** Every threat you make forces your opponent to stop and think, and gives them a chance to miscalculate. A passed pawn, an attack on a loose piece, or a check that drives the king to a worse square all count.
* **Keep pieces on.** As we saw, simplification helps the side that is ahead. Avoid trades unless they kill a direct attack or reach a known draw.
* **Look for your own tactics.** Run the safety scan for *your* side too: checks, captures and threats. Players who are winning often stop defending, and a resource such as a fork, a back-rank trick or a perpetual appears.
* **Avoid passive resignation of the mind.** Many games are lost not when the position becomes hopeless but when the defender stops looking. Keep using the full routine on every move.
* **Use the clock wisely.** Spend time on the critical defensive moments, not on obvious recaptures.

A practical example of the mindset: you are a rook down in a queen ending. Instead of trading queens (which ends your chances), keep your queen as active as possible near the enemy king, check whenever the king is exposed, and look for stalemate ideas if your own king is boxed in. Your opponent has to avoid all of that while also making progress. Many players with an extra rook cannot do both, and the game ends in a draw by perpetual check or a blunder.

:::coach Coaching judgment
In my experience at club level, a determined defender saves a large share of "lost" positions, because the opponent relaxes, rushes or tries to win too fast. Your job is to keep asking questions they must answer correctly.
:::

## Finding defensive moments in your own games

When you analyze your games (the full method comes in [Chapter 28](#ch-28)), mark three kinds of defensive moments.

* **Missed threats.** The move where your opponent's threat appeared and you did not name it. Write down what the threat was and which item on the menu would have met it.
* **Wrong choice from the menu.** You saw the threat but chose a passive answer when an active one existed, or a counter-attack that was too small.
* **Missed resources.** In games you lost, go back to the moment the position became bad and ask an engine whether a perpetual, a stalemate trick, a fortress or simply a more stubborn defence was available.

Record these under "king-safety", "missed-tactic" or "endgame" in your mistake journal. After a dozen games you will see your personal pattern, and that pattern tells you what to drill. Many players discover that they defend well when they are calm but stop scanning for threats the moment they get ahead, which is exactly when opponents start to swindle them.

## When to resign

Resigning is part of chess etiquette, and there is no shame in it. But at the 800–1000 level the honest advice is: **resign rarely.** Positions that look hopeless to you are often not yet won for your opponent, and the experience of defending a bad position is itself valuable training.

Some guidelines (coaching judgment, not rules):

* If your opponent still has to show technique (for example, convert a piece-up middlegame), play on and make them prove it.
* If you are down a queen or more with no counterplay, and your opponent has shown they can deliver checkmate, resigning is reasonable and polite.
* Do not play on purely to waste your opponent's time, and do not wait for an obvious mate in one to be played. Resigning a clearly finished game is a courtesy.
* In casual or online games, use lost positions as training: try to find the most stubborn defence, then resign once nothing is left.

Whatever you decide, decide with a clear head. Never resign because you are annoyed by a mistake you just made; take a breath, look for resources, and then judge the position.

## Practice at the board

Defence is trained by defending. Set up these positions against a friend or an engine and play the defending side until you can hold or swindle consistently.

* **The menu.** Set up `r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3`. Write down every legal defence of f7 you can find, then check them with an engine. Which ones also develop or gain a tempo?
* **Perpetual.** Set up `8/1p4pk/p7/8/8/1P6/q1r2PPP/3Q2K1 w - - 0 1` and play White against an engine. Find the perpetual; then try other first moves and see how quickly you lose.
* **Rook ending vs pawn ending.** Set up `3r4/4kp2/4p1p1/7p/7P/6P1/5PK1/3R4 w - - 0 1`. Play it twice as White against an engine: once trading rooks, once keeping them. Compare the results.
* **Fortress.** Set up `7k/8/7P/6K1/8/3B4/8/8 w - - 0 1` and try to win as White. Then move the black king to e7 and see whether it can still reach the corner in time.
* **Defend a lost position.** Take a game where you were winning, and play the losing side from the critical moment against an engine. Count how many moves you can survive and note every resource you find.

Check yourself afterwards with the engine: for each defensive move you chose, did a better item on the menu exist?

## Chapter summary

* Defence starts with naming the threat in words after every opponent move.
* Run the whole defensive menu: capture the attacker, move, defend, block, counter-attack, interpose with tempo.
* A counter-attack must be at least as big and as fast as the threat it ignores.
* Prefer active defence; passive positions usually get worse.
* Trades help the side that is ahead; never trade into a pawn ending you have not calculated.
* Perpetual check, stalemate and simple fortresses save many lost positions; look for them whenever you are worse.
* When behind, seek activity, create threats and keep pieces on; resign rarely, but courteously when nothing is left.

:::cheat Defensive routine
1. Name the threat: checks, captures, mate or tactics, and what the last move stopped defending.
2. List the menu: capture the attacker, move, defend, block, counter-attack, interpose with tempo.
3. Compare: is my counter-threat bigger and faster? Which defence also improves my position?
4. Before any trade, ask who the resulting position helps; calculate pawn endings first.
5. If you are losing, look for checks (perpetual), stalemate ideas and fortresses before playing on passively.
:::

@exercises
