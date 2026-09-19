import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getMarketData } from "@/lib/market";
import type { CompanyProfile, KeyMetrics, Quote } from "@/lib/market";
import {
  formatChange,
  formatChangePercent,
  formatDateValue,
  formatLargeNumber,
  formatPercentValue,
  formatPrice,
  formatRatio,
  formatVolume,
} from "@/lib/format";
import { normalizeSymbol } from "@/lib/validation";

export async function generateMetadata(
  props: PageProps<"/stocks/[symbol]">
): Promise<Metadata> {
  const { symbol: raw } = await props.params;
  const symbol = normalizeSymbol(raw);

  if (!symbol) {
    return { title: "Stock not found — Sector Center" };
  }

  const name = await getMarketData().resolveCompanyName(symbol);
  const label = name ? `${name} (${symbol})` : symbol;

  return {
    title: `${label} — Sector Center`,
    description: `Price, key metrics, and latest news for ${label}.`,
  };
}

export default async function StockPage(props: PageProps<"/stocks/[symbol]">) {
  const { symbol: raw } = await props.params;
  const symbol = normalizeSymbol(raw);

  if (!symbol) {
    notFound();
  }

  const market = getMarketData();

  const [quoteResult, profileResult, metricsResult] = await Promise.allSettled([
    market.getQuote(symbol),
    market.getProfile(symbol),
    market.getKeyMetrics(symbol),
  ]);

  const quote: Quote | null =
    quoteResult.status === "fulfilled" ? quoteResult.value : null;
  const profile: CompanyProfile | null =
    profileResult.status === "fulfilled" ? profileResult.value : null;
  const metrics: KeyMetrics | null =
    metricsResult.status === "fulfilled" ? metricsResult.value : null;

  // Finnhub returns empty objects for symbols that pass format validation but
  // do not exist. If there is no price and no company name, treat it as a 404.
  if (!quote && !profile && !metrics) {
    notFound();
  }

  const symbolExists =
    (quote?.currentPrice != null && quote.currentPrice > 0) ||
    profile?.name != null;

  if (!symbolExists) {
    notFound();
  }

  const companyName = profile?.name ?? symbol;
  const currency = profile?.currency ?? "USD";
  const isPositive = (quote?.change ?? 0) >= 0;

  // Historical context — derived from data already on this page, no extra
  // API calls. Each line is omitted when its inputs are null.
  const currentPrice = quote?.currentPrice ?? null;
  const week52High = metrics?.week52High ?? null;
  const week52Low = metrics?.week52Low ?? null;

  const pctBelowHigh =
    currentPrice !== null && week52High !== null && week52High > 0
      ? ((week52High - currentPrice) / week52High) * 100
      : null;

  const pctAboveLow =
    currentPrice !== null && week52Low !== null && week52Low > 0
      ? ((currentPrice - week52Low) / week52Low) * 100
      : null;

  const hasContext = pctBelowHigh !== null || pctAboveLow !== null;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/"
          className="text-sm text-zinc-400 transition hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          &larr; Sector Center
        </Link>
      </nav>

      {/* Company header */}
      <header className="mb-8">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {companyName}
          </h1>
          <span className="font-mono text-lg text-zinc-500 dark:text-zinc-400">
            {symbol}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
          {profile?.exchange && <span>{profile.exchange}</span>}
          {profile?.industry && (
            <>
              <span aria-hidden="true">·</span>
              <span>{profile.industry}</span>
            </>
          )}
          {profile?.country && (
            <>
              <span aria-hidden="true">·</span>
              <span>{profile.country}</span>
            </>
          )}
        </div>
      </header>

      {/* Price section */}
      <section className="mb-8" aria-label="Price">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <span className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            {formatPrice(quote?.currentPrice ?? null, currency)}
          </span>
          {quote?.change != null && (
            <span
              className={`text-lg font-medium ${
                isPositive
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatChange(quote.change)} ({formatChangePercent(quote.changePercent)})
            </span>
          )}
        </div>
        {quote?.timestamp && (
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
            As of {formatDateValue(quote.timestamp)}
          </p>
        )}
      </section>

      {/* Key metrics grid */}
      <section className="mb-8" aria-label="Key metrics">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-800">
          <MetricCell label="Market Cap" value={formatLargeNumber(profile?.marketCap ?? null, currency)} />
          <MetricCell
            label="52W High"
            value={formatPrice(metrics?.week52High ?? null, currency)}
            sub={formatDateValue(metrics?.week52HighDate ?? null)}
          />
          <MetricCell
            label="52W Low"
            value={formatPrice(metrics?.week52Low ?? null, currency)}
            sub={formatDateValue(metrics?.week52LowDate ?? null)}
          />
          <MetricCell label="P/E (TTM)" value={formatRatio(metrics?.peRatioTTM ?? null)} />
          <MetricCell label="EPS (TTM)" value={formatPrice(metrics?.epsTTM ?? null, currency)} />
          <MetricCell label="Beta" value={formatRatio(metrics?.beta ?? null)} />
          <MetricCell label="Div Yield" value={formatPercentValue(metrics?.dividendYieldAnnual ?? null)} />
          <MetricCell label="Avg Vol (10D)" value={formatVolume(metrics?.avgVolume10Day ?? null)} />
          <MetricCell label="Shares Out" value={formatVolume(profile?.sharesOutstanding ?? null)} />
        </div>
      </section>

      {/* Historical context */}
      {hasContext && (
        <section className="mb-8" aria-label="Historical context">
          <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Historical Context
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              {pctBelowHigh !== null && (
                <li>
                  {pctBelowHigh < 0.005
                    ? "At 52-week high"
                    : `${pctBelowHigh.toFixed(1)}% below 52-week high of ${formatPrice(week52High, currency)}`}
                </li>
              )}
              {pctAboveLow !== null && (
                <li>
                  {pctAboveLow < 0.005
                    ? "At 52-week low"
                    : `${pctAboveLow.toFixed(1)}% above 52-week low of ${formatPrice(week52Low, currency)}`}
                </li>
              )}
            </ul>
          </div>
        </section>
      )}

      {/* News section */}
      <section aria-label="News">
        <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Latest News
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Ranked, deduplicated coverage of {companyName} from the past 7 days.
          </p>
          <Link
            href={`/news?symbol=${encodeURIComponent(symbol)}`}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-zinc-200 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            View latest news
            <span aria-hidden="true">&rarr;</span>
          </Link>
        </div>
      </section>
    </main>
  );
}

function MetricCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="bg-white px-4 py-3 dark:bg-zinc-950">
      <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {value}
      </dd>
      {sub && sub !== "—" && (
        <dd className="text-xs text-zinc-400 dark:text-zinc-500">{sub}</dd>
      )}
    </div>
  );
}
