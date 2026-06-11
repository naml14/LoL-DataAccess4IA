import { test, expect } from "bun:test";
import { ToolRegistry } from "../../src/mcp/tool-registry";
import { getCurrentPatchTool } from "../../src/tools/get-current-patch";
import { listChampionsTool } from "../../src/tools/list-champions";
import { getChampionTool } from "../../src/tools/get-champion";
import { listItemsTool } from "../../src/tools/list-items";
import { getItemTool } from "../../src/tools/get-item";
import { listRunesTool } from "../../src/tools/list-runes";
import { listSummonerSpellsTool } from "../../src/tools/list-summoner-spells";
import { listProfileIconsTool } from "../../src/tools/list-profile-icons";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FORBIDDEN_PATTERN = /best|recommended|tier\s*list|tier\s*[sS]|should\s+(?:you|build|pick)|meta\s+pick|strong\s+pick|optimal\s+build|top\s+build|pro\s+build|build\s+order/gi;

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

const EXPECTED_NAMES = [
  "get_current_patch",
  "list_champions",
  "get_champion",
  "list_items",
  "get_item",
  "list_runes",
  "list_summoner_spells",
  "list_profile_icons",
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("ToolRegistry: lists all 8 tools", () => {
  const registry = new ToolRegistry();
  const tools = registry.listTools();
  expect(tools).toHaveLength(8);
});

test("ToolRegistry: tools have correct names", () => {
  const registry = new ToolRegistry();
  const tools = registry.listTools();
  const names = tools.map((t) => t.name).sort();
  expect(names).toEqual(EXPECTED_NAMES.sort());
});

test("ToolRegistry: getTool returns correct tool for each name", () => {
  const registry = new ToolRegistry();
  for (const name of EXPECTED_NAMES) {
    const tool = registry.getTool(name);
    expect(tool).toBeDefined();
    expect(tool!.name).toBe(name);
  }
});

test("ToolRegistry: getTool returns undefined for unknown tool", () => {
  const registry = new ToolRegistry();
  expect(registry.getTool("unknown_tool")).toBeUndefined();
});

test("ToolRegistry: each tool has name, description, and inputSchema", () => {
  const registry = new ToolRegistry();
  const tools = registry.listTools();
  for (const tool of tools) {
    expect(typeof tool.name).toBe("string");
    expect(tool.name.length).toBeGreaterThan(0);
    expect(typeof tool.description).toBe("string");
    expect(tool.description.length).toBeGreaterThan(0);
    expect(tool.inputSchema).toBeDefined();
    expect(typeof tool.inputSchema).toBe("object");
  }
});

test("ToolRegistry: tool descriptions contain no reasoning language (boundary)", async () => {
  const registry = new ToolRegistry();
  const tools = registry.listTools();

  for (const tool of tools) {
    const matches = tool.description.match(FORBIDDEN_PATTERN);
    expect(matches).toBeNull();
  }
});

test("ToolRegistry: tool descriptions scanned from source files contain no reasoning language", async () => {
  // Map tool names to their source file paths
  const toolSourceFiles: Record<string, string> = {
    get_current_patch: "src/tools/get-current-patch.ts",
    list_champions: "src/tools/list-champions.ts",
    get_champion: "src/tools/get-champion.ts",
    list_items: "src/tools/list-items.ts",
    get_item: "src/tools/get-item.ts",
    list_runes: "src/tools/list-runes.ts",
    list_summoner_spells: "src/tools/list-summoner-spells.ts",
    list_profile_icons: "src/tools/list-profile-icons.ts",
  };

  const registry = new ToolRegistry();
  const tools = registry.listTools();

  for (const tool of tools) {
    const sourcePath = toolSourceFiles[tool.name];
    if (!sourcePath) continue;

    const sourceContent = await Bun.file(sourcePath).text();
    const matches = sourceContent.match(FORBIDDEN_PATTERN);
    expect(matches).toBeNull();
  }
});

test("ToolRegistry: each tool's inputSchema validates with Zod at registration", () => {
  // The registry validates schemas at construction time.
  // If any schema is invalid Zod, the constructor throws.
  expect(() => new ToolRegistry()).not.toThrow();
});

test("ToolRegistry: registered tools match the static imports", () => {
  const registry = new ToolRegistry();
  const tools = registry.listTools();

  for (const expected of ALL_TOOLS) {
    const found = tools.find((t) => t.name === expected.name);
    expect(found).toBeDefined();
    expect(found!.description).toBe(expected.description);
  }
});

test("ToolRegistry: getTool returns the exact same tool descriptor as listTools", () => {
  const registry = new ToolRegistry();
  const listed = registry.listTools();
  for (const tool of listed) {
    const byName = registry.getTool(tool.name);
    expect(byName).toBe(tool);
  }
});