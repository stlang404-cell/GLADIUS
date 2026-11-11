---
chapter: 3
slug: values-counting
title: Piece Values and Counting
subtitle: Know what everything is worth, then count before you capture
part: 1
stage: "400–600"
skills: [counting, hanging-pieces]
objectives:
  - Use the standard piece values to judge trades, and know when they mislead.
  - Count attackers and defenders on any square, including x-ray attackers.
  - Capture in the right order, lowest-value attacker first.
  - Decide whether a capture is safe with a short, reliable procedure.
  - Choose between adding a defender, moving away and counterattacking when a piece is attacked.
next_game: Before every capture, count the attackers and defenders on that square and play out the exchange in your head, lowest-value piece first; before every move, check that the piece you move, and every piece it was defending, is still safe.
---

Your opponent's knight takes a pawn in the centre. You recapture with your queen because it is your strongest piece, and your opponent's bishop, which was defending that square all along, takes your queen. Or you see a "free" pawn, grab it with a knight, and lose the knight to a recapture you never counted.

Below 1000, a large share of games are decided by exactly this: material given away in exchanges that a few seconds of counting would have prevented. This chapter gives you two tools. The first is a simple scale of piece values that tells you whether a trade is good. The second is **counting**, the habit of adding up attackers and defenders before any capture. Together they will stop most one-move losses of material.

## What the pieces are worth

The standard values, measured in pawns, are:

| Piece | Value |
|---|---|
| Pawn | 1 |
| Knight | 3 |
| Bishop | 3 |
| Rook | 5 |
| Queen | 9 |
| King | cannot be traded |

These numbers come from centuries of experience, and they work remarkably well as a first guide. They let you add up trades quickly: giving a knight (3) for a rook (5) gains two points, an advantage known as **winning the exchange**. Giving a bishop (3) for two pawns (2) loses a point.

A few practical consequences:

* **A minor piece for three pawns** is roughly even on paper, but the extra piece is usually stronger in the middlegame, and the pawns can become stronger in the endgame.
* **Two minor pieces for a rook and a pawn** is roughly even too; in the middlegame the two pieces are often better.
* **The queen** is worth about two rooks minus a little, or three minor pieces.

### The king

The king has no trading value, because losing it loses the game. But the king also has a fighting value. In the middlegame it is a liability that needs shelter. In the endgame, when the queens are off and mating attacks are unlikely, the king becomes an active piece, roughly as strong as a minor piece, that attacks pawns and escorts its own pawns forward.

```board
fen: 8/8/4k3/4p3/4K3/8/8/8 w - - 0 60
caption: In the endgame the kings are fighters. Both kings guard key squares around the e5-pawn. Chapter 18 shows how the side whose king is more active usually decides the game.
squares: d5 f5 d4 f4
```

### The bishop pair

Bishops and knights are both worth about three, but two bishops together are usually a little stronger than bishop and knight or two knights, especially when the position opens up. This advantage is called the **bishop pair**. Strong players often value it at around half a pawn; treat that figure as coaching judgment rather than law.

```board
fen: r1bqkbnr/1pp2ppp/p1p5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 5
caption: The Exchange Variation of the Ruy Lopez. White has given the bishop pair to damage Black's pawns. Material is level, but each side has a long-term trump.
squares: c8 f8
```

### When the values mislead

The values describe pieces in a typical position. In a specific position, other factors can matter more:

* **Mate threats.** No amount of material matters if you are checkmated. A queen that captures a rook and allows mate in one has made a losing trade.
* **King safety.** A material advantage is often worth less than a safe king. An attack against an exposed king can be worth a piece or more.
* **Activity.** A rook that dominates an open file can be stronger than a passive rook buried in the corner, and a knight on a strong central square can outplay a bishop blocked by its own pawns.
* **Passed pawns.** A pawn one square from promotion is worth far more than one point.

The line below is the classic example of material blindness. Black "attacks" White's queen with a knight and forgets to look at the mate threat.

```line
fen: startpos
moves: 1.e4 e5 2.Bc4 Nc6 3.Qh5?! Nf6?? 4.Qxf7#
check: engine
diagram: end
caption: Scholar's Mate. On move 3, Black needed a move that defended f7, such as 3...g6 or 3...Qe7. Attacking the queen with 3...Nf6 lost on the spot.
```

:::key Values are a guide, not the goal
Use the values to judge trades quickly. Then ask one more question before you decide: does this trade change the safety of either king, or allow a mate, a fork or a passed pawn?
:::

### Exchange sacrifices, briefly

Occasionally strong players deliberately give a rook for a minor piece, an **exchange sacrifice**, because the minor piece will be more active or the opponent's king will be exposed. You will meet the idea again in Stage 5. For now, treat your rooks as worth five and do not give the exchange unless you can see exactly what you get in return.

## Trades: equal and unequal

A **trade** (or exchange) is any sequence where both sides capture. Keep two kinds apart:

* **Equal trades:** knight for knight, bishop for knight, rook for rook, queen for queen. They do not change the material balance, but they can change the position: who gets the open file, whose pawns get damaged, whose king gets safer.
* **Unequal trades:** one side gives more value than it gets. These decide most games at this level.

A strong guideline: **when you are ahead in material, trade pieces, not pawns.** Each equal trade makes your extra material count for more, and leaves your opponent fewer pieces to attack with. When you are behind, avoid equal trades and keep pieces on the board to make threats.

For example, suppose you have won a knight early in the game. With all the other pieces still on the board, your opponent can still create threats against your king, and your extra knight is one piece among many. Trade the queens and a pair of rooks, and your knight becomes one of only a few pieces left; it can now win pawns while your opponent has almost nothing to attack with. The same logic tells the defending side to avoid trades. Chapter 16 develops this into a full method for converting an advantage.

## Counting attackers and defenders

The most important skill in this chapter is **counting**: before any capture, add up how many of your pieces attack the target square and how many of your opponent's pieces defend it.

The basic rule:

* If a piece is attacked more times than it is defended, it is usually in danger.
* If it is defended at least as many times as it is attacked, it is usually safe, *as long as every attacker is worth more than or the same as the target.*

That last condition matters enormously. A knight defended twice can still be lost if it is attacked once by a pawn, because the pawn is cheaper. **When the attacker is worth less than the target, counting defenders does not help.**

```board
fen: rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4
caption: The d5-pawn is attacked twice (by the c4-pawn and the c3-knight) and defended three times (by the e6-pawn, the f6-knight and the queen on d8). White can trade with cxd5, but Nxd5?? simply loses the knight to ...exd5.
arrows: c4d5 c3d5
red: e6d5 f6d5 d8d5
squares: d5
```

### Play out the exchange

Counting is the first step. The second is to play out the captures in your head, adding up the values as you go. Take the d5-square above and imagine 4.Nxd5. White has taken a pawn (+1). Black replies 4...exd5, taking a knight (White is now −3 + 1 = −2). White can recapture with 5.cxd5 (+1, total −1), and Black can take again with 5...Nxd5 or 5...Qxd5. Every time, White ends up behind. Counting told you the same thing in one second: three defenders, two attackers.

### Capture order: lowest value first

When you capture on a square several times, the order matters. The rule is simple: **capture with your lowest-value piece first, and keep your most valuable pieces for last.** The reason is that your opponent can stop recapturing at any moment. If your queen goes in first and is captured, you have lost nine points even if you later win the square back.

The same applies to your opponent. When you count, assume they will recapture with their cheapest piece first, and that they will stop as soon as further captures lose material.

:::mistake Recapturing with the queen "because it's strongest"
Players often recapture with the queen because it is the most powerful piece. But the queen is also the piece you can least afford to have captured. If a pawn or a minor piece can recapture, it is usually the safer choice. Use the queen only when you have checked that nothing can take it on that square.
:::

### X-ray attackers and defenders

Pieces lined up on the same line count even when one stands behind the other. Two rooks doubled on a file, or a queen behind a bishop on a diagonal, form a **battery**. The rear piece is an **x-ray** attacker (or defender): it does not attack the square yet, but it will as soon as the front piece captures.

```board
fen: 3r2k1/pp1r1ppp/2n5/3p4/8/2N5/PP1R1PPP/3R2K1 w - - 0 25
caption: The isolated d5-pawn is defended by the rook on d7 and, behind it, the rook on d8. It is attacked by the knight on c3, the rook on d2 and, behind that, the rook on d1. Counting the x-rays, three attackers face two defenders.
arrows: c3d5 d2d5
blue: d1d5 d8d5
red: d7d5
squares: d5
```

When you count, always look behind the front piece on each line. X-rays are the most common reason a careful count still comes out wrong.

## Is it safe to take? A procedure

Here is a short routine to run before any capture. It takes about ten seconds once you are used to it.

1. **Count** the attackers and defenders of the target, including x-rays.
2. **Compare values.** Is any defender worth less than my capturing piece? If a pawn defends the target, never take with a piece worth more than the target plus a pawn.
3. **Play out the exchange** in your head, lowest-value attacker first, and add up the values. Assume your opponent stops when it suits them.
4. **Check the final position.** After the last capture, is anything else of mine undefended? Did any of my pieces stop defending something when it moved? Does my opponent get a check, a fork or a mate threat?
5. **Only then decide.** If the count is in your favour and step 4 is clean, take. If not, look for a better move, often a quiet developing move that keeps the tension.

### Worked example: the isolated pawn

Let us run the procedure on the x-ray position above. White is considering 25.Nxd5.

First I count. The d5-pawn is attacked by my knight on c3, my rook on d2 and, behind it, my rook on d1: three attackers. It is defended by the rook on d7 and, behind it, the rook on d8: two defenders. The knight on c6 does not help, because a knight on c6 jumps to b4, d4, e5, e7, d8, b8, a7 and a5, never to d5.

Next I compare values. Both defenders are rooks, worth more than my knight, so there is no cheap defender to worry about.

Now I play it out, lowest-value attacker first, adding up as I go. 25.Nxd5 wins a pawn (+1). If 25...Rxd5, then 26.Rxd5 (+1 −3 +5 = +3) Rxd5 27.Rxd5 (+3 −5 +5 = +3). Every way Black recaptures, I come out ahead, so Black will not recapture at all, and I have simply won the pawn.

Notice what happens if I forget the x-ray rook on d1. I would count two attackers against two defenders, play out 25.Nxd5 Rxd5 26.Rxd5 Rxd5, see that I have lost a knight and a rook for a pawn and a rook, and decide not to take. The rook behind the rook changes the answer.

Finally I check the new position. My knight on d5 is attacked only by the rook on d7, and taking it loses for Black. Did moving the knight from c3 leave anything undefended? Nothing of mine depended on it. Does Black have a check? No.

The decision: 25.Nxd5 wins the pawn, and the knight lands on a strong central square.

```line
fen: 3r2k1/pp1r1ppp/2n5/3p4/8/2N5/PP1R1PPP/3R2K1 w - - 0 25
moves: 25.Nxd5
check: engine
diagram: end
caption: White has won the d5-pawn. Black cannot recapture: the third white attacker, the x-ray rook on d1, would win the last exchange.
```

:::coach Count out loud at first
Coaching judgment: in your first few weeks of using this routine, whisper the count to yourself in training games: "two attackers, one defender, knight takes first." It feels slow, but it builds the habit faster than counting silently, and the habit soon becomes automatic.
:::

## Four counting traps

Counting is simple in principle, but four situations regularly fool players who have learned the basic method.

**The king as a defender.** The king defends every square next to it, but it can only recapture on a square that is not attacked by another enemy piece. A pawn "defended" by the king alone is lost as soon as the square is attacked twice, because the king cannot take back into the second attacker's line.

**The defender that moved away.** A piece defends squares only from where it stands. When you move a piece, everything it was guarding loses a defender. Before every move, ask what the piece is protecting right now. This single question prevents a large share of hanging pieces at this level, and Chapter 4 builds it into the safety scan.

**The defender that cannot really defend.** A piece that is pinned against its king cannot recapture at all, and a piece that is already defending something else may not be able to do both jobs. Counting such a piece as a full defender gives the wrong answer. Chapters 8 and 10 look at these situations in detail; for now, notice when a defender is also busy elsewhere.

**Captures with check.** An exchange does not have to run in the order you expect. If one of the recaptures gives check, or if your opponent can insert a check or a bigger threat in the middle of the sequence, the simple count no longer applies. When a capture in the sequence comes with check, play that line out carefully before trusting your count.

:::drill Count ten squares
Take any position from one of your recent games. Pick ten squares that contain pieces or pawns, and for each one say aloud: attacked how many times, defended how many times, and what the cheapest attacker is worth. Check yourself by playing out the captures in an app. With practice, each square should take under five seconds.
:::

## When your piece is attacked

The other side of counting is defence. When one of your pieces is attacked, you have four main options:

1. **Move it away** to a safe square.
2. **Add a defender**, so that the capture would cost your opponent material.
3. **Block** the line of attack (only against queens, rooks and bishops).
4. **Counterattack**: make a threat of your own that is at least as big, or capture something.

Which option works depends on the values involved.

* **If the attacker is worth less than your piece** (a pawn attacking a knight, a knight attacking a rook), adding a defender does not help: your opponent will happily give the cheaper piece for yours. You must move it, block, or counterattack with something bigger.
* **If the attacker is worth the same or more**, adding a defender is often enough, and it can be the most useful option if it also develops a piece.

```board
fen: rnbqkb1r/pppppppp/8/6B1/3Pn3/8/PPP1PPPP/RN1QKBNR w KQkq - 3 3
caption: The Trompowsky Attack. Black's knight attacks the bishop on g5. Because the attacker is a knight, of equal value, White has real choices: move the bishop (3.Bf4) or defend it with a pawn (3.h4), and both are played by strong players.
red: e4g5
arrows: g5f4
blue: h2h4
```

### Counterattack

A counterattack works only if your threat is at least as large as your opponent's and they cannot answer both at once. A typical example: your knight is attacked, and instead of moving it you attack your opponent's queen with a pawn. After the queen moves, you save the knight with a gain of time. But be strict: if your opponent can capture your piece *with check*, or can meet your threat while keeping theirs, the counterattack fails.

:::mistake Defending a piece against a pawn attack
When a pawn attacks one of your pieces, beginners often add a defender. It does not help: the pawn captures your piece, you recapture the pawn, and you have traded a piece for a pawn. Against a pawn attack, move the piece, or use the time for a bigger threat.
:::

## How to find counting errors in your own games

When you analyze a game, mark every capture you made or allowed and ask:

* Did I count the attackers and defenders before capturing?
* Did I capture with the right piece, the lowest-value one?
* Did I miss an x-ray, a defender behind another piece?
* When my piece was attacked, did I choose the right defence for the values involved?
* After my move, did a piece I moved stop defending something?

Log mistakes of this type under *hanging piece* in your mistake journal. If they make up a large share of your losses, which is normal at this level, come back to this chapter after a month and solve the exercises again.

## Practice at the board

1. **Count the centre.** Load `rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4`. Count attackers and defenders of d5 and of d4. Play out 4.cxd5 exd5 and recount. Then try 4.Nxd5?? and see the material swing.
2. **X-ray drill.** Load `3r2k1/pp1r1ppp/2n5/3p4/8/2N5/PP1R1PPP/3R2K1 w - - 0 25`. Play out 25.Nxd5 and every possible recapture. Then, in the board editor, remove the rook on d1 and count again: is 25.Nxd5 still safe? (It is not: after 25...Rxd5 26.Rxd5 Rxd5 you have given a knight and a rook for a pawn and a rook.)
3. **Capture order.** Set up a square attacked by your knight and your queen and defended by one enemy rook. Play out both orders, knight first and queen first, and add up the values each time.
4. **Pawn attacks.** In a free app, play the French Defence moves `1.e4 e6 2.d4 d5 3.Nc3 Nf6 4.e5`. Find Black's knight moves that save the knight, and explain why defending it does not work.
5. **Play it out.** Against a friend or an engine at a low level, play ten-minute games where you must say "count" before every capture. Afterwards, check how many captures you would have changed.

## Chapter summary

* Pawn 1, knight 3, bishop 3, rook 5, queen 9. The king cannot be traded but is a strong fighter in the endgame.
* The bishop pair is usually worth a little more than bishop and knight; mate threats, king safety, activity and passed pawns can outweigh material.
* Count attackers and defenders before every capture, including x-ray pieces behind the front attacker.
* When the attacker is worth less than the target, the number of defenders does not matter.
* Capture with the lowest-value piece first; your opponent can stop recapturing whenever it suits them.
* Against a cheaper attacker, move, block or counterattack; adding a defender works mainly against attackers of equal or greater value.
* When ahead, trade pieces; when behind, keep pieces on and make threats.

:::cheat Is it safe to take?
1. Count attackers and defenders of the target, including x-rays.
2. Is any defender cheaper than my capturing piece? If so, think twice.
3. Play out the exchange, lowest-value attacker first, adding up values.
4. Check the final position for loose pieces, checks, forks and mate threats.
5. Take only if the count favours me and step 4 is clean; otherwise play a solid developing move.
:::

Now solve the exercises below. Then play two slow games in which you count out loud, or in your head, before every capture you make, and before every capture you allow.

@exercises
