# Proposal: lol-datadragon-mcp-better-lookups

> **Status**: `ok` — scope, name-match policy, mapId format, and multi-match behavior already settled by user decisions Q1.3, Q2.2, Q3.3, Q4.2, Q5.1. Ready for spec.

## Intent

The v1.0 MCP server (archived `2026-06-11-lol-datadragon-mcp`) gives the LLM 7 tools over Riot's Data Dragon CDN. Items are the **one** resource where the same `name` ships under multiple IDs — `Stormrazor` = 3097 on SR, 223095 on Arena, with different `maps`/`description`/`gold` (live-verified). `get_item` only takes a numeric id, and `list_items` returns a compact shape with **no** `maps`/`id`/`description`. So "give me Stormrazor for Summoner's Rift" forces the LLM into: (1) `list_items`, (2) external grep of ~706 compact records, (3) probe each id with `get_item`, (4) inspect `maps.11`. The fix: surface name-based lookups natively so the LLM never leaves the MCP.

## Scope

### In Scope
| Tool | Input | Output | Behavior |
|------|-------|--------|----------|
| `get_items_by_name` | `{ name: string, version?, locale? }` | `ItemRecord[]` (full shape incl. `maps`, `from`, `into`, `stats`, `description`) | **Case-insensitive exact** match (Q2.2). Throws `not-found` on 0; returns full array on 1+ — LLM picks via `maps`. |
| `get_item_canonical_for_map` | `{ name: string, map: string, version?, locale? }` | `ItemRecord[]` filtered to `maps[map] === true` | Accepts both stringified numeric (`"11"`, `"30"`) and human alias (`"summoners_rift"`, `"arena"`) (Q3.3). Throws `not-found` on 0; returns full array on 1+ (Q4.2) — **never picks** (non-reasoning boundary). |

### Out of Scope
- Name lookups for champions / runes / summoner spells — verified no per-map duplicates exist in those resources (`game-data` spec, no `maps` field).
- README cleanup of stale 8-tool count — independent change.
- Wiring the existing `ItemId` Zod into `get_item` input — separate hardening.
- `scripts/smoke.ts` augmentation.

## Approach

1. Add `getItemFile(version, locale, client, cache)` in `src/ddragon/item-helpers.ts` — mirrors `champion-helpers.ts#getChampionFile` so all 4 item tools share one cache entry.
2. Add two pure helpers to `src/domain/item.ts`:
   - `pickItemsByName(file, name)` — case-insensitive exact, returns `ItemRecord[]`.
   - `pickItemCanonicalForMap(file, name, map)` — filter by name, then `maps[map]`.
3. New handlers `src/tools/get-items-by-name.ts` + `src/tools/get-item-canonical-for-map.ts`; both call `getItemFile`, apply the pure helpers, return the result unchanged.
4. Register both in `src/mcp/tool-registry.ts` (7 → 9 tools).
5. Extend `ItemNotFoundError` to carry the query (name or `name+map`).

## Non-Reasoning Boundary

Both new tools return raw `ItemRecord` arrays unchanged. `get_item_canonical_for_map` returns one of the underlying records (or several) — **no merging, no derived `idForSR` field, no "canonical" picking**. Q4.2's choice to return the full array on multi-match is itself a boundary-respecting choice: the tool refuses to pick, leaves the decision to the caller. This deviates from `ChampionAmbiguousError` because the multi-match here is normal/expected (SR + Arena Stormrazor both have `name: "Stormrazor"`), not an error condition. Tools reason about duplicates; the LLM reasons about the user.

## MapId Alias Table (documented in tool description)

| Map id | Human alias | Map |
|--------|-------------|-----|
| `"11"` | `"summoners_rift"` | Summoner's Rift Classic (SR) |
| `"12"` | `"howling_abyss"` | ARAM / Howling Abyss |
| `"21"` | `"nexus_blitz"` | Nexus Blitz |
| `"22"` | `"2v2"` | 2v2 (Project) |
| `"30"` | `"arena"` | Arena |
| `"33"` | `"cherry"` | Cherry 2v2 (Arena mode internal) |
| `"35"` | `"brawl"` | Brawl |

Verified against live Data Dragon via `get_item(3097)` (SR/ARAM/Nexus Blitz/Brawl = true) and `get_item(223095)` (Arena = true) — the `maps` field exposes exactly these stringified numeric keys. **Unknown mapIds pass through as raw strings** so a future Riot map id doesn't break the world.

## Capabilities (contract with sdd-spec)

### Modified Capabilities
- `mcp-tools` — `Tool Roster Definition` requirement changes from "exactly 8 tools" to "exactly 9 tools" (per `tool-registry.ts` post-slice-9 state, 7 → 9). Add a new `Name-Based Item Lookups` requirement covering both new tools with Given/When/Then scenarios.

### New Capabilities
None.

## Affected Areas

| Path | Impact | Description |
|------|--------|-------------|
| `src/ddragon/item-helpers.ts` | New | `getItemFile(version, locale, client, cache)` shared cache helper. |
| `src/domain/item.ts` | Modified | Add `pickItemsByName` + `pickItemCanonicalForMap`. |
| `src/tools/get-items-by-name.ts` | New | Tool handler. |
| `src/tools/get-item-canonical-for-map.ts` | New | Tool handler. |
| `src/mcp/tool-registry.ts` | Modified | Register 2 new tools (7 → 9). |
| `src/mcp/errors.ts` | Modified | `ItemNotFoundError` carries the query. |
| `openspec/specs/mcp-tools/spec.md` | MODIFIED | Extend roster; add `Name-Based Item Lookups` requirement. |
| `tests/integration/tools/get-items-by-name.test.ts` | New | success / multi-match / not-found / case-insensitive / version+locale override. |
| `tests/integration/tools/get-item-canonical-for-map.test.ts` | New | same + alias resolution + dual mapId format. |
| `tests/unit/item.test.ts` | Modified | Unit tests for the 2 pure helpers. |
| `tests/integration/boundary.test.ts` | Modified | Add 2 new tools to the response scan. |
| `tests/unit/tool-registry.test.ts` | Modified | Bump expected tool count 7 → 9. |

## Risks

| Risk | Lik | Mitigation |
|------|-----|------------|
| LoC estimate ~280 may push past 400-line PR budget. | Med | Reuse `champion-helpers.ts` pattern verbatim; mapId alias is a `Record<string, string>` lookup, not a Zod enum. `sdd-tasks` will forecast. |
| LLM calls `get_item_canonical_for_map` for a map the item exists on under a different id, gets `not-found`. | Med | Tool description must say "use `get_items_by_name` first if you are unsure which IDs are canonical". |
| Future Riot mapId added → hardcoded aliases miss it. | Low | Alias table is a *convenience* layer; unknown ids pass through as raw strings. |
| `ItemId` Zod still not wired in `get_item` (pre-existing inconsistency). | Low | Out of scope; tracked separately. |
| Tool count drift breaks `tool-registry.test.ts` and stale README (8). | Low | Bump test; README is out of scope. |

## Success Criteria

- [ ] LLM resolves "give me Stormrazor for Summoner's Rift" in one `get_item_canonical_for_map` call.
- [ ] `get_items_by_name("Stormrazor")` returns the full set of all map variants.
- [ ] All 327 existing tests pass; new tests cover both tools.
- [ ] Existing 7 tools unchanged (no breaking changes).
- [ ] Boundary test passes for all 9 tool responses (no `best`/`tier`/`score`/etc.).

## Rollback Plan

- **Pre-merge**: `git revert` the single PR; tool count goes 9 → 7.
- **Post-deploy**: purely additive — no consumers depend on the new tools; deletion is a no-op for existing workflows. No data migration, no cache key change for the existing `item.json` entry.

## Next Recommended

`sdd-spec` — the proposal question round was already cleared by Q1.3–Q5.1, so spec can start immediately. Expect `openspec/changes/lol-datadragon-mcp-better-lookups/specs/mcp-tools/spec.md` as a MODIFIED delta on the existing `mcp-tools` spec (extend roster 7 → 9; add `Name-Based Item Lookups` requirement with Given/When/Then scenarios). Then `sdd-design` for the cache-helper shape and `sdd-tasks` for the 400-line PR budget forecast.
