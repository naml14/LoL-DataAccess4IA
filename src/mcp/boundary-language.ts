/**
 * Non-reasoning boundary language enforcement.
 *
 * The server MUST NOT synthesize fields that imply reasoning, preferences,
 * rankings, or recommendations. This module is the single source of truth
 * for all forbidden language detection.
 */

/**
 * Words and patterns the server never returns in any tool response,
 * tool description, or cached data.
 */
export const FORBIDDEN_WORDS: string[] = [
  // Rankings & ratings
  "best",
  "recommended",
  "recommendation",
  "tier",
  "optimal",
  "score",
  "winrate",
  "win rate",
  "pick rate",
  "ban rate",
  "meta",
  "strong",
  "broken",
  "op",
  // Buff/nerf language
  "buffed",
  "nerfed",
  // Subjective rankings
  "overrated",
  "underrated",
  "must-pick",
  "first-pick",
  "go-to",
  "top-tier",
  "S-tier",
  "A-tier",
  "B-tier",
  "C-tier",
  "D-tier",
  "build order",
  "pro build",
  "pro pick",
  // Additional reasoning-adjacent terms
  "priority",
];

/**
 * Compiled regex that matches any forbidden word with word boundaries.
 * Case-insensitive (`/i` flag).
 *
 * Uses `\b` word boundaries where the term is a standalone word, or
 * explicit spacing for multi-word terms.
 *
 * Special cases:
 * - "op" uses `\Bop\B` (non-word-boundary) to catch "op" as substring
 *   in words like "overpowered" while avoiding false matches in
 *   "hop", "top", "cop" etc.
 * - "score" uses negative lookahead `(?!\s+of\s+the)` to avoid matching
 *   "Score of the game" (neutral) while still catching "score of 9"
 *   and "score rating" (ranking language).
 */
export const FORBIDDEN_REGEX: RegExp = (() => {
  const patterns: string[] = [];

  for (const w of FORBIDDEN_WORDS) {
    if (w === "op") {
      // Non-word-boundary "op" — catches "op pick", "overpowered", "op champion"
      // but NOT "hop", "top", "cop" (these have word-boundary after 'p')
      patterns.push("\\Bop\\B");
    } else if (w === "score") {
      // "score" standalone word but NOT when followed by " of the"
      // (neutral: "Score of the game" / "what is the score of the game")
      patterns.push("\\bscore(?!\\s+of\\s+the)\\b");
    } else if (w.includes(" ")) {
      // Multi-word: match literal phrase
      patterns.push(w);
    } else {
      // Default: word-boundary wrapped
      patterns.push(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`);
    }
  }

  return new RegExp(patterns.join("|"), "gi");
})();

/**
 * Assert that a text string contains no forbidden language.
 * Throws an Error with the offending match and source label if any
 * forbidden term is found.
 *
 * @param text - The text to scan (response JSON, description, etc.)
 * @param source - Human-readable label for error reporting (e.g. "list_champions response")
 * @throws Error if any forbidden term is found
 */
export function assertNoForbiddenLanguage(text: string, source: string): void {
  FORBIDDEN_REGEX.lastIndex = 0;
  const match = FORBIDDEN_REGEX.exec(text);
  if (match !== null) {
    throw new Error(
      `Forbidden language detected in ${source}: "${match[0]}" ` +
        `(position ${match.index}). Forbidden terms: ${FORBIDDEN_WORDS.join(", ")}`
    );
  }
}