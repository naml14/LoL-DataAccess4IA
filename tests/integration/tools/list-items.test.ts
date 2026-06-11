import { describe, expect, test, beforeEach } from "bun:test";
import { listItemsTool } from "../../../src/tools/list-items";
import { createToolContext } from "../../../src/tools/_ctx";
import { MemoryCache } from "../../../src/cache/memory";
import { DDragonClient } from "../../../src/ddragon/client";

// Boundary assertion: tool description must not contain recommendation language.
const FORBIDDEN = /best|recommended|optimal|meta|should|strong|pick|tier/gi;

function makeItemFile(items: Array<{
  id: number; name: string; plaintext: string;
  gold: { base: number; total: number; sell: number };
  tags: Record<string, boolean>; imageFull: string;
}>) {
  const data: Record<string, unknown> = {};
  for (const item of items) {
    data[String(item.id)] = {
      id: item.id,
      name: item.name,
      description: "<description>",
      colloq: "",
      plaintext: item.plaintext,
      into: [],
      from: [],
      image: { full: item.imageFull, sprite: "sprite.png", group: "item", x: 0, y: 0, w: 48, h: 48 },
      gold: { base: item.gold.base, purchasable: true, total: item.gold.total, sell: item.gold.sell },
      tags: item.tags,
      maps: { "11": true, "12": true },
      stats: {},
    };
  }
  return { type: "item" as const, version: "14.10.1", data };
}

const ITEM_FIXTURE = makeItemFile([
  { id: 1001, name: "Boots of Speed", plaintext: "Slightly movement speed", gold: { base: 300, total: 300, sell: 210 }, tags: { boots: true }, imageFull: "1001.png" },
  { id: 1036, name: "Long Sword", plaintext: "Slightly attack damage", gold: { base: 350, total: 350, sell: 245 }, tags: { damage: true, onhit: true }, imageFull: "1036.png" },
  { id: 3001, name: "Amplifying Tome", plaintext: "Slightly ability power", gold: { base: 435, total: 435, sell: 304 }, tags: { mana: true, "spell damage": true }, imageFull: "3001.png" },
]);

describe("list_items", () => {
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
      const src = listItemsTool.description;
      const matches = src.match(FORBIDDEN);
      expect(matches).toBeNull();
    });
  });

  describe("handler", () => {
    test("returns correct output shape with item list", async () => {
      const result = await listItemsTool.handler({}, ctx);

      expect(typeof result).toBe("object");
      expect(typeof (result as any).version).toBe("string");
      expect(typeof (result as any).locale).toBe("string");
      expect(typeof (result as any).count).toBe("number");
      expect(Array.isArray((result as any).items)).toBe(true);
      expect((result as any).count).toBe(3);
    });

    test("each item has required compact fields", async () => {
      const result = await listItemsTool.handler({}, ctx);
      const item = (result as any).items[0];

      expect(typeof item.id).toBe("number");
      expect(typeof item.name).toBe("string");
      expect(typeof item.plaintext).toBe("string");
      expect(typeof item.gold).toBe("object");
      expect(typeof item.gold.total).toBe("number");
      expect(typeof item.gold.sell).toBe("number");
      expect(typeof item.gold.base).toBe("number");
      expect(Array.isArray(item.tags)).toBe(true);
      expect(typeof item.image).toBe("object");
      expect(typeof item.image.full).toBe("string");
    });

    test("item values match fixture data", async () => {
      const result = await listItemsTool.handler({}, ctx);
      const itemMap: Record<number, unknown> = {};
      for (const item of (result as any).items) {
        itemMap[item.id] = item;
      }

      expect((itemMap[1001] as any).name).toBe("Boots of Speed");
      expect((itemMap[1036] as any).gold.total).toBe(350);
      expect((itemMap[3001] as any).tags).toContain("mana");
    });

    test("uses config locale when no locale input provided", async () => {
      const result = await listItemsTool.handler({}, ctx);
      expect((result as any).locale).toBe("en_US");
    });

    test("uses explicit locale override from input", async () => {
      const result = await listItemsTool.handler({ locale: "es_ES" }, ctx);
      expect((result as any).locale).toBe("es_ES");
    });

    test("uses explicit version override from input", async () => {
      const result = await listItemsTool.handler({ version: "13.1.1" }, ctx);
      expect((result as any).version).toBe("13.1.1");
    });

    test("cache hit on second call (no network)", async () => {
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
        await listItemsTool.handler({}, ctx);
        // Second call — should hit cache
        await listItemsTool.handler({}, ctx);

        expect(callCount).toBe(2); // 1 for versions.json + 1 for item.json
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});