import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { TieredCache } from "../../src/cache/tiered";
import { mkdir, rm } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

const TEST_KEY = (version: string, locale = "en_US", path = "/cdn/14.10.1/data/en_US/champion.json") =>
  `ddragon:${version}:${locale}:${path}`;

describe("TieredCache", () => {
  let tmpDir: string;
  let cache: TieredCache<string>;

  beforeEach(async () => {
    tmpDir = join(
      "D:\\LoL-DataAccess4IA\\tests\\.tmp",
      `tiered-cache-${randomUUID()}`
    );
    await mkdir(tmpDir, { recursive: true });
    cache = new TieredCache<string>(tmpDir);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe("get", () => {
    test("memory hit returns value from memory", async () => {
      const key = TEST_KEY("14.10.1");
      await cache.set(key, "value1");
      // First get should populate both layers
      await cache.get(key);
      // Second get — memory should have it
      const result = await cache.get(key);
      expect(result).toBe("value1");
    });

    test("memory miss falls through to disk", async () => {
      const key = TEST_KEY("14.10.1");
      await cache.set(key, "value1");
      // Manually clear memory to simulate miss
      cache.memory.clear();
      const result = await cache.get(key);
      expect(result).toBe("value1");
    });

    test("disk hit rehydrates memory", async () => {
      const key = TEST_KEY("14.10.1");
      await cache.set(key, "value1");
      // Clear memory to force disk lookup
      cache.memory.clear();
      // First get after clear should hit disk and rehydrate
      const result = await cache.get(key);
      expect(result).toBe("value1");
      // Memory should now have it too
      expect(cache.memory.get(key)).toBe("value1");
    });

    test("returns undefined for missing key in both layers", async () => {
      const result = await cache.get("ddragon:14.10.1:en_US:/cdn/14.10.1/data/en_US/nonexistent.json");
      expect(result).toBeUndefined();
    });
  });

  describe("set", () => {
    test("writes to both memory and disk layers", async () => {
      const key = TEST_KEY("14.10.1");
      await cache.set(key, "value1");
      // Memory should have it
      expect(cache.memory.get(key)).toBe("value1");
      // Disk should have it
      const diskResult = await cache.disk.get(key);
      expect(diskResult).toBe("value1");
    });

    test("overwrites in both layers", async () => {
      const key = TEST_KEY("14.10.1");
      await cache.set(key, "value1");
      await cache.set(key, "value2");
      expect(cache.memory.get(key)).toBe("value2");
      expect(await cache.disk.get(key)).toBe("value2");
    });
  });

  describe("delete", () => {
    test("removes from both layers", async () => {
      const key = TEST_KEY("14.10.1");
      await cache.set(key, "value1");
      await cache.delete(key);
      expect(cache.memory.get(key)).toBeUndefined();
      expect(await cache.disk.get(key)).toBeUndefined();
    });
  });

  describe("clear", () => {
    test("removes from memory only (disk is separate concern)", async () => {
      const key = TEST_KEY("14.10.1");
      await cache.set(key, "value1");
      cache.clear();
      expect(cache.memory.get(key)).toBeUndefined();
      // Disk should still have it
      expect(await cache.disk.get(key)).toBe("value1");
    });
  });
});