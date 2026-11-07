# GLADIUS engine (v0.2)

Everything here was measured in this repository's sandbox unless marked otherwise:
Linux, 4 vCPU (x86-64, see `tests/bench/results/*.json` → `meta`), 16 GB RAM, Node 22,
Stockfish 19 from npm `stockfish@19.0.1` (nmrugg/stockfish.js, sha256 of the shipped
`.wasm` files in "Builds"). Browser numbers are **not** measured here (no real devices);
WASM in a browser Worker runs at roughly the same speed as WASM in Node, but phones are
2–5× slower than this machine. Raw results: `tests/bench/results/`.

## 1. Builds compared

| Build | Files (js + wasm) | Net | Threads | Needs COOP/COEP | Startup to `readyok` | Speed, 1 thread | Depth in 2 s (4 positions) | Peak RSS (Node, Hash 64) |
|---|---|---|---|---|---|---|---|---|
| lite-single (shipped, precached) | 28 KB + 1.8 MB | small | 1 | no | 0.15–0.22 s | ≈ 550–590 knps | 21–23 / 18–23 / 18–19 / 21–22 | 139 MB (Hash 16) / 184 MB (Hash 64) |
| lite (threaded) | 33 KB + 1.7 MB | small | ≤ 4 | yes | 0.6–1.0 s | 561 knps (T1); 1179 (T2); 1754 (T4) | T2: 21–22 | 209 / 263 / 328 MB (T1/T2/T4) |
| full-single | 28 KB + 99.2 MB | big | 1 | no | 0.8–1.4 s | ≈ 280–310 knps | 19–22 | 490 MB |
| full (threaded) | 33 KB + 99.1 MB | big | ≤ 4 | yes | 1.3–1.6 s | 313 knps (T1); 641 (T2); 1144 (T4) | T4: 18–23 | 771 / 781 / 870 MB (T1/T2/T4) |

Notes
* Measured with `node stockfish-19*.js` child processes, 2 s per position, nothing else running
  (scratch script equivalent to `tests/bench/builds.slow.test.ts`, which was written afterwards and
  not re-run). "Speed" is nodes/s over 2 s searches from four positions (opening, middlegame, Kiwipete, rook endgame).
  The big net evaluates ~half as many nodes per second as the lite net — and still wins (section 4).
* The threaded builds run in Node as child processes (`node stockfish-19*.js`, worker_threads).
  Loading them in-process with `require()` does not answer `uci`; the single-threaded glue also
  supports only **one instance per Node process** (a second instance looks for `stockfish.wasm`),
  so `tests/helpers/nodeEngine.ts` gives every additional engine its own process.
* Memory: the big net is ~0.5 GB resident in Node (the network is ~95 MB of weights plus wasm
  heap); in a browser expect a similar footprint per big-net worker. This is why mobile never
  loads it and the desktop elite worker is released after 5 idle minutes.

sha256: lite-single `ee4f115b…`, lite (threaded) `ddf06cda…`, full-single `991bede2…`.

## 2. Tier selection (src/engine/builds.ts → `planEngines`)

`detectDevice()` reads `navigator.hardwareConcurrency`, `navigator.deviceMemory` (Chromium only),
the user agent (iPhone/iPad/iPod, iPadOS-as-Mac via touch points, Android, "Mobile") and
`crossOriginIsolated && SharedArrayBuffer`.

| Device class | play | elite (persona ≥ 2700) | analysis | spectate | concurrent searches | idle workers |
|---|---|---|---|---|---|---|
| mobile (iOS/Android UA, or ≤ 2 cores) | lite-single, Hash 16 | lite-single, Hash 16 | lite-single, depth 11 | lite-single, Hash 8 | 1 | background roles terminated after 45 s idle, opponent after 3 min |
| low-memory desktop (≤ 4 GB) | lite-single | lite-single, Hash 32 | lite-single, depth 11 | lite-single | 1 | after 2 min |
| desktop | lite (threaded if isolated), Hash 64 | **big net once downloaded** (else lite), Hash 128, threads if isolated | big net if downloaded and ≥ 8 GB, else lite; depth 13 (14 with ≥ 8 cores) | lite-single, Hash 16 | 2 (3 with ≥ 8 cores) | big-net worker after 5 min |

* Threads are used only when the page is cross-origin isolated, never more than `cores − 1`, max 4.
* The big net (~99 MB) is **never** downloaded on iOS, on mobile, on data-saver / 2G–3G connections,
  or when the user setting `allowBigNet` is off; it is never needed for first play. The first
  time an opponent ≥ 2700 is met on desktop, `prefetchBigNet()` starts a background download
  (HEAD probe first: if the host does not have the file, the SPA fallback's HTML is detected and
  nothing is downloaded). Until it completes the elite slot plays with the lite net. When it is
  complete the elite (and analysis) engine switches build at its next idle moment.
* Caching: the big net and the threaded builds are excluded from the Workbox precache
  (`globIgnores`) and served by a `CacheFirst` runtime route (`gladius-engine-bignet`), so the
  app's install size stays ≈ 2 MB of engine and the big net works offline after one download.
* Fallback: any optional build that fails to start (404, out of memory, no SharedArrayBuffer,
  handshake timeout of 60 s for the big net) or crashes twice in a row is replaced by the
  always-shipped lite single-threaded build; the failure is remembered for the session.

### Hosting and cross-origin isolation
* Threaded builds need `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`) on the page.
* `vite dev` / `vite preview`: set `GLADIUS_COI=1` (vite.config.ts `server.headers` / `preview.headers`).
* Windows launcher (`windows/launcher.ps1`, HttpListener) can add the two headers per response
  (two lines, see the hand-off notes). It already serves `.wasm` as `application/wasm`.
* GitHub Pages cannot set headers. The known workaround, **coi-serviceworker**, is a service
  worker that re-serves every response with COOP/COEP. GLADIUS already has a Workbox service
  worker on the same scope and a scope can only have one, so coi-serviceworker cannot simply be
  dropped in; the equivalent would be to switch vite-plugin-pwa to `injectManifest` and add the
  headers to navigation responses in our own SW (first visit still not isolated until the SW
  controls the page; Safari supports it from 15.2). Not done in v0.2: the measured gain from
  threads (section 4) is real but smaller than the big net's, and the big net needs no headers.
* Without isolation everything falls back to single-threaded builds automatically.

## 3. Scheduler and robust UCI (src/engine/scheduler.ts, src/engine/uci.ts)

**Scheduler.** Every search acquires a lease from one `EngineScheduler` right before `go` and
releases it at `bestmove`, so the limit is on simultaneous searches (CPU), not on workers.
* At most `maxConcurrent` searches run (1 on mobile).
* Priorities: play/elite 3 > spectate 2 > analysis 1; FIFO within a priority.
* Exclusive play: while the opponent's search is running or waiting, nothing of lower priority
  starts, and running analysis/spectate searches (preemptible) are sent `stop`; their partial
  result is discarded and the same search is re-run afterwards. Net effect: post-game analysis
  and broadcasts pause while the player's opponent thinks, and resume right after.
* An aborted waiting request leaves the queue at once.

**UCI client.** Robustness rules (tests/engine.scheduler.test.ts uses a scriptable fake engine):
* Every wait has a timeout: handshake 20 s (60 s big net), `isready` 10 s, search = its limit
  + 4 s grace → `stop`, + 4 s more → the worker is declared hung.
* Worker `error` / process exit / hang → the worker is torn down, a new one is started from the
  transport factory, options are re-applied and the in-flight search is retried once; a second
  failure switches to the fallback build when one is configured; otherwise the promise rejects
  (never hangs).
* `stop()` is a no-op when idle. An `AbortSignal` rejects the promise immediately with an
  `AbortError`; the stopped search's `bestmove` is consumed before the next queued search runs.
* `terminate()` rejects everything queued. Idle termination (`idleTerminateMs`) kills the worker
  and restarts it lazily on the next search.
* Searches now send `position fen <start> moves …` (when the history matches the FEN), so the
  engine sees repetitions (v0.1 sent only the FEN: it could walk into a threefold when winning).

## 4. Strength measurements

### 4.1 Engine-vs-engine matches
Method: `tests/bench/matches.slow.test.ts`. 40 balanced openings (`tests/bench/lib/openings.ts`,
6–10 plies, checked with the big net: White +0.35 on average, −0.07 … +0.79), each played with both
colours (and in two rounds for the 160-game match). Adjudication: win when the engine's own eval is
≥ 7 pawns for the same side for 6 plies; draw after ply 80 when |eval| ≤ 0.10 for 12 plies; ply 300 =
draw; otherwise chess rules (chess.js). Elo difference from the score, 95 % CI from the trinomial
variance: σ² = [w(1−s)² + d(½−s)² + l·s²]/n, s ± 1.96·σ/√n mapped through −400·log10(1/s − 1).
Up to 4 games in parallel on 4 cores (1 for the threads match). Fixed `movetime`, MultiPV 1 unless noted.

| Match | Budget | Games | W / D / L (A) | Score A | Elo A − B | 95 % CI |
|---|---|---|---|---|---|---|
| **full-single vs lite-single** (net only) | 200 ms/move, Hash 64 both, 1 thread | 160 (40 openings × 2 colours × 2 rounds) | +47 / =106 / −7 | 62.5 % | **+89** | **+59 … +120** |
| **top tier v0.2 vs v0.1** (persona 3200 path: book + single-PV; full-single Hash 128 vs lite-single Hash 16) | 500 ms/move both | 80 (40 × 2) | +15 / =63 / −2 | 58.1 % | **+57** | **+24 … +91** |
| lite threaded T3 vs lite-single | — | not run (time) | | | | |
| persona ladder 2200–2600, 2600–2800, 2800–3000 | — | not run (time) | | | | |

Caveats: the first ~20 games of the 160-game match ran while another engineer's test suite shared the
CPU (both sides at fixed movetime, so equally affected). The v0.2 top tier also differs from v0.1 in
the repetition-aware `position … moves` search; the gain is mostly the net. The threads and ladder
matches are implemented (`mt3-vs-single`, `ladder-*`) but were not run before the v0.2 cut-off, so
**no head-to-head evidence for persona-level ordering or for threads is claimed** (threads: only nps
scaling above).

### 4.2 Tactical suite (62 verified positions)
WAC (Reinfeld's *Win at Chess*, 1–50) and Bratko-Kopec (24) candidates were typed in and each one
re-checked with the big net, 4 threads, Hash 256, MultiPV 2, 10 s. A position was kept only if the
engine's move is one of the published best moves and, for single-answer positions, beats the second
line by ≥ 25 cp. Kept 62; rejected 11 (engine disagrees: WAC.002, WAC.031, BK.03, BK.07, BK.09, BK.17;
ambiguous: WAC.008, BK.11, BK.18, BK.23, BK.24 — see `REJECTED` in `tests/bench/lib/positions.ts`).
Note: the remaining BK positions are mostly positional, so this is a mixed tactical/positional suite.

Fixed time per move; personas use their normal path (`thinkMs` 500 for ≥ 2700), one sample each.

| Config | Solved | Rate |
|---|---|---|
| lite-single 100 ms | 56/62 | 90.3 % |
| full-single 100 ms | 53/62 | 85.5 % |
| lite threaded T3 100 ms | 58/62 | 93.5 % |
| lite-single 500 ms | 59/62 | 95.2 % |
| full-single 500 ms | 60/62 | 96.8 % |
| lite threaded T3 500 ms | 59/62 | 95.2 % |
| persona 1000 | 9/62 | 14.5 % |
| persona 1600 | 32/62 | 51.6 % |
| persona 2200 | 43/62 | 69.4 % |
| persona 2600 | 55/62 | 88.7 % |
| persona 2800 (elite, lite) | 61/62 | 98.4 % |
| persona 3000 (lite) | 59/62 | 95.2 % |
| persona 3000 (full net, Hash 128) | 60/62 | 96.8 % |

Reading: the suite saturates for engine configurations (2–6 failures, mostly the same positions),
so it does **not** separate builds; at 100 ms the slower big net solves fewer (its strength shows in
games, 4.1). It does separate persona levels clearly up to 2600; 2800 vs 3000 differ by 2 positions
(noise; MultiPV 3 can also help find a tactic).

### 4.3 Endgame suite (8 positions, played out)
The tested side plays from the position against the big net at 300 ms/move (no tablebases, no
adjudication, 50-move rule). Success = theoretical result (win converted, or draw held).

Implemented (`tests/bench/endgames.slow.test.ts`, positions verified with the big net, see `ENDGAMES`) but **not run** before the v0.2 cut-off: no conversion numbers are claimed.

### 4.4 Persona ladder (calibration bench)
`tests/bench/calibration.test.ts` — average win% lost per move vs a depth-12 reference on 12
positions.

Default run (4 samples × 12 positions, `npm test`), unchanged from v0.1 (re-checked; the v0.2 sampler is
bit-identical for `universal` style):

| Persona Elo | Target | Measured |
|---|---|---|
| 500 | 13 | 11.4 |
| 900 | 9 | 8.1 |
| 1300 | 6.5 | 5.4 |
| 1700 | 4.5 | 5.2 |
| 2100 | 3.2 | 3.3 |
| 2600 | 2.0 | 1.6 |

Monotone within the test's tolerance, but 1300 ≈ 1700 (5.4 vs 5.2): with 48 samples one 40-point
blunder moves the mean by 0.8, so this table cannot resolve 400-point steps there. A retune of the
1200/1600 knots changed nothing measurable and was reverted. The 12-sample + elite (2800/3000)
run (`BENCH_LADDER_REPS=12 BENCH_LADDER_ELITE=1`) was not run before the cut-off.

### 4.5 Clock safety
Unit-tested: `allocateTime` arithmetic, and a simulated 160-move game at every control the game offers
(5+0, 3+2, 10+0, 15+10, 30+0), each move spending its full budget + 60 ms of latency: the clock never
reaches zero. `humanDelay` is checked to stay within the budget. Real-time persona games on a clock
(60+0 and 30+1, `tests/bench/clock.slow.test.ts`) are implemented but were **not run**.

## 5. Personas (src/engine/persona.ts, src/engine/styles.ts)

| Band | Method |
|---|---|
| < 2700 | Sampler (unchanged from v0.1, calibrated): MultiPV candidates at depth 4–10 by Elo, softmax over win%-loss with an Elo temperature, "oversight" picks (any legal move below 1600), style bonus × (1.2 − Elo/2200, clamped 0.15–1). On a clock the depth search is also capped by time. |
| 2700–2999 | Elite: time-based MultiPV-3 search on the elite slot, temperature 1.2 → 0.25 win% points, blunder guard (never > 3 win% below best), style worth at most ±0.4 win% points (tie-break only). |
| ≥ 3000 | Top tier: single-PV search (MultiPV costs strength), full budget, strongest slot on the device; on a clock Stockfish's own time manager decides (clock minus 2 × 150 ms overhead). |

**Styles.** Eight v0.2 ids: `attacker` (Tactical attacker), `strategist` (Positional strategist),
`defender` (Defensive specialist), `technician` (Endgame technician), `theoretician` (Opening
theoretician), `counterattacker`, `gambiteer` (Dynamic gambiteer), `universal` (Universal master).
The v0.1 ids stay valid `PlayStyle` values (old saves) and map to aggressive→gambiteer,
tactical→attacker, positional→strategist, solid→technician, defensive→defender; `STYLE_LABEL`
covers all 13 ids; new worlds draw from the eight (`PLAY_STYLES`). Heuristics (win% points, before
strength scaling):
* attacker: check +1.5, extra attackers on the enemy king zone +0.6 each (cap 2), piece landing
  within 2 squares of the king +0.6, pawn storm on the king's files +0.5, capture +0.4;
* strategist: mobility gain, centralised minor pieces, knight outposts (no enemy pawn can attack),
  castling, development; early queen moves and pawn moves in front of the own king penalised;
* defender: castling, removing own pieces from attack (threat count before/after), restricting
  the opponent's replies, no loosening pawn moves; trades of attackers when worse;
* technician: when ≥ 62 % win: equal trades +1.2 (simplify when ahead); in endgames active king
  and passed-pawn pushes +0.8; avoids trades when worse;
* theoretician: book depth +8 plies, main lines favoured (popularity^1.6); out of book half a strategist;
* counterattacker: under pressure (in check, own piece en prise, or < 45 % win) moves that create
  threats (undefended or under-defended targets) +0.9 each and checks +0.8;
* gambiteer: book gambit lines ×(1 + 3·gambit share), development, checks, threats, restricting
  replies, central pawn breaks; castling early.

**Preparation hook.** `chooseMove(…, { prep: { avoidLines, preferLines } })` takes opening names
(`"Sicilian Defence"` = whole family, `"Sicilian Defence: Najdorf Variation"` = that line and its
sub-lines). Each book candidate is weighted by the share of book lines it leads into that match:
avoid ×(1 − 0.95·share), prefer ×(1 + 5·share). It changes only which book move is played.

**Fairness guarantee.** Strength is a pure function of persona Elo/style/seed, the position and
history, the clock and the device's engine tier. Nothing reads results, streaks or the player's
rating; no code path raises difficulty after a player win (comment at the top of persona.ts).
The one device dependence is deliberate and visible: on a desktop with the big net, ≥ 2700
opponents are stronger than the same opponents on a phone.

**Clock-aware thinking.** `chooseMove(…, { clock: { myMs, oppMs, incMs, moveNumber } })` →
`allocateTime`: remaining/movesToGo (35 → 30 → 25) + 0.8·increment − 150 ms overhead, capped at
20 % of the clock and a ≥ 1 s (≥ 10 %) reserve; panic below 10 s (5 s with ≥ 2 s increment): ~1/40
of the clock + half the increment, ≤ 1 s, no artificial delay; floor 30 ms. `humanDelay(…, clock)`
never exceeds the move's budget and is 0 in panic. Without `clock` everything behaves as in v0.1.

## 6. What limits strength
* The lite net (used everywhere on phones, and on desktop until the big net is downloaded).
* Single thread unless the host sends COOP/COEP (GitHub Pages cannot).
* Think time: the top tier spends 2 s per move untimed (v0.1: 1.5 s) or what Stockfish's time
  manager allocates on a clock; there is no pondering on the player's time.
* No tablebases in the WASM builds (KBNK is not converted reliably by any configuration we ran).
* Elite band (2700–2999) deliberately gives up some strength (MultiPV 3 + temperature) to stay
  below the top tier.

## 7. What is and is not demonstrated
* Demonstrated (numbers above): big net > lite net at equal time (+89 [+59, +120], 160 games);
  the v0.2 desktop top tier beats the v0.1 top tier (+57 [+24, +91], 80 games); threads scale nps
  ~2×/3× at 2/4 threads; tactical solve rate rises with persona level up to 2600; the move-quality
  ladder is monotone within tolerance; personas return legal moves in random positions in all bands
  and styles; the time allocation cannot flag in simulation.
* Implemented but not run before the cut-off: threads match, persona-ladder matches, endgame suite,
  real-time clock stress, 12-sample ladder.
* **Not** demonstrated: any Elo relative to humans. Persona Elo labels are estimates anchored to
  accuracy-by-rating targets; no game against rated humans was played. Browser performance on
  real phones/desktops, the threaded builds inside a browser Worker, the big-net download/caching
  path through Workbox, and the Windows launcher with COOP/COEP headers were not run here.
* Engine-vs-engine Elo differences are specific to these budgets and this opening set; draws are
  frequent (most games are drawn), so CIs are wide even at 160 games.

## 8. Reproducing
```
npm test                                   # unit tests incl. engine*, ladder (≈4 samples)
npm run bench                              # all slow benches with small defaults
BENCH_MATCH=full-vs-lite BENCH_ROUNDS=2 BENCH_MOVETIME=200 npx vitest run tests/bench/matches.slow.test.ts
BENCH_MATCH=top-new-vs-old BENCH_MOVETIME=500 npx vitest run tests/bench/matches.slow.test.ts
BENCH_MATCH=mt3-vs-single BENCH_MOVETIME=200 npx vitest run tests/bench/matches.slow.test.ts
BENCH_MATCH=ladder-2200-2600,ladder-2600-2800,ladder-2800-3000 BENCH_MOVETIME=300 npx vitest run tests/bench/matches.slow.test.ts
BENCH_LADDER_REPS=12 BENCH_LADDER_ELITE=1 npx vitest run tests/bench/calibration.test.ts
```
Big-net / threaded builds: `npm pack stockfish@19.0.1 && tar xzf stockfish-19.0.1.tgz` and copy
`package/bin/stockfish-19-single.{js,wasm}` (and optionally `stockfish-19-lite.{js,wasm}`) into
`public/engine/`, or point `GLADIUS_SF_DIR` at `package/bin` (needs a `package.json` with
`{"type":"commonjs"}` next to the files).
