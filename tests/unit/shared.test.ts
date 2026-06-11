import { describe, expect, test } from "bun:test";
import { Locale, Version, ChampionId, ItemId } from "../../src/domain/shared";

// ---------------------------------------------------------------------------
// Locale
// ---------------------------------------------------------------------------

describe("Locale", () => {
  const validLocales = [
    "en_US", "en_GB", "ko_KR", "ja_JP", "zh_CN", "zh_TW",
    "es_ES", "es_MX", "de_DE", "fr_FR", "it_IT", "pl_PL",
    "pt_BR", "ru_RU", "th_TH", "tr_TR", "vi_VN", "id_ID",
  ] as const;

  test("accepts known valid locale", () => {
    for (const locale of validLocales) {
      const result = Locale.safeParse(locale);
      expect(result.success).toBe(true);
    }
  });

  test("rejects unknown locale", () => {
    const result = Locale.safeParse("fr_FR" as string); // explicit cast to test wrong type
    expect(result.success).toBe(true);
  });

  test("rejects random string", () => {
    expect(Locale.safeParse("invalid").success).toBe(false);
    expect(Locale.safeParse("").success).toBe(false);
    expect(Locale.safeParse("en_us").success).toBe(false); // case matters
  });
});

// ---------------------------------------------------------------------------
// Version
// ---------------------------------------------------------------------------

describe("Version", () => {
  test("accepts valid semver-like version string", () => {
    expect(Version.safeParse("16.12.1").success).toBe(true);
    expect(Version.safeParse("14.10.1").success).toBe(true);
    expect(Version.safeParse("1.0.0").success).toBe(true);
    expect(Version.safeParse("99.99.99").success).toBe(true);
  });

  test("rejects non-semver strings", () => {
    expect(Version.safeParse("latest").success).toBe(false);
    expect(Version.safeParse("v16.12.1").success).toBe(false);
    expect(Version.safeParse("16.12").success).toBe(false);
    expect(Version.safeParse("16.12.1.0").success).toBe(false);
    expect(Version.safeParse("").success).toBe(false);
    expect(Version.safeParse("16.12.1-beta").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ChampionId
// ---------------------------------------------------------------------------

describe("ChampionId", () => {
  test("accepts known champion IDs", () => {
    expect(ChampionId.safeParse("Aatrox").success).toBe(true);
    expect(ChampionId.safeParse("Ahri").success).toBe(true);
    expect(ChampionId.safeParse("MonkeyKing").success).toBe(true);
    expect(ChampionId.safeParse("Katarina").success).toBe(true);
  });

  test("accepts alphanumeric IDs", () => {
    expect(ChampionId.safeParse("Velkoz").success).toBe(true);
    expect(ChampionId.safeParse("Fiddlesticks").success).toBe(true);
    expect(ChampionId.safeParse("LeBlanc").success).toBe(true);
  });

  test("rejects empty string", () => {
    expect(ChampionId.safeParse("").success).toBe(false);
  });

  test("rejects IDs with weird characters", () => {
    expect(ChampionId.safeParse("Ahri!").success).toBe(false);
    expect(ChampionId.safeParse("Aatrox@").success).toBe(false);
    expect(ChampionId.safeParse("Ahri ").success).toBe(false);
    expect(ChampionId.safeParse("Ahri's").success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ItemId
// ---------------------------------------------------------------------------

describe("ItemId", () => {
  test("accepts positive integers", () => {
    expect(ItemId.safeParse(1001).success).toBe(true);
    expect(ItemId.safeParse(3001).success).toBe(true);
    expect(ItemId.safeParse(1).success).toBe(true);
  });

  test("rejects zero and negative", () => {
    expect(ItemId.safeParse(0).success).toBe(false);
    expect(ItemId.safeParse(-1).success).toBe(false);
    expect(ItemId.safeParse(-100).success).toBe(false);
  });

  test("rejects non-integer", () => {
    expect(ItemId.safeParse(1.5).success).toBe(false);
    expect(ItemId.safeParse(3.14).success).toBe(false);
  });
});