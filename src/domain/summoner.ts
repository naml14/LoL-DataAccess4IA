import { z } from "zod";
import { Version } from "./shared";

// ---------------------------------------------------------------------------
// SummonerSpellImage
// ---------------------------------------------------------------------------

const SummonerSpellImage = z.object({
  full: z.string(),
  sprite: z.string(),
  group: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int(),
  h: z.number().int(),
});

export type SummonerSpellImage = z.infer<typeof SummonerSpellImage>;

// ---------------------------------------------------------------------------
// SummonerSpellRecord — single summoner spell entry
// ---------------------------------------------------------------------------

/**
 * Schema for a single summoner spell record from summoner.json.
 * Mirrors Riot's Data Dragon structure exactly.
 * Uses `.passthrough()` since Riot occasionally adds fields without notice.
 */
export const SummonerSpellRecord = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  key: z.string(),
  tooltip: z.string().optional(),
  maxrank: z.number().int().optional(),
  cooldown: z.array(z.number().int()).optional(),
  summonerLevel: z.number().int(),
  modes: z.array(z.string()).optional(),
  icon: z.string(),
  image: SummonerSpellImage,
}).passthrough();

export type SummonerSpellRecord = z.infer<typeof SummonerSpellRecord>;

// ---------------------------------------------------------------------------
// SummonerSpellFile — top-level summoner.json structure
// ---------------------------------------------------------------------------

/**
 * Schema for the entire summoner.json Data Dragon file.
 * Shape: `{ type: "summoner", version: string, data: { [id: string]: SummonerSpellRecord } }`
 */
export const SummonerSpellFile = z.object({
  type: z.literal("summoner"),
  version: Version,
  data: z.record(z.string(), SummonerSpellRecord),
});

export type SummonerSpellFile = z.infer<typeof SummonerSpellFile>;

// ---------------------------------------------------------------------------
// parseSummonerSpellFile
// ---------------------------------------------------------------------------

export function parseSummonerSpellFile(payload: unknown): SummonerSpellFile {
  return SummonerSpellFile.parse(payload);
}