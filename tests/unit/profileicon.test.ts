import { describe, expect, test } from "bun:test";
import { ProfileIconRecord, ProfileIconFile, parseProfileIconFile } from "../../src/domain/profileicon";

// ---------------------------------------------------------------------------
// Synthetic profile icon data matching Data Dragon profileicon.json structure
// ---------------------------------------------------------------------------

const syntheticProfileIconFile: ProfileIconFile = {
  type: "profileicon",
  version: "16.12.1",
  data: {
    "1": {
      id: 1,
      image: {
        full: "1.png",
        sprite: "profileicon0.png",
        group: "profileicon",
        x: 0,
        y: 0,
        w: 48,
        h: 48,
      },
    },
    "7": {
      id: 7,
      image: {
        full: "7.png",
        sprite: "profileicon0.png",
        group: "profileicon",
        x: 48,
        y: 0,
        w: 48,
        h: 48,
      },
    },
  },
};

// ---------------------------------------------------------------------------
// ProfileIconFile
// ---------------------------------------------------------------------------

describe("ProfileIconFile", () => {
  test("parses well-formed profileicon.json structure", () => {
    const result = ProfileIconFile.safeParse(syntheticProfileIconFile);
    expect(result.success).toBe(true);
  });

  test("rejects missing type field", () => {
    const malformed = { version: "16.12.1", data: {} };
    expect(ProfileIconFile.safeParse(malformed).success).toBe(false);
  });

  test("rejects bad version format", () => {
    const malformed = { type: "profileicon", version: "latest", data: {} };
    expect(ProfileIconFile.safeParse(malformed).success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ProfileIconRecord field preservation
// ---------------------------------------------------------------------------

describe("ProfileIconRecord", () => {
  test("preserves id", () => {
    const parsed = ProfileIconFile.parse(syntheticProfileIconFile);
    expect(parsed.data["1"].id).toBe(1);
    expect(parsed.data["7"].id).toBe(7);
  });

  test("preserves image object", () => {
    const parsed = ProfileIconFile.parse(syntheticProfileIconFile);
    const icon1 = parsed.data["1"];
    expect(icon1.image.full).toBe("1.png");
    expect(icon1.image.sprite).toBe("profileicon0.png");
    expect(icon1.image.group).toBe("profileicon");
    expect(icon1.image.w).toBe(48);
    expect(icon1.image.h).toBe(48);
  });

  test("image has x/y coordinates", () => {
    const parsed = ProfileIconFile.parse(syntheticProfileIconFile);
    const icon1 = parsed.data["1"];
    expect(icon1.image.x).toBe(0);
    expect(icon1.image.y).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// parseProfileIconFile
// ---------------------------------------------------------------------------

describe("parseProfileIconFile", () => {
  test("returns typed ProfileIconFile", () => {
    const result = parseProfileIconFile(syntheticProfileIconFile);
    expect(result.data["1"].id).toBe(1);
  });
});