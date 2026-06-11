import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ChampionRecord,
  ChampionFile,
  parseChampionFile,
  pickChampion,
} from "../../src/domain/champion";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const championFixture = readFileSync(
  resolve(__dirname, "../../fixtures/ddragon/16.12.1/champion.json"),
  "utf8"
);

// ---------------------------------------------------------------------------
// ChampionFile parsing
// ---------------------------------------------------------------------------

describe("ChampionFile", () => {
  test("parses well-formed champion.json", () => {
    const result = ChampionFile.safeParse(JSON.parse(championFixture));
    expect(result.success).toBe(true);
    if (!result.success) console.error(result.error);
  });

  test("rejects malformed payload (missing type field)", () => {
    const malformed = { format: "standAloneComplex", version: "16.12.1", data: {} };
    const result = ChampionFile.safeParse(malformed);
    expect(result.success).toBe(false);
  });

  test("rejects malformed payload (bad version)", () => {
    const malformed = {
      type: "champion",
      format: "standAloneComplex",
      version: "latest",
      data: {},
    };
    const result = ChampionFile.safeParse(malformed);
    expect(result.success).toBe(false);
  });

  test("parses all nested champion records", () => {
    const parsed = ChampionFile.parse(JSON.parse(championFixture));
    expect(Object.keys(parsed.data).length).toBeGreaterThan(100);
    const aatrox = parsed.data["Aatrox"];
    expect(aatrox.id).toBe("Aatrox");
    expect(aatrox.key).toBe("266");
    expect(aatrox.name).toBe("Aatrox");
    expect(aatrox.stats.hp).toBe(650);
  });
});

// ---------------------------------------------------------------------------
// ChampionRecord field preservation
// ---------------------------------------------------------------------------

describe("ChampionRecord", () => {
  test("preserves stats object fully", () => {
    const parsed = ChampionFile.parse(JSON.parse(championFixture));
    const aatrox = parsed.data["Aatrox"];
    expect(typeof aatrox.stats.hp).toBe("number");
    expect(typeof aatrox.stats.armor).toBe("number");
    expect(typeof aatrox.stats.attackdamage).toBe("number");
    expect(typeof aatrox.stats.movespeed).toBe("number");
  });

  test("preserves info object (attack/defense/magic/difficulty)", () => {
    const parsed = ChampionFile.parse(JSON.parse(championFixture));
    const aatrox = parsed.data["Aatrox"];
    expect(aatrox.info.attack).toBe(8);
    expect(aatrox.info.defense).toBe(4);
    expect(aatrox.info.magic).toBe(3);
    expect(aatrox.info.difficulty).toBe(4);
  });

  test("preserves image object", () => {
    const parsed = ChampionFile.parse(JSON.parse(championFixture));
    const aatrox = parsed.data["Aatrox"];
    expect(aatrox.image.full).toBe("Aatrox.png");
    expect(aatrox.image.sprite).toBe("champion0.png");
    expect(aatrox.image.group).toBe("champion");
  });

  test("preserves tags array", () => {
    const parsed = ChampionFile.parse(JSON.parse(championFixture));
    const aatrox = parsed.data["Aatrox"];
    expect(Array.isArray(aatrox.tags)).toBe(true);
    expect(aatrox.tags).toContain("Fighter");
  });

  test("preserves partype", () => {
    const parsed = ChampionFile.parse(JSON.parse(championFixture));
    const aatrox = parsed.data["Aatrox"];
    expect(aatrox.partype).toBe("Blood Well");
    const ahri = parsed.data["Ahri"];
    expect(ahri.partype).toBe("Mana");
  });

  test("preserves blurb (lore text)", () => {
    const parsed = ChampionFile.parse(JSON.parse(championFixture));
    const aatrox = parsed.data["Aatrox"];
    expect(aatrox.blurb.length).toBeGreaterThan(50);
  });
});

// ---------------------------------------------------------------------------
// pickChampion
// ---------------------------------------------------------------------------

describe("pickChampion", () => {
  test("finds champion by string id (exact)", () => {
    const parsed = ChampionFile.parse(JSON.parse(championFixture));
    const result = pickChampion(parsed, "Aatrox");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.id).toBe("Aatrox");
  });

  test("finds champion by string id (case-insensitive)", () => {
    const parsed = ChampionFile.parse(JSON.parse(championFixture));
    const result = pickChampion(parsed, "aatrox");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.id).toBe("Aatrox");
  });

  test("finds champion by numeric key", () => {
    const parsed = ChampionFile.parse(JSON.parse(championFixture));
    const result = pickChampion(parsed, "266");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.id).toBe("Aatrox");
  });

  test("returns not_found for unknown champion", () => {
    const parsed = ChampionFile.parse(JSON.parse(championFixture));
    const result = pickChampion(parsed, "UnknownChampion");
    expect(result.ok).toBe(false);
  });

  test("resolves ambiguous (multiple matches by key)", () => {
    const parsed = ChampionFile.parse(JSON.parse(championFixture));
    // Both "Ahri" (id) and "103" (key) should be unambiguous in practice
    // But if someone passes "103" we need to make sure it doesn't
    // accidentally match multiple string-keyed champions
    const result = pickChampion(parsed, "103");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.key).toBe("103");
  });
});

// ---------------------------------------------------------------------------
// Type inference
// ---------------------------------------------------------------------------

describe("Champion types", () => {
  test("ChampionRecord infers correct types for known fields", () => {
    const parsed = ChampionFile.parse(JSON.parse(championFixture));
    const aatrox = parsed.data["Aatrox"];
    // Check that the inferred type is string for id
    const _id: string = aatrox.id;
    const _key: string = aatrox.key;
    const _name: string = aatrox.name;
    const _title: string = aatrox.title;
    const _partype: string = aatrox.partype;
    // Check numeric types
    const _hp: number = aatrox.stats.hp;
    const _attackdamage: number = aatrox.stats.attackdamage;
  });
});