"use client";

import { useEffect, useRef, useState } from "react";
import {
  createChart,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type LineData,
  type Time,
} from "lightweight-charts";

import type { Candle, CandleRange } from "@/lib/market/types";

const RANGES: { label: string; value: CandleRange }[] = [
  { label: "1D", value: "1D" },
  { label: "1M", value: "1M" },
  { label: "6M", value: "6M" },
  { label: "1Y", value: "1Y" },
  { label: "MAX", value: "MAX" },
];

type ChartStatus = "loading" | "ready" | "error";

interface PriceChartProps {
  symbol: string;
}

export default function PriceChart({ symbol }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  const [range, setRange] = useState<CandleRange>("1M");
  const [status, setStatus] = useState<ChartStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  // Create / destroy the chart instance.
  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: isDark ? "#a1a1aa" : "#71717a",
        fontFamily: "inherit",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: isDark ? "#27272a" : "#e4e4e7" },
        horzLines: { color: isDark ? "#27272a" : "#e4e4e7" },
      },
      crosshair: {
        vertLine: { color: isDark ? "#52525b" : "#a1a1aa" },
        horzLine: { color: isDark ? "#52525b" : "#a1a1aa" },
      },
      timeScale: {
        borderColor: isDark ? "#27272a" : "#e4e4e7",
      },
      rightPriceScale: {
        borderColor: isDark ? "#27272a" : "#e4e4e7",
      },
    });

    const series = chart.addSeries(LineSeries, {
      color: "#2563eb",
      lineWidth: 2,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });

    chartRef.current = chart;
    seriesRef.current = series;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // Fetch candle data when range or reload token changes. The fetch is
  // defined inside the effect so the set-state-in-effect rule does not fire;
  // the retry button increments reloadToken to re-trigger this effect.
  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      try {
        const response = await fetch(
          `/api/stocks/${encodeURIComponent(symbol)}/candles?range=${range}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          const body = (await response.json()) as { error?: string };

          throw new Error(body.error ?? "Unable to load chart data");
        }

        const { candles } = (await response.json()) as { candles: Candle[] };

        if (!seriesRef.current) {
          return;
        }

        const data: LineData<Time>[] = candles.map((candle) => ({
          time: candle.time as Time,
          value: candle.close,
        }));

        seriesRef.current.setData(data);
        chartRef.current?.timeScale().fitContent();
        setStatus("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("Chart data failed:", error);
        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "Unable to load chart data"
        );
      }
    };

    void load();

    return () => controller.abort();
  }, [symbol, range, reloadToken]);

  const handleRangeChange = (newRange: CandleRange) => {
    setStatus("loading");
    setErrorMessage("");
    setRange(newRange);
  };

  return (
    <div>
      {/* Range selector */}
      <div className="mb-3 flex gap-1" role="group" aria-label="Chart range">
        {RANGES.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            onClick={() => handleRangeChange(value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
              range === value
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Chart container */}
      <div className="relative">
        <div
          ref={containerRef}
          className="h-64 w-full sm:h-80"
          aria-label={`Price chart for ${symbol}`}
          role="img"
        />

        {status === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 dark:bg-zinc-950/60">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-700 dark:border-t-zinc-300" />
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatus("loading");
                  setErrorMessage("");
                  setReloadToken((token) => token + 1);
                }}
                className="mt-2 rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
