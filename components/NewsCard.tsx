import { formatAbsoluteTime, formatRelativeTime } from "@/lib/format";
import type { NewsEventType, NewsStory } from "@/lib/types";

interface NewsCardProps {
  story: NewsStory;
}

const MAJOR_BADGE =
  "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900";
const ANALYST_BADGE =
  "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-900";
const BUSINESS_BADGE =
  "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900";
const LAYOFFS_BADGE =
  "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-900";
const NEUTRAL_BADGE =
  "bg-zinc-100 text-zinc-600 ring-1 ring-inset ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-700";

/** "other" intentionally has no badge — it would be on every third card. */
const EVENT_BADGES: Partial<Record<NewsEventType, { label: string; className: string }>> = {
  earnings: { label: "Earnings", className: MAJOR_BADGE },
  guidance: { label: "Guidance", className: MAJOR_BADGE },
  mna: { label: "M&A", className: MAJOR_BADGE },
  regulatory: { label: "Regulatory", className: MAJOR_BADGE },
  management: { label: "Management", className: MAJOR_BADGE },
  analyst: { label: "Analyst", className: ANALYST_BADGE },
  product: { label: "Product", className: BUSINESS_BADGE },
  partnership: { label: "Partnership", className: BUSINESS_BADGE },
  "capital-return": { label: "Capital Return", className: BUSINESS_BADGE },
  layoffs: { label: "Layoffs", className: LAYOFFS_BADGE },
  macro: { label: "Macro", className: NEUTRAL_BADGE },
  opinion: { label: "Opinion", className: NEUTRAL_BADGE },
};

export default function NewsCard({ story }: NewsCardProps) {
  // eventTypes arrive weight-ordered from the pipeline; show at most two.
  const badges = story.eventTypes
    .filter((type) => EVENT_BADGES[type])
    .slice(0, 2);
  const otherArticles = story.articles.filter((article) => article.url !== story.url);
  const wasUpdated =
    Date.parse(story.latestPublishedAt) - Date.parse(story.publishedAt) > 60 * 60 * 1000;

  return (
    <article className="group rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          {story.source}
        </span>
        <span aria-hidden="true">·</span>
        <time dateTime={story.publishedAt} title={formatAbsoluteTime(story.publishedAt)}>
          {formatRelativeTime(story.publishedAt)}
        </time>
        {wasUpdated && story.sourceCount > 1 && (
          <>
            <span aria-hidden="true">·</span>
            <span title={formatAbsoluteTime(story.latestPublishedAt)}>
              updated {formatRelativeTime(story.latestPublishedAt)}
            </span>
          </>
        )}
        {story.sourceCount > 1 && (
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {story.sourceCount} sources
          </span>
        )}
        {badges.length > 0 && (
          <span className="flex gap-1.5">
            {badges.map((type) => {
              const badge = EVENT_BADGES[type];

              return (
                <span
                  key={type}
                  className={`rounded-full px-2 py-0.5 font-medium ${badge?.className ?? ""}`}
                >
                  {badge?.label}
                </span>
              );
            })}
          </span>
        )}
      </div>

      <h3 className="mt-2 text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
        <a
          href={story.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 outline-none hover:underline focus-visible:underline"
        >
          {story.headline}
        </a>
      </h3>

      {story.summary && (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {story.summary}
        </p>
      )}

      {otherArticles.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer select-none text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-700 hover:underline dark:text-zinc-400 dark:hover:text-zinc-200">
            {otherArticles.length} more{" "}
            {otherArticles.length === 1 ? "report" : "reports"} from{" "}
            {story.sources.filter((source) => source !== story.source).join(", ") || story.source}
          </summary>
          <ul className="mt-2 space-y-2 border-l-2 border-zinc-100 pl-3 dark:border-zinc-800">
            {otherArticles.map((article) => (
              <li key={article.id} className="text-xs">
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-zinc-700 underline-offset-2 hover:underline dark:text-zinc-300"
                >
                  {article.headline}
                </a>
                <span className="mt-0.5 block text-zinc-400 dark:text-zinc-500">
                  {article.source} ·{" "}
                  <time dateTime={article.publishedAt} title={formatAbsoluteTime(article.publishedAt)}>
                    {formatRelativeTime(article.publishedAt)}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </article>
  );
}
