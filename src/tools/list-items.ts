import { resolveVersion } from "../ddragon/versions";
import { getItemListPath } from "../ddragon/endpoints";
import { cacheKey } from "../cache/key";
import { resolvedVersionCacheKey } from "../cache/key";
import { parseItemFile, type ItemFile } from "../domain/item";
import type { ItemRecord } from "../domain/item";
import type { ToolContext } from "./_ctx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Compact item record returned by list_items. */
export type CompactItem = {
  name: string;
  plaintext: string;
  gold: { total: number; sell: number; base: number };
  tags: string[];
  image: { full: string };
};

/** Output of list_items tool. */
export type ListItemsOutput = {
  version: string;
  locale: string;
  count: number;
  items: CompactItem[];
};

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const InputSchema = {
  type: "object" as const,
  properties: {
    version: { type: "string" as const, description: "Data Dragon patch version (e.g. 14.10.1)" },
    locale: { type: "string" as const, description: "Locale code (e.g. en_US, es_ES)" },
  },
  required: [] as string[],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function itemListCacheKey(version: string, locale: string): string {
  return cacheKey(version, locale, getItemListPath(version, locale).replace(/^https:\/\/ddragon\.leagueoflegends\.com/, ""));
}

/** Map an ItemRecord to compact form. */
function toCompact(item: ItemRecord): CompactItem {
  return {
    name: item.name,
    plaintext: item.plaintext ?? "",
    gold: {
      total: item.gold.total,
      sell: item.gold.sell,
      base: item.gold.base,
    },
    tags: item.tags ?? [],
    image: { full: item.image.full },
  };
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const listItemsTool = {
  name: "list_items",
  description: "Returns a list of all items for a Data Dragon patch version.",
  inputSchema: InputSchema,

  async handler(
    input: { version?: string; locale?: string },
    ctx: ToolContext
  ): Promise<ListItemsOutput> {
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

    const ck = itemListCacheKey(version, locale);
    const cached = await ctx.cache.get(ck);
    let file: ItemFile | undefined;
    if (cached !== undefined) {
      file = cached as ItemFile;
    } else {
      const raw = await ctx.client.getItemList(version, locale);
      file = parseItemFile(raw);
      await ctx.cache.set(ck, file);
    }

    const items: CompactItem[] = Object.values(file.data).map(toCompact);

    const result: ListItemsOutput = { version, locale, count: items.length, items };

    return result;
  },
};