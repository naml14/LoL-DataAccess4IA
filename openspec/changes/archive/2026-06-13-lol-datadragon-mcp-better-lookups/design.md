# Design: lol-datadragon-mcp-better-lookups

> **Status**: `ok`. LoC forecast ~390 at 400-line review-budget edge (mitigation in §6). Authoritative specs: `specs/{mcp-tools,game-data,data-versioning,mcp-server}/spec.md`.

## 1. Architecture Overview

Two new tools (`get_items_by_name`, `get_item_canonical_for_map`) sit on the **same** cached Data Dragon `item.json` payload that `list_items` and `get_item` already read. **Pure delegations** — no new fetch, cache key, domain schema, or error class. Work concentrates in one new helper (`getItemFile` in `src/ddragon/item-helpers.ts`) that centralizes the item-cache key (currently duplicated privately in `get-item.ts` and `list-items.ts`), plus two pure pickers in `src/domain/item.ts` backed by `resolveMapId` in `src/domain/maps.ts`.

**Spec ↔ proposal reconciliation (LOUD):** `mcp-tools/spec.md` mandates an **empty array** on zero matches, not a thrown `not-found`. The proposal's "extend `ItemNotFoundError`" is **dropped**; `src/mcp/errors.ts` is unchanged. **Non-Reasoning Boundary (LOUD):** both new tools return the raw `ItemRecord[]` from Data Dragon, preserving every field (`.passthrough()` schema). `pickItemCanonicalForMap` is a **pure filter** — no merge, no derive. Returning the full array on multi-match (Q4.2) is itself boundary-respecting. The 2 new tool descriptions + response data become scan inputs for `assertNoForbiddenLanguage` in `tests/integration/boundary.test.ts`.

## 2. Module / Folder Layout

| Path | Action |
|------|--------|
| `src/ddragon/item-helpers.ts` | NEW — `getItemFile` + `itemDataKey`, mirrors `champion-helpers.ts` |
| `src/domain/maps.ts` | NEW — `MAP_ID_ALIASES` + `resolveMapId`, pure |
| `src/domain/item.ts` | MOD — + `pickItemsByName`, + `pickItemCanonicalForMap` |
| `src/tools/get-items-by-name.ts` | NEW — handler |
| `src/tools/get-item-canonical-for-map.ts` | NEW — handler |
| `src/mcp/tool-registry.ts` | MOD — register 2 new tools (7 → 9) |
| `src/mcp/errors.ts` | UNCHANGED |
| `tests/unit/{item,tool-registry}.test.ts` | MOD — picker tests + 7→9 bumps |
| `tests/unit/maps.test.ts` | NEW — 4–6 `resolveMapId` tests |
| `tests/integration/mcp-server.test.ts` | MOD — 7→9 + 2 names (lines 92, 110–118) |
| `tests/integration/boundary.test.ts` | MOD — extend `ALL_TOOLS` + `TOOL_SOURCE_FILES`; +2 response scans |
| `tests/integration/tools/get-items-by-name.test.ts` | NEW — mirrors `get-item.test.ts` |
| `tests/integration/tools/get-item-canonical-for-map.test.ts` | NEW |

## 3. Resolved Open Questions

| # | Resolution |
|---|------------|
| Name match | Case-insensitive exact (Q2.2). Substring/fuzzy deferred. |
| Multi-match | Return full `ItemRecord[]` (Q4.2). NO `ambiguous` error. Differs from `ChampionAmbiguousError` — multi-match is normal, not an error. |
| `mapId` format | Both stringified numeric (`"11"`) and human alias (`"summoners_rift"`) accepted (Q3.3). Case-insensitive. Unknown → raw string. |
| Tool count | 9. Bump 7→9 in 3 test files (`tool-registry`, `mcp-server`, `boundary#ALL_TOOLS`). |
| Cache key | Single: `ddragon:<v>:<l>:/cdn/<v>/data/<l>/item.json` via `cacheKeyForResource("item")` from `src/cache/key.ts:24-31`. |
| `ItemNotFoundError` extension | **Dropped** — see §1. |
| `MapId` Zod enum | **Not introduced** — alias is a `Record`; input stays `z.string().min(1)`. |
| `ItemId` Zod wiring in `get_item` | Out of scope — pre-existing, separate follow-up. |

## 4. Data Flow & Contracts

`tools/call` → `ToolRegistry.dispatch` (unchanged) → `handler(input, ctx)` → `getItemFile(v, l, client, cache)` (cache.get → on miss: `client.getItemList` → `parseItemFile` → `cache.set`) → pure picker filter → return `ItemRecord[]` (length may be 0). `getItemFile` reuses `cacheKeyForResource("item")`. `src/domain/maps.ts` is a `Record<string,string>` with lowercase keys + `.toLowerCase()` at lookup (14 keys). Pickers in `src/domain/item.ts` are 3-line pure filters.

| Tool | Input (Zod) | Output | Throws |
|------|-------------|--------|--------|
| `get_items_by_name` | `{ name: z.string().min(1), version?, locale? }` | `ItemRecord[]` (raw) | network / timeout / http / circuit-open / parse / validation |
| `get_item_canonical_for_map` | `{ name: z.string().min(1), mapId: z.string().min(1), version?, locale? }` | `ItemRecord[]` filtered to `maps[resolved] === true` | same |

**MapId alias table** (7 entries, copy from proposal): `"11"`/`"summoners_rift"` (SR), `"12"`/`"howling_abyss"` (ARAM), `"21"`/`"nexus_blitz"` (NB), `"22"`/`"2v2"` (2v2 Project), `"30"`/`"arena"` (Arena), `"33"`/`"cherry"` (Cherry 2v2), `"35"`/`"brawl"` (Brawl). **Forward-compat rule:** unknown input (e.g. `"999"`) → raw stringified numeric, no throw.

**Tool descriptions** (scan-clean — written against `FORBIDDEN_WORDS` at `src/mcp/boundary-language.ts:13-49`): `get_items_by_name` leads with case-insensitive exact match and tells the LLM to disambiguate multi-map items via the returned `maps` field. `get_item_canonical_for_map` names the 7 supported aliases, accepts stringified-numeric form, and tells the LLM to "call `get_items_by_name` first" if disambiguation is needed.

## 5. Testing Strategy (Strict TDD)

**Unit** (no I/O): `tests/unit/item.test.ts` +6–10 picker tests (exact / case mismatch / no match→`[]` / Stormrazor multi-match → full array / preserves `maps`,`from`,`into`,`stats`,`description` / `pickItemCanonicalForMap` numeric / alias / case-insensitive / unknown mapId→`[]` / no `maps` → `[]` / multi-match same name+map → full array). `tests/unit/maps.test.ts` new 4–6 tests (known alias / known numeric / case-insensitive / unknown passthrough). `tests/unit/tool-registry.test.ts` bump 7→9; append 2 names to `EXPECTED_NAMES`, `toolSourceFiles`, `ALL_TOOLS`. `tests/integration/mcp-server.test.ts` bump 7→9 (lines 92 + 110–118); append 2 names.

**Integration** (in-process `McpServer`, fixture-driven): `tests/integration/tools/get-items-by-name.test.ts` new, mirrors `get-item.test.ts` (description-scan / single full record / Stormrazor multi-match / case-insensitive + substring-no-match / empty for unknown — NOT a throw / version+locale / cache-hit). `tests/integration/tools/get-item-canonical-for-map.test.ts` new (description-scan / numeric / alias / multi-match full array (Q4.2) / empty for no name+map — NOT a throw / unknown passthrough / case-insensitive / version+locale / cache-hit). `tests/integration/boundary.test.ts` extend `ALL_TOOLS` (lines 17–25) + `TOOL_SOURCE_FILES` (lines 31–39); +2 `boundary: <tool> response` tests. Description-scan loop (line 240) iterates `ALL_TOOLS` dynamically — no body edit needed. **Live smoke** — `scripts/smoke.ts` out of scope.

## 6. Risks, Rollback, Out of Scope, Observability, Next Step

**Risks:** LoC ~390 at 400-line edge (Med; defer: `maps.ts` mixed-case pre-baking saves ~10 LoC, or drop per-tool response tests in `boundary.test.ts`). 4 hardcoded test files need 7→9 bumps (Low; §5). LLM misuse of canonical-for-map returns `[]` (Med; description says "call `get_items_by_name` first"). Future Riot mapId (Low; unknown → raw string). Pre-existing `ItemId` Zod gap (Low; out of scope). Proposal/spec `not-found` conflict (Low; spec wins).

**LoC forecast:** `item-helpers.ts` ~25 + `maps.ts` ~30 + `item.ts` +~40 + `get-items-by-name.ts` ~50 + `get-item-canonical-for-map.ts` ~55 + `tool-registry.ts` +~20 + tests new+extended ~150 + boundary/registry/mcp-server bumps ~20 = **~390**.

**Rollback:** pure additive. Pre-merge `git revert` → 9→7 with no behavior change. Post-deploy deletion is a no-op. No DB migration, no cache schema change, no breaking API removals. `item-helpers.ts` is unused by the existing 7 tools, so revert is binary-clean.

**Out of scope:** name lookups for champions/runes/summoner spells (no `maps` field); README 8→9 cleanup; `ItemId` Zod wiring into `get_item`; `scripts/smoke.ts`; fuzzy/substring name match; extracting `list_items`/`get_item` onto `getItemFile` (pure dedup, follow-up).

**Dependency direction & observability:** `src/domain/maps.ts` is pure — importable from `src/domain/item.ts` and `src/tools/*`. No circular-import risk: `domain/` only imports from `domain/`. `src/tools/*` → `src/ddragon/*` and `src/domain/*`. `src/mcp/*` never imports from `src/tools/*`. **No new metrics or counters** — the single `tools/call` dispatch handler in `src/mcp/tool-registry.ts:123-179` already counts the 2 new tool names automatically; thrown `DDragonError` cases flow through existing `toMcpError` unchanged.

**Next recommended:** `sdd-tasks` with the 400-line review budget enforced as a hard cap and an explicit flag if the forecast exceeds it. Task ordering (each slice lands green tests before the next): (1) `maps.ts` + unit test, (2) `item.ts` extend + unit test, (3) `item-helpers.ts` (no caller yet), (4) `get-items-by-name.ts` + integration test, (5) `get-item-canonical-for-map.ts` + integration test, (6) `tool-registry.ts` registration + the 3 test files needing count/name bumps.
