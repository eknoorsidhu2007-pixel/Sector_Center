/**
 * Text normalization for the news pipeline.
 *
 * Two levels of cleaning exist on purpose:
 *
 * - `cleanForDisplay` is conservative. It fixes mojibake and HTML entities that
 *   Finnhub occasionally ships ("Google??s", "&amp;") but otherwise leaves the
 *   publisher's headline alone, because this is what users read.
 *
 * - `normalizeForMatching` is aggressive. It produces the lowercase,
 *   punctuation-free form that relevance scoring, classification, and
 *   clustering all compare against, so possessives ("Apple's"), smart quotes,
 *   and mojibake never break a match.
 */

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  lsquo: "'",
  rsquo: "'",
  ldquo: '"',
  rdquo: '"',
  hellip: "…",
};

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (raw, entity: string) => {
    const key = entity.toLowerCase();

    if (key.startsWith("#x")) {
      const code = Number.parseInt(key.slice(2), 16);
      return Number.isNaN(code) ? raw : String.fromCodePoint(code);
    }

    if (key.startsWith("#")) {
      const code = Number.parseInt(key.slice(1), 10);
      return Number.isNaN(code) ? raw : String.fromCodePoint(code);
    }

    return NAMED_ENTITIES[key] ?? raw;
  });
}

/**
 * Finnhub's feed contains mangled UTF-8: smart quotes arrive as their
 * CP1252-misdecoded byte sequences (measured: U+00E2 U+0080 U+0099 for a
 * right single quote). A generic byte round-trip would corrupt legitimately
 * encoded accents, so only known sequences are mapped. A trailing "??"
 * between letters is treated as a possessive apostrophe.
 */
const MOJIBAKE_SEQUENCES: [RegExp, string][] = [
  [/\u00E2\u0080\u0099/g, "\u2019"],
  [/\u00E2\u0080\u0098/g, "\u2018"],
  [/\u00E2\u0080\u009C/g, "\u201C"],
  [/\u00E2\u0080\u009D/g, "\u201D"],
  [/\u00E2\u0080\u0094/g, "\u2014"],
  [/\u00E2\u0080\u0093/g, "\u2013"],
  [/\u00E2\u0080\u00A6/g, "\u2026"],
  [/\u00E2\u0082\u00AC/g, "\u20AC"],
  [/\u00E2\u0084\u00A2/g, "\u2122"],
  [/\u00C3\u00A9/g, "\u00E9"],
  [/\u00C3\u00A8/g, "\u00E8"],
  [/\u00C3\u00A0/g, "\u00E0"],
  [/\u00C3\u00A7/g, "\u00E7"],
  [/\u00C3\u00B6/g, "\u00F6"],
  [/\u00C3\u00BC/g, "\u00FC"],
  [/\u00C3\u00B1/g, "\u00F1"],
];

export function fixMojibake(text: string): string {
  // Ordered map application, then the vaguer fallback patterns.
  let fixed = text;

  for (const [pattern, replacement] of MOJIBAKE_SEQUENCES) {
    fixed = fixed.replace(pattern, replacement);
  }

  return fixed
    .replace(/([A-Za-z])(?:\uFFFD\?\?|\?\?)([a-z])/g, "$1'$2")
    .replace(/\uFFFD+/g, "")
    .replace(/\?\?/g, " ");
}

export function cleanForDisplay(text: string): string {
  return fixMojibake(decodeHtmlEntities(text))
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lowercases, folds possessives ("apple's" -> "apple"), and turns every run of
 * non-alphanumerics into a single space, so "AT&T" becomes "at t" and
 * "Lowe's" becomes "lowe". Word-boundary regexes run against this form.
 */
export function normalizeForMatching(text: string): string {
  return cleanForDisplay(text)
    .toLowerCase()
    .replace(/['\u2019`]s\b/g, "")
    .replace(/['\u2019`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Headline prefixes/suffixes that carry no story content. Stripped before
 * clustering so "UPDATE: X" and "X - Bloomberg" still match "X".
 */
const LEADING_LABEL = /^(?:breaking|update|updated|just in|exclusive|watch|quick spark|video|podcast|analysis)\s*[:\-–—]\s*/i;
const TRAILING_ATTRIBUTION =
  /\s*[-–—(]\s*(?:bloomberg|reuters|cnbc|benzinga|seeking\s?alpha|wsj|barron'?s|marketwatch|financial times|the information|dow jones|press release)\)?\.?\s*$/i;

export function normalizeHeadline(headline: string): string {
  let text = cleanForDisplay(headline);
  text = text.replace(LEADING_LABEL, "");
  text = text.replace(TRAILING_ATTRIBUTION, "");
  return normalizeForMatching(text);
}

/** Extremely common words; excluded from similarity and distinctiveness. */
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for",
  "from", "had", "has", "have", "he", "her", "here", "heres", "his", "how",
  "i", "if", "in", "into", "is", "it", "its", "me", "my", "no", "not", "now",
  "of", "on", "or", "our", "over", "s", "she", "so", "than", "that", "the",
  "their", "them", "they", "this", "to", "too", "under", "up", "us", "was",
  "we", "were", "what", "whats", "when", "who", "why", "will", "with", "you",
  "your", "after", "ahead", "again", "all", "amid", "back", "before", "being",
  "could", "did", "do", "does", "doesnt", "dont", "down", "during", "each",
  "first", "get", "gets", "go", "going", "got", "just", "know", "last",
  "like", "make", "makes", "may", "might", "more", "most", "much", "must",
  "need", "needs", "never", "new", "next", "off", "old", "once", "one", "only",
  "out", "own", "part", "per", "said", "say", "says", "see", "sees", "set",
  "sets", "should", "some", "still", "take", "takes", "then", "there",
  "these", "thing", "things", "think", "those", "through", "told", "took",
  "two", "upon", "very", "want", "wants", "way", "well", "went", "while",
  "without", "would", "year", "years", "yet",
]);

/**
 * News-domain words that appear in every story of a given type. They are real
 * words (so they stay in similarity sets) but two articles sharing only these
 * have NOT been shown to be about the same event.
 */
const GENERIC_NEWS_TOKENS = new Set([
  "stock", "stocks", "share", "shares", "market", "markets", "wall", "street",
  "investor", "investors", "investing", "analyst", "analysts", "earnings",
  "revenue", "profit", "profits", "sales", "growth", "report", "reports",
  "reported", "quarter", "quarterly", "results", "price", "prices", "target",
  "rating", "upgrade", "upgrades", "downgrade", "downgrades", "buy", "sell",
  "hold", "ceo", "cfo", "coo", "cto", "chief", "executive", "officer",
  "company", "companies", "firm", "firms", "business", "deal", "deals",
  "lawsuit", "lawsuits", "court", "case", "federal", "judge", "trial",
  "settlement", "sec", "ftc", "doj", "probe", "billion", "millions", "week",
  "today", "monday", "tuesday", "wednesday", "thursday", "friday", "session",
  "update", "breaking", "watch", "video", "exclusive", "interview", "talks",
  "announces", "announced", "launch", "launches", "launched", "new", "news",
  "high", "low", "big", "top", "best", "worst", "day", "days", "time",
  "times", "year", "years", "plan", "plans", "move", "moves", "future",
  "starts", "ends", "end", "era", "real", "test", "question", "questions",
]);

export function tokenize(normalized: string): string[] {
  return normalized
    .split(" ")
    .filter((token) => token.length > 1 && !STOPWORDS.has(token));
}

export function tokenSet(normalized: string): Set<string> {
  return new Set(tokenize(normalized));
}

/**
 * Tokens that can serve as evidence that two headlines describe the same
 * event: longer, non-generic, and not about the company itself (every article
 * in the feed shares the company tokens, so they prove nothing).
 */
export function distinctiveTokens(
  tokens: Set<string>,
  companyTokens: Set<string>
): Set<string> {
  const result = new Set<string>();

  for (const token of tokens) {
    if (token.length >= 4 && !GENERIC_NEWS_TOKENS.has(token) && !companyTokens.has(token)) {
      result.add(token);
    }
  }

  return result;
}

/**
 * Strips legal/structural suffixes from a listed company name so "APPLE INC"
 * matches "Apple" and "LOWE'S COS" matches "Lowe's". Returns null when nothing
 * usable remains.
 */
const NAME_SUFFIXES = new Set([
  "inc", "corp", "corporation", "co", "company", "ltd", "llc", "lp", "llp",
  "holdings", "holding", "group", "plc", "cl", "class", "cos", "sa", "ag",
  "nv", "se", "new", "del", "a", "b", "the",
]);

export function coreCompanyName(rawName: string): string | null {
  const tokens = rawName
    .split(/[\s,]+/)
    .filter(Boolean);

  while (tokens.length > 1 && NAME_SUFFIXES.has(tokens[tokens.length - 1].toLowerCase().replace(/[^a-z0-9]/g, ""))) {
    tokens.pop();
  }

  while (tokens.length > 1 && tokens[0].toLowerCase() === "the") {
    tokens.shift();
  }

  const core = tokens.join(" ").trim();

  return core.length >= 2 ? core : null;
}

/**
 * Builds a word-boundary regex for a normalized multi-word phrase, allowing
 * flexible whitespace between tokens ("bank of america", "at t").
 */
export function phrasePattern(normalizedPhrase: string): RegExp {
  const escaped = normalizedPhrase
    .split(" ")
    .filter(Boolean)
    .map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  return new RegExp(`\\b${escaped.join("\\s+")}\\b`);
}

/**
 * Case-sensitive ticker match with manual boundaries. A ticker only counts
 * when it appears in ALL-CAPS, not touching other letters, digits, or hyphens
 * — so "T-Mobile" never matches T and "apple" never matches AAPL.
 */
export function containsTicker(text: string, symbol: string): boolean {
  let from = 0;

  while (from <= text.length - symbol.length) {
    const at = text.indexOf(symbol, from);

    if (at === -1) {
      return false;
    }

    const before = at > 0 ? text[at - 1] : " ";
    const after = at + symbol.length < text.length ? text[at + symbol.length] : " ";
    const boundaryBefore = !/[A-Za-z0-9\-]/.test(before);
    const boundaryAfter = !/[A-Za-z0-9\-]/.test(after);

    if (boundaryBefore && boundaryAfter) {
      return true;
    }

    from = at + 1;
  }

  return false;
}
