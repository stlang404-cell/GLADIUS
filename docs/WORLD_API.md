# GLADIUS v0.3 — World data API for the UI

Pure functions (no mutation unless stated) over `WorldState` / `Save`. All of them read real
simulation state; nothing is invented. Types live next to the functions. Import paths are
relative to `src/`.

## Layout constants (`world/arenas.ts`)
| Export | Meaning |
|---|---|
| `ARENAS: ArenaDef[]` (24) | `index, id, name, motto, architecture, trophy, floor, palette, ambience, legacyIndex?` (`legacyIndex` = v0.2 index of the 12 original arenas) |
| `RANKS: RankDef[]` (72) | `index, id ('r<arena>-<tier>'), name ('Quaestor II'), title, grade ('III'/'II'/'I'), arena, tier, floor, meaning, family ('gladiatorial'/'legion'/'civic'/'imperial'), prestige` |
| `ARENA_COUNT` (24), `RANK_COUNT` (72), `TOP_ARENA` (23), `ARENAS_PER_TIER` (6) | never hard-code 12 / 36 / 11 |
| `rankId(index)`, `rankIndexById(id)` | stable rank ids |
| `rankProgress(rank, rating): RankProgress` | `{ rank, next, current, target, nextFloor, crossesArena, bypassAt, gradeLostBelow, arenaLostBelow, requirement }` — transparent promotion requirements |
| `decideRank`, `naturalRank`, `GRADE_DEMOTION_MARGIN` (30), `ARENA_DEMOTION_MARGIN` (60), `TRIAL_BYPASS_MARGIN` (100) | rank rules |
| `LEGACY_ARENA_MAP`, `migrateArenaIndex(old)`, `migrateRankIndex(old)`, `legacyScale(arena)` | v0.2 → v0.3 index mapping (old arena i → 2i, Eternal Throne 11 → 23) |

## Regions (`world/regions.ts`)
`REGIONS: RegionDef[]` (8: latium, campania, etruria, gallia, hispania, africa, aegyptus, achaea) — `id, name, capital, provinces, crown, trophy, signature {name, format, size}, openName, motto`.
`REGION_BY_ID`, `REGION_IDS`, `isRegionId(x)`, `regionForOrigin(origin, serial)`, `regionTitleId(r)` (`'crown-<r>'`), `LOCAL_BANDS` (Lower 0–7, Upper 8–15), `IMPERIAL = 'imperial'`.

## Competitors (`world/hall.ts`, `world/indexes.ts`, `world/sim.ts`)
| Function | Returns |
|---|---|
| `competitorProfile(w, id): CompetitorProfile \| null` | identity (name, female, portraitSeed, origin, region, regionName, age, careerYears), `stage`, `ambition`, `style/styleLabel`, rating, peak, rank/rankName/peakRank/arena/arenaName, `rankProgress`, record W-D-L, form, streak, `recent` (last 10 'W'/'D'/'L'), tournamentsPlayed, tournamentsWon, championships, prestige, titles, regionalCrown, `championshipHistory` (arena / regional / Masters awards, newest first), `rivalries` (feuds with intensity), h2h, retiredDay, ratingHistory |
| `careerStage(c, day): 'prospect'\|'rising'\|'prime'\|'veteran'\|'declining'\|'retired'` | derived from age, career years, rating trend, peak gap (never from hidden potential) |
| `careerAmbition(w, c): { kind, text, target?, progress? }` | kinds: defend-title, defend-crown, break-record, win-arena-title, win-regional-crown, reach-arena, last-campaign, break-peak, retired |
| `recentResults(c, n=10)` | `('W'\|'D'\|'L')[]`, newest first |
| `getCompetitor(w, id)`, `competitorMap(w)`, `regionOf(c)` | O(1) lookup |
| `activeInArena(w, a)`, `establishedInArena(w, a)`, `activeInRegion(w, r)`, `regionBand(w, r, lo, hi)`, `activeByRating(w)`, `activeInRatingRange(w, lo, hi)`, `activeCount(w)` | cached pools (do not mutate the returned arrays) |
| `populationPyramid(w): PopulationPyramid` | `active, retiredKept, legends, byArena[24], byStage, byRegion, ratingAbove {2300…3000}, meanRating, maxRating` (O(n): call when a screen opens) |

## Tournaments (`world/calendar.ts`)
| Function | Returns |
|---|---|
| `tournamentInfo(w, t, historyLimit=10): TournamentInfo` | `id, name, kind, arena, region ('imperial' or region id), format, prestige, qualification (rule text), series, trophy (winner def id), status, startDay, season, size, participants, champion, runnerUp, qualified, historicalWinners[]` |
| `eventCalendar(w, { region?, arena?, status? })` (`world/hall.ts`) | `TournamentInfo[]` of live / scheduled / recent events |
| `seriesWinners(w, series, trophyDef?, limit=20)` | winners of a series (e.g. `'crown-gallia'`, `'open-12'`, `'masters'`), newest first, from the permanent award registry |
| `tournamentPrestige(kind, arena)`, `qualificationText(w, t)` | |
| `regionTitle(w, region)` | the crown's `TitleState` (`holder`, `since`, `defenses`) |
| `regionalChallenger(w, region, holder)` | who would challenge for the crown |
| `TournamentKind` | `open, cup, gauntlet, invitational, league, championship, hosted` + v0.3 `local-open, regional, regional-defense, qualifier, elite` |

Season calendar: per arena League (d0), Open (d1), Cup/Gauntlet (d8), Invitational (d14), Championship (d21) — plus v0.3: Local Opens per region × 2 divisions (d3), Imperial Masters (d5), Arena Qualifiers (d9 → feed the Invitational), Regional Championship (even seasons, d15) / Regional Title Defence (odd seasons, d17).

## Arenas and regions (`world/hall.ts`)
| Function | Returns |
|---|---|
| `arenaInfo(w, arena): ArenaInfo` | `index, name, motto, floor, population, champion {titleId, name, holder, holderName, since, defenses}, championHistory (reigns, newest first), signatureTrophy {defId, name, art}, grades[3], promotion (rule text), events` |
| `regionInfo(w, region): RegionInfo` | `def, population, byArena[24], share, crown {...}, reigns, records {mostCrowns, longestReign, mostDefenses, highestPeak, mostEventWins}, signatureEvent {name, format, size, trophy, trophyDef, trophyArt}, events, champions` |
| `regionsOverview(w)` | `{ id, name, population, share, crownHolder, crownHolderName }[]` |
| `regionalLeaderboard(w, region, n=20)` | `{ id, name, rating, arena, rank, stage, crown }[]` |

## Hall of Fame (`world/hall.ts`)
`hallOfFame(w, n=10, save?) → HallList[]` (`{ key, label, criteria, rows: HallRow[] }`), keys: `greatest-champions, peak-elo, championships, longest-reign, most-defenses, consecutive-defenses, tournament-wins, greatest-rivalries, notable-upsets, legends`. Individual lists: `greatestChampions(w, n)`, `longestReigns(w, n, {regional?})`, `mostDefenses(w, n, {regional?})`, `greatestRivalries(w, n)`, `notableUpsets(w, n): UpsetEntry[]`, `legendaryRetired(w, n)`, `playerCareerRecords(save): PlayerCareerRecords` (player bests + `allTimeRank` per record). v0.2 `recordLeaders`, `hallOfRecords`, `competitorHonours` (`world/records.ts`) are unchanged.

## Rivalries (`world/rivalry.ts`)
`feudsOf(w, id, n)` (id may be `'player'`) → feuds with `intensity, other, otherName`; `feudBetween(w, a, b)`; `topFeuds(w, n, {allTime?, includePlayer?})`; `feudIntensity(feud, day)`. Player rivalry model (`player.rivals`, `rivalries(save)`) is unchanged.

## Trophies (`world/trophies.ts`)
`TROPHY_DEFS` (60 v0.2 defs unchanged + 33 v0.3), `TROPHY_BY_ID`, `V3_TROPHY_IDS`, **`trophyArt(defId)`** → sprite id: load `trophies/${trophyArt(defId)}.webp` (v0.3 defs without dedicated art reuse an existing sprite), `sigDefFor(arena)` (`sig-<old index>` for the 12 original arenas, `sig-a<index>` for the new ones), `winnerDefFor(kind, arena, t?)`, `medalDefFor(kind, arena)`, `hasFinal(kind, format?)`, `awardsByRegion(w, region)`, `presentRegionLaurels(...)`; `AwardRecord.region` ('imperial' or region id). Selectors `awardsFor, awardsByDef, awardsByArena, currentOfSeries, trophyCabinet, rarityOf` unchanged.

## Chronicle (`world/chronicle.ts`)
`chronicleFilter(entries, { kind?, tag?, region?, arena?, onlyRivals?, rivals?, id?, sinceDay?, newestFirst=true, limit? })`, `CHRONICLE_TAG_LABELS`, `chronicleStats(w) → { kept, archived, cap, maxInMemory, byTag }`. v0.3 tags: `major-upset, legend-defeated, historic-defense, veteran-retirement, rating-record, invitation, regional-champion` (plus v0.2 tags; `prodigy` = "rising prodigy"). `ChronicleEntry.region?`.

## Career (`game/career.ts`, `game/legacy.ts`)
`playerRegion(save)`, `setPlayerRegion(save, region): boolean` (refused once the player entered a regional event or holds a crown), `refreshInvitations(save)` (new contexts: `local-open, regional-crown, regional-defense, qualifier, imperial-masters, rival-challenge`), `objectives(save)` (new kind `regional-crown`), `migratePlayerArenas(save)`, `migrateGameRecordArenas(record)`. `PlayerHooks` gained `playerRegion`, `onPlayerRegionalTitle`, `onPlayerQualified`.

## Migration (`world/migrate.ts`)
`ensureWorldV3(w)`, `migrateWorldArenas(w)`, `growPopulation(w, target)`, `initRegionTitles(w)`; `ensureSaveV2(save)` runs all of them (idempotent) — the UI's existing call in `store.ts` is enough.

## UI notes (not done here; the UI is owned elsewhere)
- `TrophyImage` must load `trophyArt(defId)`, not `defId` (v0.3 defs `lopen-*, rcrown-*, rdefense, rmedal, qual-t*, masters, rlaurel, hist-record, hist-regional-dynasty, hist-giant-slayer` have no file of their own).
- `EmpireTab` maps tournament kinds to trophy ids by hand (`sig-${t.arena}` is wrong for 24 arenas): use `tournamentInfo(w, t).trophy` / `sigDefFor(arena)`.
- Hard-coded 12 arenas: `Ceremony.tsx` (Roman numerals I–XII for `item.arena`), `art/emblems.ts`, `art/portraits.ts`, `art/arenaCrest.ts` (`% 12`, `Math.min(11, …)`), `LegacyTab.tsx` collection grid (`t.id === 'laurel' ? 'Eternal Throne'`). Rank emblems exist for 36 ranks only.
