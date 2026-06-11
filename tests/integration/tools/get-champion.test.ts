import { describe, expect, test, beforeEach } from "bun:test";
import { getChampionTool } from "../../../src/tools/get-champion";
import { createToolContext } from "../../../src/tools/_ctx";
import { MemoryCache } from "../../../src/cache/memory";
import { DDragonClient } from "../../../src/ddragon/client";

// Boundary assertion: tool description must not contain recommendation language.
const FORBIDDEN = /best|recommended|optimal|meta|should|strong|pick|tier/gi;

/** Build a champion record with given id and key. */
function champ(id: string, key: string, name: string) {
  return {
    id,
    key,
    name,
    title: "Champion Title",
    blurb: "Champion blurb",
    info: { attack: 1, defense: 1, magic: 1, difficulty: 1 },
    image: { full: `${id}.png`, sprite: "sprite.png", group: "champion", x: 0, y: 0, w: 48, h: 48 },
    tags: ["Fighter"],
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

function makeChampionFile(champions: ReturnType<typeof champ>[]) {
  const data: Record<string, unknown> = {};
  for (const c of champions) {
    data[c.id] = c;
  }
  return { type: "champion" as const, format: "standar", version: "14.10.1", data };
}

/** Champions that produce ambiguity: id="A" (case-insensitive) and key="A".
 * Query "A" resolves to champ "A" by id and champ "Annie" by key — different
 * champions, same query string → ambiguous. */
const AMBIGUOUS_FIXTURE = makeChampionFile([
  champ("A", "A", "AmbiguousById"),   // id lookup for "A" → matches here
  champ("Annie", "A", "Annie"),        // key lookup for "A" → matches here (ambiguous!)
]);

/** Normal fixture for happy-path tests. */
const NORMAL_FIXTURE = makeChampionFile([
  champ("Aatrox", "266", "Aatrox"),
  champ("Ahri", "103", "Ahri"),
  champ("LeeSin", "64", "LeeSin"),
]);

describe("get_champion", () => {
  let ctx: ReturnType<typeof createToolContext>;

  function setupFetch(championFixture: ReturnType<typeof makeChampionFile>) {
    globalThis.fetch = async (url: string) => {
      if (url.includes("/api/versions.json")) {
        return new Response(JSON.stringify(["14.10.1"]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/cdn/") && url.endsWith("/champion.json")) {
        return new Response(JSON.stringify(championFixture), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not Found", { status: 404 });
    };
  }

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
    setupFetch(NORMAL_FIXTURE);
  });

  describe("boundary", () => {
    test("description contains no recommendation language", () => {
      const src = getChampionTool.description;
      const matches = src.match(FORBIDDEN);
      expect(matches).toBeNull();
    });
  });

  describe("handler", () => {
    test("returns full champion record when found by id (case-insensitive)", async () => {
      const result = await getChampionTool.handler({ idOrKey: "ahri" }, ctx);
      expect((result as any).id).toBe("Ahri");
      expect((result as any).key).toBe("103");
      expect((result as any).name).toBe("Ahri");
      expect(typeof (result as any).stats).toBe("object");
    });

    test("returns full champion record when found by numeric key", async () => {
      const result = await getChampionTool.handler({ idOrKey: "103" }, ctx);
      expect((result as any).id).toBe("Ahri");
      expect((result as any).key).toBe("103");
    });

    test("returns full champion record when found by id exact match", async () => {
      const result = await getChampionTool.handler({ idOrKey: "Aatrox" }, ctx);
      expect((result as any).id).toBe("Aatrox");
    });

    test("throws not-found error when champion does not exist", async () => {
      let thrown: unknown = null;
      try {
        await getChampionTool.handler({ idOrKey: "NonExistent" }, ctx);
      } catch (err) {
        thrown = err;
      }
      expect(thrown).not.toBeNull();
      expect((thrown as any).code).toBe("not-found");
    });

    test("throws ambiguous error when id and key lookup resolve to different champions", async () => {
      setupFetch(AMBIGUOUS_FIXTURE);
      let thrown: unknown = null;
      try {
        await getChampionTool.handler({ idOrKey: "A" }, ctx);
      } catch (err) {
        thrown = err;
      }
      expect(thrown).not.toBeNull();
      expect((thrown as any).message.toLowerCase()).toContain("ambiguous");
    });

    test("uses explicit version override", async () => {
      const result = await getChampionTool.handler({ idOrKey: "Ahri", version: "13.1.1" }, ctx);
      expect((result as any).id).toBe("Ahri");
    });

    test("uses explicit locale override", async () => {
      const result = await getChampionTool.handler({ idOrKey: "Ahri", locale: "es_ES" }, ctx);
      expect((result as any).id).toBe("Ahri");
    });

    test("cache hit on second call (no network)", async () => {
      let callCount = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url: string) => {
        if (url.includes("/api/versions.json") || (url.includes("/cdn/") && url.endsWith("/champion.json"))) {
          callCount++;
        }
        return originalFetch(url);
      };

      try {
        // First call — populate cache
        await getChampionTool.handler({ idOrKey: "Ahri" }, ctx);
        // Second call — should hit cache
        await getChampionTool.handler({ idOrKey: "Ahri" }, ctx);

        expect(callCount).toBe(2); // 1 for versions.json + 1 for champion.json
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});