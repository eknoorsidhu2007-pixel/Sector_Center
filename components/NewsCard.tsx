import { formatAbsoluteTime, formatRelativeTime } from "@/lib/format";
import type { NewsArticle } from "@/lib/types";

interface NewsCardProps {
  article: NewsArticle;
}

export default function NewsCard({ article }: NewsCardProps) {
  return (
    <article className="group rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="font-medium text-zinc-700 dark:text-zinc-300">
          {article.source}
        </span>
        <span aria-hidden="true">·</span>
        <time
          dateTime={article.publishedAt}
          title={formatAbsoluteTime(article.publishedAt)}
        >
          {formatRelativeTime(article.publishedAt)}
        </time>
      </div>

      <h3 className="mt-2 text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-100">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 outline-none hover:underline focus-visible:underline"
        >
          {article.headline}
        </a>
      </h3>

      {article.summary && (
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          {article.summary}
        </p>
      )}
    </article>
  );
}
