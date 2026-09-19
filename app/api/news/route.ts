import { NextResponse } from "next/server";

import { finnhubFetch, toApiError } from "@/lib/finnhub";
import { normalizeSymbol } from "@/lib/validation";
import { getSymbolIndex } from "@/lib/symbols";
import { classifyArticle } from "@/lib/news/classify";
import { clusterArticles } from "@/lib/news/cluster";
import { rankClusters } from "@/lib/news/rank";
import { buildRelevanceContext, scoreArticle } from "@/lib/news/relevance";
import { cleanForDisplay } from "@/lib/news/text";
import type { PipelineArticle, StoryCluster } from "@/lib/news/cluster";
import type {
  ApiErrorResponse,
  NewsArticle,
  NewsCoverage,
  NewsResponse,
  NewsStory,
} from "@/lib/types";

const LOOKBACK_DAYS = 7;
const REVALIDATE_SECONDS = 300;
const MAX_STORIES = 30;
const MAX_PERIPHERAL_ARTICLES = 15;

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

/**
 * The relevance matcher needs the company name ("Apple"), not just the ticker.
 * The search index already knows every listed name and is cached in memory, so
 * this costs no extra Finnhub request. News must never fail because the search
 * index did, so any failure degrades to ticker-only matching.
 */
async function resolveCompanyName(symbol: string): Promise<string | null> {
  try {
    const index = await getSymbolIndex();

    return index.find((company) => company.symbol === symbol)?.name ?? null;
  } catch (error) {
    console.error(`Company index unavailable while loading news for ${symbol}:`, error);
    return null;
  }
}

/** Strips server-side scoring internals before an article goes to the client. */
function toPublicArticle(article: PipelineArticle): NewsArticle {
  return {
    id: article.id,
    headline: article.headline,
    summary: article.summary,
    url: article.url,
    source: article.source,
    imageUrl: article.imageUrl,
    publishedAt: article.publishedAt,
  };
}

function toNewsStory(cluster: StoryCluster): NewsStory {
  const { representative } = cluster;

  return {
    id: cluster.id,
    headline: representative.headline,
    summary: representative.summary,
    url: representative.url,
    source: representative.source,
    imageUrl: representative.imageUrl,
    publishedAt: cluster.firstPublishedAt,
    latestPublishedAt: cluster.latestPublishedAt,
    relevance: representative.relevanceTier === "primary" ? "primary" : "secondary",
    eventTypes: cluster.eventTypes,
    sourceCount: cluster.sources.length,
    sources: cluster.sources,
    articles: cluster.articles.map(toPublicArticle),
  };
}

function coverageFor(stories: NewsStory[]): NewsCoverage {
  const primaryCount = stories.filter((story) => story.relevance === "primary").length;

  if (primaryCount >= 4) {
    return "normal";
  }

  return stories.length > 0 ? "light" : "none";
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

    // Pipeline order matters: score, classify, cluster, and rank BEFORE any
    // cap. Capping the raw feed first (the old behaviour) discarded good
    // articles while listicles took their slots.
    const companyName = await resolveCompanyName(symbol);
    const context = buildRelevanceContext(symbol, companyName);

    const pipeline: PipelineArticle[] = articles.map((article) => ({
      ...scoreArticle(article, context),
      eventTypes: classifyArticle(article),
    }));

    const peripheralAll = pipeline
      .filter((article) => article.relevanceTier === "peripheral")
      .sort(
        (a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)
      );

    const mainFeed = pipeline.filter((article) => article.relevanceTier !== "peripheral");

    const stories = rankClusters(clusterArticles(mainFeed, context.companyTokens))
      .slice(0, MAX_STORIES)
      .map(toNewsStory);

    return NextResponse.json({
      symbol,
      companyName,
      count: stories.length,
      totalArticles: articles.length,
      stories,
      peripheral: peripheralAll.slice(0, MAX_PERIPHERAL_ARTICLES).map(toPublicArticle),
      peripheralCount: peripheralAll.length,
      coverage: coverageFor(stories),
    });
  } catch (error) {
    const { status, message } = toApiError(error);

    return NextResponse.json({ error: message }, { status });
  }
}
