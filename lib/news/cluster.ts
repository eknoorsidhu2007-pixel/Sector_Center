/**
 * Near-duplicate story clustering.
 *
 * Exact-match deduplication catches nothing on this feed (measured: zero
 * exact duplicate headlines or URLs across 84 live articles), but one event
 * arrives as many write-ups — e.g. a CEO transition produced 13 of 27
 * relevant AAPL articles. URLs cannot help: Finnhub wraps every link in its
 * own redirect, so clustering is purely textual.
 *
 * The bias is deliberate: UNDER-cluster. Two stories merge only when their
 * normalized headlines are very similar (Jaccard / containment) or when they
 * share at least two distinctive non-company tokens ("cook", "ternus") plus a
 * compatible event type. The failure mode of under-clustering is a feed that
 * looks like today's; the failure mode of over-clustering is two genuinely
 * different stories collapsed into one, which is worse.
 */

import { EVENT_WEIGHTS } from "./classify";
import { sourceTier } from "./relevance";
import { distinctiveTokens, normalizeHeadline, tokenSet } from "./text";
import type { ScoredArticle } from "./relevance";
import type { NewsArticle, NewsEventType } from "../types";

export interface PipelineArticle extends ScoredArticle {
  eventTypes: NewsEventType[];
}

export interface StoryCluster {
  id: string;
  /** Best-source, then earliest, article — its headline/summary represent the story. */
  representative: PipelineArticle;
  /** Every article in the cluster, newest first. */
  articles: PipelineArticle[];
  sources: string[];
  firstPublishedAt: string;
  latestPublishedAt: string;
  eventTypes: NewsEventType[];
}

const JACCARD_THRESHOLD = 0.5;
const CONTAINMENT_THRESHOLD = 0.65;
const SHARED_DISTINCTIVE_THRESHOLD = 2;

interface IndexedArticle {
  article: PipelineArticle;
  tokens: Set<string>;
  distinctive: Set<string>;
}

function intersectionSize(a: Set<string>, b: Set<string>): number {
  let count = 0;

  for (const value of a) {
    if (b.has(value)) {
      count += 1;
    }
  }

  return count;
}

function eventsOverlap(a: NewsEventType[], b: NewsEventType[]): boolean {
  return a.some((type) => b.includes(type));
}

function shouldMerge(a: IndexedArticle, b: IndexedArticle): boolean {
  const shared = intersectionSize(a.tokens, b.tokens);

  if (shared === 0) {
    return false;
  }

  const union = a.tokens.size + b.tokens.size - shared;
  const jaccard = shared / union;
  const containment = shared / Math.min(a.tokens.size, b.tokens.size);

  // Near-identical headlines are the same story almost by definition, so an
  // unclassifiable ("other") side must not block the merge.
  if (jaccard >= JACCARD_THRESHOLD || containment >= CONTAINMENT_THRESHOLD) {
    return (
      eventsOverlap(a.article.eventTypes, b.article.eventTypes) ||
      a.article.eventTypes.includes("other") ||
      b.article.eventTypes.includes("other")
    );
  }

  // The distinctive-token path is weaker evidence, so it demands REAL event
  // agreement. "other" cannot donate compatibility here — an unclassifiable
  // article that shares two tokens with a classified one is how a product
  // launch ends up inside a CEO-transition cluster.
  const sharedDistinctive = intersectionSize(a.distinctive, b.distinctive);

  return (
    sharedDistinctive >= SHARED_DISTINCTIVE_THRESHOLD &&
    eventsOverlap(a.article.eventTypes, b.article.eventTypes)
  );
}

class UnionFind {
  private readonly parent: number[];

  constructor(size: number) {
    this.parent = Array.from({ length: size }, (_, index) => index);
  }

  find(value: number): number {
    let root = value;

    while (this.parent[root] !== root) {
      root = this.parent[root];
    }

    // Path compression keeps repeated lookups flat.
    while (this.parent[value] !== root) {
      const next = this.parent[value];
      this.parent[value] = root;
      value = next;
    }

    return root;
  }

  union(a: number, b: number): void {
    const rootA = this.find(a);
    const rootB = this.find(b);

    if (rootA !== rootB) {
      this.parent[rootB] = rootA;
    }
  }
}

/**
 * Representative = best source tier; within that tier, the article whose
 * headline is most central to the cluster (highest total containment with the
 * other members), then earliest. Earliest-alone can headline a CEO-transition
 * cluster with a product story that merely mentions the new CEO.
 */
function pickRepresentative(
  articles: PipelineArticle[],
  tokensOf: Map<number, Set<string>>
): PipelineArticle[] {
  const bestTier = Math.min(...articles.map((article) => sourceTier(article.source)));
  const candidates = articles.filter((article) => sourceTier(article.source) === bestTier);

  const centrality = (candidate: PipelineArticle): number => {
    const own = tokensOf.get(candidate.id) ?? new Set<string>();
    let total = 0;

    for (const other of articles) {
      if (other.id === candidate.id) {
        continue;
      }

      const theirs = tokensOf.get(other.id) ?? new Set<string>();
      const shared = intersectionSize(own, theirs);
      total += shared / Math.max(1, Math.min(own.size, theirs.size));
    }

    return total;
  };

  return [...candidates].sort((a, b) => {
    const centralityDifference = centrality(b) - centrality(a);

    if (Math.abs(centralityDifference) > 1e-9) {
      return centralityDifference;
    }

    return Date.parse(a.publishedAt) - Date.parse(b.publishedAt);
  });
}

function byNewestFirst(a: NewsArticle, b: NewsArticle): number {
  return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
}

function buildCluster(
  articles: PipelineArticle[],
  tokensOf: Map<number, Set<string>>
): StoryCluster {
  const representative = pickRepresentative(articles, tokensOf)[0];
  const sorted = [...articles].sort(byNewestFirst);
  const timestamps = articles.map((article) => Date.parse(article.publishedAt));

  const sources: string[] = [];
  for (const article of [representative, ...sorted]) {
    if (!sources.includes(article.source)) {
      sources.push(article.source);
    }
  }

  const eventTypes = [...new Set(articles.flatMap((article) => article.eventTypes))].sort(
    (a, b) => EVENT_WEIGHTS[b] - EVENT_WEIGHTS[a]
  );

  // "other" means "classification found nothing"; next to real event types it
  // is noise, so drop it from the union unless it is the only label.
  const meaningful = eventTypes.filter((type) => type !== "other");

  return {
    id: `story-${representative.id}`,
    representative,
    articles: sorted,
    sources,
    firstPublishedAt: new Date(Math.min(...timestamps)).toISOString(),
    latestPublishedAt: new Date(Math.max(...timestamps)).toISOString(),
    eventTypes: meaningful.length > 0 ? meaningful : eventTypes,
  };
}

/**
 * Groups primary/secondary articles into story clusters. Pairwise comparison
 * is O(n²) but n is bounded by a 7-day company feed (~100), so this costs
 * microseconds. Peripheral articles are excluded upstream and never clustered.
 */
export function clusterArticles(
  articles: PipelineArticle[],
  companyTokens: Set<string>
): StoryCluster[] {
  const indexed: IndexedArticle[] = articles.map((article) => {
    const tokens = tokenSet(normalizeHeadline(article.headline));

    return { article, tokens, distinctive: distinctiveTokens(tokens, companyTokens) };
  });

  const unions = new UnionFind(indexed.length);

  for (let i = 0; i < indexed.length; i += 1) {
    for (let j = i + 1; j < indexed.length; j += 1) {
      if (unions.find(i) !== unions.find(j) && shouldMerge(indexed[i], indexed[j])) {
        unions.union(i, j);
      }
    }
  }

  const groups = new Map<number, PipelineArticle[]>();
  const tokensOf = new Map<number, Set<string>>();

  for (const entry of indexed) {
    tokensOf.set(entry.article.id, entry.tokens);
  }

  for (const [index, entry] of indexed.entries()) {
    const root = unions.find(index);
    const group = groups.get(root);

    if (group) {
      group.push(entry.article);
    } else {
      groups.set(root, [entry.article]);
    }
  }

  return [...groups.values()].map((group) => buildCluster(group, tokensOf));
}
