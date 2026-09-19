/**
 * Finnhub implementation of MarketDataProvider.
 *
 * This is the only module outside `lib/finnhub.ts` that knows Finnhub's
 * endpoint paths, field names, and unit conventions. It maps raw Finnhub
 * responses into Sector Center domain types:
 *
 * - Optional Finnhub fields become `null` (never zero, never estimated).
 * - Finnhub's millions-denominated fields (market cap, share counts, average
 *   volumes) are multiplied by 1,000,000 so consumers see actual values.
 * - `marketCapitalization` comes from `/stock/profile2`, not `/stock/metric`.
 *   Both exist and they disagree (they are computed at different times);
 *   profile2 is the canonical source so the header and any future detail
 *   page stay consistent.
 *
 * Caching policy lives in the `revalidate` option passed to `finnhubFetch`,
 * which uses the Next.js data cache. An in-memory coalescing layer sits on
 * top in `lib/market/cache.ts`.
 */

import { finnhubFetch } from "../finnhub";
import { getSymbolIndex, searchCompanies } from "../symbols";
import { cleanForDisplay } from "../news/text";
import type { CompanyMatch, NewsArticle } from "../types";
import type { MarketDataProvider } from "./provider";
import type { CompanyProfile, KeyMetrics, Quote } from "./types";

const MILLION = 1_000_000;

// -- Finnhub response shapes (what the wire actually looks like) ------------

interface FinnhubQuote {
  c?: number; // current
  d?: number; // change
  dp?: number; // change percent
  o?: number; // open
  h?: number; // high
  l?: number; // low
  pc?: number; // previous close
  t?: number; // unix seconds
}

interface FinnhubProfile {
  ticker?: string;
  name?: string;
  exchange?: string;
  finnhubIndustry?: string;
  country?: string;
  currency?: string;
  ipo?: string;
  marketCapitalization?: number; // millions
  shareOutstanding?: number; // millions
  floatingShare?: number; // millions
  logo?: string;
  weburl?: string;
}

interface FinnhubMetricResponse {
  metric?: {
    "52WeekHigh"?: number;
    "52WeekLow"?: number;
    "52WeekHighDate"?: string;
    "52WeekLowDate"?: string;
    peTTM?: number;
    peBasicExclExtraTTM?: number;
    epsTTM?: number;
    epsBasicExclExtraItemsTTM?: number;
    dividendYieldIndicatedAnnual?: number;
    beta?: number;
    "10DayAverageTradingVolume"?: number; // millions
    "3MonthAverageTradingVolume"?: number; // millions
  };
}

interface FinnhubNewsItem {
  id?: number;
  headline?: string;
  summary?: string;
  url?: string;
  source?: string;
  image?: string;
  datetime?: number;
}

// -- Mapping helpers ---------------------------------------------------------

/** Returns null for missing, non-finite, or non-number values. */
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Returns null for missing or empty strings. */
function str(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function toDateParam(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Finnhub returns a loose array; anything without a headline, URL, or usable
 * timestamp is unrenderable, so it is dropped rather than passed to the client.
 * Headlines/summaries are display-cleaned here (entities, mojibake) so every
 * downstream step sees tidy text.
 */
function toArticle(item: FinnhubNewsItem): NewsArticle | null {
  const headline = item.headline?.trim();
  const url = item.url?.trim();

  if (!headline || !url || typeof item.datetime !== "number" || item.datetime <= 0) {
    return null;
  }

  return {
    id: typeof item.id === "number" ? item.id : item.datetime,
    headline: cleanForDisplay(headline),
    summary: cleanForDisplay(item.summary?.trim() ?? ""),
    url,
    source: item.source?.trim() || "Unknown source",
    imageUrl: item.image?.trim() || null,
    publishedAt: new Date(item.datetime * 1000).toISOString(),
  };
}

// -- Provider ----------------------------------------------------------------

export const finnhubProvider: MarketDataProvider = {
  async getQuote(symbol: string): Promise<Quote> {
    const raw = await finnhubFetch<FinnhubQuote>(
      "/quote",
      { symbol },
      { revalidate: 60 }
    );

    return {
      currentPrice: num(raw.c),
      change: num(raw.d),
      changePercent: num(raw.dp),
      open: num(raw.o),
      high: num(raw.h),
      low: num(raw.l),
      previousClose: num(raw.pc),
      timestamp:
        typeof raw.t === "number" && raw.t > 0
          ? new Date(raw.t * 1000).toISOString()
          : null,
    };
  },

  async getProfile(symbol: string): Promise<CompanyProfile> {
    const raw = await finnhubFetch<FinnhubProfile>(
      "/stock/profile2",
      { symbol },
      { revalidate: 86_400 } // 24h — effectively static
    );

    const marketCapMillions = num(raw.marketCapitalization);
    const sharesMillions = num(raw.shareOutstanding);
    const floatMillions = num(raw.floatingShare);

    return {
      ticker: str(raw.ticker) ?? symbol,
      name: str(raw.name),
      exchange: str(raw.exchange),
      industry: str(raw.finnhubIndustry),
      country: str(raw.country),
      currency: str(raw.currency),
      ipoDate: str(raw.ipo),
      marketCap: marketCapMillions !== null ? marketCapMillions * MILLION : null,
      sharesOutstanding: sharesMillions !== null ? sharesMillions * MILLION : null,
      floatingShares: floatMillions !== null ? floatMillions * MILLION : null,
      logoUrl: str(raw.logo),
      webUrl: str(raw.weburl),
    };
  },

  async getKeyMetrics(symbol: string): Promise<KeyMetrics> {
    const raw = await finnhubFetch<FinnhubMetricResponse>(
      "/stock/metric",
      { symbol, metric: "all" },
      { revalidate: 21_600 } // 6h — fundamentals move slowly
    );

    const metric = raw.metric ?? {};
    const vol10 = num(metric["10DayAverageTradingVolume"]);
    const vol3m = num(metric["3MonthAverageTradingVolume"]);

    return {
      week52High: num(metric["52WeekHigh"]),
      week52Low: num(metric["52WeekLow"]),
      week52HighDate: str(metric["52WeekHighDate"]),
      week52LowDate: str(metric["52WeekLowDate"]),
      peRatioTTM: num(metric.peTTM) ?? num(metric.peBasicExclExtraTTM),
      epsTTM: num(metric.epsTTM) ?? num(metric.epsBasicExclExtraItemsTTM),
      dividendYieldAnnual: num(metric.dividendYieldIndicatedAnnual),
      beta: num(metric.beta),
      avgVolume10Day: vol10 !== null ? vol10 * MILLION : null,
      avgVolume3Month: vol3m !== null ? vol3m * MILLION : null,
    };
  },

  async getCompanyNews(symbol: string, lookbackDays: number): Promise<NewsArticle[]> {
    const to = new Date();
    const from = new Date(to);
    from.setDate(to.getDate() - lookbackDays);

    const raw = await finnhubFetch<FinnhubNewsItem[]>(
      "/company-news",
      { symbol, from: toDateParam(from), to: toDateParam(to) },
      { revalidate: 300 }
    );

    if (!Array.isArray(raw)) {
      return [];
    }

    const seenIds = new Set<number>();
    const articles: NewsArticle[] = [];

    for (const item of raw) {
      const article = toArticle(item);

      if (article && !seenIds.has(article.id)) {
        seenIds.add(article.id);
        articles.push(article);
      }
    }

    return articles;
  },

  async resolveCompanyName(symbol: string): Promise<string | null> {
    try {
      const index = await getSymbolIndex();

      return index.find((company) => company.symbol === symbol)?.name ?? null;
    } catch (error) {
      console.error(`Company index unavailable while resolving name for ${symbol}:`, error);
      return null;
    }
  },

  async searchCompanies(query: string, limit = 8): Promise<CompanyMatch[]> {
    const index = await getSymbolIndex();

    return searchCompanies(index, query, limit);
  },
};
