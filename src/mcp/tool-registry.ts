import type { Server } from "@modelcontextprotocol/sdk/server";
import { z } from "zod";
import { getCurrentPatchTool } from "../tools/get-current-patch";
import { listChampionsTool } from "../tools/list-champions";
import { getChampionTool } from "../tools/get-champion";
import { listItemsTool } from "../tools/list-items";
import { getItemTool } from "../tools/get-item";
import { getItemsByNameTool } from "../tools/get-items-by-name";
import { getItemCanonicalForMapTool } from "../tools/get-item-canonical-for-map";
import { listRunesTool } from "../tools/list-runes";
import { listSummonerSpellsTool } from "../tools/list-summoner-spells";
import type { ToolContext } from "../tools/_ctx";
import { createToolContext } from "../tools/_ctx";
import { toMcpError } from "./errors";
import type { DDragonClient } from "../ddragon/client";
import type { TieredCache } from "../cache/tiered";

// ---------------------------------------------------------------------------
// Zod request schema for the tools/call JSON-RPC method.
//
// The MCP SDK inspects requestSchema.shape.method at runtime; a plain object
// like `{ method: "tools/call" }` is rejected with "Schema is missing a
// method literal" because getObjectShape() returns undefined for non-Zod
// inputs. We must pass a real Zod schema with `method` as a literal.
//
// The schema MUST also declare `params` (with `name` and optional
// `arguments`). Without this, the SDK's Zod validator rejects incoming
// requests with "expected object, received undefined" at path "params"
// (error -32602). The actual argument shape validation happens inside the
// per-tool handler against its own inputSchema.
// ---------------------------------------------------------------------------

const ToolsCallRequestSchema = z.object({
  method: z.literal("tools/call"),
  params: z
    .object({
      name: z.string(),
      arguments: z.record(z.unknown()).optional(),
      _meta: z.record(z.unknown()).optional(),
    })
    .passthrough(),
});

// ---------------------------------------------------------------------------
// Tool definition types
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
  handler(input: unknown, ctx: ToolContext): Promise<unknown>;
}

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

export class ToolRegistry {
  private readonly tools: Map<string, ToolDefinition>;

  constructor() {
    this.tools = new Map();
    this.register(getCurrentPatchTool);
    this.register(listChampionsTool);
    this.register(getChampionTool);
    this.register(listItemsTool);
    this.register(getItemTool);
    this.register(getItemsByNameTool);
    this.register(getItemCanonicalForMapTool);
    this.register(listRunesTool);
    this.register(listSummonerSpellsTool);
  }

  /**
   * Register a tool. Validates the inputSchema with Zod.
   * Throws if the tool's inputSchema cannot be parsed as a Zod schema.
   */
  private register(tool: ToolDefinition): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    // Validate that inputSchema can be used with Zod (structural validation).
    // We accept any object shape — Zod will validate at runtime.
    if (!tool.inputSchema || typeof tool.inputSchema !== "object") {
      throw new Error(`Tool ${tool.name} has invalid inputSchema`);
    }
    this.tools.set(tool.name, tool);
  }

  /**
   * Returns all registered tools as a flat list.
   */
  listTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Returns a tool by name, or undefined if not found.
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Registers ALL tools with an MCP Server instance under a single
   * `tools/call` request handler. The MCP SDK allows only ONE handler per
   * method, so we register once and dispatch internally by tool name.
   * (Previous versions registered one handler per tool in a loop, which
   * the SDK rejects at startup with "Schema is missing a method literal"
   * after the first registration. See slice 9 archive reports for context.)
   */
  registerAllTools(
    server: Server,
    deps: {
      client: DDragonClient;
      cache: TieredCache<unknown>;
      config: ToolContext["config"];
      logger: ToolContext["logger"];
    }
  ): void {
    // The MCP SDK infers a strict RequestHandler<T, R> type from the callback
    // signature. Our dispatch handler accepts a `tools/call` request and
    // returns a generic result, which does not match the inferred type.
    // The two-step cast (`as unknown as`) is the minimal safe workaround.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    server.setRequestHandler(
      ToolsCallRequestSchema as unknown as any,
      async (request: any): Promise<any> => {
        const toolName: string = request?.params?.name;
        const tool = this.tools.get(toolName);
        if (!tool) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  isError: true,
                  code: "not-found",
                  message: `Tool not found: ${toolName}`,
                }),
              },
            ],
            isError: true,
          };
        }

        const ctx = createToolContext({
          client: deps.client,
          cache: deps.cache,
          config: deps.config,
          logger: deps.logger,
        });

        try {
          const result = await tool.handler(request.params.arguments ?? {}, ctx);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(result),
              },
            ],
          };
        } catch (err) {
          const mcpErr = toMcpError(err);
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  isError: true,
                  code: mcpErr.code,
                  message: mcpErr.message,
                  data: mcpErr.data,
                }),
              },
            ],
            isError: true,
          };
        }
      }
    );
  }
}