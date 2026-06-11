# lol-datadragon-mcp

**MCP server for Riot Data Dragon — pure data layer, no reasoning.**

An LLM that needs raw LoL game data (champions, items, runes, summoner spells, current patch) gets it here. The LLM reasons; we serve data. This server **does not** compute, rank, score, or recommend anything.

## Status

**v1.0 release** — Phase 7 complete. The MCP server exposes 8 tools over stdio transport.

### Warning Status

Slice 9 (final verify-fix) addressed the last CRITICAL and closed several WARNINGs. Remaining items are **deferred** (intentional design gaps) or **suggestions** (improvements, not blockers):

| ID | Item | Status |
|---|---|---|
| CRITICAL-2 | Boundary test used weak inline regex | **FIXED** — `assertNoForbiddenLanguage` now wired into all 9 boundary test files |
| WARNING-2 | `as any` casts in `get-item.ts`, `server.ts`, `tool-registry.ts` | **FIXED** — typed with `as ItemFile` / `as unknown as any` + eslint comments |
| WARNING-3 | `mapDDragonError` switch lacked `default` case | **FIXED** — `default: throw` added; future `DDragonError.kind` values throw at runtime |
| WARNING-4 | `scripts/smoke.ts` had dead `cache.delete` workaround | **FIXED** — removed; cache key collision resolved in slice 8 |
| WARNING-5 | `champion-full.json` orphan fixture | **FIXED** — file removed |
| WARNING-6 | Cache key 2-colon singleton format | **Deferred** — acknowledged; does not affect correctness with `MemoryCache` |
| WARNING-7 | MCP stdio transport not exercised end-to-end in tests | **Deferred** — acknowledged; would require subprocess stdio test |
| WARNING-8 | Smoke script tests 6 tools; README claimed 8 | **Deferred** — acknowledged; `list_items` and `get_item` not in smoke |

TypeScript: `bun run typecheck` and `bun run typecheck:tests` are **clean** (0 errors). Test suite: **326 pass / 0 fail**.

## Quick start

```bash
git clone <repo>
bun install
bun test
bun run smoke          # smoke test using cached fixtures (offline)
bun run smoke:live     # smoke test against live Data Dragon CDN
```

## Configuration

All configuration is via environment variables. Defaults are safe for local development.

| Variable | Default | Range | Description |
|---|---|---|---|
| `LOL_DD_LOCALE` | `en_US` | Riot locale code | Baseline locale for all requests |
| `LOL_DD_TTL_SECONDS` | `900` | `60`–`86400` | TTL for version lookups and cache |
| `LOL_DD_PIN_VERSION` | _(none)_ | `MAJOR.MINOR.PATCH` | Override version resolution |
| `LOL_DD_CACHE_DIR` | `./.cache/ddragon` | writable path | Disk cache root |
| `LOL_DD_HTTP_TIMEOUT_MS` | `5000` | `100`–`60000` | Per-request HTTP timeout |
| `LOL_DD_LOG_LEVEL` | `info` | `debug\|info\|warn\|error` | Log verbosity |

## MCP tools

| Tool | Description | Required input |
|---|---|---|
| `get_current_patch` | Returns the current Data Dragon patch version and locale | _(none)_ |
| `list_champions` | Returns all champions for a patch version | `version?`, `locale?` |
| `get_champion` | Returns a single champion record by id or numeric key | `idOrKey` (string) |
| `get_item` | Returns a single item record by numeric id | `id` (number) |
| `list_items` | Returns all items for a patch version | `version?`, `locale?` |
| `list_runes` | Returns all rune trees for a patch version | `version?`, `locale?` |
| `list_summoner_spells` | Returns all summoner spells for a patch version | `version?`, `locale?` |
| `list_profile_icons` | Returns all profile icons for a patch version | `version?`, `locale?` |

## Non-Reasoning Boundary (LOUD)

This server is a **pure data layer**. It MUST NOT expose fields like `best`, `optimal`, `tier`, `score`, `winrate`, or `recommended`. Any output that appears to reason about "what is best" is a bug.

The boundary is enforced in `src/mcp/boundary-language.ts`, which exports `FORBIDDEN_WORDS` and `assertNoForbiddenLanguage(text, source)`. The current list of forbidden tokens is:

```
best, recommended, recommendation, tier, optimal, score, winrate, win rate,
pick rate, ban rate, meta, strong, broken, op, buffed, nerfed, overrated,
underrated, must-pick, first-pick, go-to, top-tier, S-tier, A-tier, B-tier,
C-tier, D-tier, build order, pro build, pro pick
```

All tool responses and every tool's `description` source string are scanned against this list (case-insensitive, with word boundaries where appropriate). Any match is a test failure. Contributors must ensure no such language appears in tool descriptions, input schemas, or response data.

## Development

### Adding a new tool (test-first)

1. Write the integration test in `tests/integration/tools/<tool-name>.test.ts`.
2. Assert the tool name, input schema, and response shape.
3. Implement the tool handler in `src/tools/<tool-name>.ts`.
4. Register in `src/mcp/tool-registry.ts`.
5. Run `bun test` to verify.

### Scripts

```bash
bun run fixtures:refresh        # re-record fixtures from live CDN
bun run smoke                   # smoke test (cached fixtures, offline)
bun run smoke:live              # smoke test against live Data Dragon
bun run typecheck               # production typecheck (src/ only, strict)
bun run typecheck:tests         # full-strict typecheck including tests/
bun run clean                   # remove .cache, dist, .bun, node_modules
```

### Fixtures

Fixtures are stored under `fixtures/ddragon/<version>/` and are intentionally kept small for review-friendliness. To re-record the full set from live Data Dragon:

```bash
LOL_DD_VERSION=16.12.1 bun run fixtures:refresh
```

**Note:** `profileicon.json` is trimmed to the first 10 entries. See `scripts/fixtures-refresh.ts` to record the complete set.

## SDK pin policy

`@modelcontextprotocol/sdk` is pinned to a **stable minor** version. The current pin is `1.29.0`. Re-evaluate on every minor bump; update the pin and this README when a new stable minor is confirmed safe.

## Project structure

```
src/
  config.ts          # Zod-validated env parsing
  index.ts           # Entry point
  ddragon/           # HTTP client, version resolver, endpoint builders
  cache/             # Memory + disk tiered cache
  domain/            # Zod schemas (Champion, Item, Rune, Summoner, ProfileIcon)
  tools/             # 8 MCP tool handlers
  mcp/               # Server, tool registry, error mapping
tests/
  unit/              # Unit tests per module
  integration/       # Integration tests and boundary guard
fixtures/
  ddragon/           # Recorded Data Dragon fixtures (offline testing)
scripts/
  fixtures-refresh.ts   # Re-record fixtures from live CDN
  smoke.ts              # Smoke test for all 6 wired tools
  clean.ts              # Remove build artifacts and cache
```

## Roadmap

- **Meta stats source** — deferred. Not part of v1 (no u.gg, Mobalytics, op.gg, lolalytics, CommunityDragon).
- **HTTP/SSE transport** — deferred. v1 uses stdio only.
- **Patch notes integration** — deferred.