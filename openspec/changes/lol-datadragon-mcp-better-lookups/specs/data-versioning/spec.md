# Delta for data-versioning

## ADDED Requirements

### Requirement: MapId Alias Resolution

The system MUST resolve map aliases for canonical item lookups, translating human-readable map names to Riot's stringified numeric map IDs.

#### Scenario: Common map aliases resolve correctly

- GIVEN a lookup requires mapping a human alias to a map ID
- WHEN the provided alias is `"summoners_rift"`, `"howling_abyss"`, `"nexus_blitz"`, `"2v2"`, `"arena"`, `"cherry"`, or `"brawl"`
- THEN it MUST resolve to `"11"`, `"12"`, `"21"`, `"22"`, `"30"`, `"33"`, or `"35"` respectively

#### Scenario: Unknown map alias passes through

- GIVEN an unknown map alias (e.g. `"999"`)
- WHEN it is passed to the resolution helper
- THEN it MUST be treated as a raw stringified numeric without throwing an error

#### Scenario: Case-insensitive alias resolution

- GIVEN a human alias with mixed casing (e.g. `"SUMMONERS_RIFT"`)
- WHEN it is resolved
- THEN it MUST successfully resolve to `"11"` case-insensitively

#### Scenario: Alias table export source

- GIVEN the alias table is needed by tests or tool handlers
- WHEN imported
- THEN it MUST be available from a single exported source (e.g. `src/domain/maps.ts`)