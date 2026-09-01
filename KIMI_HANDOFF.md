# Kimi Agent Instructions

## Purpose

Kimi is being used as an independent coding/review agent for the Sector Center project.

## Before Any Task

1. Read `AGENTS.md`.
2. Inspect the actual current codebase relevant to the task.
3. Treat the repository as the source of truth if it differs from documentation.
4. Understand the existing architecture before making changes.
5. Do not modify files unless explicitly instructed to do so.
6. Do not commit or push unless explicitly instructed.

## Review Standards

When reviewing or implementing code, pay particular attention to:

- Next.js 16 App Router patterns
- TypeScript correctness
- Finnhub API usage and rate limits
- API security and server/client boundaries
- Search quality and ranking
- Performance and unnecessary API calls
- Accessibility
- State and URL synchronization
- Error handling
- Production scalability
- Maintaining the architecture documented in `AGENTS.md`

## Current Product Direction

Sector Center is intended to become a high-quality stock-market news platform.

Current major priorities include:

1. Company/ticker search
2. High-quality news relevance and deduplication
3. AI-powered summaries of important recent news
4. Strong trader-focused UX
5. Eventually adding more advanced market/trading features

Do not introduce Supabase, Stripe, AI APIs, databases, or major architectural changes unless explicitly requested or discussed first.