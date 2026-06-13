# Delta for mcp-tools

## ADDED Requirements

### Requirement: Name-Based Item Lookups

The system MUST provide dedicated MCP tools to query items by their name, eliminating the need for the LLM to paginate and grep over compact item lists manually.

#### Scenario: get_items_by_name returns single match with full ItemRecord (including maps field)

- GIVEN Data Dragon has one item with `name: "Infinity Edge"`
- WHEN the LLM calls `get_items_by_name({ name: "Infinity Edge" })`
- THEN the response is a JSON array of length 1
- AND the single record has `id`, `name`, `description`, `gold`, `maps` (object with at least `11: true`), `from`, `into`, `stats` populated
- AND the response contains no synthesized fields (only Data Dragon fields, preserved verbatim)

#### Scenario: get_items_by_name returns all map-variants for duplicated name (Stormrazor case)

- GIVEN Data Dragon 16.12.1 has at least 2 items with `name: "Stormrazor"` (one with `maps.11: true`, one with `maps.30: true`)
- WHEN the LLM calls `get_items_by_name({ name: "stormrazor" })` (lowercase)
- THEN the response is a JSON array of length ≥ 2
- AND every element has the full `ItemRecord` shape
- AND the array includes the canonical SR record (id `3097`) and the Arena record (id `223095`)

#### Scenario: get_items_by_name is case-insensitive exact match (substring does NOT match)

- GIVEN Data Dragon has an item with `name: "Stormrazor"`
- WHEN the LLM calls `get_items_by_name({ name: "storm" })` (substring)
- THEN the tool returns an empty array
- AND no error is thrown
- WHEN the LLM calls `get_items_by_name({ name: "STORMRAZOR" })` (uppercase)
- THEN the tool returns the full set

#### Scenario: get_items_by_name with unknown name returns empty array

- WHEN the LLM calls `get_items_by_name({ name: "NonexistentItemXYZ" })`
- THEN the tool returns an empty array
- AND the cache key for `item.json` was hit (no extra CDN fetch beyond the standard `list_items`/`get_item` path)

#### Scenario: get_item_canonical_for_map returns the unique record for (name, mapId) using stringified numeric

- GIVEN Stormrazor has `maps.11: true` on id `3097`
- WHEN the LLM calls `get_item_canonical_for_map({ name: "Stormrazor", mapId: "11" })`
- THEN the response is the single `ItemRecord` with id `3097`
- AND the response has the full `ItemRecord` shape (no merging, no derived fields)

#### Scenario: get_item_canonical_for_map accepts human-readable alias

- WHEN the LLM calls `get_item_canonical_for_map({ name: "Stormrazor", mapId: "summoners_rift" })`
- THEN the tool resolves `summoners_rift` → `"11"` internally
- AND returns the same id `3097` record
- WHEN the LLM calls with `mapId: "arena"`
- THEN the tool returns the id `223095` record

#### Scenario: get_item_canonical_for_map returns full array when multiple items match (name, mapId)

- GIVEN Data Dragon has ≥ 2 items with the same name and both have `maps.11: true` (rare but possible)
- WHEN the LLM calls `get_item_canonical_for_map({ name: <that name>, mapId: "11" })`
- THEN the response is a JSON array of length ≥ 2
- AND each element is a full `ItemRecord`
- AND the tool description tells the LLM to use `get_items_by_name` if it wants to disambiguate

#### Scenario: get_item_canonical_for_map returns empty array when no item has name+mapId

- WHEN the LLM calls `get_item_canonical_for_map({ name: "Banana", mapId: "11" })`
- THEN the response is an empty array
- AND no error is thrown (the LLM can react: "no SR banana exists")

#### Scenario: get_item_canonical_for_map accepts unknown mapId as raw stringified numeric (forward-compat)

- WHEN the LLM calls `get_item_canonical_for_map({ name: "Stormrazor", mapId: "999" })` and `"999"` is not in the alias table
- THEN the tool treats `"999"` as a raw stringified numeric
- AND returns the empty array (no item has `maps.999`)
- AND the tool does NOT throw "unknown mapId"

#### Scenario: both new tools respect version and locale overrides

- WHEN the LLM calls `get_items_by_name({ name: "Stormrazor", version: "14.10.1" })`
- THEN the tool fetches `item.14.10.1.json` (not the current default)
- AND the same applies to `get_item_canonical_for_map`

#### Scenario: both new tools share the item.json cache key with list_items and get_item

- GIVEN a previous `list_items()` call has populated the `item.json` cache
- WHEN the LLM calls `get_items_by_name({ name: "Stormrazor" })`
- THEN no extra CDN fetch occurs (cache hit, same key)
- AND the same applies to `get_item_canonical_for_map`

## MODIFIED Requirements

### Requirement: Tool Roster Definition

The server MUST expose exactly nine tools: `get_current_patch`, `list_champions`, `get_champion`, `list_items`, `get_item`, `get_items_by_name`, `get_item_canonical_for_map`, `list_runes`, and `list_summoner_spells`. The updated roster adds two new item lookups.

(Previously: The server MUST expose exactly eight tools: `get_current_patch`, `list_champions`, `get_champion`, `list_items`, `get_item`, `list_runes`, `list_summoner_spells`, and `get_profile_icons`.)

#### Scenario: Get champion by ID or Key

- GIVEN the LLM calls `get_champion` with `id="Ahri"` or `key="103"`
- WHEN executed
- THEN it MUST return the full champion payload from `game-data`

#### Scenario: List items

- GIVEN the LLM calls `list_items`
- WHEN executed
- THEN it MUST return a dictionary or array of all items for the specified patch

#### Scenario: Get current patch

- GIVEN the LLM calls `get_current_patch`
- WHEN executed
- THEN it MUST return the active version string without network lookup if cached

#### Scenario: Name-based item lookups

- GIVEN the LLM calls `get_items_by_name` or `get_item_canonical_for_map`
- WHEN executed
- THEN it MUST return the full `ItemRecord` array without external grep required