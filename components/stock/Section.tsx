import type { ReactNode } from "react";

interface SectionProps {
  title: string;
  /** Short line under the title explaining scope or provenance. */
  description?: string;
  /** Rendered at the top right, e.g. a count or a link. */
  aside?: ReactNode;
  children: ReactNode;
}

/** Consistent card shell for every section of the stock page. */
export default function Section({
  title,
  description,
  aside,
  children,
}: SectionProps) {
  return (
    <section className="mb-8" aria-label={title}>
      <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          {aside}
        </div>
        {description && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {description}
          </p>
        )}
        <div className="mt-4">{children}</div>
      </div>
    </section>
  );
}

/** Shown in place of a table when the provider returned nothing. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-zinc-400 dark:text-zinc-500">{children}</p>
  );
}
