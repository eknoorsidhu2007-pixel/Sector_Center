import { NextResponse } from "next/server";

import { toApiError } from "@/lib/finnhub";
import { normalizeSymbol } from "@/lib/validation";
import { getMarketData } from "@/lib/market";
import { classifyArticle } from "@/lib/news/classify";
import { clusterArticles } from "@/lib/news/cluster";
import { rankClusters } from "@/lib/news/rank";
import { buildRelevanceContext, scoreArticle } from "@/lib/news/relevance";
import type { PipelineArticle, StoryCluster } from "@/lib/news/cluster";
import type {
  ApiErrorResponse,
  NewsArticle,
  NewsCoverage,
  NewsResponse,
  NewsStory,
} from "@/lib/types";

const DEFAULT_LOOKBACK_DAYS = 7;
/** Finnhub's free tier serves one year of company news. */
const MAX_LOOKBACK_DAYS = 365;
const MAX_STORIES = 30;
const MAX_PERIPHERAL_ARTICLES = 15;

/**
 * Reads `?days=`, falling back to the default for anything missing or
 * malformed and clamping to the provider's free-tier window. An invalid value
 * is not an error worth failing the request over.
 */
function parseLookbackDays(raw: string | null): number {
  if (!raw) {
    return DEFAULT_LOOKBACK_DAYS;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return DEFAULT_LOOKBACK_DAYS;
  }

  return Math.min(parsed, MAX_LOOKBACK_DAYS);
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

  const lookbackDays = parseLookbackDays(searchParams.get("days"));

  try {
    const market = getMarketData();

    // Fetch and resolve in parallel; the news pipeline needs the company name
    // for relevance matching but degrades to ticker-only matching without it.
    const [articles, companyName] = await Promise.all([
      market.getCompanyNews(symbol, lookbackDays),
      market.resolveCompanyName(symbol),
    ]);

    // Pipeline order matters: score, classify, cluster, and rank BEFORE any
    // cap. Capping the raw feed first (the old behaviour) discarded good
    // articles while listicles took their slots.
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
      lookbackDays,
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
