/**
 * Deterministic relevance scoring for the company news feed.
 *
 * Finnhub's company-news tagging is association-based (index membership,
 * sector adjacency, ownership links), so roughly half of what it returns for a
 * mega-cap never mentions the company in the headline or summary at all. The
 * only reliable in-payload signals are the headline, the summary (weak — it is
 * often an attribution stub), the source, and the timestamp. This module
 * combines them into a score and, more importantly, a TIER.
 *
 * Nothing is ever deleted for scoring poorly: "peripheral" articles are
 * demoted to a collapsed UI section. A scoring mistake is a ranking blemish,
 * not a missing story.
 */

import { aliasesFor, COMPANY_ALIASES, DANGEROUS_TICKERS } from "./aliases";
import {
  containsTicker,
  coreCompanyName,
  normalizeForMatching,
  phrasePattern,
  tokenSet,
} from "./text";
import type { NewsArticle } from "../types";

export type RelevanceTier = "primary" | "secondary" | "peripheral";

export interface ScoredArticle extends NewsArticle {
  relevanceTier: RelevanceTier;
  /** Internal only — kept for server logs/tests, never serialized to the client. */
  relevanceScore: number;
  matchedOn: string[];
}

export interface RelevanceContext {
  symbol: string;
  /** Display-quality company name ("Apple"), from the search index or the curated map. */
  companyName: string | null;
  /** Company-identifying tokens; clustering uses these to ignore shared company words. */
  companyTokens: Set<string>;
  namePattern: RegExp | null;
  strongAliasPatterns: RegExp[];
  weakAliasPatterns: RegExp[];
  symbolIsDangerous: boolean;
}

const normalizePhrase = (phrase: string) => normalizeForMatching(phrase);

export function buildRelevanceContext(
  symbol: string,
  rawCompanyName: string | null
): RelevanceContext {
  const curated = aliasesFor(symbol);
  const coreFromIndex = rawCompanyName ? coreCompanyName(rawCompanyName) : null;
  const effectiveName = coreFromIndex ?? curated?.name ?? null;
  const normalizedName = effectiveName ? normalizePhrase(effectiveName) : null;

  const companyTokens = new Set<string>();

  if (normalizedName) {
    for (const token of tokenSet(normalizedName)) {
      companyTokens.add(token);
    }
  }

  for (const token of tokenSet(normalizePhrase(symbol))) {
    companyTokens.add(token);
  }

  for (const alias of [...(curated?.strong ?? []), ...(curated?.weak ?? [])]) {
    for (const token of tokenSet(normalizePhrase(alias))) {
      companyTokens.add(token);
    }
  }

  return {
    symbol,
    companyName: effectiveName,
    companyTokens,
    namePattern:
      normalizedName && normalizedName.length >= 2
        ? phrasePattern(normalizedName)
        : null,
    strongAliasPatterns: (curated?.strong ?? [])
      .map(normalizePhrase)
      .filter((alias) => alias.length >= 2)
      .map(phrasePattern),
    weakAliasPatterns: (curated?.weak ?? [])
      .map(normalizePhrase)
      .filter((alias) => alias.length >= 2)
      .map(phrasePattern),
    symbolIsDangerous: DANGEROUS_TICKERS.has(symbol) || symbol.length <= 1,
  };
}

/**
 * Roundup/listicle templates. Measured against the live feed: ChartMill's
 * index-mover articles follow rigid daily templates, and they are the single
 * biggest source of irrelevant mega-cap articles. Matched on normalized text.
 */
const LISTICLE_PATTERNS: RegExp[] = [
  /\b\d+\s+(?:stocks|shares|etfs)\b/,
  /\b(?:top|best|worst)\b[^.]{0,40}\b(?:movers|gainers|losers|most active)\b/,
  /\bmost active\b/,
  /\b(?:gainers|losers)\s+(?:and|&)\s+(?:gainers|losers)\b/,
  /\bstocks to (?:watch|buy|sell|avoid|own)\b/,
  /\b(?:today|monday|tuesday|wednesday|thursday|friday)s session\b/,
  /\bstay informed\b/,
  /\bwall street (?:week ahead|brunch)\b/,
  /\bweek (?:ahead|in review)\b/,
];

export type SourceTier = 1 | 2 | 3;

const TIER1_SOURCES = new Set([
  "reuters", "bloomberg", "cnbc", "wsj", "wall street journal", "barron's",
  "barrons", "financial times", "ft", "marketwatch", "associated press", "ap",
  "dow jones", "the information",
]);

/** Sources whose output on this feed is essentially all index listicles. */
const TIER3_SOURCES = new Set(["chartmill", "unknown source"]);

export function sourceTier(source: string): SourceTier {
  const normalized = source.trim().toLowerCase();

  if (TIER1_SOURCES.has(normalized)) {
    return 1;
  }

  if (TIER3_SOURCES.has(normalized)) {
    return 3;
  }

  return 2;
}

/**
 * Patterns for every OTHER curated company, precompiled once. A headline
 * naming several other companies is a roundup even when it also names ours.
 */
const OTHER_COMPANY_MATCHERS: { name: string; patterns: RegExp[] }[] =
  Object.values(COMPANY_ALIASES).map((entry) => ({
    name: entry.name,
    patterns: [entry.name, ...entry.strong]
      .map(normalizePhrase)
      .filter((phrase) => phrase.length >= 2)
      .map(phrasePattern),
  }));

function countOtherCompanies(
  normalizedHeadline: string,
  ownName: string | null
): number {
  let count = 0;

  for (const matcher of OTHER_COMPANY_MATCHERS) {
    if (ownName && matcher.name === ownName) {
      continue;
    }

    if (matcher.patterns.some((pattern) => pattern.test(normalizedHeadline))) {
      count += 1;
    }
  }

  return count;
}

export function scoreArticle(
  article: NewsArticle,
  context: RelevanceContext
): ScoredArticle {
  const headlineForTicker = article.headline;
  const normalizedHeadline = normalizeForMatching(article.headline);
  const normalizedSummary = normalizeForMatching(article.summary);

  const matchedOn: string[] = [];
  let score = 0;

  const nameInHeadline = context.namePattern?.test(normalizedHeadline) ?? false;
  const nameInSummary = context.namePattern?.test(normalizedSummary) ?? false;
  const strongInHeadline = context.strongAliasPatterns.some((pattern) =>
    pattern.test(normalizedHeadline)
  );
  const strongInSummary = context.strongAliasPatterns.some((pattern) =>
    pattern.test(normalizedSummary)
  );
  const weakAnywhere = context.weakAliasPatterns.some(
    (pattern) => pattern.test(normalizedHeadline) || pattern.test(normalizedSummary)
  );
  const tickerInHeadline = containsTicker(headlineForTicker, context.symbol);
  const tickerInSummary = containsTicker(article.summary, context.symbol);

  if (nameInHeadline) {
    score += 4;
    matchedOn.push("name-in-headline");
  }

  if (!context.symbolIsDangerous && tickerInHeadline) {
    score += 4;
    matchedOn.push("ticker-in-headline");
  }

  if (strongInHeadline) {
    score += 3;
    matchedOn.push("alias-in-headline");
  }

  // A dangerous ticker ("NOW", "ALL", "T"...) never scores on its own. When
  // the company is independently confirmed, it adds a small confirming point.
  if (context.symbolIsDangerous && (tickerInHeadline || tickerInSummary)) {
    const corroborated =
      nameInHeadline || strongInHeadline || nameInSummary || strongInSummary || weakAnywhere;

    if (corroborated) {
      score += 1;
      matchedOn.push("ticker-corroborated");
    }
  }

  // Summaries on this feed are often attribution stubs ("- Reuters Citing
  // Legal Filing"), so a summary mention only matters when the headline is
  // otherwise silent about the company.
  const headlineSilent = !nameInHeadline && !strongInHeadline && !tickerInHeadline;
  const summaryMentions =
    nameInSummary ||
    strongInSummary ||
    (!context.symbolIsDangerous && tickerInSummary);

  if (headlineSilent && summaryMentions) {
    score += 1;
    matchedOn.push("summary-mention");
  }

  if (LISTICLE_PATTERNS.some((pattern) => pattern.test(normalizedHeadline))) {
    score -= 4;
    matchedOn.push("listicle-template");
  }

  const otherCompanies = countOtherCompanies(normalizedHeadline, context.companyName);

  if (otherCompanies >= 3) {
    score -= 4;
    matchedOn.push(`names-${otherCompanies}-other-companies`);
  } else if (otherCompanies === 2) {
    score -= 2;
    matchedOn.push("names-2-other-companies");
  }

  if (sourceTier(article.source) === 3) {
    score -= 1;
    matchedOn.push("low-tier-source");
  }

  const relevanceTier: RelevanceTier =
    score >= 4 ? "primary" : score >= 2 ? "secondary" : "peripheral";

  return { ...article, relevanceTier, relevanceScore: score, matchedOn };
}
