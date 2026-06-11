import type { DDragonClient } from "../ddragon/client";
import type { TieredCache } from "../cache/tiered";
import type { MemoryCache } from "../cache/memory";

/**
 * Context passed to every tool handler.
 * Represents the runtime dependencies available at call time.
 */
export interface ToolContext {
  client: DDragonClient;
  cache: TieredCache<unknown> | MemoryCache<unknown>;
  config: {
    readonly locale: string;
    readonly ttlSeconds: number;
    readonly pinVersion: string | null;
    readonly cacheDir: string;
    readonly httpTimeoutMs: number;
    readonly logLevel: "debug" | "info" | "warn" | "error";
  };
  logger: {
    info: (msg: string, ...meta: unknown[]) => void;
    warn: (msg: string, ...meta: unknown[]) => void;
    error: (msg: string, ...meta: unknown[]) => void;
    debug: (msg: string, ...meta: unknown[]) => void;
  };
}

export interface CreateToolContextOptions {
  client: DDragonClient;
  cache: TieredCache<unknown> | MemoryCache<unknown>;
  config: ToolContext["config"];
  logger: ToolContext["logger"];
}

/**
 * Factory to create a ToolContext — used by tests to construct a concrete
 * context without pulling in the real config singleton.
 */
export function createToolContext(options: CreateToolContextOptions): ToolContext {
  return {
    client: options.client,
    cache: options.cache,
    config: options.config,
    logger: options.logger,
  };
}