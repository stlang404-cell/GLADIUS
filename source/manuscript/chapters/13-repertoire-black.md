---
chapter: 13
slug: repertoire-black
title: Your Repertoire as Black
subtitle: 1...e5 against 1.e4, the Queen's Gambit Declined against 1.d4, and one set-up for everything else
part: 2
stage: "600–800"
skills: [repertoire-black, opening-principles, opening-traps, planning]
objectives:
  - Answer 1.e4 with 1...e5 and 2...Nc6, and know your reply to every common White third move.
  - Build the Queen's Gambit Declined set-up against 1.d4 and know its two freeing ideas, ...c5 and ...e5.
  - Use one universal set-up (...Nf6, ...d5, ...e6, ...Be7, ...O-O) against the London, 1.c4, 1.Nf3 and other systems.
  - Defend against the early attacks club players love (Scholar's Mate attempts, Ng5 raids, the King's Gambit) without panic.
  - Punish the typical White opening errors in these lines.
next_game: In every game as Black this week, play the set-up from this chapter and, before each of your first ten moves, check whether White's last move created a threat against f7 (after 1.e4) or a pin on your f6 knight (after 1.d4).
---

Playing Black feels different. White moves first, chooses the battlefield, and at club level often comes straight at your king: a queen on h5, a bishop on c4, a knight jumping to g5. Many games as Black are lost in the first ten moves, not because the defender lacked knowledge, but because they had no clear picture of where their pieces belong.

This chapter gives you that picture. Against 1.e4 you play **1...e5** and **2...Nc6**, the most classical defence there is. Against 1.d4 you play **1...d5** with a **Queen's Gambit Declined** set-up. Against everything else you use one simple scheme. As in [Chapter 12](#ch-12), the aim is to understand plans and the few critical moves, not to memorize long lines.

## How to defend an opening as Black

Your job as Black in the opening is slightly different from White's. White wants an advantage; you want **equality with a safe king and a plan**. If you reach move fifteen with all your pieces developed, your king castled and no pawns lost, you have done your job, whatever the engine says.

:::key The Black opening routine
1. Before every move, ask: *what does White's last move threaten?* (Especially f7 after 1.e4 and the f6 knight after 1.d4.)
2. Develop knights before bishops, and get castled.
3. Fight for the centre with a pawn (...e5 or ...d5), and later challenge White's centre with a second pawn (...d5, ...c5 or ...e5).
:::

Every line in this chapter is checked by an engine. Mistakes made by White on purpose, so that you see how to punish them, are marked with `?` or `??`.

## Against 1.e4: 1...e5 2.Nf3 Nc6

After 1.e4 e5 2.Nf3, the knight attacks your e5 pawn. 2...Nc6 defends it with a developing move and controls d4. Now White has four main third moves: 3.Bc4 (Italian), 3.Bb5 (Ruy Lopez), 3.d4 (Scotch), and the quieter 3.Nc3 or 3.c3.

### 3.Bc4: the Giuoco Piano with 3...Bc5

Put your bishop on the same kind of square as White's: 3...Bc5 aims at f2, just as White's bishop aims at f7. Now White has two main plans: the sharp central push with 4.c3 and 5.d4, or the slow 4.c3 and 5.d3.

#### The sharp line: 4.c3 Nf6 5.d4

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d4 exd4 6.cxd4 Bb4+ 7.Bd2 Bxd2+ 8.Nbxd2 d5 9.exd5 Nxd5 10.O-O O-O 11.Rc1
check: engine
diagram: end
caption: The critical main line. Black has challenged the centre with ...d5, White has an isolated d-pawn, and Black's knight sits on the strong blockading square d5.
squares: d5 d4
```

The main ideas:

* **5...exd4** takes White's centre pawn. Do not leave your bishop and pawn hanging in front of d4.
* **6...Bb4+** is the key move. After 6.cxd4 your bishop is attacked; instead of retreating to b6 you give check, gain time, and prepare to trade off a pair of pieces.
* **8...d5!** strikes at the e4 pawn immediately. This is the move that makes Black's position work: White's big centre is destroyed before it can advance.

If White blocks the check with 7.Nc3 instead of 7.Bd2, take the e4 pawn: 7...Nxe4. The play becomes sharp, but the engine confirms that Black is fine if you know the next few moves:

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d4 exd4 6.cxd4 Bb4+ 7.Nc3 Nxe4 8.O-O Bxc3 9.d5 Bf6 10.Re1 Ne7 11.Rxe4 d6
check: engine
caption: White has sacrificed a pawn for activity. Black castles next, plays ...Bf5 or ...Ng6, and stays solid.
```

If this feels too sharp, coaching judgment: you may simply play 7...d5 instead of 7...Nxe4. It is less ambitious but follows the same idea of hitting e4 at once.

White sometimes plays 6.e5 instead of 6.cxd4, attacking your knight. Counterattack in the centre: 6...d5! 7.Bb5 Ne4, and your knight is active on e4.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d4 exd4 6.e5 d5 7.Bb5 Ne4 8.cxd4 Bb6
check: engine
caption: Black's knight is strong on e4 and the bishop has retreated to safety on b6. Next comes ...O-O and ...Bg4 or ...f6.
```

#### The slow line: 4.c3 Nf6 5.d3

Many club players prefer the quiet 5.d3 (the Giuoco Pianissimo, White's choice in [Chapter 12](#ch-12)). Mirror White's development: ...d6, ...O-O, ...a6, ...Ba7, ...h6, ...Re8 and ...Be6.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.c3 Nf6 5.d3 d6 6.O-O O-O 7.Re1 a6 8.Bb3 Ba7 9.h3 h6 10.Nbd2 Re8 11.Nf1 Be6
check: engine
diagram: end
caption: A model Black set-up. The bishop on a7 is safe from b4/a4 tricks, ...h6 stops Bg5, and ...Be6 challenges White's strongest bishop.
squares: a7 e6
arrows: e6b3
```

Three moves do real work here:

* **...a6 and ...Ba7.** The bishop on c5 is your best piece, and White would like to chase it with b4 and a4-a5. With the bishop on a7 it can never be trapped. Watch out: after 6.b4 Bb6 7.a4, you must play 7...a6 or 7...a5. Castling automatically with 7...O-O? loses the bishop to 8.a5.
* **...h6.** It stops Bg5, which would pin your knight on f6.
* **...Be6.** It offers to trade bishops. White's light-squared bishop on c4 or b3 is White's best attacking piece; exchanging it reduces the pressure on f7.

Your middlegame plan: if White plays slowly, you can strike with ...d5 (when it is well prepared) or regroup with ...Ne7-g6.

### Traps and adventures against your Italian

**The early Ng5.** With your bishop on c5 and no knight on f6, 4.Ng5?? simply hangs the knight: 4...Qxg5. White's c1 bishop is blocked by the d2 pawn and cannot protect g5.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.Ng5?? Qxg5
check: engine
diagram: end
caption: The queen wins the knight. Always check whether an attacking piece is defended before you defend against it.
orientation: black
squares: g5
```

If your knight is already on f6 (say after 4.d3 Nf6 5.Ng5), f7 really is attacked twice. Castle: 5...O-O, and if 6.O-O, then ...h6 sends the knight home. Your king now protects f7 together with the rook.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.d3 Nf6 5.Ng5 O-O 6.O-O h6 7.Nf3 d6
check: engine
caption: White's knight raid achieved nothing. Black has castled and gained a useful ...h6 for free.
```

**The fork trick 4.Nxe5?.** Sometimes White tries 4.Nxe5? Nxe5 5.d4, hoping to fork bishop and knight. Answer with check: 5...Bb4+! 6.c3 Nxc4, and you keep the extra piece.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.Nxe5? Nxe5 5.d4 Bb4+ 6.c3 Nxc4
check: engine
caption: The check saves the bishop and the knight escapes by taking the bishop on c4. Black is a piece up.
```

### The Evans Gambit: 4.b4

White sacrifices a pawn to gain time for c3 and d4. Take it and put the bishop on a5. From there it is hard to attack, and once White's d-pawn has moved it pins the c3 pawn to the white king:

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bc4 Bc5 4.b4 Bxb4 5.c3 Ba5 6.d4 d6 7.Qb3 Qd7 8.dxe5 Bb6 9.Nbd2 Na5
check: engine
caption: White has regained the pawn on e5, but Black has defended f7 safely, and the knight on a5 hits White's light-squared bishop and queen. Black has a comfortable game.
```

The two key defensive moves to know are **...d6** (supporting e5 and opening the c8 bishop) and **...Qd7** or **...Qe7** against the queen attack on f7. If you do not want to learn a gambit, 4...Bb6 (declining the pawn) is also perfectly playable.

## 3.Bb5: the Ruy Lopez

The Ruy Lopez (or **Spanish**) is White's most respected weapon. Its idea is long-term pressure on your knight on c6, which defends e5. You play the classical main line, but you only need the ideas.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.O-O Be7 6.Re1 b5 7.Bb3 d6 8.c3 O-O 9.h3 Na5 10.Bc2 c5 11.d4 Qc7
check: engine
diagram: end
caption: The Closed Ruy Lopez. Black has gained queenside space with ...b5 and ...c5, holds the e5 pawn with ...d6 and ...Qc7, and has castled safely.
orientation: black
arrows: a5c4 c5d4
```

Learn what each Black move does:

* **3...a6** asks the bishop a question at once.
* **4...Nf6** develops and attacks e4.
* **5...Be7** prepares castling and keeps things simple.
* **6...b5 and 7...d6** drive the bishop away and secure the e5 pawn. Now the bishop on b3 is no longer pinning anything.
* **...Na5 and ...c5** chase White's best bishop and gain space on the queenside. Another plan is ...Bb7, ...Re8 and ...Bf8, putting pressure on e4.

### Is e5 hanging? The Exchange Variation

After 3...a6 White may take the knight: 4.Bxc6 dxc6. Now nothing defends e5, so it looks as if 5.Nxe5 wins a pawn. It does not: 5...Qd4! attacks the knight and the e4 pawn at the same time, and Black regains the pawn.

```board
fen: r1bqkbnr/1pp2ppp/p1p5/4N3/4P3/8/PPPP1PPP/RNBQK2R b KQkq - 0 5
caption: Black to move. White has just taken on e5. The queen move ...Qd4 forks the knight and the e4 pawn.
orientation: black
arrows: d8d4
squares: e5 e4
```

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Bxc6 dxc6 5.Nxe5? Qd4 6.Nf3 Qxe4+ 7.Qe2 Qxe2+ 8.Kxe2
check: engine
caption: Material is level again, and Black has the bishop pair and an easy game. The pawn on e5 was never really hanging.
```

The best try for White is 5.O-O, which really does threaten d4 and Nxe5. Then defend the pawn with 5...f6 and develop. If the queens come off early, as in 6.d4 exd4 7.Nxd4 c5 8.Nb3 Qxd1 9.Rxd1 Bg4, your bishop pair makes the endgame comfortable.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Bxc6 dxc6 5.O-O f6 6.d4 exd4 7.Nxd4 c5 8.Nb3 Qxd1 9.Rxd1 Bg4 10.f3 Be6
check: engine
caption: The endgame after the Exchange Variation. Black's two bishops compensate for the doubled c-pawns.
```

### Quiet Ruy Lopez lines

Many club players avoid the main line with 5.d3 or 6.d3. Your set-up stays the same: ...b5, ...Be7, ...d6, ...O-O. If White plays a4 against your b5 pawn, the simplest answer is ...b4 or ...Bd7.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6 5.d3 b5 6.Bb3 Be7 7.O-O d6 8.c3 O-O
check: engine
caption: Against the slow 5.d3, the same set-up. Black's next moves are ...Na5, ...c5 or ...Bb7 and ...Re8.
```

## 3.d4: the Scotch

White opens the centre at once. Take the pawn and develop with an attack on e4: 3...exd4 4.Nxd4 Nf6. Now your knight on f6 hits e4, and White must decide how to protect it.

The main line is 5.Nxc6 bxc6 6.e5, chasing the knight. The key moves are **6...Qe7!** (pinning the e5 pawn against the white king, so it cannot be defended easily) and **7...Nd5**:

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 Nf6 5.Nxc6 bxc6 6.e5 Qe7 7.Qe2 Nd5 8.c4 Nb6 9.Nd2 Qe6 10.b3 a5
check: engine
caption: Black's queen blockades in front of the e5 pawn and the a-pawn begins to annoy White's queenside. Both sides have chances.
```

If you prefer something calmer, White's other moves let you develop simply:

* **5.Nc3** (the Scotch Four Knights): 5...Bb4 6.Nxc6 bxc6 7.Bd3 d5. Then castle and put a rook on e8.
* **5.Nxc6 bxc6 6.Bd3**: 6...d5, and your centre is excellent.

```line
fen: startpos
moves: 1.e4 e5 2.Nf3 Nc6 3.d4 exd4 4.Nxd4 Nf6 5.Nc3 Bb4 6.Nxc6 bxc6 7.Bd3 d5 8.exd5 cxd5 9.O-O O-O 10.Bg5 c6
check: engine
caption: The Scotch Four Knights. Black has a solid centre and active bishops; the c6 pawn holds d5.
```

If White plays a gambit with 4.c3 or 4.Bc4, the same rule applies: develop with an attack on e4 (4...Nf6) and strike back with ...d5 or ...d6 when White pushes e5.

## Early queen attacks and Scholar's Mate attempts

At 400–800 you will often meet 2.Qh5 or 2.Bc4 and 3.Qh5, aiming at **Scholar's Mate** (Qxf7#). The defence is simple if you *look at f7 before every move*.

```line
fen: startpos
moves: 1.e4 e5 2.Qh5 Nc6 3.Bc4 g6 4.Qf3 Nf6
check: engine
diagram: end
caption: Black has blocked the queen with ...g6 and, when it returned to f3, covered f7 with ...Nf6 at the right moment. The knight move develops and defends.
orientation: black
arrows: f6e4
squares: f7
```

The two key moments:

1. **After 3.Bc4**, f7 is attacked twice. Do *not* play 3...Nf6??, which allows 4.Qxf7#. Block with 3...g6 (or defend with 3...Qe7).
2. **After 4.Qf3**, f7 is attacked twice again. Now 4...Nf6 blocks the queen's path.

Sometimes White then tries 5.Qb3?, attacking f7 a third time from a different angle. Here the engine shows a strong answer: 5...Nd4!, which attacks the queen and the c2 pawn. (The solid 5...Qe7 also defends, but it gives White time to recover.)

```line
fen: startpos
moves: 1.e4 e5 2.Qh5 Nc6 3.Bc4 g6 4.Qf3 Nf6 5.Qb3? Nd4 6.Qc3 Nxe4
check: engine
caption: The knight on d4 hit the queen and c2; now the other knight takes e4 and attacks the queen yet again. White's queen has made five moves and Black has won a pawn with a huge lead in development.
```

:::mistake Chasing the queen with pawns
After a premature Qh5, many players try to "punish" the queen by chasing it around with pawn moves. Usually a calm developing move that defends f7 (...g6 or ...Nf6 at the right moment, ...Qe7) is better. Develop *with* tempo against the queen (...Nf6, ...Nd4) when you can, and never with a weakening pawn move when a piece move is available.
:::

If White plays the queen raid with 2.Bc4 first, the same ideas apply: 2...Nc6 3.Qh5 g6 4.Qf3 Nf6.

## White's other second moves

### 2.Bc4 (the Bishop's Opening)

Play 2...Nf6, attacking e4. After 3.d3 you can play 3...Bc5 and the game resembles a Giuoco Pianissimo; after 3.Nf3 Nc6 it is a real Italian or Two Knights.

```line
fen: startpos
moves: 1.e4 e5 2.Bc4 Nf6 3.d3 Bc5 4.Nf3 d6 5.c3 O-O 6.O-O
check: engine
caption: A familiar position: the same set-up as the Pianissimo.
```

### 2.Nc3 (the Vienna)

Play 2...Nf6. Against 3.Bc4 develop with 3...Nc6, and against the sharper 3.f4 strike in the centre with 3...d5!:

```line
fen: startpos
moves: 1.e4 e5 2.Nc3 Nf6 3.f4 d5 4.fxe5 Nxe4 5.Nf3 Be7 6.d4 O-O 7.Bd3 f5
check: engine
caption: Against the Vienna Gambit, ...d5 and ...Nxe4 give Black an active knight; ...f5 supports it.
```

After 3.Nf3 Nc6 you reach the Four Knights Game, and the Scotch ideas apply: after 4.d4 exd4 5.Nxd4 Bb4, develop and strike with ...d5.

### 2.d4 (the Center Game)

Take the pawn. After 2...exd4 3.Qxd4, White's queen is in the centre early. Develop with tempo: 3...Nc6 4.Qe3 Nf6, then ...Bb4, ...O-O and ...Re8 against the e4 pawn.

```line
fen: startpos
moves: 1.e4 e5 2.d4 exd4 3.Qxd4 Nc6 4.Qe3 Nf6 5.Nc3 Bb4 6.Bd2 O-O 7.O-O-O Re8
check: engine
caption: Every Black move develops a piece. The rook on e8 and knight on f6 both attack e4.
```

If White gambits with 3.c3 (the Danish), the simplest answer is 3...d5, giving back the pawn to free your game: 4.exd5 Qxd5 5.cxd4 Nc6, or 4...Nf6.

### 2.f4 (the King's Gambit)

The King's Gambit is aggressive and full of traps. The simplest reply is the counterattack **2...d5**, striking at e4 before White can use the f-file. After 3.exd5 exf4 4.Nf3 Nf6, develop quickly and take back on d5.

```line
fen: startpos
moves: 1.e4 e5 2.f4 d5 3.exd5 exf4 4.Nf3 Nf6 5.Bc4 Nxd5 6.O-O Be7 7.Bxd5 Qxd5 8.Nc3 Qd8 9.d4 O-O 10.Bxf4
check: engine
caption: Material is level and both kings are safe. Black has no weaknesses; White's extra activity is small.
```

Watch for the beginner's error 3.fxe5??: then 3...Qh4+ 4.g3 Qxe4+ forks the king and the rook on h1.

```line
fen: startpos
moves: 1.e4 e5 2.f4 d5 3.fxe5?? Qh4+ 4.g3 Qxe4+ 5.Qe2 Qxh1
check: engine
caption: The check on h4 exploits the weakened e1-h4 diagonal. Black wins a whole rook.
```

## Against 1.d4: the Queen's Gambit Declined

After 1.d4 d5 2.c4, White offers a pawn to pull your d5 pawn away from the centre. Decline with **2...e6**: you keep a pawn on d5 and open a diagonal for your f8 bishop. This is one of the most solid openings in chess.

### The set-up

```line
fen: startpos
moves: 1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 Nbd7 7.Rc1 c6 8.Bd3 dxc4 9.Bxc4 Nd5 10.Bxe7 Qxe7 11.O-O Nxc3 12.Rxc3 e5
check: engine
diagram: end
caption: The classical freeing manoeuvre. Black traded pieces with ...Nd5 and then broke out with ...e5. The c8 bishop is free at last.
orientation: black
arrows: c8g4 e5d4
```

Learn the pieces' squares: **...e6, ...Nf6, ...Be7, ...O-O, ...Nbd7, ...c6**. The pin with Bg5 is not dangerous once your bishop is on e7. The only real problem of the QGD is your **light-squared bishop on c8**, which is blocked by the e6 pawn. Every Black plan aims to free it.

The two freeing ideas:

1. **...dxc4 and ...e5** (as above): trade on c4 when White's bishop has moved, exchange a pair of minor pieces with ...Nd5, then push ...e5. The bishop on c8 is free.
2. **...dxc4 and ...c5**: attack White's d4 pawn directly with the c-pawn.

```line
fen: startpos
moves: 1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Be7 5.e3 O-O 6.Nf3 h6 7.Bh4 Nbd7 8.Bd3 dxc4 9.Bxc4 c5 10.O-O a6
check: engine
caption: The ...c5 plan. Next comes ...b5 and ...Bb7, and the c8 bishop finds a long diagonal.
```

The move **...h6** is useful: it asks White's bishop whether it wants to take on f6 (giving you the bishop pair) or retreat to h4.

### The Elephant Trap pattern

The QGD has one famous trap that you can set and must understand. With White's bishop on g5 pinning your knight on f6, the pin is *not* absolute: your queen is on d8, not your king. If White tries to win the d5 pawn by taking with the knight, you can break the pin:

```line
fen: startpos
moves: 1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.Bg5 Nbd7 5.cxd5 exd5 6.Nxd5?? Nxd5 7.Bxd8 Bb4+ 8.Qd2 Bxd2+ 9.Kxd2 Kxd8
check: engine
diagram: end
caption: The queens have been traded and Black has won a knight for a pawn. The trap has netted a whole piece.
orientation: black
squares: d8
```

After 6.Nxd5?? Nxd5!, if White takes the queen with 7.Bxd8, Black plays 7...Bb4+ and wins White's queen back. When the dust settles, Black is a knight for a pawn ahead. (If White does not take the queen, Black is simply a piece up.) This is called the **Elephant Trap**. It works only because White's queen is on d1 and can be forced to block the check on d2. If White's queen has already left d1, check before you rely on it.

### The Exchange Variation: the Carlsbad structure

If White takes on d5 early with cxd5 exd5, you get the **Carlsbad structure**: your pawns on d5 and c6 (or still c7) with no black e-pawn, against White's pawns on d4 and e3 with no white c-pawn. This structure appears so often that it is worth knowing its main ideas.

```line
fen: startpos
moves: 1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.cxd5 exd5 5.Bg5 Be7 6.e3 O-O 7.Bd3 Nbd7 8.Qc2 Re8 9.Nf3 c6 10.O-O Nf8
check: engine
diagram: end
caption: The Carlsbad structure. Black's bishop on c8 is free now, the knight goes ...Nf8-e6 or -g6, and the rook on e8 controls the half-open e-file.
orientation: black
arrows: f8e6 c8g4
```

Your plans in the Carlsbad:

* **Develop the c8 bishop** to g4 or f5 (the diagonal is open now). Trading it for White's knight on f3 or bishop on d3 is often good.
* **Use the e-file**: rook to e8, knight to e4 when it can be supported (...Ne4 often follows ...Nf8-e6-g5 or ...Nd7).
* **Watch for White's minority attack** (b4-b5 to create a weakness on c6). Answer it with ...a6 or ...a5 to slow it down, and by keeping pieces active on the kingside.

### Other White systems in the Queen's Gambit

* **4.Nf3 Be7 5.Bf4**: same set-up, with ...c5 as the main freeing break.
* **3.Nf3 and g3 (Catalan)**: you can take on c4 with ...dxc4 and keep the pawn with ...a6 and ...b5 when it is safe, or simply play ...Be7, ...O-O and ...c6.
* **4.e3**: the quietest move. Play ...Be7, ...O-O, ...dxc4 and ...c5.

```line
fen: startpos
moves: 1.d4 d5 2.c4 e6 3.Nc3 Nf6 4.e3 Be7 5.Nf3 O-O 6.Bd3 dxc4 7.Bxc4 c5 8.O-O a6
check: engine
caption: Against the quiet 4.e3, ...dxc4 and ...c5 free the game immediately. Next comes ...b5 and ...Bb7.
```

## Against the London: 2.Bf4

The **London System** (1.d4 d5 2.Bf4 or 2.Nf3 and 3.Bf4) is one of the most common openings at club level. White builds a solid pyramid with e3, c3 and Nbd2 and often attacks with Ne5, Bd3 and Qf3 or Qh5. Your antidote: hit the centre with **...c5** and challenge the bishop with **...Bd6**.

```line
fen: startpos
moves: 1.d4 d5 2.Bf4 Nf6 3.e3 e6 4.Nf3 c5 5.c3 Nc6 6.Nbd2 Bd6 7.Bg3 O-O 8.Bd3 b6 9.e4 Be7
check: engine
diagram: end
caption: Black's set-up against the London: ...e6, ...c5, ...Nc6, ...Bd6 to challenge White's bishop, and ...b6/...Bb7 to develop the last minor piece.
orientation: black
arrows: d6g3 c5d4
```

The ideas:

* **...c5** puts pressure on d4 and starts queenside play.
* **...Bd6** offers to trade White's best bishop. If White takes, 7.Bxd6 Qxd6, your queen is well placed and the e5 break follows.
* **...Qb6** at the right moment attacks b2, which White's bishop has left behind. After 5.c3 Qb6 6.Qb3 c4 7.Qc2, you gain queenside space.

```line
fen: startpos
moves: 1.d4 d5 2.Bf4 Nf6 3.e3 e6 4.Nf3 c5 5.c3 Nc6 6.Nbd2 Bd6 7.Bxd6 Qxd6 8.Bd3 e5 9.dxe5 Nxe5 10.Nxe5 Qxe5
check: engine
caption: After the bishop trade, ...e5 frees Black's game completely. Black has a fine, active position.
```

:::coach The Ne5 attack
London players love to put a knight on e5 and attack with Qf3, Qh3 or g4. Coaching judgment: answer an unsupported knight on e5 with ...Nd7 to challenge it, and do not castle into an attack you have not counted. In the line 7.Bg3 O-O 8.Bd3 Qe7 9.Ne5 Nd7, Black challenges the knight at once and is fine.
:::

## Against everything else: one universal set-up

Against 1.c4, 1.Nf3, 1.g3, 1.b3, the Colle (d4, Nf3, e3, Bd3) and most other quiet openings, you do not need separate preparation. Build the same set-up you use in the QGD: **...Nf6, ...d5, ...e6, ...Be7, ...O-O**, followed by **...c5** and **...Nc6**.

```board
fen: rnbq1rk1/ppp1bppp/4pn2/3p4/8/3P1NP1/PPP1PPBP/RNBQ1RK1 w - - 1 6
caption: The universal set-up against 1.Nf3 and 1.g3. Black has a pawn in the centre, a safe king and two natural plans: ...c5 and ...Nc6, or ...b6 and ...Bb7.
orientation: black
arrows: c7c5 b8c6
```

Examples:

* **Against the Colle**: 1.d4 d5 2.Nf3 Nf6 3.e3 e6 4.Bd3 c5 5.c3 Nc6 6.Nbd2 Bd6 7.O-O O-O. White plans e3-e4; if 8.dxc5 Bxc5 9.e4, answer with ...Qc7 to keep an eye on e5 and e4.
* **Against 1.c4**: 1...Nf6 2.Nc3 e6 and ...d5 next. If White plays 3.e4, push past the knight with 3...d5 4.e5 d4!.
* **Against 1.b3 or 1.f4**: ...d5, ...Nf6, ...e6 (or ...g6 and ...Bg7 against 1.f4) and castle.

```line
fen: startpos
moves: 1.d4 d5 2.Nf3 Nf6 3.e3 e6 4.Bd3 c5 5.c3 Nc6 6.Nbd2 Bd6 7.O-O O-O 8.e4 cxd4 9.cxd4 dxe4 10.Nxe4 Be7
check: engine
caption: Against the Colle, White achieved e4, but Black traded the centre pawns and White's d4 pawn is now isolated.
```

```line
fen: startpos
moves: 1.c4 Nf6 2.Nc3 e6 3.e4 d5 4.e5 d4 5.exf6 dxc3 6.bxc3 Qxf6 7.d4 c5
check: engine
caption: Against 1.c4 and 3.e4, the counterattack ...d5 and ...d4 leads to an equal, open game with active pieces for Black.
```

## A worked example: after 6.cxd4 in the Giuoco Piano

Here is the full thinking process in the critical position of your 1.e4 e5 repertoire.

```board
fen: r1bqk2r/pppp1ppp/2n2n2/2b5/2BPP3/5N2/PP3PPP/RNBQK2R b KQkq - 0 6
caption: Black to move. White has built the big centre with c3 and d4. Your bishop on c5 is attacked by the d4 pawn.
orientation: black
red: d4c5
squares: c5
```

**Step 1 — What does White threaten?** The d4 pawn attacks my bishop on c5. Also, if White gets in d5 or e5, the pawns will push my knights back. So I must move the bishop *and* do something against the centre.

**Step 2 — Checks, captures, threats for me.** Checks: ...Bb4+. Captures: ...Nxe4 takes a pawn but leaves the bishop on c5 hanging (dxc5). ...Bxd4 gives the bishop for a pawn. Threats: ...d5 attacks e4, but it also leaves the bishop on c5 en prise.

**Step 3 — Candidates.** 6...Bb4+, 6...Bb6, 6...d5?!.

* 6...Bb6 is safe, but passive: after 7.d5 or 7.e5 White's centre rolls forward with tempo.
* 6...d5?! looks active, but after 7.exd5 Nxd5 the bishop is still attacked and White keeps the initiative; the engine rates it about a pawn worse than the check.
* 6...Bb4+ forces White to spend a move dealing with the check. If 7.Bd2 Bxd2+ 8.Nbxd2, I have traded one pair of pieces and can play 8...d5, smashing the centre.

**Step 4 — Decide.** 6...Bb4+, with ...d5 as the follow-up. Notice the general lesson: when White's centre is about to roll forward, use a **check** to gain the time you need for your own central pawn break.

## When plans should change

Your default Black plans are: equalize in the centre, castle, then challenge with a second pawn break. Change them when:

* **White's king is still in the centre and lines are open.** Sometimes development is enough to start an attack. Look for ...Re8+ or ...Bb4+ ideas.
* **White's queen has wandered.** Every queen move in the opening is a chance to develop with tempo (...Nc6, ...Nf6, ...Nd4, ...Nb4).
* **White castles queenside.** Then your queenside pawns (...a5, ...b5, ...c5) become attackers, as long as your own king is safe.
* **The pawn break isn't available.** In the QGD, if ...c5 or ...e5 would lose a pawn, prepare it with one more move (...Re8, ...Qc7, ...dxc4) rather than forcing it.
* **White's pieces abandon the queenside.** In the London and Colle, ...Qb6 against b2 is often stronger than any kingside plan.

## Practice at the board

1. **Play out the key positions.** Use a physical board or any free app that lets you play the computer from a position. Play each position at least three times as Black:
   * Giuoco Piano after 8...d5: `r1bqk2r/ppp2ppp/2n2n2/3p4/2BP4/5N2/PP1N1PPP/R2QK2R w KQkq - 0 9` (you are Black; White moves first).
   * Closed Ruy Lopez after 8...O-O: `r1bq1rk1/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1 w - - 1 9`
   * QGD after 6.Nf3: `rnbq1rk1/ppp1bppp/4pn2/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R b KQ - 1 6`
   * London after 5.c3: `rnbqkb1r/pp3ppp/4pn2/2pp4/3P1B2/2P1PN2/PP3PPP/RN1QKB1R b KQkq - 0 5`
2. **The f7 drill.** Set up the starting position and have a friend (or the computer at a low level) play 1.e4 e5 2.Qh5 and 2.Bc4 lines. Before each of your moves, say aloud how many times f7 is attacked and how many times it is defended.
3. **The trap rehearsal.** Set up the Elephant Trap position after 6.Nxd5?? (`r1bqkb1r/pppn1ppp/5n2/3N2B1/3P4/8/PP2PPPP/R2QKBNR b KQkq - 0 6`) and the Exchange Ruy position after 5.Nxe5? (`r1bqkbnr/1pp2ppp/p1p5/4N3/4P3/8/PPPP1PPP/RNBQK2R b KQkq - 0 5`). Play the winning or equalizing moves from memory until you can do it without hesitation.
4. **Check yourself after each game.** Find the move where you left this chapter. If you lost because you did not know a line, add it to your notebook with the correct move.

:::drill The set-up race
On an empty board, set up Black's pieces in the QGD and the universal set-up (...Nf6, ...d5, ...e6, ...Be7, ...O-O, ...Nbd7 or ...Nc6, ...c5 or ...c6) as fast as you can, saying each move's purpose. Then do the same for the Italian (...e5, ...Nc6, ...Bc5, ...Nf6, ...d6, ...O-O, ...a6, ...Ba7, ...h6).
:::

## Chapter summary

* Against 1.e4, play 1...e5 2...Nc6, and answer 3.Bc4 with 3...Bc5, 3.Bb5 with 3...a6 and the Closed Ruy set-up, and 3.d4 with 3...exd4 4.Nxd4 Nf6.
* In the Giuoco Piano, meet 5.d4 with ...exd4, ...Bb4+ and ...d5; meet 5.d3 with ...d6, ...O-O, ...a6, ...Ba7, ...h6 and ...Be6.
* Against the Evans Gambit, take the pawn and retreat the bishop to a5; in the Exchange Ruy, remember that 5.Nxe5? is met by 5...Qd4.
* Against early queen attacks, look at f7 before every move: ...g6, ...Nf6 at the right moment, ...Qe7, and develop with tempo.
* Against 1.d4, play the QGD: ...d5, ...e6, ...Nf6, ...Be7, ...O-O, ...Nbd7, ...c6, then free the c8 bishop with ...dxc4 and ...e5 or ...c5. Know the Elephant Trap.
* Against the London, use ...c5, ...Nc6, ...Bd6 and ...Qb6 ideas; against everything else, use the universal set-up.
* Change plans when White's queen wanders, when White's king stays in the centre, or when the usual pawn break is not yet possible.

:::cheat Opening checklist as Black
1. What did White's last move threaten? Look at f7 (after 1.e4) and pins on your f6 knight (after 1.d4).
2. Can you develop with tempo against an exposed white piece? Do it.
3. Otherwise, put your pieces on their set-up squares: knights, the bishop that is free, castle.
4. Prepare your second pawn break: ...d5 against 1.e4 structures; ...c5 or ...e5 in the QGD and against the London.
5. Before every pawn break, check that it does not hang a piece or a pawn, and that your king is safe.
:::

@exercises
