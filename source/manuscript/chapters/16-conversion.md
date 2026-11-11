---
chapter: 16
slug: conversion
title: Converting a Winning Position
subtitle: How to win a won game
part: 3
stage: "800–1000"
skills: [conversion, endgame-technique, king-pawn-endgame, prophylaxis, stalemate]
objectives:
  - Turn a material advantage into a win by reducing counterplay before grabbing more.
  - Decide which trades help you (pieces, especially active ones) and which do not (usually pawns).
  - Simplify into won king and pawn endings, and check them by counting first.
  - Avoid stalemate tricks and survive the opponent's desperate counterattack.
  - When you are the one behind, avoid the simplifications that help your opponent.
next_game: When you are ahead in material, ask before every move "what is his counterplay, and how do I take it away?" — and before every trade, ask "does this trade make his counterplay smaller or my win easier?"
---

You are a piece up. The hard part is over — or so it feels. You relax, you grab another pawn, and your opponent, who has nothing to lose, throws everything at your king. Three moves later you are fighting for a draw, or worse. Every player at this level has a game like that. Many have dozens.

**Conversion** is the process of turning an advantage into a win. It is a different skill from winning material, and it has its own rules. The good news is that those rules are simpler than tactics: take away counterplay, trade the right pieces, keep your king safe, and use your king in the endgame. This chapter shows how, and also what to do when you are on the other side of the board.

## The converting mindset

When you are winning, your opponent's only hope is **counterplay**: threats against your king, an active piece, a dangerous passed pawn, or a trick such as stalemate or perpetual check. Your job changes. You no longer need to find the strongest attacking move; you need to find the move that leaves him the fewest chances.

In practice this means three habits:

* **Ask what he wants, every move.** The routine from [Chapter 14](#ch-14) does not stop when you are winning; it matters more, because your opponent will now look for tricks.
* **Prefer safe to spectacular.** A clean line that wins in thirty moves is better than a brilliant one that wins in ten if you have miscounted.
* **Don't grab more if consolidation wins.** An extra piece wins on its own. A second extra pawn is nice, but not if it costs you a tempo that lets his attack start.

:::key The converter's question
"What is his best counterplay, and which move takes it away?" Ask it before every move when you are ahead.
:::

## A worked example: choosing the cleanest path

```board
fen: 8/5p1p/p1rk2p1/8/1P6/P2K2P1/5P1P/2R5 w - - 0 35
caption: White to move, a pawn up. Black's rook is active on the c-file. Several moves keep the advantage; one converts at once.
arrows: c1c6
squares: a3 b4 a6
```

:::example Thinking it through
*"What does Black want? His rook on c6 offers a trade, and if I avoid it, he will play ...Rb6 or ...Rc4 to attack my queenside pawns. His king is close to the centre.*

*Safety scan: my b4-pawn is defended by the a3-pawn, my king is fine — but my rook on c1 is attacked by his rook and defended by nothing! So whatever I do, I must deal with ...Rxc1.*

*Forcing moves: Rxc6+ is a capture with check. His forcing move is ...Rxc1, which is exactly the problem I just found.*

*Candidates: (a) Rxc6+ Kxc6, going into the king and pawn ending; (b) Rc2 or Rc4, keeping the rooks.*

*Compare. After (b), Black's rook stays active and I have to defend my pawns; my advantage is real but slow. After (a), count the pawn ending: I have two queenside pawns against one, so I can make a passed pawn there. My king gets to c4 first and keeps his king from advancing. Black's king will have to deal with my passed pawn, and then my king wins his pawns on the other side. That is a clean win.*

*Blunder check: after Rxc6+ Kxc6, does Black have anything? No pieces left, no checks. I play Rxc6+."*
:::

Notice that the safety scan found something the first impression missed: the white rook was hanging. That is normal — the routine is there precisely to catch it. And the forcing move that solves the problem turns out to be the cleanest conversion as well.

```line
fen: 8/5p1p/p1rk2p1/8/1P6/P2K2P1/5P1P/2R5 w - - 0 35
moves: 35.Rxc6+ Kxc6 36.Kc4
check: engine
caption: Trading into the pawn ending. White's king heads for the queenside, and the extra pawn there becomes a winning passed pawn.
```

## Reduce counterplay before you grab

Most failed conversions follow the same script: the stronger side makes a "free" capture or an ambitious move, and the weaker side uses that tempo to start something. The fix is **prophylaxis** — a move that prevents the opponent's idea before it happens.

```board
fen: 1r4k1/5ppp/8/8/8/1p3N2/r4PPP/2RR2K1 w - - 0 28
caption: White is a knight up, but Black's b-pawn and the rook on the second rank are real counterplay. First stop the pawn (Rb1) and give the king air (g3 or h3); only then think about attacking.
red: b3b2 a2f2
arrows: d1b1
```

Here White's extra knight should win, but Black's b-pawn is two steps from queening and his rook attacks f2. The engine's top choices are calm: Rb1, blockading the pawn, or a luft move such as g3. A greedy or ambitious move — say Rc7 to attack f7 — gives Black time for ...b2, and suddenly White is the one defending.

Typical counterplay to look for and remove:

* **Mate threats and checks** against your king, especially on the back rank. Make luft (an escape square for your king) at a quiet moment.
* **An opponent's passed pawn.** Blockade it, or put a rook behind it.
* **His most active piece.** Trade it off, or take away its best squares.
* **Perpetual check.** If his queen is near your king, consider offering a queen trade or tucking your king away before you do anything else.

:::mistake Greed with a threat on the board
The most common conversion blunder at this level is capturing a pawn while the opponent has a mate threat or a perpetual. Before any capture when you are ahead, run the safety scan *for your own king* first.
:::

### Keep your king safe

A material advantage is only worth something if your king survives to use it. When you are ahead, your opponent's pieces will head for your king, because that is where a lost game can still be saved. So the moment you win material, look at your own king's shelter. Are the pawns in front of it still intact? Is there an escape square in case of a back-rank check? Are your pieces close enough to defend?

Often the best move right after winning material is a quiet king-safety move: luft with h3 or g3, a rook back to the first rank, a knight back to f3 to cover h2. These moves look modest, but they take away the opponent's only real chance. A safe king also lets you trade queens on your own terms instead of being forced to.

### Don't grab more when consolidation wins

**Consolidation** means bringing your pieces back to safe, coordinated squares after winning material, so that the opponent has nothing to attack. It is the opposite of greed. A typical situation: you have won a piece, and now a pawn on b7 or a2 is hanging. Before taking it, ask three questions. Does the capture take my queen or rook away from my king? Does it give him a tempo for a check or a threat? Would the position be easily winning even without the pawn? If the answers are "yes, yes, yes", leave the pawn and consolidate. You can collect it later, when it is safe.

## Trade pieces, not pawns

The best-known conversion guideline is: **when ahead in material, trade pieces, not pawns.** Each piece trade makes your extra material count for more. A knight up with all the pieces on the board is an advantage; a knight up with no other pieces is usually a simple win. And with fewer pieces left, your opponent has fewer ways to create counterplay.

Pawns are different. Your winning plan in the endgame usually involves making a passed pawn and queening it. Every pawn trade reduces your chances of doing that, and if all the pawns disappear, even an extra piece may not be enough: king and knight, or king and bishop, against a bare king is a draw.

This guideline has important nuances:

* **Trade his active pieces, keep your good ones.** The piece that creates his counterplay is the one to trade first.
* **Not every trade is good.** Before trading, look at the position you get. Trading into a lost or drawn pawn ending because "trades are good when ahead" is a classic error.
* **Some pawn trades help.** If a pawn trade opens a file for your rook, or removes his last pawn on one wing so that your extra pawn becomes passed, it can be the fastest way to win.

:::coach Coaching judgment: which piece to trade?
When you are ahead, look at your opponent's pieces and ask, "Which one is giving me the most trouble?" That piece is usually the one to trade. Then look at your own and ask, "Which one would I miss most?" Keep that one.
:::

### Trading queens when ahead

The queen is the piece that creates the most counterplay: it gives perpetual checks, finds forks and attacks two weaknesses at once. That is why a queen trade usually helps the stronger side. A practical method is to offer the trade *with a threat or a check*, or on a square where refusing it costs your opponent something — for example, blocking a check with your queen on a square protected by a pawn. Then he must either trade or let your queen take over the centre.

Two cautions. First, the square on which you offer the trade must be protected: blocking a check with an unprotected queen simply loses it. Second, check the ending after the trade, exactly as you would before any other simplification.

## Simplify into a won king and pawn ending

The cleanest conversion is often to trade everything into a **king and pawn ending** that you have checked is winning. With no pieces left, there are no tactics, no perpetual checks, and no back-rank tricks: just counting. But it is also the most unforgiving decision in chess, because pawn endings are either won or drawn (or lost), and there is no way back.

Before such a trade, count:

1. **Can I make a passed pawn?** An extra pawn on a wing where you have more pawns usually can.
2. **Is it an outside passed pawn?** A passed pawn far from the kings drags the enemy king away, and your king then wins the pawns on the other wing.
3. **Whose king is more active?** The side whose king gets to the centre or to the enemy pawns first usually wins.
4. **Is there a breakthrough or race to check?** Count the tempi as in [Chapter 15](#ch-15).

```board
fen: 8/5p1p/p1k3p1/8/1P6/P2K2P1/5P1P/8 w - - 0 36
caption: The pawn ending from the worked example. White to move. The king goes forward to c4 and b5, and the two-against-one majority on the queenside produces a passed pawn.
arrows: d3c4 c4b5
squares: a6 b4
```

### Activate the king

In the endgame the king is a strong piece. In the middlegame you kept it safe; once the queens are gone and the danger of mate is small, bring it toward the centre and the pawns. In a pawn ending, a king move is often worth more than any pawn move, because pawn moves cannot be taken back and the king decides who wins the race to the important squares. A useful guideline: in a pawn ending, ask "can my king improve?" before you consider a pawn move.

### Create a passed pawn

A **passed pawn** is one with no enemy pawns in front of it or on the neighbouring files. Your extra material almost always wins through a passed pawn in the end. Where you have more pawns than your opponent — a **majority** — push the pawn that has no opponent in front of it first (the **candidate** pawn), supported by the others.

```board
fen: 8/p7/1p2k1p1/7p/1PP4P/P3K1P1/8/8 w - - 0 40
caption: White's three queenside pawns face two. With the king supporting, the c-pawn — the one with no enemy pawn directly in front — leads the advance and the majority produces a passed pawn.
arrows: c4c5
squares: c4
```

### Two weaknesses, briefly

Sometimes one passed pawn is not enough: the defender blockades it and holds. Then the stronger side creates a **second weakness** on the other side of the board — another passed pawn, or a target pawn to attack. The defender cannot cover both at once. This is often called the **principle of two weaknesses**. At this stage, the practical version is simple: if your first plan is stopped, look for a second target far from the first, and switch to it.

## Avoid stalemate tricks

**Stalemate** — the side to move has no legal move and is not in check — is a draw ([Chapter 1](#ch-01)). When you are far ahead, especially with a queen, it is your opponent's last hope. He may even sacrifice his remaining pieces to reach it, a trick called a **desperado** sacrifice.

```board
fen: 8/8/8/6p1/3kq1Pp/7P/2P5/K7 b - - 0 55
caption: Black to move. The "natural" 55...Qxc2?? takes White's last mobile pawn and covers a2, b1 and b2 without check — stalemate.
red: e4c2
squares: a1 a2 b1 b2
orientation: black
```

The rule is easy: **before every move when the opponent has few pieces left, count his legal moves after your move.** If the answer is zero and you are not giving check, stop. Here the white king can move only to b1 or b2 and the pawns on g4 and h3 are blocked, so the c2-pawn is White's last free unit. Bring the king closer first, and the same capture becomes mate.

```line
fen: 8/8/8/6p1/3kq1Pp/7P/2P5/K7 b - - 0 55
moves: 55...Kc3 56.Kb1 Qxc2+ 57.Ka1 Qb2#
check: engine
caption: With the king on c3, the capture on c2 comes with check, and the king covers b2 for the mate.
```

:::drill Count his moves
In any won ending, before every move, say aloud how many legal moves your opponent will have afterwards. Do this for ten games and the stalemate trap will never surprise you again.
:::

## Handling the desperate counterattack

When your opponent is lost, he has nothing to lose. Expect sacrifices, wild pawn storms and offers of material designed to open your king. Three guidelines help:

* **Remove the key attacker.** If one piece makes his attack work, take it or trade it, even if that means giving back some material.
* **Give back material when it kills the attack.** Returning a pawn or the exchange to reach a calm position with a big advantage is excellent technique, not cowardice.
* **Check every check.** Desperate attacks usually end in a perpetual check or a back-rank mate. Before each move, list his checks after your move.

The exercises include positions in which one move kills a desperate attack and the "natural" defence loses on the spot.

## When your opponent is ahead

Everything in this chapter can be turned around. If *you* are the one behind, you want exactly what the converting side wants to avoid:

* **Keep pieces on** — especially your active ones — and trade pawns.
* **Avoid the pawn ending** unless you have counted it as a draw. Trading the last pair of rooks when a pawn down very often turns a drawable rook ending into a lost pawn ending.
* **Aim for drawish endings:** rook endings with all the pawns on one side, and endings with **opposite-coloured bishops** (one bishop moves on light squares, the other on dark).
* **Create counterplay and complications.** A passed pawn, a target near his king, a stalemate idea — anything that gives him a chance to go wrong.

```board
fen: 8/8/5k2/2b1pp2/8/3B1K2/8/8 b - - 0 50
caption: Black is two pawns up, but with opposite-coloured bishops White holds easily: the king and bishop control the blockade squares e4 and f4, and the black bishop can never challenge the light squares.
arrows: d3e4 f3e3
squares: e4 f4
orientation: black
```

:::nextgame Before you trade, count
In your next game, before any trade that leaves only kings and pawns — whether you are ahead or behind — stop the clock in your head and count: passed pawns, outside passers, king activity, races. Then decide.
:::

## A phase-by-phase checklist

The technique changes with the stage of the game, so it helps to have a slightly different focus in each.

* **Right after winning material:** look at your king and at his forcing moves. Make luft, defend loose pieces, bring back a piece that has wandered off to make the capture.
* **In the middlegame:** trade his active pieces and his queen if you can; keep your pawns; avoid opening lines toward your own king.
* **At the transition to the endgame:** count before every trade that leaves few pieces, and above all before trading into a pawn ending.
* **In the endgame:** activate your king, create a passed pawn, and switch to a second target if the first one is blockaded. Count his legal moves to stay clear of stalemate.

This is not a fixed recipe — some positions demand that you keep attacking — but it is the right default. Strong players win most won games not with brilliant moves but by following these steps patiently.

## How to identify conversion problems in your own games

When you analyse a game you were winning but did not win, look for these patterns:

* **The greedy capture.** You took material, and the opponent's next move was a check or a threat you had not looked at.
* **The missing prophylaxis.** His counterplay (a passed pawn, an active rook) grew for several moves while you pursued your own plan.
* **The wrong trade.** You exchanged your good piece for his bad one, or traded into an ending you had not counted.
* **The king that stayed home.** In the endgame your king stood on g1 while his marched into your pawns.
* **The stalemate.** You did not count his legal moves.
* **Time trouble.** You relaxed in the middlegame and spent your clock; the conversion then happened in a rush.

Tag these games in your mistake journal with the category *conversion*, and note which of the patterns occurred. Most players find that one or two of them repeat again and again — and those are the ones to work on first.

## Practice at the board

Play each position out against a friend or a computer set to full strength. The goal is not to find one move but to *win the position*.

1. **The rook trade.** FEN `8/5p1p/p1rk2p1/8/1P6/P2K2P1/5P1P/2R5 w - - 0 35`. Play 35.Rxc6+ Kxc6 and win the pawn ending against the engine. If you fail, find the moment your king or pawns went wrong.
2. **Stop the pawn.** FEN `1r4k1/5ppp/8/8/8/1p3N2/r4PPP/2RR2K1 w - - 0 28`. White to move. Win with the extra knight. Count how many moves you spend on prophylaxis before you start your own plan.
3. **Stalemate awareness.** FEN `8/8/8/6p1/3kq1Pp/7P/2P5/K7 b - - 0 55`. Black to move. Mate as quickly as you can, saying White's number of legal moves out loud before each of your moves.
4. **The defender's view.** FEN `8/8/5k2/2b1pp2/8/3B1K2/8/8 b - - 0 50`. Take White and hold the draw against the engine. Notice which squares your bishop must watch.

How to check yourself: the engine's evaluation should not drop by more than about a pawn while you convert. If it does, go back to that move and ask what counterplay you allowed.

## Chapter summary

* When ahead, your opponent needs counterplay; your job is to take it away, every move.
* Don't grab more if consolidation wins. Deal with threats, checks and passed pawns first.
* Trade pieces — especially his active ones — and usually keep pawns; but always look at the position you are trading into.
* A won king and pawn ending is the cleanest conversion; count passed pawns, king activity and races before you trade.
* In endgames, activate the king and create a passed pawn; if one target is not enough, find a second.
* Count your opponent's legal moves to avoid stalemate, and check his checks to avoid perpetuals.
* When behind, do the opposite: keep pieces, trade pawns, avoid lost pawn endings, and look for drawish endings and counterplay.

:::cheat Converting an advantage
1. Ask: what is his counterplay (threats, checks, passed pawns, active pieces, stalemate)?
2. Remove it first: prophylaxis, luft, blockade, or trade his most active piece.
3. Trade pieces, keep pawns — but check the ending you are trading into.
4. Before trading into a pawn ending, count passers, kings and races.
5. In the endgame, activate the king and create a passed pawn; switch to a second target if needed.
6. Before every move in a won ending, count his legal moves and his checks.
:::

@exercises
