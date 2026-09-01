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

export interface NewsResponse {
  symbol: string;
  count: number;
  articles: NewsArticle[];
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
