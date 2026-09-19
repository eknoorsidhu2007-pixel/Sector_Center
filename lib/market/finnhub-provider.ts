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
import { cached } from "./cache";
import type { MarketDataProvider } from "./provider";
import type {
  Candle,
  CompanyProfile,
  KeyMetrics,
  MetricSeriesPoint,
  Quote,
} from "./types";

const MILLION = 1_000_000;

// In-memory TTLs mirror the `revalidate` values passed to finnhubFetch so
// the two caches agree on freshness.
const TTL_QUOTE_MS = 60_000; // 1 min
const TTL_PROFILE_MS = 86_400_000; // 24 h
const TTL_METRICS_MS = 21_600_000; // 6 h
const TTL_NEWS_MS = 300_000; // 5 min

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

/**
 * `/stock/metric?metric=all` returns ~133 point-in-time fields plus a `series`
 * map of historical ratios. Only the fields Sector Center actually maps are
 * enumerated here; the rest are ignored rather than silently passed through.
 *
 * Several upstream names need quoting because they contain `/` or `&`. They
 * are reproduced exactly as Finnhub sends them.
 */
interface FinnhubMetricMap {
  "52WeekHigh"?: number;
  "52WeekLow"?: number;
  "52WeekHighDate"?: string;
  "52WeekLowDate"?: string;
  beta?: number;
  "10DayAverageTradingVolume"?: number; // millions
  "3MonthAverageTradingVolume"?: number; // millions
  "3MonthADReturnStd"?: number;

  // Valuation
  peTTM?: number;
  peBasicExclExtraTTM?: number;
  peAnnual?: number;
  forwardPE?: number;
  pegTTM?: number;
  forwardPEG?: number;
  psTTM?: number;
  pb?: number;
  pbQuarterly?: number;
  ptbvQuarterly?: number;
  pfcfShareTTM?: number;
  pcfShareTTM?: number;
  evEbitdaTTM?: number;
  evRevenueTTM?: number;
  "currentEv/freeCashFlowTTM"?: number;
  enterpriseValue?: number; // millions

  // Earnings per share
  epsTTM?: number;
  epsBasicExclExtraItemsTTM?: number;

  // Margins
  grossMarginTTM?: number;
  grossMargin5Y?: number;
  operatingMarginTTM?: number;
  operatingMargin5Y?: number;
  netProfitMarginTTM?: number;
  netProfitMargin5Y?: number;
  pretaxMarginTTM?: number;
  pretaxMargin5Y?: number;

  // Returns
  roeTTM?: number;
  roe5Y?: number;
  roaTTM?: number;
  roa5Y?: number;
  roiTTM?: number;
  roi5Y?: number;

  // Growth
  revenueGrowthTTMYoy?: number;
  revenueGrowthQuarterlyYoy?: number;
  revenueGrowth3Y?: number;
  revenueGrowth5Y?: number;
  epsGrowthTTMYoy?: number;
  epsGrowthQuarterlyYoy?: number;
  epsGrowth3Y?: number;
  epsGrowth5Y?: number;
  ebitdaCagr5Y?: number;
  focfCagr5Y?: number;
  capexCagr5Y?: number;

  // Financial health
  currentRatioQuarterly?: number;
  currentRatioAnnual?: number;
  quickRatioQuarterly?: number;
  quickRatioAnnual?: number;
  "longTermDebt/equityQuarterly"?: number;
  "totalDebt/totalEquityQuarterly"?: number;
  netInterestCoverageTTM?: number;

  // Per share
  revenuePerShareTTM?: number;
  bookValuePerShareQuarterly?: number;
  tangibleBookValuePerShareQuarterly?: number;
  cashFlowPerShareTTM?: number;
  cashPerSharePerShareQuarterly?: number;
  ebitdPerShareTTM?: number;

  // Dividends
  dividendYieldIndicatedAnnual?: number;
  currentDividendYieldTTM?: number;
  dividendPerShareTTM?: number;
  dividendPerShareAnnual?: number;
  dividendIndicatedAnnual?: number;
  payoutRatioTTM?: number;
  dividendGrowthRate5Y?: number;

  // Price returns
  "5DayPriceReturnDaily"?: number;
  "13WeekPriceReturnDaily"?: number;
  "26WeekPriceReturnDaily"?: number;
  "52WeekPriceReturnDaily"?: number;
  monthToDatePriceReturnDaily?: number;
  yearToDatePriceReturnDaily?: number;

  // Relative to S&P 500
  "priceRelativeToS&P5004Week"?: number;
  "priceRelativeToS&P50013Week"?: number;
  "priceRelativeToS&P50026Week"?: number;
  "priceRelativeToS&P50052Week"?: number;
  "priceRelativeToS&P500Ytd"?: number;

  // Efficiency
  assetTurnoverTTM?: number;
  inventoryTurnoverTTM?: number;
  receivablesTurnoverTTM?: number;
  revenueEmployeeTTM?: number;
  netIncomeEmployeeTTM?: number;
}

/** Raw series point: `period` is a date string, `v` the value. */
interface FinnhubSeriesPoint {
  period?: string;
  v?: number;
}

interface FinnhubMetricResponse {
  metric?: FinnhubMetricMap;
  series?: {
    annual?: Record<string, FinnhubSeriesPoint[]>;
    quarterly?: Record<string, FinnhubSeriesPoint[]>;
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
 * Normalizes Finnhub's `{ period, v }` series points into domain points,
 * dropping any without both a period and a finite value, and sorting newest
 * first so callers can take the head for "latest".
 */
function toMetricSeries(
  raw: Record<string, FinnhubSeriesPoint[]> | undefined
): Record<string, MetricSeriesPoint[]> {
  if (!raw) {
    return {};
  }

  const result: Record<string, MetricSeriesPoint[]> = {};

  for (const [concept, points] of Object.entries(raw)) {
    if (!Array.isArray(points)) {
      continue;
    }

    const cleaned: MetricSeriesPoint[] = [];

    for (const point of points) {
      const period = str(point?.period);
      const value = num(point?.v);

      if (period !== null && value !== null) {
        cleaned.push({ period, value });
      }
    }

    if (cleaned.length > 0) {
      cleaned.sort((a, b) => b.period.localeCompare(a.period));
      result[concept] = cleaned;
    }
  }

  return result;
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
    return cached(`quote:${symbol}`, TTL_QUOTE_MS, async () => {
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
    });
  },

  async getProfile(symbol: string): Promise<CompanyProfile> {
    return cached(`profile:${symbol}`, TTL_PROFILE_MS, async () => {
      const raw = await finnhubFetch<FinnhubProfile>(
        "/stock/profile2",
        { symbol },
        { revalidate: 86_400 }
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
    });
  },

  async getKeyMetrics(symbol: string): Promise<KeyMetrics> {
    return cached(`metrics:${symbol}`, TTL_METRICS_MS, async () => {
      const raw = await finnhubFetch<FinnhubMetricResponse>(
        "/stock/metric",
        { symbol, metric: "all" },
        { revalidate: 21_600 }
      );

      const metric = raw.metric ?? {};
      const vol10 = num(metric["10DayAverageTradingVolume"]);
      const vol3m = num(metric["3MonthAverageTradingVolume"]);
      const evMillions = num(metric.enterpriseValue);

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
        volatility3Month: num(metric["3MonthADReturnStd"]),

        valuation: {
          peTTM: num(metric.peTTM) ?? num(metric.peBasicExclExtraTTM),
          peAnnual: num(metric.peAnnual),
          forwardPE: num(metric.forwardPE),
          pegTTM: num(metric.pegTTM),
          forwardPEG: num(metric.forwardPEG),
          priceToSalesTTM: num(metric.psTTM),
          priceToBook: num(metric.pbQuarterly) ?? num(metric.pb),
          priceToTangibleBook: num(metric.ptbvQuarterly),
          priceToFreeCashFlowTTM: num(metric.pfcfShareTTM),
          priceToCashFlowTTM: num(metric.pcfShareTTM),
          evToEbitdaTTM: num(metric.evEbitdaTTM),
          evToRevenueTTM: num(metric.evRevenueTTM),
          evToFreeCashFlowTTM: num(metric["currentEv/freeCashFlowTTM"]),
          enterpriseValue: evMillions !== null ? evMillions * MILLION : null,
        },

        margins: {
          grossMarginTTM: num(metric.grossMarginTTM),
          grossMargin5Y: num(metric.grossMargin5Y),
          operatingMarginTTM: num(metric.operatingMarginTTM),
          operatingMargin5Y: num(metric.operatingMargin5Y),
          netMarginTTM: num(metric.netProfitMarginTTM),
          netMargin5Y: num(metric.netProfitMargin5Y),
          pretaxMarginTTM: num(metric.pretaxMarginTTM),
          pretaxMargin5Y: num(metric.pretaxMargin5Y),
        },

        returns: {
          roeTTM: num(metric.roeTTM),
          roe5Y: num(metric.roe5Y),
          roaTTM: num(metric.roaTTM),
          roa5Y: num(metric.roa5Y),
          roiTTM: num(metric.roiTTM),
          roi5Y: num(metric.roi5Y),
        },

        growth: {
          revenueGrowthTTMYoy: num(metric.revenueGrowthTTMYoy),
          revenueGrowthQuarterlyYoy: num(metric.revenueGrowthQuarterlyYoy),
          revenueGrowth3Y: num(metric.revenueGrowth3Y),
          revenueGrowth5Y: num(metric.revenueGrowth5Y),
          epsGrowthTTMYoy: num(metric.epsGrowthTTMYoy),
          epsGrowthQuarterlyYoy: num(metric.epsGrowthQuarterlyYoy),
          epsGrowth3Y: num(metric.epsGrowth3Y),
          epsGrowth5Y: num(metric.epsGrowth5Y),
          ebitdaCagr5Y: num(metric.ebitdaCagr5Y),
          freeOperatingCashFlowCagr5Y: num(metric.focfCagr5Y),
          capexCagr5Y: num(metric.capexCagr5Y),
        },

        health: {
          currentRatioQuarterly: num(metric.currentRatioQuarterly),
          currentRatioAnnual: num(metric.currentRatioAnnual),
          quickRatioQuarterly: num(metric.quickRatioQuarterly),
          quickRatioAnnual: num(metric.quickRatioAnnual),
          longTermDebtToEquityQuarterly: num(metric["longTermDebt/equityQuarterly"]),
          totalDebtToEquityQuarterly: num(metric["totalDebt/totalEquityQuarterly"]),
          netInterestCoverageTTM: num(metric.netInterestCoverageTTM),
        },

        perShare: {
          revenuePerShareTTM: num(metric.revenuePerShareTTM),
          bookValuePerShareQuarterly: num(metric.bookValuePerShareQuarterly),
          tangibleBookValuePerShareQuarterly: num(
            metric.tangibleBookValuePerShareQuarterly
          ),
          cashFlowPerShareTTM: num(metric.cashFlowPerShareTTM),
          cashPerShareQuarterly: num(metric.cashPerSharePerShareQuarterly),
          ebitdaPerShareTTM: num(metric.ebitdPerShareTTM),
        },

        dividend: {
          yieldIndicatedAnnual: num(metric.dividendYieldIndicatedAnnual),
          currentYieldTTM: num(metric.currentDividendYieldTTM),
          perShareTTM: num(metric.dividendPerShareTTM),
          perShareAnnual: num(metric.dividendPerShareAnnual),
          indicatedAnnual: num(metric.dividendIndicatedAnnual),
          payoutRatioTTM: num(metric.payoutRatioTTM),
          growthRate5Y: num(metric.dividendGrowthRate5Y),
        },

        priceReturns: {
          fiveDay: num(metric["5DayPriceReturnDaily"]),
          thirteenWeek: num(metric["13WeekPriceReturnDaily"]),
          twentySixWeek: num(metric["26WeekPriceReturnDaily"]),
          fiftyTwoWeek: num(metric["52WeekPriceReturnDaily"]),
          monthToDate: num(metric.monthToDatePriceReturnDaily),
          yearToDate: num(metric.yearToDatePriceReturnDaily),
        },

        relativePerformance: {
          fourWeek: num(metric["priceRelativeToS&P5004Week"]),
          thirteenWeek: num(metric["priceRelativeToS&P50013Week"]),
          twentySixWeek: num(metric["priceRelativeToS&P50026Week"]),
          fiftyTwoWeek: num(metric["priceRelativeToS&P50052Week"]),
          yearToDate: num(metric["priceRelativeToS&P500Ytd"]),
        },

        efficiency: {
          assetTurnoverTTM: num(metric.assetTurnoverTTM),
          inventoryTurnoverTTM: num(metric.inventoryTurnoverTTM),
          receivablesTurnoverTTM: num(metric.receivablesTurnoverTTM),
          revenuePerEmployeeTTM: num(metric.revenueEmployeeTTM),
          netIncomePerEmployeeTTM: num(metric.netIncomeEmployeeTTM),
        },

        series: {
          annual: toMetricSeries(raw.series?.annual),
          quarterly: toMetricSeries(raw.series?.quarterly),
        },
      };
    });
  },

  async getCompanyNews(symbol: string, lookbackDays: number): Promise<NewsArticle[]> {
    return cached(`news:${symbol}:${lookbackDays}`, TTL_NEWS_MS, async () => {
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
    });
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

  // Finnhub's /stock/candle returns 403 on the free tier. Candles are served
  // by the Twelve Data provider instead — see lib/market/index.ts.
  async getCandles(): Promise<Candle[]> {
    throw new Error("Finnhub does not support OHLC candles on this plan");
  },
};
