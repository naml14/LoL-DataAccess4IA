# Tasks: lol-datadragon-mcp

## Phase 1 — Scaffold & config

- [ ] 1.1 Initialize project files.
  - TDD note: write failing test first: `tests/unit/init.test.ts` asserts `package.json` exists and contains `@modelcontextprotocol/sdk`.
  - Files touched: `package.json`, `bunfig.toml`, `.gitignore`.
  - Depends on: —.
  - Acceptance criteria:
    - `package.json` pins `@modelcontextprotocol/sdk` to latest stable minor.
    - `bunfig.toml` configures test and install settings per project convention.
    - Covers `mcp-server` requirement `R-STDTO-1`.
  - Estimated changed lines: 50.

- [ ] 1.2 Setup TypeScript configuration.
  - TDD note: write failing test first: `tests/unit/tsconfig.test.ts` asserts `tsconfig.json` exists and target is `ESNext`.
  - Files touched: `tsconfig.json`.
  - Depends on: 1.1.
  - Acceptance criteria:
    - `tsconfig.json` supports Bun's native TypeScript features.
    - `bun tsc --noEmit` runs without configuration errors.
  - Estimated changed lines: 30.

- [ ] 1.3 Implement environment configuration.
  - TDD note: write failing test first: `tests/unit/config.test.ts` asserts `loadConfig()` throws if `LOL_DD_HTTP_TIMEOUT_MS` is < 1000.
  - Files touched: `src/config.ts`.
  - Depends on: 1.2.
  - Acceptance criteria:
    - `src/config.ts` parses environment variables using Zod.
    - Validation fails fast on out-of-range values per Design section 5.
    - Covers `data-versioning` requirement `R-LOC-1` and `data-cache` requirement `R-TTL-1`.
  - Estimated changed lines: 120.

## Phase 2 — Data Dragon client & versions

- [ ] 2.1 Implement URL endpoints builder.
  - TDD note: write failing test first: `tests/unit/endpoints.test.ts` asserts `getChampionPath("14.1.1", "en_US")` returns correct CDN URL.
  - Files touched: `src/ddragon/endpoints.ts`.
  - Depends on: 1.3.
  - Acceptance criteria:
    - Pure functions generate correct Data Dragon CDN paths for all 8 tool targets.
    - Supports version and locale substitution.
  - Estimated changed lines: 80.

- [ ] 2.2 Implement HTTP client.
  - TDD note: write failing test first: `tests/unit/client.test.ts` asserts `fetchJson` retries 3 times on 503 error using `bun:test` mocks.
  - Files touched: `src/ddragon/client.ts`.
  - Depends on: 2.1.
  - Acceptance criteria:
    - `fetch` with configurable timeout and retries (Design section 5).
    - Typed error handling for 404 vs 5xx.
    - Covers `data-dragon-client` requirements `R-RES-1` and `R-FAIL-1`.
  - Estimated changed lines: 150.

- [ ] 2.3 Implement version resolution logic.
  - TDD note: write failing test first: `tests/unit/versions.test.ts` asserts `resolveVersion()` returns first entry of `versions.json`.
  - Files touched: `src/ddragon/versions.ts`.
  - Depends on: 2.2.
  - Acceptance criteria:
    - Fetches and caches `versions.json` head.
    - Supports `LOL_DD_PIN_VERSION` override.
    - Covers `data-versioning` requirement `R-VER-1` and `R-PIN-1`.
  - Estimated changed lines: 220.

## Phase 3 — Cache layer

- [ ] 3.1 Implement cache keys and memory store.
  - TDD note: write failing test first: `tests/unit/cache-key.test.ts` asserts roundtrip `buildKey(parseKey(s)) === s`.
  - Files touched: `src/cache/key.ts`, `src/cache/memory.ts`.
  - Depends on: 1.3.
  - Acceptance criteria:
    - Canonical key format `ddragon:<version>:<locale>:<path>`.
    - Memory store respects TTL and explicit version bypass.
    - Covers `data-cache` requirement `R-TTL-1`.
  - Estimated changed lines: 150.

- [ ] 3.2 Implement disk cache with eviction.
  - TDD note: write failing test first: `tests/unit/disk-cache.test.ts` asserts adding a 4th version deletes the oldest.
  - Files touched: `src/cache/disk.ts`.
  - Depends on: 3.1.
  - Acceptance criteria:
    - Uses `Bun.file()` for atomic writes.
    - Retention policy keeps exactly 3 versions (Design section 3).
    - Covers `data-cache` requirement `R-RET-1`.
  - Estimated changed lines: 250.

## Phase 4 — Domain schemas

- [ ] 4.1 Implement Champion domain model.
  - TDD note: write failing test first: `tests/unit/champion.test.ts` asserts lookup matches "Ahri" and "103" case-insensitively.
  - Files touched: `src/domain/champion.ts`.
  - Depends on: 1.3.
  - Acceptance criteria:
    - Zod schema preserves all Riot fields (stats, abilities, lore, tips).
    - Supports ID and numeric key lookups.
    - Covers `game-data` requirement `R-CHAMP-1`.
  - Estimated changed lines: 200.

- [ ] 4.2 Implement Item and Shared models.
  - TDD note: write failing test first: `tests/unit/item.test.ts` asserts item with `from` field parses recipes correctly.
  - Files touched: `src/domain/item.ts`, `src/domain/shared.ts`.
  - Depends on: 4.1.
  - Acceptance criteria:
    - Item schema includes `from` and `into` arrays.
    - Shared types for Image, Gold, etc.
    - Covers `game-data` requirement `R-ITEM-1`.
  - Estimated changed lines: 150.

- [ ] 4.3 Implement Runes, Summoners, and Icons.
  - TDD note: write failing test first: `tests/unit/runes.test.ts` asserts `runesReforged.json` structure is correctly nested.
  - Files touched: `src/domain/rune.ts`, `src/domain/summoner.ts`, `src/domain/profileicon.ts`.
  - Depends on: 4.2.
  - Acceptance criteria:
    - Complete schemas for remaining Data Dragon assets.
    - Covers `game-data` requirement `R-RUNES-1`.
  - Estimated changed lines: 150.

## Phase 5 — Tool handlers

- [ ] 5.1 Implement Patch and Champion tools.
  - TDD note: write failing test first: `tests/integration/tools-champion.test.ts` calls `get_champion` and asserts non-reasoning boundary regex.
  - Files touched: `src/tools/get-current-patch.ts`, `src/tools/list-champions.ts`, `src/tools/get-champion.ts`.
  - Depends on: 2.3, 3.2, 4.3.
  - Acceptance criteria:
    - Tools correctly wire client, cache, and domain.
    - Tool descriptions do not promise reasoning (Design section 1).
    - Covers `mcp-tools` requirement `R-ROSTER-1` (partial).
  - Estimated changed lines: 450.

- [ ] 5.2 Implement Item and Metadata tools.
  - TDD note: write failing test first: `tests/integration/tools-item.test.ts` calls `get_item` and asserts schema validity.
  - Files touched: `src/tools/list-items.ts`, `src/tools/get-item.ts`, `src/tools/list-runes.ts`, `src/tools/list-summoner-spells.ts`, `src/tools/get-profile-icons.ts`.
  - Depends on: 5.1.
  - Acceptance criteria:
    - Remaining 5 tools implemented with Zod input validation.
    - Covers `mcp-tools` requirement `R-ROSTER-1` (complete).
  - Estimated changed lines: 850.

## Phase 6 — Server wiring & boundary test

- [x] 6.1 Implement MCP Server and Error mapping.
  - TDD note: write failing test first: `tests/unit/errors.test.ts` asserts `toMcpError` returns `{ error: { code, message } }`.
  - Files touched: `src/mcp/server.ts`, `src/mcp/tool-registry.ts`, `src/mcp/errors.ts`.
  - Depends on: 5.2.
  - Acceptance criteria:
    - Registers all 8 tools with the SDK.
    - Catch-all error envelope for unhandled exceptions.
    - Covers `mcp-server` requirement `R-ERR-1`.
  - Estimated changed lines: 350.

- [x] 6.2 Implement Entry point and Boundary Guard.
  - TDD note: write failing test first: `tests/integration/boundary.test.ts` iterates all tool responses against forbidden keywords.
  - Files touched: `src/index.ts`, `tests/integration/boundary.test.ts`.
  - Depends on: 6.1.
  - Acceptance criteria:
    - `index.ts` initializes config and starts server.
    - Boundary test fails if `best`, `optimal`, `tier`, `score`, `winrate`, or `recommended` appear in any output.
    - Covers `mcp-server` requirement `R-BND-1`.
  - Estimated changed lines: 300.

## Phase 7 — Fixtures & scripts

- [ ] 7.1 Setup Fixtures and Smoke script.
  - TDD note: write failing test first: `tests/unit/fixtures.test.ts` asserts `fixtures/ddragon` is not empty.
  - Files touched: `fixtures/ddragon/14.10.1/.keep`, `scripts/smoke.ts`.
  - Depends on: 6.2.
  - Acceptance criteria:
    - Project contains at least one set of patch fixtures for offline testing.
    - Smoke script allows manual verification against live CDN.
  - Estimated changed lines: 150.

## Review Workload Forecast

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: stacked-to-main
400-line budget risk: High

| Field | Value |
|-------|-------|
| Estimated changed lines | ~3650 (Code + Tests) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (Phases 1-2) → PR 2 (Phase 3) → PR 3 (Phase 4) → PR 4 (Phase 5) → PR 5 (Phases 6-7) |
| Delivery strategy | auto-chain |
| Chain strategy | stacked-to-main |

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Foundation: Scaffold, Config, Client & Versions | PR 1 | Base for all subsequent work; includes mock-based unit tests. |
| 2 | Storage: Cache Layer (Memory + Disk) | PR 2 | Independent persistence logic; depends on Config. |
| 3 | Domain: Zod Schemas & Lookup logic | PR 3 | Defines the data contract for all tools. |
| 4 | Tools: Implementation of all 8 tools | PR 4 | The core functionality; depends on Client, Cache, and Domain. |
| 5 | Boundary: Server wiring and integration tests | PR 5 | Final assembly; includes the loud boundary test. |
