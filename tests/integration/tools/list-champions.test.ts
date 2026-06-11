import { describe, expect, test, beforeEach } from "bun:test";
import { listChampionsTool } from "../../../src/tools/list-champions";
import { createToolContext } from "../../../src/tools/_ctx";
import { MemoryCache } from "../../../src/cache/memory";
import { DDragonClient } from "../../../src/ddragon/client";
import { assertNoForbiddenLanguage } from "../../../src/mcp/boundary-language";

/** Minimal champion.json fixture structure for list_champions. */
function makeChampionFile(champions: Array<{ id: string; key: string; name: string; title: string; tags: string[]; blurb: string }>) {
  const data: Record<string, unknown> = {};
  for (const c of champions) {
    data[c.id] = {
      id: c.id,
      key: c.key,
      name: c.name,
      title: c.title,
      blurb: c.blurb,
      tags: c.tags,
      info: { attack: 1, defense: 1, magic: 1, difficulty: 1 },
      image: { full: `${c.id}.png`, sprite: "sprite.png", group: "champion", x: 0, y: 0, w: 48, h: 48 },
      partype: "MP",
      stats: {
        hp: 500, hpperlevel: 80, mp: 350, mpperlevel: 50, movespeed: 330,
        armor: 30, armorperlevel: 3, spellblock: 30, spellblockperlevel: 1.5,
        attackrange: 150, hpregen: 5, hpregenperlevel: 0.5, mpregen: 7,
        mpregenperlevel: 0.4, crit: 0, critperlevel: 0, attackdamage: 60,
        attackdamageperlevel: 3, attackspeedperlevel: 2.5, attackspeed: 0.625,
      },
    };
  }
  return {
    type: "champion",
    format: "standar",
    version: "14.10.1",
    data,
  };
}

const CHAMPION_FIXTURE = makeChampionFile([
  { id: "Aatrox", key: "266", name: "Aatrox", title: "the Darkin Blade", tags: ["Fighter", "Tank"], blurb: "Aatrox is a legendary warrior." },
  { id: "Ahri", key: "103", name: "Ahri", title: "the Nine-Tailed Fox", tags: ["Mage", "Assassin"], blurb: "Ahri is a fox-like mage." },
  { id: "BlindMonk", key: "64", name: "LeeSin", title: "the Blind Monk", tags: ["Fighter", "Assassin"], blurb: "LeeSin is a master of the ancient art of Wuju." },
]);

const TOOL_NAME = "list_champions";

describe("list_champions", () => {
  let ctx: ReturnType<typeof createToolContext>;

  beforeEach(() => {
    const cache = new MemoryCache<unknown>();
    // Use real DDragonClient — globalThis.fetch mock will intercept network calls.
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

    // Intercept fetch for version resolution and champion list.
    globalThis.fetch = async (url: string) => {
      if (url.includes("/api/versions.json")) {
        return new Response(JSON.stringify(["14.10.1"]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/cdn/") && url.endsWith("/champion.json")) {
        return new Response(JSON.stringify(CHAMPION_FIXTURE), {
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
        assertNoForbiddenLanguage(listChampionsTool.description, "list_champions description")
      ).not.toThrow();
    });
  });

  describe("handler", () => {
    test("returns correct output shape with compact champion list", async () => {
      const result = await listChampionsTool.handler({}, ctx);

      expect(typeof result).toBe("object");
      expect(typeof (result as any).version).toBe("string");
      expect(typeof (result as any).locale).toBe("string");
      expect(Array.isArray((result as any).champions)).toBe(true);
      expect((result as any).champions.length).toBeGreaterThan(0);
    });

    test("each champion has required compact fields", async () => {
      const result = await listChampionsTool.handler({}, ctx);
      const champion = (result as any).champions[0];

      expect(typeof champion.id).toBe("string");
      expect(typeof champion.key).toBe("string");
      expect(typeof champion.name).toBe("string");
      expect(typeof champion.title).toBe("string");
      expect(Array.isArray(champion.tags)).toBe(true);
      expect(typeof champion.blurb).toBe("string");
    });

    test("champion values match fixture data", async () => {
      const result = await listChampionsTool.handler({}, ctx);
      const championMap: Record<string, unknown> = {};
      for (const c of (result as any).champions) {
        championMap[c.id] = c;
      }

      expect((championMap["Ahri"] as any).key).toBe("103");
      expect((championMap["Aatrox"] as any).tags).toEqual(["Fighter", "Tank"]);
      expect((championMap["BlindMonk"] as any).name).toBe("LeeSin");
    });

    test("uses config locale when no locale input provided", async () => {
      const result = await listChampionsTool.handler({}, ctx);
      expect((result as any).locale).toBe("en_US");
    });

    test("uses explicit locale override from input", async () => {
      const result = await listChampionsTool.handler({ locale: "es_ES" }, ctx);
      expect((result as any).locale).toBe("es_ES");
    });

    test("uses explicit version override from input", async () => {
      const result = await listChampionsTool.handler({ version: "13.1.1" }, ctx);
      expect((result as any).version).toBe("13.1.1");
    });

    test("cache hit on second call (no network)", async () => {
      let callCount = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url: string) => {
        if (url.includes("/api/versions.json") || (url.includes("/cdn/") && url.endsWith("/champion.json"))) {
          callCount++;
        }
        // Return appropriate response based on URL
        if (url.includes("/api/versions.json")) {
          return new Response(JSON.stringify(["14.10.1"]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url.includes("/cdn/") && url.endsWith("/champion.json")) {
          return new Response(JSON.stringify(CHAMPION_FIXTURE), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("Not Found", { status: 404 });
      };

      try {
        // First call — populate cache
        await listChampionsTool.handler({}, ctx);
        // Second call — should hit cache
        await listChampionsTool.handler({}, ctx);

        expect(callCount).toBe(2); // 1 for versions.json + 1 for champion.json
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});