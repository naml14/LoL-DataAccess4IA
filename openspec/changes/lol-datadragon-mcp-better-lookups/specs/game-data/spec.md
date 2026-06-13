# Delta for game-data

## MODIFIED Requirements

### Requirement: Item Record Schema

The system MUST parse item records preserving their hierarchical and relational data. Additionally, name-based item lookups MUST preserve the full `ItemRecord` shape (including `maps`, `from`, `into`, `stats`, `description`, plaintext, etc.) without dropping or synthesizing fields.

(Previously: The system MUST parse item records preserving their hierarchical and relational data.)

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