import { z } from "zod";

// ---------------------------------------------------------------------------
// Locale — Riot-supported locales for Data Dragon
// ---------------------------------------------------------------------------

/**
 * Riot's supported locales for Data Dragon static assets.
 * Used as the locale parameter in CDN requests and cache keys.
 */
export const Locale = z.enum([
  "en_US", "en_GB", "ko_KR", "ja_JP", "zh_CN", "zh_TW",
  "es_ES", "es_MX", "de_DE", "fr_FR", "it_IT", "pl_PL",
  "pt_BR", "ru_RU", "th_TH", "tr_TR", "vi_VN", "id_ID",
]);

export type Locale = z.infer<typeof Locale>;

// ---------------------------------------------------------------------------
// Version — Data Dragon patch version
// ---------------------------------------------------------------------------

/**
 * Data Dragon version string in MAJOR.MINOR.PATCH format.
 * Riot increments the patch version with each Data Dragon release.
 * Example: "16.12.1", "14.10.1"
 */
export const Version = z.string().regex(
  /^\d+\.\d+\.\d+$/,
  "Version must be in MAJOR.MINOR.PATCH format (e.g. 16.12.1)"
);

export type Version = z.infer<typeof Version>;

// ---------------------------------------------------------------------------
// ChampionId — string identifier for a champion
// ---------------------------------------------------------------------------

/**
 * Champion ID as used in Data Dragon URLs and the champion.json data map.
 * Always a string (e.g. "Aatrox", "Ahri", "MonkeyKing").
 * Matches the key in the data map: `data["Aatrox"]`.
 * Alphanumeric only — no spaces, underscores, or special characters.
 */
export const ChampionId = z.string().regex(
  /^[A-Za-z0-9]+$/,
  "ChampionId must be alphanumeric (e.g. Aatrox, Ahri, MonkeyKing)"
);

export type ChampionId = z.infer<typeof ChampionId>;

// ---------------------------------------------------------------------------
// ItemId — positive integer identifier for an item
// ---------------------------------------------------------------------------

/**
 * Item ID as used in Data Dragon item.json data map.
 * Always a positive integer (e.g. 1001, 3001).
 * Matches the key in the data map: `data[1001]`.
 * Zero and negative values are invalid per Riot's schema.
 */
export const ItemId = z.number().int().positive();

export type ItemId = z.infer<typeof ItemId>;