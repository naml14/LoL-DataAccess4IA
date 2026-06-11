#!/usr/bin/env bun
/**
 * fixtures-refresh.ts
 *
 * Re-records Data Dragon fixtures from the live CDN into fixtures/ddragon/<version>/.
 *
 * Usage:
 *   bun run scripts/fixtures-refresh.ts              # refreshes current version
 *   LOL_DD_VERSION=16.12.1 bun run scripts/fixtures-refresh.ts  # specific version
 *
 * The script is idempotent — re-running overwrites the existing fixture files.
 * Exits non-zero on network errors.
 */

import { resolveVersion } from "../src/ddragon/versions";
import { DDragonClient } from "../src/ddragon/client";
import { parseChampionFile } from "../src/domain/champion";
import { parseItemFile } from "../src/domain/item";
import { parseRuneTreesFile } from "../src/domain/rune";
import { parseSummonerSpellFile } from "../src/domain/summoner";
import { parseProfileIconFile } from "../src/domain/profileicon";

// ---------------------------------------------------------------------------
// Config — read LOL_DD_VERSION or resolve from CDN
// ---------------------------------------------------------------------------

const targetVersion = process.env.LOL_DD_VERSION ?? null;

async function resolveTargetVersion(): Promise<string> {
  if (targetVersion !== null) {
    console.log(`[fixtures-refresh] Using pinned version from LOL_DD_VERSION: ${targetVersion}`);
    return targetVersion;
  }
  console.log("[fixtures-refresh] Resolving current version from CDN...");
  const info = await resolveVersion();
  console.log(`[fixtures-refresh] Current version: ${info.current}`);
  return info.current;
}

// ---------------------------------------------------------------------------
// Fixture write helper
// ---------------------------------------------------------------------------

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function writeFixture(baseDir: string, filename: string, data: unknown): void {
  const dir = join(baseDir);
  mkdirSync(dir, { recursive: true });
  const filepath = join(dir, filename);
  writeFileSync(filepath, JSON.stringify(data, null, 2), "utf-8");
  console.log(`[fixtures-refresh] Wrote ${filepath}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log("[fixtures-refresh] Starting fixture refresh...");
  console.log("[fixtures-refresh] Fixture directory: fixtures/ddragon/");

  let version: string;
  try {
    version = await resolveTargetVersion();
  } catch (err) {
    console.error(`[fixtures-refresh] FATAL: Could not resolve version: ${err}`);
    process.exit(1);
  }

  const fixtureDir = join("fixtures", "ddragon", version);
  const locale = process.env.LOL_DD_LOCALE ?? "en_US";

  // Use a throwaway client; no cache needed for one-shot fetch.
  const client = new DDragonClient({ retries: 2 });

  const files: string[] = [];

  // 1. Champion list
  try {
    console.log(`[fixtures-refresh] Fetching champion.json (v${version}, ${locale})...`);
    const raw = await client.getChampionList(version, locale);
    const parsed = parseChampionFile(raw);
    writeFixture(fixtureDir, "champion.json", parsed);
    files.push("champion.json");
  } catch (err) {
    console.error(`[fixtures-refresh] FATAL: Failed to fetch champion.json: ${err}`);
    process.exit(1);
  }

  // 2. Item list
  try {
    console.log(`[fixtures-refresh] Fetching item.json (v${version}, ${locale})...`);
    const raw = await client.getItemList(version, locale);
    const parsed = parseItemFile(raw);
    writeFixture(fixtureDir, "item.json", parsed);
    files.push("item.json");
  } catch (err) {
    console.error(`[fixtures-refresh] FATAL: Failed to fetch item.json: ${err}`);
    process.exit(1);
  }

  // 3. Runes
  try {
    console.log(`[fixtures-refresh] Fetching runesReforged.json (v${version}, ${locale})...`);
    const raw = await client.getRuneList(version, locale);
    const parsed = parseRuneTreesFile(raw);
    writeFixture(fixtureDir, "runesReforged.json", parsed);
    files.push("runesReforged.json");
  } catch (err) {
    console.error(`[fixtures-refresh] FATAL: Failed to fetch runesReforged.json: ${err}`);
    process.exit(1);
  }

  // 4. Summoner spells
  try {
    console.log(`[fixtures-refresh] Fetching summoner.json (v${version}, ${locale})...`);
    const raw = await client.getSummonerList(version, locale);
    const parsed = parseSummonerSpellFile(raw);
    writeFixture(fixtureDir, "summoner.json", parsed);
    files.push("summoner.json");
  } catch (err) {
    console.error(`[fixtures-refresh] FATAL: Failed to fetch summoner.json: ${err}`);
    process.exit(1);
  }

  // 5. Profile icons
  try {
    console.log(`[fixtures-refresh] Fetching profileicon.json (v${version}, ${locale})...`);
    const raw = await client.getProfileIconList(version, locale);
    const parsed = parseProfileIconFile(raw);
    writeFixture(fixtureDir, "profileicon.json", parsed);
    files.push("profileicon.json");
  } catch (err) {
    console.error(`[fixtures-refresh] FATAL: Failed to fetch profileicon.json: ${err}`);
    process.exit(1);
  }

  console.log(`[fixtures-refresh] Done. Recorded ${files.length} fixture files for v${version} under ${fixtureDir}`);
  console.log(`[fixtures-refresh] Files: ${files.join(", ")}`);
}

main().catch((err) => {
  console.error(`[fixtures-refresh] Unexpected error: ${err}`);
  process.exit(1);
});