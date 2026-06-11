import { z } from "zod";

// ---------------------------------------------------------------------------
// Rune — inner rune entry within a slot
// ---------------------------------------------------------------------------

export const Rune = z.object({
  id: z.number().int(),
  key: z.string(),
  icon: z.string(),
  name: z.string(),
  shortDesc: z.string(),
  longDesc: z.string(),
});

export type Rune = z.infer<typeof Rune>;

// ---------------------------------------------------------------------------
// RuneSlot — a row of runes within a rune tree
// ---------------------------------------------------------------------------

export const RuneSlot = z.object({
  slotLabel: z.string(),
  runes: z.array(Rune),
});

export type RuneSlot = z.infer<typeof RuneSlot>;

// ---------------------------------------------------------------------------
// RuneTree — a single rune tree (e.g. Precision, Domination)
// ---------------------------------------------------------------------------

export const RuneTree = z.object({
  id: z.number().int(),
  key: z.string(),
  name: z.string(),
  icon: z.string(),
  slots: z.array(RuneSlot),
});

export type RuneTree = z.infer<typeof RuneTree>;

// ---------------------------------------------------------------------------
// RuneTreesFile — the entire runesReforged.json array
// ---------------------------------------------------------------------------

/**
 * Schema for the entire runesReforged.json Data Dragon file.
 * Shape: Array of RuneTree objects.
 */
export const RuneTreesFile = z.array(RuneTree);

export type RuneTreesFile = z.infer<typeof RuneTreesFile>;

// ---------------------------------------------------------------------------
// parseRuneTreesFile
// ---------------------------------------------------------------------------

export function parseRuneTreesFile(payload: unknown): RuneTreesFile {
  return RuneTreesFile.parse(payload);
}