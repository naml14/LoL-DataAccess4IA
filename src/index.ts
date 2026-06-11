// Entry point — wires the MCP server into the process.
// Smoke test: loadConfig() is called inside startServer(), so this will throw
// at module load time if config is invalid (e.g. LOL_DD_HTTP_TIMEOUT_MS < 100).
import { startServer } from "./mcp/server.js";

startServer().catch((err) => {
  console.error("[lol-datadragon-mcp] Fatal error during startup:", err);
  process.exit(1);
});