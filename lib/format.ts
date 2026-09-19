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

// -- Financial formatting ----------------------------------------------------

const UNAVAILABLE = "—";

/** "$232.48" or "—" when the provider returned no value. */
export function formatPrice(
  value: number | null,
  currency: string | null = "USD"
): string {
  if (value === null) {
    return UNAVAILABLE;
  }

  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency ?? "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/** "+3.21" or "-1.45", preserving the sign for the UI. */
export function formatChange(value: number | null): string {
  if (value === null) {
    return UNAVAILABLE;
  }

  return (value >= 0 ? "+" : "") + value.toFixed(2);
}

/** "+1.40%" or "-0.62%". */
export function formatChangePercent(value: number | null): string {
  if (value === null) {
    return UNAVAILABLE;
  }

  return (value >= 0 ? "+" : "") + value.toFixed(2) + "%";
}

const TRILLION = 1_000_000_000_000;
const BILLION = 1_000_000_000;
const MILLION = 1_000_000;

/** "$3.45T", "$847.2B", "$12.3M" — compact large-number label. */
export function formatLargeNumber(
  value: number | null,
  currency: string | null = "USD"
): string {
  if (value === null) {
    return UNAVAILABLE;
  }

  const prefix = currency === "USD" ? "$" : "";
  const abs = Math.abs(value);

  if (abs >= TRILLION) {
    return `${prefix}${(value / TRILLION).toFixed(2)}T`;
  }

  if (abs >= BILLION) {
    return `${prefix}${(value / BILLION).toFixed(1)}B`;
  }

  if (abs >= MILLION) {
    return `${prefix}${(value / MILLION).toFixed(1)}M`;
  }

  return formatPrice(value, currency);
}

/** "45.2M", "1.2B" — share/volume counts without a currency symbol. */
export function formatVolume(value: number | null): string {
  if (value === null) {
    return UNAVAILABLE;
  }

  const abs = Math.abs(value);

  if (abs >= BILLION) {
    return `${(value / BILLION).toFixed(1)}B`;
  }

  if (abs >= MILLION) {
    return `${(value / MILLION).toFixed(1)}M`;
  }

  return value.toLocaleString();
}

/** "35.42" — plain ratio, two decimal places. */
export function formatRatio(value: number | null): string {
  if (value === null) {
    return UNAVAILABLE;
  }

  return value.toFixed(2);
}

/** "0.51%" — a percentage value that is already in percent units. */
export function formatPercentValue(value: number | null): string {
  if (value === null) {
    return UNAVAILABLE;
  }

  return value.toFixed(2) + "%";
}

/** "Sep 18, 2026" — short date for 52-week high/low dates. */
export function formatDateValue(isoDate: string | null): string {
  if (!isoDate) {
    return UNAVAILABLE;
  }

  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return UNAVAILABLE;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
