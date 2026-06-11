import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { DDragonClient } from "../../src/ddragon/client";

// ---------------------------------------------------------------------------
// Mock fetch helpers
// ---------------------------------------------------------------------------

type MockFetch = (url: string, init?: RequestInit) => Response | Error | Promise<Response>;

function makeMockFetch(response: Response | Error, delayMs = 0): MockFetch {
  return async (url: string, init?: RequestInit) => {
    const signal = init?.signal;

    if (signal?.aborted) {
      throw new DOMException("aborted", "AbortError");
    }

    let aborted = false;
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          aborted = true;
        },
        { once: true }
      );
    }

    // Poll for abortion so we don't have to rely on setTimeout being interruptible.
    const stepMs = 10;
    let elapsed = 0;
    while (elapsed < delayMs && !aborted) {
      await new Promise((r) => setTimeout(r, stepMs));
      elapsed += stepMs;
    }

    if (aborted) {
      throw new DOMException("aborted", "AbortError");
    }

    if (response instanceof Error) throw response;
    return response;
  };
}

function okResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe("DDragonClient", () => {
  let client: DDragonClient;

  const defaultClientOptions = {
    timeoutMs: 2000,
    retries: 3,
    circuitThreshold: 3,
  };

  beforeEach(() => {
    client = new DDragonClient(defaultClientOptions);
  });

  afterEach(() => {
    client.destroy();
  });

  // --- getVersions ---

  test("getVersions returns parsed array", async () => {
    globalThis.fetch = makeMockFetch(okResponse(["14.10.1", "14.9.2"])) as typeof fetch;
    const result = await client.getVersions();
    expect(result).toEqual(["14.10.1", "14.9.2"]);
  });

  // --- getChampionList ---

  test("getChampionList returns champion data", async () => {
    const fixture = { data: { Ahri: { id: "Ahri", key: "103" } } };
    globalThis.fetch = makeMockFetch(okResponse(fixture)) as typeof fetch;
    const result = await client.getChampionList("14.10.1", "en_US");
    expect(result).toEqual(fixture);
  });

  // --- getChampionDetail ---

  test("getChampionDetail returns champion detail JSON", async () => {
    const fixture = { id: "Ahri", key: "103", name: "Ahri", stats: {} };
    globalThis.fetch = makeMockFetch(okResponse(fixture)) as typeof fetch;
    const result = await client.getChampionDetail("14.10.1", "en_US", "Ahri");
    expect(result).toEqual(fixture);
  });

  // --- getItemList ---

  test("getItemList returns item data", async () => {
    const fixture = { data: { 1055: { id: 1055, name: "Long Sword" } } };
    globalThis.fetch = makeMockFetch(okResponse(fixture)) as typeof fetch;
    const result = await client.getItemList("14.10.1", "en_US");
    expect(result).toEqual(fixture);
  });

  // --- getRuneList ---

  test("getRuneList returns runes data", async () => {
    const fixture = [{ id: 8100, key: "Domination", name: "Domination" }];
    globalThis.fetch = makeMockFetch(okResponse(fixture)) as typeof fetch;
    const result = await client.getRuneList("14.10.1", "en_US");
    expect(result).toEqual(fixture);
  });

  // --- getSummonerList ---

  test("getSummonerList returns summoner spells data", async () => {
    const fixture = { data: { SummonerBarrier: { id: "SummonerBarrier" } } };
    globalThis.fetch = makeMockFetch(okResponse(fixture)) as typeof fetch;
    const result = await client.getSummonerList("14.10.1", "en_US");
    expect(result).toEqual(fixture);
  });

  // --- getProfileIconList ---

  test("getProfileIconList returns profile icon data", async () => {
    const fixture = { data: { 1: { id: 1, image: {} } } };
    globalThis.fetch = makeMockFetch(okResponse(fixture)) as typeof fetch;
    const result = await client.getProfileIconList("14.10.1", "en_US");
    expect(result).toEqual(fixture);
  });

  // --- Timeout ---

  test("timeout returns a timeout error when request exceeds configured timeout", async () => {
    // Mock that hangs longer than the 50ms timeout.
    globalThis.fetch = makeMockFetch(okResponse({}), 3000) as typeof fetch;

    const c = new DDragonClient({ timeoutMs: 50, retries: 0, circuitThreshold: 5 });
    await expect(c.getVersions()).rejects.toMatchObject({ kind: "timeout" });
    c.destroy();
  });

  // --- Retry on 5xx ---

  test("retries 503 and eventually succeeds", async () => {
    let attempts = 0;
    const retryingFetch = async () => {
      attempts++;
      if (attempts < 3) {
        return new Response("Service Unavailable", { status: 503 });
      }
      return new Response(JSON.stringify(["14.10.1"]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    globalThis.fetch = retryingFetch as unknown as typeof fetch;

    const c = new DDragonClient({ timeoutMs: 2000, retries: 3, circuitThreshold: 5 });
    const versions = await c.getVersions();
    expect(versions).toEqual(["14.10.1"]);
    expect(attempts).toBe(3);
    c.destroy();
  });

  test("gives up after N retries and returns http error", async () => {
    globalThis.fetch = makeMockFetch(new Response("Server Error", { status: 503 })) as typeof fetch;

    const c = new DDragonClient({ timeoutMs: 2000, retries: 1, circuitThreshold: 5 });
    await expect(c.getVersions()).rejects.toMatchObject({ kind: "http" });
    c.destroy();
  });

  // --- 404 not-found ---

  test("surfaces not-found error immediately without retrying", async () => {
    let attempts = 0;
    const notFoundFetch = async () => {
      attempts++;
      return new Response("Not Found", { status: 404 });
    };
    globalThis.fetch = notFoundFetch as unknown as typeof fetch;

    const c = new DDragonClient({ timeoutMs: 2000, retries: 3, circuitThreshold: 5 });
    await expect(c.getVersions()).rejects.toMatchObject({ kind: "not-found" });
    expect(attempts).toBe(1); // no retries for 404
    c.destroy();
  });

  // --- Circuit breaker ---

  test("opens after consecutive threshold failures and rejects fast", async () => {
    globalThis.fetch = makeMockFetch(new Response("Server Error", { status: 503 })) as typeof fetch;

    const c = new DDragonClient({ timeoutMs: 2000, retries: 0, circuitThreshold: 3 });

    // Exhaust the circuit breaker (3 consecutive failures)
    for (let i = 0; i < 3; i++) {
      await expect(c.getVersions()).rejects.toMatchObject({ kind: "http" });
    }

    // Now it should be open — next call returns circuit-open without hitting fetch
    let fetchWasCalledAfterCircuitOpen = false;
    const healthyFetch = async () => {
      fetchWasCalledAfterCircuitOpen = true;
      return new Response(JSON.stringify(["14.10.1"]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
    globalThis.fetch = healthyFetch as unknown as typeof fetch;

    await expect(c.getVersions()).rejects.toMatchObject({ kind: "circuit-open" });
    expect(fetchWasCalledAfterCircuitOpen).toBe(false);
    c.destroy();
  });

  // --- JSON parse error ---

  test("returns parse error when response is not JSON", async () => {
    globalThis.fetch = makeMockFetch(
      new Response("not json at all", { status: 200, headers: { "Content-Type": "text/html" } })
    ) as typeof fetch;

    await expect(client.getVersions()).rejects.toMatchObject({ kind: "parse" });
  });

  // --- abortSignal ---

  test("respects an external AbortSignal to cancel the request", async () => {
    const controller = new AbortController();

    // A mock that throws AbortError immediately when the signal fires.
    // This mirrors how a real fetch would respond to abort.
    const abortingFetch = async (_url: string, init?: RequestInit) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        throw new DOMException("aborted", "AbortError");
      }
      // Attach abort handler before returning so we catch the event.
      return new Promise((_resolve, reject) => {
        if (signal) {
          signal.addEventListener(
            "abort",
            () => reject(new DOMException("aborted", "AbortError")),
            { once: true }
          );
        }
        // Resolve after a short delay to give the abort time to fire.
        setTimeout(
          () => reject(new DOMException("Timed out waiting for abort", "AbortError")),
          200
        );
      });
    };
    globalThis.fetch = abortingFetch as unknown as typeof fetch;

    const promise = client.getVersions(controller.signal);
    // Abort immediately — the mock will catch this via the signal listener.
    controller.abort();

    await expect(promise).rejects.toMatchObject({ kind: "timeout" });
  });
});