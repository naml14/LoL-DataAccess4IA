import { resolveVersion } from "../ddragon/versions";
import { getChampionFile } from "../ddragon/champion-helpers";
import type { ChampionRecord } from "../domain/champion";
import type { ToolContext } from "./_ctx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Compact champion record returned by list_champions. */
export type CompactChampion = {
  id: string;
  key: string;
  name: string;
  title: string;
  tags: string[];
  blurb: string;
};

/** Output of list_champions tool. */
export type ListChampionsOutput = {
  version: string;
  locale: string;
  champions: CompactChampion[];
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

/** Map a ChampionRecord to compact form. */
function toCompact(champ: ChampionRecord): CompactChampion {
  return {
    id: champ.id,
    key: champ.key,
    name: champ.name,
    title: champ.title,
    tags: champ.tags,
    blurb: champ.blurb,
  };
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const listChampionsTool = {
  name: "list_champions",
  description: "Returns a list of all champions for a Data Dragon patch version.",
  inputSchema: InputSchema,

  async handler(
    input: { version?: string; locale?: string },
    ctx: ToolContext
  ): Promise<ListChampionsOutput> {
    const locale = input.locale ?? ctx.config.locale;

    // Resolve version: use input if provided, otherwise use cached version or resolve.
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

    // Use the shared helper: fetches and caches the raw ChampionFile
    // at the canonical key (championDataKey) so both list_champions
    // and get_champion read from / write to the same cache entry.
    const file = await getChampionFile(version, locale, ctx.client, ctx.cache);

    const champions: CompactChampion[] = Object.values(file.data).map(toCompact);

    return { version, locale, champions };
  },
};