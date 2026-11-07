# Persistence (save format 2; layout v3 in GLADIUS v0.3 — see the last section)

GLADIUS keeps everything on the device in IndexedDB (database `gladius`, version 2).
Until v0.1 the whole career + world was one JSON document (~6 MB after a few seasons)
rewritten after every move. v0.2 splits it so that a move writes about 1 KB and a
finished game about 0.5 MB, and old saves are converted automatically.

Code: `src/persist/layout.ts` (split / assemble, pure), `src/persist/save.ts` (commits,
load, recovery, migration, export/import), `src/persist/backup.ts` (snapshots),
`src/persist/db.ts` (IndexedDB wrapper). Tests: `tests/persist.test.ts` (original API
tests, unchanged), `tests/persist.split.test.ts`, `tests/persist.perf.test.ts` (prints
the numbers below).

## Stores

| Store | Contents |
|---|---|
| `parts` (new in v2) | `manifest` plus one record per part, keyed `<part>@<generation>` |
| `games` | one `GameRecord` per game (unchanged) |
| `backups` | rolling snapshots `slot0..2`, `pre-split` (the migrated v1 save), `damaged-*` (quarantined data) |
| `kv` | v1 used `save` (single-document Envelope). Deleted once migrated. |

The DB upgrade from version 1 only adds `parts`. Nothing is removed.

## Layout

The Save is split into parts by `splitSave()`. Fields nobody knows about yet are
carried along: an unknown top-level Save key goes to `meta`, an unknown world scalar or
object goes to `world`, an unknown world array gets its own `wa/<key>` chunks, and an
unknown competitor field goes to the `warm` family.

| Part | Contents | Changes |
|---|---|---|
| `meta` | schema, createdAt, updatedAt, seed, settings, unknown top-level keys | every commit (tiny) |
| `active` | the in-progress game | every move |
| `player` | `player`, `library`, `libraryMeta`, `coach` | after each game |
| `world` | WorldState scalars and objects (day, season, counters, stats, hall, …) | daily (≈6 KB) |
| `wa/<key>/index`, `wa/<key>/<n>` | each world array (history, chronicle, awards, reigns, titles, invitations, …), 128 entries per chunk | appends touch only the last chunk |
| `tour/index`, `tour/<id>` | live tournament states, one record each | running tournaments only |
| `pop/index` | competitor ids in array order (Int32 serials when ids are `c000123`, else JSON) | on debut / pruning |
| `pop/hot/<key>` | 15 typed-array columns: skill, rating, peak, games, w, d, l, form, streak, rank, peakRank, potential, tournamentsWon, championships, retiredDay. Int32 when all values are integers, else Float64, plus a tag array for `null` / non-numbers | daily (skill drifts for every active competitor) |
| `pop/cold/<n>` | fields fixed after creation (id, name, origin, portrait, birth/debut day, peak age, style, openings, traits), 250 competitors per chunk by id serial | only when chunk membership changes |
| `pop/rh/<n>` | `ratingHistory`, 250 per chunk | once per season |
| `pop/warm/<n>` | everything else (h2h, titles, honours, prep, any new field), 25 per chunk | the chunks of competitors whose records changed |

Competitors are chunked by **id serial**, not by array position. Pruning retired players
and adding debutants therefore leaves the other chunks untouched.

Why the hot/cold split: in one simulated day all 5,000 active competitors change `skill`,
about 1,600 change `games/w/d/l/form`, and only about 25–80 change their head-to-head
list. Chunking whole competitor objects would make every chunk dirty after every game.

## Sizes (measured)

World created with `createWorld(4242)` (8 burn-in seasons) plus 3 more seasons:
5,472 competitors, 120 tournaments, 659 history entries. Whole Save JSON: **5.96 MB**.

| Part family | Records | Size |
|---|---|---|
| pop/warm | 219 | 1,745 KB |
| pop/cold | 22 | 1,530 KB |
| pop/rh | 22 | 761 KB |
| pop/hot | 15 | 390 KB (binary) |
| wa/awards | 10 + index | 403 KB |
| tour/* | 121 | 206 KB |
| wa/history | 6 + index | 159 KB |
| wa/chronicle | 5 + index | 76 KB |
| pop/index | 1 | 21 KB (binary) |
| world, player, meta, active, rest | | < 20 KB |
| **total** | **433** | |

## Timings (measured)

Node 22 on a shared 4-vCPU Xeon @ 2.1 GHz with load average 9–11 from other jobs.
Expect lower numbers on a quiet desktop. fake-indexeddb is an in-memory JS
implementation, so "wall" is only a rough guide to real IndexedDB cost. "Prep" is the
synchronous diff and serialisation on the main thread, which is what can cause jank.

| Operation | v0.1 (single document) | v0.2 |
|---|---|---|
| In-game move save | 105–165 ms, 6 MB written | prep **0.3 ms** (max 0.4), wall 0.4 ms, **~1 KB** written |
| Post-game save (world advances 1 day) | same | prep median **45 ms** (process CPU 42 ms), wall 48 ms, **~560 KB** written |
| Season-boundary game | same | prep ~41–58 ms, ~1.3 MB written |
| Load (read + verify every checksum + assemble) | — | 160–185 ms |
| Backup snapshot (stringify + gzip) | 6 MB copy every 5 games | 280–350 ms every ≥10 games; 6.2 MB → 1.1 MB |
| One-time migration v1 → v2 (with verification read-back) | — | 0.6–1.1 s |

Most of a post-game commit is spent in `JSON.stringify` of the warm family (h2h, ~10–14
ms) and of the world arrays and tournaments (~6 ms). Change detection compares each
part's new JSON string with the string written last time; strings are only hashed when
they differ.

## Commit model and consistency

- **One IndexedDB transaction per commit.** The order inside it is: changed parts under
  new keys `<part>@<gen>`, then the `manifest` (generation, layout sizes, part → key,
  checksum, size), then deletes of superseded keys. IndexedDB transactions are atomic,
  so a crash leaves the previous generation intact. Even on a non-atomic store, old keys
  are deleted only after the new manifest. A reader only ever follows the manifest, so
  it cannot see a mixed generation. `tests/persist.split.test.ts` aborts a transaction
  after 3 of its puts and checks that the previous generation loads exactly.
- **Optimistic concurrency.** The transaction first reads the stored manifest
  generation. If another tab committed in between, it aborts (`CommitConflict`). That
  window then forgets its diff state and rewrites its whole save: last writer wins with
  a consistent save, the same as v0.1.
- **Coalescing.** The first save request is prepared synchronously, so it is a snapshot
  of the moment it was made. Requests that arrive while a commit is in flight are merged
  into one commit of the latest state. On failure the tracker resets, and one automatic
  full rewrite follows (at most 2 retries).
- **Light commits.** During a game, a commit writes only `meta` + `active` when a cheap
  probe shows nothing else changed. The probe covers every scalar and array length at
  the top of `world`, `world.stats` and `player`, plus library/coach sizes. A full commit
  still runs after 50 light commits or 30 s, when the game ends (`active` becomes null),
  on `flushSave` (pagehide / visibilitychange → hidden) and whenever a backup is
  requested.
- **Skipped cold / rating-history chunks.** On full commits these chunks are re-serialised
  only when a cheap signature changes. For cold chunks the signature covers member ids;
  for rh chunks it covers ids plus each history's length, first and last entry.
  **Rolling verification** also re-serialises 1/8 of the remaining cold/rh chunks on
  every full commit, so each chunk is re-checked at least every 8 full commits with no
  periodic spike. Every other part is fully re-serialised and compared on every full
  commit.
- Store behaviour is unchanged: `mutate()` debounces 500 ms, moves and game end save
  immediately, and pagehide flushes.

## Integrity and recovery

Every part record stores the checksum of its content (FNV-1a over the JSON string, or
over the 32-bit words of the typed arrays). The manifest stores the expected checksum
again, and the manifest itself is checksummed. On load:

1. **Manifest damaged:** restore the newest valid backup (`recovered: true`).
2. **Competitor parts damaged** (hot / cold / rh / warm): repair competitor by
   competitor. Data comes from the newest backup if that competitor is in it, else from
   the damaged chunk read as-is if it still parses, else it is regenerated
   deterministically from the competitor's serial and the world seed (only for
   competitors that debuted after the backup). The player's career and the rest of the
   world stay current. Result: `recovered: true` plus a message such as "Repaired 1
   damaged competitor record from the backup of … (250 from backup, 0 read as-is, 0
   regenerated)". The repaired save is rewritten immediately.
3. **Career, world, tournament or index parts damaged:** restore the whole newest
   backup, because a consistent older save is better than a patchwork. With no backup,
   damaged JSON is read as-is if it parses.
4. **Only `active` damaged:** the in-progress game is abandoned and reported.
5. **Unrecoverable** (structural damage, no backup, unparseable): the raw manifest and
   records are copied to `backups/damaged-<time>` before `{ save: null, error }` is
   returned, so starting a new career cannot destroy them.

## Migration from v0.1 (schema-1 envelope in `kv/save`)

On the first `loadSave()`:

1. The envelope is unwrapped. If its checksum fails, the newest v1 backup is used and
   `recovered: true` is returned.
2. The split save is committed with `migratedFrom = envelope checksum`.
3. It is read back from IndexedDB, reassembled and compared with the original using
   key-order-independent canonical JSON.
4. Only after that check passes, one transaction stores the envelope as
   `backups/pre-split` and deletes `kv/save`. If verification fails, the split manifest
   is dropped and the v1 record stays where it was. The save is still returned, and the
   next load retries.

If a `kv/save` record is found next to a split save, for example after a crash between
steps 2 and 4, a valid one is moved to `pre-split`. A damaged one is moved to
`damaged-legacy-*` and reported, and the split save is kept.

Old v1 rolling backups (`slot0..2` Envelopes) stay listable and restorable. They are
replaced by v2 snapshots as the slots rotate. `pre-split` is deleted once two v2
snapshots exist.

## Backups

- Snapshot = the whole Save as JSON, gzip-compressed via `CompressionStream` when
  available (fallback: plain JSON string), with a checksum of the uncompressed text.
- Policy (`backupDue`): when asked (`persistSave(save, { backup: true })`, which the
  store requests after every archived game), take a snapshot only if none exists yet,
  the season changed since the newest one, or at least 10 games have been played since.
  Import always takes one.
- At most 3 slots (`slot0..2`); the oldest is overwritten.
- `listBackups()` verifies each backup (decompress + checksum). `restoreBackup(key)`
  rewrites the split save from it.

## Export / import

`exportAll()` writes one JSON file:
`{ format: 'gladius-backup', version: 2, exportedAt, schema, checksum, save: <Save object>, games: [...] }`.
The checksum is over `JSON.stringify(save)`. In v1 the save was an Envelope string
inside the file; storing the object directly avoids double escaping. `parseImport()`
accepts version 1 files (Envelope) and version 2 files, and rejects a bad checksum.

## API

Unchanged signatures: `loadSave`, `persistSave(save, { backup })`, `exportAll`,
`importAll`, `parseImport`, `listBackups`, `restoreBackup`, `wipeAll`, `storeGame`,
`getGame`, `allGames`, `wrap`, `unwrap`, `migrate`, `checksum`, `loadNewestBackup`.

Additions:
- `persistSave(save, { full: true })` forces a full commit (used by `flushSave`).
- `whenSaved()` waits until every queued commit has finished.
- `resetPersistState()` forgets the in-memory diff state (tests).
- `persistStats` gives counters and the last commit's mode, parts written, bytes and prep ms.
- `db.ts`: `commitOps`, `getMany`, `CommitConflict`, `dbStats`, `dbFaults` (test fault
  injection).

## Limits / future work

- The post-game cost is dominated by re-serialising the 1.7 MB warm family (mostly
  head-to-head lists) to detect which of its chunks changed. Possible next steps: give h2h its own compact columnar encoding,
  or move the commit to a worker. Both are optional.
- Arrays trimmed from the front (e.g. a capped chronicle) shift every chunk, so their
  chunks are rewritten together. This costs at most the array's size (≈76 KB today).
- The cold-family rule assumes game code never edits a competitor's name, origin,
  portrait, birth/debut day, peak age, style, openings or traits after creation (true
  today; checked with grep). An edit would still be saved, at the latest by the rolling
  verification within 8 full commits. A field that must change often belongs anywhere
  except `COLD.keys`.

---

## v0.3 (25,000 competitors): layout version 3

`layoutSizes()` now records `{ cold: 250, rh: 250, warm: 100, h2h: 1024, v: 3 }`. A manifest written by v0.2 has different sizes, so the first commit after loading an old save is a full verified rewrite (old keys are garbage-collected); old saves are still read with their own recorded sizes.

Changes:
- **Head-to-head lists in a binary family** `pop/h2h/<n>` (1,024 competitors per chunk by id serial; Int32 words per competitor `[serial, n, (oppSerial, w + 65536·d, l) × n]`, opponent `player` = −1). No JSON.stringify of 200,000 h2h entries per commit; unchanged chunks are detected by checksum. A list that cannot be encoded (non-standard ids, huge counts) stays in the warm family.
- **Adaptive integer columns**: hot columns use Int8 / Int16 / Int32 / Float64, whichever fits (`dt: 'i8' | 'i16' | 'i32' | 'f64'`); new hot keys `tp`, `last`.
- **Warm chunks are skipped when unchanged** (signature over titles, honours count / first / last, arcs, preparation, style day), 100 per chunk; covered by the rolling verification like cold / rh. A warm edit the signature cannot see is saved within 8 full commits.
- **Cold signature includes style / opening styles** (style drift is the only cold edit); `region` is a cold key.
- Game records: `GameRecord.arenaLayout` (24); records stored by v0.2 are remapped on read (`getGame`, `allGames`, import), new ones are tagged in `storeGame`.
- Fix: debut days of `-0` (from `Math.round(-0.3)`) did not survive JSON; competitors are now created with `0`.

Migration of v0.2 saves happens in memory on load (`ensureSaveV2` → `ensureWorldV3` → `migrateWorldArenas`, `growPopulation`, `migratePlayerArenas`), then the first commit rewrites the split save. Test: `tests/migrate.v03.test.ts` with a genuine v0.2 save produced by the v0.2 code (`tests/fixtures/v02-save.json.gz`, 429 competitors, 6 seasons, a 160-game career): ids, names, records, titles, reigns, history, awards (ids and defIds) preserved and remapped, regions assigned, population grown to 25,000 with fresh serials, idempotent, a season can be played afterwards, and the migrated save round-trips through IndexedDB exactly.

### Sizes and timings at 25,000 competitors (measured)
`tests/persist.perf.test.ts`: `createWorld(4242)` (8 seasons) + 3 seasons → 26,693 competitors (incl. retired archive), 338 tournaments, 1,848 history entries. Node 22, shared 4-vCPU Xeon with load average 5–7; fake-indexeddb.

| | v0.2 (5,472 competitors) | v0.3 (26,693) |
|---|---|---|
| Whole Save JSON | 5.96 MB | 29.0 MB |
| Parts | 433 | 957 |
| pop/cold · rh · warm · h2h · hot (KB, UTF-16 chars for JSON) | 1,530 · 761 · 1,745 · — · 390 | 7,956 · 3,762 · 1,048 · 2,695 (binary) · 1,277 (binary) |
| In-game move (light commit) | prep 0.3 ms, ~1 KB | prep **1.0 ms** (max 1.1), ~1 KB |
| Post-game commit (world advances 1 day) | prep 45 ms, ~560 KB | prep median **130 ms** (max 318 at a season boundary), ~2.3 MB of JSON-equivalent (≈ 4.7 MB incl. the binary h2h / hot columns) |
| Season-boundary commit | ~1.3 MB | ~13.5 MB (all rating histories; cold chunks when the retired archive is pruned) |
| Load (read + verify + assemble) | 160–185 ms | 580 ms |
| Backup snapshot (stringify + gzip) | 280–350 ms, 6.2 → 1.1 MB | 1.07 s, 29.6 → 5.5 MB |
| Migration of a schema-1 document | 0.6–1.1 s | 2.8 s |

Long run (`scripts/soak-world.ts`, 40 seasons): JSON grows ≈ 220 KB / season (28.2 → 37.7 MB), almost entirely the append-only award registry (≈ 300 awards / season); the live population, chronicle (≤ 1,200), feuds (≤ 1,500 + one season), upsets (≤ 300), history (≤ 2,000) and retired archive (1,500–2,000 + legends) are bounded.

### Limits (honest)
- A simulated day touches ~30% of the population (ratings, games, h2h), so the hot columns and every h2h chunk change after each game: chunking cannot avoid rewriting ≈ 4 MB per post-game commit. Next step if needed: a per-row delta journal for h2h / hot columns, compacted periodically, or moving `prepare` to a worker.
- Post-game prep (~130 ms here) is main-thread work; on a phone expect 2–3× more.
- Backups and exports are whole-save JSON (~30 MB, ~5.5 MB gzipped); a backup is taken at most every 10 games / per season.
- The award registry grows without bound by design (permanent honours); at ~300 awards per season it adds ~0.2 MB per season.
