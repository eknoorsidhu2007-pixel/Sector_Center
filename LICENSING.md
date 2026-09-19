# Data Licensing Register

Sector Center is intended to become a monetized product. Market data licensing
is the constraint most likely to block that, and it is invisible in code, so it
is tracked here.

**Status: unresolved.** Every market-data provider currently in use licenses its
self-serve plans for personal, non-commercial use only. Displaying that data to
paying subscribers is not permitted on the current plans.

Nothing here is legal advice. Items marked **NEEDS CONFIRMATION** require written
confirmation from the provider before launch.

Last verified against provider terms and pricing pages: 2026-09-19.

---

## Summary

| Provider | Used for | Current plan | Commercial display permitted? |
| --- | --- | --- | --- |
| Finnhub | quotes, profile, metrics, news, insider, filings, earnings, peers, contracts | Free | **No** |
| Twelve Data | OHLC candles | Basic (free) | **No** |
| SEC EDGAR | not yet integrated | n/a | **Yes** (public domain) |
| USAspending | not yet integrated directly | n/a | **Yes** (CC0) |

---

## Finnhub

Currently the primary provider. Used by `lib/finnhub.ts` and
`lib/market/finnhub-provider.ts` for `/quote`, `/stock/profile2`,
`/stock/metric`, `/company-news`, `/stock/symbol`, `/stock/peers`,
`/stock/insider-transactions`, `/stock/insider-sentiment`, `/stock/filings`,
`/stock/financials-reported`, `/stock/earnings`, `/calendar/earnings`,
`/stock/recommendation`, and `/stock/usa-spending`.

### What the terms say

From Finnhub's Terms of Service, "Redistribution Rights and Personal Use":

> You hereby agree to not redistribute or share access to data or derived
> results from the data obtained from Finnhub with anyone or any 3rd party
> without written approval from Finnhub. All plan listed on Finnhub website is
> strictly for personal use unless explicitly stated otherwise. Personal plan
> can't be used by any business even internally without a written approval.

The same section disqualifies a personal-use plan if any of the following apply:

- you are a securities professional registered with FINRA, SEC, CFTC, or a
  comparable body
- **you are using this data for your business or registering under your business
  name, regardless of industry**
- you intend to deduct the expense as a business expense

### Plans

Every self-serve tier is labelled "Personal Use", including the highest one:

- Free — $0/mo, 60 API calls/min, US coverage
- Market Data Basic — $49.99/mo, 150 calls/min
- Market Data Standard — $129.99/mo, 300 calls/min
- Market Data Professional — $199.99/mo, 900 calls/min
- All-In-One — $3,500/mo, still listed as Personal Use

A global 30 calls/second ceiling applies to all plans.

Only the **Enterprise** plan is listed as "Commercial use. Redistribution
right." Pricing is quote-based; contact is `support@finnhub.io`.

### Implication

Paid subscriber access to any Finnhub-derived figure requires an Enterprise
agreement. Upgrading to a paid self-serve tier does **not** resolve this — it
buys rate limit and history, not display rights.

---

## Twelve Data

Used by `lib/market/twelve-data.ts` and `lib/market/twelve-data-provider.ts`
for `/time_series` (chart candles) only.

### What the terms say

Individual plans (Basic, Grow, Pro, Ultra) are, per Twelve Data's support
documentation, "intended strictly for personal or internal use" and explicitly
do not permit:

- redistribution of data
- commercial display of data to third parties

The Terms grant a license "solely for Internal Use", with external display or
redistribution only "if and as expressly authorized by a Redistribution Rights
Add-On or separate written agreement".

Business plans "allow the use of data for commercial display and internal
usage, subject to exchange licensing requirements", and are required "for any
company, team, fund, or organization using Twelve Data — even if the data is
only used internally and never displayed externally".

### Plans

Individual: Basic $0 (8 credits/min, 800/day cap), Grow $29, Pro $99,
Ultra $329.

Business: Venture from $149/mo (external display rights, 610 credits/min, no
daily cap), Enterprise from $1,099/mo (external distribution), Enterprise+
custom.

### Implication

Twelve Data has the clearest and cheapest documented upgrade path to legal
external display: **Venture at $149/mo**. This is the most likely first paid
commitment.

### Hard operational ceiling on the free tier

The free plan allows 800 credits/day, and `/time_series` costs 1 credit per
symbol per call. With the current cache TTLs in
`lib/market/twelve-data-provider.ts` (5 min intraday, 6 h daily, 24 h weekly), a
symbol browsed across all five ranges costs roughly 20 credits/day.

That is approximately **40 unique symbols per day** before exhaustion. This is
the concrete trigger for either a Business plan or persisting daily bars in a
`price_history` table rather than refetching.

---

## Public domain sources

These carry no display, storage, or redistribution restriction, which is why the
architecture deliberately builds the differentiating features on them.

### SEC EDGAR

US government work, not subject to copyright. No API key, no authentication.

- `data.sec.gov/submissions/CIK##########.json`
- `data.sec.gov/api/xbrl/companyfacts/CIK##########.json`
- `data.sec.gov/api/xbrl/frames/us-gaap/{concept}/{unit}/{period}.json`
- `efts.sec.gov/LATEST/search-index` (full text, 2001 onward)
- Bulk: `submissions.zip`, `companyfacts.zip`, quarterly Financial Statement
  Data Sets

Obligations, which are technical rather than contractual:

- **Maximum 10 requests/second aggregate** across all `sec.gov` subdomains,
  regardless of how many machines are used. The SEC reserves the right to block
  IPs that exceed it.
- Every request must declare a `User-Agent` identifying the requester with
  contact information, e.g. `Sector Center contact@example.com`.
- Prefer the nightly bulk archives over per-company crawling for backfill.

### USAspending

Operated by the Treasury's Bureau of the Fiscal Service. Licensed CC0 /
public domain. Free, unauthenticated, no published rate limit.

- `POST api.usaspending.gov/api/v2/search/spending_by_award/`
- `POST api.usaspending.gov/api/v2/recipient/`
- `GET api.usaspending.gov/api/v2/awards/{generated_internal_id}/`

Back off exponentially on transient 429/502/503/504 even though no limit is
published.

### CanadaBuys

Canadian federal procurement, published as bulk CSV through the Open Government
Portal. No documented API; ingest the CSVs on a schedule.

Note that **SEDAR+ has no official public API**. Canadian filings are therefore
a later-phase problem, and third-party wrappers would reintroduce a licensing
question.

---

## Alternatives evaluated

Verified during the 2026-09-19 audit. All retail-facing providers gate
commercial display behind a business tier; the difference is price and clarity.

- **Tiingo** — free Starter, Power $30/mo, and a **Commercial plan at $50/mo
  ($499/yr)** covering internal commercial use for up to two developers. The
  cheapest self-serve commercial license found. Redistribution still requires
  separate written permission plus fees, and attribution reading
  "Data sourced by Tiingo" with a link. **NEEDS CONFIRMATION** whether
  subscriber-facing display counts as internal use or redistribution.
- **Financial Modeling Prep** — Free/Starter $22/Premium $59/Ultimate $149 are
  personal and internal only. Displaying or redistributing requires a
  commercial plan (Build, Grow, Enterprise) plus a signed Data Display and
  Licensing Agreement.
- **Polygon.io (now Massive)** — Basic $0, Starter $29, Developer $79,
  Advanced $199 are all "Individual use only", and the terms state plainly that
  you "may not use the Market Data to build an application intended for use by
  end users other than you." Business starts at $2,499/mo.
- **EODHD** — listed plans (EOD $19.99, EOD+Intraday $29.99, Fundamentals
  $59.99, All-in-One $99.99) are personal use. Commercial licensing is quoted,
  onboarding takes about three business days, and EODHD reports commercial users
  to the relevant exchanges.

---

## Questions to resolve before any paid launch

1. **Finnhub Enterprise pricing and scope.** What does an Enterprise agreement
   cost for a small consumer product, and which datasets does it include? Is
   there a startup tier?
2. **Twelve Data Venture sufficiency.** Does Venture's "external display"
   right cover showing charts to paying subscribers, or is that
   "distribution" requiring Enterprise?
3. **Derived versus raw data.** Several figures shown are computed by us from
   provider inputs, for example the 52-week range position in
   `components/stock/HistoricalContext.tsx` and insider buy/sell totals in
   `components/stock/InsiderActivity.tsx`. Providers treat derived data
   differently from raw data. Does displaying a derived figure carry the same
   restriction? **NEEDS CONFIRMATION** per provider.
4. **Caching and storage duration.** Both providers are queried through caches
   in `lib/market/cache.ts`. Milestone 2 will persist data in a database. Is
   storage permitted, and is there a retention limit?
5. **Attribution.** Which providers require visible attribution, in what
   wording, and where on the page?
6. **Exchange fees.** Real-time US equity quotes may carry separate exchange
   entitlement obligations beyond the provider's own fee. Confirm whether
   delayed data avoids them.
7. **Non-professional status.** Any signed non-professional subscriber
   agreement becomes invalid once the data is used for a business. Confirm what
   must change at incorporation.

---

## Practical consequences for the codebase

- Keep `MarketDataProvider` in `lib/market/provider.ts` as the only seam that
  touches a vendor. Swapping providers should remain a change to
  `lib/market/index.ts` and one new implementation file.
- Prefer public-domain primary sources for anything that will become a
  differentiating, subscriber-facing feature.
- Never expose a provider's raw payload through our own public API; that would
  be redistribution under every set of terms reviewed here.
- Revisit this document before adding a payment flow, opening public signups,
  or incorporating.
