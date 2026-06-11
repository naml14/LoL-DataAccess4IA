import { resolveVersion } from "../ddragon/versions";
import { getProfileIconPath } from "../ddragon/endpoints";
import { cacheKey } from "../cache/key";
import { parseProfileIconFile } from "../domain/profileicon";
import type { ProfileIconRecord } from "../domain/profileicon";
import type { ToolContext } from "./_ctx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Compact profile icon record returned by list_profile_icons. */
export type CompactProfileIcon = {
  id: number;
  image: { full: string };
};

/** Output of list_profile_icons tool. */
export type ListProfileIconsOutput = {
  version: string;
  locale: string;
  count: number;
  icons: CompactProfileIcon[];
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

function profileIconListCacheKey(version: string, locale: string): string {
  return cacheKey(version, locale, getProfileIconPath(version, locale).replace(/^https:\/\/ddragon\.leagueoflegends\.com/, ""));
}

/** Map a ProfileIconRecord to compact form. */
function toCompact(icon: ProfileIconRecord): CompactProfileIcon {
  return {
    id: icon.id,
    image: { full: icon.image.full },
  };
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const listProfileIconsTool = {
  name: "list_profile_icons",
  description: "Returns a list of all profile icons for a Data Dragon patch version.",
  inputSchema: InputSchema,

  async handler(
    input: { version?: string; locale?: string },
    ctx: ToolContext
  ): Promise<ListProfileIconsOutput> {
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

    const ck = profileIconListCacheKey(version, locale);
    const cached = await ctx.cache.get(ck);
    if (cached !== undefined) {
      const parsed = cached as ListProfileIconsOutput;
      return { ...parsed, locale };
    }

    const raw = await ctx.client.getProfileIconList(version, locale);
    const file = parseProfileIconFile(raw);

    const icons: CompactProfileIcon[] = Object.values(file.data).map(toCompact);

    const result: ListProfileIconsOutput = { version, locale, count: icons.length, icons };

    await ctx.cache.set(ck, result);

    return result;
  },
};