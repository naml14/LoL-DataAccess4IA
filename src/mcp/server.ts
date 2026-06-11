import { Server } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "../config";
import { DDragonClient } from "../ddragon/client";
import { TieredCache } from "../cache/tiered";
import { ToolRegistry } from "./tool-registry";
import { toMcpError } from "./errors";
import { createToolContext } from "../tools/_ctx";
import type { ToolContext } from "../tools/_ctx";

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

type LogLevel = "debug" | "info" | "warn" | "error";

const log: Record<LogLevel, (msg: string, ...meta: unknown[]) => void> = {
  debug: (msg, ...meta) => console.debug("[lol-datadragon-mcp]", msg, ...meta),
  info: (msg, ...meta) => console.info("[lol-datadragon-mcp]", msg, ...meta),
  warn: (msg, ...meta) => console.warn("[lol-datadragon-mcp]", msg, ...meta),
  error: (msg, ...meta) => console.error("[lol-datadragon-mcp]", msg, ...meta),
};

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export interface ServerDeps {
  client: DDragonClient;
  cache: TieredCache<unknown>;
  config: ToolContext["config"];
  logger?: ToolContext["logger"];
}

/**
 * Creates and starts the MCP server.
 *
 * Lifecycle:
 *  1. Load config (validates env, fails fast on bad values)
 *  2. Initialize DDragon HTTP client
 *  3. Initialize tiered cache (memory + disk)
 *  4. Register all 8 tools with the MCP SDK
 *  5. Connect over stdio
 *  6. On SIGTERM/SIGINT: flush cache writes, close transport, exit 0
 *  7. On uncaught error: log, exit non-zero
 */
export async function startServer(): Promise<void> {
  const config = loadConfig();
  const logger: ToolContext["logger"] = {
    info: (msg, ...meta) => log.info(msg, ...meta),
    warn: (msg, ...meta) => log.warn(msg, ...meta),
    error: (msg, ...meta) => log.error(msg, ...meta),
    debug: (msg, ...meta) => log.debug(msg, ...meta),
  };

  logger.info("Starting LoL Data Dragon MCP server", { locale: config.locale, pinVersion: config.pinVersion });

  // Initialize client and cache
  const client = new DDragonClient({});
  const cache = new TieredCache<unknown>(config.cacheDir);

  // Initialize tool registry
  const registry = new ToolRegistry();

  // Create MCP server
  const server = new Server(
    {
      name: "lol-datadragon-mcp",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Wire tools into the server
  registry.registerAllTools(server, {
    client,
    cache,
    config: {
      locale: config.locale,
      ttlSeconds: config.ttlSeconds,
      pinVersion: config.pinVersion,
      cacheDir: config.cacheDir,
      httpTimeoutMs: config.httpTimeoutMs,
      logLevel: config.logLevel,
    },
    logger,
  });

  // Also register the tools/list handler so the server can report capabilities
  server.setRequestHandler(
    { method: "tools/list" },
    async () => {
      return {
        tools: registry.listTools().map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      };
    }
  );

  // Global error handler — catch any unhandled promise rejections
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", err);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled rejection", reason);
    process.exit(1);
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down...");
    try {
      // Flush any in-flight cache writes by letting the event loop clear
      await new Promise((resolve) => setTimeout(resolve, 100));
    } finally {
      process.exit(0);
    }
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  // Connect to stdio transport — this blocks until the transport closes
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ---------------------------------------------------------------------------
// Main entry point (only when run directly)
// ---------------------------------------------------------------------------

// The actual start happens via src/index.ts which calls startServer().
// This block is here so `bun run src/mcp/server.ts` works for debugging.
if (import.meta.main) {
  startServer().catch((err) => {
    console.error("[lol-datadragon-mcp] Fatal error:", err);
    process.exit(1);
  });
}