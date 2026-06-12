import { describe, test, expect } from "bun:test";
import { cacheKey, cacheKeyForResource } from "../../src/cache/key";

describe("cacheKey", () => {
  test("builds canonical key with version, locale, and path", () => {
    const key = cacheKey("14.10.1", "en_US", "/cdn/14.10.1/data/en_US/champion.json");
    expect(key).toBe("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json");
  });

  test("handles version with multiple dots", () => {
    const key = cacheKey("14.10.1", "en_US", "/cdn/14.10.1/data/en_US/item.json");
    expect(key).toBe("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/item.json");
  });

  test("handles different locales", () => {
    const key = cacheKey("14.10.1", "es_AR", "/cdn/14.10.1/data/es_AR/champion.json");
    expect(key).toBe("ddragon:14.10.1:es_AR:/cdn/14.10.1/data/es_AR/champion.json");
  });

  test("handles paths with dashes", () => {
    const key = cacheKey("13.1.1", "ko_KR", "/cdn/13.1.1/data/ko_KR/runesReforged.json");
    expect(key).toBe("ddragon:13.1.1:ko_KR:/cdn/13.1.1/data/ko_KR/runesReforged.json");
  });

  test("handles champion detail paths with slashes in filename", () => {
    const key = cacheKey("14.10.1", "en_US", "/cdn/14.10.1/data/en_US/champion/Ahri.json");
    expect(key).toBe("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion/Ahri.json");
  });

  test("snapshot: key shape is consistent", () => {
    const key = cacheKey("14.10.1", "en_US", "/api/versions.json");
    expect(key).toMatch(/^ddragon:[^:]+:[^:]+:.+$/);
    expect(key.split(":")).toHaveLength(4);
  });
});

describe("cacheKeyForResource", () => {
  test("champion maps to champion list path", () => {
    const key = cacheKeyForResource("14.10.1", "en_US", "champion");
    expect(key).toBe("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json");
  });

  test("item maps to item list path", () => {
    const key = cacheKeyForResource("14.10.1", "en_US", "item");
    expect(key).toBe("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/item.json");
  });

  test("rune maps to runesReforged path", () => {
    const key = cacheKeyForResource("14.10.1", "en_US", "rune");
    expect(key).toBe("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/runesReforged.json");
  });

  test("summoner maps to summoner spells path", () => {
    const key = cacheKeyForResource("14.10.1", "en_US", "summoner");
    expect(key).toBe("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/summoner.json");
  });

  test("versions maps to versions.json path", () => {
    const key = cacheKeyForResource("14.10.1", "en_US", "versions");
    expect(key).toBe("ddragon:14.10.1:en_US:/api/versions.json");
  });

  test("uses version and locale from arguments", () => {
    const key = cacheKeyForResource("13.5.3", "es_MX", "champion");
    expect(key).toBe("ddragon:13.5.3:es_MX:/cdn/13.5.3/data/es_MX/champion.json");
  });

  test("snapshot: all resource types produce valid key shape", () => {
    const resources = ["champion", "item", "rune", "summoner", "profileicon", "versions"] as const;
    for (const resource of resources) {
      const key = cacheKeyForResource("14.10.1", "en_US", resource);
      expect(key).toMatch(/^ddragon:[^:]+:[^:]+:.+$/);
    }
  });
});