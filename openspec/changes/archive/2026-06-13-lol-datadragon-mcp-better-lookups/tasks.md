# Tasks: lol-datadragon-mcp-better-lookups

> **Status**: blocked — LoC budget exceeded (1016 vs 400 limit)
> **Strict TDD**: ENABLED — every implementation task is red-green-refactor.
> **Test runner**: `bun test`
> **Review budget**: 400 changed lines (forecast ~390; right at the edge)

## 1. Slices
The work is divided into 6 sequential slices following a bottom-up TDD approach. We start with pure domain logic (maps and item pickers), then centralize I/O helpers, and finally implement the MCP tool handlers and their registration.

## 2. Tasks
### 1. maps.ts + unit test (slice 1)
- [x] **1.1** Add `src/domain/maps.ts` with `MAP_ID_ALIASES` record and `resolveMapId` helper.
  - TDD: Write `tests/unit/maps.test.ts` asserting alias resolution (known alias, known numeric, case-insensitive, unknown passthrough).
  - Run `bun test tests/unit/maps.test.ts` (expect fail).
  - Implement and run again (expect pass).
- [x] **1.2** Run full `bun test` — expect green.
- [x] **1.3** Commit: `feat(domain): add maps alias table and resolveMapId` (work-unit commit).

### 2. item.ts extend with pure pickers + unit tests (slice 2)
- [x] **2.1** Add `pickItemsByName` to `src/domain/item.ts` (case-insensitive exact match).
  - TDD: Add tests to `tests/unit/item.test.ts` (match, case mismatch, no match -> `[]`, Stormrazor multi-match -> full array).
  - Run `bun test tests/unit/item.test.ts` (expect fail).
  - Implement and run again (expect pass).
- [x] **2.2** Add `pickItemCanonicalForMap` to `src/domain/item.ts` (filter by name then `maps[resolvedId]`).
  - TDD: Add tests to `tests/unit/item.test.ts` (numeric mapId, alias, unknown mapId -> `[]`, multi-match same name+map -> full array).
  - Run `bun test tests/unit/item.test.ts` (expect fail).
  - Implement and run again (expect pass).
- [x] **2.3** Commit: `feat(domain): add pickItemsByName and pickItemCanonicalForMap pickers`.

### 3. item-helpers.ts (slice 3 — no caller yet)
- [x] **3.1** Add `src/ddragon/item-helpers.ts` with `getItemFile` helper (reusing `cacheKeyForResource("item")`).
  - TDD: Covered by existing `tests/unit/client.test.ts` and `tests/unit/cache-key.test.ts` indirectly; verify no regression.
- [x] **3.2** Refactor `get_item` and `list_items` to use `getItemFile` helper.
  - Verification: Existing integration tests for `get_item` and `list_items` MUST stay green.
- [x] **3.3** Commit: `refactor(ddragon): centralize item.json fetch in getItemFile helper`.

### 4. get-items-by-name.ts + integration test (slice 4)
- [x] **4.1** Implement `src/tools/get-items-by-name.ts` tool handler.
  - TDD: Create `tests/integration/tools/get-items-by-name.test.ts` (single match, multi-match, case-insensitive, empty array for no match, version/locale overrides).
  - Run `bun test tests/integration/tools/get-items-by-name.test.ts` (expect fail).
  - Implement and run again (expect pass).
- [x] **4.2** Commit: `feat(tools): add get_items_by_name MCP tool`.

### 5. get-item-canonical-for-map.ts + integration test (slice 5)
- [x] **5.1** Implement `src/tools/get-item-canonical-for-map.ts` tool handler.
  - TDD: Create `tests/integration/tools/get-item-canonical-for-map.test.ts` (numeric id, alias, multi-match full array, empty for no match, unknown mapId passthrough).
  - Run `bun test tests/integration/tools/get-item-canonical-for-map.test.ts` (expect fail).
  - Implement and run again (expect pass).
- [x] **5.2** Commit: `feat(tools): add get_item_canonical_for_map MCP tool`.

### 6. tool-registry + test bumps + boundary + README (slice 6)
- [x] **6.1** Register new tools in `src/mcp/tool-registry.ts` and update `tests/unit/tool-registry.test.ts` (bump 7 -> 9).
- [x] **6.2** Update `tests/integration/mcp-server.test.ts` expected tool count and names.
- [x] **6.3** Extend `tests/integration/boundary.test.ts` (`ALL_TOOLS`, `TOOL_SOURCE_FILES`) and ensure response scan passes for new tools.
- [x] **6.4** Update `README.md` tool table and count (8 -> 9).
- [x] **6.5** Commit: `chore(mcp): register new tools, bump tests, update README`.

## 3. Review Workload Forecast
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: size-exception
400-line budget risk: Medium

- **Estimated changed lines**: ~390 (Code: ~220, Tests: ~170)
- **Files touched**:
  - NEW: `src/domain/maps.ts`, `src/ddragon/item-helpers.ts`, `src/tools/get-items-by-name.ts`, `src/tools/get-item-canonical-for-map.ts`, `tests/unit/maps.test.ts`, `tests/integration/tools/get-items-by-name.test.ts`, `tests/integration/tools/get-item-canonical-for-map.test.ts`
  - MODIFIED: `src/domain/item.ts`, `src/mcp/tool-registry.ts`, `src/tools/get-item.ts`, `src/tools/list-items.ts`, `tests/unit/item.test.ts`, `tests/unit/tool-registry.test.ts`, `tests/integration/mcp-server.test.ts`, `tests/integration/boundary.test.ts`, `README.md`
- **New tests**: ~20 scenarios across 3 new files + 2 extended files.
- **Test runner impact**: `bun test` expected to stay < 2s.
- **Mitigations if forecast exceeds budget**:
  - Defer refactor of `get_item`/`list_items` to use `getItemFile`.
  - Reduce boundary test per-tool scans to a shared assertion.

## 4. Dependency graph
A short diagram showing the slice order. The slices are sequential as each layer depends on the previous.
```
Slice 1 (Maps) -> Slice 2 (Item Pickers) -> Slice 3 (Item Helpers) -> Slice 4/5 (Tools) -> Slice 6 (Registry)
```

## 5. Out-of-scope items (deferred to follow-up changes)
- Champion/rune/summoner-spell name lookups.
- Wiring `ItemId` Zod into `get_item`.
- `scripts/smoke.ts` augmentation.
- Fuzzy/substring name match.

## 6. Next recommended
`sdd-apply` with `STRICT TDD MODE IS ACTIVE`. The forecast is ~390 LoC, so a single PR is feasible but requires careful execution.
