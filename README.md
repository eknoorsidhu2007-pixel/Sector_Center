[README for Sector Center.md](https://github.com/user-attachments/files/31981728/README.for.Sector.Center.md)
# Sector Center



A trader-focused stock market news platform. Search any listed company by name
or ticker and read its latest news coverage, with results ranked so the
companies you actually mean surface first.

Built with Next.js (App Router), React, TypeScript, and Tailwind CSS, powered by
the [Finnhub](https://finnhub.io/) market data API.

## Features

- **Company/ticker search** — autocomplete served from an in-memory index of
  US listings across NASDAQ, NYSE, NYSE American, NYSE Arca, and Cboe BZX.
  Every keystroke is a local lookup — zero upstream requests while typing, so
  search can never exhaust the Finnhub rate limit.
- **Exchange-aware ranking** — major-exchange listings rank above OTC shells,
  common stock above warrants/units/notes, and exact ticker or ticker-root
  matches (e.g. `brk` → `BRK.A`) rank above prefix matches. Typing "apple"
  surfaces Apple Inc., not an OTC shell.
- **Company news** — the latest articles for any ticker from the past 7 days,
  deduplicated, sorted newest-first, and capped at 50 per request, with a
  5-minute server cache.
- **Resilient data layer** — the symbol index refreshes once per day (partial
  indexes retry after 5 minutes), concurrent builds are coalesced, failed
  rebuilds fall back to the stale index, and the API key never leaves the
  server or appears in logs.

## Tech Stack

| Layer      | Choice                                  |
| ---------- | --------------------------------------- |
| Framework  | Next.js 16 (App Router)                 |
| UI         | React 19, Tailwind CSS v4               |
| Language   | TypeScript                              |
| Market data| Finnhub API (server-only client)        |

## Getting Started

### Prerequisites

- Node.js 20+
- A free [Finnhub](https://finnhub.io/register) API key

### Installation

```bash
git clone https://github.com/eknoorsidhu2007-pixel/Sector_Center.git
cd Sector_Center
npm install
```

### Environment Variables

Copy `.env.example` to `.env.local` and fill in your keys:

```bash
cp .env.example .env.local
```

| Variable                  | Required | Purpose                          |
| ------------------------- | -------- | -------------------------------- |
| `FINNHUB_API_KEY`         | Yes      | Market data (search + news)      |
| `NEXT_PUBLIC_SUPABASE_URL`| Planned  | Reserved for future auth/data    |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Planned | Reserved for future auth/data |
| `SUPABASE_SERVICE_ROLE_KEY` | Planned | Reserved for future auth/data  |
| `ALPHA_VANTAGE_API_KEY`   | Planned  | Reserved for future data sources |
| `STRIPE_SECRET_KEY`       | Planned  | Reserved for future billing      |
| `STRIPE_WEBHOOK_SECRET`   | Planned  | Reserved for future billing      |

> Only `FINNHUB_API_KEY` is used today. The Supabase/Stripe/Alpha Vantage
> variables are placeholders for the roadmap and are not wired into the app.

### Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000/news](http://localhost:3000/news) — the news
explorer is the main app surface.

## API Routes

### `GET /api/search?q=<query>`

Company/ticker autocomplete. Searches the local US symbol index.

```json
{
  "query": "apple",
  "results": [
    {
      "symbol": "AAPL",
      "displaySymbol": "AAPL",
      "name": "Apple Inc",
      "exchange": "NASDAQ",
      "type": "Common Stock"
    }
  ]
}
```

### `GET /api/news?symbol=<ticker>`

Company news for the past 7 days (deduplicated, newest first, max 50).

```json
{
  "symbol": "AAPL",
  "count": 42,
  "articles": [
    {
      "id": 123456789,
      "headline": "…",
      "summary": "…",
      "url": "https://…",
      "source": "Reuters",
      "imageUrl": "https://…",
      "publishedAt": "2026-09-08T14:30:00.000Z"
    }
  ]
}
```

Errors are returned as `{ "error": "<browser-safe message>" }` with an
appropriate HTTP status.

## Project Structure

```
app/
  api/
    news/route.ts        # GET /api/news — company news proxy + normalization
    search/route.ts      # GET /api/search — local autocomplete over the index
  news/page.tsx          # /news — the news explorer page
components/
  CompanySearch.tsx      # search input + ranked dropdown
  NewsExplorer.tsx       # page-level news state
  NewsCard.tsx           # single article card
  NewsList.tsx           # article list
lib/
  finnhub.ts             # server-only Finnhub client (key, errors, caching)
  symbols.ts             # in-memory US symbol index + ranking
  exchanges.ts           # MIC → exchange label/tier mapping
  format.ts              # display formatting helpers
  validation.ts          # ticker normalization
  types.ts               # shared types
```

## Design Notes

- **Why a local index instead of Finnhub's `/search`?** Finnhub's search
  endpoint returns no exchange and is dominated by foreign listings for common
  queries. The bulk `/stock/symbol` listing gives MIC codes, which let us label
  and rank results properly — at the cost of one upstream request per day.
- **Why per-MIC index builds?** Fetching only primary US venues keeps the
  index to real listings (~31k unfiltered rows, mostly OTC shells) and cuts
  cold build time from 15+ seconds to about a second.

## Roadmap

- AI-powered summaries of important recent news
- Better news relevance and deduplication
- More advanced market/trading features

## Scripts

| Command         | Description              |
| --------------- | ------------------------ |
| `npm run dev`   | Start the dev server     |
| `npm run build` | Production build         |
| `npm run start` | Start the production server |
| `npm run lint`  | Run ESLint               |
