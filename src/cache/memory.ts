import { loadConfig } from "../config";

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export class MemoryCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();
  private readonly defaultTtl: number;

  constructor() {
    this.defaultTtl = loadConfig().ttlSeconds;
  }

  /**
   * Retrieve a value. Returns undefined if the key is absent or expired.
   */
  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (entry === undefined) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Store a value with an optional TTL in seconds.
   * Defaults to config.ttlSeconds.
   * Triggers cleanup of any expired entries.
   */
  set(key: string, value: T, ttlSeconds?: number): void {
    this.cleanup();
    const ttl = ttlSeconds ?? this.defaultTtl;
    const expiresAt = Date.now() + ttl * 1000;
    this.store.set(key, { value, expiresAt });
  }

  /**
   * Remove a specific key.
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Remove all entries.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Remove all expired entries from the store.
   * Exposed publicly so integration tests can call it without waiting.
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }
}