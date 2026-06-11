import { z } from "zod";
import { Version } from "./shared";

// ---------------------------------------------------------------------------
// ProfileIconImage
// ---------------------------------------------------------------------------

const ProfileIconImage = z.object({
  full: z.string(),
  sprite: z.string(),
  group: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  w: z.number().int(),
  h: z.number().int(),
});

export type ProfileIconImage = z.infer<typeof ProfileIconImage>;

// ---------------------------------------------------------------------------
// ProfileIconRecord — single profile icon entry
// ---------------------------------------------------------------------------

/**
 * Schema for a single profile icon record from profileicon.json.
 * Mirrors Riot's Data Dragon structure exactly.
 */
export const ProfileIconRecord = z.object({
  id: z.number().int(),
  image: ProfileIconImage,
});

export type ProfileIconRecord = z.infer<typeof ProfileIconRecord>;

// ---------------------------------------------------------------------------
// ProfileIconFile — top-level profileicon.json structure
// ---------------------------------------------------------------------------

/**
 * Schema for the entire profileicon.json Data Dragon file.
 * Shape: `{ type: "profileicon", version: string, data: { [id: string]: ProfileIconRecord } }`
 *
 * Note: JSON object keys are always strings. Data Dragon uses numeric IDs as
 * string keys (e.g. "1", "7"). We validate with a numeric-string regex.
 */
export const ProfileIconFile = z.object({
  type: z.literal("profileicon"),
  version: Version,
  data: z.record(
    z.string().regex(/^\d+$/, "Profile icon ID must be a numeric string"),
    ProfileIconRecord
  ),
});

export type ProfileIconFile = z.infer<typeof ProfileIconFile>;

// ---------------------------------------------------------------------------
// parseProfileIconFile
// ---------------------------------------------------------------------------

export function parseProfileIconFile(payload: unknown): ProfileIconFile {
  return ProfileIconFile.parse(payload);
}