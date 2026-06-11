# mcp-tools Specification

## Purpose
Defines the MCP tool surface exposed to the LLM, detailing input schemas, output shapes, and the 8 core tools.

## Requirements

### Requirement: Core Tools Interface
All tools MUST accept an optional `version` and `locale` string parameter, defaulting to the resolved current version and default locale.

#### Scenario: Default parameters
- GIVEN a tool is called with no parameters
- WHEN it executes
- THEN it MUST use the current patch version and default `en_US` locale

#### Scenario: Explicit parameters
- GIVEN a tool is called with `version="14.1.1"` and `locale="es_AR"`
- WHEN it executes
- THEN it MUST fetch and return the localized data for that specific patch

### Requirement: Tool Roster Definition
The server MUST expose exactly eight tools: `get_current_patch`, `list_champions`, `get_champion`, `list_items`, `get_item`, `list_runes`, `list_summoner_spells`, and `get_profile_icons`.

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

### Requirement: Non-Reasoning Boundary Enforcement
The tools MUST NOT provide derived analysis, tier lists, or recommendations.

#### Scenario: Tool output validation
- GIVEN any tool execution completes
- WHEN the response is formulated
- THEN the output schema MUST strictly represent Data Dragon models
- AND MUST NOT contain AI-derived reasoning fields