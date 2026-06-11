import { describe, expect, test } from "bun:test";
import { RuneTree, RuneTreesFile, parseRuneTreesFile } from "../../src/domain/rune";

// ---------------------------------------------------------------------------
// Synthetic rune data matching Data Dragon runesReforged.json structure
// ---------------------------------------------------------------------------

const syntheticRuneTrees: RuneTreesFile = [
  {
    id: 8000,
    key: "Precision",
    name: "Precision",
    icon: "rune-images/runes/reduced-size/8000_precision.png",
    slots: [
      {
        slotLabel: "Slot 1",
        runes: [
          {
            id: 8000,
            key: "perk0",
            icon: "rune-images/runes/reduced-size/8000_precision_perk0.png",
            name: "Press the Attack",
            shortDesc: "After dealing 3 consecutive attacks to the same champion, deal <stats>bonus damage</stats> and gain <status>attack speed</status>.",
            longDesc: "After dealing 3 consecutive attacks to the same champion, deal 40 - 100 bonus magic damage (based on level) and increase your attack speed by 30% for the next 3 attacks.",
          },
          {
            id: 8001,
            key: "perk1",
            icon: "rune-images/runes/reduced-size/8000_precision_perk1.png",
            name: "Lethal Tempo",
            shortDesc: "Gain attack speed when fighting champion.",
            longDesc: "Gain 50% attack speed for 3 seconds when you attack a champion. This effect can stack up to 5 times.",
          },
        ],
      },
      {
        slotLabel: "Slot 2",
        runes: [
          {
            id: 8002,
            key: "perk2",
            icon: "rune-images/runes/reduced-size/8000_precision_perk2.png",
            name: "Fleet Footwork",
            shortDesc: "Moving and attacking builds stacks.",
            longDesc: "Gain 30% movement speed for 1 second when you attack a champion. Each stack adds 10 movement speed. Max 5 stacks.",
          },
        ],
      },
    ],
  },
  {
    id: 8100,
    key: "Domination",
    name: "Domination",
    icon: "rune-images/runes/reduced-size/8100_domination.png",
    slots: [
      {
        slotLabel: "Slot 1",
        runes: [
          {
            id: 8100,
            key: "perk0",
            icon: "rune-images/runes/reduced-size/8100_domination_perk0.png",
            name: "Electrocute",
            shortDesc: "Hit a champion with 3 attacks in rapid succession.",
            longDesc: "Hitting a champion with 3 separate attacks or abilities within 3 seconds deals bonus magic damage.",
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// RuneTreesFile
// ---------------------------------------------------------------------------

describe("RuneTreesFile", () => {
  test("parses well-formed runesReforged.json array", () => {
    const result = RuneTreesFile.safeParse(syntheticRuneTrees);
    expect(result.success).toBe(true);
  });

  test("rejects non-array", () => {
    const result = RuneTreesFile.safeParse({});
    expect(result.success).toBe(false);
  });

  test("parses multiple rune trees", () => {
    const parsed = RuneTreesFile.parse(syntheticRuneTrees);
    expect(parsed.length).toBe(2);
    expect(parsed[0].key).toBe("Precision");
    expect(parsed[1].key).toBe("Domination");
  });
});

// ---------------------------------------------------------------------------
// RuneTree structure
// ---------------------------------------------------------------------------

describe("RuneTree", () => {
  test("has required fields: id, key, name, icon, slots", () => {
    const parsed = RuneTreesFile.parse(syntheticRuneTrees);
    const tree = parsed[0];
    expect(tree.id).toBe(8000);
    expect(tree.key).toBe("Precision");
    expect(tree.name).toBe("Precision");
    expect(typeof tree.icon).toBe("string");
    expect(Array.isArray(tree.slots)).toBe(true);
  });

  test("slots is array with at least one entry", () => {
    const parsed = RuneTreesFile.parse(syntheticRuneTrees);
    const tree = parsed[0];
    expect(tree.slots.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// RuneSlot
// ---------------------------------------------------------------------------

describe("RuneSlot", () => {
  test("has slotLabel and runes array", () => {
    const parsed = RuneTreesFile.parse(syntheticRuneTrees);
    const slot = parsed[0].slots[0];
    expect(slot.slotLabel).toBe("Slot 1");
    expect(Array.isArray(slot.runes)).toBe(true);
    expect(slot.runes.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Rune within a slot
// ---------------------------------------------------------------------------

describe("Rune (inner)", () => {
  test("has required fields: id, key, icon, name, shortDesc, longDesc", () => {
    const parsed = RuneTreesFile.parse(syntheticRuneTrees);
    const rune = parsed[0].slots[0].runes[0];
    expect(rune.id).toBe(8000);
    expect(rune.key).toBe("perk0");
    expect(typeof rune.icon).toBe("string");
    expect(rune.name).toBe("Press the Attack");
    expect(typeof rune.shortDesc).toBe("string");
    expect(typeof rune.longDesc).toBe("string");
  });

  test("shortDesc and longDesc contain HTML-like tags", () => {
    const parsed = RuneTreesFile.parse(syntheticRuneTrees);
    const rune = parsed[0].slots[0].runes[0];
    // shortDesc contains markup like <stats>, <status>
    expect(rune.shortDesc.length).toBeGreaterThan(0);
    expect(rune.longDesc.length).toBeGreaterThan(rune.shortDesc.length);
  });
});

// ---------------------------------------------------------------------------
// parseRuneTreesFile
// ---------------------------------------------------------------------------

describe("parseRuneTreesFile", () => {
  test("returns typed RuneTreesFile", () => {
    const result = parseRuneTreesFile(syntheticRuneTrees);
    expect(result[0].name).toBe("Precision");
  });
});