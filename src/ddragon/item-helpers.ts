/**
 * Shared item data fetching and caching helper.
 *
 * Both list_items and get_item (and the new name-based lookups) MUST cache
 * the raw ItemFile under the same canonical key so that cache reads are
 * shared and there is no structure collision.
 *
 * Each tool then parses the shared cached file independently.
 */

import { parseItemFile } from "../domain/item";
import type { ItemFile } from "../domain/item";
import { getItemListPath } from "./endpoints";
import { cacheKey } from "../cache/key";
import type { DDragonClient } from "./client";
import type { TieredCache } from "../cache/tiered";
import type { MemoryCache } from "../cache/memory";

/**
 * Cache key for the raw item.json file (shared by all item tools).
 * Format: ddragon:<version>:<locale>:/cdn/<version>/data/<locale>/item.json
 */
export function itemDataKey(version: string, locale: string): string {
  return cacheKey(version, locale, getItemListPath(version, locale).replace(/^https:\/\/ddragon\.leagueoflegends\.com/, ""));
}

/**
 * Fetch and cache the raw ItemFile for a given (version, locale).
 *
 * Uses the shared item data cache key so all item tools read from / write
 * to the same cache entry.
 *
 * @returns Parsed ItemFile (validated with Zod)
 */
export async function getItemFile(
  version: string,
  locale: string,
  client: DDragonClient,
  cache: TieredCache<unknown> | MemoryCache<unknown>
): Promise<ItemFile> {
  const ck = itemDataKey(version, locale);
  const cached = await cache.get(ck);
  if (cached !== undefined) {
    return cached as ItemFile;
  }
  const raw = await client.getItemList(version, locale);
  const file = parseItemFile(raw);
  await cache.set(ck, file);
  return file;
}
