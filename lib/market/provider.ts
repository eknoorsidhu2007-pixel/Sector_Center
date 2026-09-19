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
import type {
  Candle,
  CandleRange,
  CompanyProfile,
  EarningsEvent,
  EarningsSurprise,
  FinancialReport,
  GovernmentContract,
  InsiderSentimentPoint,
  InsiderTransaction,
  KeyMetrics,
  Quote,
  RecommendationTrend,
  SecFiling,
} from "./types";

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

  /**
   * OHLC candles for charting. Not every vendor supports this on every plan;
   * implementations that cannot serve candles should throw an error with a
   * clear message rather than returning an empty array.
   */
  getCandles(symbol: string, range: CandleRange): Promise<Candle[]>;

  /** Peer tickers in the same country and sub-industry. */
  getPeers(symbol: string): Promise<string[]>;

  /**
   * Insider transactions from Form 3/4/5, newest first. Each entry carries the
   * raw SEC transaction code plus a semantic `kind`, so callers can separate
   * conviction trades from compensation mechanics.
   */
  getInsiderTransactions(
    symbol: string,
    lookbackDays: number
  ): Promise<InsiderTransaction[]>;

  /** Monthly insider sentiment (MSPR), newest first. */
  getInsiderSentiment(
    symbol: string,
    lookbackMonths: number
  ): Promise<InsiderSentimentPoint[]>;

  /** Recent SEC filings, newest first. */
  getFilings(symbol: string, limit?: number): Promise<SecFiling[]>;

  /**
   * Financial statements exactly as the company tagged them, newest first.
   * Values are never normalized across filers; labels and concepts are the
   * filer's own.
   */
  getFinancialReports(
    symbol: string,
    frequency: "annual" | "quarterly",
    limit?: number
  ): Promise<FinancialReport[]>;

  /** Historical quarterly EPS surprises, newest first. */
  getEarningsSurprises(symbol: string): Promise<EarningsSurprise[]>;

  /**
   * Earnings releases in a window around today. Negative `pastDays` and
   * positive `futureDays` bracket the search.
   */
  getEarningsCalendar(
    symbol: string,
    pastDays: number,
    futureDays: number
  ): Promise<EarningsEvent[]>;

  /** Analyst recommendation counts by period, newest first. */
  getRecommendations(symbol: string): Promise<RecommendationTrend[]>;

  /** US federal contract awards, newest first. */
  getGovernmentContracts(
    symbol: string,
    lookbackDays: number
  ): Promise<GovernmentContract[]>;
}
