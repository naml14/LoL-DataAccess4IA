import { resolveVersion } from "../ddragon/versions";
import { getSummonerSpellsPath } from "../ddragon/endpoints";
import { cacheKey } from "../cache/key";
import { resolvedVersionCacheKey } from "../cache/key";
import { parseSummonerSpellFile } from "../domain/summoner";
import type { SummonerSpellRecord } from "../domain/summoner";
import type { ToolContext } from "./_ctx";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Compact summoner spell record returned by list_summoner_spells. */
export type CompactSummonerSpell = {
  id: string;
  name: string;
  description: string;
  tooltip: string;
  maxrank: number;
  cooldown: number[];
  key: string;
  image: { full: string };
};

/** Output of list_summoner_spells tool. */
export type ListSummonerSpellsOutput = {
  version: string;
  locale: string;
  count: number;
  spells: CompactSummonerSpell[];
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

function summonerListCacheKey(version: string, locale: string): string {
  return cacheKey(version, locale, getSummonerSpellsPath(version, locale).replace(/^https:\/\/ddragon\.leagueoflegends\.com/, ""));
}

/** Map a SummonerSpellRecord to compact form. */
function toCompact(spell: SummonerSpellRecord): CompactSummonerSpell {
  return {
    id: spell.id,
    name: spell.name,
    description: spell.description,
    tooltip: spell.tooltip ?? "",
    maxrank: spell.maxrank ?? 0,
    cooldown: spell.cooldown ?? [],
    key: spell.key,
    image: { full: spell.image.full },
  };
}

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const listSummonerSpellsTool = {
  name: "list_summoner_spells",
  description: "Returns a list of all summoner spells for a Data Dragon patch version.",
  inputSchema: InputSchema,

  async handler(
    input: { version?: string; locale?: string },
    ctx: ToolContext
  ): Promise<ListSummonerSpellsOutput> {
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

    const ck = summonerListCacheKey(version, locale);
    const cached = await ctx.cache.get(ck);
    if (cached !== undefined) {
      const parsed = cached as ListSummonerSpellsOutput;
      return { ...parsed, locale };
    }

    const raw = await ctx.client.getSummonerList(version, locale);
    const file = parseSummonerSpellFile(raw);

    const spells: CompactSummonerSpell[] = Object.values(file.data).map(toCompact);

    const result: ListSummonerSpellsOutput = { version, locale, count: spells.length, spells };

    await ctx.cache.set(ck, result);

    return result;
  },
};