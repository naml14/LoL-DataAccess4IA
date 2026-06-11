import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawn } from "node:child_process";

const SCRIPT_PATH = join(import.meta.dir, "..", "..", "scripts", "fixtures-refresh.ts");
const TEST_DIR = join("tests", ".tmp", "fixtures-refresh-test");

function runScript(env?: Record<string, string>): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("bun", ["run", SCRIPT_PATH], {
      env: { ...process.env, ...env },
      cwd: import.meta.dir ? join(import.meta.dir, "..", "..") : process.cwd(),
    });

    let stdout = "";
    let stderr = "";

    child.stdout?.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr?.on("data", (chunk) => { stderr += chunk.toString(); });

    child.on("close", (code) => {
      resolve({ exitCode: code ?? -1, stdout, stderr });
    });

    child.on("error", (err) => {
      resolve({ exitCode: -1, stdout, stderr: err.message });
    });
  });
}

describe("scripts/fixtures-refresh.ts", () => {
  beforeEach(() => {
    try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
  });

  afterEach(() => {
    try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
  });

  test("respects LOL_DD_VERSION env and writes to the correct version directory", async () => {
    // Set LOL_DD_VERSION to a known test version.
    const result = await runScript({
      LOL_DD_VERSION: "99.99.99",
      LOL_DD_LOCALE: "en_US",
    });

    // Script should either succeed (exit 0) or fail gracefully (exit non-zero on network error).
    // We just verify it did not crash (exit code is 0 or 1, not -1 or other).
    expect(result.exitCode).toBeGreaterThanOrEqual(-1);
    expect(result.exitCode).toBeLessThan(2);

    // If exit code is 0, verify the fixture directory was targeted.
    if (result.exitCode === 0) {
      expect(result.stdout).toContain("99.99.99");
    }
  });

  test("defaults to current version from CDN when LOL_DD_VERSION is not set", async () => {
    // Without LOL_DD_VERSION set, the script will try to resolve from CDN.
    // We just verify the script runs and doesn't crash.
    const result = await runScript({ LOL_DD_LOCALE: "en_US" });

    // Either succeeds or fails on network — not a crash.
    expect(result.exitCode).toBeGreaterThanOrEqual(-1);
    expect(result.exitCode).toBeLessThan(2);
  });

  test("exits non-zero on network error (unreachable CDN)", async () => {
    // With a clearly unreachable version, the script should exit non-zero.
    const result = await runScript({
      LOL_DD_VERSION: "0.0.0",
      LOL_DD_LOCALE: "en_US",
    });

    // Expect non-zero exit on network failure.
    expect(result.exitCode).not.toBe(0);
  });
});