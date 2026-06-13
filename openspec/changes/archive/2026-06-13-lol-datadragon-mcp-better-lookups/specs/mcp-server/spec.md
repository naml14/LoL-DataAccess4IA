# Delta for mcp-server

## ADDED Requirements

### Requirement: Name-Based Lookup Returns Raw Records

The new name-based item lookup tools MUST NOT compute, merge, pick-by-newest-id, or derive fields. They MUST be pure delegations over Data Dragon records. Returning a full array on multi-match respects this boundary by leaving disambiguation to the caller.

#### Scenario: Pure delegation of multiple matches

- GIVEN a tool like `get_items_by_name` or `get_item_canonical_for_map` encounters a multi-match
- WHEN the result is constructed
- THEN the tool MUST return the full array of matches
- AND MUST NOT pick a canonical item itself
- AND leaves the decision to the caller