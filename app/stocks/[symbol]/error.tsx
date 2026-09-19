"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Route-level error boundary. The stock page settles each section
 * independently, so reaching this means something outside those fetches
 * failed: a provider misconfiguration, or an unexpected render error.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Stock page failed:", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-6">
        <Link
          href="/"
          className="text-sm text-zinc-400 transition hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        >
          &larr; Sector Center
        </Link>
      </nav>

      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/30">
        <h1 className="text-lg font-semibold text-red-800 dark:text-red-200">
          This page could not be loaded
        </h1>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
          The market data provider may be unavailable or rate-limited. Trying
          again usually resolves it.
        </p>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/40"
          >
            Try again
          </button>
          <Link
            href="/news"
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/40"
          >
            Browse news instead
          </Link>
        </div>
      </div>
    </main>
  );
}
