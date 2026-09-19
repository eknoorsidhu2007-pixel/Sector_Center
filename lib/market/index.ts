/**
 * Single accessor for the application's market-data provider.
 *
 * Today it always returns the Finnhub implementation. When a second vendor is
 * needed (e.g. for OHLC candles, which Finnhub gates behind a paid plan), this
 * is the only file that changes.
 */

import { finnhubProvider } from "./finnhub-provider";
import type { MarketDataProvider } from "./provider";

export function getMarketData(): MarketDataProvider {
  return finnhubProvider;
}

export type { MarketDataProvider } from "./provider";
export type { CompanyProfile, KeyMetrics, Quote } from "./types";
