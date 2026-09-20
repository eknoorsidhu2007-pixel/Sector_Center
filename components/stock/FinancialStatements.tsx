import { formatDateValue, formatLargeNumber } from "@/lib/format";
import type { FinancialReport, ReportLineItem } from "@/lib/market";

import Section, { EmptyState } from "./Section";

interface FinancialStatementsProps {
  reports: FinancialReport[];
  currency: string;
}

const MAX_LINES = 10;

function periodLabel(report: FinancialReport): string {
  if (report.year !== null && report.quarter !== null && report.quarter > 0) {
    return `Q${report.quarter} ${report.year}`;
  }

  if (report.year !== null) {
    return `FY ${report.year}`;
  }

  return formatDateValue(report.endDate);
}

function StatementTable({
  title,
  lines,
  currency,
}: {
  title: string;
  lines: ReportLineItem[];
  currency: string;
}) {
  const shown = lines.filter((line) => line.label || line.concept).slice(0, MAX_LINES);

  if (shown.length === 0) {
    return null;
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {title}
      </h3>
      <table className="w-full text-left text-sm">
        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {shown.map((line, index) => (
            <tr key={`${line.concept ?? line.label}-${index}`}>
              <td className="py-1.5 pr-3 text-zinc-600 dark:text-zinc-400">
                {line.label ?? line.concept ?? "—"}
              </td>
              <td className="py-1.5 text-right tabular-nums text-zinc-800 dark:text-zinc-200">
                {formatLargeNumber(line.value, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Latest as-reported statements. Labels and concepts are the filer's own;
 * nothing is remapped to a standardized GAAP chart.
 */
export default function FinancialStatements({
  reports,
  currency,
}: FinancialStatementsProps) {
  const latest = reports[0];

  if (!latest) {
    return (
      <Section title="Financial Statements">
        <EmptyState>No as-reported financials available for this symbol.</EmptyState>
      </Section>
    );
  }

  return (
    <Section
      title="Financial Statements"
      description={`As reported for ${periodLabel(latest)}. Line items are the company's own tags, not a standardized model.`}
      aside={
        latest.filedDate ? (
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            Filed {formatDateValue(latest.filedDate)}
          </span>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <StatementTable
          title="Income statement"
          lines={latest.incomeStatement}
          currency={currency}
        />
        <StatementTable
          title="Balance sheet"
          lines={latest.balanceSheet}
          currency={currency}
        />
        <StatementTable
          title="Cash flow"
          lines={latest.cashFlow}
          currency={currency}
        />
      </div>
    </Section>
  );
}
