/**
 * Ticker symbols: 1-10 characters, starting with a letter. Dots and hyphens are
 * allowed because US class shares use them (BRK.A, BRK.B).
 */
const SYMBOL_PATTERN = /^[A-Z][A-Z0-9.\-]{0,9}$/;

/** Uppercases and validates a user-supplied ticker. Returns null if invalid. */
export function normalizeSymbol(input: string | null | undefined): string | null {
  if (!input) {
    return null;
  }

  const candidate = input.trim().toUpperCase();

  return SYMBOL_PATTERN.test(candidate) ? candidate : null;
}
