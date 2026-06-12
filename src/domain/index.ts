// Domain types — minimal barrel for external consumers.
// Internal src/ imports prefer direct module paths.
export type { Locale, Version, ChampionId, ItemId } from "./shared.js";
export type {
  ChampionRecord,
  ChampionFile,
  PickChampionResult,
} from "./champion.js";
export type {
  ItemRecord,
  ItemFile,
  ItemImage,
  ItemGold,
  ItemStats,
} from "./item.js";
export type { RuneTree, RuneTreesFile, RuneSlot, Rune } from "./rune.js";
export type {
  SummonerSpellRecord,
  SummonerSpellFile,
  SummonerSpellImage,
} from "./summoner.js";