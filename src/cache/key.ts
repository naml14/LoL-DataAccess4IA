import {
  getChampionPath,
  getItemListPath,
  getRuneListPath,
  getSummonerSpellsPath,
  getProfileIconPath,
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
  resource: "champion" | "item" | "rune" | "summoner" | "profileicon" | "versions"
): string {
  const path = canonicalPath(version, locale, resource);
  return cacheKey(version, locale, path);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function canonicalPath(
  version: string,
  locale: string,
  resource: "champion" | "item" | "rune" | "summoner" | "profileicon" | "versions"
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
    case "profileicon":
      return getProfileIconPath(version, locale).replace(/^https:\/\/ddragon\.leagueoflegends\.com/, "");
    case "versions":
      return getVersionsPath().replace(/^https:\/\/ddragon\.leagueoflegends\.com/, "");
  }
}