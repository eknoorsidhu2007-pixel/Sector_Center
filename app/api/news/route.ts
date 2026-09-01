import { NextResponse } from "next/server";

import { finnhubFetch, toApiError } from "@/lib/finnhub";
import { normalizeSymbol } from "@/lib/validation";
import type { ApiErrorResponse, NewsArticle, NewsResponse } from "@/lib/types";

const LOOKBACK_DAYS = 7;
const REVALIDATE_SECONDS = 300;
const MAX_ARTICLES = 50;

interface FinnhubNewsItem {
  id?: number;
  headline?: string;
  summary?: string;
  url?: string;
  source?: string;
  image?: string;
  datetime?: number;
}

function toDateParam(date: Date): string {
  return date.toISOString().split("T")[0];
}

/**
 * Finnhub returns a loose array; anything without a headline, URL, or usable
 * timestamp is unrenderable, so it is dropped rather than passed to the client.
 */
function toArticle(item: FinnhubNewsItem): NewsArticle | null {
  const headline = item.headline?.trim();
  const url = item.url?.trim();

  if (!headline || !url || typeof item.datetime !== "number" || item.datetime <= 0) {
    return null;
  }

  return {
    id: typeof item.id === "number" ? item.id : item.datetime,
    headline,
    summary: item.summary?.trim() ?? "",
    url,
    source: item.source?.trim() || "Unknown source",
    imageUrl: item.image?.trim() || null,
    publishedAt: new Date(item.datetime * 1000).toISOString(),
  };
}

export async function GET(
  request: Request
): Promise<NextResponse<NewsResponse | ApiErrorResponse>> {
  const { searchParams } = new URL(request.url);
  const symbol = normalizeSymbol(searchParams.get("symbol"));

  if (!symbol) {
    return NextResponse.json(
      { error: "A valid ticker symbol is required" },
      { status: 400 }
    );
  }

  try {
    const to = new Date();
    const from = new Date(to);
    from.setDate(to.getDate() - LOOKBACK_DAYS);

    const raw = await finnhubFetch<FinnhubNewsItem[]>(
      "/company-news",
      { symbol, from: toDateParam(from), to: toDateParam(to) },
      { revalidate: REVALIDATE_SECONDS }
    );

    if (!Array.isArray(raw)) {
      return NextResponse.json(
        { error: "Unexpected response from the market data provider" },
        { status: 502 }
      );
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

    articles.sort(
      (a, b) =>
        new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
    );

    const limited = articles.slice(0, MAX_ARTICLES);

    return NextResponse.json({
      symbol,
      count: limited.length,
      articles: limited,
    });
  } catch (error) {
    const { status, message } = toApiError(error);

    return NextResponse.json({ error: message }, { status });
  }
}
