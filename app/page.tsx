import type { Metadata } from "next";
import Link from "next/link";

import LandingSearch from "@/components/LandingSearch";

export const metadata: Metadata = {
  title: "Sector Center | Market Research in One Place",
  description:
    "Research public companies using interactive charts, market data, financial metrics, filings, insider activity, analyst coverage, and company news.",
};

const features = [
  {
    number: "01",
    title: "Interactive market charts",
    description:
      "Switch between line and candlestick charts across intraday and long-term ranges, with volume displayed alongside price.",
  },
  {
    number: "02",
    title: "Company fundamentals",
    description:
      "Review valuation, profitability, growth, balance-sheet, and trading metrics without searching through separate sources.",
  },
  {
    number: "03",
    title: "Market-moving news",
    description:
      "Follow recent coverage, earnings developments, analyst actions, regulatory events, and company announcements.",
  },
  {
    number: "04",
    title: "Filings and insider activity",
    description:
      "Inspect company filings, insider transactions, government contracts, and other events that may affect the investment story.",
  },
  {
    number: "05",
    title: "Peer comparison",
    description:
      "Compare a company with related businesses to understand valuation, performance, and competitive positioning.",
  },
  {
    number: "06",
    title: "AI market briefs",
    description:
      "Turn recent coverage into a structured summary of catalysts, risks, sentiment, and conflicting viewpoints.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-[#07090d] text-zinc-100">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center rounded-lg border border-blue-500/40 bg-blue-500/10 text-sm font-bold text-blue-400">
              SC
            </span>
            <span className="text-lg font-semibold tracking-tight">
              Sector Center
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-zinc-400 md:flex">
            <a href="#platform" className="transition hover:text-white">
              Platform
            </a>
            <a href="#intelligence" className="transition hover:text-white">
              Intelligence
            </a>
            <a href="#research" className="transition hover:text-white">
              Research
            </a>
          </nav>

          <Link
            href="/stocks/AAPL"
            className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium transition hover:border-white/30 hover:bg-white/10"
          >
            Explore the platform
          </Link>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-14 px-6 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-28">
          <div className="flex flex-col justify-center">
            <div className="mb-6 flex w-fit items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-300">
              Market research built for clarity
            </div>

            <h1 className="max-w-3xl text-4xl font-semibold leading-tight tracking-[-0.035em] sm:text-5xl lg:text-6xl">
              Research the market without opening ten different tabs.
            </h1>

            <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-400">
              Sector Center brings price data, charts, fundamentals, filings,
              insider activity, analyst coverage, and company news into one
              focused research workspace.
            </p>

            <div className="mt-9 max-w-2xl">
              <p className="mb-3 text-sm font-medium text-zinc-300">
                Search any listed company
              </p>
              <LandingSearch />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
              <span className="text-zinc-500">Popular:</span>

              {["AAPL", "NVDA", "JPM", "XOM"].map((symbol) => (
                <Link
                  key={symbol}
                  href={`/stocks/${symbol}`}
                  className="rounded-md border border-white/10 px-3 py-1.5 text-zinc-300 transition hover:border-blue-500/40 hover:text-blue-300"
                >
                  {symbol}
                </Link>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-5 rounded-3xl bg-blue-500/10 blur-2xl" />

            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c0f15] shadow-2xl shadow-black/40">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <p className="text-sm font-semibold">Market workspace</p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    Price, volume, metrics, and research
                  </p>
                </div>

                <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-300">
                  Live platform
                </span>
              </div>

              <div className="p-5 sm:p-6">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-semibold">Apple Inc.</p>
                      <span className="text-sm text-zinc-500">AAPL</span>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      NASDAQ | Technology | United States
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-2xl font-semibold">Market overview</p>
                    <p className="mt-1 text-xs text-emerald-400">
                      Interactive research
                    </p>
                  </div>
                </div>

                <div className="mt-8 h-56 rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="mb-4 flex gap-2 text-xs">
                    <span className="rounded bg-white px-2 py-1 font-medium text-black">
                      1M
                    </span>
                    {["1D", "6M", "1Y", "MAX"].map((range) => (
                      <span
                        key={range}
                        className="rounded px-2 py-1 text-zinc-500"
                      >
                        {range}
                      </span>
                    ))}
                  </div>

                  <svg
                    viewBox="0 0 600 180"
                    className="h-[165px] w-full"
                    role="img"
                    aria-label="Example upward-trending market chart"
                  >
                    <defs>
                      <linearGradient
                        id="chart-fill"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop offset="0%" stopColor="#2563eb" stopOpacity="0.35" />
                        <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
                      </linearGradient>
                    </defs>

                    <path
                      d="M0 140 L45 128 L85 145 L125 115 L170 120 L215 82 L260 98 L310 58 L355 75 L400 42 L450 55 L500 28 L550 40 L600 18 L600 180 L0 180 Z"
                      fill="url(#chart-fill)"
                    />

                    <path
                      d="M0 140 L45 128 L85 145 L125 115 L170 120 L215 82 L260 98 L310 58 L355 75 L400 42 L450 55 L500 28 L550 40 L600 18"
                      fill="none"
                      stroke="#3b82f6"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  {[
                    ["Market cap", "Valuation"],
                    ["52-week range", "Price context"],
                    ["Average volume", "Liquidity"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-lg border border-white/10 bg-white/[0.025] p-3"
                    >
                      <p className="text-[11px] uppercase tracking-wider text-zinc-500">
                        {label}
                      </p>
                      <p className="mt-2 text-sm font-medium">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="platform"
        className="mx-auto max-w-7xl px-6 py-20 lg:px-8 lg:py-28"
      >
        <div className="max-w-2xl">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-400">
            One research workspace
          </p>

          <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
            The information you need before making a decision.
          </h2>

          <p className="mt-5 text-lg leading-8 text-zinc-400">
            Move from a company search to its full market picture without
            switching between charting, news, filing, and financial-data tools.
          </p>
        </div>

        <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article key={feature.number} className="bg-[#0a0c11] p-7">
              <p className="font-mono text-xs text-blue-400">
                {feature.number}
              </p>
              <h3 className="mt-5 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-3 text-sm leading-6 text-zinc-400">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section
        id="intelligence"
        className="border-y border-white/10 bg-[#0a0c11]"
      >
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:px-8 lg:py-28">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-400">
              AI market intelligence
            </p>

            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Understand what the coverage means, not just what was published.
            </h2>

            <p className="mt-5 text-lg leading-8 text-zinc-400">
              AI Market Briefs will organize recent company coverage into
              catalysts, risks, sentiment, analyst actions, and conflicting
              viewpoints while keeping the supporting sources visible.
            </p>

            <div className="mt-8">
              <Link
                href="/news?symbol=AAPL"
                className="inline-flex rounded-lg border border-blue-500/40 bg-blue-500/10 px-5 py-3 text-sm font-medium text-blue-300 transition hover:bg-blue-500/20"
              >
                View company news
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/20 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">AI Market Brief</p>
                <p className="mt-1 text-xs text-zinc-500">
                  Planned intelligence layer
                </p>
              </div>

              <span className="rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-300">
                Coming next
              </span>
            </div>

            <div className="mt-6 space-y-4">
              {[
                ["Market sentiment", "Balanced with positive momentum"],
                ["Bullish catalysts", "Product demand and analyst revisions"],
                ["Key risks", "Valuation, regulation, and execution"],
                ["Source coverage", "Recent reporting with source links"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-lg border border-white/10 bg-white/[0.025] p-4"
                >
                  <p className="text-xs uppercase tracking-wider text-zinc-500">
                    {label}
                  </p>
                  <p className="mt-2 text-sm text-zinc-200">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section
        id="research"
        className="mx-auto max-w-7xl px-6 py-20 text-center lg:px-8 lg:py-28"
      >
        <p className="text-sm font-medium uppercase tracking-[0.18em] text-blue-400">
          Start researching
        </p>

        <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">
          Build a clearer view of any public company.
        </h2>

        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
          Explore the working stock dashboard or search for a company to begin.
        </p>

        <div className="mx-auto mt-9 max-w-2xl">
          <LandingSearch />
        </div>

        <Link
          href="/stocks/AAPL"
          className="mt-6 inline-flex rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
        >
          Explore Apple research
        </Link>
      </section>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-8 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <p>Sector Center</p>
          <p>Market information for research purposes only.</p>
        </div>
      </footer>
    </main>
  );
}