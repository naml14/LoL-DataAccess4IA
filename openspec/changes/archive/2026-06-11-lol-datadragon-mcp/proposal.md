# Proposal: lol-datadragon-mcp

## Intent

An LLM answering "what is the best build for X" needs **raw, current, structured LoL data** — champions, items, runes, summoner spells, the current patch. The LLM reasons; we serve data. Data lives on Riot's static Data Dragon CDN; reaching it cleanly from an LLM client requires a thin, typed MCP server. **First deliverable** of `LoL-DataAccess4IA`: one canonical current source of LoL data, a strict data-only contract, and a runtime-resolved patch (never hardcoded).

## What Changes

### In Scope
- stdio MCP server on `@modelcontextprotocol/sdk`, TypeScript, Bun.
- HTTP client for `ddragon.leagueoflegends.com` (retry, timeout, typed errors).
- Version resolver: `GET /api/versions.json` at startup, refresh on TTL (15 min default, env-configurable).
- Disk + in-memory cache keyed by `(version, locale, path)`.
- Eight MCP tools: `get_current_patch`, `list_champions`, `get_champion`, `list_items`, `get_item`, `list_runes`, `list_summoner_spells`, `get_profile_icons`.
- Strict TDD — every layer test-first; `bun test` green; `bun tsc --noEmit` clean.

### Out of Scope — Non-Reasoning Boundary (LOUD)

**This server is a pure data layer. It MUST NOT reason, rank, tier-list, score, or recommend "best builds".** Reasoning belongs to the LLM. Future contributors MUST NOT add output fields like `best`, `optimal`, `tier`, `score`, `winrate`. Tests assert the data-only contract.

Also out: no meta stats (u.gg, Mobalytics, op.gg, lolalytics, CommunityDragon meta — deferred) · no Riot API key · no community CDNs · no SSE/HTTP (stdio v1) · no mutation endpoints.

## Impact (Affected Specs)

### New Capabilities — `openspec/specs/` is empty, all new
- `mcp-server` — runtime, stdio transport, tool registration, error envelope.
- `data-dragon-client` — HTTP client to Data Dragon, retry, timeout, parse errors.
- `data-versioning` — `versions.json` consumer, current-patch resolution, TTL/refresh, locale.
- `data-cache` — per-version disk + memory cache, invalidation, force-refresh.
- `game-data` — typed records: Champion, Item, RuneTree, RuneSlot, SummonerSpell, ProfileIcon, Patch.
- `mcp-tools` — the eight tool contracts (input schema, output schema, error codes).

### Modified Capabilities
None — greenfield.

## Approach

Bottom-up TDD, each layer with a failing test first: `data-dragon-client` (HTTP+parse) → `data-versioning` (head of `versions.json`) → `data-cache` (keyed `(version, locale, path)`, disk under `LOL_DD_CACHE_DIR`, in-memory `Map` with TTL) → `game-data` (typed records) → `mcp-tools` (8 handlers, Zod input) → `mcp-server` (registers tools, connects stdio).

**Error envelope**: typed payload or `{ error: { code, message, hint } }`. No thrown exceptions cross MCP.
**Config (env)**: `LOL_DD_LOCALE` (`en_US`), `LOL_DD_VERSION_TTL_MS` (900000), `LOL_DD_CACHE_DIR` (temp), `LOL_DD_PIN_VERSION` (rollback).
**Deps**: `@modelcontextprotocol/sdk` (stdio) · `zod` (spec may swap `valibot`) · `typescript` · `bun` · network to `ddragon.leagueoflegends.com` (no key).

## Risks

| Risk | Lik | Mitigation |
|------|-----|------------|
| Future contributor adds "best build" logic | Med | Loud boundary + design doc + tests asserting no derived fields. |
| Data Dragon URL shape changes for a future patch | Low | Unknown endpoints → soft errors; tools degrade gracefully. |
| Network unreachable at startup | Med | Fall back to last-known-good cached version; fail fast if no cache. |
| `champion.json` payload size (~5–10 MB) | Low | Stream to disk, read on demand. |

## Open Questions

Confirm in spec phase: `en_US` default + per-tool override · TTL 15 min · `get_champion` returns full `champion.json` (stats + abilities + tips + lore) · `get_champion` accepts `id` and numeric `key`, case-insensitive · disk cache keeps last 3 versions.

## Rollback Plan

- **Pre-merge**: `git revert`. Greenfield — no dependents.
- **Post-deploy**: `bun run src/cli.ts clear-cache`; restart; re-fetch.
- **Corrupt data**: `LOL_DD_PIN_VERSION=14.10.1` bypasses version resolution.
- Rollback MUST NOT require code changes.

## Success Criteria

- [ ] `bun test` green; coverage on `data-versioning`, `data-cache`, `data-dragon-client` ≥ 90%.
- [ ] All eight tools respond with typed payloads or typed errors against live Data Dragon.
- [ ] Server reports the head of `versions.json` at verify time — no hardcoded version in source.
- [ ] `bun tsc --noEmit` clean.
- [ ] Test asserts no tool output contains `winrate`/`tier`/`score`/`best` — proves data-only contract.
- [ ] `verify-report.md` shows every spec scenario passing.
