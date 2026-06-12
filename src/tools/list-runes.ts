import { resolveVersion } from "../ddragon/versions";
import { getRuneListPath } from "../ddragon/endpoints";
import { cacheKey } from "../cache/key";
import { resolvedVersionCacheKey } from "../cache/key";
import { parseRuneTreesFile } from "../domain/rune";
import type { ToolContext } from "./_ctx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Compact rune detail within a slot. */
export type RuneDetail = {
  id: number;
  key: string;
  name: string;
  icon: string;
  shortDesc: string;
  longDesc: string;
};

/** Compact rune slot within a tree. */
export type RuneSlot = {
  slotLabel: string;
  runes: RuneDetail[];
};

/** Compact rune tree (e.g. Precision, Domination). */
export type RuneTree = {
  id: number;
  key: string;
  name: string;
  icon: string;
  slots: RuneSlot[];
};

/** Output of list_runes tool. */
export type ListRunesOutput = {
  version: string;
  locale: string;
  trees: RuneTree[];
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

function runeListCacheKey(version: string, locale: string): string {
  return cacheKey(version, locale, getRuneListPath(version, locale).replace(/^https:\/\/ddragon\.leagueoflegends\.com/, ""));
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const listRunesTool = {
  name: "list_runes",
  description: "Returns the full list of rune trees for a Data Dragon patch version.",
  inputSchema: InputSchema,

  async handler(
    input: { version?: string; locale?: string },
    ctx: ToolContext
  ): Promise<ListRunesOutput> {
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

    const ck = runeListCacheKey(version, locale);
    const cached = await ctx.cache.get(ck);
    if (cached !== undefined) {
      const parsed = cached as ListRunesOutput;
      return { ...parsed, locale };
    }

    const raw = await ctx.client.getRuneList(version, locale);
    const trees = parseRuneTreesFile(raw);

    const result: ListRunesOutput = { version, locale, trees };

    await ctx.cache.set(ck, result);

    return result;
  },
};