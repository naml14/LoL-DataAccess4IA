# Exploration: lol-datadragon-mcp-better-lookups

> **Status**: `ok`
> **Change name proposed**: `lol-datadragon-mcp-better-lookups`
> **Related prior change**: `lol-datadragon-mcp` (archived `2026-06-11-lol-datadragon-mcp`)

## Executive Summary

The archived v1.0 MCP server ships 8 tools that fetch from Riot's static Data Dragon CDN as a pure data layer. Items are the only resource where Riot ships the same item under multiple IDs (one canonical, several map-specific duplicates) because the `item.json` payload has a `maps: Record<string, boolean>` field per item. Live verification against `get_item(223095)` (Arena) and `get_item(3097)` (SR) confirms the user's report: identical `name: "Stormrazor"`, different `maps.30` vs `maps.11`, different stats/recipes, and an extra `Energized stacks twice as fast in Arena` description on the Arena version. Champions, runes, and summoner spells do NOT have a `maps` field in Data Dragon (verified by grep across all 5 fixtures) — the duplication problem is **items-only**. The current `get_item` only accepts a numeric `id` and returns one record; `list_items` returns a compact shape (no `maps`, no `id`, no `description`) that forces the user to either (a) re-fetch the full file via `get_item` per candidate, or (b) write their own grep outside the MCP. The minimal correct fix is a new `get_items_by_name(name)` tool that returns the full records (including `maps`) for every name match. A slightly broader option also adds a `get_item_canonical_for_map(name, map)` helper that returns the one item with `maps[<map>]: true`, abstracting the disambiguation entirely.

## Current State of MCP

### Tool surface (8 tools)
| Tool | File | Lookup input | Output |
|------|------|--------------|--------|
| `get_current_patch` | `src/tools/get-current-patch.ts` | _(none)_ | `{ version, resolved_at }` |
| `list_champions` | `src/tools/list-champions.ts` | _(version, locale)_ | `CompactChampion[]` (id, key, name, title, tags, blurb — no `maps`, no `id` numeric key) |
| `get_champion` | `src/tools/get-champion.ts` | `idOrKey` (id string OR numeric key string) | full `ChampionRecord` (uses `pickChampion` + shared `getChampionFile` cache) |
| `list_items` | `src/tools/list-items.ts` | _(version, locale)_ | `CompactItem[]` (**no `maps`, no numeric `id`, no `description`, no `from/into`, no `stats`** — just name, plaintext, gold, tags, image) |
| `get_item` | `src/tools/get-item.ts` | `id` (number) | full `ItemRecord` |
| `list_runes` | `src/tools/list-runes.ts` | _(version, locale)_ | full `RuneTree[]` (no `maps` field in domain) |
| `list_summoner_spells` | `src/tools/list-summoner-spells.ts` | _(version, locale)_ | `CompactSummonerSpell[]` |
| `get_profile_icons` | _(not in tool-registry; archived slice 9 removed it)_ | — | — |

The README still lists 8 tools but `tool-registry.ts` only registers 7 (slice 9 removed `get_profile_icons` and the README is stale — separate issue, out of scope here).

### Schemas
- `src/domain/item.ts` already declares `maps: z.record(z.string(), z.boolean()).optional()` on `ItemRecord` (line 65) and uses `.passthrough()` to keep other Riot fields. Confirmed against live data: keys are stringified numeric map IDs (`"11"`, `"30"`, etc.).
- `src/domain/champion.ts`, `rune.ts`, `summoner.ts` have **no** `maps` field. Champion data includes per-champion numeric `key` (e.g. `"103"`) and string `id` (e.g. `"Ahri"`), but there are no map-specific duplicates — confirmed by grep across `fixtures/ddragon/16.12.1/{champion,summoner,runesReforged}.json` (zero matches for `"maps"`).
- `src/domain/shared.ts` already exports `ItemId` (positive int Zod) and `ChampionId` (alphanumeric regex). The ItemId validator is defined but **not currently used** in the runtime path of `get-item.ts` (the input is typed as `number` directly).

### Cache strategy
- `src/cache/key.ts` defines `cacheKey(version, locale, path)` → `ddragon:<v>:<l>:<path>` and a session-namespaced `resolvedVersionCacheKey()`.
- `src/cache/tiered.ts` is a two-tier wrapper (memory → disk), wired in `src/mcp/server.ts:60`.
- Per-tool `list_*` and `get_*` both fetch the same full CDN file (e.g. `item.json` ~830KB) and cache at the same key. The shared `getChampionFile(version, locale, client, cache)` helper in `src/ddragon/champion-helpers.ts` solved a prior cache-shape collision for champions; items do not have the equivalent shared helper, so `list_items` and `get_item` independently do their own cache.get/parse. This is fine for items because the cached value (`ItemFile`) is the full shape, not a compacted list — so a follow-up `get_item` reuses the same cached value as a `list_items` call would.
- TTL is 900s default, controlled by `LOL_DD_TTL_SECONDS` env (range 60–86400).

### Non-reasoning boundary
- Enforced via `src/mcp/boundary-language.ts` (`FORBIDDEN_WORDS` + `assertNoForbiddenLanguage`). 327 tests pass. Description strings and tool response data are scanned.
- The "data-only" contract means the new `get_items_by_name` MUST return the raw `ItemRecord` shape (preserving `maps`, `from`, `into`, `stats`, `description`) — it MUST NOT synthesize a "canonical" record by picking one map variant or merging fields. Disambiguation helpers are allowed only if they are pure delegations (return one of the underlying records unchanged, no derived `idForSR` field).

### File layout (relevant)
```
src/tools/             7 tool handlers, 1 ctx helper
src/domain/            Zod schemas (item, champion, rune, summoner, shared)
src/ddragon/           client (HTTP+retry+CB), versions, endpoints, champion-helpers
src/cache/             memory, disk, tiered, key
src/mcp/               server, tool-registry, errors, boundary-language
tests/integration/tools/  7 tool tests (one per registered tool)
tests/unit/            domain, cache, client, versions, config, boundary
fixtures/ddragon/16.12.1/  5 files: champion.json, item.json, profileicon.json, runesReforged.json, summoner.json
```

## User limitations mapped to MCP surface

| # | User limitation | Affected tool(s) | Current workaround | Proper fix |
|---|-----------------|-------------------|---------------------|------------|
| 1 | `get_item(id)` only accepts one ID; no name lookup | `get_item`, `list_items` | User calls `list_items()` (returns ~125KB compact, no `id` or `maps`), then `get_item(id)` for each candidate — requires external grep, then probes IDs until `maps.11: true`. Workflow is 3+ tool calls. | Add a name-based lookup tool that returns all full records whose `name` matches (case-insensitive, exact-match by default with optional `fuzzy?` later). |
| 2 | Items duplicated per map (Stormrazor 223095 vs 3097 etc.) | `get_item` returns one record | User has no way to discover duplicates from the MCP — must guess IDs or rely on external knowledge. | Surface the duplication natively: the new lookup returns the full set; the LLM can pick via the returned `maps` field. Optionally a dedicated `get_item_canonical_for_map(name, map)` helper. |
| 3 | `list_items()` returns 706 items (~125KB), grep is required | `list_items` | The compact shape (`CompactItem`: name, plaintext, gold, tags, image) is already smaller than the raw file, but the user wants to **find by name**, not enumerate. | Two options: (a) add a `name` query param to `list_items` (server-side filter), or (b) add a separate `get_items_by_name(name)` that returns the matching full records. (b) is preferred because it returns the full record, not the compact. |
| 4 | No programmatic way to know the canonical SR ID for a duplicated item | `get_item`, no map-aware tool | User must probe IDs and check `maps.11` manually. | Add `get_item_canonical_for_map(name, map)` (or `(name, mapId)`) that filters by name then returns the unique record with `maps[<map>]: true`, or returns an `ambiguous`/`none` envelope if multiple/none match. |
| 5 | Recommended workflow: list → grep → get_item for each → verify | All of the above | Currently manual + external. | Encapsulate steps 1, 4, and 5 in one or two new tools; the LLM just asks "give me the Stormrazor for Summoner's Rift". |

## Scope options

### Option A — Minimal: `get_items_by_name(name)` only
- **New tools**: 1 — `get_items_by_name({ name: string, version?, locale? })`
- **Output**: `ItemRecord[]` (full shape with `maps`, `from`, `into`, `stats`, `description`)
- **Behavior**: case-insensitive exact match against `item.name`. If zero matches → `ItemNotFoundError` (reuse existing error class with a `name` variant or generalize to `not-found` with the query in the message). Multiple matches returned as-is (the LLM picks via `maps`).
- **Breaking changes**: none (purely additive).
- **LoC estimate**: ~80–120 LoC (handler + Zod refactor of `ItemNotFoundError` to take a query, integration test, unit test for the name-pick helper, README + tool registry update, optional fixture augmentation in `item.test.ts`).
- **Risks**: low. No cache key changes. No domain schema changes. Test count delta: +1 tool in `tool-registry.test.ts`, +6–8 tests in new `tests/integration/tools/get-items-by-name.test.ts`, +3–5 unit tests in `tests/unit/item.test.ts` for the `pickItemsByName` helper.
- **Review budget**: ~150 LoC total — well under the 400-line budget. Single PR. **No chained PR needed.**

### Option B — Broader: name-based lookups for all resources with name fields
- **New tools**: 3 — `get_items_by_name`, `get_champions_by_name`, `get_summoner_spells_by_name` (or, for champions, reuse `get_champion` with a relaxed input that accepts partial names — but champions already have id-or-key lookup, and there is no "duplicates per map" problem for them, so the value is low)
- **Output**: same shape as the resource's `get_*` tool returns
- **Breaking changes**: none
- **LoC estimate**: ~250–350 LoC (3 handlers + 3 test files + shared `pickByName` helper in `src/domain/shared.ts`)
- **Risks**: low–medium. The champion name lookup overlaps with existing `get_champion(idOrKey)`; calling the new one with an id would behave identically. Need to be explicit in description that this returns an array even if 1 match. Runes are tree-organized, not name-flat; skip runes from this option. **Champions are unlikely to need this** because there are no duplicates; the value is mostly cosmetic (full record from name string vs from id).
- **Review budget**: ~300 LoC. Single PR possible, but **slightly tighter against the 400-line budget**. If we want margin for boundary tests + README updates, a chained PR is reasonable but not required.

### Option C — Deep: Option A + `get_item_canonical_for_map(name, map)` helper
- **New tools**: 2 — `get_items_by_name` and `get_item_canonical_for_map({ name, map, version?, locale? })`
- **Output**:
  - `get_items_by_name`: `ItemRecord[]`
  - `get_item_canonical_for_map`: `ItemRecord` (single) — returns the unique record where `maps[<map>]: true`; throws if zero or >1 match (with structured error)
- **Breaking changes**: none
- **LoC estimate**: ~200–280 LoC. Adds one Zod enum (or `z.string().regex(/^\d+$/)`) for the `map` arg, one new error class, ~6–10 tests.
- **Risks**: low. The `map` parameter needs careful doc — Riot map IDs are stringified numeric keys (`"11"` = Summoner's Rift Classic, `"12"` = Aram, `"21"` = Nexus Blitz, `"22"` = 2v2, `"30"` = Arena, `"33"` = Cherry 2v2, `"35"` = Brawl). The tool description should list them so the LLM can pick without external lookup. Risk: an LLM might call this when it actually wants the full set (option A). The description MUST clarify "returns the one record playable in the given map; use `get_items_by_name` first if you're not sure which ID is canonical". A few extra integration tests cover the enum/ambiguous case.
- **Review budget**: ~280 LoC. Single PR.

### Recommendation: **Option C** (option A + canonical-for-map helper)

Reasoning:
- It directly addresses the user's stated pain ("must probe IDs until finding `maps.11: true`") without making the LLM do that work in its own context.
- The map-aware helper is a pure delegation over the same data `get_items_by_name` returns — no derived fields, no `best`/`tier` language, fully inside the non-reasoning boundary.
- It mirrors the natural LLM question: "give me the SR Stormrazor". The two-tool combo keeps `get_item(id)` for the case where the LLM already knows the ID.
- LoC budget: ~280 LoC, single PR, low risk. Fits the `auto-forecast` delivery strategy with no chained PRs needed.
- The change is also forward-compatible: if Data Dragon later introduces map-specific duplicate champions (it doesn't today, verified), the same helper applies with a new resource.

If the orchestrator wants the absolute minimal first slice, **Option A is the safe choice** and Option C's helper can be a follow-up change.

## Affected areas

| Path | Why |
|------|-----|
| `src/tools/get-items-by-name.ts` (new) | New tool handler. Reuses `getItemFile`-style pattern (read `item.json` from cache, parse, filter). |
| `src/tools/get-item-canonical-for-map.ts` (new, Option C only) | New tool handler. Calls `get_items_by_name` internally, filters by `maps[<map>]`. |
| `src/mcp/tool-registry.ts` (lines 57–69) | Register new tool(s). Currently registers 7 tools; adding 1 → 8 (Option A) or 2 → 9 (Option C). |
| `src/domain/item.ts` (line 65) | `ItemRecord` already has `maps` — no change. The `ItemId` validator from `shared.ts` is already defined but unused. |
| `src/domain/shared.ts` (line 62) | May add a `MapId` enum/zod for the canonical map IDs (`"11"`, `"12"`, `"21"`, `"22"`, `"30"`, `"33"`, `"35"`) to validate `get_item_canonical_for_map`'s input. |
| `src/mcp/errors.ts` (line 47–145) | May need a new error code (e.g. `multiple-canonical-matches` or reuse `ambiguous` for "more than one item matches name + map"; `not-found` for zero matches). |
| `tests/integration/tools/get-items-by-name.test.ts` (new) | Mirror `get-item.test.ts` structure: fixture, fetch mock, success/multi/not-found/version-override/locale-override/cache-hit tests, plus 1 boundary test on description. |
| `tests/integration/tools/get-item-canonical-for-map.test.ts` (new, Option C only) | success/not-found/ambiguous/version-override. |
| `tests/unit/item.test.ts` | Add tests for the `pickItemsByName` and `pickItemCanonicalForMap` pure helpers (extracted to `src/domain/item.ts`). |
| `tests/unit/tool-registry.test.ts` (line 45–49) | Bump expected tool count from 7 (or 8 if we restore `get_profile_icons`) to 8/9. **Note**: current state is 7 (per slice 9) but README says 8 — independent inconsistency, not for this change to fix. |
| `tests/integration/boundary.test.ts` (line 130–286) | Add a per-tool boundary response scan for the new tool. Already uses `assertNoForbiddenLanguage`. |
| `scripts/smoke.ts` (line 152–198) | Optionally add new tool(s) to the offline smoke. README § Roadmap and existing `WARNING-8` deferred flag suggest we should also fold `list_items`/`get_item` into smoke — independent cleanup. |
| `README.md` (line 53–62) | Update tool table: add `get_items_by_name` and (Option C) `get_item_canonical_for_map`. Bump tool count. |
| `openspec/specs/mcp-tools/spec.md` | Add scenarios for the new tool(s) under Requirement "Tool Roster Definition" and a new requirement "Name-Based Lookups" (with scenarios: name match, multiple matches, no match, case-insensitive, map filter). |
| `openspec/specs/game-data/spec.md` | Optionally add a scenario for `maps` field preservation (already implicitly covered by `tests/unit/item.test.ts:117-122`). |

## Open questions

1. **Fuzzy vs exact name match.** The user wrote "name filter" and "grep by name". Should the new tool do exact match (e.g. `"Stormrazor"`), case-insensitive exact match (e.g. `"stormrazor"` works), or substring match (e.g. `"Storm"` matches "Stormrazor")? Recommendation: case-insensitive exact match for v1 (lowest risk, deterministic, easy to test). Substring can be a follow-up. **The user should be asked.**
2. **Map IDs for `get_item_canonical_for_map` (Option C).** Riot uses stringified numeric map IDs (`"11"` SR, `"12"` ARAM, `"30"` Arena, etc.). The tool should accept a string (`"11"`) — but should the LLM pass the numeric key as a string, or should we expose human-readable aliases (`"summoners_rift"`, `"arena"`, `"aram"`)? Recommendation: accept both — primary input is a stringified numeric (matches Riot's `maps` field exactly), optional `mapName` for human-readable convenience. **Should be asked.**
3. **Multiple-canonical-matches error semantics.** If two items have `name: "X"` and both have `maps.11: true` (rare but possible — e.g. an old + reworked item both shipped), should the tool return both, throw `ambiguous`, or pick the higher-id (newer)? Recommendation: throw `ambiguous` with the list of candidate IDs in the error `data` field — same pattern as `ChampionAmbiguousError`. No silent pick.
4. **Should `list_items` also gain a `name` filter parameter (Option A variant)?** This is a smaller, more surgical change. The trade-off: it complicates the tool's contract (the name field collides with item `name`) but saves a tool registration. Recommendation: keep `list_items` as-is and add the new tool — cleaner separation, follows the existing `get_champion` / `list_champions` split. **Worth flagging to the user.**
5. **Version of the change folder name.** The proposed name `lol-datadragon-mcp-better-lookups` is descriptive. Past change names use `lol-datadragon-mcp-slice-N` style; the new naming convention from slice 9 is `lol-datadragon-mcp-<topic>` (e.g. `lol-datadragon-mcp-better-lookups`). No existing branch or folder has this name. Keep as proposed unless the user wants something shorter like `lol-datadragon-mcp-name-lookups`.

## Risks

- **LoC budget underestimation.** The 280-LoC estimate for Option C is the implementation + tests + README + spec. The 400-line review budget is per the sdd-phase-common §E. If the canonical-for-map helper's test fixture needs multi-map mocking, it could grow. Mitigation: keep helper code minimal, reuse `MemoryCache` fixtures.
- **Boundary test regression risk.** Adding a new tool means the boundary test must scan it. The current `boundary.test.ts` already uses `assertNoForbiddenLanguage` and walks the registered tool list — verify the test iterates `tool-registry.listTools()` and not a hard-coded count, or update both. Risk: low.
- **Cache shape drift.** `get_items_by_name` and `get_item_canonical_for_map` will share the `item.json` cache key with `list_items` and `get_item` — that's fine because all four read the same `ItemFile` shape. The `get_items_by_name` handler MUST NOT cache a custom shape at a different key. Risk: low if we centralize on a `getItemFile` helper (mirroring the `getChampionFile` pattern from `src/ddragon/champion-helpers.ts`).
- **`ItemId` Zod validator never wired in.** Currently `get-item.ts` types the input as `{ id: number }` but never validates. If we add a new tool that takes `name` strings, we should also tighten `get_item`'s input through the Zod `InputSchema` (currently a plain JSON-Schema object, not parsed). This is a minor consistency issue, not blocking, but it would be cheap to fix alongside.
- **Riot schema change for `maps`.** The `maps` field has been stable since 2014 and uses stringified numeric map IDs. If Riot adds or removes map IDs, the `get_item_canonical_for_map` tool's `MapId` Zod enum would need updating. Mitigation: accept any string (per Riot's permissive schema) and document the common ones in the tool description, instead of a strict enum.
- **LLM misuse of `get_item_canonical_for_map`.** The helper picks ONE record; if the LLM asks for the Arena version of an item that only exists on SR, it gets `not-found` — which is correct but may be confusing. Mitigation: tool description explicitly mentions "use `get_items_by_name` first if you're not sure which IDs are canonical".

## Skill resolution

- **paths-injected** — only `sdd-explore` was loaded, per the orchestrator's launch prompt. No additional skills were needed; the task is read-only investigation, and the necessary code/files were read directly with the `read`, `glob`, `grep`, `bash`, and MCP `lol-datadragon_*` tools.

## Next recommended

**`sdd-propose`** — the explore found a clean, bounded scope (Option A or Option C, ~150–280 LoC, single PR, no breaking changes, no domain schema changes required). The user should be asked the open questions above **before** the proposal is drafted, because the answers materially change the tool contracts.

If the user wants to skip the proposal phase and go straight to a recommendation, the default is **Option C with case-insensitive exact name match, stringified numeric map IDs, and `ambiguous` for multi-match** (see Open Questions 1–3 for the specific choices).
