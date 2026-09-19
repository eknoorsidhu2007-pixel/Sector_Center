import { formatDateValue, formatLargeNumber, formatPrice, formatVolume } from "@/lib/format";
import type { InsiderTransaction, InsiderTransactionKind } from "@/lib/market";

import Section, { EmptyState } from "./Section";

interface InsiderActivityProps {
  transactions: InsiderTransaction[];
  lookbackDays: number;
  currency: string;
}

const MAX_ROWS = 12;

const KIND_LABELS: Record<InsiderTransactionKind, string> = {
  "open-market-buy": "Buy",
  "open-market-sell": "Sell",
  grant: "Grant",
  "option-exercise": "Exercise",
  "tax-or-disposition": "Tax/Disposal",
  gift: "Gift",
  other: "Other",
};

const KIND_STYLES: Record<InsiderTransactionKind, string> = {
  "open-market-buy":
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  "open-market-sell":
    "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
  grant: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  "option-exercise":
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  "tax-or-disposition":
    "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  gift: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  other: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

/**
 * Insider transactions, with open-market trades summarised separately from
 * compensation activity.
 *
 * The summary deliberately counts only codes P and S. Grants vesting and
 * option exercises are acquisitions too, but including them would turn
 * routine compensation into an apparent buying signal.
 */
export default function InsiderActivity({
  transactions,
  lookbackDays,
  currency,
}: InsiderActivityProps) {
  if (transactions.length === 0) {
    return (
      <Section
        title="Insider Activity"
        description={`No insider transactions filed in the last ${lookbackDays} days.`}
      >
        <EmptyState>
          Nothing to show. Insiders may simply not have traded in this window.
        </EmptyState>
      </Section>
    );
  }

  const openMarket = transactions.filter(
    (tx) => tx.kind === "open-market-buy" || tx.kind === "open-market-sell"
  );

  const buys = openMarket.filter((tx) => tx.kind === "open-market-buy");
  const sells = openMarket.filter((tx) => tx.kind === "open-market-sell");

  const sumValue = (rows: InsiderTransaction[]): number | null => {
    const known = rows.filter((tx) => tx.value !== null);

    // If no row had both a price and a share count, we cannot state a total.
    return known.length > 0
      ? known.reduce((total, tx) => total + (tx.value ?? 0), 0)
      : null;
  };

  const buyValue = sumValue(buys);
  const sellValue = sumValue(sells);

  return (
    <Section
      title="Insider Activity"
      description={`Form 3/4/5 filings from the last ${lookbackDays} days.`}
      aside={
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {transactions.length} transaction
          {transactions.length === 1 ? "" : "s"}
        </span>
      }
    >
      {openMarket.length > 0 ? (
        <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-zinc-200 bg-zinc-200 dark:border-zinc-800 dark:bg-zinc-800">
          <div className="bg-white px-4 py-3 dark:bg-zinc-950">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Open-market buys
            </dt>
            <dd className="mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {buys.length}
              {buyValue !== null && (
                <span className="ml-1 font-normal text-zinc-500 dark:text-zinc-400">
                  ({formatLargeNumber(buyValue, currency)})
                </span>
              )}
            </dd>
          </div>
          <div className="bg-white px-4 py-3 dark:bg-zinc-950">
            <dt className="text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              Open-market sells
            </dt>
            <dd className="mt-1 text-sm font-semibold text-red-600 dark:text-red-400">
              {sells.length}
              {sellValue !== null && (
                <span className="ml-1 font-normal text-zinc-500 dark:text-zinc-400">
                  ({formatLargeNumber(sellValue, currency)})
                </span>
              )}
            </dd>
          </div>
        </div>
      ) : (
        <p className="mb-5 text-sm text-zinc-500 dark:text-zinc-400">
          No open-market buys or sells in this window. The transactions below
          are grants, exercises, or other non-discretionary activity.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
              <th scope="col" className="py-2 pr-3 font-medium">
                Insider
              </th>
              <th scope="col" className="py-2 pr-3 font-medium">
                Type
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Shares
              </th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">
                Price
              </th>
              <th scope="col" className="py-2 text-right font-medium">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {transactions.slice(0, MAX_ROWS).map((tx, index) => (
              <tr key={`${tx.name}-${tx.transactionDate}-${index}`}>
                <td className="py-2 pr-3 text-zinc-700 dark:text-zinc-300">
                  {tx.name}
                  {tx.isDerivative && (
                    <span className="ml-1 text-xs text-zinc-400 dark:text-zinc-500">
                      (derivative)
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${KIND_STYLES[tx.kind]}`}
                    title={
                      tx.transactionCode
                        ? `SEC code ${tx.transactionCode}`
                        : undefined
                    }
                  >
                    {KIND_LABELS[tx.kind]}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                  {tx.change === null
                    ? "—"
                    : `${tx.change > 0 ? "+" : "−"}${formatVolume(Math.abs(tx.change))}`}
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                  {formatPrice(tx.price, currency)}
                </td>
                <td className="py-2 text-right text-zinc-500 dark:text-zinc-400">
                  {formatDateValue(tx.transactionDate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {transactions.length > MAX_ROWS && (
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          Showing {MAX_ROWS} of {transactions.length} transactions.
        </p>
      )}
    </Section>
  );
}
