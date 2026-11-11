---
chapter: 25
slug: middlegame-strategy
title: Middlegame Strategy
subtitle: Pieces, pawns and where to play
part: 5
stage: "1200–1500"
skills: [planning, pawn-structure, bishop-vs-knight, outpost, piece-activity, prophylaxis]
objectives:
  - Judge bishop against knight, good and bad bishops, and the value of the bishop pair.
  - Play the isolated queen's pawn from both sides and the Carlsbad minority attack.
  - Handle space advantages and cramped positions, including freeing pawn breaks.
  - Decide which pieces to exchange and on which side of the board to play.
next_game: When there is no tactic, name the pawn structure, decide which minor pieces are good or bad in it, and choose your plan and your exchanges from that.
---

Many games at your level are decided in the moments when nothing is happening. There is no tactic, no threat, and you play a "useful" move: a pawn push on the wrong wing, a trade that frees your cramped opponent, a knight on a beautiful square that is chased away two moves later. Twenty moves later you are losing and cannot say why.

Strategy is the answer to "what do I do when there is nothing to calculate?". It rests on a few stable facts: which minor pieces suit the pawn structure, which pawns are weak, where you have more space, and which exchanges help whom. This chapter gives you those facts and turns each into questions you can ask at the board. Strategy never replaces calculation: every plan move still has to pass the blunder-check of [Chapter 24](#ch-24).

## Bishop against knight

The bishop and the knight are both worth about three points, but they are good at different things. A **bishop** is a long-range piece: it reaches both sides of the board quickly but can only ever use squares of one colour. A **knight** is a short-range piece: it is slow to cross the board, but it can reach every square and jump over pawns.

From that follow the main guidelines:

* **Open positions favour bishops.** With few central pawns, long diagonals are open and the bishop's range counts.
* **Closed positions favour knights**, especially when there is a protected square in the centre for them.
* **Pawns on both wings favour the bishop.** It can defend on one side and attack on the other; the knight needs several moves to switch.
* **A knight needs outposts.** An **outpost** is a square that no enemy pawn can attack, ideally protected by your own pawn. A knight there can be stronger than any bishop.

```board
fen: 8/5pp1/1n5p/2k5/P7/4K2P/5PP1/1B6 w - - 0 45
caption: White to move. Pawns on both wings: the bishop can guard the a-pawn from far away (Bc2) while the king goes to the kingside. The knight cannot do two jobs at once.
arrows: b1c2
blue: c2a4
squares: a4
```

Here 45.Bc2! defends the a4 pawn along the diagonal, and White keeps a clear advantage; slow moves that allow ...Nxa4 throw it away. The bishop works at long distance; the knight on b6 must stay close to whatever it attacks.

:::coach How to judge a minor piece
In my experience, the quickest test is: "How many safe squares does this piece have, and do they reach the important part of the board?" A bishop staring at its own pawns, or a knight with no square closer than the fourth rank, is a weak piece, whatever its point value.
:::

### Outposts in practice

A knight on an outpost is strong only if it can stay there. Before you put a knight on a beautiful square, check three things: can an enemy pawn ever attack it, can the opponent simply trade it off for a bad piece, and if it is exchanged, does your recapture keep the square? A knight on e5 supported by a pawn on d4 can be traded, but after dxe5 your new pawn on e5 may be weak, or it may cramp the opponent; that is the real question.

The defender's methods against an outpost are the mirror image: trade the knight for a minor piece of yours that is doing less, undermine the supporting pawn, or prepare a pawn move that controls the square in advance.

## Good and bad bishops

A **bad bishop** is a bishop whose own pawns are fixed on squares of its colour. It is blocked by them, and it cannot attack the enemy pawns, which usually stand on the other colour. A **good bishop** is one whose pawns stand on the opposite colour, leaving its diagonals open.

Two important refinements:

* A bad bishop can still be a good *defender*: it protects the pawns that block it. It becomes truly bad when the position simplifies and it has nothing to do.
* "Bad bishop" is about **fixed** pawns. If the pawns can still move, the problem may be solved by a pawn break.

```board
fen: 5b2/4k3/4p1p1/3pPp1p/3P1P1P/5KP1/3B4/8 b - - 0 45
caption: Black to move. All White's pawns stand on dark squares, so White's dark-squared bishop is bad. Black's king heads for the dark squares on the queenside: ...Kd7, ...Kc6 and ...Kb5.
arrows: e7d7 d7c6 c6b5
squares: c4 b4
```

In this ending Black wins with 45...Kd7! and the king march to b5 and c4. The white bishop cannot attack a single black pawn, and the white king cannot guard both d4 and the queenside entry squares. Waiting moves draw: the plan is the whole point.

What to do with a bad bishop:

1. **Trade it**, ideally for the opponent's good bishop or a strong knight.
2. **Put it outside the pawn chain** (for example ...Bd7-e8-h5 in some French structures) so it attacks something.
3. **Change the pawn structure** with a break that opens its diagonals.

What to do against a bad bishop: keep the pawns fixed, avoid trading it, and, as the position simplifies, invade on the squares it cannot cover.

## The bishop pair

Two bishops together cover both colours, and they are often worth more than bishop plus knight, especially in open positions and endgames. The side with the **bishop pair** usually wants to open the position with pawn breaks and to avoid trading one of the bishops. The other side wants to keep the position closed, set up outposts for the knight, and trade one of the bishops when it can.

```board
fen: r3kb1r/1pp2pp1/p1p2qn1/4p2p/3PP1b1/5N1P/PPPN1PP1/R1BQR1K1 b kq - 0 10
caption: Black to move, Ruy Lopez Exchange. Black has the bishop pair in return for the doubled c-pawns. Developing moves such as ...Bd6 or ...Nf4 keep it; ...Bxf3 gives it up.
arrows: f8d6
red: g4f3
```

In positions like this, giving up a bishop "because it is attacked" or "to double the pawns" is a typical strategic slip. The engine is not dramatic about it here, but it rates the trade lower than the developing moves, and the bishop pair is exactly what Black got in return for the structure.

:::mistake Trading the wrong minor piece
Before every exchange of minor pieces, ask: "Which of my pieces will be left, and which of his?" Trading your good bishop for his knight can leave you with a bad bishop against a dominant knight. Trading your bishop pair away without a reason gives back the main trump of your position.
:::

### Opposite-coloured bishops in the middlegame

When each side has one bishop and they run on different colours, endgames tend to be drawish (see [Chapter 26](#ch-26)). In the middlegame the opposite is true: the attacker's bishop cannot be opposed by the defender's bishop, so on the attacker's colour he effectively has an extra piece. If you have the initiative against the king, keep the queens and rooks on and aim your bishop at squares the enemy bishop can never guard. If you are the one defending, trading queens is usually your best route to safety.

## The isolated queen's pawn

An **isolated queen's pawn** (IQP) is a pawn on d4 (or d5 for Black) with no friendly pawns on the c- and e-files. It arises from many openings you play, including the Alapin Sicilian (1.e4 c5 2.c3) and lines of the Queen's Gambit and the Exchange French.

The IQP is a two-sided thing:

* **Strengths:** it gives space, controls e5 and c5 as outposts for your knights, and gives your pieces open files and diagonals. The side with the IQP usually has more active pieces in the middlegame.
* **Weaknesses:** it cannot be protected by a pawn, and the square in front of it (d5 for White, d4 for Black) is a perfect blockade square for the opponent. In the endgame the IQP is often simply weak.

### Playing with the IQP

Use your activity before it fades. The two main plans are:

1. **A kingside attack with pieces.** The typical set-up is a queen and bishop battery against h7 (Qd3 with Bc2 or Bb1), a rook on e1 or e3, and a knight on e5.
2. **The d4-d5 break.** When your pieces are ready, d5 opens files and diagonals at the exact moment the opponent's pieces are least coordinated.

```board
fen: r2q1rk1/pb2bppp/1pn1pn2/8/3P4/P1N2N2/1PB2PPP/R1BQR1K1 w - - 2 13
caption: White to move, Alapin Sicilian. With Bc2 already in place, Qd3! completes the battery against h7 and forces a weakening.
arrows: d1d3 c2h7
squares: h7
```

```line
fen: r2q1rk1/pb2bppp/1pn1pn2/8/3P4/P1N2N2/1PB2PPP/R1BQR1K1 w - - 2 13
moves: 13.Qd3 g6 14.Bh6 Re8
check: engine
caption: Black must weaken the dark squares around the king, and the white pieces gain targets.
```

### Playing against the IQP

The defender has three goals: **stop the attack, blockade, and trade pieces.**

* **Blockade** the square in front of the pawn, usually with a knight (Nd5 against White's IQP). A blockading knight cannot be chased by pawns.
* **Trade pieces**, especially the IQP side's attacking pieces: its light-squared bishop and its knights. Every trade brings you closer to an endgame in which the pawn is weak.
* **Neutralize the attack first.** A blockade is no use if you are mated. Sometimes the right move is prophylactic, such as covering the square the enemy queen wants.

:::key IQP in one line
With the IQP: keep pieces, attack, and look for d4-d5. Against it: blockade, trade pieces, and head for the endgame.
:::

## The Carlsbad structure and the minority attack

The **Carlsbad structure** arises from the Queen's Gambit Declined Exchange Variation: White has pawns on a2, b2, d4 and e3; Black has a7, b7, c6 and d5. Black has three pawns on the queenside against White's two.

```line
fen: startpos
moves: 1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.cxd5 exd5 5.Bg5 c6 6.e3 Be7 7.Bd3 O-O 8.Qc2 Nbd7 9.Nf3 Re8 10.O-O Nf8 11.Rab1
check: engine
caption: A typical Carlsbad position. The rook on b1 shows White's plan.
```

```board
fen: r1bqrnk1/pp2bppp/2p2n2/3p2B1/3P4/2NBPN2/PPQ2PPP/1R3RK1 b - - 10 11
caption: Black to move. White plans b2-b4-b5. After b5xc6 Black is left with a weak pawn on c6, or, after ...cxb5, with a weak isolated pawn on d5.
arrows: b2b4 b4b5
squares: c6 d5
```

This is the **minority attack**: the side with fewer pawns on a wing advances them to create a weakness in the opponent's majority. White does not try to win a pawn immediately; it aims to leave Black with a permanent target, which White then attacks with rooks on the c-file and a knight heading for c5 or a4.

```line
fen: r1bqrnk1/pp2bppp/2p2n2/3p2B1/3P4/2NBPN2/PPQ2PPP/1R3RK1 b - - 10 11
moves: 11...Ng6 12.b4 a6 13.a4
check: engine
caption: White prepares b4-b5. Black's ...a6 makes White spend a move on a4 before the pawn can arrive.
```

White's other plan in the Carlsbad is central: Nge2, f3 and e4, using the extra central pawn. It is more ambitious and weakens White's own king a little, so Black must react actively.

```board
fen: r1bqrnk1/pp2bppp/2p2n2/3p2B1/3P4/2NBPP2/PPQ1N1PP/R4RK1 b - - 0 11
caption: Black to move. White has chosen the central plan with Nge2 and f3, preparing e4. Black keeps the pieces flexible, for example with ...g6 and ...Ne6 or ...Ng6; the routine trade ...Ne4 is impossible here because of fxe4.
arrows: f8e6
red: f3e4
```

Black's usual counterplay is in the centre and on the kingside: ...Ne4 to trade pieces, ...Ng6 and ...Bd6 towards White's king, and sometimes ...f5 to support a knight on e4. White also has a central plan, f3 and e4, but it must be prepared; played too early it often runs into tactics.

## Space and cramped positions

Your **space** is the area behind your pawn chain where your pieces can move freely. More space means more good squares for your pieces and easier regrouping. The cramped side's pieces get in each other's way.

```board
fen: r1bq1rk1/pp1nppbp/2pp1np1/8/P2PP3/2N2N2/1PP1BPPP/R1BQ1RK1 w - - 1 8
caption: White to move, a Pirc set-up met by our repertoire (Nc3, Nf3, Be2, O-O). White's central pawns on d4 and e4 give a comfortable space advantage; Black must eventually play ...e5 or ...c5 to free the game.
squares: d4 e4
```

With more space:

* **Keep pieces on the board.** Each exchange gives the cramped side more room.
* **Prevent the freeing breaks.** Know which pawn moves free the opponent (here ...e5 and ...c5) and make sure they cost something.
* **Use the space to regroup** towards the side where you want to play.

When cramped:

* **Trade pieces**, especially the ones that get in each other's way.
* **Prepare one freeing break** and make sure it works tactically. A break that loses a pawn frees nothing.

A model of the freeing idea is Capablanca's method in the Queen's Gambit Declined, part of your Black repertoire. Black trades two pairs of minor pieces with ...dxc4 and ...Nd5, and then frees the position with ...e5 or ...c5:

```line
fen: startpos
moves: 1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Nbd7 7.Rc1 c6 8.Bd3 dxc4 9.Bxc4 Nd5 10.Bxe7 Qxe7 11.O-O Nxc3 12.Rxc3 e5
check: engine
diagram: end
caption: Two pairs of minor pieces are gone and ...e5 opens the diagonal for the c8 bishop. Black's cramp is over.
```

:::mistake The break at the wrong moment
A freeing break must be prepared. The same pawn move that frees your game in one position can simply lose a pawn in another, if one more enemy piece attacks the square. Before any pawn break, count the attackers and defenders of the pawn that advances and of the squares it leaves behind.
:::

## When to exchange

Exchanges are strategic decisions. A useful set of guidelines:

* **Trade the defenders of weaknesses.** If a weak pawn or square is guarded by one piece, exchanging that piece makes the weakness fall. In the Carlsbad structure, for example, White sometimes plays Bxf6 to remove the knight that guards d5 and e4.
* **Trade your bad pieces for his good ones.** A bad bishop for a good bishop or a dominant knight is usually a good deal.
* **Trade attackers when you are under attack**, and avoid trades when you are the attacker.
* **The side with more space keeps pieces; the cramped side trades.**
* **When ahead in material, trade pieces, not pawns.** When behind, trade pawns and keep pieces (see [Chapter 16](#ch-16) and [Chapter 17](#ch-17)).
* **Check what the recapture changes.** Every exchange involves a recapture, and the recapturing piece or pawn lands somewhere. A trade that brings an enemy pawn to a strong square, opens a file for his rook, or kicks your knight is not neutral.

## Open and closed centres: where to play

The centre decides where the battle is fought.

* **Open centre** (few central pawns, open files): piece play dominates. Flank attacks with pawns are dangerous because the opponent can counter in the middle. Develop, centralize, and fight for open files.
* **Closed centre** (locked pawn chains): the centre cannot be opened quickly, so both sides play on the wings. Flank pawn storms become possible, even against a castled king.
* **Fluid centre** (pawns can still be exchanged or advanced): the timing of central breaks is everything. Do not lock it or open it without a reason.

In closed positions two rules help you choose the wing:

1. **Play on the side your pawns point to.** A pawn chain "points" in the direction it advances diagonally. White's chain d4-e5 points to the kingside; Black's d6-e5 points to the kingside too, so in King's Indian structures Black attacks with ...f5 and White with c4-c5 on the queenside.
2. **Play where you are stronger**: where you have more space, more pieces, or a pawn majority. Attacking where your opponent is stronger usually backfires.

The **base of the pawn chain** is its last pawn, the one that is not protected by another pawn. That is where the chain is most vulnerable: in the French, Black attacks d4 with ...c5, ...Nc6 and ...Qb6; in the King's Indian, White attacks the base d6 with c4-c5 and Black attacks the base e4 with ...f5. Attacking the head of a chain only makes it more solid.

:::nextgame Name the structure
In your next three games, at move 15, write down the pawn structure in two or three words ("IQP", "Carlsbad", "closed centre, my pawns point kingside"), which minor pieces are good and bad in it, and which wing you will play on. Then compare with the engine after the game.
:::

## A worked example: choosing a plan

Here is how the procedure runs in a real decision. Take the Carlsbad position above with Black to move after 11.Rab1.

**First I name the structure.** Carlsbad: White has a minority on the queenside, Black has the majority there and more space on the kingside. The centre is closed by d4 and d5.

**Then I judge the minor pieces.** Black's light-squared bishop on c8 is the problem piece: my pawns on c6 and d5 stand on light squares and hem it in, so it needs a diagonal outside the chain (f5, g4 or e6). White's dark-squared bishop on g5 presses on my knight on f6. My knight on f8 is heading for g6 or e6.

**Then I look at plans.** White's plan is clear: b4-b5. My plans: (a) slow it down with ...a6, (b) trade pieces with ...Ne4 to lessen the pressure, (c) play on the kingside with ...Ng6, ...Bd6 and perhaps ...Ne4.

**Then I check the candidate moves tactically.** 11...Ne4 looks thematic, but after the trade on e7 and Bxe4 dxe4, my e4 pawn may become a target; I would need to calculate it. 11...Ng6 develops and prepares ...Bd6 without committing. 11...a6 is useful prophylaxis.

**Finally I blunder-check.** After 11...Ng6 my pieces are all defended and White has no direct tactic. I play it and keep ...a6 for the moment White plays b4.

The engine agrees: ...Ng6, ...a5 and ...Ne4 are the top choices, all close together. In strategic positions there is often no single best move, but there is always a *reason* for the move you choose.

## Practice at the board

1. **IQP attack and defence.** `r2q1rk1/pb2bppp/1pn1pn2/8/3P4/P1N2N2/1PB2PPP/R1BQR1K1 w - - 2 13`. Play White against an engine at a modest level for ten moves, aiming for the battery on h7 and the d4-d5 break. Then switch sides and play Black, aiming to blockade on d5 and trade pieces.
2. **Minority attack.** `r1bqrnk1/pp2bppp/2p2n2/3p2B1/3P4/2NBPN2/PPQ2PPP/1R3RK1 b - - 10 11`. Play White's plan (b4, a4, b5) against the engine and try to leave Black with a weak c6 or d5 pawn. Write down when you would trade bishops on f6 or e7.
3. **Good against bad bishop.** `5b2/4k3/4p1p1/3pPp1p/3P1P1P/5KP1/3B4/8 b - - 0 45`. Win as Black against the engine. Then give White the move and see if White can hold.
4. **Bishop against knight.** `8/5pp1/1n5p/2k5/P7/4K2P/5PP1/1B6 w - - 0 45`. Find White's best move, then play the ending out. Count how many moves the knight needs to get from one wing to the other.

Check yourself by asking the engine for its evaluation after each phase. If your evaluation and the engine's differ by more than about a pawn, find the moment where your plan went wrong.

## Chapter summary

* Bishops prefer open positions and pawns on both wings; knights prefer closed positions and need protected outposts.
* A bishop is bad when its own pawns are fixed on its colour. Trade it, activate it outside the chain, or change the structure; against it, fix the pawns and invade on the other colour.
* The bishop pair is a long-term trump: open the position and avoid trading a bishop without a reason.
* With an IQP, attack with pieces and look for d4-d5; against it, stop the attack, blockade the square in front, and trade pieces.
* In the Carlsbad structure, White's minority attack (b4-b5) creates a weak pawn on c6 or d5; Black's play is in the centre and on the kingside.
* More space: keep pieces and prevent the freeing breaks. Cramped: trade pieces and prepare one break that works tactically.
* In closed centres play on the side your pawns point to, where you are stronger, and attack the base of the enemy chain.

:::cheat The strategic routine
1. Name the pawn structure and its weak pawns and squares, for both sides.
2. Judge each minor piece: good or bad, and how many useful squares it has.
3. Decide where to play: in the centre if it is open, otherwise on the wing your pawns point to and where you are stronger.
4. Pick a plan of two or three moves and the exchanges that help it (trade defenders, bad pieces and attackers; keep pieces when you have space).
5. Check every plan move tactically, including what the recapture of any exchange gives the opponent.
:::

@exercises
