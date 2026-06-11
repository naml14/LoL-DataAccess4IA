import { describe, expect, test, beforeEach } from "bun:test";
import { getCurrentPatchTool } from "../../../src/tools/get-current-patch";
import { createToolContext } from "../../../src/tools/_ctx";
import { MemoryCache } from "../../../src/cache/memory";
import { cacheKeyForResource } from "../../../src/cache/key";

// Boundary assertion: tool description must not contain recommendation language.
const FORBIDDEN = /best|recommended|optimal|meta|should|strong|pick|tier/gi;
const TOOL_NAME = "get_current_patch";

describe("get_current_patch", () => {
  let ctx: ReturnType<typeof createToolContext>;

  beforeEach(() => {
    const cache = new MemoryCache<unknown>();
    ctx = createToolContext({
      client: {} as any,
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

  describe("boundary", () => {
    test("description contains no recommendation language", () => {
      const src = getCurrentPatchTool.description;
      const matches = src.match(FORBIDDEN);
      expect(matches).toBeNull();
    });
  });

  describe("handler", () => {
    test("returns correct output shape", async () => {
      // Mock fetch to return fixture versions
      globalThis.fetch = async (url: string) => {
        if (url.includes("/api/versions.json")) {
          return new Response(JSON.stringify(["14.10.1", "14.9.1"]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("Not Found", { status: 404 });
      };

      const result = await getCurrentPatchTool.handler({}, ctx);

      expect(typeof result).toBe("object");
      expect(typeof (result as any).version).toBe("string");
      expect(typeof (result as any).locale).toBe("string");
      expect(typeof (result as any).fetchedAt).toBe("string");
      // fetchedAt must be ISO 8601
      expect(new Date((result as any).fetchedAt).toISOString()).toBe((result as any).fetchedAt);
    });

    test("uses config locale in output", async () => {
      globalThis.fetch = async (url: string) => {
        if (url.includes("/api/versions.json")) {
          return new Response(JSON.stringify(["14.10.1"]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("Not Found", { status: 404 });
      };

      const result = await getCurrentPatchTool.handler({}, ctx);
      expect((result as any).locale).toBe("en_US");
    });

    test("uses explicit locale override from input", async () => {
      globalThis.fetch = async (url: string) => {
        if (url.includes("/api/versions.json")) {
          return new Response(JSON.stringify(["14.10.1"]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("Not Found", { status: 404 });
      };

      const result = await getCurrentPatchTool.handler({ locale: "es_ES" }, ctx);
      expect((result as any).locale).toBe("es_ES");
    });

    test("reflects pinVersion when set in config", async () => {
      // Set the env var so resolveVersion() picks it up without network.
      const prevPin = process.env.LOL_DD_PIN_VERSION;
      process.env.LOL_DD_PIN_VERSION = "13.1.1";
      try {
        const pinnedCtx = createToolContext({
          client: {} as any,
          cache: new MemoryCache<unknown>(),
          config: {
            locale: "en_US",
            ttlSeconds: 900,
            pinVersion: "13.1.1",
            cacheDir: "./.cache/ddragon",
            httpTimeoutMs: 5000,
            logLevel: "info",
          },
          logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
        });

        // Should not need network when pinned
        let fetchCalled = false;
        globalThis.fetch = async () => {
          fetchCalled = true;
          throw new Error("Network should not be called when pinned");
        };

        const result = await getCurrentPatchTool.handler({}, pinnedCtx);
        expect((result as any).version).toBe("13.1.1");
        expect(fetchCalled).toBe(false);
      } finally {
        process.env.LOL_DD_PIN_VERSION = prevPin ?? "";
      }
    });

    test("uses cache on second call (no network)", async () => {
      let callCount = 0;
      globalThis.fetch = async (url: string) => {
        if (url.includes("/api/versions.json")) {
          callCount++;
          return new Response(JSON.stringify(["14.10.1"]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("Not Found", { status: 404 });
      };

      // First call — populate cache
      await getCurrentPatchTool.handler({}, ctx);
      // Second call — should hit cache
      await getCurrentPatchTool.handler({}, ctx);

      expect(callCount).toBe(1);
    });

    test("output version matches the resolved version", async () => {
      globalThis.fetch = async (url: string) => {
        if (url.includes("/api/versions.json")) {
          return new Response(JSON.stringify(["14.10.1", "14.9.1", "14.8.1"]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response("Not Found", { status: 404 });
      };

      const result = await getCurrentPatchTool.handler({}, ctx);
      expect((result as any).version).toBe("14.10.1");
    });
  });
});