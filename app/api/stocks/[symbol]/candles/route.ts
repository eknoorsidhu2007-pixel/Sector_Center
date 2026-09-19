import { NextResponse } from "next/server";

import { getMarketData } from "@/lib/market";
import type { Candle, CandleRange } from "@/lib/market";
import { normalizeSymbol } from "@/lib/validation";

const VALID_RANGES = new Set<CandleRange>(["1D", "1M", "6M", "1Y", "MAX"]);

interface CandlesResponse {
  symbol: string;
  range: CandleRange;
  candles: Candle[];
}

interface ApiErrorResponse {
  error: string;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
): Promise<NextResponse<CandlesResponse | ApiErrorResponse>> {
  const { symbol: raw } = await params;
  const symbol = normalizeSymbol(raw);

  if (!symbol) {
    return NextResponse.json(
      { error: "A valid ticker symbol is required" },
      { status: 400 }
    );
  }

  const { searchParams } = new URL(request.url);
  const rangeParam = searchParams.get("range")?.toUpperCase() ?? "1M";
  const range = (VALID_RANGES.has(rangeParam as CandleRange)
    ? rangeParam
    : "1M") as CandleRange;

  try {
    const candles = await getMarketData().getCandles(symbol, range);

    return NextResponse.json({ symbol, range, candles });
  } catch (error) {
    console.error(`Candle fetch failed for ${symbol}/${range}:`, error);

    const message =
      error instanceof Error && error.message.includes("not configured")
        ? "Chart data is not configured"
        : "Unable to load chart data";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
