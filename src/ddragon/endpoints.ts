const BASE = "https://ddragon.leagueoflegends.com";

export function getChampionPath(version: string, locale: string): string {
  return `${BASE}/cdn/${version}/data/${locale}/champion.json`;
}

export function getChampionDetailPath(
  version: string,
  locale: string,
  championId: string
): string {
  return `${BASE}/cdn/${version}/data/${locale}/champion/${championId}.json`;
}

export function getItemListPath(version: string, locale: string): string {
  return `${BASE}/cdn/${version}/data/${locale}/item.json`;
}

export function getRuneListPath(version: string, locale: string): string {
  return `${BASE}/cdn/${version}/data/${locale}/runesReforged.json`;
}

export function getSummonerSpellsPath(version: string, locale: string): string {
  return `${BASE}/cdn/${version}/data/${locale}/summoner.json`;
}

export function getVersionsPath(): string {
  return `${BASE}/api/versions.json`;
}