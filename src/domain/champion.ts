import { z } from "zod";
import { ChampionId, Version } from "./shared";

// ---------------------------------------------------------------------------
// ChampionRecord — single champion entry (the value inside data map)
// ---------------------------------------------------------------------------

/**
 * Schema for a single champion record from champion.json.
 * Mirrors Riot's Data Dragon structure exactly.
 * Uses `.passthrough()` because Riot occasionally adds fields without notice.
 */
export const ChampionRecord = z.object({
  version: z.string().optional(),
  id: z.string(),
  key: z.string(), // numeric as string, e.g. "266"
  name: z.string(),
  title: z.string(),
  blurb: z.string(),
  info: z.object({
    attack: z.number().int(),
    defense: z.number().int(),
    magic: z.number().int(),
    difficulty: z.number().int(),
  }),
  image: z.object({
    full: z.string(),
    sprite: z.string(),
    group: z.string(),
    x: z.number().int(),
    y: z.number().int(),
    w: z.number().int(),
    h: z.number().int(),
  }),
  tags: z.array(z.string()),
  partype: z.string(),
  stats: z.object({
    hp: z.number(),
    hpperlevel: z.number(),
    mp: z.number(),
    mpperlevel: z.number(),
    movespeed: z.number(),
    armor: z.number(),
    armorperlevel: z.number(),
    spellblock: z.number(),
    spellblockperlevel: z.number(),
    attackrange: z.number(),
    hpregen: z.number(),
    hpregenperlevel: z.number(),
    mpregen: z.number(),
    mpregenperlevel: z.number(),
    crit: z.number(),
    critperlevel: z.number(),
    attackdamage: z.number(),
    attackdamageperlevel: z.number(),
    attackspeedperlevel: z.number(),
    attackspeed: z.number(),
  }),
}).passthrough();

export type ChampionRecord = z.infer<typeof ChampionRecord>;

// ---------------------------------------------------------------------------
// ChampionFile — top-level champion.json structure
// ---------------------------------------------------------------------------

/**
 * Schema for the entire champion.json Data Dragon file.
 * Shape: `{ type: "champion", format: string, version: string, data: {...} }`
 */
export const ChampionFile = z.object({
  type: z.literal("champion"),
  format: z.string(),
  version: Version,
  data: z.record(ChampionId, ChampionRecord),
});

export type ChampionFile = z.infer<typeof ChampionFile>;

// ---------------------------------------------------------------------------
// parseChampionFile — helper to parse and validate a champion.json payload
// ---------------------------------------------------------------------------

export function parseChampionFile(payload: unknown) {
  return ChampionFile.parse(payload);
}

// ---------------------------------------------------------------------------
// pickChampion — resolve a champion by id (string) or key (numeric string)
// ---------------------------------------------------------------------------

export type PickChampionResult =
  | { ok: true; value: ChampionRecord }
  | { ok: false; error: "not_found" | "ambiguous" };

/**
 * Lookup a champion from a parsed ChampionFile by id or numeric key.
 * - id lookup is case-insensitive.
 * - key lookup matches the numeric key field as a string (e.g. "266").
 * Returns not_found if no match, ambiguous if multiple (shouldn't happen
 * with well-formed Data Dragon data but the guard is here for safety).
 */
export function pickChampion(
  file: ChampionFile,
  query: string
): PickChampionResult {
  const queryLower = query.toLowerCase();

  // Case-insensitive id match
  const byId = Object.values(file.data).filter(
    (c) => c.id.toLowerCase() === queryLower
  );
  if (byId.length === 1) return { ok: true, value: byId[0] };
  if (byId.length > 1) return { ok: false, error: "ambiguous" };

  // Numeric key match (key is stored as string, e.g. "266")
  const byKey = Object.values(file.data).filter((c) => c.key === query);
  if (byKey.length === 1) return { ok: true, value: byKey[0] };
  if (byKey.length > 1) return { ok: false, error: "ambiguous" };

  return { ok: false, error: "not_found" };
}