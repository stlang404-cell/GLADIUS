# Persistence (save format 2; layout v3 in GLADIUS v0.3, layout v4 in v0.4 — see the last two sections)

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

---

## v0.4: layout version 4 (journal, mirror, sliced commits, worker backups)

Goal: no long main-thread task when saving (target: no single task above ~50 ms), far fewer bytes per game, without giving up atomicity, recovery, backups, export/import or old saves.

Code: `src/persist/layout4.ts` (population layout v4: mirror, scan, journal, base parts, assembly), `src/persist/tj.ts` (tabular JSON), `src/persist/offload.ts` (backup container, export from the committed parts), `src/persist/persist.worker.ts` (module worker), `src/persist/save.ts` (commit pipeline, load, recovery), `src/persist/db.ts` (put batching). `src/persist/layout.ts` is unchanged and still reads (and, for tests, writes) layouts 2 and 3. Tests: `tests/persist.journal.test.ts` (new), `tests/migrate.v04.test.ts` (new, genuine v0.3 fixture), `tests/persist.split.test.ts` (updated to v4 semantics), `tests/persist.perf.test.ts` (rewritten).

### Profile of v0.3 (measured before changing anything)

Node CPU profiles of the post-game commit on the 25k world, plus headless Chromium with real IndexedDB:

- The whole commit preparation was **one synchronous task of ~110–150 ms**: the hot-column pass (17 passes over 26,700 objects through per-key getter closures), re-encoding every h2h chunk (2.7 MB, all 27 chunks change every day), re-serialising ~1.6 MB of cold / rh / warm chunks for the rolling verification, the cold / warm / rh signatures, JSON of 338 tournaments and 2.2 MB of world arrays, and checksums of the 4.7 MB written.
- After a reload it was worse than after a fresh start: **competitor objects assembled by the loader were in V8 dictionary mode** (more than ~16 properties added with keyed stores), so every property access — the simulation's and the next commit's — was 2–3× slower until the objects were recreated.
- In Chromium the IndexedDB put of ~4.7 MB is serialised in the same task, a backup (whole-save `JSON.stringify` + checksum + gzip) was a **650–700 ms task** every ~10 games, an export a 300–400 ms task, a load a 350–500 ms task.

### What changed

1. **Mirror + journal for the population.** The persistence layer keeps a mirror of what is persisted: hot fields as typed arrays indexed by competitor serial, h2h / rating-history words per serial (plus the h2h opponent id strings, so an unchanged list is recognised by identity without re-parsing ids), per-member signatures and content hashes for the JSON families. A full commit compares the live population with the mirror and writes one **journal part `jr/<gen>`** with only what differs: appended index entries, hot cells (rows shared by the columns that change a lot, `R`, or per-column rows), blob patches (`SET` / `SPLICE prefix,suffix,middle` / `DELETE` in Int32 words: an h2h result is usually one word) and family rows (tabular JSON). A day touches ~8,000 competitors; the journal is ~0.6–0.7 MB instead of ~4 MB of columns and chunks.
2. **Generation rule.** Every manifest entry records the generation `g` that wrote the part. On load the journals are applied in generation order, each only to base parts older than itself (journal `J` applies to base `B` iff `J > B`). A base rewritten after a journal is therefore never overwritten by it, and a journal is dropped once every base it touches is newer. Journals, bases and the manifest flip are still one IndexedDB transaction.
3. **Compaction.** When the live journals exceed 4 MB or 48 records (`persistTuning`), the commit folds them into new base parts instead of writing a journal: hot columns (dense by serial), h2h / rh chunks (Int32 `[serial, len, words…]`), and the cold / warm chunks the journals touched, plus chunks where more than half the stored members are no longer indexed. About one commit in ten compacts (~4.5 MB). Chunks with no indexed member are deleted; pruned competitors no longer force cold chunk rewrites (a chunk may hold stale members until it is next rebuilt).
4. **Encodings.** Rating histories are binary (Int32 pairs; a season sample is a 7-word `SPLICE`). Cold / warm chunks and the world arrays (awards, history, chronicle, feuds, …) are **tabular JSON** (`tj.ts`: key lists once per shape, dictionary columns for repeated strings; lossless, key order kept, plain JSON fallback): cold 15.9 → 7.6 MB, awards 2.3 → 1.1 MB (UTF-16 bytes). The award registry therefore grows about half as fast as in v0.3 (~0.11 MB / season instead of ~0.22 MB, estimated from the chunk sizes; not re-measured over 40 seasons). Change detection for arrays still compares plain JSON with the last written text (fast, exact); only changed chunks are re-encoded.
5. **Sliced preparation.** Commit preparation is a generator run in slices of `sliceMs` (8 ms) with `scheduler.yield()` (MessageChannel / `setTimeout` fallback) in between. Nothing in the tracker or mirror changes before the final synchronous section (apply the scan to the mirror, assemble puts and manifest), so a restart is free. **Mutation guard:** `noteMutation()` (called by the UI store on every `mutate`, `scheduleSave`, `setSave`) and every `persistSave` bump an epoch; if it moved during a yield, the preparation starts again on the latest state (merged with a waiting request). The cheap probe of world / player scalars is re-checked before the final section as a second guard. After two restarts the preparation runs without yielding, so a stream of edits cannot starve the save. Base parts for a compaction are built (sliced) as the mirror will be once the scan is applied.
6. **Put batching.** `commitOps` issues puts in ~1 MB batches, the next batch from the success callback of the previous one — same transaction, but the browser's structured-clone work is spread over several tasks.
7. **Worker.** Backups and exports no longer touch the live Save: `persist.worker.ts` (a Vite module worker) reads the committed generation (manifest + parts, one read-only transaction) and builds a **backup v3** (binary container of the parts — JSON as UTF-8, buffers as they are — gzip, checksum over the container) or the **export file** (unchanged format version 2: it assembles the Save from the parts and stringifies it there). `exportAll` first commits the live save. Without a usable worker (tests, very old browsers, a worker error) the same functions run inline; if that fails too, v0.3's JSON backup / live-object export is used.
8. **Load.** Reading, checksum verification, decoding and assembly are sliced. Competitors are rebuilt on a clone of a template with the creation-order keys, so they keep fast properties (and the same hidden classes as fresh ones) — this also speeds up the simulation after a reload. The mirror is filled from what was just read (warm verification baselines included); cold baselines are computed in background slices.
9. **Verification windows.** Hot columns, h2h, rating histories (exact comparison on the verification turn; first / last sample otherwise), world, tournaments and arrays are compared exactly on every full commit. Cold / warm records use signatures (now also the competitor's key count, so added / deleted fields are seen at once) plus a rolling content-hash verification: 1/16 of warm records and 1/64 of cold records per full commit (v0.3: 1/8 of chunks). An edit no signature can see (a value of an unknown field changed in place, a "never changes" cold field) is saved within 16 (warm) / 64 (cold) full commits.

### Layout v4 parts

`layoutSizes()` stays for v3; v4 manifests record `sizes: { cold: 250, warm: 100, h2h: 1024, rh: 1024, v: 4 }` and `g` in every part entry.

| Part | Contents |
|---|---|
| `meta`, `active`, `player`, `world`, `tour/index`, `tour/<id>` | as before (JSON) |
| `wa/<key>/index`, `wa/<key>/<n>` | world arrays, 128 per chunk, tabular JSON |
| `pop/index` | Int32 serials in array order (−1 = non-standard id) |
| `pop/odd` | competitors with non-standard ids, whole, JSON (normally absent); `pop/raw` if ids are not unique |
| `pop/hot/<key>` | 17 columns dense by serial (i8 / i16 / i32 / f64 + tags: null, not stored) |
| `pop/h2h/<n>`, `pop/rh/<n>` | Int32 `[serial, len, words…]`, 1,024 serials per chunk |
| `pop/cold/<n>`, `pop/warm/<n>` | `{ ids, t: tabular rows }`, 250 / 100 serials per chunk |
| `jr/<gen>` | journal: `{ k: 'jr', h: JSON header, b: ArrayBuffer[] }` (index appends, hot cells, blob ops, family rows) |

Backups: `slot0..2` now hold format 3 (`{ v: 3, enc: 'gzip', data, checksum, bytes, gen, season, games, … }`); format 2 (v0.3) and schema-1 backups are still listed, verified and restorable.

### Integrity (unchanged guarantees, new tests)

- One transaction per commit; journals and bases are ordinary parts under the manifest; old keys are deleted only after the new manifest. `tests/persist.journal.test.ts`: a crash after the first put of a journal commit and in the middle of a compaction both leave the previous generation loadable exactly, and the app carries on from it.
- Damaged base part under live journals → per-competitor repair from the backup (journal patches for a damaged chunk are not applied). Damaged journal → treated as structural (it may hold new index members): the newest backup is restored; without one the readable records are kept and the loss is reported; then healed.
- Randomised test: 60 rounds of edits of every kind the layout carries (simulated days, h2h / rating-history patches, non-encodable values, null / NaN / −0 / strings in hot fields, deleted fields, unknown fields, debuts, pruning, non-standard ids, style changes) with compactions every few commits and reloads every 6 rounds: exact canonical equality every time, no orphan records.
- Mutation guard test: edits during a sliced preparation (noted, and an un-noted world day caught by the probe) restart it; the committed save is the final state.
- Migration: `tests/migrate.v04.test.ts` uses `tests/fixtures/v03-layout.json.gz`, a genuine IndexedDB dump written by the v0.3 code (layout 3: positional hot columns, JSON cold / rh / warm, binary h2h; 413 competitors, 14 games, a game in progress) with a v0.3 format-2 backup and a v0.3 export file. It loads exactly; the first commit rewrites it in layout 4 with no orphan keys; a crash during that commit leaves the v0.3 save loadable; days later it reloads exactly; the v0.3 backup restores; the v0.3 export imports and a v0.4 export of it imports back identically. v0.2 saves keep loading through the same path (`tests/migrate.v03.test.ts`), schema-1 documents through `migrateLegacy`.

### Results: v0.3 vs v0.4 (same 25k world, measured)

World: `createWorld(4242)` + 3 seasons (26,700 competitors, 338 tournaments; 29.6 MB of JSON), 30 finished games (one crosses a season boundary). **Browser**: headless Chromium 153 (Playwright), real IndexedDB, production build of a bench page that drives `persistSave` exactly as the store does (`{ backup: true }` after each game); long tasks from `PerformanceObserver('longtask')` (≥ 50 ms). **Node**: Node 22 + fake-indexeddb (in-memory; wall times are a rough guide only). Machine: shared 4-vCPU Xeon with other jobs running (load average 1.7–6.7 during the runs); two alternating runs per version, ranges shown. Expect lower numbers on a quiet desktop and 2–3× higher on a phone. "Bytes" counts JSON as UTF-16 (2 bytes per char) and binary as bytes, as in v0.2/v0.3.

| | v0.3 | v0.4 |
|---|---|---|
| Post-game commit: longest main-thread task (browser) | **108–113 ms** median (max 615–621), 1 long task per commit | **no task ≥ 50 ms**; longest slice 11.7–11.9 ms median (max 30–32) |
| Post-game commit: total main-thread preparation | browser 108–113 ms; Node 151–153 ms | browser 61–74 ms; Node 91 ms (in ~10–15 slices) |
| Post-game commit: written | 4,664 KB (every hot column + every h2h chunk + …) | 1,060 KB median, 1,386–1,500 KB mean incl. a compaction every ~10 games |
| Season-boundary commit | 5 long tasks, longest 667–692 ms; 28.9 MB written | no long task, longest slice 16–18 ms; 15.1 MB written (compaction; style drift touches ~2,000 cold records) |
| Commit that takes a backup (browser wall) | 1.36–1.47 s, long tasks up to 666–690 ms | 0.77–0.91 s, no long task (worker) |
| Backup snapshot | 1.30–1.34 s on the main thread, 5.68 MB gzip | 0.77–0.83 s in the worker (Node inline), 4.95 MB gzip |
| Export (browser) | 296–417 ms, one long task of the same length | 656–836 ms wall, no long task (worker; includes committing first) |
| Cold load (browser wall / longest task) | 428–500 ms / 348–403 ms task | 319–437 ms / no task ≥ 50 ms |
| Cold load (Node) | 555–722 ms | 467–486 ms |
| First commit after a load | 176–187 ms (one task) | 63–73 ms (sliced) |
| In-game move (light commit) | 0.8 ms | 0.7–0.8 ms |
| Stored size (sum of parts) | 37.6 MB (965 parts) | 21.2 MB (884 parts) after 30 games; 18.8 MB right after a rewrite |
| IndexedDB usage incl. backups (`navigator.storage.estimate`) | 24.9 MB | 22.1 MB |
| JS heap: loaded save + tracker / tracker alone (Node) | 121.9 MB / 18.6 MB | 85.9 MB / 21.9 MB (fast-mode objects are smaller; the mirror costs ~3 MB more than v0.3's string cache) |
| Full rewrite (restore / import / migration), Node | 390–400 ms wall, one task | 310–410 ms prep in slices, longest 28–54 ms |

Reproduce: `npx vitest run tests/persist.perf.test.ts` prints the Node figures for v0.4 and checks generous budgets (median longest slice < 60 ms, median written < 8% of the save, median light commit < 10 ms). The A/B scripts (Node bench and the Chromium bench page with a v0.3 copy of `src/persist` taken with `git show HEAD:…`) were run from a scratch directory; the method is the one described above.

### Limits (honest)

- Total main-thread work per post-game commit is still ~60–90 ms on this box (spread over ~10 slices): reading 26,700 competitors' hot fields, h2h lists and signatures has to happen on the main thread, because the live Save is there (a worker would need a copy of it, which costs more than the scan). On a phone expect 2–3×: still no long task, but more total CPU.
- A preparation that is restarted twice runs in one go (~60–100 ms). The guard relies on mutations going through the store (or `persistSave`); a mutation that bypasses both and changes nothing the probe sees, during a yield, could still produce a commit mixing two moments — the next commit fixes it.
- A compaction (about every 10 games, or at a season boundary) writes ~4.5–15 MB; the bytes are written in ~1 MB batches, but IndexedDB disk I/O is proportionally larger for that commit.
- Verification of edits the signatures cannot see is slower than in v0.3 (16 / 64 full commits instead of 8).
- Backups and exports are built from the *committed* save. Exports commit the live save first; if that commit fails, the live object is exported on the main thread as in v0.3.
- Import (`importAll`) still parses and checksums the file on the main thread (rare, user-initiated).
