// Domain schemas — barrel export
// All schemas mirror Riot's Data Dragon JSON shapes exactly.

export {
  Locale,
  Version,
  ChampionId,
  ItemId,
} from "./shared.js";

export type {
  Locale as Locale,
  Version as Version,
  ChampionId as ChampionId,
  ItemId as ItemId,
} from "./shared.js";

export {
  ChampionRecord,
  ChampionFile,
  parseChampionFile,
  pickChampion,
} from "./champion.js";

export type {
  ChampionRecord as ChampionRecord,
  ChampionFile as ChampionFile,
  PickChampionResult as PickChampionResult,
} from "./champion.js";

export {
  ItemRecord,
  ItemFile,
  ItemImage,
  ItemGold,
  ItemStats,
  parseItemFile,
} from "./item.js";

export type {
  ItemRecord as ItemRecord,
  ItemFile as ItemFile,
  ItemImage as ItemImage,
  ItemGold as ItemGold,
  ItemStats as ItemStats,
} from "./item.js";

export {
  RuneTree,
  RuneTreesFile,
  RuneSlot,
  Rune,
  parseRuneTreesFile,
} from "./rune.js";

export type {
  RuneTree as RuneTree,
  RuneTreesFile as RuneTreesFile,
  RuneSlot as RuneSlot,
  Rune as Rune,
} from "./rune.js";

export {
  SummonerSpellRecord,
  SummonerSpellFile,
  SummonerSpellImage,
  parseSummonerSpellFile,
} from "./summoner.js";

export type {
  SummonerSpellRecord as SummonerSpellRecord,
  SummonerSpellFile as SummonerSpellFile,
  SummonerSpellImage as SummonerSpellImage,
} from "./summoner.js";

export {
  ProfileIconRecord,
  ProfileIconFile,
  ProfileIconImage,
  parseProfileIconFile,
} from "./profileicon.js";

export type {
  ProfileIconRecord as ProfileIconRecord,
  ProfileIconFile as ProfileIconFile,
  ProfileIconImage as ProfileIconImage,
} from "./profileicon.js";