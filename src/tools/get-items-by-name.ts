import { resolveVersion } from "../ddragon/versions";
import { resolvedVersionCacheKey } from "../cache/key";
import { getItemFile } from "../ddragon/item-helpers";
import { pickItemsByName } from "../domain/item";
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
        "Returns all map-variants in an array when multiple items share the name. " +
        "Use the returned maps field to disambiguate items across game modes.",
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
  required: ["name"],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const getItemsByNameTool = {
  name: "get_items_by_name",
  description:
    "Returns all items matching a given name as a JSON array. " +
    "The match is case-insensitive and exact (substring does not match). " +
    "When multiple items share the same name across different game modes, " +
    "all matching records are returned — use the maps field in each record " +
    "to determine which game mode(s) the item is available in.",
  inputSchema: InputSchema,

  async handler(
    input: { name: string; version?: string; locale?: string },
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
    return pickItemsByName(file.data, input.name);
  },
};
