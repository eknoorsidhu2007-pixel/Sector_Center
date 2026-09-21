"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { NewsResponse, NewsStory } from "@/lib/types";

interface StockNewsPanelProps {
  symbol: string;
  companyName: string;
}

type LoadStatus = "loading" | "ready" | "error";

export default function StockNewsPanel({
  symbol,
  companyName,
}: StockNewsPanelProps) {
  const [stories, setStories] = useState<NewsStory[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");

  useEffect(() => {
    const controller = new AbortController();

    async function loadNews() {
      try {
        const response = await fetch(
          `/api/news?symbol=${encodeURIComponent(symbol)}&days=7`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error("Unable to load news");
        }

        const data = (await response.json()) as NewsResponse;

        setStories(data.stories.slice(0, 3));
        setStatus("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setStatus("error");
      }
    }

    void loadNews();

    return () => controller.abort();
  }, [symbol]);

  return (
    <section
      aria-label={`Latest news for ${companyName}`}
      className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-blue-600 dark:text-blue-400">
            Market Intelligence
          </p>
          <h2 className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
            Latest News
          </h2>
        </div>

        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
          7 days
        </span>
      </div>

      <div className="mt-4">
        {status === "loading" && (
          <div className="space-y-4" aria-label="Loading news">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-20 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900"
              />
            ))}
          </div>
        )}

        {status === "error" && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            News is temporarily unavailable.
          </p>
        )}

        {status === "ready" && stories.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No significant coverage was found this week.
          </p>
        )}

        {status === "ready" && stories.length > 0 && (
          <ol className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {stories.map((story) => (
              <li key={story.id} className="py-4 first:pt-0 last:pb-0">
                <a
                  href={story.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>{story.source}</span>

                    {story.eventTypes[0] && (
                      <span className="rounded-full border border-blue-200 px-2 py-0.5 text-blue-700 dark:border-blue-900 dark:text-blue-300">
                        {story.eventTypes[0]}
                      </span>
                    )}

                    {story.sourceCount > 1 && (
                      <span>{story.sourceCount} sources</span>
                    )}
                  </div>

                  <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-zinc-900 transition group-hover:text-blue-600 dark:text-zinc-100 dark:group-hover:text-blue-400">
                    {story.headline}
                  </h3>

                  {story.summary && (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                      {story.summary}
                    </p>
                  )}
                </a>
              </li>
            ))}
          </ol>
        )}
      </div>

      <Link
        href={`/news?symbol=${encodeURIComponent(symbol)}`}
        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-400"
      >
        View all coverage
        <span aria-hidden="true">&rarr;</span>
      </Link>
    </section>
  );
}