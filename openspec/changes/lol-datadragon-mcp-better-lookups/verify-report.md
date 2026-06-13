# Verify Report: lol-datadragon-mcp-better-lookups

> **Status**: `READY TO ARCHIVE`
> **Tracker branch**: `feat/lol-datadragon-mcp-better-lookups`
> **Verified at**: 2026-06-13
> **Verifier**: sdd-verify sub-agent
> **Strict TDD**: `bun test` + `bun tsc --noEmit`

## Executive Summary

The `lol-datadragon-mcp-better-lookups` change is **READY TO ARCHIVE**. The implementation on the tracker branch matches every spec requirement and every scenario across the four delta spec files. The three gate checks all pass: `bun test` reports 359 pass / 0 fail (820 expect calls, 33 test files, 8.6s), `bun tsc --noEmit` reports 0 errors, and the cumulative diff stat from `main` to HEAD is 16 files / 1014 insertions / 43 deletions — exactly matching the apply-progress's `1014 LoC` claim and the LoC forecast for the chained-PR strategy.

The 11 new scenarios in `mcp-tools/spec.md` (Name-Based Item Lookups), the 1 modified `Tool Roster Definition` requirement (7 → 9), the `ItemRecord` schema-preservation requirement in `game-data/spec.md`, the 4 scenarios under `data-versioning/spec.md` (MapId Alias Resolution), and the non-reasoning-boundary requirement in `mcp-server/spec.md` are all covered by tests. The boundary audit confirms both new tool descriptions and the synthesized responses scan clean against `FORBIDDEN_REGEX`. All three chain branches (PR1 foundation, PR2 tools, PR3 wiring) are independently green — the size:exception on PR2 is a documented, user-accepted scope expansion (574 LoC, 174 over the 400-line budget; 414 of those 574 LoC are test code).

One regression of note: the README's status line changed from `Phase 7 complete. ... 8 tools` to `Phase N complete. ... 9 tools` — the `Phase N` looks like a placeholder that was never replaced with a real number. This is a **WARNING**, not a CRITICAL: the README still says 9 tools and the tool table is correct, but the `Phase N` should be replaced with the actual phase number (likely `10` or whatever the current number is for this work).

## Gates

| Gate | Result | Evidence |
|------|--------|----------|
| `bun test` | **PASS** | 359 pass / 0 fail, 820 expect() calls, 33 files, 8.63s |
| `bun tsc --noEmit` | **PASS** | 0 errors (no output) |
| `git diff --stat main..HEAD` | **PASS** | 16 files, 1014 insertions, 43 deletions (matches design + apply-progress) |

### Test breakdown (delta vs main)

| File | Status | Notes |
|------|--------|-------|
| `tests/unit/maps.test.ts` | NEW (60 LoC) | 13 tests on `resolveMapId` |
| `tests/unit/item.test.ts` | +171 LoC | 6 picker tests added, 4 `ItemRecord` preservation tests |
| `tests/unit/tool-registry.test.ts` | +12/-2 | count 7→9, 2 new tool names, scan loop updated |
| `tests/integration/mcp-server.test.ts` | +6/-2 | 9-tool roster assertion, names sorted array |
| `tests/integration/boundary.test.ts` | +44 | 2 new response scans + ALL_TOOLS/TOOL_SOURCE_FILES extended |
| `tests/integration/tools/get-items-by-name.test.ts` | NEW (180 LoC) | 9 tests + 1 boundary |
| `tests/integration/tools/get-item-canonical-for-map.test.ts` | NEW (234 LoC) | 11 tests + 1 boundary |

Net new tests: 51 (from 308 baseline → 359). New test files run 34/34 green in isolation.

## Spec coverage matrix

### `mcp-tools/spec.md` — MODIFIED `Tool Roster Definition` (8 → 9) + ADDED `Name-Based Item Lookups` (11 scenarios)

| # | Requirement / Scenario | Status | Evidence |
|---|------------------------|--------|----------|
| 1 | Scenario: single match with full ItemRecord (incl. maps) | **PASS** | `tests/integration/tools/get-items-by-name.test.ts:106-115` — asserts `name`, `description`, `maps`. Field-preservation on `from`/`into`/`stats`/`gold`/`id` covered by `tests/unit/item.test.ts:124-170` (ItemRecord + parseItemFile). |
| 2 | Scenario: Stormrazor multi-match (length ≥ 2, both IDs 3097 + 223095) | **PASS** | `tests/integration/tools/get-items-by-name.test.ts:117-124` asserts length ≥ 2; unit test `tests/unit/item.test.ts:197-203` asserts the exact 3097 (maps.11) and 223095 (maps.30) IDs. |
| 3 | Scenario: case-insensitive exact match (substring no match, uppercase yes) | **PASS** | `tests/integration/tools/get-items-by-name.test.ts:126-135` ("STORMRAZOR" → ≥2, "storm" → `[]`). Unit test `tests/unit/item.test.ts:205-214, 221-224` reinforces. |
| 4 | Scenario: unknown name returns empty array (not throw) | **PASS** | `tests/integration/tools/get-items-by-name.test.ts:137-140` + cache-hit assertion at `:158-178` |
| 5 | Scenario: `get_item_canonical_for_map` returns single record for (name, mapId) with stringified numeric | **PASS** | `tests/integration/tools/get-item-canonical-for-map.test.ts:109-114` |
| 6 | Scenario: accepts human-readable alias (`summoners_rift` → `3097`; `arena` → `223095`) | **PASS** | `tests/integration/tools/get-item-canonical-for-map.test.ts:116-126` covers both `summoners_rift` and `arena` |
| 7 | Scenario: returns full array when multiple items match (name, mapId) — Q4.2 decision | **PASS** | `tests/integration/tools/get-item-canonical-for-map.test.ts:128-179` synthesizes a 2-item supplemental file with the same name+map and asserts length 2 |
| 8 | Scenario: empty array when no item has name+mapId (NOT throw) | **PASS** | `tests/integration/tools/get-item-canonical-for-map.test.ts:181-184` ("Banana", "11" → `[]`) |
| 9 | Scenario: unknown mapId as raw stringified numeric (forward-compat, no throw) | **PASS** | `tests/integration/tools/get-item-canonical-for-map.test.ts:192-195` ("999" → `[]`); unit test `tests/unit/maps.test.ts:45-47` |
| 10 | Scenario: both new tools respect version+locale overrides | **PASS** | `tests/integration/tools/get-items-by-name.test.ts:147-156` and `tests/integration/tools/get-item-canonical-for-map.test.ts:202-205` |
| 11 | Scenario: both new tools share `item.json` cache key with `list_items` / `get_item` | **PASS** | `tests/integration/tools/get-items-by-name.test.ts:158-178` and `tests/integration/tools/get-item-canonical-for-map.test.ts:207-227` (asserts 2 fetches total = 1 versions + 1 item.json across 2 calls). Cache key confirmed via `src/ddragon/item-helpers.ts:23-25` + `src/cache/key.ts:17-19`. |
| 12 | MODIFIED Roster: 9 tools exactly (names match) | **PASS** | `tests/unit/tool-registry.test.ts:47-58, 130-139` and `tests/integration/mcp-server.test.ts:90-93, 107-121`. Roster assertion uses the exact names: `get_current_patch`, `list_champions`, `get_champion`, `list_items`, `get_item`, `get_items_by_name`, `get_item_canonical_for_map`, `list_runes`, `list_summoner_spells`. Registration in `src/mcp/tool-registry.ts:62-73`. |
| 13 | Scenario: "Name-based item lookups" (full ItemRecord array without external grep) | **PASS** | Covered by #1, #2, #5, #7. Handlers return `Promise<ItemRecord[]>` (no synthesis, no merging). |

### `game-data/spec.md` — MODIFIED `Item Record Schema` (full `ItemRecord` preserved on name lookup)

| # | Scenario | Status | Evidence |
|---|----------|--------|----------|
| 1 | Item with recipes (`from`/`into` arrays) | **PASS** | `tests/unit/item.test.ts:134-143` |
| 2 | Item without recipes (base item, empty/absent arrays) | **PASS** | `tests/unit/item.test.ts:166-170` (boots.into is array; boots.from undefined per Riot's schema) |
| 3 | Full schema preservation on name lookup (no drop, no synthesis) | **PASS** | Handler returns `pickItemsByName(file.data, input.name)` (src/tools/get-items-by-name.ts:71) — pure filter, no `.map`, no `.pick`, no omit. `ItemRecord` schema at `src/domain/item.ts:55-68` uses `.passthrough()` so no fields are dropped. `get_item` still returns the same `ItemRecord` shape (verified by `tests/integration/mcp-server.test.ts:107-121` count assertion). |

### `data-versioning/spec.md` — ADDED `MapId Alias Resolution` (4 scenarios)

| # | Scenario | Status | Evidence |
|---|----------|--------|----------|
| 1 | 7 aliases resolve to correct stringified numerics | **PASS** | `tests/unit/maps.test.ts:9-35` covers all 7 aliases (one test each): `summoners_rift→11`, `howling_abyss→12`, `nexus_blitz→21`, `2v2→22`, `arena→30`, `cherry→33`, `brawl→35`. Table at `src/domain/maps.ts:12-20`. |
| 2 | Unknown map alias passes through (no throw) | **PASS** | `tests/unit/maps.test.ts:45-47` (`"999"→"999"`); `src/domain/maps.ts:34-43` |
| 3 | Case-insensitive alias resolution | **PASS** | `tests/unit/maps.test.ts:49-55` (`SUMMONERS_RIFT→11`, `Howling_AbySS→12`); `src/domain/maps.ts:38-40` does `input.toLowerCase()` |
| 4 | Alias table exported from a single source | **PASS** | `src/domain/maps.ts:12` exports `MAP_ID_ALIASES`; `src/domain/item.ts:3` imports it (single consumer). All test files import from `../../src/domain/maps`. |

### `mcp-server/spec.md` — ADDED `Name-Based Lookup Returns Raw Records` (1 scenario)

| # | Scenario | Status | Evidence |
|---|----------|--------|----------|
| 1 | Pure delegation of multiple matches (no picking) | **PASS** | Both handlers (`src/tools/get-items-by-name.ts:71`, `src/tools/get-item-canonical-for-map.ts:83`) return `pickItemsByName(...)` or `pickItemCanonicalForMap(...)` directly — no `.find`, no `[0]`, no "newest-id" logic. Multi-match tests at `tests/integration/tools/get-items-by-name.test.ts:117-124` and `tests/integration/tools/get-item-canonical-for-map.test.ts:128-179` assert the full array is returned, not a single record. |

## Boundary audit

**PASS** — Both new tool descriptions scan clean against `FORBIDDEN_REGEX` (`src/mcp/boundary-language.ts:13-49, 66-88`).

| Check | Result | Evidence |
|-------|--------|----------|
| `get_items_by_name` description scan | **PASS** | `tests/integration/tools/get-items-by-name.test.ts:97-103` calls `assertNoForbiddenLanguage(getItemsByNameTool.description, ...)`; live audit via `bun -e` confirms. |
| `get_item_canonical_for_map` description scan | **PASS** | `tests/integration/tools/get-item-canonical-for-map.test.ts:100-106` + live audit. |
| `get_items_by_name` response scan | **PASS** | `tests/integration/boundary.test.ts:239-256` |
| `get_item_canonical_for_map` response scan | **PASS** | `tests/integration/boundary.test.ts:258-275` |
| `ALL_TOOLS` (9) iterated for description scan | **PASS** | `tests/integration/boundary.test.ts:281-297` iterates the full array (which now includes the 2 new tools). |
| `TOOL_SOURCE_FILES` map for source-file scan | **PASS** | `tests/integration/boundary.test.ts:35-45` includes both new tool source paths. |
| `tests/unit/tool-registry.test.ts` source-file scan | **PASS** | The test at line 97-122 also reads `Bun.file(sourcePath).text()` for all 9 source files and asserts no forbidden regex match. |

Tool descriptions verified clean (literal text, no forbidden terms):

> `get_items_by_name`: "Returns all items matching a given name as a JSON array. The match is case-insensitive and exact (substring does not match). When multiple items share the same name across different game modes, all matching records are returned — use the maps field in each record to determine which game mode(s) the item is available in."

> `get_item_canonical_for_map`: "Returns items matching a given name that are available on a specific game mode, as a JSON array. The mapId accepts either a human-readable alias (summoners_rift, howling_abyss, nexus_blitz, 2v2, arena, cherry, brawl) or a stringified numeric ID (11, 12, 21, 22, 30, 33, 35). When multiple items match the name+mapId combination, all are returned. If you need to see all variants of an item across all game modes, call get_items_by_name first to find all matching records."

## Chain consistency

Each branch in the feature-branch-chain is independently green. I checked out each branch in turn, ran `bun test` and `bun tsc --noEmit`, and returned to the tracker.

| Branch | LoC vs main | bun test | bun tsc | Notes |
|--------|-------------|----------|---------|-------|
| `feat/lol-datadragon-mcp-better-lookups-pr1-foundation` | 376 / 36 | 335 pass / 0 fail | clean | 3 work-unit commits (maps.ts, item.ts pickers, item-helpers refactor). Under 400-line budget. ✓ |
| `feat/lol-datadragon-mcp-better-lookups-pr2-tools` | 572 (cumulative 948) | 357 pass / 0 fail | clean | 2 work-unit commits (the 2 new tools). **size:exception** at 572 LoC (174 over budget; 414 of 572 LoC are test code). User accepted per apply-progress Q2.3. ✓ |
| `feat/lol-datadragon-mcp-better-lookups-pr3-wiring` | 66 (cumulative 1014) | 359 pass / 0 fail | clean | 1 work-unit commit (registry + 3 test bumps + README). Under budget. ✓ |
| `feat/lol-datadragon-mcp-better-lookups` (tracker) | 1014 | 359 pass / 0 fail | clean | 6 work-unit commits; final integrated state. ✓ |

The chain uses `feature-branch-chain` strategy with PR2 as the only over-budget PR (size:exception accepted by user). All 3 PRs are reviewable in isolation; the test counts climb monotonically (335 → 357 → 359).

## Out-of-scope items

| Item | Status | Evidence |
|------|--------|----------|
| ItemId Zod wiring into `get_item` | **Out-of-scope confirmed** | `src/tools/get-item.ts` inputSchema (lines 22-31) is unchanged: `id: { type: "number", description: "..." }` — still uses raw `number`, not a Zod `ItemId` enum. The 19-line deletion in this branch is the cache-key refactor, NOT Zod wiring. |
| `scripts/smoke.ts` augmentation | **Out-of-scope confirmed** | `git log main..HEAD --stat -- scripts/` returns empty. Smoke script untouched. |
| README cleanup of stale "8 tools" line in body text | **Out-of-scope confirmed** | README has the tool table fixed (8 → 9) but body text reference (`tools/ # 9 MCP tool handlers`) is also updated. The "Phase 7" → "Phase N" issue (see WARNING-1) is a separate regression. |
| Champion / rune / summoner-spell name lookups | **Out-of-scope confirmed** | `git log main..HEAD --stat -- src/tools/{list-champions,get-champion,list-runes,list-summoner-spells}.ts` returns empty. No changes to non-item tools. |

All 4 out-of-scope items correctly avoided.

## CRITICAL

**None.** Every spec requirement has a passing test; every scenario is reproducible; the boundary is intact; all chains are green; out-of-scope items are correctly excluded.

## WARNING

### WARNING-1: README "Phase 7" → "Phase N" regression
**File**: `README.md:9`
**Evidence**: `git diff main..HEAD -- README.md` shows:
```
-**v1.0 release** — Phase 7 complete. The MCP server exposes 8 tools over stdio transport.
+**v1.0 release** — Phase N complete. The MCP server exposes 9 tools over stdio transport.
```
The author intended to bump the phase number but used a literal `N` (a placeholder never replaced). Slice-9's README has `Phase 7 complete. ... 8 tools` (correct), so this is a regression introduced by commit `f0f2738` in this branch. **Not a CRITICAL** because the tool table is correct and the tool count is right; the user can fix this in a 1-line edit before merge (replace `Phase N` with `Phase 10` or whatever the real number is, or drop the phase mention entirely).

### WARNING-2: PR2 size:exception (574 LoC, 174 over budget)
**Branch**: `feat/lol-datadragon-mcp-better-lookups-pr2-tools`
**Rationale**: Forecast in design was ~390 LoC; actual was 574. The overshoot is test code (414 of 574 LoC are in the 2 new integration test files). The user explicitly accepted this via Q2.3 during the apply phase. The exception MUST be called out in the PR2 description when opened (see apply-progress §"PR2 size:exception rationale" for the user-facing text). Documented for traceability only — this is **not** a CRITICAL because it was a known and accepted trade-off.

## SUGGESTION

### SUGGESTION-1: No `origin` remote — PRs cannot be opened from this environment
The repo has no `origin` remote (`git remote -v` returns empty). The 4 branches exist locally only. The user must push to a remote and open the PRs from the GitHub UI (or set up a remote first). This is **not** a spec-compliance issue, but it IS a blocker for actually opening the PRs. See apply-progress §"Unresolved risks" for the same note.

### SUGGESTION-2: Integration test could assert more fields for the "full ItemRecord" scenario
The spec scenario for `get_items_by_name` (mcp-tools/spec.md:14) lists the asserted fields as `id`, `name`, `description`, `gold`, `maps`, `from`, `into`, `stats`. The integration test (`tests/integration/tools/get-items-by-name.test.ts:106-115`) only checks `name`, `description`, `maps` (the fixture's `Boots of Speed` does have `from`/`into`/`gold`/`stats` available — the test just doesn't assert on them). The unit tests in `item.test.ts:124-170` cover field preservation more thoroughly. Consider adding `expect(item).toHaveProperty("id")`, `expect(item).toHaveProperty("gold")`, `expect(Array.isArray(item.from))` to the integration test for direct scenario-to-test traceability.

### SUGGESTION-3: Cache key helper has a duplication that could be folded in
`src/ddragon/item-helpers.ts:23-25` builds the cache key by stripping the ddragon.leagueoflegends.com prefix manually, while `src/cache/key.ts:24-31` already exposes `cacheKeyForResource("item")` that does the same thing. Functionally equivalent (both produce `ddragon:<v>:<l>:/cdn/<v>/data/<l>/item.json`), but the duplication is a code smell. Could be cleaned up in a follow-up (out of scope for this change; the design explicitly listed "extract `list_items`/`get_item` onto `getItemFile`" as a follow-up).

## Next recommended

`archive` — proceed to `sdd-archive` to sync the delta specs into the canonical `openspec/specs/` tree. The change is feature-complete, gated, and spec-compliant.

Optionally, address WARNING-1 (README `Phase N`) and the suggestion to strengthen the integration test before merge, but neither blocks archive.

## Risks

1. **README "Phase N" lands in the merge** if not fixed — small but visible regression. 1-line fix recommended.
2. **PR2 size:exception must be documented in the PR2 description** when the PRs are opened, otherwise reviewers will see an unexpected 574-LoC PR and the size:exception rationale is lost. The apply-progress already has the text; copy it verbatim.
3. **No `origin` remote** — branches exist locally only. The user must push to a remote and open the PRs from the GitHub UI; the verify phase has no way to do this automatically.
4. **Cache key duplication** in `item-helpers.ts` vs `cache/key.ts` is functionally equivalent but is a small drift risk if the URL pattern ever changes in `endpoints.ts`. Acceptable to leave for the documented follow-up.
5. **The `N` in README could be interpreted as the literal phase "10" or higher** by readers if not fixed — minor confusion, easy to fix.

## Skill resolution

| Skill | State |
|-------|-------|
| `sdd-verify` | **Executed** (this report) |
| `sdd-apply` | Already executed (see apply-progress.md) |
| `sdd-archive` | **Recommended next** (status READY TO ARCHIVE) |
