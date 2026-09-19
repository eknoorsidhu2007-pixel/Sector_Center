/**
 * Domain types for market data.
 *
 * These are Sector Center's own shapes, deliberately decoupled from Finnhub's
 * field names and units so a provider change stays inside the provider module.
 *
 * Every numeric field is `number | null`: a missing value means the upstream
 * provider did not return it, and the UI renders "Data unavailable". We never
 * estimate, default to zero, or otherwise invent financial data.
 *
 * All monetary values are in the instrument's reporting currency (see
 * `CompanyProfile.currency`). All share counts and market caps are actual
 * values, NOT millions — Finnhub returns millions and the provider
 * multiplies by 1,000,000 during mapping so no consumer ever sees the raw
 * unit.
 */

export interface Quote {
  currentPrice: number | null;
  change: number | null;
  changePercent: number | null;
  open: number | null;
  high: number | null;
  low: number | null;
  previousClose: number | null;
  /** ISO 8601 timestamp of the quote, or null if the provider sent none. */
  timestamp: string | null;
}

export interface CompanyProfile {
  ticker: string;
  name: string | null;
  exchange: string | null;
  industry: string | null;
  country: string | null;
  currency: string | null;
  ipoDate: string | null;
  /** Actual market cap in `currency`, not millions. */
  marketCap: number | null;
  /** Actual share count, not millions. */
  sharesOutstanding: number | null;
  floatingShares: number | null;
  logoUrl: string | null;
  webUrl: string | null;
}

export interface KeyMetrics {
  week52High: number | null;
  week52Low: number | null;
  week52HighDate: string | null;
  week52LowDate: string | null;
  peRatioTTM: number | null;
  epsTTM: number | null;
  /** Annualized indicated dividend yield as a percentage (e.g. 0.51 = 0.51%). */
  dividendYieldAnnual: number | null;
  beta: number | null;
  /** Actual shares, not millions. */
  avgVolume10Day: number | null;
  avgVolume3Month: number | null;
}

// -- OHLC candles --------------------------------------------------------------

export type CandleRange = "1D" | "1M" | "6M" | "1Y" | "MAX";

export interface Candle {
  /** Unix seconds (UTC), as expected by lightweight-charts. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Null when the provider does not return volume for this bar. */
  volume: number | null;
}
