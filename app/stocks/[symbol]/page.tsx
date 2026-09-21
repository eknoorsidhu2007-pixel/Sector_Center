import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import PriceChart from "@/components/PriceChart";
import AnalystRatings from "@/components/stock/AnalystRatings";
import EarningsSummary from "@/components/stock/EarningsSummary";
import FilingsList from "@/components/stock/FilingsList";
import FinancialStatements from "@/components/stock/FinancialStatements";
import GovernmentContracts from "@/components/stock/GovernmentContracts";
import HistoricalContext from "@/components/stock/HistoricalContext";
import InsiderActivity from "@/components/stock/InsiderActivity";
import MetricGrid from "@/components/stock/MetricGrid";
import PeerComparison from "@/components/stock/PeerComparison";
import Section from "@/components/stock/Section";
import StockNewsPanel from "@/components/stock/StockNewsPanel";
import {
  formatChange,
  formatChangePercent,
  formatDateValue,
  formatPrice,
} from "@/lib/format";
import { getMarketData } from "@/lib/market";
import { normalizeSymbol } from "@/lib/validation";

const INSIDER_LOOKBACK_DAYS = 180;
const CONTRACT_LOOKBACK_DAYS = 365;
const EARNINGS_PAST_DAYS = 120;
const EARNINGS_FUTURE_DAYS = 120;

/** Unwraps an allSettled result, logging and nulling out failures. */
function settled<T>(
  result: PromiseSettledResult<T>,
  label: string,
  symbol: string
): T | null {
  if (result.status === "fulfilled") {
    return result.value;
  }

  console.error(`${label} unavailable for ${symbol}:`, result.reason);

  return null;
}

export async function generateMetadata(
  props: PageProps<"/stocks/[symbol]">
): Promise<Metadata> {
  const { symbol: raw } = await props.params;
  const symbol = normalizeSymbol(raw);

  if (!symbol) {
    return {
      title: "Stock Not Found | Sector Center",
      description: "The requested stock symbol could not be found.",
    };
  }

  return {
    title: `${symbol} Stock Research | Sector Center`,
    description: `View price data, charts, fundamentals, insider activity, filings, and news for ${symbol}.`,
  };
}

export default async function StockPage(props: PageProps<"/stocks/[symbol]">) {
  const { symbol: raw } = await props.params;
  const symbol = normalizeSymbol(raw);

  if (!symbol) {
    notFound();
  }

  const market = getMarketData();

  // Every section is fetched in parallel and independently settled, so one
  // failing or rate-limited endpoint degrades that section rather than the
  // page. Per-endpoint caching in lib/market/cache.ts means a warm load
  // makes no upstream requests at all.
  const [
    quoteResult,
    profileResult,
    metricsResult,
    peersResult,
    insiderResult,
    sentimentResult,
    filingsResult,
    reportsResult,
    surprisesResult,
    calendarResult,
    recommendResult,
    contractsResult,
  ] = await Promise.allSettled([
    market.getQuote(symbol),
    market.getProfile(symbol),
    market.getKeyMetrics(symbol),
    market.getPeers(symbol),
    market.getInsiderTransactions(symbol, INSIDER_LOOKBACK_DAYS),
    market.getInsiderSentiment(symbol, 12),
    market.getFilings(symbol),
    market.getFinancialReports(symbol, "quarterly", 4),
    market.getEarningsSurprises(symbol),
    market.getEarningsCalendar(symbol, EARNINGS_PAST_DAYS, EARNINGS_FUTURE_DAYS),
    market.getRecommendations(symbol),
    market.getGovernmentContracts(symbol, CONTRACT_LOOKBACK_DAYS),
  ]);

  const quote = settled(quoteResult, "Quote", symbol);
  const profile = settled(profileResult, "Profile", symbol);
  const metrics = settled(metricsResult, "Key metrics", symbol);

  // Finnhub returns empty objects for symbols that pass format validation but
  // do not exist. If there is no price and no company name, treat it as a 404.
  const symbolExists =
    (quote?.currentPrice != null && quote.currentPrice > 0) ||
    profile?.name != null;

  if (!symbolExists) {
    notFound();
  }

  const peers = settled(peersResult, "Peers", symbol) ?? [];
  const insiderTransactions = settled(insiderResult, "Insider activity", symbol) ?? [];
  const insiderSentiment = settled(sentimentResult, "Insider sentiment", symbol) ?? [];
  const filings = settled(filingsResult, "Filings", symbol) ?? [];
  const reports = settled(reportsResult, "Financial statements", symbol) ?? [];
  const surprises = settled(surprisesResult, "Earnings surprises", symbol) ?? [];
  const calendar = settled(calendarResult, "Earnings calendar", symbol) ?? [];
  const recommendations = settled(recommendResult, "Recommendations", symbol) ?? [];
  const contracts = settled(contractsResult, "Government contracts", symbol) ?? [];

  const companyName = profile?.name ?? symbol;
  const currency = profile?.currency ?? "USD";
  const isPositive = (quote?.change ?? 0) >= 0;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/"
          className="text-sm text-zinc-400 transition hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          &larr; Sector Center
        </Link>
      </nav>

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

      <div className="mb-8 grid items-start gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
  <section className="min-w-0" aria-label="Price chart">
    <PriceChart symbol={symbol} />
  </section>

  <aside className="space-y-6" aria-label="Company intelligence">
    <StockNewsPanel symbol={symbol} companyName={companyName} />

    {contracts.length > 0 && (
      <div className="[&>section]:mb-0">
        <GovernmentContracts
          contracts={contracts}
          lookbackDays={CONTRACT_LOOKBACK_DAYS}
          compact
        />
      </div>
    )}

    <div
      aria-label="Advertisement"
      className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-zinc-300 bg-zinc-50/50 dark:border-zinc-800 dark:bg-zinc-950/50"
    >
      <span className="text-xs uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-600">
        Advertisement
      </span>
    </div>
  </aside>
</div>

      <Section
        title="Key Metrics"
        description="Trailing and annual figures. An em-dash means the provider did not report the value."
      >
        <MetricGrid profile={profile} metrics={metrics} currency={currency} />
      </Section>

      <HistoricalContext quote={quote} metrics={metrics} currency={currency} />

      <FinancialStatements reports={reports} currency={currency} />

      <EarningsSummary
        surprises={surprises}
        calendar={calendar}
        currency={currency}
      />

      <AnalystRatings trends={recommendations} />

      <InsiderActivity
        transactions={insiderTransactions}
        sentiment={insiderSentiment}
        lookbackDays={INSIDER_LOOKBACK_DAYS}
        currency={currency}
      />

    

      <FilingsList filings={filings} />

      <PeerComparison peers={peers} industry={profile?.industry ?? null} />

      
    </main>
  );
}
