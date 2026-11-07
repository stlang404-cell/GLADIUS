# GLADIUS — World, honours & career rules (v0.2)

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
