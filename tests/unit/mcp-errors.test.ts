import { test, expect } from "bun:test";
import { toMcpError } from "../../src/mcp/errors";
import type { DDragonError } from "../../src/ddragon/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function networkError(message = "Network error reaching Data Dragon"): DDragonError {
  return { kind: "network", message };
}

function timeoutError(message = "Request timed out after 5000ms"): DDragonError {
  return { kind: "timeout", message };
}

function httpError(message = "Data Dragon returned HTTP 503"): DDragonError {
  return { kind: "http", message };
}

function circuitOpenError(message = "Circuit breaker is open — Data Dragon is unavailable"): DDragonError {
  return { kind: "circuit-open", message };
}

function parseError(message = "Failed to parse Data Dragon response as JSON"): DDragonError {
  return { kind: "parse", message };
}

function notFoundError(message = "Resource not found: https://ddragon.leagueoflegends.com/cdn/14.10.1/data/en_US/champi"): DDragonError {
  return { kind: "not-found", message };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("toMcpError: network error → code 'network'", () => {
  const result = toMcpError(networkError());
  expect(result.isError).toBe(true);
  expect(result.code).toBe("network");
  expect(result.message).toBe("Network error reaching Data Dragon");
  expect(result.data).toBeUndefined();
});

test("toMcpError: timeout error → code 'timeout'", () => {
  const result = toMcpError(timeoutError());
  expect(result.isError).toBe(true);
  expect(result.code).toBe("timeout");
  expect(result.message).toBe("Request timed out after 5000ms");
});

test("toMcpError: http error → code 'http'", () => {
  const result = toMcpError(httpError());
  expect(result.isError).toBe(true);
  expect(result.code).toBe("http");
  expect(result.message).toBe("Data Dragon returned HTTP 503");
});

test("toMcpError: circuit-open error → code 'circuit-open'", () => {
  const result = toMcpError(circuitOpenError());
  expect(result.isError).toBe(true);
  expect(result.code).toBe("circuit-open");
  expect(result.message).toBe("Circuit breaker is open — Data Dragon is unavailable");
});

test("toMcpError: parse error → code 'parse'", () => {
  const result = toMcpError(parseError());
  expect(result.isError).toBe(true);
  expect(result.code).toBe("parse");
  expect(result.message).toBe("Failed to parse Data Dragon response as JSON");
});

test("toMcpError: not-found error → code 'not-found'", () => {
  const result = toMcpError(notFoundError());
  expect(result.isError).toBe(true);
  expect(result.code).toBe("not-found");
  expect(result.message).toContain("Resource not found");
});

test("toMcpError: generic Error → code 'internal'", () => {
  const err = new Error("Something went wrong");
  const result = toMcpError(err);
  expect(result.isError).toBe(true);
  expect(result.code).toBe("internal");
  expect(result.message).toBe("Something went wrong");
});

test("toMcpError: plain object error with code field → uses that code", () => {
  const err = { code: "ambiguous", message: "Champion query matches multiple" };
  const result = toMcpError(err);
  expect(result.isError).toBe(true);
  expect(result.code).toBe("ambiguous");
  expect(result.message).toBe("Champion query matches multiple");
});

test("toMcpError: validation error (from Zod) → code 'validation'", () => {
  const err = new Error("Invalid input");
  (err as any).name = "ZodError"; // simulate Zod error
  const result = toMcpError(err);
  expect(result.isError).toBe(true);
  expect(result.code).toBe("validation");
});

test("toMcpError: unknown thrown value → code 'internal'", () => {
  const result = toMcpError("not an error object");
  expect(result.isError).toBe(true);
  expect(result.code).toBe("internal");
  expect(result.message).toBe("An unexpected error occurred");
});

test("toMcpError: preserves data field from DDragonError when present", () => {
  const err: DDragonError = { kind: "network", message: "Network error", cause: { foo: "bar" } };
  const result = toMcpError(err);
  expect(result.isError).toBe(true);
  expect(result.code).toBe("network");
  expect(result.data).toEqual({ cause: { foo: "bar" } });
});

test("toMcpError: future DDragonError kind throws rather than returning undefined", () => {
  // Simulate a future error kind not yet in the DDragonError union.
  const futureErr = { kind: "rate-limit" as const, message: "Rate limited" };
  // Cast to bypass the TypeScript union exhaustiveness check (this is intentional —
  // we are testing runtime behaviour for a kind that does not exist yet).
  expect(() => toMcpError(futureErr as unknown as DDragonError)).toThrow(/Unknown DDragonError kind/);
});