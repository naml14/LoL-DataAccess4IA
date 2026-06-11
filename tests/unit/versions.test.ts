import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { resolveVersion, getVersions, type VersionInfo } from "../../src/ddragon/versions";

// We mock fetch at the global scope for these tests.
// The real module uses the built-in `fetch` — we override it per-test.

describe("versions", () => {
  // Capture original fetch so we can restore it after tests.
  const OriginalFetch = globalThis.fetch;

  afterEach(() => {
    // Restore original fetch after each test.
    globalThis.fetch = OriginalFetch;
  });

  describe("resolveVersion", () => {
    test("returns first element of versions.json when no pin is set", async () => {
      globalThis.fetch = async () => {
        return new Response(JSON.stringify(["14.10.1", "14.9.2", "14.8.1"]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };
      const info = await resolveVersion();
      expect(info.current).toBe("14.10.1");
      expect(info.all).toEqual(["14.10.1", "14.9.2", "14.8.1"]);
    });

    test("honors LOL_DD_PIN_VERSION and skips the network request", async () => {
      let fetchCalled = false;
      globalThis.fetch = async () => {
        fetchCalled = true;
        return new Response("[]", { status: 200 });
      };

      // Pin via the direct call (the module reads config internally)
      const info = await resolveVersion("14.7.1");
      expect(info.current).toBe("14.7.1");
      expect(info.all).toEqual(["14.7.1"]);
      expect(fetchCalled).toBe(false);
    });

    test("surfaces a clear error when network is down", async () => {
      globalThis.fetch = async () => {
        throw new TypeError("Failed to fetch");
      };
      await expect(resolveVersion()).rejects.toThrow(
        "Failed to fetch from Data Dragon"
      );
    });

    test("handles 5xx from Riot gracefully", async () => {
      globalThis.fetch = async () => {
        return new Response("Service Unavailable", { status: 503 });
      };
      await expect(resolveVersion()).rejects.toThrow(
        "Data Dragon returned error"
      );
    });
  });

  describe("getVersions", () => {
    test("returns parsed versions array from live endpoint", async () => {
      globalThis.fetch = async () => {
        return new Response(JSON.stringify(["14.10.1", "14.9.2"]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      };
      const versions = await getVersions();
      expect(versions).toEqual(["14.10.1", "14.9.2"]);
    });
  });
});