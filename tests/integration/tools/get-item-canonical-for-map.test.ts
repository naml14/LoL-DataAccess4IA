import { describe, expect, test, beforeEach } from "bun:test";
import { getItemCanonicalForMapTool } from "../../../src/tools/get-item-canonical-for-map";
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
    maps: { "11": true, "12": true },
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
  // Item with no maps field — use empty object to represent absent maps
  {
    id: 4403, name: "Guardian Horn", description: "<active>Guardian Horn.</active>",
    plaintext: "A horn", gold: { base: 400, total: 400, sell: 280 },
    tags: ["Health"], imageFull: "4403.png",
    maps: {},
  },
]);

describe("get_item_canonical_for_map", () => {
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
        assertNoForbiddenLanguage(getItemCanonicalForMapTool.description, "get_item_canonical_for_map description")
      ).not.toThrow();
    });
  });

  describe("handler", () => {
    test("returns single record when one item matches name+mapId (numeric: 11)", async () => {
      const result = await getItemCanonicalForMapTool.handler({ name: "Stormrazor", mapId: "11" }, ctx);
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect((result as unknown[])[0]).toHaveProperty("name", "Stormrazor");
    });

    test("accepts human-readable alias (summoners_rift)", async () => {
      const result = await getItemCanonicalForMapTool.handler({ name: "Stormrazor", mapId: "summoners_rift" }, ctx);
      expect(result).toHaveLength(1);
      expect((result as unknown[])[0]).toHaveProperty("name", "Stormrazor");
    });

    test("accepts alias: arena", async () => {
      const result = await getItemCanonicalForMapTool.handler({ name: "Stormrazor", mapId: "arena" }, ctx);
      expect(result).toHaveLength(1);
      expect((result as unknown[])[0]).toHaveProperty("name", "Stormrazor");
    });

    test("returns full array when multiple items match name+mapId", async () => {
      // Both Stormrazor entries have maps.11=true in this supplemental data
      const supplementalFile = makeItemFile([
        {
          id: 3097, name: "Stormrazor", description: "<attack>SR.</attack>",
          plaintext: "SR", gold: { base: 700, total: 700, sell: 490 },
          tags: ["AttackSpeed"], imageFull: "3097.png",
          maps: { "11": true },
        },
        {
          id: 3098, name: "Stormrazor", description: "<attack>SR2.</attack>",
          plaintext: "SR2", gold: { base: 700, total: 700, sell: 490 },
          tags: ["AttackSpeed"], imageFull: "3098.png",
          maps: { "11": true },
        },
      ]);

      const cache = new MemoryCache<unknown>();
      const client = new DDragonClient({ timeoutMs: 5000, retries: 1, circuitThreshold: 3 });
      const localCtx = createToolContext({
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
          return new Response(JSON.stringify(supplementalFile), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("Not Found", { status: 404 });
      };

      const result = await getItemCanonicalForMapTool.handler({ name: "Stormrazor", mapId: "11" }, localCtx);
      expect(result).toHaveLength(2);
    });

    test("returns empty array when no item has name+mapId", async () => {
      const result = await getItemCanonicalForMapTool.handler({ name: "Banana", mapId: "11" }, ctx);
      expect(result).toEqual([]);
    });

    test("returns empty array when name matches but not mapId", async () => {
      // Stormrazor SR has maps.11 but not maps.12
      const result = await getItemCanonicalForMapTool.handler({ name: "Stormrazor", mapId: "12" }, ctx);
      expect(result).toEqual([]);
    });

    test("unknown mapId passes through as raw stringified numeric (forward-compat)", async () => {
      const result = await getItemCanonicalForMapTool.handler({ name: "Stormrazor", mapId: "999" }, ctx);
      expect(result).toEqual([]);
    });

    test("case-insensitive alias resolution (SUMMONERS_RIFT)", async () => {
      const result = await getItemCanonicalForMapTool.handler({ name: "Stormrazor", mapId: "SUMMONERS_RIFT" }, ctx);
      expect(result).toHaveLength(1);
    });

    test("uses explicit version override", async () => {
      const result = await getItemCanonicalForMapTool.handler({ name: "Stormrazor", mapId: "11", version: "13.1.1" }, ctx);
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
        await getItemCanonicalForMapTool.handler({ name: "Stormrazor", mapId: "11" }, ctx);
        // Second call — should hit cache
        await getItemCanonicalForMapTool.handler({ name: "Stormrazor", mapId: "11" }, ctx);

        expect(callCount).toBe(2); // 1 for versions.json + 1 for item.json
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    test("returns empty array when item has no maps field", async () => {
      const result = await getItemCanonicalForMapTool.handler({ name: "Guardian Horn", mapId: "11" }, ctx);
      expect(result).toEqual([]);
    });
  });
});
