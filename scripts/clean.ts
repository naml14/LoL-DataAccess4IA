/**
 * Clean script — removes build artifacts and cached data.
 * Run with: bun run scripts/clean.ts
 */
import { rm } from "node:fs/promises";
import { join } from "node:path";

const TO_REMOVE = [".cache", "dist", ".bun", "node_modules"];

async function main() {
  const base = process.cwd();
  for (const dir of TO_REMOVE) {
    const fullPath = join(base, dir);
    try {
      await rm(fullPath, { recursive: true, force: true });
      console.log(`Removed: ${dir}`);
    } catch {
      // Already absent — no-op
    }
  }
  console.log("Clean complete.");
}

main().catch((err) => {
  console.error("Clean failed:", err);
  process.exit(1);
});