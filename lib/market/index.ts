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
export type { Candle, CandleRange, CompanyProfile, KeyMetrics, Quote } from "./types";
