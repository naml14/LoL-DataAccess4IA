import { describe, expect, test } from "bun:test";
import { ItemRecord, ItemFile, parseItemFile } from "../../src/domain/item";
import { pickItemsByName, pickItemCanonicalForMap } from "../../src/domain/item";

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
    // Stormrazor entries for multi-match testing
    3097: {
      name: "Stormrazor",
      description: "<attack>Stormrazor description.</attack>",
      colloq: "",
      plaintext: "A powerful storm",
      into: [],
      from: [],
      image: { full: "3097.png", sprite: "item1.png", group: "item", x: 0, y: 0, w: 64, h: 64 },
      gold: { base: 700, purchasable: true, total: 700, sell: 490 },
      tags: ["AttackSpeed"],
      maps: { "11": true },
      stats: { percentAttackSpeedMod: 0.45 },
    },
    223095: {
      name: "Stormrazor",
      description: "<attack>Arena Stormrazor.</attack>",
      colloq: "",
      plaintext: "Arena variant",
      into: [],
      from: [],
      image: { full: "223095.png", sprite: "item1.png", group: "item", x: 64, y: 0, w: 64, h: 64 },
      gold: { base: 700, purchasable: true, total: 700, sell: 490 },
      tags: ["AttackSpeed"],
      maps: { "30": true },
      stats: { percentAttackSpeedMod: 0.45 },
    },
    // Item with no maps field (tests maps-absent path)
    4403: {
      name: "Guardian Horn",
      description: "<active>Guardian Horn.</active>",
      colloq: "",
      plaintext: "A horn",
      into: [],
      from: [],
      image: { full: "4403.png", sprite: "item2.png", group: "item", x: 0, y: 0, w: 64, h: 64 },
      gold: { base: 400, purchasable: true, total: 400, sell: 280 },
      tags: ["Health"],
      // intentionally no maps field
      stats: { flatHealth: 150 },
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

// ---------------------------------------------------------------------------
// pickItemsByName
// ---------------------------------------------------------------------------

describe("pickItemsByName", () => {
  const parsed = parseItemFile(syntheticItemFile);

  test("returns single match when exactly one item has that name", () => {
    const result = pickItemsByName(parsed.data, "Boots of Speed");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Boots of Speed");
  });

  test("returns full array when multiple items share the name (Stormrazor)", () => {
    const result = pickItemsByName(parsed.data, "Stormrazor");
    expect(result).toHaveLength(2);
    const ids = result.map((r) => r.maps && Object.keys(r.maps).find((k) => r.maps[k] === true));
    expect(ids).toContain("11"); // SR id 3097
    expect(ids).toContain("30"); // Arena id 223095
  });

  test("case-insensitive exact match (STORMRAZOR)", () => {
    const result = pickItemsByName(parsed.data, "STORMRAZOR");
    expect(result).toHaveLength(2);
  });

  test("case-insensitive: boots of speed", () => {
    const result = pickItemsByName(parsed.data, "boots of speed");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Boots of Speed");
  });

  test("returns empty array when no item matches", () => {
    const result = pickItemsByName(parsed.data, "NonexistentItemXYZ");
    expect(result).toEqual([]);
  });

  test("substring does NOT match (storm → empty)", () => {
    const result = pickItemsByName(parsed.data, "storm");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// pickItemCanonicalForMap
// ---------------------------------------------------------------------------

describe("pickItemCanonicalForMap", () => {
  const parsed = parseItemFile(syntheticItemFile);

  test("returns single record when one item matches name+mapId (numeric: 11)", () => {
    const result = pickItemCanonicalForMap(parsed.data, "Boots of Speed", "11");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Boots of Speed");
  });

  test("accepts human-readable alias (summoners_rift)", () => {
    const result = pickItemCanonicalForMap(parsed.data, "Boots of Speed", "summoners_rift");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Boots of Speed");
  });

  test("returns full array when multiple items match name+mapId", () => {
    // Add a second item with same name and same map
    const multiMapFile: ItemFile = {
      ...syntheticItemFile,
      data: {
        ...syntheticItemFile.data,
        3097: {
          name: "Stormrazor",
          description: "<attack>SR again.</attack>",
          colloq: "",
          plaintext: "SR",
          into: [],
          from: [],
          image: { full: "3097.png", sprite: "item1.png", group: "item", x: 0, y: 0, w: 64, h: 64 },
          gold: { base: 700, purchasable: true, total: 700, sell: 490 },
          tags: ["AttackSpeed"],
          maps: { "11": true },
          stats: { percentAttackSpeedMod: 0.45 },
        },
        // Same name, same map — rare but possible
        3098: {
          name: "Stormrazor",
          description: "<attack>SR variant 2.</attack>",
          colloq: "",
          plaintext: "SR2",
          into: [],
          from: [],
          image: { full: "3098.png", sprite: "item1.png", group: "item", x: 64, y: 0, w: 64, h: 64 },
          gold: { base: 700, purchasable: true, total: 700, sell: 490 },
          tags: ["AttackSpeed"],
          maps: { "11": true },
          stats: { percentAttackSpeedMod: 0.45 },
        },
      },
    };
    const result = pickItemCanonicalForMap(multiMapFile.data, "Stormrazor", "11");
    expect(result).toHaveLength(2);
  });

  test("returns empty array when no item has name+mapId", () => {
    const result = pickItemCanonicalForMap(parsed.data, "Banana", "11");
    expect(result).toEqual([]);
  });

  test("returns empty array when name matches but not mapId", () => {
    // Stormrazor has maps.11=true but not maps.12
    const result = pickItemCanonicalForMap(parsed.data, "Stormrazor", "12");
    expect(result).toEqual([]);
  });

  test("unknown mapId passes through and returns empty (forward-compat)", () => {
    const result = pickItemCanonicalForMap(parsed.data, "Stormrazor", "999");
    expect(result).toEqual([]);
  });

  test("case-insensitive alias resolution (ARENA)", () => {
    const result = pickItemCanonicalForMap(parsed.data, "Stormrazor", "ARENA");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Stormrazor");
  });

  test("returns empty array when item has no maps field", () => {
    const result = pickItemCanonicalForMap(parsed.data, "Guardian Horn", "11");
    expect(result).toEqual([]);
  });
});