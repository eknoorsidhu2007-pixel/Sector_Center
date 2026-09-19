/**
 * Twelve Data implementation of OHLC candle fetching.
 *
 * This is not a full MarketDataProvider — it only implements `getCandles`.
 * The composite in `lib/market/index.ts` routes candle requests here and
 * everything else to Finnhub.
 *
 * Free tier: 8 credits/min, 800 credits/day. One candle request costs 1
 * credit regardless of how many bars come back, so caching is the primary
 * rate-limit strategy. Daily and weekly bars are cached for hours because
 * they do not change intraday.
 */

import { cached } from "./cache";
import { twelveDataFetch } from "./twelve-data";
import type { Candle, CandleRange } from "./types";

// -- Range → interval/outputsize mapping --------------------------------------

interface RangeSpec {
  interval: string;
  outputsize: number;
  /** In-memory cache TTL in milliseconds. */
  ttlMs: number;
  /** Next.js data-cache revalidate in seconds. */
  revalidateSec: number;
}

const RANGE_MAP: Record<CandleRange, RangeSpec> = {
  "1D": { interval: "5min", outputsize: 78, ttlMs: 300_000, revalidateSec: 300 },
  "1M": { interval: "1day", outputsize: 22, ttlMs: 21_600_000, revalidateSec: 21_600 },
  "6M": { interval: "1day", outputsize: 126, ttlMs: 21_600_000, revalidateSec: 21_600 },
  "1Y": { interval: "1day", outputsize: 252, ttlMs: 21_600_000, revalidateSec: 21_600 },
  MAX: { interval: "1week", outputsize: 5000, ttlMs: 86_400_000, revalidateSec: 86_400 },
};

// -- Response shape ------------------------------------------------------------

interface TwelveDataTimeSeries {
  meta?: {
    symbol?: string;
    interval?: string;
    currency?: string;
    exchange?: string;
  };
  values?: {
    datetime?: string;
    open?: string;
    high?: string;
    low?: string;
    close?: string;
    volume?: string;
  }[];
  status?: string;
}

// -- Mapping -------------------------------------------------------------------

/**
 * Twelve Data returns datetime in exchange-local time for daily+ intervals
 * ("2021-09-16") and in the requested timezone for intraday ("2021-09-16
 * 15:59:00"). We request UTC for intraday so the parse is unambiguous.
 * Daily bars parse as UTC midnight, which is correct for charting.
 */
function parseDatetime(datetime: string): number | null {
  const normalized = datetime.includes(" ")
    ? datetime.replace(" ", "T") + "Z"
    : datetime;

  const ms = Date.parse(normalized);

  return Number.isNaN(ms) ? null : Math.floor(ms / 1000);
}

function parseFloat_(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const n = parseFloat(value);

  return Number.isFinite(n) ? n : null;
}

function parseInt_(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const n = parseInt(value, 10);

  return Number.isFinite(n) ? n : null;
}

// -- Public API ------------------------------------------------------------------

export async function getCandles(
  symbol: string,
  range: CandleRange
): Promise<Candle[]> {
  const spec = RANGE_MAP[range];

  return cached(`candles:${symbol}:${range}`, spec.ttlMs, async () => {
    const params: Record<string, string> = {
      symbol,
      interval: spec.interval,
      outputsize: String(spec.outputsize),
      order: "asc",
    };

    // Intraday bars need an explicit timezone for unambiguous parsing.
    if (range === "1D") {
      params.timezone = "UTC";
    }

    const raw = await twelveDataFetch<TwelveDataTimeSeries>(
      "/time_series",
      params,
      { revalidate: spec.revalidateSec }
    );

    if (!Array.isArray(raw.values)) {
      return [];
    }

    const candles: Candle[] = [];

    for (const bar of raw.values) {
      const time = bar.datetime ? parseDatetime(bar.datetime) : null;
      const open = parseFloat_(bar.open);
      const high = parseFloat_(bar.high);
      const low = parseFloat_(bar.low);
      const close = parseFloat_(bar.close);

      if (time === null || open === null || high === null || low === null || close === null) {
        continue;
      }

      candles.push({ time, open, high, low, close, volume: parseInt_(bar.volume) });
    }

    return candles;
  });
}
