/** Tokens that should stay uppercase when title-casing a company name. */
const PRESERVED_TOKENS = new Set([
  "REIT",
  "ETF",
  "ETN",
  "USA",
  "US",
  "U.S.",
  "UK",
  "AG",
  "NV",
  "SA",
  "PLC",
  "LP",
  "L.P.",
  "LLC",
  "AI",
  "II",
  "III",
  "IV",
  "VI",
  "VII",
]);

/** Words that stay lowercase inside a name, but not in first position. */
const MINOR_WORDS = new Set([
  "of",
  "and",
  "the",
  "for",
  "in",
  "on",
  "at",
  "to",
  "a",
  "an",
  "or",
  "de",
  "van",
]);

function titleCaseWord(word: string): string {
  if (!word) {
    return word;
  }

  const upper = word.toUpperCase();

  if (PRESERVED_TOKENS.has(upper) || upper.length === 1) {
    return upper;
  }

  return word.charAt(0).toUpperCase() + word.slice(1);
}

/**
 * Finnhub's symbol listing returns names in all-caps ("APPLE INC"), which reads
 * as shouting in a UI. Names that already contain lowercase are left untouched.
 */
export function formatCompanyName(raw: string): string {
  if (/[a-z]/.test(raw)) {
    return raw;
  }

  let wordIndex = 0;

  return raw
    .toLowerCase()
    .split(/(\s+)/)
    .map((part) => {
      if (/^\s+$/.test(part)) {
        return part;
      }

      const isFirstWord = wordIndex === 0;
      wordIndex += 1;

      // Single letters are share classes ("Inc-Cl A"), not minor words.
      if (!isFirstWord && part.length > 1 && MINOR_WORDS.has(part)) {
        return part;
      }

      return part.split("-").map(titleCaseWord).join("-");
    })
    .join("");
}

const MINUTE = 60;
const HOUR = MINUTE * 60;
const DAY = HOUR * 24;

/** Compact age label for news cards, e.g. "just now", "42m ago", "3d ago". */
export function formatRelativeTime(
  isoDate: string,
  now: Date = new Date()
): string {
  const published = new Date(isoDate);

  if (Number.isNaN(published.getTime())) {
    return "";
  }

  const seconds = Math.max(0, Math.round((now.getTime() - published.getTime()) / 1000));

  if (seconds < MINUTE) {
    return "just now";
  }

  if (seconds < HOUR) {
    return `${Math.floor(seconds / MINUTE)}m ago`;
  }

  if (seconds < DAY) {
    return `${Math.floor(seconds / HOUR)}h ago`;
  }

  const days = Math.floor(seconds / DAY);

  return days === 1 ? "1d ago" : `${days}d ago`;
}

/** Full timestamp for the `title` attribute behind a relative label. */
export function formatAbsoluteTime(isoDate: string): string {
  const published = new Date(isoDate);

  if (Number.isNaN(published.getTime())) {
    return "";
  }

  return published.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
