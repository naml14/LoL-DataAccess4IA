import { describe, expect, test } from "bun:test";
import { DDragonClient } from "../../../src/ddragon/client";
import { MemoryCache } from "../../../src/cache/memory";
import { createToolContext, ToolContext } from "../../../src/tools/_ctx";

describe("ToolContext", () => {
  test("createToolContext returns an object with required keys", () => {
    const mockClient = {} as DDragonClient;
    const mockCache = new MemoryCache<unknown>();
    const mockConfig = {
      locale: "en_US",
      ttlSeconds: 900,
      pinVersion: null,
      cacheDir: "./.cache/ddragon",
      httpTimeoutMs: 5000,
      logLevel: "info" as const,
    };
    const mockLogger = { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} };

    const ctx = createToolContext({
      client: mockClient,
      cache: mockCache,
      config: mockConfig as Parameters<typeof createToolContext>[0]["config"],
      logger: mockLogger,
    });

    expect(typeof ctx).toBe("object");
    expect("client" in ctx).toBe(true);
    expect("cache" in ctx).toBe(true);
    expect("config" in ctx).toBe(true);
    expect("logger" in ctx).toBe(true);
  });

  test("client is assigned as-is", () => {
    const mockClient = { foo: "bar" } as unknown as DDragonClient;
    const ctx = createToolContext({
      client: mockClient,
      cache: new MemoryCache<unknown>(),
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
    expect((ctx.client as unknown as { foo: string }).foo).toBe("bar");
  });

  test("cache is assigned as-is", () => {
    const mockCache = new MemoryCache<unknown>();
    const ctx = createToolContext({
      client: {} as DDragonClient,
      cache: mockCache,
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
    expect(ctx.cache).toBe(mockCache);
  });
});