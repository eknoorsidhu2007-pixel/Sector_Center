# Sector Center — AI Development Handoff

## Project Overview

Sector Center is a monetized stock-market news web application.

The goal is to build a polished consumer-facing platform where users can discover financial news by stock ticker, company, and eventually sector. The product is intended to become a real monetized SaaS/web application, not just a coding demo.

The GitHub repository is private.

GitHub repository:
`https://github.com/eknoorsidhu2007-pixel/Sector_Center`

The local project folder may have a different name from the GitHub repository. Do not assume they must match.

---

## Current Stack

* Next.js 16.3.3
* App Router
* TypeScript
* React
* Tailwind CSS
* Turbopack
* Finnhub API
* Git/GitHub
* Local development through `npm run dev`

### Installed But Not Yet Used

The following dependencies are already in `package.json` but no application code
imports them yet. They were installed ahead of the features that will need them.

* `@supabase/supabase-js`, `@supabase/ssr` — intended for future user accounts/data
* `stripe`, `@stripe/stripe-js` — intended for future subscription payments

Do not start using these libraries just because they are installed. Auth,
database, and payment work still requires an architecture discussion first.

Current project structure includes:

```text
app/
├── api/
│   ├── news/
│   │   └── route.ts
│   └── search/
│       └── route.ts
├── news/
│   └── page.tsx
├── favicon.ico
├── globals.css
├── layout.tsx
└── page.tsx

components/
├── CompanySearch.tsx
├── NewsCard.tsx
├── NewsExplorer.tsx
└── NewsList.tsx

lib/
├── exchanges.ts
├── finnhub.ts
├── format.ts
├── symbols.ts
├── types.ts
├── validation.ts
└── news/
    ├── aliases.ts
    ├── classify.ts
    ├── cluster.ts
    ├── rank.ts
    ├── relevance.ts
    └── text.ts

public/
node_modules/
.next/

.env.local
.env.example
.gitignore
package.json
package-lock.json
next.config.ts
tsconfig.json
eslint.config.mjs
README.md
```

---

## Environment Variables

Secrets are stored in `.env.local`.

`.env.local` must NEVER be committed to GitHub.

The only variable the application currently reads is:

```env
FINNHUB_API_KEY=...
```

`.env.example` additionally documents placeholders for variables reserved for
future features, so its key list is intentionally larger than what the code uses
today:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
FINNHUB_API_KEY=
ALPHA_VANTAGE_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

`.env.example` exists to document required environment variables without exposing secrets.

Never expose server-side API keys through client-side code.

Never place secrets in `NEXT_PUBLIC_*` variables unless they are intentionally public.

---

## Git Workflow

The project uses the `main` branch.

The GitHub remote is:

```text
origin -> https://github.com/eknoorsidhu2007-pixel/Sector_Center.git
```

The preferred workflow is:

```bash
git status
git add <specific files>
git commit -m "Describe the change"
git push
```

We prefer relatively frequent, meaningful commits so the project has a granular and understandable development history.

Do NOT commit automatically.

Do NOT make unrelated changes.

Before making a commit, make sure the application still works.

---

## Existing APIs

All Finnhub access goes through `lib/finnhub.ts`. That module owns the API key,
error translation, and caching policy. Do not call Finnhub directly from a route
handler or component, and never log a Finnhub URL, because the token travels in
the query string.

`lib/finnhub.ts` throws `FinnhubError`, which carries a status plus a
`publicMessage` that is safe to return to the browser. Route handlers convert it
with `toApiError`.

### `app/api/news/route.ts`

Server-side company news with a deterministic quality pipeline.

```text
/api/news?symbol=AAPL
```

Pipeline order matters — fetch (7-day lookback, `revalidate: 300`) →
shape/validate → relevance scoring → event classification → near-duplicate
clustering → trader-focused ranking → cap. The cap is applied AFTER
processing; the old cap-at-50-first behaviour discarded good articles while
listicles took their slots.

Response shape (see `NewsResponse` in `lib/types.ts`):

* `stories`: ranked clusters. Headline/summary/url come from a representative
  article (best source tier, then most central headline, then earliest); each
  story carries `eventTypes`, `relevance` ("primary" | "secondary"),
  `sourceCount`/`sources`, first/latest timestamps, and the clustered
  `articles`.
* `peripheral` + `peripheralCount`: tangential articles (index listicles,
  roundups, passing mentions). Demoted, never deleted; the UI keeps them
  behind a collapsed section. `peripheral` is capped (15), the count is not.
* `coverage`: "normal" | "light" | "none" for honest thin-coverage states.
* `companyName`: resolved from the search index (`getSymbolIndex`, read-only)
  at zero extra Finnhub cost. If the index is unavailable the feed degrades
  to ticker-only relevance matching rather than failing.

The pipeline lives in `lib/news/` as pure functions (text, aliases, relevance,
classify, cluster, rank). All scoring internals stay server-side; the client
receives tiers and badges, not numbers.

### `app/api/search/route.ts`

Company/ticker autocomplete.

```text
/api/search?q=apple
```

Returns `{ query, results }` where each result has `symbol`, `displaySymbol`,
`name`, `exchange`, and `type`.

### Why search does not proxy Finnhub's `/search`

This was measured, not assumed. Do not "simplify" it back to a proxy without
re-checking these findings:

* Finnhub's `/search` returns only `description`, `displaySymbol`, `symbol`, and
  `type`. It has **no exchange field**, so it cannot render the "NASDAQ" label
  the product requires.
* A query for "apple" is dominated by foreign listings (`APC.BE`, `APC.DE`,
  `A3KUT4.BE`), many with an empty `type`.
* It would spend an upstream request on every keystroke against a 60 calls/minute
  free-tier limit.

Instead `lib/symbols.ts` builds an in-memory index from `/stock/symbol` and ranks
matches locally, so a keystroke costs no upstream request.

Two measured details worth preserving:

* Fetching `exchange=US` alone returns ~31,000 rows and took **15.6 seconds** to
  build. Fetching the five primary MICs in parallel (`XNAS`, `XNYS`, `XASE`,
  `ARCX`, `BATS`) yields ~13,400 rows and builds in about **0.9 seconds**, or
  ~2.5 seconds when a retry is needed.
* That MIC filter also removes OTC shell companies that were outranking real
  listings. Searching "apple" used to surface `APPLE RUSH CO` above NYSE-listed
  `APPLE HOSPITALITY REIT`.

Ranking order is: match quality, then exchange tier (major before OTC), then
instrument type, then ticker length, then name.

### Rate Limiting On The Bulk Listing Endpoint

`/stock/symbol` is heavy enough that firing all five MIC requests at once can
draw a **429** from Finnhub, especially alongside other traffic or repeated dev
server reloads. Two safeguards exist and should not be removed:

* Each listing request retries once after 1.5 seconds on a 429.
* If any venue still fails, the index is served anyway but marked incomplete and
  cached for only 5 minutes instead of 24 hours, so it self-heals.

Without the second safeguard a single 429 would cache a silently incomplete
index for a full day. This actually happened during development: builds landed at
10,605 and 13,052 listings when a venue was rate-limited, versus 13,373 complete.

---

## Existing News Page

### `app/news/page.tsx`

A small server component. It awaits `searchParams`, validates `?symbol=`,
falls back to `AAPL`, and renders `components/NewsExplorer.tsx`.

The selected company lives in the URL, so `/news?symbol=TSLA` is shareable.

### `components/NewsExplorer.tsx`

Client orchestrator. Holds the selected symbol, fetches the news feed, resolves
a company display name for symbols that arrived from the URL rather than from a
selection, and syncs the URL using `window.history.pushState`. Next.js supports
that natively and it integrates with the router, so switching companies does not
trigger a server navigation and the back button moves between companies.

### `components/CompanySearch.tsx`

An ARIA combobox: `role="combobox"` with `aria-expanded`, `aria-controls`, and
`aria-activedescendant`, a `role="listbox"` of `role="option"` items, arrow keys,
Enter, Escape, Home/End, and an `aria-live` status region.

It also debounces at 220ms, aborts superseded requests with `AbortController`,
caches queries locally so backspacing never refetches, and delays the spinner by
150ms so fast responses do not flash a loading state.

The UI is no longer a throwaway test harness, but it is also not finished. There
is still no home-page entry point linking to `/news`.

---

## Important Architecture Rule

The current application is intentionally simple.

Do not prematurely introduce:

* complex state-management libraries
* unnecessary dependencies
* microservices
* excessive abstractions
* unnecessary databases
* complicated caching infrastructure
* unnecessary authentication systems

Prefer the simplest architecture that can eventually scale into a real monetized product.

However, do not sacrifice security or sound architecture merely to keep the code short.

---

## Product Direction

The eventual product should become much more than a raw news feed.

Potential product directions include:

* Stock/ticker search
* Company search
* Sector discovery
* Personalized news
* Favorite tickers
* Favorite sectors
* Personalized dashboards
* News filtering
* News deduplication
* Better news cards
* Article source information
* Market/stock context
* AI-powered news summaries
* Premium features
* User accounts
* Subscription tiers
* Stripe payments
* Notifications
* Potential real-time/near-real-time news updates

These features are future direction, NOT permission to implement all of them at once.

Build incrementally.

---

## Development Philosophy

The user is relatively new to coding, so changes should be understandable and easy to verify.

When proposing a change:

1. Inspect the existing code first.
2. Explain what you found.
3. Explain what files need to change.
4. Explain why.
5. Make the smallest reasonable change.
6. Test the change.
7. Report exactly what changed.
8. Do not modify unrelated files.
9. Do not commit unless explicitly asked.

When a task is straightforward, implementation can proceed directly.

When a task involves architecture, security, payments, authentication, databases, or major refactoring, analyze the architecture BEFORE implementing.

---

## Code Quality Requirements

Prefer:

* TypeScript
* Explicit interfaces/types
* No `any` unless genuinely necessary
* Server-side secrets
* Input validation
* Proper error handling
* Accessible UI
* Responsive UI
* Reusable components when reuse is actually beneficial
* Minimal dependencies
* Clear naming
* Small focused functions/components

Avoid:

* `any` everywhere
* duplicated logic
* hardcoded secrets
* fake/mock functionality presented as real
* silently swallowing errors
* unnecessary abstractions
* modifying unrelated files
* large rewrites when a small change is sufficient

---

## UI/UX Direction

Sector Center is intended to become a polished commercial product.

Do not make the interface look like a generic tutorial/demo unless specifically asked.

The eventual design should feel:

* Modern
* Clean
* Professional
* Fast
* Financial/market oriented
* Easy to scan
* Responsive
* Suitable for a paid product

However, do not redesign the entire application without being asked.

Use the existing design system and styling as the starting point.

---

## Images / Design References

The user may provide screenshots or design references during development.

When images are provided:

* Treat them as visual references.
* Analyze layout, spacing, hierarchy, typography, components, and interaction patterns.
* Do not blindly copy another company's branding or proprietary assets.
* Recreate the useful design principles using our own implementation.
* Ask before making a major visual redesign if the requested change is ambiguous.

The user may also provide screenshots of bugs.

When a screenshot is provided, inspect it carefully before proposing a fix.

---

## Using AI During Development

This project may be developed using multiple AI coding models.

A common workflow is:

* Qwen 3 Coder 30B for straightforward implementation.
* Claude for complex architecture, security, databases, payments, large refactors, and difficult debugging.
* ChatGPT for code review, architecture review, debugging, and deciding whether proposed changes are safe.

Because multiple AI systems may work on the repository, ALWAYS inspect the current codebase before making assumptions.

Do not assume a previous AI's implementation is correct.

---

## Important Safety Rule

Before making potentially destructive changes:

* Do not delete files unless necessary.
* Do not overwrite unrelated work.
* Do not reset Git history.
* Do not run destructive Git commands such as `git reset --hard` unless explicitly authorized.
* Do not remove environment variables without checking their purpose.
* Do not expose API keys or credentials.

If a proposed change could have significant consequences, explain it before executing it.

---

## Current Development Status

Completed:

* Next.js App Router project created.
* Finnhub API key configured locally.
* `.env.local` created.
* `.env.local` excluded through `.gitignore`.
* `.env.example` created.
* Finnhub news API route created.
* API route tested successfully.
* `/api/news?symbol=AAPL` successfully returned news data.
* Frontend news page created.
* Incorrect placement of the frontend page under `app/api/news/` was discovered and corrected.
* Correct frontend location is now:

```text
app/news/page.tsx
```

Current API location:

```text
app/api/news/route.ts
```

### Completed: Foundations And Company Search

* Shared Finnhub client extracted to `lib/finnhub.ts`.
* Symbol validation added; malformed input returns 400 without an upstream call.
* `/api/news` now returns a shaped, typed response instead of Finnhub's raw array.
* Company search index and ranking built in `lib/symbols.ts`.
* `/api/search` added.
* Accessible `CompanySearch` combobox built.
* News page split into `NewsExplorer`, `NewsList`, and `NewsCard`.
* Selected company moved into the URL as `?symbol=`.

Verified: cold search 0.9-2.5s, warm search 5-18ms, `tsc --noEmit` clean, no
lint errors, and 400s confirmed for `123`, `<script>`, `AA PL`, and over-length
input.

### Known Limitation: No Prominence Ranking

Search has no signal for company size, so a query matching many companies
equally ranks them by ticker length and then alphabetically. Searching "micro"
returns Micron first and Microsoft seventh.

The recommended fix is to boost S&P 500 constituents using Finnhub's index
constituents endpoint (one extra cached call). Prefer that over a hand-maintained
list of favourite tickers.

Also note: the index covers the five primary US venues only, so OTC-traded ADRs
do not appear. That is a deliberate trade-off for result quality and is one
constant (`INDEX_MICS`) in `lib/symbols.ts`.

### Known Recurring Mistake: Duplicate Page In The API Folder

A duplicate copy of the news page was accidentally restored to
`app/api/news/page.tsx` and committed a second time. Because the App Router does
not allow a `page.tsx` and a `route.ts` in the same segment, this breaks the app
with:

```text
Conflicting route and page at /api/news: route at /api/news/route and page at /api/news/page
```

It has been deleted again. `app/api/news/` must contain `route.ts` only. Prefer
`git add <specific files>` over `git add .` so a stray file like this is not
re-committed.

### `AGENTS.md` Is Partly Auto-Generated

Running `next dev` appends a `<!-- BEGIN:nextjs-agent-rules -->` block to the end
of this file and re-adds it if removed. Deleting that block is not worth a
commit; it will simply come back on the next dev run.

---

## Current Priority

Company search is built. Typing "Apple" returns `Apple Inc / AAPL / NASDAQ`,
selecting it loads that company's news, and the URL becomes `/news?symbol=AAPL`.

**News quality (Phase 3) is built.** Relevance scoring, event classification,
near-duplicate clustering, and trader-focused ranking all run server-side in
`app/api/news/route.ts` via pure functions in `lib/news/`. Measured on the
live AAPL feed: 84 raw articles became 23 ranked stories with 44 peripheral
articles demoted behind a collapsed section; the 13-article CEO-transition
news cycle collapsed into a handful of correctly-headed clusters, and all
seven ChartMill index listicles left the main feed without being deleted.

Measured properties of the feed that the design relies on:

* Roughly half of a mega-cap's raw articles never mention the company in the
  headline or summary (index membership, sector adjacency, and ownership links
  all trigger Finnhub's tag). Headline is the dominant signal; summaries are
  often attribution stubs and must never count AGAINST an article.
* Finnhub wraps every URL in a `finnhub.io/api/news?id=...` redirect, so URLs
  cannot identify the publisher and cannot anchor deduplication.
* There are zero exact duplicate headlines, so exact-match dedup catches
  nothing; clustering is textual (Jaccard/containment + shared distinctive
  tokens), with a deliberate under-clustering bias.
* Finnhub's `related` field is the query symbol echoed back and `category` is
  always `"company"`; both are signal-free. Event classification is ours.
* Dangerous tickers (`NOW`, `T`, `ALL`, `LOW`, `ON`, `ARE`, `HD`, `BIG`,
  single letters, common words) never score on a bare ticker match; they need
  name/alias corroboration. Verified: NOW/T/ALL/LOW produce zero
  false-positive primary stories.
* Only 4 sources appear on the free tier (Benzinga, CNBC, SeekingAlpha,
  ChartMill). No Reuters, Bloomberg, or AP. Source coverage, not AI quality,
  is the current ceiling on the product.

### Verification Gotcha: PowerShell Misdecodes UTF-8

`Invoke-WebRequest`'s `.Content` decodes charset-less JSON as Latin-1, which
makes clean UTF-8 smart quotes LOOK like mojibake ("Appleâ??s"). This was
misdiagnosed as Finnhub data corruption during Phase 3. Verify at the byte
level (`Invoke-WebRequest -OutFile` + UTF-8 decode) before "fixing" encoding
bugs. `lib/news/text.ts` still repairs genuine double-encoded sequences as a
defensive measure.

### Planned Order

1. ~~News relevance filtering, near-duplicate clustering, and ranking.~~ Done.
2. AI briefing behind a feature flag, with structured output, required citations,
   deterministic validation, a persistent cache, and per-IP rate limiting.
   Note: feed summaries are stubs, so a briefing will be headline-level unless
   article-body fetching is solved separately.
3. Accounts and watchlists (Supabase).
4. Subscription tiers (Stripe).

An AI provider has not been chosen yet. Keep model calls behind a single
swappable module when that work starts.

---

## How to Respond to Development Tasks

For simple implementation tasks:

* Inspect the relevant files.
* Implement the requested change.
* Test it.
* Tell the user exactly what changed.

For complex tasks:

* Inspect the repository.
* Explain the current architecture.
* Explain the proposed architecture.
* Identify files that would change.
* Identify risks/tradeoffs.
* Wait for approval before major implementation.

Always preserve existing working functionality unless the task explicitly requires changing it.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
