import {
  getChampionPath,
  getItemListPath,
  getRuneListPath,
  getSummonerSpellsPath,
  getVersionsPath,
} from "../ddragon/endpoints";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build a canonical cache key for a Data Dragon resource.
 * Format: ddragon:<version>:<locale>:<path>
 */
export function cacheKey(version: string, locale: string, path: string): string {
  return `ddragon:${version}:${locale}:${path}`;
}

/**
 * Build a cache key for a named resource type using its canonical CDN path.
 */
export function cacheKeyForResource(
  version: string,
  locale: string,
  resource: "champion" | "item" | "rune" | "summoner" | "versions"
): string {
  const path = canonicalPath(version, locale, resource);
  return cacheKey(version, locale, path);
}

/**
 * Cache key for the resolved live version string.
 *
 * Format: ddragon:__session:resolved-version:en_US
 *
 * The 4-segment shape matches DiskCache.keyToPath's strict format. The
 * `__session` "version" segment puts this entry in its own directory
 * (`<cacheDir>/ddragon/__session/...`) so the FIFO prune (which keeps the
 * newest 3 real Data Dragon versions) does not evict it. It is still
 * subject to TTL cleanup.
 *
 * The previous key `ddragon:resolved-version:__singleton` had only 2
 * segments and crashed at runtime with "Invalid cache key format" when
 * the server was run with the real TieredCache (memory + disk) — the bug
 * was hidden by the smoke test, which only uses MemoryCache.
 */
export function resolvedVersionCacheKey(): string {
  return "ddragon:__session:resolved-version:en_US";
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function canonicalPath(
  version: string,
  locale: string,
  resource: "champion" | "item" | "rune" | "summoner" | "versions"
): string {
  switch (resource) {
    case "champion":
      return getChampionPath(version, locale).replace(/^https:\/\/ddragon\.leagueoflegends\.com/, "");
    case "item":
      return getItemListPath(version, locale).replace(/^https:\/\/ddragon\.leagueoflegends\.com/, "");
    case "rune":
      return getRuneListPath(version, locale).replace(/^https:\/\/ddragon\.leagueoflegends\.com/, "");
    case "summoner":
      return getSummonerSpellsPath(version, locale).replace(/^https:\/\/ddragon\.leagueoflegends\.com/, "");
    case "versions":
      return getVersionsPath().replace(/^https:\/\/ddragon\.leagueoflegends\.com/, "");
  }
}