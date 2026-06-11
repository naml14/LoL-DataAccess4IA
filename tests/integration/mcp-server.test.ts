import { test, expect, describe } from "bun:test";
import { ToolRegistry } from "../../src/mcp/tool-registry";
import { toMcpError } from "../../src/mcp/errors";
import { ChampionNotFoundError } from "../../src/tools/get-champion";
import { ItemNotFoundError } from "../../src/tools/get-item";
import type { McpErrorResponse } from "../../src/mcp/errors";

// ---------------------------------------------------------------------------
// Error envelope mapping tests
// ---------------------------------------------------------------------------

describe("mcp-server: error envelope mapping", () => {
  test("ChampionNotFoundError → not-found", () => {
    const err = new ChampionNotFoundError("NonExistent");
    const mcpErr = toMcpError(err);
    expect(mcpErr.isError).toBe(true);
    expect(mcpErr.code).toBe("not-found");
    expect(mcpErr.message).toContain("NonExistent");
  });

  test("ItemNotFoundError → not-found", () => {
    const err = new ItemNotFoundError(99999);
    const mcpErr = toMcpError(err);
    expect(mcpErr.isError).toBe(true);
    expect(mcpErr.code).toBe("not-found");
  });

  test("network DDragonError → code 'network'", () => {
    const err = { kind: "network" as const, message: "Network failure", cause: { foo: "bar" } };
    const mcpErr = toMcpError(err);
    expect(mcpErr.code).toBe("network");
    expect(mcpErr.data).toEqual({ cause: { foo: "bar" } });
  });

  test("timeout DDragonError → code 'timeout'", () => {
    const err = { kind: "timeout" as const, message: "Request timed out" };
    const mcpErr = toMcpError(err);
    expect(mcpErr.code).toBe("timeout");
  });

  test("http DDragonError → code 'http'", () => {
    const err = { kind: "http" as const, message: "HTTP 503" };
    const mcpErr = toMcpError(err);
    expect(mcpErr.code).toBe("http");
  });

  test("circuit-open DDragonError → code 'circuit-open'", () => {
    const err = { kind: "circuit-open" as const, message: "Circuit breaker open" };
    const mcpErr = toMcpError(err);
    expect(mcpErr.code).toBe("circuit-open");
  });

  test("parse DDragonError → code 'parse'", () => {
    const err = { kind: "parse" as const, message: "JSON parse failed" };
    const mcpErr = toMcpError(err);
    expect(mcpErr.code).toBe("parse");
  });

  test("not-found DDragonError → code 'not-found'", () => {
    const err = { kind: "not-found" as const, message: "Resource missing" };
    const mcpErr = toMcpError(err);
    expect(mcpErr.code).toBe("not-found");
  });

  test("plain object with code field uses that code", () => {
    const err = { code: "ambiguous", message: "Champion query matches multiple" };
    const mcpErr = toMcpError(err);
    expect(mcpErr.code).toBe("ambiguous");
    expect(mcpErr.message).toBe("Champion query matches multiple");
  });

  test("generic Error → code 'internal'", () => {
    const err = new Error("Unexpected failure");
    const mcpErr = toMcpError(err);
    expect(mcpErr.code).toBe("internal");
  });

  test("string thrown → code 'internal' with fallback message", () => {
    const mcpErr = toMcpError("not an error object");
    expect(mcpErr.code).toBe("internal");
    expect(mcpErr.message).toBe("An unexpected error occurred");
  });
});

// ---------------------------------------------------------------------------
// Tool registry completeness
// ---------------------------------------------------------------------------

describe("mcp-server: tool registry", () => {
  test("registry exposes all 8 tools", () => {
    const registry = new ToolRegistry();
    expect(registry.listTools()).toHaveLength(8);
  });

  test("each tool has name, description, and inputSchema", () => {
    const registry = new ToolRegistry();
    const tools = registry.listTools();
    for (const tool of tools) {
      expect(typeof tool.name).toBe("string");
      expect(tool.name.length).toBeGreaterThan(0);
      expect(typeof tool.description).toBe("string");
      expect(tool.description.length).toBeGreaterThan(0);
      expect(tool.inputSchema).toBeDefined();
    }
  });

  test("each tool name matches expected roster", () => {
    const registry = new ToolRegistry();
    const names = registry.listTools().map((t) => t.name).sort();
    expect(names).toEqual([
      "get_champion",
      "get_current_patch",
      "get_item",
      "list_champions",
      "list_items",
      "list_profile_icons",
      "list_runes",
      "list_summoner_spells",
    ].sort());
  });

  test("getTool returns correct tool for each name", () => {
    const registry = new ToolRegistry();
    for (const name of registry.listTools()) {
      expect(registry.getTool(name.name)).toBe(name);
    }
  });

  test("getTool returns undefined for unknown tool", () => {
    const registry = new ToolRegistry();
    expect(registry.getTool("nonexistent")).toBeUndefined();
  });

  test("registerAllTools does not throw", () => {
    const registry = new ToolRegistry();
    // Mock server with setRequestHandler
    const mockServer = {
      setRequestHandler: () => {},
    };
    expect(() =>
      registry.registerAllTools(mockServer as any, {
        client: {} as any,
        cache: new Map() as any,
        config: {
          locale: "en_US",
          ttlSeconds: 900,
          pinVersion: null,
          cacheDir: "./.cache/ddragon",
          httpTimeoutMs: 5000,
          logLevel: "info" as const,
        },
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
          debug: () => {},
        },
      })
    ).not.toThrow();
  });
});