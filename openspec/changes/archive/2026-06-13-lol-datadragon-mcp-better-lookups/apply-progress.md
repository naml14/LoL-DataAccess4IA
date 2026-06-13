# Apply Progress: lol-datadragon-mcp-better-lookups

> **Status**: `ok` (after chained-PR restructure)
> **Strict TDD**: ENABLED — every slice followed red-green-refactor.
> **Test runner**: `bun test`
> **Review budget**: 400 changed lines
> **Final delivery**: feature-branch-chain with size:exception on PR2

## Summary

The original `sdd-apply` batch landed all 18 tasks across 6 work-unit commits on a single branch (`feat/lol-datadragon-mcp-better-lookups`) totalling 1016 LoC. The orchestrator's review-workload guard flagged this as 2.5× over the 400-line budget. The user chose **Q1 (chained PRs) + Q1.X.2 (feature-branch-chain) + Q1.Y.1 (reset + cherry-pick)**, and **Q2.3 (size:exception for PR2)**, producing a 3-PR chain.

## Chain structure (final, all branches green)

| Branch | Target | Commits | LoC | Tests | TS | Notes |
|--------|--------|---------|-----|-------|-----|-------|
| `feat/...-pr1-foundation` | tracker | 3 (8e4580f, 77e011c, 606fd52) | 376 | 335 pass | clean | domain + helper refactor |
| `feat/...-pr2-tools` | pr1 | 2 (1f094ff, a9d84c9) | **574** | 357 pass | clean | 2 new tools; **size:exception** (174 LoC over) |
| `feat/...-pr3-wiring` | pr2 | 1 (3f0a25b) | 73 | 359 pass | clean | registry + test bumps + README |
| `feat/...-better-lookups` (tracker) | main (when all chain merges) | 6 (12be137, 604da2f, cbaa85e, 4b52f7c, a685a5f, f0f2738) | 1014 | 359 pass | clean | integrates the chain |

### PR2 size:exception rationale
- Forecast in design: ~390 LoC.
- Actual: 574 LoC. Overshoot driven by the 2 new tool test files (180 + 234 = 414 LoC of test code, vs ~160 LoC of handler code).
- Mitigation considered and rejected: splitting each tool's test scenarios was rejected by user (Q2.1 split into 4 PRs); trimming scenarios (Q2.2) was rejected (the test coverage is the spec's acceptance criteria).
- The exception is a one-time scope expansion. Future item-lookup changes should keep handler+test diffs under 400 LoC per PR.

### Cleanup applied during chain restructure
The original apply batch left `import { z } from "zod";` unused in `get-items-by-name.ts` and `get-item-canonical-for-map.ts` (TypeScript `noUnusedLocals` flagged them on `bun tsc --noEmit`). During the PR2 autosquash rebase, both imports were removed and the fixup was folded into the 2 tool commits. Net effect: 2 lines saved on the final tracker (1016 → 1014 LoC).

## Commits landed (tracker, in order)

1. `12be137` feat(domain): add maps alias table and resolveMapId
2. `604da2f` feat(domain): add pickItemsByName and pickItemCanonicalForMap pickers
3. `cbaa85e` refactor(ddragon): centralize item.json fetch in getItemFile helper
4. `4b52f7c` feat(tools): add get_items_by_name MCP tool
5. `a685a5f` feat(tools): add get_item_canonical_for_map MCP tool
6. `f0f2738` chore(mcp): register new tools, bump tests, update README

## Files changed (16)

### New
- `src/ddragon/item-helpers.ts` (50 LoC) — `getItemFile` helper, mirrors `getChampionFile`
- `src/domain/maps.ts` (43 LoC) — `MAP_ID_ALIASES` + `resolveMapId`
- `src/tools/get-items-by-name.ts` (73 LoC) — new MCP tool
- `src/tools/get-item-canonical-for-map.ts` (85 LoC) — new MCP tool
- `tests/unit/maps.test.ts` (60 LoC)
- `tests/integration/tools/get-items-by-name.test.ts` (180 LoC)
- `tests/integration/tools/get-item-canonical-for-map.test.ts` (234 LoC)

### Modified
- `src/domain/item.ts` (+47) — 2 pure pickers
- `src/tools/get-item.ts` (−22) — refactored to use `getItemFile`
- `src/tools/list-items.ts` (−19) — refactored to use `getItemFile`
- `src/mcp/tool-registry.ts` (+4) — 2 new registrations
- `tests/unit/item.test.ts` (+171) — picker tests
- `tests/unit/tool-registry.test.ts` (+12, −2) — count 7 → 9, assert new tools
- `tests/integration/mcp-server.test.ts` (+6, −2) — count bump
- `tests/integration/boundary.test.ts` (+44) — scan new tool descriptions
- `README.md` (+5, −2) — tool table 7 → 9

## Deviations from the task plan

- **None on the code side.** All 18 tasks were implemented as specified, with the 6 work-unit commits matching the design's 6 slices.
- **The cleanup of the unused zod imports** was a post-apply fix during the chain restructure. The original commits had the unused imports; the fixup was applied via autosquash rebase.
- **The total LoC exceeded the design's forecast** (1014 actual vs ~390 forecast). The overshoot is test code; the 2 handler files are 158 LoC combined, consistent with the design's plan.

## Unresolved risks

- **LoC forecast accuracy.** The design's 390-LoC estimate missed the test-code weight. Future item-lookup changes should forecast 2× the handler LoC for tests.
- **No git remote.** This repo has no `origin` (`git remote -v` returns empty). The 4 branches exist locally only. The user will need to push to a remote and open the PRs from the GitHub UI (or set up a remote first).
- **The PR2 size:exception** must be explicitly noted in the PR2 description when opened; otherwise reviewers will see an unexpected 574-LoC PR.

## Out-of-scope (deferred)

- Wiring the existing-but-unused `ItemId` Zod into `get_item`'s input (pre-existing gap; not for this change).
- `scripts/smoke.ts` augmentation for the new tools.
- README cleanup of the now-stale "8 tools" line elsewhere in the docs (the tool table itself is fixed).
- Champion / rune / summoner-spell name lookups (no map-specific duplicates in those resources; the user explicitly chose to skip via Q1.3 Option C scope).

## Verification status

All 4 branches independently green:
- `bun test`: 335 / 357 / 359 / 359 pass, 0 fail
- `bun tsc --noEmit`: 0 errors

## Next recommended

`sdd-verify` on the **tracker** branch (`feat/lol-datadragon-mcp-better-lookups`) to validate the implementation against the 18 spec requirements and the 4 spec deltas. Verification runs on the final integrated state, not on each chain branch — the chain is a delivery mechanism, the spec compliance is checked on what will eventually merge to main.
