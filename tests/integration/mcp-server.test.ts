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
  test("registry exposes all 7 tools", () => {
    const registry = new ToolRegistry();
    expect(registry.listTools()).toHaveLength(7);
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

  // Regression test: previously registerAllTools called setRequestHandler
  // once per tool in a loop. The MCP SDK only allows one handler per
  // method, so the real server crashed at startup with "Schema is missing
  // a method literal" after the first registration. This test enforces
  // the single-handler invariant.
  test("registerAllTools registers exactly ONE tools/call handler (not one per tool)", () => {
    const registry = new ToolRegistry();
    const calls: Array<{ schema: unknown; handler: unknown }> = [];
    const mockServer = {
      setRequestHandler: (schema: unknown, handler: unknown) => {
        calls.push({ schema, handler });
      },
    };
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
    });
    // The bug was: 8 calls (one per tool). The fix is: exactly 1 call
    // for `tools/call` that dispatches internally.
    expect(calls).toHaveLength(1);
    // The schema passed to the SDK is a Zod schema (not a plain object) so
    // the MCP SDK's getObjectShape() can extract the `method` literal. The
    // previous bug used `{ method: "tools/call" }` (plain object) which the
    // SDK rejected at startup with "Schema is missing a method literal".
    const schema = calls[0].schema as { shape?: { method?: { value?: string }; params?: unknown } };
    expect(schema.shape?.method?.value).toBe("tools/call");
    // The schema must also accept `params` (the request body has it). Without
    // this, the SDK validator rejects incoming tools/call requests with
    // error -32602 "expected object, received undefined" at path "params".
    expect(schema.shape?.params).toBeDefined();
  });

  // Regression test: the single handler must dispatch by tool name to the
  // correct registered tool. Call it with each registered name and a known
  // good argument shape; assert that the expected tool's handler ran.
  test("registerAllTools handler dispatches by tool name to the right tool", async () => {
    const registry = new ToolRegistry();
    let captured: { schema: unknown; handler: (req: any) => Promise<any> } | null = null;
    const mockServer = {
      setRequestHandler: (schema: unknown, handler: any) => {
        captured = { schema, handler };
      },
    };
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
    });
    expect(captured).not.toBeNull();
    // Call for an unknown tool name → should produce an isError response,
    // not crash and not return undefined.
    const unknownResult = await captured!.handler({
      params: { name: "does_not_exist", arguments: {} },
    });
    expect(unknownResult.isError).toBe(true);
    expect(JSON.parse(unknownResult.content[0].text).code).toBe("not-found");
  });
});