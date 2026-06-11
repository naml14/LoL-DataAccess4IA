import { describe, expect, test, beforeEach } from "bun:test";
import { listSummonerSpellsTool } from "../../../src/tools/list-summoner-spells";
import { createToolContext } from "../../../src/tools/_ctx";
import { MemoryCache } from "../../../src/cache/memory";
import { DDragonClient } from "../../../src/ddragon/client";
import { assertNoForbiddenLanguage } from "../../../src/mcp/boundary-language";

function makeSummonerFile(spells: Array<{
  id: string; name: string; description: string; tooltip: string;
  maxrank: number; cooldown: number[]; key: string; imageFull: string;
}>) {
  const data: Record<string, unknown> = {};
  for (const spell of spells) {
    data[spell.id] = {
      id: spell.id,
      name: spell.name,
      description: spell.description,
      key: spell.key,
      tooltip: spell.tooltip,
      maxrank: spell.maxrank,
      cooldown: spell.cooldown,
      summonerLevel: 1,
      modes: ["CLASSIC", "ARAM"],
      icon: `spell/${spell.imageFull}`,
      image: {
        full: spell.imageFull, sprite: "spell.png", group: "spell",
        x: 0, y: 0, w: 48, h: 48,
      },
    };
  }
  return { type: "summoner" as const, version: "14.10.1", data };
}

const SUMMONER_FIXTURE = makeSummonerFile([
  { id: "SummonerFlash", name: "Flash", description: "Teleport a short distance", tooltip: "Teleport forward", maxrank: 1, cooldown: [300], key: "Flash", imageFull: "SummonerFlash.png" },
  { id: "SummonerIgnite", name: "Ignite", description: "Ignite enemy champion", tooltip: "Deal damage over time", maxrank: 1, cooldown: [210], key: "Ignite", imageFull: "SummonerIgnite.png" },
]);

describe("list_summoner_spells", () => {
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
      if (url.includes("/summoner.json")) {
        return new Response(JSON.stringify(SUMMONER_FIXTURE), {
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
        assertNoForbiddenLanguage(listSummonerSpellsTool.description, "list_summoner_spells description")
      ).not.toThrow();
    });
  });

  describe("handler", () => {
    test("returns correct output shape with spell list", async () => {
      const result = await listSummonerSpellsTool.handler({}, ctx);

      expect(typeof result).toBe("object");
      expect(typeof (result as any).version).toBe("string");
      expect(typeof (result as any).locale).toBe("string");
      expect(typeof (result as any).count).toBe("number");
      expect(Array.isArray((result as any).spells)).toBe(true);
      expect((result as any).count).toBe(2);
    });

    test("each spell has required compact fields", async () => {
      const result = await listSummonerSpellsTool.handler({}, ctx);
      const spell = (result as any).spells[0];

      expect(typeof spell.id).toBe("string");
      expect(typeof spell.name).toBe("string");
      expect(typeof spell.description).toBe("string");
      expect(typeof spell.tooltip).toBe("string");
      expect(typeof spell.maxrank).toBe("number");
      expect(Array.isArray(spell.cooldown)).toBe(true);
      expect(typeof spell.key).toBe("string");
      expect(typeof spell.image).toBe("object");
      expect(typeof spell.image.full).toBe("string");
    });

    test("spell values match fixture data", async () => {
      const result = await listSummonerSpellsTool.handler({}, ctx);

      const flash = (result as any).spells.find((s: any) => s.id === "SummonerFlash");
      expect(flash).toBeDefined();
      expect(flash.name).toBe("Flash");
      expect(flash.maxrank).toBe(1);
      expect(flash.cooldown).toEqual([300]);

      const ignite = (result as any).spells.find((s: any) => s.id === "SummonerIgnite");
      expect(ignite).toBeDefined();
      expect(ignite.name).toBe("Ignite");
    });

    test("uses config locale when no locale input provided", async () => {
      const result = await listSummonerSpellsTool.handler({}, ctx);
      expect((result as any).locale).toBe("en_US");
    });

    test("uses explicit locale override from input", async () => {
      const result = await listSummonerSpellsTool.handler({ locale: "es_ES" }, ctx);
      expect((result as any).locale).toBe("es_ES");
    });

    test("uses explicit version override from input", async () => {
      const result = await listSummonerSpellsTool.handler({ version: "13.1.1" }, ctx);
      expect((result as any).version).toBe("13.1.1");
    });

    test("cache hit on second call (no network)", async () => {
      let callCount = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url: string) => {
        if (url.includes("/api/versions.json") || url.includes("/summoner.json")) {
          callCount++;
        }
        return originalFetch(url);
      };

      try {
        await listSummonerSpellsTool.handler({}, ctx);
        await listSummonerSpellsTool.handler({}, ctx);
        expect(callCount).toBe(2); // 1 for versions.json + 1 for summoner.json
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});