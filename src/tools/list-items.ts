import { resolveVersion } from "../ddragon/versions";
import { getItemListPath } from "../ddragon/endpoints";
import { cacheKey } from "../cache/key";
import { parseItemFile } from "../domain/item";
import type { ItemRecord } from "../domain/item";
import type { ToolContext } from "./_ctx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Compact item record returned by list_items. */
export type CompactItem = {
  id: number;
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

const VERSION_CACHE_KEY = "ddragon:resolved-version:__singleton";

function itemListCacheKey(version: string, locale: string): string {
  return cacheKey(version, locale, getItemListPath(version, locale).replace(/^https:\/\/ddragon\.leagueoflegends\.com/, ""));
}

/** Map an ItemRecord to compact form. */
function toCompact(item: ItemRecord): CompactItem {
  return {
    id: item.id,
    name: item.name,
    plaintext: item.plaintext ?? "",
    gold: {
      total: item.gold.total,
      sell: item.gold.sell,
      base: item.gold.base,
    },
    // tags is Record<string, boolean> — compact form is the key array.
    tags: item.tags ? Object.keys(item.tags) : [],
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
      const cachedVersion = await ctx.cache.get(VERSION_CACHE_KEY);
      if (cachedVersion !== undefined) {
        version = cachedVersion as string;
      } else {
        const info = await resolveVersion();
        version = info.current;
        await ctx.cache.set(VERSION_CACHE_KEY, version);
      }
    }

    const ck = itemListCacheKey(version, locale);
    const cached = await ctx.cache.get(ck);
    if (cached !== undefined) {
      const parsed = cached as ListItemsOutput;
      return { ...parsed, locale };
    }

    const raw = await ctx.client.getItemList(version, locale);
    const file = parseItemFile(raw);

    const items: CompactItem[] = Object.values(file.data).map(toCompact);

    const result: ListItemsOutput = { version, locale, count: items.length, items };

    await ctx.cache.set(ck, result);

    return result;
  },
};