import { describe, expect, test, beforeEach } from "bun:test";
import { listProfileIconsTool } from "../../../src/tools/list-profile-icons";
import { createToolContext } from "../../../src/tools/_ctx";
import { MemoryCache } from "../../../src/cache/memory";
import { DDragonClient } from "../../../src/ddragon/client";

// Boundary assertion: tool description must not contain recommendation language.
const FORBIDDEN = /best|recommended|optimal|meta|should|strong|pick|tier/gi;

function makeProfileIconFile(icons: Array<{ id: number; imageFull: string }>) {
  const data: Record<string, unknown> = {};
  for (const icon of icons) {
    data[String(icon.id)] = {
      id: icon.id,
      image: {
        full: icon.imageFull, sprite: "profileicon.png", group: "profileicon",
        x: 0, y: 0, w: 48, h: 48,
      },
    };
  }
  return { type: "profileicon" as const, version: "14.10.1", data };
}

const ICONS_FIXTURE = makeProfileIconFile([
  { id: 1, imageFull: "1.png" },
  { id: 7, imageFull: "7.png" },
  { id: 25, imageFull: "25.png" },
]);

describe("list_profile_icons", () => {
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
      if (url.includes("/profileicon.json")) {
        return new Response(JSON.stringify(ICONS_FIXTURE), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response("Not Found", { status: 404 });
    };
  });

  describe("boundary", () => {
    test("description contains no recommendation language", () => {
      const src = listProfileIconsTool.description;
      const matches = src.match(FORBIDDEN);
      expect(matches).toBeNull();
    });
  });

  describe("handler", () => {
    test("returns correct output shape with icon list", async () => {
      const result = await listProfileIconsTool.handler({}, ctx);

      expect(typeof result).toBe("object");
      expect(typeof (result as any).version).toBe("string");
      expect(typeof (result as any).locale).toBe("string");
      expect(typeof (result as any).count).toBe("number");
      expect(Array.isArray((result as any).icons)).toBe(true);
      expect((result as any).count).toBe(3);
    });

    test("each icon has required compact fields", async () => {
      const result = await listProfileIconsTool.handler({}, ctx);
      const icon = (result as any).icons[0];

      expect(typeof icon.id).toBe("number");
      expect(typeof icon.image).toBe("object");
      expect(typeof icon.image.full).toBe("string");
    });

    test("icon values match fixture data", async () => {
      const result = await listProfileIconsTool.handler({}, ctx);
      const iconMap: Record<number, unknown> = {};
      for (const icon of (result as any).icons) {
        iconMap[icon.id] = icon;
      }

      expect((iconMap[1] as any).image.full).toBe("1.png");
      expect((iconMap[7] as any).image.full).toBe("7.png");
      expect((iconMap[25] as any).image.full).toBe("25.png");
    });

    test("uses config locale when no locale input provided", async () => {
      const result = await listProfileIconsTool.handler({}, ctx);
      expect((result as any).locale).toBe("en_US");
    });

    test("uses explicit locale override from input", async () => {
      const result = await listProfileIconsTool.handler({ locale: "es_ES" }, ctx);
      expect((result as any).locale).toBe("es_ES");
    });

    test("uses explicit version override from input", async () => {
      const result = await listProfileIconsTool.handler({ version: "13.1.1" }, ctx);
      expect((result as any).version).toBe("13.1.1");
    });

    test("cache hit on second call (no network)", async () => {
      let callCount = 0;
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (url: string) => {
        if (url.includes("/api/versions.json") || url.includes("/profileicon.json")) {
          callCount++;
        }
        return originalFetch(url);
      };

      try {
        await listProfileIconsTool.handler({}, ctx);
        await listProfileIconsTool.handler({}, ctx);
        expect(callCount).toBe(2); // 1 for versions.json + 1 for profileicon.json
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });
});