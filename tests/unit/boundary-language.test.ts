import { describe, expect, test } from "bun:test";
import {
  FORBIDDEN_WORDS,
  FORBIDDEN_REGEX,
  assertNoForbiddenLanguage,
} from "../../src/mcp/boundary-language";

describe("FORBIDDEN_REGEX", () => {
  const forbiddenCases: Array<[string, string]> = [
    // Rank/rating terms
    ["S-tier pick", "S-tier"],
    ["A-tier champion", "A-tier"],
    ["optimal build", "optimal"],
    ["best champion", "best"],
    ["recommended for mid", "recommended"],
    ["tier list", "tier"],
    ["tier S", "tier"],
    ["win rate is 55%", "win rate"],
    ["winrate analysis", "winrate"],
    ["pick rate high", "pick rate"],
    ["ban rate", "ban rate"],
    ["meta champion", "meta"],
    ["strong pick", "strong"],
    ["broken champion", "broken"],
    ["overrated choice", "overrated"],
    ["underrated pick", "underrated"],
    ["must-pick champion", "must-pick"],
    ["first-pick strategy", "first-pick"],
    ["go-to champion", "go-to"],
    ["top-tier champion", "top-tier"],
    ["pro build", "pro build"],
    ["pro pick", "pro pick"],
    ["build order matters", "build order"],
    ["buffed in patch 16.1", "buffed"],
    ["nerfed heavily", "nerfed"],
    ["priority pick", "priority"],
    ["D-tier champion", "D-tier"],
    ["score of 9", "score"],
  ];

  test.each(forbiddenCases)("rejects '%s' (contains '%s')", (input) => {
    FORBIDDEN_REGEX.lastIndex = 0;
    const match = FORBIDDEN_REGEX.exec(input);
    expect(match).not.toBeNull();
  });

  const neutralCases: Array<[string, string]> = [
    ["Sona", "champion name Sona"],
    ["the spell has a 10 second cooldown", "cooldown in description"],
    ["Ahri the Nine-Tailed Fox", "champion title"],
    ["Flash is a summoner spell", "summoner spell name"],
    ["item description text", "item description"],
    ["Press the Attack rune", "rune name"],
    ["Patch 16.12.1", "patch version"],
    ["Boots of Speed", "item name"],
    ["Moderate difficulty", "difficulty text without 'tier'"],
    ["Score of the game", "score in non-ranking context"],
    ["Build completed", "verb 'build' not as recommendation"],
    ["Champion id", "id field name"],
    ["Champion key", "key field name"],
    ["Gold cost is 300", "gold field"],
    ["Movement speed stat", "stat field"],
  ];

  test.each(neutralCases)("accepts '%s' (%s)", (input) => {
    FORBIDDEN_REGEX.lastIndex = 0;
    const match = FORBIDDEN_REGEX.exec(input);
    expect(match).toBeNull();
  });
});

describe("assertNoForbiddenLanguage", () => {
  test("throws with message containing the offending term and source", () => {
    expect(() => assertNoForbiddenLanguage("use S-tier Aatrox", "test source")).toThrow(
      /Forbidden language detected in test source/
    );
    expect(() => assertNoForbiddenLanguage("use S-tier Aatrox", "test source")).toThrow(
      /S-tier/
    );
  });

  test("does not throw for neutral text", () => {
    expect(() =>
      assertNoForbiddenLanguage("Ahri is a champion with 8.5 attack", "test")
    ).not.toThrow();
  });
});

describe("FORBIDDEN_WORDS coverage", () => {
  test("includes all terms flagged in the design", () => {
    const required = [
      "best",
      "optimal",
      "tier",
      "score",
      "winrate",
      "recommended",
      "meta",
      "strong",
      "broken",
      "op",
      "buffed",
      "nerfed",
      "overrated",
      "underrated",
      "must-pick",
      "first-pick",
      "go-to",
      "top-tier",
      "S-tier",
      "A-tier",
      "build order",
      "pro build",
    ];
    for (const term of required) {
      expect(FORBIDDEN_WORDS).toContain(term);
    }
  });
});