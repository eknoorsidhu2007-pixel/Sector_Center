import { formatDateValue } from "@/lib/format";
import type { SecFiling } from "@/lib/market";

import Section, { EmptyState } from "./Section";

interface FilingsListProps {
  filings: SecFiling[];
}

const MAX_ROWS = 10;

/** Plain-language gloss for the forms a reader is most likely to care about. */
const FORM_DESCRIPTIONS: Record<string, string> = {
  "10-K": "Annual report",
  "10-Q": "Quarterly report",
  "8-K": "Material event",
  "DEF 14A": "Proxy statement",
  "4": "Insider transaction",
  "3": "Initial insider holdings",
  "5": "Annual insider statement",
  "13F-HR": "Institutional holdings",
  SC13D: "Activist stake",
  SC13G: "Passive stake",
  "S-1": "Registration statement",
  "S-3": "Shelf registration",
  "S-8": "Employee benefit plan",
  "424B5": "Prospectus supplement",
  "6-K": "Foreign issuer report",
  "20-F": "Foreign annual report",
  "11-K": "Employee plan annual report",
  "144": "Proposed insider sale",
  SD: "Specialized disclosure",
  "25-NSE": "Exchange delisting notice",
  "SC 13D": "Activist stake",
  "SC 13G": "Passive stake",
};

export default function FilingsList({ filings }: FilingsListProps) {
  if (filings.length === 0) {
    return (
      <Section title="SEC Filings">
        <EmptyState>No filings available for this symbol.</EmptyState>
      </Section>
    );
  }

  return (
    <Section
      title="SEC Filings"
      description="Most recent filings, newest first."
      aside={
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          via EDGAR
        </span>
      }
    >
      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
        {filings.slice(0, MAX_ROWS).map((filing, index) => {
          const description = filing.form
            ? FORM_DESCRIPTIONS[filing.form]
            : undefined;
          const href = filing.reportUrl ?? filing.filingUrl;

          return (
            <li
              key={filing.accessNumber ?? `${filing.form}-${index}`}
              className="flex items-baseline justify-between gap-4 py-2.5"
            >
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {filing.form ?? "—"}
                  </span>
                  {description && (
                    <span className="truncate text-sm text-zinc-500 dark:text-zinc-400">
                      {description}
                    </span>
                  )}
                </div>
                {filing.accessNumber && (
                  <p className="font-mono text-xs text-zinc-400 dark:text-zinc-500">
                    {filing.accessNumber}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-baseline gap-3">
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formatDateValue(filing.filedDate)}
                </span>
                {href && (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Open
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {filings.length > MAX_ROWS && (
        <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
          Showing {MAX_ROWS} of {filings.length} filings.
        </p>
      )}
    </Section>
  );
}
