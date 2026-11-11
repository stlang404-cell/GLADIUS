---
chapter: 21
slug: king-safety-attack
title: King Safety and Attacking the King
subtitle: Count the attackers, count the defenders, then strike
part: 4
stage: "1000–1200"
skills: [king-safety, attack, defense, mate-patterns]
objectives:
  - Judge king safety from the pawn shield, the open lines and the number of attackers and defenders nearby.
  - Make luft with the right pawn and understand the weaknesses created by ...h6, ...g6 and ...f6.
  - Attack with pawn storms when the kings have castled on opposite sides, and with pieces when they are on the same side.
  - Recognize the typical sacrifices — Bxh7+, Nxf7, Rxf6 and Bxg7 — and the conditions that make them work.
  - Punish a king stuck in the centre and defend your own king by trading attackers and counter-attacking.
next_game: Before every move, count the attacking pieces near each king — yours and your opponent's. If one side has more attackers than the other has defenders, that is where the game will be decided.
---

At every level, the quickest way to win a game is to checkmate the opponent's king, and the quickest way to lose one is to neglect your own. Between 1000 and 1200 you will start to win games with attacks that are not just one-move tactics: you bring pieces closer, open a file, sacrifice to break the pawn shield, and mate. You will also lose games because a single pawn move in front of your king gave your opponent a target.

This chapter is about both sides of that fight. You will learn to *read* king safety — pawns, open lines, attackers and defenders — and then the main methods of attack and defence. The theme throughout is counting. An attack usually succeeds when the attacker has more pieces near the king than the defender can bring.

## The pawn shield

After castling, the three pawns in front of the king — f2, g2 and h2 for White on the kingside — form its **pawn shield**. Unmoved, they cover all the squares the king needs and give enemy pieces no entry points.

```board
fen: r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7
caption: Both kings are perfectly safe: their pawn shields are untouched, a knight stands on f3 or f6 to cover h2 or h7, and no files are open toward either king.
squares: f2 g2 h2 f7 g7 h7
```

Three things make a castled king safe:

1. **Intact shield pawns.** Every pawn move in front of the king creates weak squares that can never be covered by pawns again.
2. **A defending piece nearby**, especially a knight on f3 (or f6), which guards h2 (h7) and stops many sacrifices.
3. **No open lines** toward the king — no open files for enemy rooks, no open diagonals for enemy bishops.

When you assess king safety, check those three in order, and then count: how many enemy pieces can reach the king's area in one or two moves, and how many of the defender's pieces can come to help?

### Luft: when and which pawn

Sometimes you must move a shield pawn. The most common reason is the back rank (see [Chapter 11](#ch-11)): with rooks or queens still on the board, a king with no escape square can be mated by a single check on the first rank. A pawn move that gives the king an escape square is called **luft** (German for "air").

```board
fen: 3r2k1/pbq2pp1/1p2p2p/8/8/2P2N2/PP2QPPP/3R2K1 w - - 0 24
caption: White to move. The back rank is a problem: the king has no square. h3 gives luft safely; g3? would weaken the light squares, and Black's bishop on b7 is waiting on the long diagonal.
arrows: h2h3
red: b7h1
```

```line
fen: 3r2k1/pbq2pp1/1p2p2p/8/8/2P2N2/PP2QPPP/3R2K1 w - - 0 24
moves: 24.h3 Rxd1+ 25.Qxd1
check: engine
caption: With luft on h2, White's king is safe and the position is balanced. After 24.g3? Rxd1+ 25.Qxd1 Qc6 the queen and bishop on the long diagonal threaten f3 and h1, and White is in serious trouble.
```

The guideline: make luft with the **h-pawn** (h3 or ...h6) when the opponent's bishop controls the long light diagonal or could use the g3 square, and choose the pawn whose move creates squares the opponent *cannot* use. Make luft early, at a quiet moment, rather than when you are already in trouble.

### The weaknesses of ...h6, ...g6 and ...f6

Each shield pawn move gives up different squares. For Black (White is a mirror image):

* **...h6** weakens g6 and, more importantly, creates a **hook**: a pawn on h6 can be attacked by g4-g5, which opens the g-file. It also makes sacrifices on h6 possible (Bxh6 when the g7 pawn is pinned or overloaded).
* **...g6** weakens the dark squares f6 and h6. If Black's dark-squared bishop disappears, a white queen or knight on those squares can be deadly. It also creates a hook on g6 for h4-h5.
* **...f6** opens the a2-g8 diagonal to the king and weakens e6 and g6. A white bishop on c4 or b3 then points straight at the king.

```line
fen: startpos
moves: 1.e4 c5 2.Nf3 d6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 g6 6.Be3 Bg7 7.f3 O-O 8.Qd2 Nc6 9.O-O-O
check: engine
caption: The Yugoslav Attack in the Sicilian Dragon, a famous opposite-castling battle.
```

```board
fen: r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/2KR1B1R b - - 4 9
caption: Black's ...g6 put the bishop on g7, but it also made h6 and f6 sensitive. White's plan is Bh6 to trade the bishop that guards those squares, followed by h4-h5 against the hook on g6. Black's plan is a race on the other wing.
arrows: e3h6 h2h4
squares: h6 f6 g6
orientation: black
```

None of these moves is automatically bad. ...g6 with a bishop on g7 is a sound defensive setup, and ...h6 is often useful to stop Bg5 or Ng5. The rule is: make such a move for a reason, and then remember which squares it gave away.

## Opposite-side castling: the pawn storm

When the kings have castled on **opposite sides**, the game changes character. You can throw the pawns in front of the *opponent's* king forward without weakening your own king, because your own king is on the other wing. These advancing pawns form a **pawn storm**.

Opposite-side castling positions are races. Two practical rules:

* **Speed matters more than material.** A pawn sacrificed to open a file toward the enemy king is often well spent. A tempo spent on a "safety" move is often a tempo lost.
* **Use the hooks.** An advanced enemy pawn on h6 or g6 (h3 or g3 for White) gives your pawns something to attack, so files open faster.

When you are defending in such a race, do not only defend. Counter-attack on your own wing, and if the centre can be opened, do that — an open centre usually helps the side whose pieces are ready.

```board
fen: r4rk1/1bqnbpp1/p2ppn1p/1p6/4P1P1/2NBBN1P/PPPQ1P2/1K1R3R b - - 0 15
caption: Black to move in a race. White's g4-g5 is coming against the hook on h6, but Black is first: ...b4 hits the knight that defends e4 and opens lines toward White's king.
arrows: b5b4
red: g4g5
orientation: black
```

```line
fen: r4rk1/1bqnbpp1/p2ppn1p/1p6/4P1P1/2NBBN1P/PPPQ1P2/1K1R3R b - - 0 15
moves: 15...b4 16.Na4 Nxe4
check: engine
caption: Black wins the e4 pawn and his attack is already rolling, while White's storm has not started.
```

## Same-side castling: attacking with pieces

When both kings are on the same side, a pawn storm weakens your own king too. The attack must come mainly from **pieces**. The method is the counting from the start of this chapter:

1. **Bring more attackers than he has defenders.** Count the pieces that can reach the king's area in one or two moves.
2. **Remove or deflect the key defender** — usually the knight on f6, the bishop on g7, or the pawn on g7 or h7.
3. **Open a line** — a file for a rook, a diagonal for a bishop — or use a **rook lift** (Re3-g3, Rf3-h3) to bring a rook into the attack when the files are closed.

### When is it time to attack?

Many attacks at this level fail because they start too early, with two pieces against four defenders. Before you commit — especially before you push pawns or sacrifice — run a short check:

* **Is my centre stable?** If the opponent can open the centre with a pawn break, your attacking pieces may be cut off or your own king exposed. Attacks on the wing work best when the centre is closed or firmly under your control.
* **Are my pieces pointing at the king?** Count the pieces that already aim at the king's area: bishops on the diagonals toward g7 or h7, a knight that can reach g5 or f5, a queen that can reach h5 or the g-file, a rook that can lift.
* **Is there a target?** A weakened shield pawn (h6, g6 or f6), a missing defender (no knight on f6), or an open file.

If two of the three answers are yes, start bringing pieces. If all three are yes, look for a forcing blow now — this is when sacrifices appear.

## Typical sacrifices

Most attacks against the castled king end with one of a handful of sacrifices. Learn the *conditions* for each, not just the move.

### Bxh7+ (the Greek gift)

You met the Greek gift in [Chapter 11](#ch-11). The pattern is Bxh7+ Kxh7 Ng5+ followed by Qh5 (or Qg4, Qd3+). It usually works when:

* the bishop is on d3 (or the b1-h7 diagonal) and nothing defends h7 except the king;
* a knight can reach g5 and **no black piece can take it there** (watch out for a bishop on e7 or a queen on d8 with the diagonal open);
* the queen can reach h5 quickly;
* Black has **no knight on f6** — often a white pawn on e5 has driven it away;
* the black king cannot run to g6 and then escape safely.

The second condition is the one players forget most often. Here is what happens when it fails:

```board
fen: r1bq1rk1/pp1nbppp/2n1p3/2ppP3/3P4/2NB1N2/PPP2PPP/R1BQR1K1 w - - 6 9
caption: Everything looks right — bishop on d3, knight on f3, pawn on e5 — but the bishop on e7 covers g5. The sacrifice fails.
squares: g5 e7
red: e7g5
```

```line
fen: r1bq1rk1/pp1nbppp/2n1p3/2ppP3/3P4/2NB1N2/PPP2PPP/R1BQR1K1 w - - 6 9
moves: 9.Bxh7+? Kxh7
check: engine
caption: After 10.Ng5+ Bxg5 the knight is simply gone, and White has given a bishop for a pawn. Count the defenders of g5 before you sacrifice on h7.
```

### Nxf7, Rxf6, Bxg7 and Rxh7

* **Nxf7** (or Bxf7+) works when f7 is defended only by the king — typically when the king is still on e8 or the rook has left f8. It is especially strong when the e6 pawn is pinned, so that the queen can follow on e6.
* **Rxf6** (an exchange sacrifice) removes the knight that defends h7. If Black recaptures with the g-pawn, the king's shield is wrecked; if he does not, he is a piece down. The idea works whenever h7 is attacked twice and defended only by the knight.
* **Bxg7** breaks the pawn shield when the queen can follow on g4, g5 or h6, or when a rook can swing to the g-file. It often comes after a first sacrifice on h7 — the famous "double bishop sacrifice", in which a bishop is given on h7, the second on g7, and the queen and a lifted rook finish the job. Check before playing it that the black king cannot run to f8 and e7, and that your queen really reaches the g-file with check.
* **Rxh7** or Qxh7+ with a rook on the h-file finishes many opposite-castling attacks once the h-file is open.

:::key Count before you sacrifice
List the attackers that will still be in play after the sacrifice, then list the defenders that can arrive. If the attackers do not outnumber the defenders near the king, the sacrifice is probably unsound — however beautiful.
:::

## The king in the centre

A king that has not castled is vulnerable as soon as the centre opens. The e-file is the main highway: a rook or queen on e1 against a king on e8 pins anything that stands between them. The method for punishing an uncastled king is:

* **Open the centre** — with a pawn break (d4-d5, e4-e5) or a sacrifice — before the king escapes.
* **Use the pins on the e-file**, which stop the defender's pieces and pawns from capturing.
* **Prevent castling** by controlling f8 or f1, or by giving a check that forces the king to move.

If *your* king is still in the centre and the position is opening, castle — and do not grab a pawn that opens yet another line toward your own king.

## Worked example: the uncastled king

```board
fen: r1bqk2r/ppp1bppp/2np1n2/6B1/2BP4/2N2N2/PPP2PPP/R2QR1K1 w kq - 0 10
caption: White to move. Black has not castled, the e-file is open, and the bishop on e7 is pinned against the king by the rook on e1.
arrows: e1e8
squares: e7 f6
```

**Evaluate.** Safety scan first: nothing of White's is attacked, and Black's only threat is to castle next move, which would end most of White's chances. White has more pieces near the black king: the rook on e1, the bishops on c4 and g5, two knights. Black's king has no pawn shield problems yet, but it is still on e8, and the bishop on e7 is pinned — it cannot move without exposing the king to Re1.

**Plan.** Use the pin now, before ...O-O. The knight on f6 is the piece that holds Black's position together: it guards d5, e4 and h7, and it stands between the g5-bishop and the pinned bishop on e7.

**Candidate moves.** 10.Bxf6, 10.d5 (kicking the c6-knight and opening the centre) and 10.Qe2 (adding to the pressure on e7).

**Opponent's best reply to each.** After 10.Qe2 Black simply castles and is fine. After 10.d5 Ne5 11.Nxe5 dxe5 12.Rxe5 White wins a pawn — good, but there is more. After 10.Bxf6 the obvious recapture ...Bxf6 is *illegal*: the bishop on e7 is pinned. Black must take with the g-pawn.

```line
fen: r1bqk2r/ppp1bppp/2np1n2/6B1/2BP4/2N2N2/PPP2PPP/R2QR1K1 w kq - 0 10
moves: 10.Bxf6 gxf6 11.Qd2 Bg4 12.Nd5
check: engine
diagram: end
caption: Black's pawn shield is wrecked before the king has even castled, the e7-bishop is still pinned, and the knight on d5 joins the attack on e7 and f6. White is winning.
```

**Move.** 10.Bxf6. The blunder check: after 10...gxf6 no white piece is loose, and the pin on e7 remains. Notice the order of thought: the pin was the special feature of the position, so the first question was "what can I capture that he cannot recapture normally?" A king in the centre often hands you exactly that.

:::example What the worked example teaches
* An uncastled king turns e-file pins into weapons: pieces and pawns between the king and your rook cannot recapture.
* Strike before the king castles; one tempo can decide.
* Removing a key defender (here the f6-knight) is often stronger than winning a pawn.
:::

## Defending your king

Defence is not passive waiting. The good defender has a plan too:

1. **Trade the attackers.** Every exchange of an attacking piece reduces the count near your king. A knight on g5 or a bishop on h6 is often worth taking even at a small cost.
2. **Bring defenders**, especially a knight to f6 (f3 for White) or a bishop back to g7 or f8.
3. **Avoid new pawn weaknesses.** If you must move a shield pawn, choose the one that blocks the attacking line or gains a tempo, and weakens the fewest squares.
4. **Counter-attack in the centre.** A flank attack is often best met by opening the centre, where the attacker's pieces may be stuck on the wrong side.
5. **Give back material** if it breaks the attack. A pawn returned to trade queens can save the game.

The fourth point deserves an example. Go back to the Dragon position from earlier in this chapter. White has castled long and wants Bh6 and h4-h5. Black's most effective answer is not a defensive move on the kingside at all, but a strike in the centre.

```board
fen: r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/2KR1B1R b - - 4 9
caption: Black to move. Instead of waiting for Bh6 and h4-h5, Black strikes in the centre with ...d5 and fights for the initiative before White's storm arrives.
arrows: d6d5
orientation: black
```

```line
fen: r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/2KR1B1R b - - 4 9
moves: 9...d5 10.exd5 Nxd5 11.Nxc6 bxc6 12.Bd4
check: engine
caption: The centre is open, Black's pieces are active and the bishop on g7 bites along the long diagonal toward White's queenside. White has had to give up the attacking plan to deal with the centre.
```

Notice what ...d5 did. White's planned pawn storm needed time, and opening the centre took that time away: White had to react to threats in the middle of the board before any pawn reached Black's king. A defender who only shuffles on the kingside gives the attacker all the time he needs.

:::mistake The panic pawn move
When your king is threatened, the first move that comes to mind is often a pawn move in front of it — ...h6, ...g6 or ...f5 — because it "makes a wall". Each one creates new targets. Before playing it, look for a piece that can defend instead, and if a pawn move is needed, compare the squares each one gives away.
:::

## Attacking and defending in your own games

In your game reviews, mark every move where you moved a pawn in front of your castled king and write down why. Then mark every attack you started and count the attackers and defenders at the moment you began. You will usually find that your failed attacks started with too few pieces, and that most of your king's problems began with a pawn move you did not need to make.

:::nextgame In your next game
Before every move, glance at both kings and count: attackers near the enemy king, defenders near yours. When your count is bigger, look for a sacrifice or a line-opening move. When his is bigger, bring a defender or trade an attacker before anything else.
:::

## Practice at the board

1. **The failed Greek gift.** FEN `r1bq1rk1/pp1nbppp/2n1p3/2ppP3/3P4/2NB1N2/PPP2PPP/R1BQR1K1 w - - 6 9`. Play 9.Bxh7+ and try to make the attack work against an engine; then take back and play a normal move such as 9.Bf4. Which defender of g5 ruined the sacrifice?
2. **Opposite-side race.** FEN `r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/2KR1B1R b - - 4 9`. Play this Dragon position several times from both sides against a friend or the engine at a modest level. As White, aim for Bh6 and h4-h5; as Black, for ...Rc8, ...Ne5 and ...b5. Who gets there first?
3. **Luft choice.** FEN `3r2k1/pbq2pp1/1p2p2p/8/8/2P2N2/PP2QPPP/3R2K1 w - - 0 24`. Play the position after 24.h3 and after 24.g3. Notice how often Black's bishop on b7 matters in the second case.
4. **Count drill.** Take three middlegame positions from your recent games. For each king, write down the number of enemy pieces that could reach its area in two moves and the number of defenders. Compare with what happened in the game.

## Chapter summary

* A king is safe when its pawn shield is intact, a defending piece is nearby, and no lines are open toward it.
* Make luft early and with the pawn that weakens the fewest useful squares, usually the h-pawn.
* ...h6, ...g6 and ...f6 each give away specific squares and create hooks; play them for a reason.
* With opposite-side castling, storm with pawns and value speed over material; use the opponent's hooks.
* With same-side castling, attack with pieces: more attackers than defenders, remove the key defender, open a line.
* Learn the conditions of Bxh7+, Nxf7, Rxf6 and Bxg7, and count attackers and defenders before you sacrifice.
* Punish an uncastled king by opening the centre and using pins on the e-file.
* Defend by trading attackers, bringing defenders, avoiding panic pawn moves and counter-attacking in the centre.

:::cheat King safety — the attack-and-defence procedure
1. For both kings, check the shield pawns, the nearby defenders and the open lines.
2. Count attackers that can reach the king's area in one or two moves against the defenders that can arrive.
3. Opposite-side castling: storm with pawns at once; same-side: attack with pieces and a rook lift.
4. Before a sacrifice, list the conditions (defender of g5, knight on f6, escape squares) and count again.
5. Defending: trade the strongest attacker, bring a defender, and only then consider a shield pawn move — the one that blocks the line or gains a tempo.
6. If a king is still in the centre, open the centre (or castle, if it is yours).
:::

@exercises
