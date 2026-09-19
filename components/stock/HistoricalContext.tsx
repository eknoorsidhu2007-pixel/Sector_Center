import { formatChangePercent, formatPrice, formatRatio } from "@/lib/format";
import type { KeyMetrics, Quote } from "@/lib/market";

import Section, { EmptyState } from "./Section";

interface HistoricalContextProps {
  quote: Quote | null;
  metrics: KeyMetrics | null;
  currency: string;
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  const toneClass =
    tone === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "down"
        ? "text-red-600 dark:text-red-400"
        : "text-zinc-900 dark:text-zinc-100";

  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-sm text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className={`text-sm font-medium tabular-nums ${toneClass}`}>
        {value}
      </dd>
    </div>
  );
}

function toneOf(value: number | null): "up" | "down" | undefined {
  if (value === null) {
    return undefined;
  }

  return value >= 0 ? "up" : "down";
}

/**
 * Where the stock sits in its own range, how it has performed over standard
 * windows, and how that compares with the S&P 500.
 *
 * The 52-week positioning is derived from price and the 52-week range. The
 * returns and relative-performance figures come straight from
 * `/stock/metric`, so nothing here is recomputed from candles.
 */
export default function HistoricalContext({
  quote,
  metrics,
  currency,
}: HistoricalContextProps) {
  const price = quote?.currentPrice ?? null;
  const high = metrics?.week52High ?? null;
  const low = metrics?.week52Low ?? null;

  const pctBelowHigh =
    price !== null && high !== null && high > 0
      ? ((high - price) / high) * 100
      : null;

  const pctAboveLow =
    price !== null && low !== null && low > 0
      ? ((price - low) / low) * 100
      : null;

  // Position within the 52-week range, 0% at the low and 100% at the high.
  const rangePosition =
    price !== null && high !== null && low !== null && high > low
      ? ((price - low) / (high - low)) * 100
      : null;

  const returns = metrics?.priceReturns;
  const relative = metrics?.relativePerformance;

  const positioning: string[] = [];

  if (pctBelowHigh !== null) {
    positioning.push(
      pctBelowHigh < 0.005
        ? "At its 52-week high"
        : `${pctBelowHigh.toFixed(1)}% below the 52-week high of ${formatPrice(high, currency)}`
    );
  }

  if (pctAboveLow !== null) {
    positioning.push(
      pctAboveLow < 0.005
        ? "At its 52-week low"
        : `${pctAboveLow.toFixed(1)}% above the 52-week low of ${formatPrice(low, currency)}`
    );
  }

  const hasReturns =
    returns !== undefined &&
    Object.values(returns).some((value) => value !== null);

  const hasRelative =
    relative !== undefined &&
    Object.values(relative).some((value) => value !== null);

  if (positioning.length === 0 && !hasReturns && !hasRelative) {
    return (
      <Section title="Historical Context">
        <EmptyState>Historical context is unavailable for this symbol.</EmptyState>
      </Section>
    );
  }

  return (
    <Section title="Historical Context">
      {positioning.length > 0 && (
        <ul className="space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          {positioning.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      )}

      {rangePosition !== null && (
        <div className="mt-4">
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
            role="img"
            aria-label={`Trading at ${rangePosition.toFixed(0)} percent of its 52-week range`}
          >
            <div
              className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
              style={{ width: `${Math.max(0, Math.min(100, rangePosition))}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-zinc-400 dark:text-zinc-500">
            <span>{formatPrice(low, currency)}</span>
            <span>{rangePosition.toFixed(0)}% of range</span>
            <span>{formatPrice(high, currency)}</span>
          </div>
        </div>
      )}

      <div className="mt-5 grid gap-x-8 sm:grid-cols-2">
        {hasReturns && (
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Total return
            </h3>
            <dl className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <Row
                label="5 days"
                value={formatChangePercent(returns.fiveDay)}
                tone={toneOf(returns.fiveDay)}
              />
              <Row
                label="Month to date"
                value={formatChangePercent(returns.monthToDate)}
                tone={toneOf(returns.monthToDate)}
              />
              <Row
                label="13 weeks"
                value={formatChangePercent(returns.thirteenWeek)}
                tone={toneOf(returns.thirteenWeek)}
              />
              <Row
                label="26 weeks"
                value={formatChangePercent(returns.twentySixWeek)}
                tone={toneOf(returns.twentySixWeek)}
              />
              <Row
                label="Year to date"
                value={formatChangePercent(returns.yearToDate)}
                tone={toneOf(returns.yearToDate)}
              />
              <Row
                label="52 weeks"
                value={formatChangePercent(returns.fiftyTwoWeek)}
                tone={toneOf(returns.fiftyTwoWeek)}
              />
            </dl>
          </div>
        )}

        {hasRelative && (
          <div>
            <h3 className="mb-1 mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:mt-0 dark:text-zinc-400">
              Versus S&amp;P 500
            </h3>
            <dl className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              <Row
                label="4 weeks"
                value={formatChangePercent(relative.fourWeek)}
                tone={toneOf(relative.fourWeek)}
              />
              <Row
                label="13 weeks"
                value={formatChangePercent(relative.thirteenWeek)}
                tone={toneOf(relative.thirteenWeek)}
              />
              <Row
                label="26 weeks"
                value={formatChangePercent(relative.twentySixWeek)}
                tone={toneOf(relative.twentySixWeek)}
              />
              <Row
                label="Year to date"
                value={formatChangePercent(relative.yearToDate)}
                tone={toneOf(relative.yearToDate)}
              />
              <Row
                label="52 weeks"
                value={formatChangePercent(relative.fiftyTwoWeek)}
                tone={toneOf(relative.fiftyTwoWeek)}
              />
            </dl>
          </div>
        )}
      </div>

      {metrics?.volatility3Month !== null &&
        metrics?.volatility3Month !== undefined && (
          <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">
            3-month daily return volatility:{" "}
            {formatRatio(metrics.volatility3Month)}
          </p>
        )}
    </Section>
  );
}
