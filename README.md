# lol-datadragon-mcp

**MCP server for Riot Data Dragon — pure data layer, no reasoning.**

An LLM that needs raw LoL game data (champions, items, runes, summoner spells, current patch) gets it here. The LLM reasons; we serve data. This server **does not** compute, rank, score, or recommend anything.

## Status

**v1.0 release** — Phase 7 complete. The MCP server exposes 8 tools over stdio transport.

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

The boundary test enforces this contract:

```typescript
const FORBIDDEN = /best|recommended|tier\s*list|tier\s*[sS]|should\s+(?:you|build|pick)|meta\s+pick|strong\s+pick|optimal\s*build|top\s*build|pro\s*build|build\s*order/gi;
```

All tool responses are scanned against this regex. Any match is a test failure. Contributors must ensure no such language appears in tool descriptions, input schemas, or response data.

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
bun run typecheck               # TypeScript type checking
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
  smoke.ts              # Smoke test for all 8 tools
```

## Roadmap

- **Meta stats source** — deferred. Not part of v1 (no u.gg, Mobalytics, op.gg, lolalytics, CommunityDragon).
- **HTTP/SSE transport** — deferred. v1 uses stdio only.
- **Patch notes integration** — deferred.