---
chapter: 14
slug: how-to-think
title: "How to Think: Candidate Moves and the Move-Selection Routine"
subtitle: A short routine for every move, and a longer one for the moves that matter
part: 3
stage: "800–1000"
skills: [candidate-moves, blunder-check, prophylaxis, practical]
objectives:
  - Run a fixed move-selection routine on every move, from the opponent's idea to the final blunder check.
  - Build a list of two to four candidate moves instead of falling in love with the first idea.
  - Compare candidates by finding the opponent's best reply, not the reply you hope for.
  - Recognize critical moments that deserve extra thinking time.
next_game: On every move, ask "what does my opponent want?" first, and before you touch a piece, name at least two candidate moves and the opponent's best reply to the one you choose.
---

You know the tactics now. You can spot a fork, see a pin, and mate with a rook. And yet you still lose games to moves you "would have seen" in a puzzle. The reason is almost never missing knowledge. It is missing *procedure*: you looked at your own idea, liked it, and played it, without asking what your opponent wanted or whether a better move was available.

Between 800 and 1000, games are decided less by who knows more and more by who thinks in a more orderly way. This chapter gives you a routine — a short checklist you run on every move — and shows it working, move by move, inside a player's head. It is not complicated. The hard part is doing it *every time*, especially when you are sure you already know the answer.

## The move-selection routine

Here is the routine in full. The rest of the chapter explains each step and shows how it sounds in practice.

1. **What does my opponent want?** Look at the move just played. What does it attack, what does it threaten, what does it prepare?
2. **Safety scan.** Are any of my pieces loose (undefended) or attacked more often than they are defended? Is my king safe? This is the scan from [Chapter 4](#ch-04).
3. **Forcing moves for both sides.** List the checks, captures and threats available to *me* — and to *my opponent*, as if it were his move.
4. **Candidate moves.** Choose two to four moves worth considering seriously.
5. **Compare.** For each candidate, find the opponent's best reply. Pick the candidate whose worst case is best.
6. **Blunder check.** With the chosen move "played" in your head, run the safety scan once more on the new position.
7. **Play.** Then, and only then, touch the piece.

A **candidate move** is simply a move you decide to examine seriously. The term was made famous by the Soviet grandmaster and trainer Alexander Kotov, whose book *Think Like a Grandmaster* taught a generation to list candidates *before* calculating any of them. The point is to avoid analysing the first idea for ten minutes and then playing something else in a panic.

:::key The routine in one sentence
His idea, my safety, everyone's forcing moves, a short list, his best reply to each, one last check — then move.
:::

### Step 1: What does my opponent want?

Every move your opponent plays has a purpose. Sometimes it is a direct threat; sometimes it prepares a pawn break or brings a piece closer to your king. At this level the most common cause of lost games is simply not asking. A player sees his own plan so clearly that the opponent's last move becomes background noise.

Ask three short questions about the move just played: *What does the moved piece attack now? What did it stop defending? What line did it open?* The third question catches discovered attacks, which are invisible if you only look at the piece that moved.

```board
fen: r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4
caption: White has just played 4.Ng5. Knight and bishop both hit f7, and Nxf7 would fork the queen and the rook on h8.
red: g5f7 c4f7
squares: f7
orientation: black
```

Here the question "what does he want?" has a clear answer: Nxf7, forking queen and rook. Only now is it worth listing candidates. The routine move 4...Be7, played without asking, loses material. The standard answer is to block the bishop's diagonal with a counter-attack.

```line
fen: r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4
moves: 4...d5 5.exd5 Na5 6.Bb5+ c6 7.dxc6 bxc6
check: engine
caption: 4...d5 blocks the c4-bishop's line to f7 and fights back; Black gives a pawn but gains time against the bishop.
```

### Step 2: The safety scan

You learned the safety scan in [Chapter 4](#ch-04): checks, captures and threats against *you*. Inside the routine it has one extra job — it prevents the most painful kind of loss, the one where you never looked at your own loose piece. Run it after step 1, before you think about anything ambitious. It takes ten seconds in a quiet position.

```board
fen: r1bqk2r/pppp1ppp/2n2n2/8/1bBPP3/5N2/PP3PPP/RNBQK2R w KQkq - 1 7
caption: An Italian Game after 6...Bb4+. The safety scan starts with the check: White can block with the bishop or a knight, or give up castling with Kf1. Blocking keeps the king safe and develops a piece.
red: b4e1
blue: c1d2 b1d2
```

Two quick tests catch most problems. First, **loose pieces**: any piece of yours that is not defended can be hit by a fork or a double attack. Second, **counting**: for each attacked piece, count attackers and defenders. If the attackers outnumber the defenders, or if the cheapest attacker is worth less than your piece, you have a problem to solve before anything else.

### Step 3: Forcing moves for both sides

A **forcing move** is a check, a capture, or a threat that the opponent must answer. Forcing moves deserve to be looked at first because they limit the opponent's replies, which makes them easy to calculate and very often decisive.

Most players at this level do half of this step: they look at their own checks and captures. The other half is to look at *your opponent's* checks and captures as if it were his turn. That is how you notice that a back-rank mate is already threatened, or that the knight you want to move is the only defender of a key square. You will practise this in the exercises: several of them contain a capture that looks free until you ask what checks the opponent has afterwards.

:::mistake The free piece
When something is offered for nothing, ask one question before you take it: "After I capture, what are my opponent's checks?" Many opening traps, including Légal's mate, work only because the victim never asks.
:::

### Step 4: Build a short candidate list

Now choose the moves you will seriously consider. Two to four is the right number. One is too few — it means you are not comparing anything. More than four is usually a sign that you have not used the first three steps to filter.

Good candidates come from three sources:

* **Forcing moves** that survive a first look (step 3).
* **Answers to the opponent's idea** (step 1) — defending, blocking, counter-attacking or getting out of the way.
* **Plan moves** when nothing forcing is happening: develop a piece, improve the worst-placed piece, prepare a pawn break, put a rook on an open file.

The difference between a candidate list and **single-line fixation** is the whole point of this chapter. Single-line fixation means you see one idea, calculate it deeper and deeper, and never ask whether another move is better. The calculation may even be correct — but if you never compared it to anything, you have no idea whether it was the best use of your move.

### Step 5: Compare by the opponent's best reply

For each candidate, ask: *what is his best answer?* Not his most likely answer, not the answer you would like, but the one that hurts you most. Then compare the candidates by those worst cases.

This step is where "hope chess" turns into "real chess". The chess teacher Dan Heisman popularized the term **hope chess** for the habit of making a move and *hoping* the opponent does not have a good reply, instead of checking. In **real chess**, you check the opponent's forcing replies to every candidate before you play it. Hope chess sometimes wins against weaker players, which is exactly why it is so hard to give up. It loses to anyone who looks.

```line
fen: startpos
moves: 1.e4 e5 2.Qh5?! Nc6 3.Bc4 g6 4.Qf3 Nf6
check: engine
diagram: end
caption: Hope chess in its purest form. White "hopes" for Qxf7#; after Black's best replies the queen has been chased around and Black is developing with gain of time.
```

The early queen attack is the classic example. It sets a threat, and if Black misses it the game ends at once. But against the best reply — here 3...g6 and 4...Nf6 — White has spent three moves on the queen and Black is happily ahead in development. A player doing real chess would ask "what if he defends correctly?" before 2.Qh5 and see that the answer is "I am worse."

### Step 6: The blunder check

You have chosen a move. Before you play it, imagine it on the board and run the safety scan again on the *new* position. This is the **blunder check**. It catches a very specific kind of error: the move you calculated so carefully also leaves something else undefended, or opens a line to your own king.

The blunder check is quick — ten to twenty seconds — and it is the single most valuable habit in this book. Make it physical if that helps: sit on your hands, or keep the hand off the board until you have said "blunder check done" to yourself.

### Step 7: Play — and use your opponent's time

Then play the move. Do not change your mind at the last second for a move you have not checked; that is how a careful routine produces a careless blunder. While your opponent thinks, start step 1 for his likely replies. You will often find you have already done half the work when he moves.

## A worked example: the full monologue

Here is the routine in action in a quiet opening position from your Italian Game repertoire ([Chapter 12](#ch-12)). Nothing dramatic is happening — which is exactly when players drift into hope chess.

```board
fen: r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7
caption: The Giuoco Pianissimo after 6...O-O. White to move. Nothing is attacked, which is exactly when the routine matters most.
arrows: f3g5
blue: f1e1 h2h3
```

:::example Thinking it through
*"Step 1 — what did he want with 6...O-O? He tucked the king away and connected his rook to f8. No new threat. But I should remember his usual ideas: ...Bg4 pinning my knight, and ...Na5 to swap off my good bishop.*

*Step 2 — safety. Everything of mine is defended. My king is castled. Fine.*

*Step 3 — forcing moves. Mine: Bxf7+ Rxf7 gives a bishop for a pawn — no. Ng5 threatens Nxf7. His: no checks, no captures that win anything.*

*Step 4 — candidates. Ng5, because it is aggressive. h3, to stop ...Bg4. Re1, to support e4 and prepare Nbd2-f1. Bb3, to take the bishop off the c4-square before ...Na5 arrives.*

*Step 5 — compare. Ng5: his best reply is ...h6. Then my knight must go back to f3 and I have lost two tempi for nothing. That is hope chess — it only works if he blunders. h3, Re1 and Bb3 are all calm plan moves; his best replies don't hurt me. I'll play h3, because ...Bg4 is the most annoying idea he has.*

*Step 6 — blunder check. After h3, does anything hang? No. Does it weaken my king? The g3-square a little, but nothing can reach it. OK."*
:::

```line
fen: r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7
moves: 7.Ng5?! h6 8.Nf3
check: engine
caption: The "attacking" candidate fails to the best reply. After 7...h6 the knight goes home, and Black has gained a useful move for free.
```

Notice how short each step is. The whole monologue takes perhaps a minute. The only step that took real thought was step 5, and it took thought precisely because one candidate (Ng5) looked attractive until the opponent's best reply was checked.

## "When you see a good move, look for a better one"

There is a saying often attributed to Emanuel Lasker: *when you see a good move, look for a better one.* It describes a trap that catches strong and weak players alike: stopping the search the moment you find something that works. Psychologists call this **satisficing** — accepting the first option that is "good enough" instead of looking for the best.

```board
fen: rnbqk2r/ppp1bppp/4pn2/1N1p4/3P1B2/8/PPP1PPPP/R2QKBNR w KQkq - 2 5
caption: Black has just played 4...Be7?, ignoring the threat to c7. White to move. Bxc7 wins a pawn with an attack on the queen — but is there something better?
arrows: b5c7
blue: f4c7
squares: a8 e8
```

The first good move most players see is 5.Bxc7, winning a pawn and hitting the queen. It is good. But it is not the best. The check 5.Nxc7+ forks king and rook, and after the king moves White takes the rook on a8. Checks come first on the candidate list for exactly this reason.

```line
fen: rnbqk2r/ppp1bppp/4pn2/1N1p4/3P1B2/8/PPP1PPPP/R2QKBNR w KQkq - 2 5
moves: 5.Nxc7+ Kf8 6.Nxa8
check: engine
caption: The fork wins the rook on a8. Even if the knight is later lost in the corner, White has won the exchange and a pawn, far more than the single pawn won by 5.Bxc7.
```

There is a practical limit, of course. You do not need to look for a better move than a forced mate, and in a calm position you do not need to compare twelve decent plan moves. A useful rule: if your move wins material or creates a big threat, spend one more minute specifically looking for checks and captures you have not yet examined. That one minute pays for itself many times over.

:::coach Coaching judgment: how many candidates?
In my experience, two candidates are usually enough in a quiet position and three or four in a sharp one. The goal is not to find more moves, but to make sure the move you play has beaten at least one real rival.
:::

:::evidence What strong players actually do
In his classic study of chess thinking, the Dutch psychologist Adriaan de Groot (*Thought and Choice in Chess*, English edition 1965) asked players of different strengths to think aloud. The strongest players did not examine dramatically more moves than weaker ones; the main difference was that the good moves showed up in their thinking earlier. A candidate list built from forcing moves, threats and plans is a way of steering your attention toward those moves.
:::

## When to think long and when to move quickly

You cannot spend ten minutes on every move; in a 30-minute game you would lose on time by move 20. The routine has a *short version* for routine moves — opponent's idea, safety scan, blunder check — and a *long version* for **critical moments**. Learning to tell them apart is a skill in itself.

A critical moment is a point where the character of the game can change. The most common ones are:

* **Captures and recaptures.** Every exchange changes the pawn structure or the balance of pieces. "Which way do I recapture?" is a classic critical decision.
* **Checks** — yours and your opponent's — because they force replies and can change the position quickly.
* **Pawn breaks and pawn moves near your king.** Pawns cannot move back; a careless pawn move is permanent.
* **Changes in the structure**, such as opening a file or giving up the bishop pair.
* **Transitions to the endgame**, especially trading the last pair of pieces into a king and pawn ending.

```board
fen: r1bq1rk1/ppp2pp1/2np1B1p/2b1p3/2B1P3/2PP1N2/PP3PPP/RN1Q1RK1 b - - 0 8
caption: White has just captured on f6. Recapturing with the queen keeps Black's kingside intact; recapturing with the g-pawn opens Black's own king. A recapture is a critical moment.
arrows: d8f6
red: g7f6
orientation: black
```

Here Black has two recaptures. 8...Qxf6 is natural and good: the queen is active and the kingside pawns stay together. 8...gxf6? is not a blunder in the tactical sense, but it gives White a long-term target in front of Black's king — and the engine judges it more than a pawn and a half worse. A five-second "recapture with the queen, obviously" is fine here; but you should at least *notice* that the choice exists.

:::nextgame Flag your critical moments
In your next game, every time a capture, check or pawn break is possible for either side, say to yourself "critical" and use the long routine. For other moves, use the short routine and save your clock.
:::

### Endgame transitions

The moment when you can trade the last pieces is one of the most important critical moments of all, because the evaluation can jump from "slightly better" to "completely winning" — or to "dead draw". [Chapter 16](#ch-16) is about this kind of decision. For now, simply notice it: before any trade that leaves only kings and pawns, stop and count.

```board
fen: 3k4/5p1p/6p1/8/P7/4K1P1/5P1P/8 w - - 0 36
caption: After a rook trade, White's outside passed a-pawn decides the king and pawn ending. Before trading, you must be sure that this is the position you are getting.
arrows: e3e4
squares: a4
```

## Common thinking errors and how to spot them in your games

When you analyse your games (see [Chapter 28](#ch-28)), you will find that most of your mistakes fall into a small number of thinking errors. Naming them makes them easier to fix.

* **Skipping step 1.** You played your plan without asking what his last move did. *Symptom in your games:* "I didn't see his threat."
* **One-candidate thinking.** You played the first move you liked. *Symptom:* the engine's best move was something you never considered at all.
* **Hope chess.** You calculated your idea assuming a convenient reply. *Symptom:* "I thought he would take."
* **Ignoring his forcing moves.** You checked your own checks and captures but not his. *Symptom:* a back-rank mate or fork "out of nowhere".
* **No blunder check.** You calculated a line and then played a different move, or the right move with a hanging piece elsewhere. *Symptom:* a one-move blunder in a position you understood.
* **Clock panic.** You spent ten minutes on a quiet move and then rushed the critical one. *Symptom:* the big mistake comes right after a long think.

:::drill The two-candidate drill
Play a training game (any time control of 15 minutes or more) in which you are not allowed to move until you have said two candidate moves and the opponent's best reply to each, out loud or on your score sheet. It will feel slow. After ten such games the habit starts to run by itself.
:::

## Practice at the board

Set up each position on a board or in any free chess app's analysis mode. Do not move pieces while you think. Write your answers to the routine on paper: his idea, your safety, forcing moves for both sides, your candidates, his best reply to each, your choice. Then check with an engine.

1. **The Fried Liver threat.** FEN `r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4`. Black to move. Name White's threat in one sentence, then list three candidates. Check that 4...d5 is one of them and compare it with 4...Nxe4.
2. **A quiet Italian.** FEN `r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7`. White to move. Write a full monologue in the style of the worked example. Then let the engine show you its top three moves; were your candidates among them?
3. **Look for the better move.** FEN `rnbqk2r/ppp1bppp/4pn2/1N1p4/3P1B2/8/PPP1PPPP/R2QKBNR w KQkq - 2 5`. White to move. Find two moves that win material, and decide which is better *before* you check.
4. **Recapture choices.** FEN `r1bq1rk1/ppp2pp1/2np1B1p/2b1p3/2B1P3/2PP1N2/PP3PPP/RN1Q1RK1 b - - 0 8`. Black to move. Play out 8...Qxf6 and 8...gxf6 for a few moves each against the engine and notice where White's pieces go in the second case.

How to check yourself: the routine is working when your written candidate list usually contains the engine's best move, even if you did not choose it. If the best move is regularly *not on your list*, slow down at step 3 and step 4.

## Chapter summary

* Use the same routine on every move: his idea, safety scan, forcing moves for both sides, candidates, compare by his best reply, blunder check, play.
* Step 1 — "what does my opponent want?" — prevents more lost games than any tactic you know.
* A candidate list of two to four moves protects you from single-line fixation.
* Compare candidates by the opponent's *best* reply. Hope chess assumes a convenient reply; real chess checks.
* When you find a good move, spend one more minute looking for a better one, starting with checks.
* Spend your time on critical moments: captures, checks, pawn breaks, structural changes and endgame transitions.
* The blunder check — one more safety scan with your move "played" — is the most valuable ten seconds of every move.

:::cheat The move-selection routine
1. What does my opponent's last move attack, threaten or prepare?
2. Safety scan: loose pieces, counted attacks, my king.
3. Forcing moves — checks, captures, threats — for me *and* for him.
4. Choose 2–4 candidate moves (forcing moves, answers to his idea, plan moves).
5. For each candidate, find his best reply; pick the move whose worst case is best.
6. Blunder check the new position, then play — and think on his time.
:::

@exercises
