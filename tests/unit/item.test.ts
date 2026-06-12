import { describe, expect, test } from "bun:test";
import { ItemRecord, ItemFile, parseItemFile } from "../../src/domain/item";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Synthethic item data matching the Data Dragon shape */
const syntheticItemFile: ItemFile = {
  type: "item",
  version: "16.12.1",
  data: {
    1001: {
      name: "Boots of Speed",
      description: "<manaRegen>A basic item that increases Movement Speed.</manaRegen>",
      colloq: "",
      plaintext: "Slightly increases Movement Speed",
      into: ["3006", "3020"],
      image: {
        full: "1001.png",
        sprite: "item0.png",
        group: "item",
        x: 0,
        y: 0,
        w: 64,
        h: 64,
      },
      gold: { base: 300, purchasable: true, total: 300, sell: 210 },
      tags: [],
      maps: { "11": true, "12": true, "21": true, "22": true },
      stats: { flatMovementSpeed: 50 },
    },
    3006: {
      name: "Berserker's Greaves",
      description: "<atkSpeed>+45% Attack Speed.</atkSpeed>",
      colloq: "",
      plaintext: "Enhances Movement Speed and Attack Speed",
      from: ["1001"],
      into: [],
      image: {
        full: "3006.png",
        sprite: "item0.png",
        group: "item",
        x: 64,
        y: 0,
        w: 64,
        h: 64,
      },
      gold: { base: 500, purchasable: true, total: 800, sell: 560 },
      tags: ["AttackSpeed"],
      maps: { "11": true, "12": true, "21": true, "22": true },
      stats: { flatMovementSpeed: 45, percentAttackSpeedMod: 0.45 },
    },
  },
};

// ---------------------------------------------------------------------------
// ItemFile parsing
// ---------------------------------------------------------------------------

describe("ItemFile", () => {
  test("parses well-formed item.json structure", () => {
    const result = ItemFile.safeParse(syntheticItemFile);
    expect(result.success).toBe(true);
  });

  test("rejects missing type field", () => {
    const malformed = { version: "16.12.1", data: {} };
    expect(ItemFile.safeParse(malformed).success).toBe(false);
  });

  test("rejects bad version format", () => {
    const malformed = { type: "item", version: "latest", data: {} };
    expect(ItemFile.safeParse(malformed).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ItemRecord field preservation
// ---------------------------------------------------------------------------

describe("ItemRecord", () => {
  test("preserves gold object (base, purchasable, total, sell)", () => {
    const parsed = ItemFile.parse(syntheticItemFile);
    const boots = parsed.data[1001];
    expect(boots.gold.base).toBe(300);
    expect(boots.gold.total).toBe(300);
    expect(boots.gold.sell).toBe(210);
    expect(boots.gold.purchasable).toBe(true);
  });

  test("preserves from and into recipe arrays", () => {
    const parsed = ItemFile.parse(syntheticItemFile);
    const boots = parsed.data[1001];
    expect(boots.into).toEqual(["3006", "3020"]);
    expect(boots.from).toEqual(undefined); // base item

    const zerkers = parsed.data[3006];
    expect(zerkers.from).toEqual(["1001"]);
    expect(zerkers.into).toEqual([]);
  });

  test("preserves stats object", () => {
    const parsed = ItemFile.parse(syntheticItemFile);
    const boots = parsed.data[1001];
    expect(boots.stats.flatMovementSpeed).toBe(50);
  });

  test("preserves image object", () => {
    const parsed = ItemFile.parse(syntheticItemFile);
    const boots = parsed.data[1001];
    expect(boots.image.full).toBe("1001.png");
    expect(boots.image.sprite).toBe("item0.png");
    expect(boots.image.w).toBe(64);
  });

  test("preserves maps object (game mode availability)", () => {
    const parsed = ItemFile.parse(syntheticItemFile);
    const boots = parsed.data[1001];
    expect(boots.maps["11"]).toBe(true);
    expect(boots.maps["12"]).toBe(true);
  });

  test("item with empty from/into (base item) has empty arrays", () => {
    const parsed = ItemFile.parse(syntheticItemFile);
    const boots = parsed.data[1001];
    expect(Array.isArray(boots.into)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// parseItemFile
// ---------------------------------------------------------------------------

describe("parseItemFile", () => {
  test("parses and returns typed ItemFile", () => {
    const result = parseItemFile(syntheticItemFile);
    expect(result.data[1001].name).toBe("Boots of Speed");
  });
});