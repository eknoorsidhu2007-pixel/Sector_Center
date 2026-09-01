import { FinnhubError, finnhubFetch } from "./finnhub";
import { exchangeLabelFromMic, exchangeTierFromMic } from "./exchanges";
import { formatCompanyName } from "./format";
import type { CompanyMatch } from "./types";

/**
 * Company search index.
 *
 * Finnhub's `/search` endpoint is a poor fit for autocomplete: it returns no
 * exchange, and a query like "apple" is dominated by foreign listings
 * (APC.BE, APC.DE, A3KUT4.BE...). Instead we pull the US listing universe once
 * from `/stock/symbol`, keep it in memory, and rank matches ourselves. That
 * makes every keystroke a local lookup rather than an upstream request, so
 * typing can never exhaust the Finnhub rate limit.
 *
 * The index is held in module scope with a TTL. On a long-lived server this is
 * one upstream request per day. On serverless each cold instance builds its
 * own copy, which is still only one request per instance per day. The bulk
 * payload is too large to be worth putting in the Next.js data cache, so it is
 * fetched with caching disabled and memoised here instead.
 */

interface FinnhubSymbol {
  symbol?: string;
  displaySymbol?: string;
  description?: string;
  mic?: string;
  type?: string;
}

interface IndexedCompany extends CompanyMatch {
  symbolLower: string;
  /** Ticker without a class suffix, so "BRK.A" is also reachable as "brk". */
  symbolRoot: string;
  nameLower: string;
  nameWords: string[];
  exchangeTier: number;
}

const INDEX_TTL_MS = 24 * 60 * 60 * 1000;
/**
 * A partial index is served so search still works, but it must not be trusted
 * for a full day: a rate-limited venue would stay missing until the TTL expired.
 */
const PARTIAL_INDEX_TTL_MS = 5 * 60 * 1000;
const RETRY_DELAY_MS = 1500;

/** Instruments that are rarely what a consumer is searching for. */
const DEPRIORITISED_TYPES = new Set(["WARRANT", "RIGHT", "UNIT", "NOTE", "BOND"]);

interface BuiltIndex {
  companies: IndexedCompany[];
  isComplete: boolean;
}

let cachedIndex:
  | { builtAt: number; companies: IndexedCompany[]; isComplete: boolean }
  | null = null;
let inFlightBuild: Promise<BuiltIndex> | null = null;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function typeRank(type: string): number {
  const upper = type.toUpperCase();

  if (upper === "COMMON STOCK") {
    return 0;
  }

  if (DEPRIORITISED_TYPES.has(upper)) {
    return 3;
  }

  return upper === "" ? 2 : 1;
}

function toIndexedCompany(raw: FinnhubSymbol): IndexedCompany | null {
  const symbol = raw.symbol?.trim().toUpperCase();
  const name = raw.description?.trim();

  if (!symbol || !name) {
    return null;
  }

  // Some listings echo the ticker as the description, which is not a usable label.
  if (name.toUpperCase() === symbol) {
    return null;
  }

  return {
    symbol,
    displaySymbol: raw.displaySymbol?.trim().toUpperCase() || symbol,
    name: formatCompanyName(name),
    exchange: exchangeLabelFromMic(raw.mic),
    type: raw.type?.trim() ?? "",
    symbolLower: symbol.toLowerCase(),
    symbolRoot: symbol.toLowerCase().split(".")[0],
    nameLower: name.toLowerCase(),
    nameWords: name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
    exchangeTier: exchangeTierFromMic(raw.mic),
  };
}

/**
 * Primary US listing venues. Fetching per-MIC instead of the whole `US`
 * exchange keeps the index to real listings: the unfiltered listing is ~31,000
 * rows, mostly OTC shells that crowd out genuine companies in search results
 * and made a cold index build take over 15 seconds.
 */
const INDEX_MICS = ["XNAS", "XNYS", "XASE", "ARCX", "BATS"];

async function fetchListing(mic: string): Promise<FinnhubSymbol[]> {
  const raw = await finnhubFetch<FinnhubSymbol[]>(
    "/stock/symbol",
    { exchange: "US", mic },
    { revalidate: false }
  );

  if (!Array.isArray(raw)) {
    throw new Error(`Unexpected symbol listing shape for ${mic}`);
  }

  return raw;
}

/** The bulk listing endpoint is heavy enough to draw 429s; one retry clears it. */
async function fetchListingWithRetry(mic: string): Promise<FinnhubSymbol[]> {
  try {
    return await fetchListing(mic);
  } catch (error) {
    if (error instanceof FinnhubError && error.status === 429) {
      await delay(RETRY_DELAY_MS);
      return fetchListing(mic);
    }

    throw error;
  }
}

async function buildIndex(): Promise<BuiltIndex> {
  const settled = await Promise.allSettled(
    INDEX_MICS.map(fetchListingWithRetry)
  );
  const companies: IndexedCompany[] = [];
  const seenSymbols = new Set<string>();
  let isComplete = true;

  for (const [position, outcome] of settled.entries()) {
    if (outcome.status === "rejected") {
      isComplete = false;
      console.error(
        `Symbol listing failed for ${INDEX_MICS[position]}:`,
        outcome.reason
      );
      continue;
    }

    for (const entry of outcome.value) {
      const company = toIndexedCompany(entry);

      if (company && !seenSymbols.has(company.symbol)) {
        seenSymbols.add(company.symbol);
        companies.push(company);
      }
    }
  }

  // A partial index is still useful; an empty one is not.
  if (companies.length === 0) {
    throw new Error("Could not build the company search index");
  }

  return { companies, isComplete };
}

export async function getSymbolIndex(): Promise<IndexedCompany[]> {
  if (cachedIndex) {
    const ttl = cachedIndex.isComplete ? INDEX_TTL_MS : PARTIAL_INDEX_TTL_MS;

    if (Date.now() - cachedIndex.builtAt < ttl) {
      return cachedIndex.companies;
    }
  }

  // Coalesce concurrent builds so a burst of cold requests makes one call.
  if (!inFlightBuild) {
    inFlightBuild = buildIndex()
      .then((built) => {
        cachedIndex = { builtAt: Date.now(), ...built };

        if (built.isComplete) {
          console.log(
            `Company search index built: ${built.companies.length} US listings`
          );
        } else {
          console.warn(
            `Company search index is INCOMPLETE (${built.companies.length} listings); retrying in ${PARTIAL_INDEX_TTL_MS / 1000}s`
          );
        }

        return built;
      })
      .finally(() => {
        inFlightBuild = null;
      });
  }

  try {
    return (await inFlightBuild).companies;
  } catch (error) {
    // Serve a stale index rather than failing search outright.
    if (cachedIndex) {
      console.error("Rebuild failed, serving stale company index:", error);
      return cachedIndex.companies;
    }

    throw error;
  }
}

/**
 * Lower score is a better match. Returns null when the company does not match.
 */
function matchScore(company: IndexedCompany, query: string): number | null {
  if (company.symbolLower === query) {
    return 0;
  }

  // "brk" should reach Berkshire's BRK.A/BRK.B before tickers merely starting
  // with those letters, such as BRKR.
  if (company.symbolRoot === query) {
    return 0.5;
  }

  if (company.symbolLower.startsWith(query)) {
    return 1;
  }

  if (company.nameLower.startsWith(query)) {
    return 2;
  }

  if (company.nameWords.some((word) => word.startsWith(query))) {
    return 3;
  }

  if (company.nameLower.includes(query)) {
    return 4;
  }

  if (company.symbolLower.includes(query)) {
    return 5;
  }

  return null;
}

export function searchCompanies(
  companies: IndexedCompany[],
  rawQuery: string,
  limit = 8
): CompanyMatch[] {
  const query = rawQuery.trim().toLowerCase();

  if (!query) {
    return [];
  }

  const scored: { company: IndexedCompany; score: number }[] = [];

  for (const company of companies) {
    const score = matchScore(company, query);

    if (score !== null) {
      scored.push({ company, score });
    }
  }

  scored.sort((a, b) => {
    if (a.score !== b.score) {
      return a.score - b.score;
    }

    if (a.company.exchangeTier !== b.company.exchangeTier) {
      return a.company.exchangeTier - b.company.exchangeTier;
    }

    const rankDifference = typeRank(a.company.type) - typeRank(b.company.type);

    if (rankDifference !== 0) {
      return rankDifference;
    }

    if (a.company.symbol.length !== b.company.symbol.length) {
      return a.company.symbol.length - b.company.symbol.length;
    }

    return a.company.name.localeCompare(b.company.name);
  });

  return scored.slice(0, limit).map(({ company }) => ({
    symbol: company.symbol,
    displaySymbol: company.displaySymbol,
    name: company.name,
    exchange: company.exchange,
    type: company.type,
  }));
}
