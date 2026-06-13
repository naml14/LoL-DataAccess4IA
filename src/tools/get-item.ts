import { resolveVersion } from "../ddragon/versions";
import { resolvedVersionCacheKey } from "../cache/key";
import { getItemFile } from "../ddragon/item-helpers";
import type { ItemRecord } from "../domain/item";
import type { ToolContext } from "./_ctx";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ItemNotFoundError extends Error {
  readonly code = "not-found";
  constructor(id: number) {
    super(`Item not found: ${id}`);
  }
}

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const InputSchema = {
  type: "object" as const,
  properties: {
    id: { type: "number" as const, description: "Numeric item ID (e.g. 1001)" },
    version: { type: "string" as const, description: "Data Dragon patch version (e.g. 14.10.1)" },
    locale: { type: "string" as const, description: "Locale code (e.g. en_US, es_ES)" },
  },
  required: ["id"],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const getItemTool = {
  name: "get_item",
  description: "Returns a single item record by numeric id.",
  inputSchema: InputSchema,

  async handler(
    input: { id: number; version?: string; locale?: string },
    ctx: ToolContext
  ): Promise<ItemRecord> {
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

    const itemRecord = file.data[String(input.id)];
    if (itemRecord === undefined) {
      throw new ItemNotFoundError(input.id);
    }

    return itemRecord;
  },
};