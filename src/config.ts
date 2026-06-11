import { z } from "zod";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const LogLevelSchema = z.enum(["debug", "info", "warn", "error"]);

const ConfigSchema = z.object({
  locale: z.string().default("en_US"),
  ttlSeconds: z
    .number()
    .int()
    .min(60, `LOL_DD_TTL_SECONDS must be between 60 and 86400, got`)
    .max(86400, `LOL_DD_TTL_SECONDS must be between 60 and 86400, got`)
    .default(900),
  pinVersion: z.string().nullable().default(null),
  cacheDir: z.string().default("./.cache/ddragon"),
  httpTimeoutMs: z
    .number()
    .int()
    .min(100, `LOL_DD_HTTP_TIMEOUT_MS must be between 100 and 60000, got`)
    .max(60000, `LOL_DD_HTTP_TIMEOUT_MS must be between 100 and 60000, got`)
    .default(5000),
  logLevel: LogLevelSchema.default("info"),
});

type Config = z.infer<typeof ConfigSchema>;

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

function parseInteger(raw: unknown, _name: string): number | undefined {
  if (
    typeof raw === "undefined" ||
    raw === null ||
    raw === "" ||
    raw === "undefined"
  ) {
    return undefined; // let Zod default handle it
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    throw new Error(`${_name} must be a valid integer, got "${raw}"`);
  }
  return n;
}

function parseLogLevel(raw: unknown): z.infer<typeof LogLevelSchema> | undefined {
  if (typeof raw === "undefined" || raw === null || raw === "") {
    return undefined; // let Zod default handle it
  }
  if (typeof raw !== "string") {
    throw new Error(
      `LOL_DD_LOG_LEVEL must be one of debug, info, warn, error; got "${raw}"`
    );
  }
  const result = LogLevelSchema.safeParse(raw.toLowerCase());
  if (!result.success) {
    const allowed = ["debug", "info", "warn", "error"];
    throw new Error(
      `LOL_DD_LOG_LEVEL must be one of ${allowed.join(", ")}; got "${raw}"`
    );
  }
  return result.data;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function loadConfig(): Readonly<Config> {
  // Only include keys that are actually set — Zod .default() only applies
  // when the key is absent from the input object, not when the value is undefined.
  const raw: Record<string, unknown> = {};

  if (process.env.LOL_DD_LOCALE !== undefined) {
    raw.locale = process.env.LOL_DD_LOCALE;
  }

  const ttlRaw = process.env.LOL_DD_TTL_SECONDS;
  if (ttlRaw !== undefined && ttlRaw !== "") {
    raw.ttlSeconds = parseInteger(ttlRaw, "LOL_DD_TTL_SECONDS");
  }

  const pinRaw = process.env.LOL_DD_PIN_VERSION;
  if (pinRaw !== undefined && pinRaw !== "") {
    raw.pinVersion = pinRaw;
  }

  if (process.env.LOL_DD_CACHE_DIR !== undefined) {
    raw.cacheDir = process.env.LOL_DD_CACHE_DIR;
  }

  const timeoutRaw = process.env.LOL_DD_HTTP_TIMEOUT_MS;
  if (timeoutRaw !== undefined && timeoutRaw !== "") {
    raw.httpTimeoutMs = parseInteger(timeoutRaw, "LOL_DD_HTTP_TIMEOUT_MS");
  }

  const logRaw = process.env.LOL_DD_LOG_LEVEL;
  if (logRaw !== undefined && logRaw !== "") {
    raw.logLevel = parseLogLevel(logRaw);
  }

  const result = ConfigSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues;
    const first = issues[0];
    const msg =
      first.message +
      " " +
      ("received" in first && first.received !== undefined ? `"${first.received}" ` : "") +
      (first.path.length > 0 ? `(at ${first.path.join(".")}) ` : "") +
      (first.code === "custom" ? first.message : `(${first.code})`);
    throw new Error(msg);
  }

  // Return a deep-frozen object to prevent accidental mutation at runtime.
  return deepFreeze(result.data) as Readonly<Config>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  // Freeze arrays and objects recursively
  const frozen = Array.isArray(obj) ? [...obj] : { ...obj };
  for (const key of Object.keys(frozen as object)) {
    (frozen as Record<string, unknown>)[key] = deepFreeze(
      (frozen as Record<string, unknown>)[key]
    );
  }
  return Object.freeze(frozen) as T;
}