import {
  formatDateValue,
  formatLargeNumber,
  formatPercentValue,
  formatPrice,
  formatRatio,
  formatVolume,
} from "@/lib/format";
import type { CompanyProfile, KeyMetrics } from "@/lib/market";

interface MetricGridProps {
  profile: CompanyProfile | null;
  metrics: KeyMetrics | null;
  currency: string;
}

export function MetricCell({
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

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-800">
      {children}
    </dl>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-zinc-500 first:mt-0 dark:text-zinc-400">
      {children}
    </h3>
  );
}

/**
 * Overview, valuation, profitability, growth, and balance-sheet metrics.
 * Every value renders an em-dash when the provider had no figure; nothing is
 * estimated or defaulted.
 */
export default function MetricGrid({
  profile,
  metrics,
  currency,
}: MetricGridProps) {
  const valuation = metrics?.valuation;
  const margins = metrics?.margins;
  const returns = metrics?.returns;
  const growth = metrics?.growth;
  const health = metrics?.health;
  const dividend = metrics?.dividend;

  return (
    <div>
      <GroupLabel>Overview</GroupLabel>
      <Grid>
        <MetricCell
          label="Market Cap"
          value={formatLargeNumber(profile?.marketCap ?? null, currency)}
        />
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
        <MetricCell
          label="Avg Vol (10D)"
          value={formatVolume(metrics?.avgVolume10Day ?? null)}
        />
        <MetricCell
          label="Shares Out"
          value={formatVolume(profile?.sharesOutstanding ?? null)}
        />
        <MetricCell label="Beta" value={formatRatio(metrics?.beta ?? null)} />
      </Grid>

      <GroupLabel>Valuation</GroupLabel>
      <Grid>
        <MetricCell label="P/E (TTM)" value={formatRatio(valuation?.peTTM ?? null)} />
        <MetricCell label="Forward P/E" value={formatRatio(valuation?.forwardPE ?? null)} />
        <MetricCell label="PEG (TTM)" value={formatRatio(valuation?.pegTTM ?? null)} />
        <MetricCell label="P/S (TTM)" value={formatRatio(valuation?.priceToSalesTTM ?? null)} />
        <MetricCell label="P/B" value={formatRatio(valuation?.priceToBook ?? null)} />
        <MetricCell label="EV/EBITDA" value={formatRatio(valuation?.evToEbitdaTTM ?? null)} />
        <MetricCell label="EV/Revenue" value={formatRatio(valuation?.evToRevenueTTM ?? null)} />
        <MetricCell
          label="Enterprise Value"
          value={formatLargeNumber(valuation?.enterpriseValue ?? null, currency)}
        />
        <MetricCell label="EPS (TTM)" value={formatPrice(metrics?.epsTTM ?? null, currency)} />
      </Grid>

      <GroupLabel>Profitability</GroupLabel>
      <Grid>
        <MetricCell label="Gross Margin" value={formatPercentValue(margins?.grossMarginTTM ?? null)} />
        <MetricCell label="Operating Margin" value={formatPercentValue(margins?.operatingMarginTTM ?? null)} />
        <MetricCell label="Net Margin" value={formatPercentValue(margins?.netMarginTTM ?? null)} />
        <MetricCell label="ROE (TTM)" value={formatPercentValue(returns?.roeTTM ?? null)} />
        <MetricCell label="ROA (TTM)" value={formatPercentValue(returns?.roaTTM ?? null)} />
        <MetricCell label="ROI (TTM)" value={formatPercentValue(returns?.roiTTM ?? null)} />
      </Grid>

      <GroupLabel>Growth</GroupLabel>
      <Grid>
        <MetricCell label="Revenue YoY" value={formatPercentValue(growth?.revenueGrowthTTMYoy ?? null)} />
        <MetricCell label="Revenue 3Y" value={formatPercentValue(growth?.revenueGrowth3Y ?? null)} />
        <MetricCell label="Revenue 5Y" value={formatPercentValue(growth?.revenueGrowth5Y ?? null)} />
        <MetricCell label="EPS YoY" value={formatPercentValue(growth?.epsGrowthTTMYoy ?? null)} />
        <MetricCell label="EPS 3Y" value={formatPercentValue(growth?.epsGrowth3Y ?? null)} />
        <MetricCell label="EBITDA CAGR 5Y" value={formatPercentValue(growth?.ebitdaCagr5Y ?? null)} />
      </Grid>

      <GroupLabel>Balance Sheet &amp; Dividend</GroupLabel>
      <Grid>
        <MetricCell label="Current Ratio" value={formatRatio(health?.currentRatioQuarterly ?? null)} />
        <MetricCell label="Quick Ratio" value={formatRatio(health?.quickRatioQuarterly ?? null)} />
        <MetricCell
          label="Debt/Equity"
          value={formatRatio(health?.totalDebtToEquityQuarterly ?? null)}
        />
        <MetricCell
          label="Interest Coverage"
          value={formatRatio(health?.netInterestCoverageTTM ?? null)}
        />
        <MetricCell
          label="Div Yield"
          value={formatPercentValue(dividend?.yieldIndicatedAnnual ?? null)}
        />
        <MetricCell
          label="Payout Ratio"
          value={formatPercentValue(dividend?.payoutRatioTTM ?? null)}
        />
      </Grid>
    </div>
  );
}
