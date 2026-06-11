import type { DDragonError } from "../ddragon/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface McpErrorResponse {
  isError: true;
  code: string;
  message: string;
  data?: unknown;
}

// ---------------------------------------------------------------------------
// Error code constants
// ---------------------------------------------------------------------------

const CODE_NETWORK = "network";
const CODE_TIMEOUT = "timeout";
const CODE_HTTP = "http";
const CODE_CIRCUIT_OPEN = "circuit-open";
const CODE_PARSE = "parse";
const CODE_NOT_FOUND = "not-found";
const CODE_VALIDATION = "validation";
const CODE_INTERNAL = "internal";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Maps any thrown value to an MCP-formatted error response.
 * This is the single mapping boundary — no exception crosses to the MCP layer.
 *
 * Error codes (stable):
 *   not-found     — resource does not exist (404)
 *   ambiguous     — query matches multiple records
 *   network       — network failure
 *   timeout       — request timed out
 *   http          — HTTP error (5xx, 4xx)
 *   circuit-open  — circuit breaker is open
 *   parse         — JSON parse failure
 *   validation    — Zod / input validation failure
 *   internal      — unexpected error
 */
export function toMcpError(err: unknown): McpErrorResponse {
  // Handle DDragonError discriminated union
  if (isDDragonError(err)) {
    return mapDDragonError(err);
  }

  // Handle plain object with a known code field (e.g. ChampionAmbiguousError)
  if (isPlainObjectWithCode(err)) {
    return {
      isError: true,
      code: err.code,
      message: err.message,
    };
  }

  // Handle generic Error
  if (err instanceof Error) {
    // Detect Zod errors by name
    if (err.name === "ZodError" || isValidationError(err)) {
      return { isError: true, code: CODE_VALIDATION, message: err.message };
    }
    return { isError: true, code: CODE_INTERNAL, message: err.message };
  }

  // Fallback: unknown thrown value
  return {
    isError: true,
    code: CODE_INTERNAL,
    message: "An unexpected error occurred",
  };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isDDragonError(err: unknown): err is DDragonError {
  if (!isPlainObject(err)) return false;
  const e = err as Record<string, unknown>;
  return (
    e.kind !== undefined &&
    typeof e.kind === "string" &&
    e.message !== undefined &&
    typeof e.message === "string" &&
    [
      "network",
      "timeout",
      "http",
      "circuit-open",
      "parse",
      "not-found",
    ].includes(e.kind)
  );
}

function isPlainObjectWithCode(err: unknown): err is { code: string; message: string } {
  if (!isPlainObject(err)) return false;
  const e = err as Record<string, unknown>;
  return typeof e.code === "string" && typeof e.message === "string";
}

function isPlainObject(err: unknown): err is Record<string, unknown> {
  return err !== null && typeof err === "object" && !Array.isArray(err);
}

function isValidationError(err: Error): boolean {
  return (
    err.name === "ValidationError" ||
    err.message.includes("ZodError") ||
    err.message.includes("validation")
  );
}

function mapDDragonError(err: DDragonError): McpErrorResponse {
  switch (err.kind) {
    case "network":
      return {
        isError: true,
        code: CODE_NETWORK,
        message: err.message,
        data: err.cause !== undefined ? { cause: err.cause } : undefined,
      };
    case "timeout":
      return { isError: true, code: CODE_TIMEOUT, message: err.message };
    case "http":
      return { isError: true, code: CODE_HTTP, message: err.message };
    case "circuit-open":
      return { isError: true, code: CODE_CIRCUIT_OPEN, message: err.message };
    case "parse":
      return {
        isError: true,
        code: CODE_PARSE,
        message: err.message,
        data: err.cause !== undefined ? { cause: err.cause } : undefined,
      };
    case "not-found":
      return { isError: true, code: CODE_NOT_FOUND, message: err.message };
  }
}