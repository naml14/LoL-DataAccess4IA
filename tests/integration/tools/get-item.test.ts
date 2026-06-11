import { describe, expect, test, beforeEach } from "bun:test";
import { getItemTool } from "../../../src/tools/get-item";
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

describe("get_item", () => {
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
      const src = getItemTool.description;
      const matches = src.match(FORBIDDEN);
      expect(matches).toBeNull();
    });
  });

  describe("handler", () => {
    test("returns full item record when found by id", async () => {
      const result = await getItemTool.handler({ id: 1001 }, ctx);
      expect((result as any).id).toBe(1001);
      expect((result as any).name).toBe("Boots of Speed");
      expect(typeof (result as any).description).toBe("string");
      expect(typeof (result as any).gold).toBe("object");
    });

    test("returns full item record for different id", async () => {
      const result = await getItemTool.handler({ id: 3001 }, ctx);
      expect((result as any).id).toBe(3001);
      expect((result as any).name).toBe("Amplifying Tome");
    });

    test("throws not-found error when item id does not exist", async () => {
      let thrown: unknown = null;
      try {
        await getItemTool.handler({ id: 9999 }, ctx);
      } catch (err) {
        thrown = err;
      }
      expect(thrown).not.toBeNull();
      expect((thrown as any).code).toBe("not-found");
    });

    test("uses explicit version override", async () => {
      const result = await getItemTool.handler({ id: 1001, version: "13.1.1" }, ctx);
      expect((result as any).id).toBe(1001);
    });

    test("uses explicit locale override", async () => {
      const result = await getItemTool.handler({ id: 1001, locale: "es_ES" }, ctx);
      expect((result as any).id).toBe(1001);
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
        await getItemTool.handler({ id: 1001 }, ctx);
        // Second call — should hit cache
        await getItemTool.handler({ id: 1001 }, ctx);

        expect(callCount).toBe(2); // 1 for versions.json + 1 for item.json
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});