/**
 * The seam between Sector Center and its market-data vendor.
 *
 * Route handlers and components depend on this interface, never on Finnhub
 * directly. The interface exposes what consumers need (a quote, a profile,
 * scored news) rather than how the vendor structures it (raw endpoints,
 * millions-denominated units, loose optional fields).
 *
 * A future vendor swap means writing a new implementation of this interface
 * and changing one line in `lib/market/index.ts`. Nothing else in the
 * application should need to change.
 */

import type { CompanyMatch, NewsArticle } from "../types";
import type { CompanyProfile, KeyMetrics, Quote } from "./types";

export interface MarketDataProvider {
  /** Real-time-ish price snapshot. */
  getQuote(symbol: string): Promise<Quote>;

  /** Static company metadata: name, exchange, industry, market cap, etc. */
  getProfile(symbol: string): Promise<CompanyProfile>;

  /** Computed fundamentals: P/E, 52-week range, beta, dividend yield, etc. */
  getKeyMetrics(symbol: string): Promise<KeyMetrics>;

  /**
   * Shaped, validated company news. Articles missing a headline, URL, or
   * timestamp are already dropped; the caller receives only renderable items.
   */
  getCompanyNews(symbol: string, lookbackDays: number): Promise<NewsArticle[]>;

  /**
   * Display name for a ticker ("Apple Inc"), resolved from the symbol
   * directory at zero extra upstream cost. Returns null when the directory
   * is unavailable or the symbol is not listed.
   */
  resolveCompanyName(symbol: string): Promise<string | null>;

  /**
   * Autocomplete search over the local symbol directory. A keystroke costs
   * no upstream request because the directory is already in memory.
   */
  searchCompanies(query: string, limit?: number): Promise<CompanyMatch[]>;
}
