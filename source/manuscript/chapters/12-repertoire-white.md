---
chapter: 12
slug: repertoire-white
title: Your Repertoire as White
subtitle: 1.e4, the Italian Game, and a plan against everything else
part: 2
stage: "600–800"
skills: [repertoire-white, opening-principles, opening-traps, planning]
objectives:
  - Play the Italian Game with c3 and d3 (the Giuoco Pianissimo) from memory of its set-up, not of long move lists.
  - Know the one or two critical moves against every common Black reply to 1.e4.
  - Recognize the standard middlegame plans of each structure (Re1, Nbd2-f1-g3, h3, a4/b4, the d3-d4 break).
  - Punish the dubious replies (2...f6, 2...d5, 2...Qf6, early ...Nf6xe4 in the Petrov) with short, safe ideas.
  - Notice when the standard plan no longer fits and switch to a different one.
next_game: Play 1.e4 in every White game this week; after each one, check the first ten moves against this chapter and write down the first move where you or your opponent left the repertoire.
---

You sit down as White, play 1.e4, and by move eight you are already thinking for five minutes because your opponent played something you have never seen. Worse, you spend that time hunting for a trap you half remember instead of simply developing. At club level, most games are not decided by opening theory. They are decided by whether you reach a normal middlegame with a safe king, developed pieces and a plan you understand.

This chapter gives you exactly that. You will learn one main system, the **Italian Game** with c3 and d3, and short, practical answers to everything else Black can play after 1.e4. The goal is not to memorize twenty moves. The goal is to know *where your pieces go*, *what you are trying to do*, and the handful of concrete moves where a mistake would cost you the game.

## How to use a repertoire

A **repertoire** is the set of openings you have decided to play, so that you are not reinventing the wheel every game. A good repertoire for a player rated 600–1200 has three properties: it follows the opening principles from [Chapter 6](#ch-06), it leads to positions with clear plans, and it does not collapse if you forget a move.

Every line in this chapter has been checked with a strong engine. That does not mean you must memorize every move. Treat the move lists as examples of the *ideas*, and learn the parts that are marked as critical.

:::coach How much to memorize
Coaching judgment: below about 1200, learn your first five or six moves by heart in each line, and learn the *plan* that comes after. Beyond that, play by principles. If you find yourself memorizing move fifteen of a line, stop and spend the time on tactics instead.
:::

### The three questions after your opponent leaves the book

Sooner or later your opponent plays a move this chapter does not mention. When that happens, ask:

1. **Is something hanging or threatened?** Run the safety scan from [Chapter 4](#ch-04): checks, captures, threats, for both sides.
2. **Did the move break an opening principle?** An early queen sortie, a pawn move that weakens the king, a piece moved twice. If so, look for a move that develops *with tempo* (attacking something).
3. **If nothing is wrong, what is my set-up?** Put your pieces on the squares this chapter recommends and continue with the standard plan.

## The Italian Game: your main weapon

After 1.e4 e5 2.Nf3 Nc6 3.Bc4, your bishop points at f7, the weakest square in Black's camp, and you are ready to castle on move four or five. That is the **Italian Game**. We will play it in its calm form, called the **Giuoco Pianissimo** ("very quiet game"), with the pawns on c3 and d3.

### The set-up

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O
check: engine
caption: The basic Giuoco Pianissimo. Both sides have castled and the centre is solid.
```

Learn the *jobs* of the White moves, not just the moves:

* **c3** prepares a later d4, takes the d4 square away from Black's knight, and gives the bishop a retreat square on c2 if it is ever attacked by ...Na5.
* **d3** supports the e4 pawn so that it can never hang, and opens the c1 bishop's diagonal.
* **O-O** puts the king safe before anything sharp happens.

Notice what White does *not* do: no early Ng5, no early queen move, no grabbing pawns. You are building a house before you invite anyone inside.

```board
fen: r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7
caption: The standard plan from here: Re1 (protect e4, prepare Nbd2), Nbd2-f1-g3 (the knight reroute), h3 (stop ...Bg4 and ...Ng4), and a4 to gain queenside space.
arrows: f1e1 b1d2 h2h3 a2a4
squares: f7
```

### The move-order choices

You may play 4.c3 and 5.d3, or 4.O-O and 5.d3 and 6.c3. Both usually reach the same position. The order in this book (4.c3 Nf6 5.d3) is the most common and avoids an important early pitfall: with d3 already played, your e4 pawn is always protected.

Against 3...Nf6 (the **Two Knights Defence**) you play 4.d3 first, and then c3 and O-O follow:

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.d3 Bc5 5.c3 d6 6.O-O O-O
check: engine
caption: Against 3...Nf6, 4.d3 protects e4 and transposes to the same calm position.
```

Why not the famous 4.Ng5, attacking f7? Because it leads to very sharp lines in which Black sacrifices a pawn for a fast attack, and you would need to memorize a lot of theory. 4.d3 is sound, simple and keeps the game in the structures you know. If Black plays 4...Be7 instead of 4...Bc5, the plan is identical:

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Nf6 4.d3 Be7 5.O-O O-O 6.Re1 d6 7.c3
check: engine
caption: Same set-up, same plan. Next come h3, Nbd2-f1-g3 and a4 or the d3-d4 break.
```

Against 3...Be7, the **Hungarian Defence**, Black is very solid but passive. Here you can claim the centre at once with 4.d4:

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Be7 4.d4 exd4 5.Nxd4 Nf6 6.Nc3 O-O 7.O-O
check: engine
caption: Against the Hungarian, White takes the centre with d4 and develops freely.
```

If Black keeps the pawn on e5 with 4...d6, push past it with 5.d5, gain space and develop: 5...Nb8 6.Nc3 Nf6 7.h3 O-O 8.O-O. If you prefer, the usual c3/d3 set-up is also perfectly fine against 3...Be7.

### The middlegame plan: Re1, h3 and the knight tour

The c3/d3 structure has one awkward piece: the knight on b1. It cannot go to c3, because the pawn is there. Its standard route is **b1-d2-f1-g3**: on g3 it eyes f5 and h5, supports an attack on the kingside, and the f1 square it passes through also protects the king. For the knight to go via f1, the rook must first leave f1, which is one more reason to play Re1.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O 7.Re1 a6 8.a4 Ba7 9.h3 h6 10.Nbd2 Re8 11.Nf1 Be6 12.Ng3
check: engine
diagram: end
caption: A model Pianissimo position. White's knight has arrived on g3, h3 has stopped ...Bg4 and ...Ng4, and a4 has gained queenside space.
```

Look at the moves 8.a4 and 9.h3. They look like slow pawn moves, but each one does a job:

* **h3** takes the g4 square away from Black's bishop and knight. Without it, ...Bg4 pins your f3 knight to the queen, and ...Ng4 can join with ...Bc5 against f2.
* **a4** gains space and prepares a4-a5 or b4-b5, pushing Black's queenside pieces back.

### The a4 idea against the bishop on c5

Black's bishop on c5 is a strong piece. White often plays b4 to kick it, and then a4 threatens to trap it with a5. Black must answer with ...a6 or ...a5 to give the bishop room. Watch what happens if Black castles automatically:

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.b4 Bb6 7.a4 O-O? 8.a5
check: engine
diagram: end
caption: The bishop on b6 has no safe square: c5 is covered by the b4 pawn and a7 is blocked by Black's own pawn. Black loses a piece for a pawn or two.
red: a5b6
squares: b6
```

This is the trap. The correct reply to 7.a4 is 7...a6 or 7...a5, after which the position is balanced. The lesson for White: when Black's bishop is on c5 or b6 and Black has not played ...a6, *count its retreat squares*. For Black (see [Chapter 13](#ch-13)), the lesson is the reverse.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.b4 Bb6 7.a4 a5 8.b5 Ne7 9.O-O
check: engine
caption: After the correct 7...a5, White plays b5 to push the knight away from the centre and castles. White has queenside space; the game is level.
```

### When ...Bg4 pins: play h3

If Black plays ...Bg4 before you have played h3, the knight on f3 is **pinned** (see [Chapter 8](#ch-08)): it cannot move without exposing your queen. The standard reaction is to ask the bishop at once with h3.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O 7.Re1 Bg4 8.h3 Bh5 9.Nbd2
check: engine
caption: 8.h3 forces Black to decide. After 8...Bh5 White simply develops; after 8...Bxf3 9.Qxf3 White gets the bishop pair.
```

There are two possible answers for Black, and both are fine for you:

* **8...Bxf3 9.Qxf3**: you have the two bishops, and your queen eyes f7 and the kingside.
* **8...Bh5**: keep developing with 9.Nbd2. Later, g4 can break the pin, but be careful.

:::mistake The early g4 lunge
After ...Bh5, many players push g4 at once to chase the bishop. With Black's knight on f6 and your king on g1, that can allow ...Nxg4! hxg4 Bxg4, and Black gets two pawns and an attack on your bare king. Only play g4 when Black cannot sacrifice on it, typically when the knight has left f6 or when your king is not castled on that side.
:::

### The Bg5 pin, used by White

Your own c1 bishop can pin Black's f6 knight with Bg5. This is most useful once Black has castled, because the pin then also weakens the defence of the black king.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O 7.Bg5 h6 8.Bh4 Be6 9.Nbd2 Bxc4 10.Nxc4
check: engine
caption: White pins the knight; after ...h6 the bishop keeps the pin from h4. A typical exchange of light-squared bishops follows.
```

If Black chases the bishop with ...h6 and ...g5, retreat with Bg3. The pawn advance has weakened the squares around Black's king (especially f5 and h5), which your knight can later use. Do not automatically sacrifice a piece on g5 for two pawns; check first whether you have follow-up attackers.

### Traps to avoid: the early Ng5 adventure

Beginners love Ng5 in the Italian because it attacks f7 twice with knight and bishop. With Black's bishop on c5 and nothing on f6, it can lose a piece instantly:

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.Ng5?? Qxg5
check: engine
diagram: end
caption: The g5 square is defended by nothing; the queen simply takes the knight along the d8-g5 diagonal.
red: d8g5
squares: g5
orientation: white
```

Even when Ng5 does not lose a piece, a knight raid followed by Nxf7 usually trades two minor pieces for a rook and pawn, which at club level is almost always bad for the side doing it:

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 O-O 6.Ng5?! h6 7.Nxf7? Rxf7 8.Bxf7+ Kxf7
check: engine
caption: White gave a knight and bishop for a rook and a pawn. Black's two minor pieces will dominate the middlegame.
```

:::key Pieces before adventures
In the Italian, every early attacking move (Ng5, Qb3, Bxf7+) should be checked against one question: *what happens after the most natural defending move?* If the answer is "I have to retreat and I've lost time", it is not an attack, it is a waste of tempi.
:::

### The d3-d4 break

The pawn on d3 is not meant to stay there forever. When your pieces are developed and the centre is stable, the **d3-d4 break** (a pawn move that challenges the opponent's pawn chain) opens lines for your rooks and bishops. The best moment is usually when Black has spent a tempo, or when Black has opened the centre first.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O 7.Re1 a6 8.a4 Ba7 9.h3 h6 10.Nbd2 Re8 11.Nf1 Be6 12.Bxe6 Rxe6 13.Ng3 d5 14.exd5 Nxd5 15.d4
check: engine
diagram: end
caption: Black opened the centre with ...d5, so White strikes back with d4. The e5 pawn is attacked, the rook on e1 eyes the e-file, and White's pieces are ready.
arrows: d4e5 e1e5
```

### A worked example: what do you play after ...Bg4?

Here is the full thinking process in a position you will meet often. White has just played Re1; Black answers ...Bg4.

```board
fen: r2q1rk1/ppp2ppp/2np1n2/2b1p3/2B1P1b1/2PP1N2/PP3PPP/RNBQR1K1 w - - 4 8
caption: White to move. Black's bishop pins the knight on f3 to the queen. What do you play?
red: g4f3
squares: f3 d1
```

**Step 1 — Safety scan.** Checks: none for either side that make sense. Captures: Bxf7+ Rxf7 gives a bishop for a pawn, no. Threats: Black's pin means that if the knight on f3 moves, Black's bishop takes the queen. Is anything hanging right now? No. Could Black increase the pressure? Yes: ...Nd4 attacks f3 a second time, and ...Nxf3+ gxf3 would wreck the pawns in front of your king. So there *is* a slow threat.

**Step 2 — Candidate moves.** h3 (ask the bishop), Nbd2 (defend f3 again), Be3 (trade the c5 bishop), and Bb5 (pin the c6 knight).

**Step 3 — Compare.** h3 forces a decision at once and costs nothing: if 8...Bxf3 9.Qxf3, you have the two bishops; if 8...Bh5, the pin remains but you can now meet ...Nd4 calmly, and Nbd2 follows next move. Nbd2 is also fine (the engine rates it almost equal), but it allows Black to keep all options. Be3 invites ...Bxe3, and after Rxe3 your rook stands on an awkward square.

**Step 4 — Decision.** 8.h3. Then, against 8...Bxf3 9.Qxf3 Na5, the bishop simply steps aside with 10.Bb5 (or Bb3), and White is comfortable.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O 7.Re1 Bg4 8.h3 Bxf3 9.Qxf3 Na5 10.Bb5
check: engine
caption: After the bishop exchange White has two bishops, and the queen on f3 supports kingside play.
```

### Watch your f2 square

Once you play Re1, the f2 pawn is protected only by your king. Black's typical counterplay is ...Ng4, aiming at f2 together with the bishop on c5. The standard antidote is h3 before Black can use g4, or a calm Re2 or Re1-f1 if the knight arrives. Here, after 7...Ng4 8.Re2, Black's knight has no follow-up and soon retreats:

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O 7.Re1 Ng4 8.Re2 Kh8 9.h3 Nf6
check: engine
caption: Re2 defends f2 a second time. Black's knight raid achieved nothing and it returns home.
```

### When the Italian plan should change

The plan "Re1, Nbd2-f1-g3, h3, a4" is a default, not a law. Change it when:

* **Black opens the centre.** If Black plays ...d5 and exchanges pawns, your pieces need open lines quickly: play d4, put rooks on e1 and d1, and stop slow manoeuvring.
* **Black castles queenside.** Then your a- and b-pawns become attackers: b4, a4, b5 against the black king.
* **Black's bishop leaves c5 for good.** If the dangerous bishop goes to e7, f2 is no longer a target, and you may play d4 earlier.
* **Black gives up the centre with ...exd4.** Recapture with cxd4 and you have the ideal centre (pawns on e4 and d4). Then your plan becomes e4-e5 or d4-d5 to gain space.
* **Black plays ...Na5 to hunt your bishop.** Do not lose time; retreat to b3 or c2 (that is why you played c3) and use the time Black spends with the knight.

## Black's other second moves

Not everyone plays 2...Nc6. Here is how to deal with the alternatives you will actually meet.

### The Petrov: 2...Nf6

In the Petrov Defence, Black counterattacks e4 instead of defending e5. Take the pawn first, then retreat:

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nf6 3.Nxe5 d6 4.Nf3 Nxe4 5.d4 d5 6.Bd3 Bd6 7.O-O O-O 8.c4 c6 9.Nc3 Nxc3 10.bxc3
check: engine
caption: The main line in simple form. White develops, castles, and challenges Black's centre with c4.
```

The critical point is move three. Black must play 3...d6 *before* taking on e4. Against the copycat 3...Nxe4?!, play **4.Qe2**. The queen and the knight on e5 line up on the e-file against Black's king, and if Black moves the attacked knight carelessly, a discovered check wins the queen:

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nf6 3.Nxe5 Nxe4?! 4.Qe2 Nf6?? 5.Nc6+
check: engine
diagram: end
caption: The knight on c6 gives a discovered check from the queen on e2 and attacks the queen on d8 at the same time. White wins the queen.
arrows: e2e8 c6d8
squares: d8 e8
```

The best defence after 4.Qe2 is 4...Qe7 5.Qxe4 d6 6.d4 dxe5 7.dxe5, and White is a pawn up after the queen trade or a more pleasant position; you do not need to memorize more than that.

Two more Petrov sidelines:

* **3...Qe7?!** (attacking the knight and the e4 pawn): 4.Nf3 Qxe4+ 5.Be2. You have given back the pawn, but you are ahead in development and Black's queen is exposed.
* **3...Nc6** (the "Stafford Gambit", popular online): 4.Nxc6 dxc6 5.d3 and develop with Be2, O-O. Most of Black's tricks rely on White playing f3 or Bc4 too early; d3 and Be2 keep everything protected.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nf6 3.Nxe5 Nc6 4.Nxc6 dxc6 5.d3 Bc5 6.Be2
check: engine
caption: Against the Stafford, a piece up, White simply develops with d3 and Be2 and castles.
```

### The Philidor: 2...d6

Play 3.d4 and develop normally. Black's position is solid but cramped.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 d6 3.d4 exd4 4.Nxd4 Nf6 5.Nc3 Be7 6.Be2 O-O 7.O-O
check: engine
caption: Black gave up the centre. White has more space and easy development.
```

If Black pins with 3...Bg4?!, the game often follows a famous pattern: 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4. Now 6...Nf6? allows 7.Qb3, attacking f7 and b7 at once:

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 d6 3.d4 Bg4?! 4.dxe5 Bxf3 5.Qxf3 dxe5 6.Bc4 Nf6 7.Qb3 Qe7 8.Nc3 c6 9.Bg5
check: engine
caption: White's lead in development is huge. This is the pattern of Morphy's famous "Opera Game" (Paris 1858).
```

### Dubious defences: 2...f6, 2...f5, 2...Qf6 and 2...d5

These are moves you will see at the 400–800 level. Each one breaks an opening principle. You do not need deep knowledge; you need one good idea against each.

**2...f6? (the Damiano Defence)** weakens the e8-h5 diagonal. Take the pawn: 3.Nxe5!. If Black takes back, the queen check is crushing:

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 f6? 3.Nxe5 fxe5? 4.Qh5+ Ke7 5.Qxe5+ Kf7 6.Bc4+
check: engine
diagram: end
caption: Black's king is dragged into the open. White has a winning attack (after 4...g6 5.Qxe5+ wins the rook on h8).
arrows: h5e5 c4f7
```

The better defence for Black is 3...Qe7 4.Nf3 Qxe4+ 5.Be2, and White is ahead in development while Black's king and queen are awkwardly placed.

**2...f5? (the Latvian Gambit)** is sharper. A simple, safe answer is 3.Nxe5 Qf6 4.d4 d6 5.Nc4 fxe4 6.Nc3. Your knight is safe on c4, you have developed, and Black's queen is exposed.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 f5? 3.Nxe5 Qf6 4.d4 d6 5.Nc4 fxe4 6.Nc3
check: engine
caption: Against the Latvian, simple development is enough. Next White can play Ne3, Be2, O-O, or attack the e4 pawn.
```

**2...Qf6?!** defends e5 with the queen. Develop with gain of time: 3.Nc3 (threatening Nd5 to hit the queen) and then d4.

**2...d5? (the Elephant Gambit)** gives a pawn for little. Take it: 3.exd5. If 3...e4, 4.Qe2 pins the pawn to the king and wins time: 4...Nf6 5.d3. If 3...Qxd5, 4.Nc3 attacks the queen and you develop with tempo.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 d5? 3.exd5 e4 4.Qe2 Nf6 5.d3
check: engine
caption: White keeps the extra pawn. The e4 pawn will fall or be exchanged, and White develops normally.
```

## Against the Sicilian: 2.c3 (the Alapin)

After 1.e4 c5, the main lines of the Sicilian are a jungle of theory. The **Alapin**, 2.c3, prepares d4 so that after ...cxd4 you can recapture with the c-pawn and keep two pawns in the centre. It leads to clear positions with easy development.

### 2...d5: take, then build the centre

```line
fen: startpos
moves: 1.e4 c5 2.c3 d5 3.exd5 Qxd5 4.d4 Nf6 5.Nf3 e6 6.Bd3 Nc6 7.O-O cxd4 8.cxd4 Be7 9.Nc3 Qd6 10.Re1 O-O
check: engine
diagram: end
caption: White has an isolated d-pawn but active pieces: Nc3 came with tempo against the queen, and the Bd3, Re1 and Nf3 aim at Black's kingside.
arrows: d3h7 e1e6
```

On move three, Black's queen comes to d5 and cannot be chased by Nc3 at once, because c3 is occupied by your pawn. That is fine: 4.d4 builds the centre, Nf3 develops, and when Black takes on d4 and you recapture with the c-pawn, Nc3 *does* come with tempo.

The resulting pawn on d4 with no neighbouring c- or e-pawn is called an **isolated queen's pawn** (IQP). It can become weak in an endgame, but in the middlegame it gives your pieces open lines and the e5 square. Your plan: pieces to active squares (Bd3 or Bc4, Re1, Qe2, Ne5), and look for an attack on the black king. Avoid exchanging pieces without a reason; exchanges help the side playing against the isolated pawn.

### 2...Nf6: push past the knight

```line
fen: startpos
moves: 1.e4 c5 2.c3 Nf6 3.e5 Nd5 4.d4 cxd4 5.Nf3 Nc6 6.cxd4 d6 7.Bc4 Nb6 8.Bb5 dxe5 9.Nxe5 Bd7 10.Nxd7 Qxd7 11.Nc3
check: engine
caption: The knight on f6 was attacked; White gained space with e5 and d4 and develops quickly. Typical continuations are O-O, Qg4 or Qf3, and Re1.
```

The key ideas: 3.e5 chases the knight, 4.d4 builds the centre, and Nf3 and Bc4 develop while hitting the knight on d5. If Black takes on d4 at move four, you can recapture with the queen (4...cxd4 5.Qxd4) or play 5.Nf3 first and take back with the pawn. The pawn recapture is the simpler choice.

### Other Sicilian moves

* **2...e6**: 3.d4 d5 4.exd5 exd5 5.Nf3, and you develop with Be2 or Bd3, O-O and dxc5 at a good moment.
* **2...d6**: 3.d4 Nf6 4.Bd3, keeping e4 protected. If Black pushes ...Bg4 and ...Nc6, d5 gains space.
* **2...Nc6** and **2...g6**: 3.d4 cxd4 4.cxd4, and you have the ideal centre. Against 2...g6, push e5 when Black's knight wants f6.

```line
fen: startpos
moves: 1.e4 c5 2.c3 Nc6 3.d4 cxd4 4.cxd4 d5 5.exd5 Qxd5 6.Nf3 e5 7.Nc3 Bb4 8.Bd2 Bxc3 9.Bxc3 e4 10.Ne5
check: engine
caption: Against 2...Nc6, White recaptures with the c-pawn, develops with tempo on the queen, and the knight lands on a strong central square.
```

:::mistake The pawn-grabbing 4...e5?
In the 2...d5 line, after 3.exd5 Qxd5 4.d4 Black sometimes plays 4...e5? to fight for the centre. Then 5.dxe5 Qxd1+ 6.Kxd1 leaves White a healthy pawn up. You do not lose castling rights in any important way, because with queens off the board your king belongs in the centre anyway.
:::

## Against the French: the Exchange Variation

After 1.e4 e6 2.d4 d5, the French Defence normally leads to a locked centre that many club players find uncomfortable. With **3.exd5 exd5** you create a symmetrical, open position where your easy development and the half-open e-file count. You keep the extra tempo that comes with moving first.

```line
fen: startpos
moves: 1.e4 e6 2.d4 d5 3.exd5 exd5 4.Bd3 Nc6 5.c3 Bd6 6.Nf3 Nge7 7.O-O Bg4 8.Re1 Qd7 9.Nbd2 O-O 10.Nf1
check: engine
diagram: end
caption: A typical Exchange French. White has the same knight manoeuvre as in the Italian (Nbd2-f1-g3) and the e-file for the rook.
arrows: f1g3 e1e7
```

The set-up: Bd3, Nf3, O-O, c3 (supporting d4), Re1, and then Nbd2-f1 or Bg5 to pin a knight on f6. The plan: occupy the e-file and the e5 square, and only then think about a kingside attack with Ne5, Qf3 or Qc2.

:::key Symmetry is not a draw by itself
In symmetrical positions the side that controls the open file first usually gets the better of it. Put a rook on e1 early, and if Black challenges with ...Re8, be ready to exchange on e8 when that leaves you in control of the file.
:::

If Black plays an early 4...c5 to create an isolated pawn for you, the simplest antidote is 5.Nf3 Nc6 6.Qe2+, forcing Black to block with the bishop, and then dxc5 at a good moment. You take on c5 and Black recovers the pawn with the bishop, but Black's d5 pawn will be isolated, not yours.

```line
fen: startpos
moves: 1.e4 e6 2.d4 d5 3.exd5 exd5 4.Bd3 c5 5.Nf3 Nc6 6.Qe2+ Be7 7.dxc5 Nf6 8.O-O O-O 9.h3 Bxc5 10.c3
check: engine
caption: Now Black has the isolated d-pawn. White blockades with pieces and keeps the queen on the e-file.
```

## Against the Caro-Kann: the Exchange Variation

After 1.e4 c6 2.d4 d5 3.exd5 cxd5 the pawn structure resembles a Queen's Gambit with colours reversed. Play **4.Bd3**, controlling f5 so Black's light-squared bishop cannot develop easily.

```line
fen: startpos
moves: 1.e4 c6 2.d4 d5 3.exd5 cxd5 4.Bd3 Nc6 5.c3 Nf6 6.Bf4 Bg4 7.Qb3 Qd7 8.Nd2 e6 9.Ngf3 Bd6 10.Bxd6 Qxd6 11.O-O O-O 12.Rae1
check: engine
diagram: end
caption: The Exchange Caro-Kann. Note 7.Qb3, hitting b7 and d5, which is the classic answer once Black's bishop has left c8.
arrows: b3b7
```

The set-up: Bd3, c3 (supports d4 and gives the queen the b3 square), Bf4, Nd2, Ngf3, O-O. Two ideas to remember:

* **Qb3** as soon as Black's light-squared bishop leaves c8: the b7 pawn is then defended only by the queen or a rook.
* **h3 and Qc2**, aiming the queen and bishop at h7, if Black castles kingside while your bishop is on d3.

### When the Caro plan changes

If Black plays an early ...e5 to free the position, the centre opens. Take on e5 and target the isolated d5 pawn that remains:

```line
fen: startpos
moves: 1.e4 c6 2.d4 d5 3.exd5 cxd5 4.Bd3 Nf6 5.c3 Nc6 6.h3 e5 7.dxe5 Nxe5 8.Bc2
check: engine
caption: Black freed the position with ...e5, but the d5 pawn is now isolated. White develops with Nf3, O-O and puts pieces in front of it.
```

## Against the Scandinavian: 2.exd5 Qxd5 3.Nc3

Take the pawn and attack the queen at once. This is the simplest example of the opening principle "develop with tempo".

```line
fen: startpos
moves: 1.e4 d5 2.exd5 Qxd5 3.Nc3 Qa5 4.d4 Nf6 5.Nf3 c6 6.Bc4 Bf5 7.Bd2 e6 8.Qe2 Bb4 9.O-O-O
check: engine
caption: White develops every piece with ideas of Nd5 or Ne5. Castling long is one sharp option; castling short with O-O and Re1 is equally good.
```

The queen must move after 3.Nc3. It has three main squares:

* **3...Qa5**: 4.d4, then Nf3, Bc4, Bd2 (watch for Nd5 or Nb5 tricks against the queen on a5), O-O.
* **3...Qd6**: 4.d4 Nf6 5.Nf3, then Be2 or g3/Bg2, O-O and Be3. Beware of Black's ...Nb4 or ...Bg4 pressure on d4; keep it protected.
* **3...Qd8**: Black has lost time. 4.d4 Nf6 5.Nf3, and if 5...Bg4 6.h3 Bxf3 7.Qxf3 you have the bishop pair.

```line
fen: startpos
moves: 1.e4 d5 2.exd5 Qxd5 3.Nc3 Qd6 4.d4 Nf6 5.Nf3 a6 6.Be2 Nc6 7.O-O Bf5 8.Be3
check: engine
caption: Against 3...Qd6, a calm development: Be2, O-O and Be3 protect d4. Later the queen's rook goes to d1 or e1.
```

If Black answers 2.exd5 with 2...Nf6, simply play 3.d4 Nxd5 4.Nf3 and develop with Be2, O-O and c4 to chase the knight.

## Against the Pirc and Modern

In the **Pirc** (1...d6 2.d4 Nf6) and the **Modern** (1...g6), Black lets you build a big centre and plans to attack it later. Do not over-press. A solid, flexible set-up keeps everything protected:

```line
fen: startpos
moves: 1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.Nf3 Bg7 5.Be2 O-O 6.O-O c6 7.h3 Nbd7 8.Be3 e5 9.Qd2
check: engine
diagram: end
caption: White's "Classical" set-up: knights on c3 and f3, bishops on e2 and e3, castled king, and h3 to keep Black's pieces off g4.
arrows: d4d5 a2a4
```

The plan: keep the pawns on e4 and d4 as long as possible. When Black challenges with ...e5, you can either exchange on e5 or push **d5** to gain space and play on the queenside with a4 and later c4 (after moving the knight). Against ...c6 and ...b5 (Black gaining queenside space), a4 is the standard answer.

If Black pins with ...Bg4 before you play h3, Be3 and Qd2 are fine; after ...Bxf3 Bxf3 you get the bishop pair:

```line
fen: startpos
moves: 1.e4 d6 2.d4 Nf6 3.Nc3 g6 4.Nf3 Bg7 5.Be2 O-O 6.O-O Bg4 7.Be3 Nc6 8.Qd2 e5 9.d5 Bxf3 10.Bxf3 Nd4 11.Bxd4 exd4 12.Qxd4
check: engine
caption: Black's queenside play went wrong: White wins a pawn because the d4 pawn could not be held.
```

## Against the Alekhine: 2.e5 Nd5 3.d4 d6 4.Nf3

In the Alekhine Defence (1...Nf6), Black invites you to chase the knight. Do so once, then develop. Do not try to chase it all over the board with c4, f4 and other pawn moves; those big centres need precise theory.

```line
fen: startpos
moves: 1.e4 Nf6 2.e5 Nd5 3.d4 d6 4.Nf3 Bg4 5.Be2 e6 6.O-O Be7 7.c4 Nb6 8.Nbd2 O-O 9.h3 Bh5 10.b3
check: engine
diagram: end
caption: The modern main line in simple form. White has a space advantage, every piece is safe, and Black's bishop on h5 is a little offside.
arrows: c4c5 e5d6
```

The set-up: e5 and d4 pawns, Nf3, Be2, O-O, then c4 to kick the knight once more and h3. If Black plays ...dxe5, take back with the knight (Nxe5) and use your lead in development:

```line
fen: startpos
moves: 1.e4 Nf6 2.e5 Nd5 3.d4 d6 4.Nf3 dxe5 5.Nxe5 g6 6.Bc4 c6 7.O-O Bg7 8.Re1 O-O 9.Bb3
check: engine
caption: White's knight on e5 and bishop on b3 put pressure on f7, and the rook supports the knight.
```

## When plans should change: a general guide

Every set-up in this chapter has a "default plan". Here are the most common signals that it is time to switch to a different one.

* **The opponent opens the centre.** Slow manoeuvres (Nbd2-f1-g3, a4) belong to closed centres. In an open centre, development, rooks on open files and king safety come first.
* **The opponent's king goes to the other side.** Pawn storms only work against a king you are not sheltering behind the same pawns. If kings are castled on opposite sides, advance the pawns in front of *their* king.
* **A piece of theirs is stranded.** A bishop with no retreat (the a4-a5 trap), a queen chased early (the Scandinavian), a knight on the rim. Stop your plan and attack it.
* **They exchange your best piece.** If your bishop on c4 or d3 is traded, look for a different target: the kingside plan usually needs that bishop.
* **They make a pawn move that creates a hole.** ...g5, ...f6 or ...h6 followed by ...g5 creates weak squares like f5 or h5 that your knights can occupy. Re-route a knight there.

:::nextgame Track where the game left the book
After each game, note the move where your opponent (or you) deviated from this chapter. If the same deviation appears twice, it is time to study it: look up what this chapter suggests and play through the line on a board.
:::

## Practice at the board

You learn a repertoire by playing it, not by reading it. Use a physical board or any free chess app with an "analysis board" or "play vs computer from position" function.

1. **Set up the key positions and play them out.** Set up each of these and play at least three games from it against a friend or the computer at a moderate level (as White). Try to follow the plan from this chapter in each game.
   * Italian, after 6...O-O: `r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2PP1N2/PP3PPP/RNBQ1RK1 w - - 2 7`
   * Alapin, after 10...O-O in the 2...d5 line: `r1b2rk1/pp2bppp/2nqpn2/8/3P4/2NB1N2/PP3PPP/R1BQR1K1 w - - 5 11`
   * Exchange French, after 10.Nf1: `r4rk1/pppqnppp/2nb4/3p4/3P2b1/2PB1N2/PP3PPP/R1BQRNK1 b - - 10 10` (here Black is to move; you play White).
   * Exchange Caro-Kann, after 12.Rae1: `r4rk1/pp3ppp/2nqpn2/3p4/3P2b1/1QPB1N2/PP1N1PPP/4RRK1 b - - 3 12`
2. **Drill the first six moves.** On an empty board, play out each main line in this chapter from move one, saying the *purpose* of each White move aloud ("c3: prepares d4 and gives the bishop c2"). If you cannot say why a move is played, reread that section.
3. **Play the traps from both sides.** Set up the position after 7.a4 in the b4/a4 line (`r1bqk2r/ppp2ppp/1bnp1n2/4p3/PPB1P3/2PP1N2/5PPP/RNBQK2R b KQkq - 0 7`) and play Black's 7...O-O? to see the bishop trapped; then replay with 7...a5. Do the same for 3...Nxe4?! 4.Qe2 in the Petrov.
4. **Check yourself.** After each training game, compare your first ten moves with this chapter. Mark every move where you deviated and ask whether your move followed the same plan.

:::drill Five-minute set-up drill
Set up the starting position. Have a friend or the app play a random reasonable first move for Black. You have thirty seconds to name your second and third moves from this chapter, and one sentence for the plan. Repeat ten times.
:::

## Chapter summary

* Your White repertoire starts with 1.e4 and aims for clear, principled positions rather than sharp theory.
* Against 1...e5 2.Nf3 Nc6 3.Bc4, play the Giuoco Pianissimo: c3, d3, O-O, Re1, h3, Nbd2-f1-g3, and later a4 or the d3-d4 break. Against 3...Nf6 play 4.d3; against 3...Be7 play 4.d4.
* Count the retreat squares of Black's c5 bishop: b4 and a4-a5 can trap it if Black forgets ...a6 or ...a5.
* Avoid early Ng5 and Nxf7 adventures; answer ...Bg4 pins with h3, and keep an eye on f2 once the rook leaves f1.
* Against the Petrov, play 3.Nxe5, and after 3...Nxe4?! use 4.Qe2 with its discovered-check trick. Against 2...d6, 2...f6, 2...f5, 2...Qf6 and 2...d5, develop with tempo and take what is offered when it is safe.
* Against the Sicilian play 2.c3 and d4; against the French and Caro-Kann exchange on d5 and develop with Bd3, c3, Nf3, O-O and Re1 (plus Qb3 in the Caro); against the Scandinavian hit the queen with 3.Nc3; against the Pirc and Alekhine build a solid centre with Nf3, Be2 and O-O.
* Change plans when the centre opens, when kings are on opposite sides, or when an enemy piece is stranded.

:::cheat Opening checklist as White
1. After every opponent move, run the safety scan: checks, captures, threats.
2. If the move broke a principle (early queen, weakening pawn move, undefended piece), look for development with tempo or a safe capture.
3. Otherwise, place your pieces on this chapter's squares: centre pawns first, knights, bishops, castle, then Re1.
4. Play the prophylactic moves at the right time: h3 against ...Bg4/...Ng4; c3 so the bishop has a retreat.
5. Choose the plan that fits the centre: closed → manoeuvre (Nbd2-f1-g3, a4); open → rooks to open files, d3-d4 or attack.
6. Before any early attack (Ng5, Nxf7, g4), check the opponent's most natural defence.
:::

@exercises
