import { z } from "zod";
import { Version } from "./shared";

// ---------------------------------------------------------------------------
// ItemImage
// ---------------------------------------------------------------------------

const ItemImage = z.object({
  full: z.string(),
  sprite: z.string(),
  group: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int(),
  h: z.number().int(),
});

export type ItemImage = z.infer<typeof ItemImage>;

// ---------------------------------------------------------------------------
// ItemGold
// ---------------------------------------------------------------------------

const ItemGold = z.object({
  base: z.number().int(),
  purchasable: z.boolean(),
  total: z.number().int(),
  sell: z.number().int(),
});

export type ItemGold = z.infer<typeof ItemGold>;

// ---------------------------------------------------------------------------
// ItemStats
// ---------------------------------------------------------------------------

/**
 * Item stats — uses passthrough since Riot adds stat keys liberally.
 * Known keys: flatMovementSpeed, percentAttackSpeedMod, abilityPower, etc.
 */
const ItemStats = z.object({}).passthrough();

export type ItemStats = z.infer<typeof ItemStats>;

// ---------------------------------------------------------------------------
// ItemRecord — single item entry from item.json
// ---------------------------------------------------------------------------

/**
 * Schema for a single item record from item.json.
 * Mirrors Riot's Data Dragon structure.
 * Uses `.passthrough()` for stats and tags since Riot adds keys freely.
 */
export const ItemRecord = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string(),
  colloq: z.string().optional(),
  plaintext: z.string().optional(),
  into: z.array(z.number().int()).optional(),
  from: z.array(z.number().int()).optional(),
  image: ItemImage,
  gold: ItemGold,
  tags: z.record(z.string(), z.boolean()).optional(),
  maps: z.record(z.string(), z.boolean()).optional(),
  stats: ItemStats.optional(),
}).passthrough();

export type ItemRecord = z.infer<typeof ItemRecord>;

// ---------------------------------------------------------------------------
// ItemFile — top-level item.json structure
// ---------------------------------------------------------------------------

/**
 * Schema for the entire item.json Data Dragon file.
 * Shape: `{ type: "item", version: string, data: { [id: string]: ItemRecord } }`
 *
 * Note: JSON object keys are always strings. Data Dragon uses numeric IDs as
 * string keys (e.g. "1001", "3006"). We coerce/validate with preprocess.
 */
export const ItemFile = z.object({
  type: z.literal("item"),
  version: Version,
  data: z.record(
    z.string().regex(/^\d+$/, "Item ID must be a numeric string"),
    ItemRecord
  ),
});

export type ItemFile = z.infer<typeof ItemFile>;

// ---------------------------------------------------------------------------
// parseItemFile
// ---------------------------------------------------------------------------

export function parseItemFile(payload: unknown): ItemFile {
  return ItemFile.parse(payload);
}