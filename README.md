# lol-datadragon-mcp

**MCP server for Riot Data Dragon — pure data layer, no reasoning.**

An LLM that needs raw LoL game data (champions, items, runes, summoner spells, current patch) gets it here. The LLM reasons; we serve data. This server **does not** compute, rank, score, or recommend anything.

## Status

**Phase 1 of 7** — Scaffold, TypeScript/Bun config, and typed env configuration. Each phase ships as a reviewable PR slice.

## Quick start

```bash
bun install
bun test
```

## Environment variables

| Variable | Default | Range | Description |
|---|---|---|---|
| `LOL_DD_LOCALE` | `en_US` | Riot locale code | Baseline locale for all requests |
| `LOL_DD_TTL_SECONDS` | `900` | `60`–`86400` | TTL for version lookups and cache |
| `LOL_DD_PIN_VERSION` | _(none)_ | `MAJOR.MINOR.PATCH` | Override version resolution |
| `LOL_DD_CACHE_DIR` | `./.cache/ddragon` | writable path | Disk cache root |
| `LOL_DD_HTTP_TIMEOUT_MS` | `5000` | `100`–`60000` | Per-request HTTP timeout |
| `LOL_DD_LOG_LEVEL` | `info` | `debug\|info\|warn\|error` | Log verbosity |

## SDK pin policy

`@modelcontextprotocol/sdk` is pinned to a **stable minor** version. The current pin is `1.29.0`. Re-evaluate on every minor bump; update the pin and this README when a new stable minor is confirmed safe.

## Non-Reasoning Boundary (LOUD)

This server is a **pure data layer**. It MUST NOT expose fields like `best`, `optimal`, `tier`, `score`, `winrate`, or `recommended`. Any output that appears to reason about "what is best" is a bug. The boundary test in Phase 6 asserts this contract.

## Project structure

```
src/
  config.ts   # Zod-validated env parsing (Phase 1)
  index.ts    # Entry point (Phase 1)
  ...         # ddragon/, cache/, domain/, tools/, mcp/ (later phases)
tests/
  unit/       # Unit tests per module
  integration/# Integration and boundary tests (Phase 6)
```

## Phases

| Phase | Content |
|---|---|
| 1 | Scaffold, Bun+TypeScript, env config |
| 2 | Data Dragon HTTP client + version resolver |
| 3 | Memory + disk cache layer |
| 4 | Zod domain schemas (Champion, Item, Rune, …) |
| 5 | Eight MCP tool handlers |
| 6 | Server wiring + boundary test |
| 7 | Fixtures + smoke script |

## Testing

```bash
bun test          # run all tests
bun test --bail   # stop on first failure
```