import { loadConfig } from "../config";
import { readdir, readFile, rename, rm, writeFile, mkdir } from "fs/promises";
import { join } from "path";

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface DiskEntry<T> {
  value: T;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class DiskCache<T> {
  private readonly cacheDir: string;
  private readonly defaultTtl: number;
  private readonly pinVersion: string | null;

  constructor(cacheDir: string) {
    const config = loadConfig();
    this.cacheDir = cacheDir;
    this.defaultTtl = config.ttlSeconds;
    this.pinVersion = config.pinVersion;
  }

  /**
   * Retrieve a value from disk. Returns undefined if absent, invalid key, or expired.
   * Expired entries are deleted from disk.
   */
  async get(key: string): Promise<T | undefined> {
    let filePath: string;
    try {
      filePath = this.keyToPath(key);
    } catch {
      return undefined;
    }
    let entry: DiskEntry<T>;
    try {
      const raw = await readFile(filePath, "utf-8");
      entry = JSON.parse(raw) as DiskEntry<T>;
    } catch {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      await this.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Write a value to disk atomically (write-to-tmp then rename).
   * Triggers cleanup of expired entries.
   * If pinVersion is set, skips prune.
   */
  async set(key: string, value: T, ttlSeconds?: number): Promise<void> {
    await this.cleanup();
    const ttl = ttlSeconds ?? this.defaultTtl;
    const entry: DiskEntry<T> = {
      value,
      expiresAt: Date.now() + ttl * 1000,
    };
    const filePath = this.keyToPath(key);
    const dir = this.fileDir(filePath);
    await mkdir(dir, { recursive: true });
    const tmpPath = filePath + ".tmp";
    await writeFile(tmpPath, JSON.stringify(entry), "utf-8");
    await rename(tmpPath, filePath);
  }

  /**
   * Remove a key from disk. No-op for invalid or missing keys.
   */
  async delete(key: string): Promise<void> {
    let filePath: string;
    try {
      filePath = this.keyToPath(key);
    } catch {
      return;
    }
    await rm(filePath, { force: true });
  }

  /**
   * Prune oldest versions, keeping only the newest `retention` versions.
   * Version is determined by the second segment of the cache key.
   * If pinVersion is set, prune is skipped.
   */
  async prune(retention: number): Promise<void> {
    if (this.pinVersion !== null) {
      return; // pinned version must not be evicted
    }
    const ddragonDir = join(this.cacheDir, "ddragon");
    let versionDirs: string[];
    try {
      versionDirs = await readdir(ddragonDir);
    } catch {
      return; // no cache directory yet
    }

    if (versionDirs.length <= retention) return;

    // Sort by version number (newest last = keep newest).
    // Riot versions are "MAJOR.MINOR.PATCH" — compare numerically.
    const sorted = [...versionDirs].sort((a, b) => {
      const pa = a.split(".").map(Number);
      const pb = b.split(".").map(Number);
      for (let i = 0; i < 3; i++) {
        const da = pa[i] ?? 0;
        const db = pb[i] ?? 0;
        if (da !== db) return da - db;
      }
      return 0;
    });

    // Keep the newest `retention` versions
    const toEvict = sorted.slice(0, sorted.length - retention);
    for (const version of toEvict) {
      const versionPath = join(ddragonDir, version);
      await rm(versionPath, { recursive: true, force: true });
    }
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Convert a cache key to an on-disk file path.
   * Key format: ddragon:<version>:<locale>:<path>
   * Output: <cacheDir>/ddragon/<version>/<locale>/<relative-path>.json
   *
   * The path in the key is absolute (e.g. /cdn/14.10.1/data/en_US/champion.json).
   * We strip the leading "/" to make it relative before joining.
   */
  private keyToPath(key: string): string {
    const colonIdx = key.indexOf(":");
    if (colonIdx === -1 || key.slice(0, colonIdx) !== "ddragon") {
      throw new Error(`Invalid cache key format: ${key}`);
    }
    // Find the 2nd and 3rd colons to split version and locale
    let secondColon = -1;
    let thirdColon = -1;
    let colonsFound = 0;
    for (let i = colonIdx + 1; i < key.length; i++) {
      if (key[i] === ":") {
        colonsFound++;
        if (colonsFound === 1) secondColon = i;
        else if (colonsFound === 2) {
          thirdColon = i;
          break;
        }
      }
    }
    if (colonsFound < 2) {
      throw new Error(`Invalid cache key format: ${key}`);
    }
    const version = key.slice(colonIdx + 1, secondColon);
    const locale = key.slice(secondColon + 1, thirdColon);
    const pathWithSlash = key.slice(thirdColon + 1); // e.g. "/cdn/14.10.1/data/en_US/champion.json"
    // Strip leading "/" so join() treats it as relative
    const relativePath = pathWithSlash.startsWith("/")
      ? pathWithSlash.slice(1)
      : pathWithSlash;
    const filePath = join(
      this.cacheDir,
      "ddragon",
      version,
      locale,
      relativePath + ".json"
    );
    return filePath;
  }

  /**
   * Get the directory portion of a file path.
   */
  private fileDir(filePath: string): string {
    const lastSep = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
    return filePath.slice(0, lastSep);
  }

  /**
   * Remove expired entries from disk (one-time scan, not recursive).
   * Only expires entries in the top-level version directories.
   */
  private async cleanup(): Promise<void> {
    const ddragonDir = join(this.cacheDir, "ddragon");
    let versionDirs: string[];
    try {
      versionDirs = await readdir(ddragonDir);
    } catch {
      return;
    }

    for (const version of versionDirs) {
      const versionPath = join(ddragonDir, version);
      let localeDirs: string[];
      try {
        localeDirs = await readdir(versionPath);
      } catch {
        continue;
      }

      for (const locale of localeDirs) {
        const localePath = join(versionPath, locale);
        let files: string[];
        try {
          files = await readdir(localePath);
        } catch {
          continue;
        }

        for (const file of files) {
          if (!file.endsWith(".json")) continue;
          const filePath = join(localePath, file);
          let entry: DiskEntry<T>;
          try {
            const raw = await readFile(filePath, "utf-8");
            entry = JSON.parse(raw) as DiskEntry<T>;
          } catch {
            continue;
          }

          if (Date.now() > entry.expiresAt) {
            await rm(filePath, { force: true });
          }
        }
      }
    }
  }
}