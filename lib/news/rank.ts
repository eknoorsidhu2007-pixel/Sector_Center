/**
 * Trader-focused story ranking.
 *
 * score = tier × event × source × recency × corroboration × breaking
 *
 * Recency is deliberately NOT an override: market-moving event types (earnings,
 * guidance, management, M&A, regulatory) decay with a ~4-day half-life while
 * everything else decays in ~30 hours, so a two-day-old earnings story still
 * outranks hour-old commentary, but fresh news of the same importance wins.
 * Commentary ("opinion") about an event is capped below the event itself.
 */

import { EVENT_WEIGHTS } from "./classify";
import { sourceTier } from "./relevance";
import type { StoryCluster } from "./cluster";
import type { NewsEventType } from "../types";

const TIER_MULTIPLIER = { primary: 3, secondary: 1.5 } as const;

/** Events that stay relevant for days rather than hours. */
const LONG_LIVED_TYPES: ReadonlySet<NewsEventType> = new Set([
  "earnings",
  "guidance",
  "mna",
  "regulatory",
  "management",
]);

const LONG_HALF_LIFE_HOURS = 96;
const DEFAULT_HALF_LIFE_HOURS = 30;
const BREAKING_WINDOW_HOURS = 6;
const BREAKING_BOOST = 1.5;
/** Cluster size beyond this adds nothing; corroboration is logarithmic. */
const MAX_CORROBORATING_ARTICLES = 8;
/** Commentary about an event never outranks the event category itself. */
const OPINION_WEIGHT_CAP = 6;

const HOUR_MS = 60 * 60 * 1000;

export interface RankedCluster extends StoryCluster {
  /** Internal ranking signal — never serialized to the client. */
  score: number;
}

function eventWeight(eventTypes: NewsEventType[]): number {
  const max = Math.max(...eventTypes.map((type) => EVENT_WEIGHTS[type]));

  return eventTypes.includes("opinion") ? Math.min(max, OPINION_WEIGHT_CAP) : max;
}

function sourceMultiplier(source: string): number {
  const tier = sourceTier(source);

  return tier === 1 ? 1.15 : tier === 2 ? 1 : 0.9;
}

export function rankClusters(
  clusters: StoryCluster[],
  now: Date = new Date()
): RankedCluster[] {
  const ranked = clusters.map((cluster) => {
    const representative = cluster.representative;
    const tierMultiplier =
      TIER_MULTIPLIER[representative.relevanceTier === "primary" ? "primary" : "secondary"];

    const ageHours = Math.max(
      0,
      (now.getTime() - Date.parse(representative.publishedAt)) / HOUR_MS
    );
    const halfLife = cluster.eventTypes.some((type) => LONG_LIVED_TYPES.has(type))
      ? LONG_HALF_LIFE_HOURS
      : DEFAULT_HALF_LIFE_HOURS;
    const recency = Math.pow(0.5, ageHours / halfLife);

    const corroboration =
      1 + 0.35 * Math.log(Math.min(cluster.articles.length, MAX_CORROBORATING_ARTICLES));

    const latestAgeHours = Math.max(
      0,
      (now.getTime() - Date.parse(cluster.latestPublishedAt)) / HOUR_MS
    );
    const breaking = latestAgeHours < BREAKING_WINDOW_HOURS ? BREAKING_BOOST : 1;

    const score =
      tierMultiplier *
      eventWeight(cluster.eventTypes) *
      sourceMultiplier(representative.source) *
      recency *
      corroboration *
      breaking;

    return { ...cluster, score };
  });

  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      Date.parse(b.latestPublishedAt) - Date.parse(a.latestPublishedAt)
  );

  return ranked;
}
