import { resolveVersion } from "../ddragon/versions";
import { resolvedVersionCacheKey } from "../cache/key";

import { getChampionFile } from "../ddragon/champion-helpers";
import { pickChampion } from "../domain/champion";
import type { ChampionRecord } from "../domain/champion";
import type { ToolContext } from "./_ctx";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ChampionNotFoundError extends Error {
  readonly code = "not-found";
  constructor(query: string) {
    super(`Champion not found: ${query}`);
  }
}

export class ChampionAmbiguousError extends Error {
  readonly code = "ambiguous";
  constructor(query: string) {
    super(`Ambiguous champion query: "${query}" matches multiple champions by id and key`);
  }
}

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const InputSchema = {
  type: "object" as const,
  properties: {
    idOrKey: { type: "string" as const, description: "Champion id (e.g. Ahri) or numeric key (e.g. 103)" },
    version: { type: "string" as const, description: "Data Dragon patch version (e.g. 14.10.1)" },
    locale: { type: "string" as const, description: "Locale code (e.g. en_US, es_ES)" },
  },
  required: ["idOrKey"],
  additionalProperties: false,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const getChampionTool = {
  name: "get_champion",
  description: "Returns a single champion record by id or numeric key.",
  inputSchema: InputSchema,

  async handler(
    input: { idOrKey: string; version?: string; locale?: string },
    ctx: ToolContext
  ): Promise<ChampionRecord> {
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

    // Use the shared helper: fetches and caches the raw ChampionFile
    // at the canonical key (championDataKey) so both list_champions
    // and get_champion read from / write to the same cache entry.
    const file = await getChampionFile(version, locale, ctx.client, ctx.cache);

    // pickChampion checks id-ambiguity and key-ambiguity separately.
    // We also need to check cross-ambiguity: if id lookup and key lookup
    // both return (different) single champions, that is also ambiguous.
    const queryLower = input.idOrKey.toLowerCase();
    const byId = Object.values(file.data).filter(
      (c: ChampionRecord) => c.id.toLowerCase() === queryLower
    );
    const byKey = Object.values(file.data).filter(
      (c: ChampionRecord) => c.key === input.idOrKey
    );

    // Ambiguity: any of these is ambiguous.
    // - byId.length > 1: multiple champions share this id (case-insensitive)
    // - byKey.length > 1: multiple champions share this key
    // - byId.length === 1 && byKey.length === 1 && byId[0] !== byKey[0]:
    //   cross-ambiguity — id and key resolve to different champions
    if (byId.length > 1 || byKey.length > 1) {
      throw new ChampionAmbiguousError(input.idOrKey);
    }
    if (byId.length === 1 && byKey.length === 1 && byId[0] !== byKey[0]) {
      throw new ChampionAmbiguousError(input.idOrKey);
    }

    const result = pickChampion(file, input.idOrKey);
    if (!result.ok) {
      if (result.error === "not_found") {
        throw new ChampionNotFoundError(input.idOrKey);
      }
      throw new ChampionAmbiguousError(input.idOrKey);
    }

    return result.value;
  },
};