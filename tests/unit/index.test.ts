import { test, expect } from "bun:test";
// The smoke test imports the index module to verify it loads without throwing.
// If loadConfig() or the module-level logging throws, this test fails.
import "../../src/index";

test("index smoke: loads without throwing", () => {
  // Reaching this line means the module imported and ran without crashing.
  expect(true).toBe(true);
});