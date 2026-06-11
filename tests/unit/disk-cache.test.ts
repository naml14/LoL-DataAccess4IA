import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { DiskCache } from "../../src/cache/disk";
import { readdir, rm, stat, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

describe("DiskCache", () => {
  let tmpDir: string;
  let cache: DiskCache<string>;

  beforeEach(async () => {
    tmpDir = join(
      "D:\\LoL-DataAccess4IA\\tests\\.tmp",
      `disk-cache-${randomUUID()}`
    );
    await mkdir(tmpDir, { recursive: true });
    cache = new DiskCache<string>(tmpDir);
  });

  afterEach(async () => {
    // Auto-cleanup tmp dir
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("set and get", () => {
    test("roundtrip: write and read back the same value", async () => {
      await cache.set("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json", {
        type: "ChampionList",
        data: { Ahri: { id: "Ahri" } },
      });
      const result = await cache.get("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json");
      expect(result).toEqual({
        type: "ChampionList",
        data: { Ahri: { id: "Ahri" } },
      });
    });

    test("returns undefined for missing key", async () => {
      const result = await cache.get("nonexistent");
      expect(result).toBeUndefined();
    });

    test("overwrites existing value for same key", async () => {
      await cache.set("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json", { value: 1 });
      await cache.set("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json", { value: 2 });
      const result = await cache.get("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json");
      expect(result).toEqual({ value: 2 });
    });
  });

  describe("atomic write", () => {
    test("set succeeds without leaving .tmp files behind", async () => {
      await cache.set("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json", { test: true });
      // Check no .tmp files exist
      const result = await cache.get("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json");
      expect(result).toEqual({ test: true });
      // If there were .tmp files, they'd cause issues or remain as orphans
      // We verify by listing all files recursively
      const allFiles = await listAllFiles(tmpDir);
      const tmpFiles = allFiles.filter((f) => f.endsWith(".tmp"));
      expect(tmpFiles).toHaveLength(0);
    });
  });

  describe("TTL expiry on read", () => {
    test("expired entry is deleted on read and returns undefined", async () => {
      // Set with a very short TTL
      await cache.set("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json", { data: "value" }, 1);
      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 1100));
      const result = await cache.get("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json");
      expect(result).toBeUndefined();
    });
  });

  describe("prune", () => {
    test("prune(3) keeps newest 3 versions and deletes older ones", async () => {
      // Create entries for 5 different versions
      const versions = ["14.10.1", "14.9.1", "14.8.1", "14.7.1", "14.6.1"];
      for (const version of versions) {
        await cache.set(
          `ddragon:${version}:en_US:/cdn/${version}/data/en_US/champion.json`,
          { version }
        );
      }
      await cache.prune(3);

      // Newest 3 should remain
      expect(await cache.get("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json")).toEqual({
        version: "14.10.1",
      });
      expect(await cache.get("ddragon:14.9.1:en_US:/cdn/14.9.1/data/en_US/champion.json")).toEqual({
        version: "14.9.1",
      });
      expect(await cache.get("ddragon:14.8.1:en_US:/cdn/14.8.1/data/en_US/champion.json")).toEqual({
        version: "14.8.1",
      });

      // Oldest 2 should be gone
      expect(
        await cache.get("ddragon:14.7.1:en_US:/cdn/14.7.1/data/en_US/champion.json")
      ).toBeUndefined();
      expect(
        await cache.get("ddragon:14.6.1:en_US:/cdn/14.6.1/data/en_US/champion.json")
      ).toBeUndefined();
    });

    test("prune keeps exact retention count of versions", async () => {
      // Create 4 versions
      const versions = ["14.10.1", "14.9.1", "14.8.1", "14.7.1"];
      for (const version of versions) {
        await cache.set(
          `ddragon:${version}:en_US:/cdn/${version}/data/en_US/item.json`,
          { version }
        );
      }
      await cache.prune(3);
      // 3 should remain
      let count = 0;
      for (const v of versions) {
        if (await cache.get(`ddragon:${v}:en_US:/cdn/${v}/data/en_US/item.json`)) {
          count++;
        }
      }
      expect(count).toBe(3);
    });
  });

  describe("delete", () => {
    test("removes the key from disk", async () => {
      await cache.set("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json", { data: "test" });
      await cache.delete("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json");
      expect(await cache.get("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json")).toBeUndefined();
    });

    test("delete non-existent key is a no-op", async () => {
      await cache.delete("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json");
      // Should not throw
      expect(await cache.get("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/champion.json")).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function listAllFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    let s: { isDirectory(): boolean };
    try {
      s = await stat(fullPath);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      const sub = await listAllFiles(fullPath);
      files.push(...sub);
    } else {
      files.push(fullPath);
    }
  }
  return files;
}