import { test, expect } from "bun:test";

// This test verifies the entry point source contains the MCP server wiring.
// The actual module import would call startServer() and try to connect to stdio
// (which hangs in a test environment), so we verify the source code instead.
test("index: source contains startServer call wired from mcp/server", async () => {
  const source = await Bun.file("src/index.ts").text();
  expect(source).toContain("startServer");
  expect(source).toContain("./mcp/server.js");
  expect(source).toContain("startServer().catch");
  expect(source).toContain("process.exit(1)");
});