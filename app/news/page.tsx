"use client";

import { useEffect, useState } from "react";

interface NewsArticle {
  id: number;
  headline: string;
  datetime: number;
  summary: string;
  url: string;
}

export default function NewsPage() {
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [symbol, setSymbol] = useState("AAPL");
  const [searchSymbol, setSearchSymbol] = useState("AAPL");

  useEffect(() => {
    const fetchNews = async () => {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/news?symbol=${encodeURIComponent(searchSymbol)}`
        );

        if (!response.ok) {
          throw new Error("Failed to fetch news");
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
          throw new Error(data.error || "Invalid news response");
        }

        setNews(data);
      } catch (err) {
        console.error("Error fetching news:", err);
        setNews([]);
        setError("Unable to fetch news. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchNews();
  }, [searchSymbol]);

  const handleSearch = () => {
    const trimmedSymbol = symbol.trim().toUpperCase();

    if (!trimmedSymbol) {
      return;
    }

    setSearchSymbol(trimmedSymbol);
  };

  return (
    <main className="min-h-screen p-6">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-6 text-3xl font-bold">Stock News</h1>

        <div className="mb-6 flex gap-2">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSearch();
              }
            }}
            className="rounded border px-3 py-2"
            placeholder="Enter stock symbol"
          />

          <button
            onClick={handleSearch}
            className="rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
          >
            Search
          </button>
        </div>

        {loading && <p>Loading news...</p>}

        {error && <p className="text-red-500">{error}</p>}

        {!loading && !error && news.length === 0 && (
          <p>No news found for {searchSymbol}.</p>
        )}

        <div className="space-y-4">
          {news.slice(0, 10).map((article) => (
            <article key={article.id} className="rounded border p-4">
              <h2 className="text-xl font-bold">{article.headline}</h2>

              <p className="mt-1 text-sm text-gray-600">
                {new Date(article.datetime * 1000).toLocaleString()}
              </p>

              <p className="mt-2">{article.summary}</p>

              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block text-blue-500 hover:underline"
              >
                Read more
              </a>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}