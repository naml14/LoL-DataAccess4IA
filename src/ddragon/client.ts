import { loadConfig } from "../config";
import {
  getChampionPath,
  getChampionDetailPath,
  getItemListPath,
  getRuneListPath,
  getSummonerSpellsPath,
  getVersionsPath,
} from "./endpoints";

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------

export type DDragonError =
  | { kind: "network"; message: string; cause?: unknown }
  | { kind: "timeout"; message: string; cause?: unknown }
  | { kind: "http"; message: string; cause?: unknown }
  | { kind: "circuit-open"; message: string }
  | { kind: "parse"; message: string; cause?: unknown }
  | { kind: "not-found"; message: string };

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------

class CircuitBreaker {
  private consecutiveFailures = 0;
  private readonly threshold: number;

  constructor(threshold: number) {
    this.threshold = threshold;
  }

  /** Returns true if the circuit is open and requests should be fast-rejected. */
  isOpen(): boolean {
    return this.consecutiveFailures >= this.threshold;
  }

  /** Records a successful response — resets the failure counter. */
  recordSuccess(): void {
    this.consecutiveFailures = 0;
  }

  /** Records a failure — increments the counter. */
  recordFailure(): void {
    this.consecutiveFailures++;
  }

  /** Returns true if the circuit just opened. */
  checkFailure(): boolean {
    if (this.consecutiveFailures === this.threshold) {
      return true; // just opened
    }
    this.recordFailure();
    return false;
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export interface ClientOptions {
  timeoutMs: number;
  retries: number;
  circuitThreshold: number;
}

export class DDragonClient {
  private readonly timeoutMs: number;
  private readonly retries: number;
  private readonly cb: CircuitBreaker;

  constructor(options: Partial<ClientOptions> = {}) {
    const config = loadConfig();
    this.timeoutMs = options.timeoutMs ?? config.httpTimeoutMs;
    this.retries = options.retries ?? 3;
    this.cb = new CircuitBreaker(options.circuitThreshold ?? 5);
  }

  destroy(): void {
    // No-op for now; placeholder for future resource cleanup.
  }

  // -------------------------------------------------------------------------
  // Public API — each method wraps fetchJson with the appropriate URL
  // -------------------------------------------------------------------------

  async getVersions(): Promise<unknown> {
    return this.fetchJson(getVersionsPath());
  }

  async getChampionList(version: string, locale: string): Promise<unknown> {
    return this.fetchJson(getChampionPath(version, locale));
  }

  async getChampionDetail(
    version: string,
    locale: string,
    championId: string
  ): Promise<unknown> {
    return this.fetchJson(getChampionDetailPath(version, locale, championId));
  }

  async getItemList(version: string, locale: string): Promise<unknown> {
    return this.fetchJson(getItemListPath(version, locale));
  }

  async getRuneList(version: string, locale: string): Promise<unknown> {
    return this.fetchJson(getRuneListPath(version, locale));
  }

  async getSummonerList(version: string, locale: string): Promise<unknown> {
    return this.fetchJson(getSummonerSpellsPath(version, locale));
  }

  // -------------------------------------------------------------------------
  // Core fetch with timeout, retries, circuit breaker
  // -------------------------------------------------------------------------

  private async fetchJson(
    url: string,
    attempt = 0,
    signal?: AbortSignal
  ): Promise<unknown> {
    if (this.cb.isOpen()) {
      return Promise.reject<DDragonError>({
        kind: "circuit-open",
        message: "Circuit breaker is open — Data Dragon is unavailable",
      });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    // If caller passed a signal, chain it so either can abort.
    const linked = signal ? anySignal([signal, controller.signal]) : controller.signal;

    let res: Response;
    try {
      res = await fetch(url, {
        signal: linked,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      clearTimeout(timeoutId);
      if (
        err instanceof DOMException &&
        (err.name === "AbortError" || err.message.toLowerCase().includes("abort"))
      ) {
        // AbortError from our timeout or from the caller's external signal.
        return Promise.reject<DDragonError>({
          kind: "timeout",
          message: `Request timed out after ${this.timeoutMs}ms`,
          cause: err,
        });
      }
      return Promise.reject<DDragonError>({
        kind: "network",
        message: "Network error reaching Data Dragon",
        cause: err,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (res.status === 404) {
      this.cb.recordFailure();
      return Promise.reject<DDragonError>({
        kind: "not-found",
        message: `Resource not found: ${url}`,
      });
    }

    if (!res.ok) {
      // Retry on 5xx and 429; give up after N attempts.
      if (attempt < this.retries && (res.status >= 500 || res.status === 429)) {
        const delay = jitteredBackoff(attempt);
        await sleep(delay);
        return this.fetchJson(url, attempt + 1, signal);
      }
      this.cb.recordFailure();
      return Promise.reject<DDragonError>({
        kind: "http",
        message: `Data Dragon returned HTTP ${res.status}`,
        cause: res.status,
      });
    }

    this.cb.recordSuccess();

    let data: unknown;
    try {
      data = await res.json();
    } catch (err) {
      return Promise.reject<DDragonError>({
        kind: "parse",
        message: "Failed to parse Data Dragon response as JSON",
        cause: err,
      });
    }

    return data;
  }
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Combines multiple AbortSignals into one — any abort aborts the combined signal. */
function anySignal(signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const s of signals) {
    s.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}

/** Returns a jittered exponential-backoff delay in milliseconds. */
function jitteredBackoff(attempt: number): number {
  const base = 200 * 2 ** attempt;
  const jitter = Math.random() * 100;
  return base + jitter;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}