"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import type { CompanyMatch, SearchResponse } from "@/lib/types";

const DEBOUNCE_MS = 220;
const SPINNER_DELAY_MS = 150;

type SearchStatus = "idle" | "loading" | "ready" | "error";

interface CompanySearchProps {
  onSelect: (company: CompanyMatch) => void;
  initialQuery?: string;
}

/**
 * Accessible company/ticker combobox following the ARIA combobox pattern.
 *
 * Requests are debounced, superseded requests are aborted, and repeated
 * queries are served from a local cache so backspacing never refetches.
 */
export default function CompanySearch({
  onSelect,
  initialQuery = "",
}: CompanySearchProps) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<CompanyMatch[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [showSpinner, setShowSpinner] = useState(false);

  const listboxId = useId();
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef(new Map<string, CompanyMatch[]>());
  const listRef = useRef<HTMLUListElement | null>(null);
  // Selecting a suggestion rewrites the input; that must not trigger a search.
  const skipNextSearchRef = useRef(false);

  useEffect(() => {
    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }

    const trimmed = query.trim();

    if (!trimmed) {
      setResults([]);
      setStatus("idle");
      setActiveIndex(-1);
      return;
    }

    const cached = cacheRef.current.get(trimmed.toLowerCase());

    if (cached) {
      setResults(cached);
      setStatus("ready");
      setActiveIndex(cached.length > 0 ? 0 : -1);
      return;
    }

    setStatus("loading");

    const timer = setTimeout(() => {
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      const run = async () => {
        try {
          const response = await fetch(
            `/api/search?q=${encodeURIComponent(trimmed)}`,
            { signal: controller.signal }
          );
          const payload: unknown = await response.json();

          if (!response.ok) {
            const message =
              typeof payload === "object" &&
              payload !== null &&
              "error" in payload &&
              typeof payload.error === "string"
                ? payload.error
                : "Search is unavailable";

            throw new Error(message);
          }

          const { results: matches } = payload as SearchResponse;

          cacheRef.current.set(trimmed.toLowerCase(), matches);
          setResults(matches);
          setStatus("ready");
          setActiveIndex(matches.length > 0 ? 0 : -1);
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }

          console.error("Company search failed:", error);
          setResults([]);
          setStatus("error");
          setErrorMessage(
            error instanceof Error ? error.message : "Search is unavailable"
          );
        }
      };

      void run();
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  // Delay the spinner so fast responses don't flash a loading state.
  useEffect(() => {
    if (status !== "loading") {
      setShowSpinner(false);
      return;
    }

    const timer = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS);

    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) {
      return;
    }

    listRef.current.children[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  const handleSelect = useCallback(
    (company: CompanyMatch) => {
      skipNextSearchRef.current = true;
      setQuery(company.name);
      setResults([]);
      setStatus("ready");
      setIsOpen(false);
      setActiveIndex(-1);
      onSelect(company);
    },
    [onSelect]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();

      if (!isOpen) {
        setIsOpen(true);
        return;
      }

      if (results.length === 0) {
        return;
      }

      setActiveIndex((previous) => {
        const next = event.key === "ArrowDown" ? previous + 1 : previous - 1;

        if (next < 0) {
          return results.length - 1;
        }

        return next >= results.length ? 0 : next;
      });

      return;
    }

    if (event.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (results.length === 0 || !isOpen) {
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(results.length - 1);
      return;
    }

    if (event.key === "Enter" && activeIndex >= 0) {
      const company = results[activeIndex];

      if (company) {
        event.preventDefault();
        handleSelect(company);
      }
    }
  };

  const hasQuery = query.trim().length > 0;
  const isExpanded = isOpen && hasQuery;
  const showNoResults =
    isExpanded && status === "ready" && results.length === 0;
  const showError = isExpanded && status === "error";

  const statusMessage = showError
    ? errorMessage
    : showNoResults
      ? "No matching companies"
      : status === "ready" && results.length > 0
        ? `${results.length} ${results.length === 1 ? "result" : "results"} available`
        : "";

  return (
    <div className="relative">
      <label htmlFor="company-search" className="sr-only">
        Search for a company or ticker symbol
      </label>

      <div className="relative">
        <input
          id="company-search"
          type="text"
          role="combobox"
          autoComplete="off"
          aria-expanded={isExpanded}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined
          }
          value={query}
          placeholder="Search a company or ticker, e.g. Apple or AAPL"
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setIsOpen(false)}
          onKeyDown={handleKeyDown}
          className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-3 pr-10 text-base text-zinc-900 shadow-sm outline-none transition focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-400 dark:focus:ring-zinc-100/10"
        />

        {showSpinner && (
          <span
            aria-hidden="true"
            className="absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100"
          />
        )}
      </div>

      <span aria-live="polite" role="status" className="sr-only">
        {statusMessage}
      </span>

      {isExpanded && (results.length > 0 || showNoResults || showError) && (
        <div className="absolute z-10 mt-2 w-full overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          {showError && (
            <p className="px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {errorMessage}
            </p>
          )}

          {showNoResults && (
            <p className="px-4 py-3 text-sm text-zinc-500 dark:text-zinc-400">
              No companies match &ldquo;{query.trim()}&rdquo;
            </p>
          )}

          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label="Company suggestions"
            className="max-h-80 overflow-y-auto"
          >
            {results.map((company, index) => (
              <li
                key={`${company.symbol}-${company.exchange}`}
                id={`${listboxId}-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                // Keeps focus in the input so the list doesn't close before onClick.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(company)}
                onMouseEnter={() => setActiveIndex(index)}
                className={`flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 ${
                  index === activeIndex
                    ? "bg-zinc-100 dark:bg-zinc-800"
                    : "bg-transparent"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {company.name}
                  </span>
                  <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                    {company.exchange}
                    {company.type ? ` · ${company.type}` : ""}
                  </span>
                </span>

                <span className="shrink-0 rounded border border-zinc-200 px-1.5 py-0.5 font-mono text-xs font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                  {company.displaySymbol}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
