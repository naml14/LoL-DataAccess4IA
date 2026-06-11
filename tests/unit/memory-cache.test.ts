import { describe, test, expect, beforeEach } from "bun:test";
import { MemoryCache } from "../../src/cache/memory";

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

describe("MemoryCache", () => {
  let cache: MemoryCache<string>;

  beforeEach(() => {
    cache = new MemoryCache<string>();
  });

  describe("set and get", () => {
    test("stores and retrieves a value", () => {
      cache.set("foo", "bar");
      expect(cache.get("foo")).toBe("bar");
    });

    test("returns undefined for missing key", () => {
      expect(cache.get("nonexistent")).toBeUndefined();
    });

    test("overwrites existing value for same key", () => {
      cache.set("foo", "bar");
      cache.set("foo", "baz");
      expect(cache.get("foo")).toBe("baz");
    });

    test("no leak between different keys", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");
      expect(cache.get("key1")).toBe("value1");
      expect(cache.get("key2")).toBe("value2");
      cache.delete("key1");
      expect(cache.get("key1")).toBeUndefined();
      expect(cache.get("key2")).toBe("value2");
    });
  });

  describe("TTL expiry", () => {
    test("returns undefined after TTL expires", async () => {
      // TTL is in seconds (matching config.ttlSeconds)
      cache.set("expiring", "value", 1); // 1 second
      expect(cache.get("expiring")).toBe("value");
      await sleep(1100); // wait 1.1 seconds
      expect(cache.get("expiring")).toBeUndefined();
    });

    test("cleanup removes expired entries", async () => {
      cache.set("expiring1", "v1", 1);
      cache.set("expiring2", "v2", 1);
      cache.set("permanent", "v3"); // uses default TTL (900s)
      await sleep(1100);
      cache.cleanup();
      expect(cache.get("expiring1")).toBeUndefined();
      expect(cache.get("expiring2")).toBeUndefined();
      expect(cache.get("permanent")).toBe("v3");
    });

    test("cleanup does not remove non-expired entries", async () => {
      cache.set("short", "v1", 2); // 2 seconds
      cache.set("long", "v2", 5); // 5 seconds
      await sleep(2200); // wait 2.2 seconds
      cache.cleanup();
      expect(cache.get("short")).toBeUndefined();
      expect(cache.get("long")).toBe("v2");
    });
  });

  describe("delete", () => {
    test("removes the key", () => {
      cache.set("foo", "bar");
      cache.delete("foo");
      expect(cache.get("foo")).toBeUndefined();
    });

    test("deleting non-existent key is a no-op", () => {
      cache.delete("nonexistent");
      expect(cache.get("nonexistent")).toBeUndefined();
    });
  });

  describe("clear", () => {
    test("removes all entries", () => {
      cache.set("a", "1");
      cache.set("b", "2");
      cache.set("c", "3");
      cache.clear();
      expect(cache.get("a")).toBeUndefined();
      expect(cache.get("b")).toBeUndefined();
      expect(cache.get("c")).toBeUndefined();
    });
  });

  describe("cleanup on set", () => {
    test("set triggers cleanup of expired entries", async () => {
      cache.set("old", "v1", 1);
      await sleep(1100);
      // set triggers cleanup internally
      cache.set("new", "v2");
      expect(cache.get("old")).toBeUndefined();
      expect(cache.get("new")).toBe("v2");
    });
  });
});