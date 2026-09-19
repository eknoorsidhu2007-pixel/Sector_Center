/**
 * Skeleton shown while the stock page's server-side fetches resolve. Mirrors
 * the real layout's rhythm so the page does not visibly jump on load.
 */
export default function Loading() {
  return (
    <main
      className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6"
      aria-busy="true"
      aria-label="Loading stock data"
    >
      <div className="animate-pulse" aria-hidden="true">
        <div className="mb-6 h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />

        <div className="mb-8">
          <div className="h-7 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-2 h-4 w-72 rounded bg-zinc-100 dark:bg-zinc-800/60" />
        </div>

        <div className="mb-8">
          <div className="h-10 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-2 h-3 w-28 rounded bg-zinc-100 dark:bg-zinc-800/60" />
        </div>

        <div className="mb-8 h-64 w-full rounded-lg bg-zinc-100 dark:bg-zinc-800/60 sm:h-80" />

        {[0, 1, 2].map((key) => (
          <div
            key={key}
            className="mb-8 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
          >
            <div className="h-5 w-40 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="mt-2 h-3 w-64 rounded bg-zinc-100 dark:bg-zinc-800/60" />
            <div className="mt-4 space-y-2">
              <div className="h-3 w-full rounded bg-zinc-100 dark:bg-zinc-800/60" />
              <div className="h-3 w-5/6 rounded bg-zinc-100 dark:bg-zinc-800/60" />
              <div className="h-3 w-4/6 rounded bg-zinc-100 dark:bg-zinc-800/60" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
