"use client";

import { useState } from "react";

import NewsCard from "./NewsCard";
import { formatAbsoluteTime, formatRelativeTime } from "@/lib/format";
import type { NewsArticle, NewsStory } from "@/lib/types";

interface NewsListProps {
  stories: NewsStory[];
  peripheral: NewsArticle[];
  peripheralCount: number;
  companyLabel: string;
}

export default function NewsList({
  stories,
  peripheral,
  peripheralCount,
  companyLabel,
}: NewsListProps) {
  const [showPeripheral, setShowPeripheral] = useState(false);

  return (
    <div>
      {stories.length > 0 && (
        <div className="space-y-3">
          {stories.map((story) => (
            <NewsCard key={story.id} story={story} />
          ))}
        </div>
      )}

      {peripheralCount > 0 && (
        <div className="mt-8 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <button
            type="button"
            aria-expanded={showPeripheral}
            onClick={() => setShowPeripheral((open) => !open)}
            className="flex w-full items-center justify-between rounded-md px-1 py-1.5 text-left text-sm font-medium text-zinc-500 transition hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            <span>
              {showPeripheral ? "Hide" : "Show"} peripheral coverage (
              {peripheralCount})
            </span>
            <span aria-hidden="true" className="text-xs">
              {showPeripheral ? "▲" : "▼"}
            </span>
          </button>
          <p className="mt-1 px-1 text-xs text-zinc-400 dark:text-zinc-500">
            Market roundups and stories that may only mention {companyLabel} in
            passing.
          </p>

          {showPeripheral && (
            <ul className="mt-3 space-y-2.5">
              {peripheral.map((article) => (
                <li key={article.id} className="text-sm">
                  <a
                    href={article.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium leading-snug text-zinc-600 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
                  >
                    {article.headline}
                  </a>
                  <span className="mt-0.5 block text-xs text-zinc-400 dark:text-zinc-500">
                    {article.source} ·{" "}
                    <time
                      dateTime={article.publishedAt}
                      title={formatAbsoluteTime(article.publishedAt)}
                    >
                      {formatRelativeTime(article.publishedAt)}
                    </time>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {showPeripheral && peripheralCount > peripheral.length && (
            <p className="mt-3 px-1 text-xs text-zinc-400 dark:text-zinc-500">
              Showing the {peripheral.length} most recent of {peripheralCount}{" "}
              peripheral articles.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
