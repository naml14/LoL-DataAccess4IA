import { describe, expect, test, beforeEach } from "bun:test";
import { getItemsByNameTool } from "../../../src/tools/get-items-by-name";
import { createToolContext } from "../../../src/tools/_ctx";
import { MemoryCache } from "../../../src/cache/memory";
import { DDragonClient } from "../../../src/ddragon/client";
import { assertNoForbiddenLanguage } from "../../../src/mcp/boundary-language";

function makeItemFile(items: Array<{
  id: number; name: string; description: string; plaintext: string;
  gold: { base: number; total: number; sell: number };
  tags: string[]; imageFull: string; maps?: Record<string, boolean>;
}>) {
  const data: Record<string, unknown> = {};
  for (const item of items) {
    data[String(item.id)] = {
      name: item.name,
      description: item.description,
      colloq: "",
      plaintext: item.plaintext,
      into: [],
      from: [],
      image: { full: item.imageFull, sprite: "sprite.png", group: "item", x: 0, y: 0, w: 48, h: 48 },
      gold: { base: item.gold.base, purchasable: true, total: item.gold.total, sell: item.gold.sell },
      tags: item.tags,
      maps: item.maps ?? { "11": true, "12": true },
      stats: {},
    };
  }
  return { type: "item" as const, version: "14.10.1", data };
}

const ITEM_FIXTURE = makeItemFile([
  {
    id: 1001, name: "Boots of Speed", description: "<manaRegen>Basic boots.</manaRegen>",
    plaintext: "Slightly movement speed", gold: { base: 300, total: 300, sell: 210 },
    tags: ["Boots"], imageFull: "1001.png",
  },
  {
    id: 3097, name: "Stormrazor", description: "<attack>SR Stormrazor.</attack>",
    plaintext: "Stormrazor for Summoner's Rift",
    gold: { base: 700, total: 700, sell: 490 },
    tags: ["AttackSpeed"], imageFull: "3097.png",
    maps: { "11": true },
  },
  {
    id: 223095, name: "Stormrazor", description: "<attack>Arena Stormrazor.</attack>",
    plaintext: "Stormrazor for Arena",
    gold: { base: 700, total: 700, sell: 490 },
    tags: ["AttackSpeed"], imageFull: "223095.png",
    maps: { "30": true },
  },
  {
    id: 3001, name: "Amplifying Tome", description: "<ability>AP tome.</ability>",
    plaintext: "Slightly ability power", gold: { base: 435, total: 435, sell: 304 },
    tags: ["SpellDamage"], imageFull: "3001.png",
  },
]);

describe("get_items_by_name", () => {
  let ctx: ReturnType<typeof createToolContext>;

  beforeEach(() => {
    const cache = new MemoryCache<unknown>();
    const client = new DDragonClient({ timeoutMs: 5000, retries: 1, circuitThreshold: 3 });

    ctx = createToolContext({
      client,
      cache,
      config: {
        locale: "en_US",
        ttlSeconds: 900,
        pinVersion: null,
        cacheDir: "./.cache/ddragon",
        httpTimeoutMs: 5000,
        logLevel: "info",
      },
      logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    });

    globalThis.fetch = async (url: string) => {
      if (url.includes("/api/versions.json")) {
        return new Response(JSON.stringify(["14.10.1"]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/cdn/") && url.endsWith("/item.json")) {
        return new Response(JSON.stringify(ITEM_FIXTURE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not Found", { status: 404 });
    };
  });

  describe("boundary", () => {
    test("description contains no recommendation language", () => {
      expect(() =>
        assertNoForbiddenLanguage(getItemsByNameTool.description, "get_items_by_name description")
      ).not.toThrow();
    });
  });

  describe("handler", () => {
    test("returns single match with full ItemRecord including maps field", async () => {
      const result = await getItemsByNameTool.handler({ name: "Boots of Speed" }, ctx);
      expect(Array.isArray(result)).toBe(true);
      const arr = result as unknown[];
      expect(arr).toHaveLength(1);
      const item = arr[0] as Record<string, unknown>;
      expect(item.name).toBe("Boots of Speed");
      expect(typeof item.description).toBe("string");
      expect(typeof item.maps).toBe("object");
    });

    test("returns all map-variants for duplicated name (Stormrazor multi-match)", async () => {
      const result = await getItemsByNameTool.handler({ name: "Stormrazor" }, ctx);
      const arr = result as unknown[];
      expect(arr.length).toBeGreaterThanOrEqual(2);
      const ids = arr.map((r) => (r as Record<string, unknown>).name);
      // Both SR and Arena Stormrazor returned
      expect(ids).toContain("Stormrazor");
    });

    test("case-insensitive exact match (STORMRAZOR uppercase)", async () => {
      const result = await getItemsByNameTool.handler({ name: "STORMRAZOR" }, ctx);
      const arr = result as unknown[];
      expect(arr.length).toBeGreaterThanOrEqual(2);
    });

    test("substring does NOT match (storm → empty array)", async () => {
      const result = await getItemsByNameTool.handler({ name: "storm" }, ctx);
      expect(result).toEqual([]);
    });

    test("empty array for unknown name", async () => {
      const result = await getItemsByNameTool.handler({ name: "NonexistentItemXYZ" }, ctx);
      expect(result).toEqual([]);
    });

    test("name with spaces matches exactly (Boots of Speed)", async () => {
      const result = await getItemsByNameTool.handler({ name: "Boots of Speed" }, ctx);
      expect(result).toHaveLength(1);
    });

    test("uses explicit version override", async () => {
      const result = await getItemsByNameTool.handler({ name: "Boots of Speed", version: "13.1.1" }, ctx);
      expect(Array.isArray(result)).toBe(true);
      expect((result as unknown[]).length).toBeGreaterThan(0);
    });

    test("uses explicit locale override", async () => {
      const result = await getItemsByNameTool.handler({ name: "Boots of Speed", locale: "es_ES" }, ctx);
      expect(Array.isArray(result)).toBe(true);
    });

    test("cache hit on second call (no extra network request)", async () => {
      let callCount = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url: string) => {
        if (url.includes("/api/versions.json") || (url.includes("/cdn/") && url.endsWith("/item.json"))) {
          callCount++;
        }
        return originalFetch(url);
      };

      try {
        // First call — populate cache
        await getItemsByNameTool.handler({ name: "Boots of Speed" }, ctx);
        // Second call — should hit cache
        await getItemsByNameTool.handler({ name: "Boots of Speed" }, ctx);

        expect(callCount).toBe(2); // 1 for versions.json + 1 for item.json
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});
