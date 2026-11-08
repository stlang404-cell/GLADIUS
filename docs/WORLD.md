# GLADIUS — World, honours & career rules (v0.2, extended by v0.3 "Golden Age" and v0.4 — see the last sections)

Everything below is driven by simulated outcomes (statistical AI games, engine broadcasts, the player's games). Nothing is invented, unlocked at random, or reconstructed by guessing. All randomness uses the seeded RNG (`src/core/rng.ts`); every process is idempotent.

## Save fields added in v0.2 (all optional)
`world.awards` (trophy registry, append-only) · `world.hall` (Hall of Records) · `world.seasonTally` · `world.worldVersion` · `WorldTournament.awarded` · `Competitor.arc` · `ChronicleEntry.tag` · `Invitation.context/reason` · `player.ledger` · `player.rivals` · `player.timeline` · `player.seasonReports`.
Migration: `ensureSaveV2(save)` (`src/game/legacy.ts`) → `ensureWorldV2(world)` (`src/world/trophies.ts`). Both are idempotent; call after loading. Old worlds get awards backfilled from `world.history` (marked `backfilled`, no match scores); the old player timeline is seeded from `rankHistory`, achievement unlock days and tournament wins. Ledger counters start at zero (they cannot be reconstructed).

## Imperial Trophy System (`src/world/trophies.ts`) — 60 definitions
| Category | Ids | Presented to |
|---|---|---|
| Signature (12) | `sig-0…11` (names = `ARENAS[i].trophy`) | winner of the arena championship match (capture or defence) |
| Crown | `imperial-crown` | winner of the arena-11 championship |
| Winner's cups | `cup-open|cup-cup|cup-gauntlet|hosted-t0…3` | Open / Cup / Gauntlet / hosted winners, by arena tier (0–2 Provincial, 3–5 Legionary, 6–8 Senatorial, 9–11 Imperial) |
| Regional honours | `league-t0…3` | season League winner |
| Elite invitational | `invit-t0…3` | Invitational winner |
| Finalist medals | `medal-t0…3` | runner-up where there is a real final: Cup, Gauntlet, championship match |
| Title defence | `defense-t0…3` (with `defenseNumber`) | holder who retains a title |
| Season Laurel | `laurel-t0…3` | top performer of an arena-season by placement points (10/6/4/4/2… × kind weight: championship 1.5, league/invitational 1.25, hosted 0.5); presented when all that season's events in the arena are complete (at the latest two seasons later) |
| Distinctions (once per holder) | `dist-decorated` (10 wins), `dist-laureate` (25), `dist-triple-crown` (sigs in 3 arenas), `dist-polymath` (5 kinds), `dist-iron-champion` (10 defences) | |
| Historical feats | `hist-perfect` (5+ wins, no draw/loss), `hist-underdog` (lowest seed of 8+ wins), `hist-upset-crown` (title taken from a champion rated ≥150 higher), `hist-dynasty` (3rd consecutive defence), `hist-sweep` (3 wins, same arena-season), `hist-comeback` (regained a lost title) | |

`awardId = ${tournamentId}:${defId}:${holder}` (distinctions `life:${defId}:${holder}`, laurels use `S<season>-A<arena>`), so reprocessing never duplicates; `WorldTournament.awarded` is a second guard. Repeat wins are new instances. `current`: edition series (e.g. `open-4`) keep only the latest edition current; title series (`title-N`) stay current while the holder reigns, and all flip to historical when the title changes hands. Records are never deleted. Rarity = explicit tier + `rarityOf()` counts (Unique / Very rare / Rare / Established).

## Competitor prestige
`competitorPrestige = Σ trophy prestige + 20 × titles held + max(0, peak − 1200)/20`. Used (capped at 300) in invitation/seeding standing `rating + 80·form + 0.4·prestige` and challenger fallback `rating + 0.3·prestige`. Never affects playing strength.

## Records (`src/world/records.ts`)
Most championships, longest consecutive-defence run, longest reign (days), most event victories, championships in most arenas, highest peak Elo, greatest rivalries (games between two competitors), best career win % (≥200 games), notable title upsets (≥150 rating gap). Sources: award registry and reigns (never pruned), live competitors, and `hall.legends` — compact snapshots written by `seasonBoundary` *before* pruning retirees (union of the top 40 per metric), plus a max-snapshot of the 40 most-played pairings. A new holder surpassing a tracked record writes one `record-broken` Chronicle entry.

## Chronicle tags
`new-champion`, `comeback`, `elite-upset` (title changes), `tournament-upset` (bottom-half seed ≥150 below the top seed wins; arena ≥3), `prodigy` (under 22 enters arena ≥6, once), `breakthrough` (≥150 rating gain in a season, rating ≥1900, top 2 per season), `fall-from-elite` (demoted out of arena ≥9), `retirement` (peak rank ≥24 or a champion), `rival-promoted` (the player's rival changes arena), `record-broken`. Cap 600 entries. Debuts are no longer announced from hidden potential.

## Achievements (`src/game/achievements.ts`) — 139
Chess mastery 17 · Tactical brilliance 15 · Endgame excellence 10 · Tournament victories 17 · Arena conquests 20 · Rivalries 10 · Championship defences 13 · Career milestones 15 · Rating 12 · Historical legacy 10. Rarity: 24 common, 50 rare, 35 epic, 30 legendary. All 20 v0.1 ids are kept.
- Each is `metric(state) ≥ target` from the ledger, award registry, reigns or career record → idempotent, honest progress.
- **Eligibility**: skill counters only count rated, non-casual games against opponents rated ≥ your rating − 200. Nothing rewards losing.
- **Analysis-gated** (accuracy, brilliant/great moves, flawless, comebacks from ≤25% win chance, endgame wins/saves): only via `onGameAnalysed(save, game)` with a stored `GameAnalysis`, once per game id. "30 moves" = 60 plies.
- **Reward**: Influence + prestige: common 2, rare 5, epic 10, legendary 20.

## Influence additions (player only, `trophyInfluence`)
Signature trophy 10 + arena · Imperial Crown +25 · defence 8 · Season Laurel 8 · distinction 15 · historical feat 20 · cups/medals 0 (paid via tournament prizes).

## Championship privileges
Title holders are auto-entered in their title match, seeded first in every event they enter (`TournamentConfig.topSeeds`), always invited to their arena's Invitational (AI: replaces the last invitee), and host invitationals at 25% off (`hostCostFor`). `championshipPrivileges()` lists titles and standards (trophy banners).

## Rank audit
Rules in `arenas.ts` verified by tests (placement ≤2 grades/game while provisional, 50-pt grade buffer, 100-pt arena buffer, trial or +150 dominance to cross arenas). Fixed: hosting an invitational skipped the season rollover (decay/report) when it crossed a season boundary.

## Rivalry model
`player.rivals[id]`: W/D/L, last 12 games (id, day, result, colour, opening, kind, tournament), tournament encounters, championship battles, per-opening results, last opening used. Significance = games + 2·tournament encounters + 5·championship battles + closeness bonus (+2 if they lead); selectors apply recency decay (half weight after 56 days). The rival is the most significant active rivalry with ≥3 games. Capped at 60 opponents.
`rivalPrep(save, id)`: only opponents who have met you ≥2 times (or arena ≥8, who study your games) prepare; `avoidLines` = openings where you score ≥60%, `preferLines` = ≤40%; 1–3 lines by arena. Opening names only; no strength change.

## Invitations (`refreshInvitations`)
Contexts: `trial`, `open-registration`, `regional-championship` (League), `invitational` / `elite-invitational` (Influence ≥ threshold, top-6 rating in arena, title holder, or prestige ≥ 40·(arena+1)), `seeded` / `wildcard` (Cup/Gauntlet: within top `size` by rating, else recent form ≥3.5/5, prestige, or Influence ≥ half threshold), `title-challenge`, `rival-rematch` (≥3 days since meeting, or they lost the last game), `exhibition` (prestige ≥150 and a title / laurel / top-3 standing), `challenge`. Guarantee: with no entry this season, the next open-entry event of your arena is always offered.

## Season report & objectives & timeline
At each rollover `closeSeason` appends a `SeasonReport` (rating start/end/peak, W/D/L, tournaments with place, trophies won, rank change, rival record, best win). `objectives(save)` returns 1–5 ranked goals (primary first; never empty). `player.timeline` is appended as events happen (enlistment, promotions/demotions excluding provisional placement within an arena, trophies, titles won/lost, achievements, rating milestones every 100 from 1000, notable wins, season ends, new rivals); `legacyTimeline()` returns it sorted by day.

---

# v0.3 Golden Age

v0.3 makes the empire 5× larger and gives it geography: 25,000 persistent competitors, 24 arenas / 72 ranks, eight regional circuits, imperial events, rivalries, a Hall of Fame and a richer Chronicle. Simulation and persistence only; the UI reads it through the API in [WORLD_API.md](WORLD_API.md). Everything is still driven by simulated results, uses the seeded RNG, and is idempotent. Where the v0.2 rules above conflict with this section, this section wins.

## 24 arenas, 72 ranks
The 12 v0.2 arenas keep their identity and Elo floor and move to index 2·i; the Eternal Throne (old 11) becomes 23. Twelve new arenas fill the steps: 1 Ludus Yard (550), 3 Rhine Frontier (800), 5 Harbour of Ostia (1000), 7 Aqueduct Heights (1200), 9 Imperial Baths (1400), 11 Circus Maximus (1600), 13 Great Library (1800), 15 Capitoline Temple (2000), 17 Pantheon (2200), 19 Villa of Tibur (2400), 21 Golden House (2570), 22 Sanctum of Victory (2635). Floors rise monotonically; arenas above the Dust Pits are ~100 points wide (21/22: ~65).

Ranks are one title per arena × three grades (III → II → I), in four families: gladiatorial school (0–5: Tiro, Auctoratus, Miles, Veteranus, Immunis, Decanus), legion officers (6–11: Signifer, Optio, Aquilifer, Centurio, Primus Pilus, Praefectus), civic magistracies (12–17: Quaestor, Aedilis, Tribunus, Praetor, Consul, Censor), imperial dignities (18–23: Legatus, Proconsul, Imperator, Princeps, Augustus, Caesar Aeternus). Stable ids `r<arena>-<tier>`. Grade floors are thirds of the band to the next arena (Dust Pits 0 / 350 / 450). Elo, rank, arena, Influence and titles stay separate.

Rules (same structure as v0.2, margins scaled to the narrower arenas): grade demotion buffer 30, arena demotion buffer 60, Promotion Trial to enter a new arena or dominance at next floor + 100, placement ≤ 2 grades per game while provisional. `rankProgress(rank, rating)` states the requirement in words.

Economy: everything tuned for 12 arenas uses `legacyScale(arena) = arena / 2` (prizes, Influence for wins, hosting cost, invitation thresholds, signature-trophy Influence), so Influence keeps its v0.2 balance. Chronicle significance thresholds were doubled to the new indices (prodigy: arena 12+, fall from the elite: out of 18+, notable retirement: peak arena 16+).

**Mapping of old saves** (`migrateWorldArenas`, `migratePlayerArenas`, `migrateGameRecordArenas`): arena i → 2·i (11 → 23); rank 3·a + t → 3·newArena(a) + t. Applied to competitors (rank, peakRank, titles), arena titles (`title-N` ids), reigns, live tournaments (arena, titleId, series), history, awards (arena, series — defIds unchanged: `sig-i` still names old arena i's trophy; the new arenas' signature trophies are `sig-a<index>`), legends, chronicle arena fields, pending Season Laurel tallies, the player (rank, peakRank, rankHistory, trial, titles, unlockedSets, timeline, season reports, season tracker, pieceSet/boardSet settings, the active game) and stored game records (remapped on read). Achievement ids are unchanged; `arena-N` achievements keep naming the v0.2 arena N (target 2·N).

## Population: 25,000 competitors (architected for 50,000+)
`POPULATION_SIZE = 25000`. Potential is a piecewise-linear transform of a normal draw (`potentialFromZ`): ≈ 1 in 740 can reach 2710, 1 in 4,300 2900, 1 in 31,000 3040. At creation (seed 4242): > 2600: 28, > 2700: 13, > 2800: 4, > 3000: 0; arena counts from the Dust Pits up: 1058, 2171, 2059, 2276, 2361, 2398, 2332, 2134, 1915, 1598, 1345, 970, 746, 545, 401, 249, 187, 95, 64, 43, 21, 12, 7, 13 (bell-shaped base, thin elite; the top arena is open-ended). The v0.2 quadratic tail would have produced 47 players above 3000 at 25k.

Names: pools extended (146 nomina, 134 male / 112+ female cognomina, 50 city epithets; `nameCapacity()` ≈ 18 M male / 5 M female combinations). 50,000 generated names: all unique, no fallback names, 12% carry an epithet. Debutant names are unique against live competitors and archived legends.

Every competitor has: stable id, name, portraitSeed, Elo, peak, rank, arena, **region** (derived from the province of origin; stored), style, **career stage** (derived, `careerStage`: prospect / rising / prime / veteran / declining / retired, from age, career years, ~4-season rating trend and distance from peak — never from hidden potential), W-D-L, recent form (EMA `form`, `streak`, last 10 results packed in `last`), tournaments entered (`tp`, counted from v0.3), championship history (award registry), rivalries (h2h + feuds) and a **career ambition** (`careerAmbition`, derived from titles, standings, records, rank and stage, so it always agrees with the state).

Performance work (no O(n²); no per-tournament `filter` over the population): `world/indexes.ts` keeps an incremental id map and lazily rebuilt pools (active / established per arena and region, rating-sorted) invalidated at the start of every `advanceDay`; skill development runs per competitor every 4 days with the equivalent 4-day step (`DEV_EVERY`), the retirement check every 7 days with the 7-day hazard; matchmaking uses a packed native sort; Elo expectations come from a lookup table; `naturalRank` is a binary search; standings are computed only for competitors who could reach the top m (`topByStanding`). Fixed on the way: v0.2's h2h list froze on the first 8 opponents ever met (a newcomer now replaces the least-played entry); the census shift could leave a rating above its peak.

## Regional circuits
Eight regions (`world/regions.ts`; share of the population at creation): Latium (Roma, ~21%), Campania (south Italia, ~7%), Etruria (north Italia + Pannonia, ~9%), Gallia (+ Britannia, Germania, ~15%), Hispania (+ Lusitania, ~9%), Africa (+ Numidia, ~9%), Aegyptus (+ Syria, Judaea, Persia, Armenia, ~17%), Achaea (Graecia, Thracia, Dacia, ~14%). Regions are geography, not tiers: every region has players in every arena.

Season calendar additions (existing arena slots unchanged):
| Day | Event | Format | Entry |
|---|---|---|---|
| 3 | Local Open, every region, Lower (arenas 0–7) and Upper (8–15) division | Swiss 16 | open draw from the region's band |
| 5 | Imperial Masters (arena 20, 'imperial') | round robin 8 | top 8 by standing of arenas 16–23; the Eternal Throne champion always invited |
| 9 | Arena Qualifier, every arena | Swiss 12 | established competitors outside the arena's top 6; **winner joins that season's arena Invitational** |
| 15 (even seasons) | Regional Championship = the region's signature event (Ludi Romani DE16, Games of Capua SE16, Etruscan Round RR8, Council of the Three Gauls Swiss16, Tarraco Gauntlet DE8, Carthaginian Games SE16, Alexandrian Symposium RR8, Isthmian Games Swiss16) | per region | top 16 / 8 of the region by standing; the crown holder and the last two Upper Division Open winners guaranteed |
| 17 (odd seasons) | Regional Title Defence | match of 4 | crown holder vs the leading contender (a rival of the champion in the region's top 4 takes precedence) |

The winner of a Regional Championship or Defence holds the region's crown (`w.regionTitles`, reigns in `w.regionReigns`, never pruned). A crown holder who retires is vacated the same day (arena titles too, from v0.3). Every tournament carries name, arena, region (or 'imperial'), format, prestige (`tournamentPrestige`), qualification text, series, winner trophy, participants, champion and historical winners (`tournamentInfo`, winners from the award registry). Competitors may be in at most 2 running regional / imperial events at once; arena-circuit events keep the v0.2 one-at-a-time rule.

Title matches (arena championships and regional defences): the reigning holder keeps the title on a drawn match ("champion's draw odds", `TournamentConfig.retainOnTie`). A champion keeps an arena title while competing within one arena of it (`TITLE_ARENA_TOLERANCE`), and winning another arena title relinquishes the first (fixes a double-holder found by the soak).

Invitations (`refreshInvitations`, new contexts): `local-open` (your region, band contains your arena), `regional-crown` (crown holder, top `size` of the region by rating, or an Upper Open win in the last two seasons), `regional-defense` (holders auto-entered; challenger invitation if your standing tops the contenders or you are the champion's rival in the top four), `qualifier` (outside your arena's top 6, 20+ rated games), `imperial-masters` (top 8 of arenas 16–23 by rating, or an arena-20+ title), `rival-challenge` (a tournament rival of intensity ≥ 6 who won your last important encounter). Significant invitations are written to the Chronicle (tag `invitation`). The player's region is `player.region` (default Latium; `setPlayerRegion` is refused after entering a regional event).

## Rivalries
`w.feuds` (cap 1,500, pruned by intensity at season boundaries): built only from important encounters at tournament completion — finals, eliminations, title clashes, upsets (≥ 200 rating gap). Intensity = meetings + 3·finals + 2·eliminations + 5·title clashes + 2·upsets, × closeness (≤ 1.5), × recency (half after two years). Player pairs included. Rivals affect the regional defence challenger and send `rival-challenge` invitations. `w.upsets` logs upsets (cap 300: the 50 most recent + the largest).

## Trophies (v0.3: 33 new definitions; the 60 v0.2 ids are unchanged)
`AwardRecord.region` ('imperial' or region id; migrated awards are 'imperial'). Award ids stay deterministic (`<tournament>:<def>:<holder>`, Provincial Laurels `S<s>-R<region>:rlaurel:<holder>`, records `rec:<key>:<holder>`).
| Def | Category | Presented for | Art (`trophyArt`) |
|---|---|---|---|
| `lopen-lower`, `lopen-upper` | cup | Local Open win | cup-open-t0 / t1 |
| `rcrown-<region>` × 8 (the region's trophy, e.g. The Capitoline Wolf) | regional | Regional Championship or Defence win | sig-2, cup-cup-t2, sig-7, defense-t2, cup-gauntlet-t1, sig-1, sig-9, laurel-t2 |
| `rdefense` | defense | regional crown retained | defense-t1 |
| `rmedal` | medal | runner-up of a regional final / defence | medal-t1 |
| `qual-t0…t3` | cup | Qualifier win | medal-t0…t3 |
| `masters` | elite | Imperial Masters win | invit-t3 |
| `rlaurel` | seasonal | Provincial Laurel: top performer of a region's circuit in a season | laurel-t1 |
| `hist-record` | historical | set a new all-time record (once per holder per record) | hist-perfect |
| `hist-regional-dynasty` | historical | 3rd consecutive regional defence | hist-dynasty |
| `hist-giant-slayer` | historical | won a final / title match against a 250+ higher-rated opponent | hist-upset-crown |
| `sig-a1 … sig-a22` × 12 | signature | championship of the 12 new arenas | own baked sprites |
Trophy tiers now use six arenas per tier (`arenaTier = floor(arena / 6)`). Regional events feed the Provincial Laurel tally (`w.regionTally`), not the arena Season Laurel; the "sweep" feat counts arena-circuit wins only.

## Hall of Fame, Chronicle, achievements
`hallOfFame()` (see WORLD_API.md) lists greatest champions, highest peak Elo, most championships, longest reign, most defences (total and consecutive), most tournament wins, greatest rivalries, notable upsets and legends of the past, each with its eligibility text; records can be surpassed (records are computed, `hist-record` + `record-broken` / `rating-record` Chronicle entries mark the moment). Retired competitors stay through the legends archive, which now also keeps every arena champion (cap 1,000) and stores region / style / birth day. Retired full records are pruned only when 500 over the 1,500 archive (hysteresis: cold save chunks are rewritten every few seasons, not every season).

Chronicle: new tags `major-upset` (knockout / final / title won against ≥ 250 higher, one per event), `legend-defeated` (a 3+ time champion dethroned or knocked out by a lower-rated non-legend), `historic-defense` (3rd, 5th, 7th, 10th… defence, or a new record), `veteran-retirement` (20+ career years or 2,500+ games, peak arena 10+), `rating-record` (new all-time peak, replaces `record-broken` for that record), `invitation`, `regional-champion`; existing `new-champion`, `rival-promoted`, `prodigy` (rising prodigy). Entries may carry `region`. Bounded: at most 1,000 + 200 entries (trimmed in batches of 200 so persisted chunks shift rarely), `w.chronicleArchived` counts dropped entries. `chronicleFilter(entries, {kind, tag, region, arena, onlyRivals, …})`.

Achievements: 139 → 148 (9 new, all from the award registry or feuds): `local-hero`, `through-the-qualifier`, `imperial-master`, `laurel-of-the-province`, `provincial-crown`, `crown-defender`, `provincial-dynasty`, `blood-feud` (rivalry intensity 15), `slayer-of-giants`. `half-the-empire` / `the-conqueror` now mean 12 / 24 arenas; `rank-centurio` targets the Centurio grade; ids unchanged.

Style drift (season boundary, ≤ once per 8 seasons per competitor): 35+ attackers / gambiteers / counterattackers drift to strategist or technician (6%/season), 42+ to technician (4%), a long slump (150+ below peak, under 35) to universal (3%).

## Measurements (honest, Node 22, shared 4-vCPU Xeon, load average 5–7 from other jobs)
- `createWorld` 25,000 competitors, 8 burn-in seasons: **5.2–7.6 s wall, ~7.4 s process CPU** (v0.2: 5,000 in ~5 s). Population generation ≈ 0.3 s. One simulated season ≈ 0.75 s (≈ 27 ms / day). The target (< 8 s) is met on this machine; a phone will be slower (the world worker shows progress).
- Soak (`npx tsx scripts/soak-world.ts 40 20260 25000`, world only, 40 seasons after the burn-in, 66 s): all invariants held (ids / names unique, records consistent, one open reign per title / crown, no retired or double holders, award ids unique, one victory per completed event, tournamentsWon = registry, records monotone, Chronicle / feuds / upsets bounded, no stuck tournament). An earlier run found a competitor holding two arena titles (fixed, see above) and a rating above its peak (fixed).
  - Rating drift: mean 1143–1154 over 40 seasons; mean (rating − skill) between −5 and +1 (census keeps it near 0). Largest season-to-season rating change of an established competitor: 105–141.
  - Elite: > 2600: 32 → 44, > 2800: 4 → 14, > 3000: 0–2; max rating 3002 → 3150 (top arenas 22/23 hold 13–25). The top end inflates slowly (potential breakthroughs are a random walk with a small positive mean); not yet balanced — it stays rare but drifts.
  - Population: exactly 25,000 active every season; ~221 retirements (and debuts) per season; retirement age p10 26 / median 43 / p90 56.
  - Champion turnover: 14.3 of 24 arena titles change hands per season (≈ 60%, includes vacancies), 2.2 of 8 crowns per contest season. Records after 48 seasons: 45 championships, 34 consecutive defences / 954-day reign (a dominant Eternal Throne champion), 171 event wins, peak 3173.
  - Promotion loops: arena ping-pong (≥ 3 reversals in 6 seasons) — 0 competitors.
  - Save growth: whole-world JSON 28.2 MB → 37.7 MB (≈ 220 KB / season, almost all award registry); split-layout parts 51 MB-equivalent (UTF-16 accounting) at the end.
- Career soak (`npm run soak`, `tests/soak/world.soak.ts`: a player career inside the 25k empire for 50 seasons, 9,125 completed events): all trophy / record / chronicle / objective invariants held; 150 s; save 37.9 MB at the end; the player won 37 awards and 64 achievements; records 33 championships, 23 consecutive defences, peak 3127.
- Not claimed: competitive balance of the regional circuits for a human player has not been play-tested; champion turnover (~60%) and the slow elite drift are measured, not tuned to a target.

---

# v0.4 — Rating stability and the zero-to-emperor career

Where the rules above conflict with this section, this section wins. Simulation and career rules only (no UI change is required for them to work; see "UI notes" in WORLD_API.md).

## Rating stability: causes found and fixed (`world/sim.ts`, `world/population.ts`)
Measured with the instrumented soak (`npx tsx scripts/soak-world.ts 40 <seed> 25000`; `ratingProbe` counts rating points by mechanism in units of Σ(rating − skill)).
1. **The uniform census inflated the elite.** The pool's true strength rises by ≈ 42,000 skill points a season (competitors enter weak and leave strong: +1.69 M skill points over 40 seasons), while rated games only move points (net game exchange −5 k … −12 k over 40 seasons; debut placement −4 k … −7 k; retirements −78 k … −88 k). v0.3 returned the deficit with one uniform shift (+1.725 M over 40 seasons, ≈ +6 every ~3 seasons). The drain happens where improving players are (lower and middle bands); the elite mostly play each other, so the shift piled up at the top: after 40 seasons the rating − skill gap was −7 … −10 below 1500 and **+15 … +58 above 2400**. **Fix:** the Imperial Census calibrates each strength band separately (`censusCorrection`: bands 0/800/1100/1400/1700/2000/2300/2600 by skill, ≥ 20 established members, interpolated between band means, flat beyond). Everyone of similar strength moves by the same few points, so order within a band and legitimate differences are kept.
2. **Rounding favoured big favourites.** `Math.round(K·(score − expected))` at K 10: a 95 % favourite gained +1 for a win (round 0.5) but lost only −4 for a draw (round −4.5): ≈ +0.5 points per game for the strongest, who mostly play weaker fields. **Fix:** `ditherRound` — floor(x + u) with a deterministic dither from (portrait seed, games): exact in expectation, ratings stay integers, nothing stored. (The player's own rating keeps `elo.applyResult`'s rounding so the stake preview stays exact.)
3. **Breakthroughs fattened the elite tail.** A breakthrough added N(+10, 70) points to the potential with no mean reversion: potentials above 3000 went 2 → 4, skills above 2800 5 → 10 in 40 seasons. **Fix:** `potentialStep` — an AR(1) step in the pyramid's normal space (z' = 0.985 z + 0.17 ε) keeps the potential distribution stationary; a mid-table event still moves ≈ ±70.
4. **Title-match challengers were weak and draws hid upsets** (the 34-defence dynasty). The challenger was the latest League winner of the arena however old: challengers were the arena's 4th–5th strongest by median, the 34-defence holder met challengers 239 weaker while the strongest contender was 115 weaker (the challenger was the strongest contender in 20 % of his defences). And draws could take 95 % of the underdog's expected score: a 2900-level challenger 150 below won 2.2 % of games (one match in ~107). **Fixes:** `championshipChallenger` picks the highest standing among the arena's League / Open / Cup / Gauntlet / Invitational winners of the current and previous season (active, within one arena) and the arena's top three by standing; holders of this or a higher arena title are never drafted (it would cost them their title). `DRAW_SHARE_CAP` 0.95 → 0.7 (expected score unchanged; that underdog now wins ≈ 9 % of games, as in top-level classical statistics).
5. Rank rules: a dominance promotion now enters the **next arena only** (v0.3 jumped to the rating's natural rank and could skip arenas). Title holdings: the player's automatic entry as defender lapses with the title (v0.3 drafted a player who had relinquished a title as its challenger, and the player won it back: a title ping-pong between arenas found by the journey test); a player holding this or a higher arena title is never a challenger for another.

### Multi-seed results (25,000 competitors, 8-season burn-in + 40 seasons, `scripts/soak-world.ts`)
Runtimes: seed 20260 alone **74 s** (burn-in 6.1 s, 0.82 s of simulation per season, the rest invariant checks and a JSON size measurement each season); the three seeds run in parallel on the shared 4-vCPU box took 259–265 s each (v0.3 code: 298–304 s, same conditions). Deterministic: the same seed reproduces the same numbers. Arena populations at the end (seed 20260, Dust Pits → Eternal Throne): 1020/2014/1974/2256/2316/2385/2361/2193/1967/1665/1352/1024/816/563/436/238/167/93/67/42/23/14/3/11.
| | v0.3 (seeds 20260 / 4242 / 777) | v0.4 (same seeds) |
|---|---|---|
| mean rating, end | 1150 / 1151 / 1159 | 1146 / 1147 / 1152 |
| top-1 rating (its skill), end | 3150 (3063) / 3154 (3132) / 2970 (2885) | 3028 (2989) / 3045 (3059) / 2943 (2911) |
| top-1 max over the run | 3169 / 3177 / 3028 | 3070 / 3048 / 3041 |
| top-10 mean rating (skill), end | 2930 (2870) / 2925 (2888) / 2938 (2869) | 2818 (2810) / 2895 (2862) / 2872 (2865) |
| > 2800 end (max) / > 3000 max | 14 (14) / 2 · 10 (13) / 1 · 20 (21) / 3 | 4 (11) / 1 · 10 (11) / 1 · 8 (14) / 1 |
| rating − skill by skill band 0+/1000+/1500+/2000+/2400+/2600+ | −9/−10/+11/+31/+46/+46 · −10/−10/+15/+37/+17/+15 · −7/−9/+10/+34/+37/+58 | 0/0/0/+1/−8/−3 · +1/0/−1/+1/−5/−10 · 0/0/0/+1/−10/−1 |
| census points / pool skill growth (40 seasons) | +1.725 M / +1.67–1.69 M | +1.54–1.55 M / +1.44–1.46 M |
| record consecutive defences | 34 / 39 / 14 | 21 / 16 / 21 |
| longest streak: gap to challenger / to strongest contender, challenger = strongest | 239 / 115, 20 % · 150 / 130, 50 % · 129 / 50, 14 % | 87 / 78, 71 % · 151 / 140, 88 % · 126 / 121, 90 % |
| challenger = strongest contender / in top 3 / median place (all arena title matches) | 23 / 44 % / 5 · 24 / 46 % / 4 · 21 / 45 % / 4 | 30 / 53 % / 3 · 32 / 56 % / 3 · 33 / 52 % / 3 |
| arena title changes / season (incl. vacancies), crown changes / contest season | 14.3, 2.2 · 14.8, 2.5 · 14.5, 3.2 | 10.8, 2.9 · 10.2, 3.2 · 10.2, 2.7 |
| record peak Elo | 3173 / 3178 / 3033 | 3078 / 3053 / 3046 |
(The 2800+ band holds 3–10 players; its gap is noise of ±30. Top-1 / top-10 *by rating* are biased upward by selection — the unbiased measure is the gap by skill band.)
**Streaks are now explained by real skill:** the longest reigns (15–21 defences) belong to holders 120–150 stronger than the strongest contender in their arena, who was their challenger 71–90 % of the time; at that gap the model gives the challenger 4–9 % per match (an expected reign of 11–27 defences).
Invariants held on all seeds (soak exits on the first violation): unique ids / names, W+D+L = games, peak ≥ rating, one open reign per title / crown, holders alive (crowns: of their region), nobody holds two arena titles, award ids unique, one victory award per completed event, tournamentsWon = registry, records monotone, bounded chronicle / feuds / upsets, no stuck tournament, **bracket validity of every tournament state** (entrants unique, pairings reference entrants, nobody paired twice in a round, a completed event's winner is an entrant and not the runner-up), **every one of the 72 grades occupied by an AI competitor at some season end** (each season at most 2–4 thin elite grades are momentarily empty). Repeat pairings in completed Swiss events: 26–50 in 40 seasons (thousands of events; withdrawals and small fields). Competitors whose rank is more than one arena from their rating's natural arena (established, at a season end): ≤ 25 of 25,000 (pending trials, inactive players). Arena ping-pong (≥ 3 reversals in 6 seasons): ≤ 2.

## Zero-to-emperor career (`game/career.ts`, `game/placement.ts`)
**A fresh career** (`newSave` / `newPlayer`, v0.4) starts at arena 1 of 24 (the Dust Pits), grade 1 of 72 (Tiro III, rank 0), W/D/L 0, Influence and prestige 0, no trophies, championships, titles, achievements, rivals, h2h or library, and is **unrated**: the self-assessed level from onboarding is only a provisional seed for matchmaking; `ratings[*].peak = 0` and `ratingHistory = []` until a rated game is played (v0.3 recorded the seed as peak and as a history point). The season tracker has no peak either. `unlockedSets = [0]` is the recruit's own equipment (the Dust Pits board and pieces), not an honour. The timeline holds only the enlistment. Older saves are untouched (no `placement` field: they keep the v0.3 provisional rule).
**Placement** (`player.placement`): the first `PLACEMENT_GAMES` = 10 rated games are placement games. The rank stays at Tiro III while they are played (v0.3 climbed two grades per game toward the *seed's* natural rank, even while losing); the rating moves by provisional Elo (K 40) from the seed. The verdict after game 10 sets the rating to the placement performance — average opponent + 400·log10(p/(1−p)), p clamped to [1/20, 19/20] — and the rank to the grade of that rating, capped at `PLACEMENT_MAX_RANK` = 17 (Decanus I, top of the gladiatorial school): a strong newcomer is lifted several grades at once; anything higher is earned arena by arena. The peak rating (and the season report's peak) starts at the verdict: provisional ratings before it depend on the seed, not on results. Grades below the verdict are skipped by design; they remain reachable (AI competitors hold them, and demotion visits them).
**After placement** (v0.4 careers): the standard rules (grade buffer, Promotion Trial or dominance at the next floor + 100 to cross into the next arena — one arena at a time) with **at most one grade up per rated game**, and no second move in a game that already moved the rank (a won trial). The rating stays provisional (K 40) until 20 games.
**Early-career milestones** (`careerMilestones(save)`, derived from records): placement → first rated win → first promotion → first tournament → first regional event (Local Open) → first Promotion Trial won → first trophy → leave the Dust Pits. `objectives()` shows the placement (priority 75) while it runs, then the next open milestone (kind `'milestone'`, priority 62).
**Invitations** (v0.4): a trial invitation lapses when its trial is resolved; an arena event's invitation lapses when the player changes arena (a Local Open's when the player leaves its band).
**Untimed**: `CLOCKS_ENABLED = false`; every game is untimed whatever time control is requested.

## Acceptance scenario (`tests/journey.test.ts`, `tests/soak/journey.soak.ts`, driver `tests/helpers/journey.ts`)
A fresh save is played through the real career API (`startGame` / `finishPlayerGame` / `acceptTournament` on real invitations / trial invitations / auto-entered title defences / `restDays`) by a player whose strength rises from ≈ 450 to 3,300 over ~900 games; every result comes from `simulateGame`, the world's own outcome model. Checked: a fresh career has no earned honour, history, peak or achievement; placement sets rating and grade; records change exactly once per game; all 24 arenas are entered in order and all 72 grades are held (above the placement grade strictly in order); tournament entries match the eligibility rules; the Eternal Throne is won and defended; every victory award belongs to a won event, once; medals to real runners-up; every unlocked achievement agrees with its metric (and every locked one does not); profile statistics from the stored records (`computeCareerStats`) equal the career W/D/L; the save round-trips through IndexedDB persistence; a v0.2 save migrates untouched and plays on. Normal run: 8,000 competitors, 4-season burn-in, ≈ 920 games, ≈ 35 s. Soak variant (25,000 competitors, 8-season burn-in, three defences of the Eternal Throne): seed 777 — 898 games, placement → Tiro I (514), emperor after 802 career days, 43 events won, 94 achievements, 131 s; seed 20260 — 1,006 games, placement → Auctoratus II (632), emperor after 913 days, 48 events won, 99 achievements, 151 s.
