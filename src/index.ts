// Entry point — Phase 1 slice only (no MCP server yet, see Phase 6)
// TODO(slice-6): real implementation in Phase 6 — wire MCP server here
import { loadConfig } from "./config";

const config = loadConfig();

// Simple logger that respects logLevel — no external logger dependency yet.
// TODO(slice-6): replace with a proper logger (e.g. pino) wired through the MCP server lifecycle
const log: Record<string, () => void> = {
  debug: () => console.debug("[lol-datadragon-mcp]", config),
  info: () => console.info("[lol-datadragon-mcp]", config),
  warn: () => console.warn("[lol-datadragon-mcp]", config),
  error: () => console.error("[lol-datadragon-mcp]", config),
};

log[config.logLevel]();