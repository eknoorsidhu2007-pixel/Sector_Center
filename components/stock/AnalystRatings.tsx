import { formatDateValue } from "@/lib/format";
import type { RecommendationTrend } from "@/lib/market";

import Section, { EmptyState } from "./Section";

interface AnalystRatingsProps {
  trends: RecommendationTrend[];
}

const BUCKETS: {
  key: keyof Omit<RecommendationTrend, "period">;
  label: string;
  className: string;
}[] = [
  { key: "strongBuy", label: "Strong Buy", className: "bg-emerald-600" },
  { key: "buy", label: "Buy", className: "bg-emerald-400" },
  { key: "hold", label: "Hold", className: "bg-zinc-400" },
  { key: "sell", label: "Sell", className: "bg-red-400" },
  { key: "strongSell", label: "Strong Sell", className: "bg-red-600" },
];

/**
 * Analyst recommendation distribution for the most recent period.
 *
 * Counts only. Price targets and EPS/revenue estimates are premium on the
 * current plan, so this deliberately does not imply a target price.
 */
export default function AnalystRatings({ trends }: AnalystRatingsProps) {
  const latest = trends[0];

  if (!latest) {
    return (
      <Section title="Analyst Ratings">
        <EmptyState>No analyst recommendations available.</EmptyState>
      </Section>
    );
  }

  const counts = BUCKETS.map((bucket) => ({
    ...bucket,
    count: latest[bucket.key] ?? 0,
  }));

  const total = counts.reduce((sum, bucket) => sum + bucket.count, 0);

  if (total === 0) {
    return (
      <Section title="Analyst Ratings">
        <EmptyState>No analyst recommendations available.</EmptyState>
      </Section>
    );
  }

  return (
    <Section
      title="Analyst Ratings"
      description={`${total} analyst${total === 1 ? "" : "s"} covering, as of ${formatDateValue(latest.period)}.`}
    >
      <div
        className="flex h-2.5 w-full overflow-hidden rounded-full"
        role="img"
        aria-label={counts
          .filter((bucket) => bucket.count > 0)
          .map((bucket) => `${bucket.count} ${bucket.label}`)
          .join(", ")}
      >
        {counts.map((bucket) =>
          bucket.count > 0 ? (
            <div
              key={bucket.key}
              className={bucket.className}
              style={{ width: `${(bucket.count / total) * 100}%` }}
            />
          ) : null
        )}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-5">
        {counts.map((bucket) => (
          <div key={bucket.key}>
            <dt className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              <span
                className={`inline-block h-2 w-2 rounded-full ${bucket.className}`}
                aria-hidden="true"
              />
              {bucket.label}
            </dt>
            <dd className="ml-3.5 text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
              {bucket.count}
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}
