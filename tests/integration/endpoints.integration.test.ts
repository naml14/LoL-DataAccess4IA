import { describe, expect, test, beforeAll } from "bun:test";
import { DDragonClient } from "../../src/ddragon/client";
import { resolveVersion } from "../../src/ddragon/versions";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Fixture loading — reads from checked-in fixtures, not live CDN.
// ---------------------------------------------------------------------------

const __testDir = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = path.resolve(__testDir, "../../fixtures/ddragon");

function loadFixture(filename: string): unknown {
  const filePath = path.join(FIXTURES_DIR, filename);
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("ddragon integration", { tag: ["ddragon"] }, () => {
  let client: DDragonClient;

  beforeAll(() => {
    client = new DDragonClient({ timeoutMs: 5000, retries: 1, circuitThreshold: 3 });

    // Intercept fetch to serve from local fixtures instead of live CDN.
    globalThis.fetch = async (url: string) => {
      if (url.includes("/api/versions.json")) {
        const data = loadFixture("api-versions.json");
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      const match = url.match(/\/cdn\/([^/]+)\/data\/([^/]+)\/(.+)/);
      if (match) {
        const [, version, locale, filename] = match;
        const fixturePath = path.join(FIXTURES_DIR, version, filename);
        if (fs.existsSync(fixturePath)) {
          const data = JSON.parse(fs.readFileSync(fixturePath, "utf-8"));
          return new Response(JSON.stringify(data), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      }
      return new Response("Not Found", { status: 404 });
    };
  });

  test("resolveVersion returns current version from fixture", async () => {
    const info = await resolveVersion();
    const fixture = loadFixture("api-versions.json") as string[];
    expect(info.current).toBe(fixture[0]);
    expect(info.all).toEqual(fixture);
  });

  test("getChampionList resolves champion data from fixture", async () => {
    const info = await resolveVersion();
    const data = await client.getChampionList(info.current, "en_US");
    expect(data).toBeDefined();
    expect(typeof data).toBe("object");
    const d = data as { data?: Record<string, unknown> };
    expect(d.data).toBeDefined();
    // The champion fixture should contain champion entries keyed by name.
    const championNames = Object.keys(d.data ?? {});
    expect(championNames.length).toBeGreaterThan(0);
    expect(championNames).toContain("Aatrox");
  });

  test("client + endpoints resolve same data as fixture", async () => {
    const info = await resolveVersion();
    const version = info.current;

    // Use the client (which internally calls the endpoints) to fetch champion list.
    const fromClient = await client.getChampionList(version, "en_US");

    // Load the fixture directly.
    const fixture = loadFixture("16.12.1/champion.json");

    expect(fromClient).toEqual(fixture);
  });
});