import { formatDateValue, formatLargeNumber } from "@/lib/format";
import type { GovernmentContract } from "@/lib/market";

import Section from "./Section";

interface GovernmentContractsProps {
  contracts: GovernmentContract[];
  lookbackDays: number;
}

const MAX_ROWS = 8;

/**
 * US federal contract awards, sourced from USAspending.
 *
 * Rendered only when the company actually has federal awards, which most
 * non-defence, non-aerospace issuers will not. The page omits the section
 * entirely rather than showing an empty card.
 */
export default function GovernmentContracts({
  contracts,
  lookbackDays,
}: GovernmentContractsProps) {
  if (contracts.length === 0) {
    return null;
  }

  const withValue = contracts.filter((c) => c.totalValue !== null);
  const totalAwarded =
    withValue.length > 0
      ? withValue.reduce((sum, c) => sum + (c.totalValue ?? 0), 0)
      : null;

  return (
    <Section
      title="Government Contracts"
      description={`US federal awards from the last ${lookbackDays} days.`}
      aside={
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {contracts.length} award{contracts.length === 1 ? "" : "s"}
          {totalAwarded !== null && ` · ${formatLargeNumber(totalAwarded, "USD")}`}
        </span>
      }
    >
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
        {contracts.slice(0, MAX_ROWS).map((contract, index) => (
          <li
            key={contract.permalink ?? `${contract.actionDate}-${index}`}
            className="py-3"
          >
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {contract.awardingAgency ?? "Unknown agency"}
              </p>
              <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                {formatLargeNumber(contract.totalValue, "USD")}
              </span>
            </div>

            {contract.description && (
              <p className="mt-1 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
                {contract.description}
              </p>
            )}

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400 dark:text-zinc-500">
              <span>{formatDateValue(contract.actionDate)}</span>
              {contract.performanceState && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{contract.performanceState}</span>
                </>
              )}
              {contract.permalink && (
                <>
                  <span aria-hidden="true">·</span>
                  <a
                    href={contract.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    USAspending
                  </a>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>

      {contracts.length > MAX_ROWS && (
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          Showing {MAX_ROWS} of {contracts.length} awards.
        </p>
      )}
    </Section>
  );
}
