import { describe, expect, test } from "bun:test";
import { resolveMapId } from "../../src/domain/maps";

// ---------------------------------------------------------------------------
// resolveMapId
// ---------------------------------------------------------------------------

describe("resolveMapId", () => {
  test("known alias resolves to stringified numeric (summoners_rift → 11)", () => {
    expect(resolveMapId("summoners_rift")).toBe("11");
  });

  test("known alias: howling_abyss → 12", () => {
    expect(resolveMapId("howling_abyss")).toBe("12");
  });

  test("known alias: nexus_blitz → 21", () => {
    expect(resolveMapId("nexus_blitz")).toBe("21");
  });

  test("known alias: 2v2 → 22", () => {
    expect(resolveMapId("2v2")).toBe("22");
  });

  test("known alias: arena → 30", () => {
    expect(resolveMapId("arena")).toBe("30");
  });

  test("known alias: cherry → 33", () => {
    expect(resolveMapId("cherry")).toBe("33");
  });

  test("known alias: brawl → 35", () => {
    expect(resolveMapId("brawl")).toBe("35");
  });

  test("known numeric string passes through unchanged (11 → 11)", () => {
    expect(resolveMapId("11")).toBe("11");
  });

  test("known numeric string: 30 → 30", () => {
    expect(resolveMapId("30")).toBe("30");
  });

  test("unknown alias passes through as raw stringified numeric (999 → 999)", () => {
    expect(resolveMapId("999")).toBe("999");
  });

  test("case-insensitive alias resolution (SUMMONERS_RIFT → 11)", () => {
    expect(resolveMapId("SUMMONERS_RIFT")).toBe("11");
  });

  test("case-insensitive alias: Howling_AbySS → 12", () => {
    expect(resolveMapId("Howling_AbySS")).toBe("12");
  });

  test("empty string passes through unchanged", () => {
    expect(resolveMapId("")).toBe("");
  });
});
