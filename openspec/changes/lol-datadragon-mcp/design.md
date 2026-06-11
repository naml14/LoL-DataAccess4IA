# Design: lol-datadragon-mcp

## 1. Architecture Overview

Pure data layer over Riot's Data Dragon CDN. Concerns: reach the CDN reliably, cache aggressively, expose a stable typed tool surface over stdio MCP.

**Non-Reasoning Boundary (LOUD):** returns Data Dragon records as-is. It MUST NOT compute, infer, rank, or label. No fields named `best`, `optimal`, `tier`, `score`, `winrate`, `recommended`. `tests/integration/boundary.test.ts` asserts none exist in any response.

**`get_champion({ id: "Ahri" })` flow:** LLM -> MCP stdio -> tool-registry (Zod) -> versions.resolve -> cache.read `ddragon:<ver>:<locale>:/cdn/<ver>/data/<locale>/champion.json` -> miss -> client -> cache.write -> domain.champion.pick -> typed result.

## 2. Module / Folder Layout

```
src/mcp/{server,tool-registry,errors}.ts
src/ddragon/{client,versions,endpoints}.ts
src/cache/{memory,disk,key}.ts
src/domain/{champion,item,rune,summoner,profileicon}.ts
src/tools/{get-current-patch,list-champions,get-champion,list-items,get-item,list-runes,list-summoner-spells,get-profile-icons}.ts
src/config.ts          # env parsing, validated at boot
src/index.ts           # entry: loadConfig -> buildMcp -> stdio
tests/{unit,integration}/
fixtures/ddragon/<version>/...
```

No DI framework; `registerTools(server, deps)` takes deps explicitly.

## 3. Resolved Open Questions

| # | Resolution |
|---|------------|
| Locale | `en_US` default; per-tool `locale` overrides; `LOL_DD_LOCALE` env sets baseline |
| TTL | 900s default; `LOL_DD_TTL_SECONDS` override (60..86400); explicit `version` param bypasses TTL — old patches immutable |
| `get_champion` payload | Full record (stats, abilities, tips, lore) ~5–10 MB on disk. Documented in tool description. No `fields` filter in v1 |
| `get_champion` lookup | `id` (string, case-insensitive) OR `key` (numeric string). Ambiguity fails fast with `AMBIGUOUS_LOOKUP` + candidates |
| Disk retention | Last 3 versions FIFO by version string; on startup reconcile vs `/api/versions.json` and drop outside window |
| SDK pin | `@modelcontextprotocol/sdk` pinned to latest stable minor at design date; policy in README; re-evaluate on minor bump |

## 4. Data Flow & Contracts

**Cache key:** `ddragon:<version>:<locale>:<path>` (e.g. `ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json`). `cache/key.ts` exposes pure `buildKey`/`parseKey` (unit-tested). **Eviction:** FIFO by version string; on every fetch of a new version not in the last-3 set, drop the oldest version directory; reconcile on startup.

**Error envelope:** `{ error: { code, message, hint? } }`. `errors.ts#toMcpError` maps every thrown value to a typed envelope; no exception crosses MCP.

| Tool | Input | Output | Errors |
|------|-------|--------|--------|
| `get_current_patch` | `{ locale? }` | `{ version, resolved_at }` | `UPSTREAM_DOWN`, `NO_CACHED_VERSION` |
| `list_champions` / `list_items` | `{ version?, locale? }` | `{ version, locale, <map> }` | `VERSION_NOT_FOUND`, `UPSTREAM_DOWN` |
| `get_champion` | `{ id? \| key?, version?, locale? }` | full `Champion` | `NOT_FOUND`, `AMBIGUOUS_LOOKUP`, `BAD_INPUT` |
| `get_item` | `{ id, version?, locale? }` | `Item` | `NOT_FOUND` |
| `list_runes` / `list_summoner_spells` / `get_profile_icons` | `{ version?, locale? }` | typed payload per `game-data` spec | `VERSION_NOT_FOUND` |

## 5. Configuration

Parsed once in `src/config.ts` at boot; fails fast on out-of-range.

| Env var | Default | Range | Purpose |
|---------|---------|-------|---------|
| `LOL_DD_LOCALE` (string) | `en_US` | Riot locale code | Baseline locale |
| `LOL_DD_TTL_SECONDS` (int) | `900` | `60`..`86400` | TTL for `versions.json` and active poll |
| `LOL_DD_PIN_VERSION` (string) | unset | `MAJOR.MINOR.PATCH` | Bypass resolver |
| `LOL_DD_CACHE_DIR` (path) | `./.cache/ddragon` | writable path | Disk cache root |
| `LOL_DD_HTTP_TIMEOUT_MS` (int) | `5000` | `1000`..`60000` | Per-request timeout |
| `LOL_DD_HTTP_RETRIES` (int) | `3` | `0`..`5` | Max retries on transient 5xx/network |
| `LOL_DD_CB_THRESHOLD` (int) | `5` | `1`..`20` | Consecutive failures before CB opens |

## 6. Testing Strategy (Strict TDD)

Failing test first, then implementation.

**Unit** — `tests/unit/*.test.ts`, no I/O: `domain/*.test.ts` (case-insensitive lookup, ambiguous-match, full-record preservation, `from`/`into` recipes, base-item edge), `cache/key.test.ts` (roundtrip), `ddragon/endpoints.test.ts` (URL builders, version/locale substitution), `config.test.ts` (env parsing, range validation).

**Integration** — `tests/integration/*.test.ts`, tag `ddragon`. Spin up `McpServer` in-process; send a real `tools/call` JSON-RPC message; assert response. HTTP is **not** hit; a `DDragonClient` test double reads from `fixtures/ddragon/<version>/...` (checked-in recordings). Coverage >= 90% on `data-versioning`, `data-cache`, `data-dragon-client`.

**Boundary** — `tests/integration/boundary.test.ts` walks every tool response and asserts no key matches `/^(best|optimal|tier|score|winrate|recommended)$/i`.

**Live smoke** — manual only, not in CI. `bun run smoke` calls live Data Dragon.

## 7. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Riot changes Data Dragon schema | `src/domain/*.ts` is the Zod boundary; parse errors carry a `hint`; fixtures refresh catches regressions |
| Cache poisoning | Version-aware key; SHA-256 sidecar; mismatch forces refetch + stderr warning |
| `list_items` payload large | Tool description notes size; future delta may add `search_items(name)` |
| Network flakiness | Bounded retries (jittered exp backoff); CB after `LOL_DD_CB_THRESHOLD`, returns `UPSTREAM_UNAVAILABLE` |
| "best build" logic creeps in | Loud boundary in `design.md` + `boundary.test.ts` asserting no derived fields |
| No network + no cache at startup | `versions.ts` falls back to last-known-good; if none, exits with `NO_CACHED_VERSION` |

## 8. Out of Scope (re-stated)

No meta-stats (u.gg, Mobalytics, op.gg, lolalytics, CommunityDragon meta). No "best build" / tier list / recommendation logic. No HTTP/SSE transport (stdio only). No auth / multi-user. No mutation endpoints. No Riot API key. The LLM reasons; this server serves data.
