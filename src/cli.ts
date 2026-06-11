// CLI entry — invoked by `bunx @naml14/lol-datadragon-mcp@latest` or via the
// `bin` field in package.json. Boots the MCP server on stdio. Any startup
// error exits non-zero so the MCP client (Claude Desktop, opencode, etc.)
// surfaces the failure rather than hanging silently.
//
// Note: the `#!/usr/bin/env bun` shebang is prepended by the build script
// (see package.json `build`) via --banner, so the source stays free of
// non-JS-syntax tokens that tsc/IDE would complain about.
import { startServer } from "./mcp/server.js";

startServer().catch((err: unknown) => {
  // Print to stderr so it does not pollute the JSON-RPC stream on stdout.
  console.error("[lol-datadragon-mcp] Fatal error during startup:", err);
  process.exit(1);
});
