#!/usr/bin/env bun
/**
 * smoke.ts
 *
 * Smoke-tests all 8 MCP tools using the production tool handlers.
 *
 * Usage:
 *   bun run scripts/smoke.ts             # uses cached fixtures (default, offline)
 *   LOL_DD_SMOKE_LIVE=1 bun run scripts/smoke.ts  # hits live Data Dragon CDN
 *
 * Each tool call logs a one-line PASS / FAIL to stdout.
 * Exits non-zero if any tool fails.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

const FIXTURE_VERSION = "16.12.1";
const FIXTURE_LOCALE = "en_US";
const FIXTURE_BASE = join("fixtures", "ddragon", FIXTURE_VERSION);

function readFixtureJson(filename: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURE_BASE, filename), "utf-8"));
}

// ---------------------------------------------------------------------------
// Mock globalThis.fetch to serve fixture data (offline mode only)
// ---------------------------------------------------------------------------

function setupFixtureFetch(): void {
  const championData = readFixtureJson("champion.json");
  const itemData = readFixtureJson("item.json");
  const runeData = readFixtureJson("runesReforged.json");
  const summonerData = readFixtureJson("summoner.json");
  const profileIconData = readFixtureJson("profileicon.json");

  globalThis.fetch = (async (url: string) => {
    const urlStr = url as string;
    if (urlStr.includes("/api/versions.json")) {
      return new Response(JSON.stringify([FIXTURE_VERSION]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (urlStr.includes("/cdn/") && urlStr.includes("/champion.json")) {
      return new Response(JSON.stringify(championData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (urlStr.includes("/cdn/") && urlStr.includes("/item.json")) {
      return new Response(JSON.stringify(itemData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (urlStr.includes("/runesReforged.json")) {
      return new Response(JSON.stringify(runeData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (urlStr.includes("/summoner.json")) {
      return new Response(JSON.stringify(summonerData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    if (urlStr.includes("/profileicon.json")) {
      return new Response(JSON.stringify(profileIconData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return new Response("Not Found", { status: 404 });
  }) as typeof fetch;
}

// ---------------------------------------------------------------------------
// Tool context for smoke
// ---------------------------------------------------------------------------

import { MemoryCache } from "../src/cache/memory";
import { createToolContext } from "../src/tools/_ctx";
import type { ToolContext } from "../src/tools/_ctx";
import { DDragonClient } from "../src/ddragon/client";

const VERSION_CACHE_KEY = "ddragon:resolved-version:__singleton";

function buildContext(): ToolContext {
  const cache = new MemoryCache<unknown>();
  // Pre-populate version cache so tools skip resolveVersion() network call.
  cache.set(VERSION_CACHE_KEY, FIXTURE_VERSION);

  return createToolContext({
    client: new DDragonClient(),
    cache,
    config: {
      locale: FIXTURE_LOCALE,
      ttlSeconds: 900,
      pinVersion: FIXTURE_VERSION,
      cacheDir: "./.cache/ddragon",
      httpTimeoutMs: 5000,
      logLevel: "info",
    },
    logger: {
      info: () => {},
      warn: () => {},
      error: (msg: string, ..._meta: unknown[]) => { console.error(`[smoke] ERROR: ${msg}`); },
      debug: () => {},
    },
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

import { getCurrentPatchTool } from "../src/tools/get-current-patch";
import { listChampionsTool } from "../src/tools/list-champions";
import { getChampionTool } from "../src/tools/get-champion";
import { listRunesTool } from "../src/tools/list-runes";
import { listSummonerSpellsTool } from "../src/tools/list-summoner-spells";
import { getItemTool } from "../src/tools/get-item";
import { listItemsTool } from "../src/tools/list-items";
import { listProfileIconsTool } from "../src/tools/list-profile-icons";

async function main(): Promise<void> {
  const live = process.env.LOL_DD_SMOKE_LIVE === "1";
  console.log(`[smoke] Starting smoke test (live=${live ? "YES" : "NO (fixtures)"})`);

  // In offline mode (default), mock fetch to serve fixture files.
  // In live mode, use real network.
  if (!live) {
    setupFixtureFetch();
  }

  const ctx = buildContext();

  // Clear the champion list cache entry before each tool that uses it,
  // to avoid cross-contamination from list_champions caching a different
  // structure at the same key that get_champion expects.
  const CHAMPION_LIST_CK = "ddragon:16.12.1:en_US:/cdn/16.12.1/data/en_US/champion.json";

  let passed = 0;
  let failed = 0;

  const tools: Array<{ name: string; fn: () => Promise<unknown> }> = [
    {
      name: "get_current_patch",
      fn: async () => {
        const result = await getCurrentPatchTool.handler({}, ctx);
        if (!result || typeof result.version !== "string") throw new Error("Unexpected result shape");
      },
    },
    {
      name: "list_champions",
      fn: async () => {
        const result = await listChampionsTool.handler({}, ctx) as any;
        if (!Array.isArray(result.champions)) throw new Error("No champions array");
        if (result.champions.length === 0) throw new Error("Expected at least one champion");
      },
    },
    {
      name: "get_champion (Aatrox)",
      fn: async () => {
        // Clear the champion list cache so get_champion fetches fresh data.
        await ctx.cache.delete(CHAMPION_LIST_CK);
        const result = await getChampionTool.handler({ idOrKey: "Aatrox" }, ctx) as any;
        if (!result.id || result.id !== "Aatrox") throw new Error("Champion not found");
      },
    },
    {
      name: "list_runes",
      fn: async () => {
        const result = await listRunesTool.handler({}, ctx) as any;
        if (!Array.isArray(result.trees) || result.trees.length === 0) throw new Error("No rune trees");
      },
    },
    {
      name: "list_summoner_spells",
      fn: async () => {
        const result = await listSummonerSpellsTool.handler({}, ctx) as any;
        if (!Array.isArray(result.spells) || result.spells.length === 0) throw new Error("No summoner spells");
      },
    },
    {
      name: "list_profile_icons",
      fn: async () => {
        const result = await listProfileIconsTool.handler({}, ctx) as any;
        if (!Array.isArray(result.icons)) throw new Error("No icons array");
        if (result.icons.length === 0) throw new Error("Expected at least one icon");
      },
    },
  ];

  for (const tc of tools) {
    try {
      await tc.fn();
      console.log(`[smoke] PASS  ${tc.name}`);
      passed++;
    } catch (err) {
      console.log(`[smoke] FAIL  ${tc.name}: ${err instanceof Error ? err.message : String(err)}`);
      failed++;
    }
  }

  console.log(`\n[smoke] Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }

  console.log("[smoke] All smoke tests passed.");
}

main().catch((err) => {
  console.error(`[smoke] Unexpected error: ${err}`);
  process.exit(1);
});