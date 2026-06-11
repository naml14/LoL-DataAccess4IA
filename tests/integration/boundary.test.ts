import { test, expect } from "bun:test";
import { getCurrentPatchTool } from "../../src/tools/get-current-patch";
import { listChampionsTool } from "../../src/tools/list-champions";
import { getChampionTool } from "../../src/tools/get-champion";
import { listItemsTool } from "../../src/tools/list-items";
import { getItemTool } from "../../src/tools/get-item";
import { listRunesTool } from "../../src/tools/list-runes";
import { listSummonerSpellsTool } from "../../src/tools/list-summoner-spells";
import { listProfileIconsTool } from "../../src/tools/list-profile-icons";
import { createToolContext } from "../../src/tools/_ctx";
import type { ToolContext } from "../../src/tools/_ctx";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Forbidden language regex — covers reasoning/recommendation terms.
 * Matches: best, recommended, tier list, tier S, should you/build/pick,
 * meta pick, strong pick, optimal build, top build, pro build, build order.
 */
const FORBIDDEN_PATTERN =
  /best|recommended|tier\s*list|tier\s*[sS]|should\s+(?:you|build|pick)|meta\s+pick|strong\s+pick|optimal\s+build|top\s+build|pro\s+build|build\s+order/gi;

const ALL_TOOLS = [
  getCurrentPatchTool,
  listChampionsTool,
  getChampionTool,
  listItemsTool,
  getItemTool,
  listRunesTool,
  listSummonerSpellsTool,
  listProfileIconsTool,
];

// ---------------------------------------------------------------------------
// Tool source files (for description scan)
// ---------------------------------------------------------------------------

const TOOL_SOURCE_FILES: Record<string, string> = {
  get_current_patch: "src/tools/get-current-patch.ts",
  list_champions: "src/tools/list-champions.ts",
  get_champion: "src/tools/get-champion.ts",
  list_items: "src/tools/list-items.ts",
  get_item: "src/tools/get-item.ts",
  list_runes: "src/tools/list-runes.ts",
  list_summoner_spells: "src/tools/list-summoner-spells.ts",
  list_profile_icons: "src/tools/list-profile-icons.ts",
};

// ---------------------------------------------------------------------------
// Mock context — synthetic fixtures, no network
// ---------------------------------------------------------------------------

function buildMockContext(fixtures: {
  version?: string;
  champions?: unknown;
  items?: unknown;
  runes?: unknown;
  summonerSpells?: unknown;
  profileIcons?: unknown;
}): ToolContext {
  const mockCache = new Map<string, unknown>();
  const mockLogger = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  };

  // Pre-populate cache with fixtures
  if (fixtures.version) {
    mockCache.set("ddragon:resolved-version:__singleton", fixtures.version);
  }
  if (fixtures.champions) {
    mockCache.set(
      "ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json",
      fixtures.champions
    );
  }
  if (fixtures.items) {
    mockCache.set(
      "ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/item.json",
      fixtures.items
    );
  }
  if (fixtures.runes) {
    mockCache.set(
      "ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/runesReforged.json",
      fixtures.runes
    );
  }
  if (fixtures.summonerSpells) {
    mockCache.set(
      "ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/summoner.json",
      fixtures.summonerSpells
    );
  }
  if (fixtures.profileIcons) {
    mockCache.set(
      "ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/profileicon.json",
      fixtures.profileIcons
    );
  }

  const mockClient = {
    getChampionList: async () => fixtures.champions,
    getItemList: async () => fixtures.items,
    getRuneList: async () => fixtures.runes,
    getSummonerList: async () => fixtures.summonerSpells,
    getProfileIconList: async () => fixtures.profileIcons,
  } as unknown as ToolContext["client"];

  return createToolContext({
    client: mockClient,
    cache: mockCache as ToolContext["cache"],
    config: {
      locale: "en_US",
      ttlSeconds: 900,
      pinVersion: null,
      cacheDir: "./.cache/ddragon",
      httpTimeoutMs: 5000,
      logLevel: "info",
    },
    logger: mockLogger,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function findForbiddenMatches(text: string): string[] {
  const results: string[] = [];
  let match: RegExpExecArray | null;
  // Reset lastIndex before each search
  FORBIDDEN_PATTERN.lastIndex = 0;
  while ((match = FORBIDDEN_PATTERN.exec(text)) !== null) {
    results.push(match[0]);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Boundary tests — response scan
// ---------------------------------------------------------------------------

test("boundary: get_current_patch response contains no reasoning language", async () => {
  const ctx = buildMockContext({ version: "14.10.1" });
  const result = await getCurrentPatchTool.handler({}, ctx);
  const serialized = JSON.stringify(result);
  const matches = findForbiddenMatches(serialized);
  expect(matches).toEqual([]);
});

test("boundary: list_champions response contains no reasoning language", async () => {
  const championsFile = {
    type: "champion",
    version: "14.10.1",
    data: {
      Ahri: {
        id: "Ahri", key: "103", name: "Ahri", title: "the Nine-Tailed Fox",
        tags: ["Mage", "Assassin"], blurb: "Ash团",
        stats: {}, image: {},
      },
    },
  };
  const ctx = buildMockContext({ version: "14.10.1", champions: championsFile });
  const result = await listChampionsTool.handler({}, ctx);
  const serialized = JSON.stringify(result);
  const matches = findForbiddenMatches(serialized);
  expect(matches).toEqual([]);
});

test("boundary: get_champion response contains no reasoning language", async () => {
  const championsFile = {
    type: "champion",
    version: "14.10.1",
    data: {
      Ahri: {
        id: "Ahri", key: "103", name: "Ahri", title: "the Nine-Tailed Fox",
        tags: ["Mage", "Assassin"], blurb: "A cunning fox.",
        stats: { hp: 500, mp: 400 }, image: {},
      },
    },
  };
  const ctx = buildMockContext({ version: "14.10.1", champions: championsFile });
  const result = await getChampionTool.handler({ idOrKey: "Ahri" }, ctx);
  const serialized = JSON.stringify(result);
  const matches = findForbiddenMatches(serialized);
  expect(matches).toEqual([]);
});

test("boundary: list_items response contains no reasoning language", async () => {
  const itemsFile = {
    type: "item",
    version: "14.10.1",
    data: {
      "1001": {
        id: 1001, name: "Boots of Speed", plaintext: "Slightly increases Movement Speed",
        gold: { total: 300, sell: 210, base: 300 },
        tags: {}, image: { full: "item.png" },
      },
    },
  };
  const ctx = buildMockContext({ version: "14.10.1", items: itemsFile });
  const result = await listItemsTool.handler({}, ctx);
  const serialized = JSON.stringify(result);
  const matches = findForbiddenMatches(serialized);
  expect(matches).toEqual([]);
});

test("boundary: get_item response contains no reasoning language", async () => {
  const itemsFile = {
    type: "item",
    version: "14.10.1",
    data: {
      "1001": {
        id: 1001, name: "Boots of Speed", plaintext: "Slightly increases Movement Speed",
        gold: { total: 300, sell: 210, base: 300 },
        tags: {}, image: { full: "item.png" },
      },
    },
  };
  const ctx = buildMockContext({ version: "14.10.1", items: itemsFile });
  const result = await getItemTool.handler({ id: 1001 }, ctx);
  const serialized = JSON.stringify(result);
  const matches = findForbiddenMatches(serialized);
  expect(matches).toEqual([]);
});

test("boundary: list_runes response contains no reasoning language", async () => {
  const runesFile = [
    {
      id: 1, key: "Precision", name: "Precision",
      icon: "perk-images/Styles/Precision.png",
      slots: [
        {
          slotLabel: "Slot 1",
          runes: [
            { id: 1, key: "PressTheAttack", name: "Press the Attack", icon: "", shortDesc: "Attack and expose enemy", longDesc: "Your attacks and abilities damage enemies up to 3 times over 3 seconds" },
          ],
        },
      ],
    },
  ];
  const ctx = buildMockContext({ version: "14.10.1", runes: runesFile });
  const result = await listRunesTool.handler({}, ctx);
  const serialized = JSON.stringify(result);
  const matches = findForbiddenMatches(serialized);
  expect(matches).toEqual([]);
});

test("boundary: list_summoner_spells response contains no reasoning language", async () => {
  const spellsFile = {
    type: "summoner",
    version: "14.10.1",
    data: {
      SummonerFlash: {
        id: "SummonerFlash", name: "Flash", description: "Teleports your champion a short distance",
        cooldown: [300], summonerLevel: 1, icon: "spell/SummonerFlash.png",
        image: { full: "SummonerFlash.png", sprite: "", group: "", w: 0, h: 0, x: 0, y: 0 },
      },
    },
  };
  const ctx = buildMockContext({ version: "14.10.1", summonerSpells: spellsFile });
  const result = await listSummonerSpellsTool.handler({}, ctx);
  const serialized = JSON.stringify(result);
  const matches = findForbiddenMatches(serialized);
  expect(matches).toEqual([]);
});

test("boundary: list_profile_icons response contains no reasoning language", async () => {
  const iconsFile = {
    type: "profileicon",
    version: "14.10.1",
    data: {
      "1": { id: 1, image: { full: "profileicon/1.png" } },
    },
  };
  const ctx = buildMockContext({ version: "14.10.1", profileIcons: iconsFile });
  const result = await listProfileIconsTool.handler({}, ctx);
  const serialized = JSON.stringify(result);
  const matches = findForbiddenMatches(serialized);
  expect(matches).toEqual([]);
});

// ---------------------------------------------------------------------------
// Boundary tests — description scan (read from source files)
// ---------------------------------------------------------------------------

test("boundary: tool descriptions in source files contain no reasoning language", async () => {
  const failingTools: string[] = [];

  for (const tool of ALL_TOOLS) {
    const sourcePath = TOOL_SOURCE_FILES[tool.name];
    if (!sourcePath) continue;

    const sourceContent = await Bun.file(sourcePath).text();
    const matches = findForbiddenMatches(sourceContent);
    if (matches.length > 0) {
      failingTools.push(`${tool.name}: ${matches.join(", ")}`);
    }
  }

  expect(failingTools).toEqual([]);
});

// ---------------------------------------------------------------------------
// Boundary test — synthetic fixture with forbidden content would fail
// ---------------------------------------------------------------------------

test("boundary: synthetic fixture containing forbidden keywords would fail the test", () => {
  // This proves the regex correctly detects forbidden language.
  const syntheticResponse = JSON.stringify({
    isError: false,
    data: {
      champion: {
        id: "Ahri",
        name: "Ahri",
        description: "This is the best champion for the meta pick",
      },
    },
  });
  const matches = findForbiddenMatches(syntheticResponse);
  // "best" matches, "meta pick" matches
  expect(matches).toContain("best");
  expect(matches).toContain("meta pick");
});