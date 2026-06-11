import { test, expect, beforeEach, afterEach } from "bun:test";
import { loadConfig } from "../../src/config";

// Store original env to restore after each test
let originalEnv: Record<string, string | undefined>;

beforeEach(() => {
  originalEnv = {};
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("LOL_DD_")) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  }
});

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("LOL_DD_")) {
      delete process.env[key];
    }
  }
  for (const [key, val] of Object.entries(originalEnv)) {
    if (val !== undefined) {
      process.env[key] = val;
    }
  }
});

// ---------------------------------------------------------------------------
// Default values
// ---------------------------------------------------------------------------

test("loadConfig returns correct defaults when no env vars are set", () => {
  const config = loadConfig();
  expect(config.locale).toBe("en_US");
  expect(config.ttlSeconds).toBe(900);
  expect(config.pinVersion).toBeNull();
  expect(config.cacheDir).toBe("./.cache/ddragon");
  expect(config.httpTimeoutMs).toBe(5000);
  expect(config.logLevel).toBe("info");
});

// ---------------------------------------------------------------------------
// Env override
// ---------------------------------------------------------------------------

test("loadConfig overrides defaults when env vars are set", () => {
  process.env.LOL_DD_LOCALE = "es_ES";
  process.env.LOL_DD_TTL_SECONDS = "300";
  process.env.LOL_DD_PIN_VERSION = "14.10.1";
  process.env.LOL_DD_CACHE_DIR = "/tmp/lol-cache";
  process.env.LOL_DD_HTTP_TIMEOUT_MS = "10000";
  process.env.LOL_DD_LOG_LEVEL = "debug";

  const config = loadConfig();
  expect(config.locale).toBe("es_ES");
  expect(config.ttlSeconds).toBe(300);
  expect(config.pinVersion).toBe("14.10.1");
  expect(config.cacheDir).toBe("/tmp/lol-cache");
  expect(config.httpTimeoutMs).toBe(10000);
  expect(config.logLevel).toBe("debug");
});

// ---------------------------------------------------------------------------
// Range validation — LOL_DD_TTL_SECONDS
// ---------------------------------------------------------------------------

test("loadConfig throws when LOL_DD_TTL_SECONDS is below minimum (60)", () => {
  process.env.LOL_DD_TTL_SECONDS = "59";
  expect(() => loadConfig()).toThrow(/LOL_DD_TTL_SECONDS.*too_small/i);
});

test("loadConfig throws when LOL_DD_TTL_SECONDS is above maximum (86400)", () => {
  process.env.LOL_DD_TTL_SECONDS = "86401";
  expect(() => loadConfig()).toThrow(/LOL_DD_TTL_SECONDS.*too_big/i);
});

// ---------------------------------------------------------------------------
// Range validation — LOL_DD_HTTP_TIMEOUT_MS
// ---------------------------------------------------------------------------

test("loadConfig throws when LOL_DD_HTTP_TIMEOUT_MS is below minimum (100)", () => {
  process.env.LOL_DD_HTTP_TIMEOUT_MS = "99";
  expect(() => loadConfig()).toThrow(/LOL_DD_HTTP_TIMEOUT_MS.*too_small/i);
});

test("loadConfig throws when LOL_DD_HTTP_TIMEOUT_MS is above maximum (60000)", () => {
  process.env.LOL_DD_HTTP_TIMEOUT_MS = "60001";
  expect(() => loadConfig()).toThrow(/LOL_DD_HTTP_TIMEOUT_MS.*too_big/i);
});

// ---------------------------------------------------------------------------
// Type coercion errors — LOL_DD_TTL_SECONDS must be numeric
// ---------------------------------------------------------------------------

test("loadConfig throws when LOL_DD_TTL_SECONDS is not a number", () => {
  process.env.LOL_DD_TTL_SECONDS = "not-a-number";
  expect(() => loadConfig()).toThrow(/LOL_DD_TTL_SECONDS.*valid integer/i);
});

// ---------------------------------------------------------------------------
// Type coercion errors — LOL_DD_HTTP_TIMEOUT_MS must be numeric
// ---------------------------------------------------------------------------

test("loadConfig throws when LOL_DD_HTTP_TIMEOUT_MS is not a number", () => {
  process.env.LOL_DD_HTTP_TIMEOUT_MS = "five-thousand";
  expect(() => loadConfig()).toThrow(/LOL_DD_HTTP_TIMEOUT_MS.*valid integer/i);
});

// ---------------------------------------------------------------------------
// Log level validation — must be one of debug/info/warn/error
// ---------------------------------------------------------------------------

test("loadConfig throws when LOL_DD_LOG_LEVEL is invalid", () => {
  process.env.LOL_DD_LOG_LEVEL = "verbose";
  expect(() => loadConfig()).toThrow(/LOL_DD_LOG_LEVEL.*debug.*info.*warn.*error/i);
});

// ---------------------------------------------------------------------------
// Immutability — returned config object is frozen
// ---------------------------------------------------------------------------

test("loadConfig returns a deeply frozen object", () => {
  const config = loadConfig();
  expect(Object.isFrozen(config)).toBe(true);
  expect(() => {
    (config as any).locale = "es_ES";
  }).toThrow();
});

// ---------------------------------------------------------------------------
// pinVersion is optional and nullable
// ---------------------------------------------------------------------------

test("loadConfig returns null pinVersion when LOL_DD_PIN_VERSION is unset", () => {
  delete process.env.LOL_DD_PIN_VERSION;
  const config = loadConfig();
  expect(config.pinVersion).toBeNull();
});

test("loadConfig returns pinVersion string when LOL_DD_PIN_VERSION is set", () => {
  process.env.LOL_DD_PIN_VERSION = "14.10.1";
  const config = loadConfig();
  expect(config.pinVersion).toBe("14.10.1");
});

// ---------------------------------------------------------------------------
// Locale format is not validated (any string accepted)
// ---------------------------------------------------------------------------

test("loadConfig accepts any locale string", () => {
  process.env.LOL_DD_LOCALE = "ko_KR";
  const config = loadConfig();
  expect(config.locale).toBe("ko_KR");
});