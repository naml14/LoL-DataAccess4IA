/**
 * Shared champion data fetching and caching helper.
 *
 * Both list_champions and get_champion MUST cache the raw ChampionFile
 * (the JSON from Data Dragon CDN) under the same canonical key so that
 * cache reads are shared and there is no structure collision.
 *
 * Each tool then parses the shared cached file independently.
 */

import { parseChampionFile } from "../domain/champion";
import type { ChampionFile } from "../domain/champion";
import { getChampionPath } from "./endpoints";
import { cacheKey } from "../cache/key";
import type { DDragonClient } from "./client";
import type { TieredCache } from "../cache/tiered";
import type { MemoryCache } from "../cache/memory";

/**
 * Cache key for the raw champion.json file (shared by all champion tools).
 * Format: ddragon:<version>:<locale>:/cdn/<version>/data/<locale>/champion.json
 */
export function championDataKey(version: string, locale: string): string {
  return cacheKey(version, locale, getChampionPath(version, locale).replace(/^https:\/\/ddragon\.leagueoflegends\.com/, ""));
}

/**
 * Fetch and cache the raw ChampionFile for a given (version, locale).
 *
 * Uses the shared champion data cache key so both list_champions and
 * get_champion read from / write to the same cache entry.
 *
 * @returns Parsed ChampionFile (validated with Zod)
 */
export async function getChampionFile(
  version: string,
  locale: string,
  client: DDragonClient,
  cache: TieredCache<unknown> | MemoryCache<unknown>
): Promise<ChampionFile> {
  const ck = championDataKey(version, locale);
  const cached = await cache.get(ck);
  if (cached !== undefined) {
    return cached as ChampionFile;
  }
  const raw = await client.getChampionList(version, locale);
  const file = parseChampionFile(raw);
  await cache.set(ck, file);
  return file;
}