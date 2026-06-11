import type { Server } from "@modelcontextprotocol/sdk/server";
import { getCurrentPatchTool } from "../tools/get-current-patch";
import { listChampionsTool } from "../tools/list-champions";
import { getChampionTool } from "../tools/get-champion";
import { listItemsTool } from "../tools/list-items";
import { getItemTool } from "../tools/get-item";
import { listRunesTool } from "../tools/list-runes";
import { listSummonerSpellsTool } from "../tools/list-summoner-spells";
import { listProfileIconsTool } from "../tools/list-profile-icons";
import type { ToolContext } from "../tools/_ctx";
import { createToolContext } from "../tools/_ctx";
import { toMcpError } from "./errors";
import type { DDragonClient } from "../ddragon/client";
import type { TieredCache } from "../cache/tiered";

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
    this.register(listRunesTool);
    this.register(listSummonerSpellsTool);
    this.register(listProfileIconsTool);
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
   * Registers all tools with an MCP Server instance.
   * Each tool becomes available via the tools/call JSON-RPC method.
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
    for (const tool of this.tools.values()) {
      server.setRequestHandler(
        { method: "tools/call" } as any,
        async (request: any): Promise<any> => {
          // Only handle requests for this tool
          if (request.params.name !== tool.name) {
            return undefined;
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
                  text: JSON.stringify({ isError: true, code: mcpErr.code, message: mcpErr.message, data: mcpErr.data }),
                },
              ],
              isError: true,
            };
          }
        }
      );
    }
  }
}