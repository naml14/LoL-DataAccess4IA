import { resolveVersion } from "../ddragon/versions";
import { cacheKey } from "../cache/key";
import type { ToolContext } from "./_ctx";

/**
 * Input schema for get_current_patch tool.
 */
const InputSchema = {
  type: "object" as const,
  properties: {
    locale: { type: "string" as const, description: "Locale code (e.g. en_US, es_ES)" },
  },
  required: [] as string[],
  additionalProperties: false,
};

/**
 * Cache key for versions.json — locale-independent since the file
 * content is the same regardless of locale.
 */
function versionsCacheKey(version: string): string {
  return cacheKey(version, "en_US", "/api/versions.json");
}

/**
 * Cache key for the resolved version string itself (version-only cache).
 * This lets us avoid calling resolveVersion() (network) on every invocation.
 */
function resolvedVersionCacheKey(): string {
  return "ddragon:resolved-version:__singleton";
}

export const getCurrentPatchTool = {
  name: "get_current_patch",
  description: "Returns the current Data Dragon patch version and locale.",
  inputSchema: InputSchema,

  async handler(
    input: { locale?: string },
    ctx: ToolContext
  ): Promise<{ version: string; locale: string; fetchedAt: string }> {
    const locale = input.locale ?? ctx.config.locale;

    // Try to get the cached resolved version first to avoid network.
    const versionCacheKey = resolvedVersionCacheKey();
    let version: string;
    const cachedVersion = await ctx.cache.get(versionCacheKey);
    if (cachedVersion !== undefined) {
      version = cachedVersion as string;
    } else {
      // resolveVersion() calls network unless LOL_DD_PIN_VERSION env is set.
      const info = await resolveVersion();
      version = info.current;
      // Cache the version string to avoid repeated network calls.
      await ctx.cache.set(versionCacheKey, version);
    }

    // Check cache for the tool result (versions.json is locale-invariant).
    const ck = versionsCacheKey(version);
    const cached = await ctx.cache.get(ck);
    if (cached !== undefined) {
      return cached as { version: string; locale: string; fetchedAt: string };
    }

    // Build result
    const result = {
      version,
      locale,
      fetchedAt: new Date().toISOString(),
    };

    await ctx.cache.set(ck, result);

    return result;
  },
};