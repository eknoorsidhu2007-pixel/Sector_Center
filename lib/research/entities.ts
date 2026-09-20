/**
 * Ticker-to-CIK entity resolution.
 *
 * Everything in the research layer is keyed on CIK, not ticker. CIK is stable
 * for the life of a registrant; tickers get reassigned, change on rebrand, and
 * disappear on delisting. Keying on ticker would silently attach one company's
 * filing history to another after a reassignment.
 *
 * The directory is built in memory from SEC's ticker files, mirroring the
 * proven approach in `lib/symbols.ts`: one upstream fetch, cached for a day,
 * with concurrent builds coalesced. That keeps resolution free per request and
 * means this module works before any database exists.
 *
 * When the `companies` table lands, this becomes its seed loader; the resolver
 * API below does not need to change.
 */

import {
  fetchCompanyTickers,
  fetchCompanyTickersWithExchange,
  fetchSubmissions,
  padCik,
} from "./sec-client";

const DIRECTORY_TTL_MS = 24 * 60 * 60 * 1000;
/** A partial or failed build is retried soon rather than cached for a day. */
const FAILED_BUILD_TTL_MS = 5 * 60 * 1000;

export interface CompanyEntity {
  /** Zero-padded 10-digit CIK, the stable primary key. */
  cik: string;
  /** Current primary ticker as SEC lists it. */
  ticker: string;
  /** EDGAR conformed company name. */
  name: string;
  /** Listing venue as SEC reports it, e.g. "Nasdaq", "NYSE". */
  exchange: string | null;
}

/** A former registrant name and the window it was in use. */
export interface FormerName {
  name: string;
  from: string | null;
  to: string | null;
}

/**
 * Richer identity pulled from a company's submissions document. Costs one
 * EDGAR request, so it is fetched per company rather than for the directory.
 */
export interface CompanyIdentity {
  cik: string;
  name: string;
  /** Every ticker EDGAR currently associates with this CIK. */
  tickers: string[];
  exchanges: string[];
  /** Standard Industrial Classification code. */
  sic: string | null;
  sicDescription: string | null;
  entityType: string | null;
  stateOfIncorporation: string | null;
  fiscalYearEnd: string | null;
  website: string | null;
  phone: string | null;
  /** Employer Identification Number. */
  ein: string | null;
  /**
   * Prior names with their date ranges. This is the alias history that makes
   * old filings and news resolvable to the current entity.
   */
  formerNames: FormerName[];
}

// -- Directory cache -----------------------------------------------------------

interface Directory {
  byCik: Map<string, CompanyEntity>;
  byTicker: Map<string, CompanyEntity>;
  all: CompanyEntity[];
}

interface CachedDirectory {
  directory: Directory;
  expiresAt: number;
}

let cached: CachedDirectory | null = null;
let inFlightBuild: Promise<Directory> | null = null;

/** Shape of `company_tickers_exchange.json`: a fields header plus rows. */
interface TickersExchangeFile {
  fields?: string[];
  data?: unknown[][];
}

/** Shape of `company_tickers.json`: a numeric-keyed map of CIK/ticker/title. */
interface TickerFileEntry {
  cik_str?: number;
  ticker?: string;
  title?: string;
}

export interface TickerAlias {
  cik: string;
  ticker: string;
  isCurrent: boolean;
  source: "sec-directory" | "separator-variant";
}

function buildDirectory(file: TickersExchangeFile): Directory {
  const byCik = new Map<string, CompanyEntity>();
  const byTicker = new Map<string, CompanyEntity>();
  const all: CompanyEntity[] = [];

  const fields = file.fields ?? [];
  const cikIndex = fields.indexOf("cik");
  const nameIndex = fields.indexOf("name");
  const tickerIndex = fields.indexOf("ticker");
  const exchangeIndex = fields.indexOf("exchange");

  // Read positions from the header rather than assuming column order, so a
  // reordering upstream does not silently scramble the directory.
  if (cikIndex === -1 || nameIndex === -1 || tickerIndex === -1) {
    throw new Error(
      `Unexpected company_tickers_exchange.json layout: [${fields.join(", ")}]`
    );
  }

  for (const row of file.data ?? []) {
    const rawCik = row[cikIndex];
    const rawTicker = row[tickerIndex];
    const rawName = row[nameIndex];

    if (rawCik === null || rawCik === undefined) {
      continue;
    }

    const ticker =
      typeof rawTicker === "string" ? rawTicker.trim().toUpperCase() : "";
    const name = typeof rawName === "string" ? rawName.trim() : "";

    if (!ticker || !name) {
      continue;
    }

    const exchangeValue = exchangeIndex === -1 ? null : row[exchangeIndex];

    const entity: CompanyEntity = {
      cik: padCik(String(rawCik)),
      ticker,
      name,
      exchange:
        typeof exchangeValue === "string" && exchangeValue.trim().length > 0
          ? exchangeValue.trim()
          : null,
    };

    addEntity(entity, byCik, byTicker, all);
  }

  return { byCik, byTicker, all };
}

function addEntity(
  entity: CompanyEntity,
  byCik: Map<string, CompanyEntity>,
  byTicker: Map<string, CompanyEntity>,
  all: CompanyEntity[]
): void {
  all.push(entity);

  // A CIK can list several tickers (share classes). Keep the first, which is
  // the primary listing in SEC's ordering.
  if (!byCik.has(entity.cik)) {
    byCik.set(entity.cik, entity);
  }

  if (!byTicker.has(entity.ticker)) {
    byTicker.set(entity.ticker, entity);
  }

  // Index separator variants (BRK.B / BRK-B) so either spelling resolves.
  for (const variant of separatorVariants(entity.ticker)) {
    if (!byTicker.has(variant)) {
      byTicker.set(variant, entity);
    }
  }
}

function mergeTickerFile(
  directory: Directory,
  file: Record<string, TickerFileEntry>
): void {
  for (const entry of Object.values(file)) {
    const ticker =
      typeof entry.ticker === "string" ? entry.ticker.trim().toUpperCase() : "";
    const name = typeof entry.title === "string" ? entry.title.trim() : "";

    if (!ticker || !name || entry.cik_str === undefined) {
      continue;
    }

    const cik = padCik(entry.cik_str);

    const existing = directory.byCik.get(cik);

    if (existing) {
      if (!directory.byTicker.has(ticker)) {
        directory.byTicker.set(ticker, existing);
      }

      continue;
    }

    if (directory.byTicker.has(ticker)) {
      continue;
    }

    addEntity(
      { cik, ticker, name, exchange: null },
      directory.byCik,
      directory.byTicker,
      directory.all
    );
  }
}

async function loadDirectory(): Promise<Directory> {
  const [exchangeFile, tickerFile] = await Promise.all([
    fetchCompanyTickersWithExchange<TickersExchangeFile>(),
    fetchCompanyTickers<Record<string, TickerFileEntry>>(),
  ]);

  if (!exchangeFile && !tickerFile) {
    throw new Error("SEC ticker directory was unavailable");
  }

  const directory = exchangeFile
    ? buildDirectory(exchangeFile)
    : { byCik: new Map(), byTicker: new Map(), all: [] };

  if (tickerFile) {
    mergeTickerFile(directory, tickerFile);
  }

  if (directory.all.length === 0) {
    throw new Error("SEC ticker directory came back empty");
  }

  return directory;
}

/**
 * Returns the ticker/CIK directory, building it on first use. Concurrent
 * callers share one build. On failure a previously built directory is served
 * stale rather than failing the request.
 */
export async function getCompanyDirectory(): Promise<Directory> {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.directory;
  }

  if (inFlightBuild) {
    return inFlightBuild;
  }

  const build = loadDirectory()
    .then((directory) => {
      cached = { directory, expiresAt: Date.now() + DIRECTORY_TTL_MS };
      inFlightBuild = null;

      return directory;
    })
    .catch((error: unknown) => {
      inFlightBuild = null;

      if (cached) {
        console.error(
          "SEC ticker directory rebuild failed; serving stale copy:",
          error
        );
        cached.expiresAt = Date.now() + FAILED_BUILD_TTL_MS;

        return cached.directory;
      }

      throw error;
    });

  inFlightBuild = build;

  return build;
}

// -- Resolution ----------------------------------------------------------------

/**
 * Share-class separators differ by source: SEC writes `BRK-B` (542 hyphenated
 * tickers in the directory against exactly one dotted), while Finnhub and our
 * own `normalizeSymbol` accept `BRK.B`. Resolution tries the input as given,
 * then swaps the separator, so a symbol from either source resolves.
 */
function separatorVariants(ticker: string): string[] {
  const base = ticker.trim().toUpperCase();
  const variants = [base];

  if (base.includes(".")) {
    variants.push(base.replaceAll(".", "-"));
  }

  if (base.includes("-")) {
    variants.push(base.replaceAll("-", "."));
  }

  return variants;
}

/**
 * Resolves a ticker to its SEC entity. Returns null when the ticker is not a
 * registrant, which is normal for ETFs, foreign listings, and OTC names.
 */
export async function resolveCik(ticker: string): Promise<CompanyEntity | null> {
  const directory = await getCompanyDirectory();

  for (const variant of separatorVariants(ticker)) {
    const match = directory.byTicker.get(variant);

    if (match) {
      return match;
    }
  }

  return null;
}

/** Reverse lookup, for records that arrive keyed on CIK. */
export async function resolveByCik(
  cik: string | number
): Promise<CompanyEntity | null> {
  const directory = await getCompanyDirectory();

  return directory.byCik.get(padCik(cik)) ?? null;
}

/** Every entity in the directory, for bulk seeding. */
export async function listCompanies(): Promise<CompanyEntity[]> {
  const { all } = await getCompanyDirectory();

  return all;
}

/**
 * Current tickers plus separator variants. Former tickers from submissions
 * are added later by `aliasesFromIdentity` once that document is fetched.
 */
export async function listTickerAliases(): Promise<TickerAlias[]> {
  const { byTicker } = await getCompanyDirectory();
  const aliases: TickerAlias[] = [];
  const seen = new Set<string>();

  for (const [ticker, company] of byTicker) {
    const key = `${company.cik}:${ticker}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    aliases.push({
      cik: company.cik,
      ticker,
      isCurrent: true,
      source: ticker === company.ticker ? "sec-directory" : "separator-variant",
    });
  }

  return aliases;
}

export function aliasesFromIdentity(
  identity: CompanyIdentity
): TickerAlias[] {
  const aliases: TickerAlias[] = [];
  const seen = new Set<string>();

  for (const raw of identity.tickers) {
    for (const variant of separatorVariants(raw)) {
      const key = `${identity.cik}:${variant}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      aliases.push({
        cik: identity.cik,
        ticker: variant,
        isCurrent: true,
        source: "sec-directory",
      });
    }
  }

  return aliases;
}

// -- Full identity -------------------------------------------------------------

/** Shape of the parts of `submissions/CIK…json` this module reads. */
interface SubmissionsIdentity {
  cik?: string | number;
  name?: string;
  tickers?: string[];
  exchanges?: string[];
  sic?: string;
  sicDescription?: string;
  entityType?: string;
  stateOfIncorporation?: string;
  fiscalYearEnd?: string;
  website?: string;
  phone?: string;
  ein?: string;
  formerNames?: { name?: string; from?: string; to?: string }[];
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

/**
 * Fetches a company's full SEC identity, including the former-name history.
 * Costs one paced EDGAR request. Returns null when the CIK is not a filer.
 */
export async function fetchCompanyIdentity(
  cik: string | number
): Promise<CompanyIdentity | null> {
  const raw = await fetchSubmissions<SubmissionsIdentity>(cik);

  if (!raw) {
    return null;
  }

  const formerNames: FormerName[] = [];

  for (const entry of raw.formerNames ?? []) {
    const name = text(entry?.name);

    if (name !== null) {
      formerNames.push({
        name,
        from: text(entry?.from),
        to: text(entry?.to),
      });
    }
  }

  return {
    cik: padCik(raw.cik ?? cik),
    name: text(raw.name) ?? "",
    tickers: (raw.tickers ?? []).filter(
      (ticker): ticker is string => typeof ticker === "string"
    ),
    exchanges: (raw.exchanges ?? []).filter(
      (exchange): exchange is string => typeof exchange === "string"
    ),
    sic: text(raw.sic),
    sicDescription: text(raw.sicDescription),
    entityType: text(raw.entityType),
    stateOfIncorporation: text(raw.stateOfIncorporation),
    fiscalYearEnd: text(raw.fiscalYearEnd),
    website: text(raw.website),
    phone: text(raw.phone),
    ein: text(raw.ein),
    formerNames,
  };
}
