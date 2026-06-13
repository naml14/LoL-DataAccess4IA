# game-data Specification

## Purpose
Defines the canonical schema for game records (champions, items, runes, summoner spells, profile icons) mirroring Riot's structure.

## Requirements

### Requirement: Champion Record Schema
The system MUST preserve the canonical full champion schema from `champion.json` or individual champion endpoints without trimming fields.

#### Scenario: Full champion payload
- GIVEN a champion record is fetched and parsed
- WHEN it is returned to the tool layer
- THEN it MUST include full stats, abilities, lore, and tips exactly as provided by Riot

#### Scenario: Case-insensitive lookups
- GIVEN a champion is queried by ID or key (e.g., "ahri" or "103")
- WHEN the record is resolved
- THEN it MUST successfully match regardless of casing

### Requirement: Item Record Schema
The system MUST parse item records preserving their hierarchical and relational data. Additionally, name-based item lookups MUST preserve the full `ItemRecord` shape (including `maps`, `from`, `into`, `stats`, `description`, plaintext, etc.) without dropping or synthesizing fields.

#### Scenario: Item with recipes
- GIVEN an item record with component requirements
- WHEN the data is parsed
- THEN it MUST include the `from` and `into` arrays mapping to other item IDs

#### Scenario: Item without recipes
- GIVEN a base item (e.g., Long Sword)
- WHEN the data is parsed
- THEN the recipe arrays MUST be empty or absent per Riot's schema

#### Scenario: Full schema preservation on name lookup

- GIVEN an item is looked up by name using `get_items_by_name` or `get_item_canonical_for_map`
- WHEN the response is generated
- THEN the full `ItemRecord` shape MUST be preserved on the returned objects
- AND no fields MUST be dropped or synthesized

### Requirement: Rune and Summoner Spell Schemas
The system MUST parse Rune Trees (`runesReforged.json`), Summoner Spells, and Profile Icons matching Riot's exact nested structure.

#### Scenario: Rune tree parsing
- GIVEN a rune tree payload
- WHEN parsed
- THEN it MUST correctly nest slots and individual runes with their respective IDs and descriptions

#### Scenario: Summoner spell parsing
- GIVEN a summoner spell payload
- WHEN parsed
- THEN it MUST include cooldowns, costs, and game modes exactly as provided
