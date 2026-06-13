import { resolveVersion } from "../ddragon/versions";
import { resolvedVersionCacheKey } from "../cache/key";
import { getItemFile } from "../ddragon/item-helpers";
import { pickItemCanonicalForMap } from "../domain/item";
import type { ItemRecord } from "../domain/item";
import type { ToolContext } from "./_ctx";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const InputSchema = {
  type: "object" as const,
  properties: {
    name: {
      type: "string" as const,
      description:
        "Exact item name to search for (case-insensitive). " +
        "If multiple items share the same name across different game modes, " +
        "use get_items_by_name first to see all variants, then pass the " +
        "appropriate mapId here to select the canonical record for a given mode.",
      minLength: 1,
    },
    mapId: {
      type: "string" as const,
      description:
        "Map identifier. Supported aliases: summoners_rift (11), howling_abyss (12), " +
        "nexus_blitz (21), 2v2 (22), arena (30), cherry (33), brawl (35). " +
        "Also accepts stringified numeric form (e.g. '11', '30'). " +
        "Unknown values pass through as-is for forward-compatibility.",
      minLength: 1,
    },
    version: {
      type: "string" as const,
      description: "Data Dragon patch version (e.g. 14.10.1)",
    },
    locale: {
      type: "string" as const,
      description: "Locale code (e.g. en_US, es_ES)",
    },
  },
  required: ["name", "mapId"],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const getItemCanonicalForMapTool = {
  name: "get_item_canonical_for_map",
  description:
    "Returns items matching a given name that are available on a specific game mode, " +
    "as a JSON array. The mapId accepts either a human-readable alias " +
    "(summoners_rift, howling_abyss, nexus_blitz, 2v2, arena, cherry, brawl) " +
    "or a stringified numeric ID (11, 12, 21, 22, 30, 33, 35). " +
    "When multiple items match the name+mapId combination, all are returned. " +
    "If you need to see all variants of an item across all game modes, " +
    "call get_items_by_name first to find all matching records.",
  inputSchema: InputSchema,

  async handler(
    input: { name: string; mapId: string; version?: string; locale?: string },
    ctx: ToolContext
  ): Promise<ItemRecord[]> {
    const locale = input.locale ?? ctx.config.locale;

    let version: string;
    if (input.version) {
      version = input.version;
    } else {
      const cachedVersion = await ctx.cache.get(resolvedVersionCacheKey());
      if (cachedVersion !== undefined) {
        version = cachedVersion as string;
      } else {
        const info = await resolveVersion();
        version = info.current;
        await ctx.cache.set(resolvedVersionCacheKey(), version);
      }
    }

    const file = await getItemFile(version, locale, ctx.client, ctx.cache);
    return pickItemCanonicalForMap(file.data, input.name, input.mapId);
  },
};
