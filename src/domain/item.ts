import { z } from "zod";
import { Version } from "./shared";
import { resolveMapId } from "./maps";

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
  id: z.number().int().optional(),
  name: z.string(),
  description: z.string(),
  colloq: z.string().optional(),
  plaintext: z.string().optional(),
  into: z.array(z.string()).optional(),
  from: z.array(z.string()).optional(),
  image: ItemImage,
  gold: ItemGold,
  tags: z.array(z.string()).optional(),
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

// ---------------------------------------------------------------------------
// pickItemsByName
// ---------------------------------------------------------------------------

/**
 * Pick all items whose name matches the given string (case-insensitive exact match).
 * Returns an empty array when no items match.
 *
 * @param itemData - The parsed ItemFile.data (record of string → ItemRecord)
 * @param name - The name to match (case-insensitive exact match)
 * @returns Array of matching ItemRecord entries (may be empty)
 */
export function pickItemsByName(
  itemData: Record<string, ItemRecord>,
  name: string
): ItemRecord[] {
  const lower = name.toLowerCase();
  return Object.values(itemData).filter((item) => item.name.toLowerCase() === lower);
}

// ---------------------------------------------------------------------------
// pickItemCanonicalForMap
// ---------------------------------------------------------------------------

/**
 * Pick all items whose name matches AND that have `maps[resolvedMapId] === true`.
 * The resolved map ID is obtained by calling `resolveMapId(mapId)`.
 *
 * Returns an empty array when no items match or when an item has no `maps` field.
 *
 * @param itemData - The parsed ItemFile.data (record of string → ItemRecord)
 * @param name - The item name to match (case-insensitive exact match)
 * @param mapId - A map alias or stringified numeric ID
 * @returns Array of matching ItemRecord entries (may be empty)
 */
export function pickItemCanonicalForMap(
  itemData: Record<string, ItemRecord>,
  name: string,
  mapId: string
): ItemRecord[] {
  const resolved = resolveMapId(mapId);
  return pickItemsByName(itemData, name).filter(
    (item) => item.maps !== undefined && item.maps[resolved] === true
  );
}