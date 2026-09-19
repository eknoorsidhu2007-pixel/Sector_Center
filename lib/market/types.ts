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

/**
 * Percentages below are in percent units as the provider returns them, NOT
 * fractions: a `grossMarginTTM` of 46.52 means 46.52%. Ratios (P/E, current
 * ratio, turnover) are plain multiples.
 */

export interface ValuationMetrics {
  peTTM: number | null;
  peAnnual: number | null;
  forwardPE: number | null;
  pegTTM: number | null;
  forwardPEG: number | null;
  priceToSalesTTM: number | null;
  priceToBook: number | null;
  priceToTangibleBook: number | null;
  priceToFreeCashFlowTTM: number | null;
  priceToCashFlowTTM: number | null;
  evToEbitdaTTM: number | null;
  evToRevenueTTM: number | null;
  evToFreeCashFlowTTM: number | null;
  /** Actual enterprise value in reporting currency, not millions. */
  enterpriseValue: number | null;
}

export interface MarginMetrics {
  grossMarginTTM: number | null;
  grossMargin5Y: number | null;
  operatingMarginTTM: number | null;
  operatingMargin5Y: number | null;
  netMarginTTM: number | null;
  netMargin5Y: number | null;
  pretaxMarginTTM: number | null;
  pretaxMargin5Y: number | null;
}

export interface ReturnMetrics {
  roeTTM: number | null;
  roe5Y: number | null;
  roaTTM: number | null;
  roa5Y: number | null;
  /** Return on investment. Finnhub does not expose a true ROIC on this plan. */
  roiTTM: number | null;
  roi5Y: number | null;
}

export interface GrowthMetrics {
  revenueGrowthTTMYoy: number | null;
  revenueGrowthQuarterlyYoy: number | null;
  revenueGrowth3Y: number | null;
  revenueGrowth5Y: number | null;
  epsGrowthTTMYoy: number | null;
  epsGrowthQuarterlyYoy: number | null;
  epsGrowth3Y: number | null;
  epsGrowth5Y: number | null;
  ebitdaCagr5Y: number | null;
  freeOperatingCashFlowCagr5Y: number | null;
  capexCagr5Y: number | null;
}

export interface FinancialHealthMetrics {
  currentRatioQuarterly: number | null;
  currentRatioAnnual: number | null;
  quickRatioQuarterly: number | null;
  quickRatioAnnual: number | null;
  longTermDebtToEquityQuarterly: number | null;
  totalDebtToEquityQuarterly: number | null;
  netInterestCoverageTTM: number | null;
}

export interface PerShareMetrics {
  revenuePerShareTTM: number | null;
  bookValuePerShareQuarterly: number | null;
  tangibleBookValuePerShareQuarterly: number | null;
  cashFlowPerShareTTM: number | null;
  cashPerShareQuarterly: number | null;
  ebitdaPerShareTTM: number | null;
}

export interface DividendMetrics {
  /** Annualized indicated yield, percent units. */
  yieldIndicatedAnnual: number | null;
  currentYieldTTM: number | null;
  perShareTTM: number | null;
  perShareAnnual: number | null;
  indicatedAnnual: number | null;
  payoutRatioTTM: number | null;
  growthRate5Y: number | null;
}

/** Trailing total price returns in percent units. */
export interface PriceReturnMetrics {
  fiveDay: number | null;
  thirteenWeek: number | null;
  twentySixWeek: number | null;
  fiftyTwoWeek: number | null;
  monthToDate: number | null;
  yearToDate: number | null;
}

/**
 * Price performance relative to the S&P 500, percent units. Positive means
 * the stock outperformed the index over that window.
 */
export interface RelativePerformanceMetrics {
  fourWeek: number | null;
  thirteenWeek: number | null;
  twentySixWeek: number | null;
  fiftyTwoWeek: number | null;
  yearToDate: number | null;
}

export interface EfficiencyMetrics {
  assetTurnoverTTM: number | null;
  inventoryTurnoverTTM: number | null;
  receivablesTurnoverTTM: number | null;
  revenuePerEmployeeTTM: number | null;
  netIncomePerEmployeeTTM: number | null;
}

/** One point in a historical metric series. */
export interface MetricSeriesPoint {
  /** Period end date, ISO `YYYY-MM-DD`. */
  period: string;
  value: number;
}

/**
 * Historical ratio time series that `/stock/metric` returns alongside the
 * point-in-time metrics, keyed by concept name (e.g. "roe", "netMargin",
 * "currentRatio"). Kept as a map because the concept list is provider-defined
 * and varies by company; use `metricSeries()` to read one safely.
 */
export interface MetricSeries {
  annual: Record<string, MetricSeriesPoint[]>;
  quarterly: Record<string, MetricSeriesPoint[]>;
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
  /** Standard deviation of 3-month daily returns; a volatility proxy. */
  volatility3Month: number | null;
  valuation: ValuationMetrics;
  margins: MarginMetrics;
  returns: ReturnMetrics;
  growth: GrowthMetrics;
  health: FinancialHealthMetrics;
  perShare: PerShareMetrics;
  dividend: DividendMetrics;
  priceReturns: PriceReturnMetrics;
  relativePerformance: RelativePerformanceMetrics;
  efficiency: EfficiencyMetrics;
  series: MetricSeries;
}

/**
 * Reads one concept out of a metric series, newest first. Returns an empty
 * array when the provider did not report that concept for this company.
 */
export function metricSeries(
  series: MetricSeries,
  period: "annual" | "quarterly",
  concept: string
): MetricSeriesPoint[] {
  return series[period][concept] ?? [];
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
