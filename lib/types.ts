/**
 * Shared domain types.
 *
 * These describe Sector Center's own API shape, deliberately decoupled from
 * Finnhub's field names so provider changes stay inside `lib/finnhub.ts`.
 */

export interface NewsArticle {
  id: number;
  headline: string;
  summary: string;
  url: string;
  source: string;
  imageUrl: string | null;
  publishedAt: string;
}

export type NewsEventType =
  | "earnings"
  | "guidance"
  | "mna"
  | "regulatory"
  | "management"
  | "analyst"
  | "product"
  | "partnership"
  | "capital-return"
  | "layoffs"
  | "macro"
  | "opinion"
  | "other";

/** "peripheral" never appears on a story — peripheral articles are sent flat. */
export type StoryRelevance = "primary" | "secondary";

export type NewsCoverage = "normal" | "light" | "none";

/**
 * A cluster of near-duplicate articles treated as one story. `headline`,
 * `summary`, `url`, and `source` come from the representative article (best
 * source, then earliest); `publishedAt` is the FIRST report and
 * `latestPublishedAt` the most recent write-up in the cluster.
 */
export interface NewsStory {
  id: string;
  headline: string;
  summary: string;
  url: string;
  source: string;
  imageUrl: string | null;
  publishedAt: string;
  latestPublishedAt: string;
  relevance: StoryRelevance;
  eventTypes: NewsEventType[];
  sourceCount: number;
  sources: string[];
  /** All clustered articles, newest first, including the representative. */
  articles: NewsArticle[];
}

export interface NewsResponse {
  symbol: string;
  /** Display name resolved from the search index, or null when unavailable. */
  companyName: string | null;
  /** Lookback window actually used, in days, so the UI can state it honestly. */
  lookbackDays: number;
  /** Number of ranked stories (clusters) in the main feed. */
  count: number;
  /** Total valid articles Finnhub returned before any scoring. */
  totalArticles: number;
  stories: NewsStory[];
  /** Tangential articles (listicles, roundups), capped, newest first. */
  peripheral: NewsArticle[];
  /** Total peripheral articles, including any beyond the `peripheral` cap. */
  peripheralCount: number;
  coverage: NewsCoverage;
}

export interface CompanyMatch {
  symbol: string;
  displaySymbol: string;
  name: string;
  exchange: string;
  type: string;
}

export interface SearchResponse {
  query: string;
  results: CompanyMatch[];
}

export interface ApiErrorResponse {
  error: string;
}
