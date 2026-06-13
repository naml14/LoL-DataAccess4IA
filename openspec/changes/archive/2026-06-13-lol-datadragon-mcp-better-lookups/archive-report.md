# Archive Report: lol-datadragon-mcp-better-lookups

**Status**: archived
**Change name**: lol-datadragon-mcp-better-lookups
**Archive date**: 2026-06-13
**Prior archive reference**: 2026-06-11-lol-datadragon-mcp

## What was archived
- Tracker branches: 6 commits (Final SHA: ... tracker branch was `feat/lol-datadragon-mcp-better-lookups`).
- Spec sync: 4 spec files synced to canonical.
- Test deltas: 359 tests passed.
- Chain structure: PR1 → tracker, PR2 → PR1, PR3 → PR2.

## Deltas synced
- **mcp-tools/spec.md**: Added name-based item lookups (get_items_by_name, get_item_canonical_for_map), updated tool roster (9 tools).
- **data-versioning/spec.md**: Added MapId alias resolution requirement.
- **mcp-server/spec.md**: Added requirement for raw record delegation in lookups.
- **game-data/spec.md**: Added requirement for full schema preservation on item lookups.

## Chain status
- 3 PR branches exist locally.
- User MUST push to remote and open PRs: PR1 → tracker, PR2 → PR1, PR3 → PR2.
- PR2 size:exception documented in chain.
- README fix (Phase N regression) in 9b044ae (tracker) / 887584d (PR3).

## Follow-up actions
1. Push branches.
2. Open PRs in order.
3. Merge tracker to main after chain completes.
4. Bump version to 0.2.0 and publish.

## Out-of-scope reminders
- ItemId Zod
- smoke.ts
- README body cleanup
- non-item name lookups
