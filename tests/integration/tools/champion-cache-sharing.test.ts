/**
 * Integration test: list_champions and get_champion share the same cache key
 * for the raw champion.json file (CRITICAL-3).
 *
 * Both tools use getChampionFile() which caches at championDataKey().
 * This test proves there is no cache key collision between the two tools.
 */
import { describe, expect, test, beforeEach } from "bun:test";
import { listChampionsTool } from "../../../src/tools/list-champions";
import { getChampionTool } from "../../../src/tools/get-champion";
import { createToolContext } from "../../../src/tools/_ctx";
import { MemoryCache } from "../../../src/cache/memory";
import { DDragonClient } from "../../../src/ddragon/client";

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

const FIXTURE = makeChampionFile([
  champ("Aatrox", "266", "Aatrox"),
  champ("Ahri", "103", "Ahri"),
  champ("LeeSin", "64", "LeeSin"),
]);

describe("champion cache sharing between list_champions and get_champion", () => {
  let fetchCount: number;
  let ctx: ReturnType<typeof createToolContext>;

  beforeEach(() => {
    fetchCount = 0;

    globalThis.fetch = async (url: string) => {
      if (url.includes("/api/versions.json")) {
        return new Response(JSON.stringify(["14.10.1"]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url.includes("/cdn/") && url.endsWith("/champion.json")) {
        fetchCount++;
        return new Response(JSON.stringify(FIXTURE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not Found", { status: 404 });
    };

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
  });

  test("list_champions populates cache that get_champion reuses without extra fetch", async () => {
    // First call: list_champions fetches champion.json
    const result1 = await listChampionsTool.handler(
      { version: "14.10.1", locale: "en_US" },
      ctx
    );
    expect(result1.champions).toHaveLength(3);
    const fetchCountAfterList = fetchCount;
    expect(fetchCountAfterList).toBe(1);

    // Second call: get_champion should hit the same cache — no extra fetch
    const result2 = await getChampionTool.handler(
      { idOrKey: "Ahri", version: "14.10.1", locale: "en_US" },
      ctx
    );
    expect(result2.id).toBe("Ahri");
    expect(result2.name).toBe("Ahri");

    // fetchCount must be unchanged — cache was shared
    expect(fetchCount).toBe(fetchCountAfterList);
  });

  test("get_champion populates cache that list_champions reuses without extra fetch", async () => {
    // First call: get_champion fetches champion.json
    const result1 = await getChampionTool.handler(
      { idOrKey: "Ahri", version: "14.10.1", locale: "en_US" },
      ctx
    );
    expect(result1.id).toBe("Ahri");
    const fetchCountAfterGet = fetchCount;
    expect(fetchCountAfterGet).toBe(1);

    // Second call: list_champions should hit the same cache — no extra fetch
    const result2 = await listChampionsTool.handler(
      { version: "14.10.1", locale: "en_US" },
      ctx
    );
    expect(result2.champions).toHaveLength(3);

    // fetchCount must be unchanged — cache was shared
    expect(fetchCount).toBe(fetchCountAfterGet);
  });
});