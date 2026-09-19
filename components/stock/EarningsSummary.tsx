import { formatChangePercent, formatDateValue, formatPrice } from "@/lib/format";
import type { EarningsEvent, EarningsSurprise } from "@/lib/market";

import Section, { EmptyState } from "./Section";

interface EarningsSummaryProps {
  surprises: EarningsSurprise[];
  calendar: EarningsEvent[];
  currency: string;
}

const HOUR_LABELS: Record<string, string> = {
  bmo: "before market open",
  amc: "after market close",
  dmh: "during market hours",
};

function nextRelease(calendar: EarningsEvent[]): EarningsEvent | null {
  const today = new Date().toISOString().slice(0, 10);

  // Calendar is ascending, so the first entry at or after today is next.
  return (
    calendar.find((event) => event.date !== null && event.date >= today) ?? null
  );
}

export default function EarningsSummary({
  surprises,
  calendar,
  currency,
}: EarningsSummaryProps) {
  const upcoming = nextRelease(calendar);

  if (surprises.length === 0 && upcoming === null) {
    return (
      <Section title="Earnings">
        <EmptyState>No earnings data available for this symbol.</EmptyState>
      </Section>
    );
  }

  return (
    <Section
      title="Earnings"
      description="Reported EPS versus consensus estimate, most recent first."
    >
      {upcoming && (
        <div className="mb-5 rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
            Next expected release
          </p>
          <p className="mt-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {formatDateValue(upcoming.date)}
            {upcoming.hour && HOUR_LABELS[upcoming.hour] && (
              <span className="ml-1 font-normal text-zinc-500 dark:text-zinc-400">
                {HOUR_LABELS[upcoming.hour]}
              </span>
            )}
          </p>
          {upcoming.epsEstimate !== null && (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Consensus EPS estimate {formatPrice(upcoming.epsEstimate, currency)}
              {upcoming.quarter !== null &&
                upcoming.year !== null &&
                ` for Q${upcoming.quarter} ${upcoming.year}`}
            </p>
          )}
        </div>
      )}

      {surprises.length === 0 ? (
        <EmptyState>No reported earnings history available.</EmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
                <th scope="col" className="py-2 pr-3 font-medium">
                  Quarter
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Actual
                </th>
                <th scope="col" className="py-2 pr-3 text-right font-medium">
                  Estimate
                </th>
                <th scope="col" className="py-2 text-right font-medium">
                  Surprise
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {surprises.map((row) => {
                const beat = row.surprise !== null && row.surprise >= 0;

                return (
                  <tr key={`${row.year}-${row.quarter}-${row.period}`}>
                    <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                      {row.quarter !== null && row.year !== null
                        ? `Q${row.quarter} ${row.year}`
                        : formatDateValue(row.period)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                      {formatPrice(row.epsActual, currency)}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                      {formatPrice(row.epsEstimate, currency)}
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums font-medium ${
                        row.surprisePercent === null
                          ? "text-zinc-400 dark:text-zinc-500"
                          : beat
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formatChangePercent(row.surprisePercent)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
        The current plan returns the last four quarters of surprise history.
      </p>
    </Section>
  );
}
