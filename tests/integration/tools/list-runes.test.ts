import { describe, expect, test, beforeEach } from "bun:test";
import { listRunesTool } from "../../../src/tools/list-runes";
import { createToolContext } from "../../../src/tools/_ctx";
import { MemoryCache } from "../../../src/cache/memory";
import { DDragonClient } from "../../../src/ddragon/client";

// Boundary assertion: tool description must not contain recommendation language.
const FORBIDDEN = /best|recommended|optimal|meta|should|strong|pick|tier/gi;

/** Build a synthetic runesReforged.json array (direct array, not wrapped object). */
function makeRunesFile(trees: Array<{
  id: number; key: string; name: string; icon: string;
  slots: Array<{
    slotLabel: string;
    runes: Array<{ id: number; key: string; name: string; icon: string; shortDesc: string; longDesc: string }>;
  }>;
}>) {
  return trees;
}

const RUNES_FIXTURE = makeRunesFile([
  {
    id: 8000, key: "Precision", name: "Precision", icon: "perk-images/Styles/7200_Precision.png",
    slots: [
      {
        slotLabel: "Slot 1",
        runes: [
          { id: 8000, key: "Precision", name: "Precision", icon: "perk-images/Styles/7200_Precision.png", shortDesc: "<tag=masteriesTooltipAQ>", longDesc: "<tags=masteriesTooltipAD>" },
        ],
      },
    ],
  },
  {
    id: 8100, key: "Domination", name: "Domination", icon: "perk-images/Styles/7201_Domination.png",
    slots: [
      {
        slotLabel: "Slot 1",
        runes: [
          { id: 8112, key: "Electrocute", name: "Electrocute", icon: "perk-images/Styles/Domination/Electrocute.png", shortDesc: "Deal damage", longDesc: "Deal extra damage" },
        ],
      },
    ],
  },
]);

describe("list_runes", () => {
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
      if (url.includes("/runesReforged.json")) {
        return new Response(JSON.stringify(RUNES_FIXTURE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not Found", { status: 404 });
    };
  });

  describe("boundary", () => {
    test("description contains no recommendation language", () => {
      const src = listRunesTool.description;
      const matches = src.match(FORBIDDEN);
      expect(matches).toBeNull();
    });
  });

  describe("handler", () => {
    test("returns correct output shape with rune tree list", async () => {
      const result = await listRunesTool.handler({}, ctx);

      expect(typeof result).toBe("object");
      expect(typeof (result as any).version).toBe("string");
      expect(typeof (result as any).locale).toBe("string");
      expect(Array.isArray((result as any).trees)).toBe(true);
      expect((result as any).trees.length).toBe(2);
    });

    test("each tree has required fields", async () => {
      const result = await listRunesTool.handler({}, ctx);
      const tree = (result as any).trees[0];

      expect(typeof tree.id).toBe("number");
      expect(typeof tree.key).toBe("string");
      expect(typeof tree.name).toBe("string");
      expect(typeof tree.icon).toBe("string");
      expect(Array.isArray(tree.slots)).toBe(true);
    });

    test("each slot has required fields", async () => {
      const result = await listRunesTool.handler({}, ctx);
      const slot = (result as any).trees[0].slots[0];

      expect(typeof slot.slotLabel).toBe("string");
      expect(Array.isArray(slot.runes)).toBe(true);
    });

    test("each rune has required fields", async () => {
      const result = await listRunesTool.handler({}, ctx);
      const rune = (result as any).trees[1].slots[0].runes[0];

      expect(typeof rune.id).toBe("number");
      expect(typeof rune.key).toBe("string");
      expect(typeof rune.name).toBe("string");
      expect(typeof rune.icon).toBe("string");
      expect(typeof rune.shortDesc).toBe("string");
      expect(typeof rune.longDesc).toBe("string");
    });

    test("uses config locale when no locale input provided", async () => {
      const result = await listRunesTool.handler({}, ctx);
      expect((result as any).locale).toBe("en_US");
    });

    test("uses explicit locale override from input", async () => {
      const result = await listRunesTool.handler({ locale: "es_ES" }, ctx);
      expect((result as any).locale).toBe("es_ES");
    });

    test("uses explicit version override from input", async () => {
      const result = await listRunesTool.handler({ version: "13.1.1" }, ctx);
      expect((result as any).version).toBe("13.1.1");
    });

    test("cache hit on second call (no network)", async () => {
      let callCount = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url: string) => {
        if (url.includes("/api/versions.json") || url.includes("/runesReforged.json")) {
          callCount++;
        }
        return originalFetch(url);
      };

      try {
        await listRunesTool.handler({}, ctx);
        await listRunesTool.handler({}, ctx);
        expect(callCount).toBe(2); // 1 for versions.json + 1 for runesReforged.json
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});