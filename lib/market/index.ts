/**
 * Single accessor for the application's market-data provider.
 *
 * Returns a composite: Finnhub serves quotes, profiles, metrics, news, and
 * search; Twelve Data serves OHLC candles (Finnhub's /stock/candle 403s on
 * the free tier). Consumers see one MarketDataProvider and never know which
 * vendor handles which method.
 */

import { finnhubProvider } from "./finnhub-provider";
import { getCandles } from "./twelve-data-provider";
import type { MarketDataProvider } from "./provider";

export function getMarketData(): MarketDataProvider {
  return {
    ...finnhubProvider,
    getCandles,
  };
}

export type { MarketDataProvider } from "./provider";
export type {
  Candle,
  CandleRange,
  CompanyProfile,
  DividendMetrics,
  EarningsEvent,
  EarningsSurprise,
  EfficiencyMetrics,
  FinancialHealthMetrics,
  FinancialReport,
  GovernmentContract,
  GrowthMetrics,
  InsiderSentimentPoint,
  InsiderTransaction,
  InsiderTransactionKind,
  KeyMetrics,
  MarginMetrics,
  MetricSeries,
  MetricSeriesPoint,
  PerShareMetrics,
  PriceReturnMetrics,
  Quote,
  RecommendationTrend,
  RelativePerformanceMetrics,
  ReportLineItem,
  ReturnMetrics,
  SecFiling,
  ValuationMetrics,
} from "./types";
export { metricSeries } from "./types";
