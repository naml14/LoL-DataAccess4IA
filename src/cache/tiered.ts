import { MemoryCache } from "./memory";
import { DiskCache } from "./disk";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class TieredCache<T> {
  readonly memory: MemoryCache<T>;
  readonly disk: DiskCache<T>;

  constructor(cacheDir: string) {
    this.memory = new MemoryCache<T>();
    this.disk = new DiskCache<T>(cacheDir);
  }

  /**
   * Get from memory first. On miss, fall through to disk.
   * On disk hit, rehydrate memory.
   */
  async get(key: string): Promise<T | undefined> {
    // Try memory first
    const memResult = this.memory.get(key);
    if (memResult !== undefined) {
      return memResult;
    }

    // Memory miss — try disk
    const diskResult = await this.disk.get(key);
    if (diskResult !== undefined) {
      // Rehydrate memory
      this.memory.set(key, diskResult);
      return diskResult;
    }

    return undefined;
  }

  /**
   * Write to both memory and disk layers.
   */
  async set(key: string, value: T, ttlSeconds?: number): Promise<void> {
    this.memory.set(key, value, ttlSeconds);
    await this.disk.set(key, value, ttlSeconds);
  }

  /**
   * Delete from both layers.
   */
  async delete(key: string): Promise<void> {
    this.memory.delete(key);
    await this.disk.delete(key);
  }

  /**
   * Clear only the memory layer (disk is independent).
   */
  clear(): void {
    this.memory.clear();
  }
}