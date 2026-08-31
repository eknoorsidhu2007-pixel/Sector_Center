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
│   └── news/
│       └── route.ts
├── news/
│   └── page.tsx
├── favicon.ico
├── globals.css
├── layout.tsx
└── page.tsx

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

## Existing API

### `app/api/news/route.ts`

This is the server-side Finnhub news endpoint.

The frontend calls:

```text
/api/news?symbol=AAPL
```

The Finnhub API key must remain server-side.

The API should:

* Validate the ticker symbol.
* Normalize ticker symbols to uppercase.
* Fetch company news from Finnhub.
* Return JSON.
* Handle Finnhub/API errors gracefully.
* Avoid exposing secrets.
* Avoid unnecessarily excessive Finnhub requests.
* Use appropriate caching/revalidation where beneficial.

Do not replace the existing API architecture without first explaining why.

---

## Existing News Page

### `app/news/page.tsx`

This is currently a basic test frontend for the news API.

It allows the user to:

* Enter a ticker symbol.
* Search for that ticker.
* Fetch news from `/api/news`.
* Display news articles.
* View headline, timestamp, summary, and article link.
* Handle loading/errors.

This page is currently a foundation/test implementation and is NOT the final product UI.

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

The next product-development priority is improving ticker/company search.

The current basic text input is only a temporary test interface.

The desired eventual behavior is something like:

```text
User types:
Apple

↓

Suggestions:
Apple Inc.
AAPL
NASDAQ

↓

User selects:
Apple Inc. (AAPL)

↓

News feed loads:
AAPL news
```

Before implementing this, inspect the existing Finnhub integration and determine the best API/data architecture.

Do not immediately implement a large autocomplete system without first understanding the existing code.

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
