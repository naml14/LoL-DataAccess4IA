import { describe, expect, test } from "bun:test";
import { SummonerSpellRecord, SummonerSpellFile, parseSummonerSpellFile } from "../../src/domain/summoner";

// ---------------------------------------------------------------------------
// Synthetic summoner spell data matching Data Dragon summoner.json structure
// ---------------------------------------------------------------------------

const syntheticSummonerFile: SummonerSpellFile = {
  type: "summoner",
  version: "16.12.1",
  data: {
    SummonerBarrier: {
      id: "SummonerBarrier",
      name: "Barrier",
      description: "Shields your champion from 115-455 damage (based on level) for 2 seconds.",
      key: "21",
      cooldown: [],
      summonerLevel: 4,
      modes: ["CLASSIC", "ARAM"],
      icon: "spell/SummonerBarrier.png",
      image: {
        full: "SummonerBarrier.png",
        sprite: "spell0.png",
        group: "spell",
        x: 0,
        y: 0,
        w: 48,
        h: 48,
      },
    },
    SummonerFlash: {
      id: "SummonerFlash",
      name: "Flash",
      description: "Teleports your champion a short distance toward your cursor.",
      key: "4",
      cooldown: [300],
      summonerLevel: 7,
      modes: ["CLASSIC", "ARAM", "TUTORIAL"],
      icon: "spell/SummonerFlash.png",
      image: {
        full: "SummonerFlash.png",
        sprite: "spell0.png",
        group: "spell",
        x: 48,
        y: 0,
        w: 48,
        h: 48,
      },
    },
  },
};

// ---------------------------------------------------------------------------
// SummonerSpellFile
// ---------------------------------------------------------------------------

describe("SummonerSpellFile", () => {
  test("parses well-formed summoner.json structure", () => {
    const result = SummonerSpellFile.safeParse(syntheticSummonerFile);
    expect(result.success).toBe(true);
  });

  test("rejects missing type field", () => {
    const malformed = { version: "16.12.1", data: {} };
    expect(SummonerSpellFile.safeParse(malformed).success).toBe(false);
  });

  test("rejects bad version format", () => {
    const malformed = { type: "summoner", version: "latest", data: {} };
    expect(SummonerSpellFile.safeParse(malformed).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SummonerSpellRecord field preservation
// ---------------------------------------------------------------------------

describe("SummonerSpellRecord", () => {
  test("preserves id, name, and description", () => {
    const parsed = SummonerSpellFile.parse(syntheticSummonerFile);
    const barrier = parsed.data["SummonerBarrier"];
    expect(barrier.id).toBe("SummonerBarrier");
    expect(barrier.name).toBe("Barrier");
    expect(barrier.description.length).toBeGreaterThan(0);
  });

  test("preserves summonerLevel", () => {
    const parsed = SummonerSpellFile.parse(syntheticSummonerFile);
    expect(parsed.data["SummonerBarrier"].summonerLevel).toBe(4);
    expect(parsed.data["SummonerFlash"].summonerLevel).toBe(7);
  });

  test("preserves modes array", () => {
    const parsed = SummonerSpellFile.parse(syntheticSummonerFile);
    const barrier = parsed.data["SummonerBarrier"];
    expect(Array.isArray(barrier.modes)).toBe(true);
    expect(barrier.modes).toContain("CLASSIC");
    expect(barrier.modes).toContain("ARAM");
  });

  test("preserves cooldown array", () => {
    const parsed = SummonerSpellFile.parse(syntheticSummonerFile);
    const barrier = parsed.data["SummonerBarrier"];
    expect(Array.isArray(barrier.cooldown)).toBe(true);
    const flash = parsed.data["SummonerFlash"];
    expect(flash.cooldown).toEqual([300]);
  });

  test("preserves image object", () => {
    const parsed = SummonerSpellFile.parse(syntheticSummonerFile);
    const barrier = parsed.data["SummonerBarrier"];
    expect(barrier.image.full).toBe("SummonerBarrier.png");
    expect(barrier.image.sprite).toBe("spell0.png");
    expect(barrier.image.w).toBe(48);
  });

  test("preserves icon path", () => {
    const parsed = SummonerSpellFile.parse(syntheticSummonerFile);
    const barrier = parsed.data["SummonerBarrier"];
    expect(barrier.icon).toBe("spell/SummonerBarrier.png");
  });
});

// ---------------------------------------------------------------------------
// parseSummonerSpellFile
// ---------------------------------------------------------------------------

describe("parseSummonerSpellFile", () => {
  test("returns typed SummonerSpellFile", () => {
    const result = parseSummonerSpellFile(syntheticSummonerFile);
    expect(result.data["SummonerBarrier"].name).toBe("Barrier");
  });
});