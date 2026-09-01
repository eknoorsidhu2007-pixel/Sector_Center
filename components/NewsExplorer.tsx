"use client";

import { useCallback, useEffect, useState } from "react";

import CompanySearch from "./CompanySearch";
import NewsList from "./NewsList";
import type {
  CompanyMatch,
  NewsArticle,
  NewsResponse,
  SearchResponse,
} from "@/lib/types";

type FeedStatus = "loading" | "ready" | "error";

interface NewsExplorerProps {
  initialSymbol: string;
}

async function readErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const payload: unknown = await response.json();

    if (
      typeof payload === "object" &&
      payload !== null &&
      "error" in payload &&
      typeof payload.error === "string"
    ) {
      return payload.error;
    }
  } catch {
    // Fall through to the generic message below.
  }

  return fallback;
}

export default function NewsExplorer({ initialSymbol }: NewsExplorerProps) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [company, setCompany] = useState<CompanyMatch | null>(null);
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [status, setStatus] = useState<FeedStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  // Keep the URL shareable even when the page was opened without a symbol.
  useEffect(() => {
    const current = new URLSearchParams(window.location.search).get("symbol");

    if (current?.trim().toUpperCase() !== symbol) {
      window.history.replaceState(null, "", `/news?symbol=${symbol}`);
    }
    // Intentionally only on mount; later changes are handled in handleSelect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      const next = new URLSearchParams(window.location.search)
        .get("symbol")
        ?.trim()
        .toUpperCase();

      if (next) {
        setCompany(null);
        setSymbol(next);
      }
    };

    window.addEventListener("popstate", handlePopState);

    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadNews = async () => {
      setStatus("loading");
      setErrorMessage("");

      try {
        const response = await fetch(
          `/api/news?symbol=${encodeURIComponent(symbol)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error(
            await readErrorMessage(response, "Unable to load news")
          );
        }

        const data = (await response.json()) as NewsResponse;

        setArticles(data.articles);
        setStatus("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("Failed to load news:", error);
        setArticles([]);
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load news"
        );
      }
    };

    void loadNews();

    return () => controller.abort();
  }, [symbol, reloadToken]);

  // Resolve a display name for symbols that arrived from the URL rather than
  // from a selection, so shared links still show the company name.
  useEffect(() => {
    if (company?.symbol === symbol) {
      return;
    }

    const controller = new AbortController();

    const resolveCompany = async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(symbol)}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          return;
        }

        const { results } = (await response.json()) as SearchResponse;
        const exact = results.find((match) => match.symbol === symbol);

        if (exact) {
          setCompany(exact);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("Could not resolve company name:", error);
      }
    };

    void resolveCompany();

    return () => controller.abort();
  }, [symbol, company]);

  const handleSelect = useCallback((match: CompanyMatch) => {
    setCompany(match);
    setSymbol(match.symbol);
    window.history.pushState(
      null,
      "",
      `/news?symbol=${encodeURIComponent(match.symbol)}`
    );
  }, []);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Sector Center
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Search any listed company and read its latest coverage.
        </p>
      </header>

      <CompanySearch
        onSelect={handleSelect}
        selectedSymbol={symbol}
        selectedCompany={company}
      />

      <section className="mt-8" aria-live="polite">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {company?.name ?? symbol}
          </h2>
          <span className="font-mono text-sm text-zinc-500 dark:text-zinc-400">
            {company?.displaySymbol ?? symbol}
          </span>
          {company?.exchange && (
            <span className="text-xs uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
              {company.exchange}
            </span>
          )}
        </div>

        <div className="mt-4">
          {status === "loading" && (
            <div className="space-y-3" aria-hidden="true">
              {[0, 1, 2].map((key) => (
                <div
                  key={key}
                  className="animate-pulse rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  <div className="h-3 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="mt-3 h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
                  <div className="mt-2 h-3 w-full rounded bg-zinc-100 dark:bg-zinc-800/60" />
                </div>
              ))}
            </div>
          )}

          {status === "error" && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/50 dark:bg-red-950/30">
              <p className="text-sm text-red-700 dark:text-red-300">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => setReloadToken((token) => token + 1)}
                className="mt-3 rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-100 dark:border-red-800 dark:text-red-300 dark:hover:bg-red-900/40"
              >
                Try again
              </button>
            </div>
          )}

          {status === "ready" && articles.length === 0 && (
            <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              No news published for {symbol} in the last 7 days.
            </p>
          )}

          {status === "ready" && articles.length > 0 && (
            <NewsList articles={articles} />
          )}
        </div>
      </section>
    </main>
  );
}
