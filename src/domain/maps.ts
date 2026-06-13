/**
 * Map ID alias resolution for canonical item lookups.
 *
 * Translates human-readable map names to Riot's stringified numeric map IDs.
 * Unknown inputs pass through as-is (forward-compat for future Riot map IDs).
 */

/**
 * Alias table: human-readable alias → Riot stringified numeric map ID.
 * Keys are lowercase for case-insensitive lookup.
 */
export const MAP_ID_ALIASES: Record<string, string> = {
  summoners_rift: "11",
  howling_abyss: "12",
  nexus_blitz: "21",
  "2v2": "22",
  arena: "30",
  cherry: "33",
  brawl: "35",
};

/**
 * Resolve a map identifier to a stringified numeric map ID.
 *
 * - If `input` is a known alias (case-insensitive), returns the corresponding
 *   Riot stringified numeric ID.
 * - If `input` is already a stringified numeric (e.g. "11"), returns it unchanged.
 * - If `input` is unknown (e.g. "999"), returns it unchanged (forward-compat).
 * - Empty string passes through unchanged.
 *
 * @param input - A map alias or stringified numeric ID
 * @returns The resolved stringified numeric map ID, or the input unchanged
 */
export function resolveMapId(input: string): string {
  if (input === "") {
    return input;
  }
  const lower = input.toLowerCase();
  if (lower in MAP_ID_ALIASES) {
    return MAP_ID_ALIASES[lower];
  }
  return input;
}
