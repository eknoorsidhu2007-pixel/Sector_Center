"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  createChart,
  HistogramSeries,
  LineSeries,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type HistogramData,
  type LineData,
  type SeriesType,
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

type ChartType = "line" | "candlestick";
type ChartStatus = "loading" | "ready" | "error";

const UP_COLOR = "#16a34a";
const DOWN_COLOR = "#dc2626";
const LINE_COLOR = "#2563eb";

interface PriceChartProps {
  symbol: string;
}

export default function PriceChart({ symbol }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const priceSeriesRef = useRef<ISeriesApi<SeriesType> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  // Retained so toggling line/candlestick redraws without refetching.
  const candlesRef = useRef<Candle[]>([]);

  const [range, setRange] = useState<CandleRange>("1M");
  const [chartType, setChartType] = useState<ChartType>("line");
  const [status, setStatus] = useState<ChartStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [reloadToken, setReloadToken] = useState(0);

  /** Pushes the retained candles into whichever series currently exists. */
  const applyCandles = useCallback(() => {
    const candles = candlesRef.current;
    const priceSeries = priceSeriesRef.current;

    if (!priceSeries || candles.length === 0) {
      return;
    }

    if (chartType === "candlestick") {
      priceSeries.setData(
        candles.map(
          (candle): CandlestickData<Time> => ({
            time: candle.time as Time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
          })
        )
      );
    } else {
      priceSeries.setData(
        candles.map(
          (candle): LineData<Time> => ({
            time: candle.time as Time,
            value: candle.close,
          })
        )
      );
    }

    // Volume bars take their colour from the bar's own direction, so the
    // histogram stays meaningful under the line chart too.
    volumeSeriesRef.current?.setData(
      candles
        .filter((candle) => candle.volume !== null)
        .map(
          (candle): HistogramData<Time> => ({
            time: candle.time as Time,
            value: candle.volume as number,
            color:
              candle.close >= candle.open
                ? `${UP_COLOR}55`
                : `${DOWN_COLOR}55`,
          })
        )
    );

    chartRef.current?.timeScale().fitContent();
  }, [chartType]);

  // Create the chart and the volume series once.
  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const border = isDark ? "#27272a" : "#e4e4e7";

    const chart = createChart(container, {
      autoSize: true,
      layout: {
        background: { color: "transparent" },
        textColor: isDark ? "#a1a1aa" : "#71717a",
        fontFamily: "inherit",
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: border },
        horzLines: { color: border },
      },
      crosshair: {
        vertLine: { color: isDark ? "#52525b" : "#a1a1aa" },
        horzLine: { color: isDark ? "#52525b" : "#a1a1aa" },
      },
      timeScale: { borderColor: border },
      rightPriceScale: { borderColor: border },
    });

    // Empty priceScaleId makes this an overlay; the scale margins pin it to
    // the bottom fifth so it never competes with the price series.
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
      lastValueVisible: false,
      priceLineVisible: false,
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
    });

    chartRef.current = chart;
    volumeSeriesRef.current = volumeSeries;

    return () => {
      chart.remove();
      chartRef.current = null;
      volumeSeriesRef.current = null;
      priceSeriesRef.current = null;
    };
  }, []);

  // Swap the price series whenever the chart type changes, then redraw from
  // the retained candles so no refetch is needed.
  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return;
    }

    const series =
      chartType === "candlestick"
        ? chart.addSeries(CandlestickSeries, {
            upColor: UP_COLOR,
            downColor: DOWN_COLOR,
            borderUpColor: UP_COLOR,
            borderDownColor: DOWN_COLOR,
            wickUpColor: UP_COLOR,
            wickDownColor: DOWN_COLOR,
          })
        : chart.addSeries(LineSeries, {
            color: LINE_COLOR,
            lineWidth: 2,
            priceFormat: { type: "price", precision: 2, minMove: 0.01 },
          });

    priceSeriesRef.current = series;
    applyCandles();

    return () => {
      // Guard against the chart having been disposed first on unmount.
      if (chartRef.current) {
        chart.removeSeries(series);
      }

      priceSeriesRef.current = null;
    };
  }, [chartType, applyCandles]);

  // Fetch candles. Defined inside the effect so the set-state-in-effect rule
  // stays satisfied; the retry button bumps reloadToken to re-trigger it.
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

        candlesRef.current = candles;
        applyCandles();
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
  }, [symbol, range, reloadToken, applyCandles]);

  const handleRangeChange = (newRange: CandleRange) => {
    if (newRange === range) {
      return;
    }

    setStatus("loading");
    setErrorMessage("");
    candlesRef.current = [];
    setRange(newRange);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1" role="group" aria-label="Chart range">
          {RANGES.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => handleRangeChange(value)}
              aria-pressed={range === value}
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

        <div
          className="flex gap-1 rounded-md border border-zinc-200 p-0.5 dark:border-zinc-800"
          role="group"
          aria-label="Chart style"
        >
          <button
            type="button"
            onClick={() => setChartType("line")}
            aria-pressed={chartType === "line"}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              chartType === "line"
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            Line
          </button>
          <button
            type="button"
            onClick={() => setChartType("candlestick")}
            aria-pressed={chartType === "candlestick"}
            className={`rounded px-2.5 py-1 text-xs font-medium transition ${
              chartType === "candlestick"
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            Candles
          </button>
        </div>
      </div>

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
