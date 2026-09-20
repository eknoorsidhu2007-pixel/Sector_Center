/**
 * Server-only SEC EDGAR client.
 *
 * EDGAR is a primary source: US government works carry no copyright, so unlike
 * our market-data vendors there is no display, storage, or redistribution
 * restriction. See LICENSING.md.
 *
 * What EDGAR does impose is technical, and both obligations are enforced here:
 *
 * 1. A maximum of 10 requests/second in aggregate across every `sec.gov`
 *    subdomain, regardless of how many machines are making them. The SEC
 *    blocks IPs that exceed it, so every request in this process funnels
 *    through one paced queue rather than being fired in parallel.
 * 2. A `User-Agent` identifying the requester with contact information. There
 *    is no sensible default for that, so a missing `SEC_USER_AGENT` is treated
 *    as a configuration error rather than papered over with a fake value.
 */

const DATA_BASE_URL = "https://data.sec.gov";
const WWW_BASE_URL = "https://www.sec.gov";
const FULL_TEXT_SEARCH_URL = "https://efts.sec.gov/LATEST/search-index";

/**
 * Minimum gap between requests. The documented ceiling is 10/second; pacing at
 * 125ms yields 8/second, which leaves headroom for clock skew and for any
 * concurrent request this queue does not know about.
 */
const MIN_REQUEST_INTERVAL_MS = 125;

const MAX_RETRIES = 2;
const RETRY_BASE_DELAY_MS = 1000;

export class SecError extends Error {
  readonly status: number;
  readonly publicMessage: string;

  constructor(status: number, publicMessage: string, detail?: string) {
    super(detail ?? publicMessage);
    this.name = "SecError";
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// -- Request pacing ------------------------------------------------------------

/**
 * Serializes every EDGAR request through one chain so concurrent callers
 * cannot burst past the fair-access limit. Each link waits until at least
 * MIN_REQUEST_INTERVAL_MS has elapsed since the previous request started.
 */
let queueTail: Promise<void> = Promise.resolve();
let lastRequestAt = 0;

function schedule<T>(task: () => Promise<T>): Promise<T> {
  const result = queueTail.then(async () => {
    const elapsed = Date.now() - lastRequestAt;

    if (elapsed < MIN_REQUEST_INTERVAL_MS) {
      await delay(MIN_REQUEST_INTERVAL_MS - elapsed);
    }

    lastRequestAt = Date.now();

    return task();
  });

  // Keep the chain alive regardless of individual failures, and do not retain
  // resolved values on the tail.
  queueTail = result.then(
    () => undefined,
    () => undefined
  );

  return result;
}

// -- Core fetch ----------------------------------------------------------------

function requireUserAgent(): string {
  const userAgent = process.env.SEC_USER_AGENT?.trim();

  if (!userAgent) {
    console.error(
      "SEC_USER_AGENT is not configured. EDGAR requires a User-Agent " +
        "identifying the requester with contact information, " +
        'for example "Sector Center contact@example.com".'
    );

    throw new SecError(500, "Filing data is not configured");
  }

  return userAgent;
}

interface SecFetchOptions {
  /** Seconds to cache the response, or `false` to bypass the data cache. */
  revalidate: number | false;
  /** Treat 404 as an empty result rather than an error. */
  allowNotFound?: boolean;
  accept?: string;
}

async function secRequest(
  url: string,
  options: SecFetchOptions
): Promise<Response | null> {
  const userAgent = requireUserAgent();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    const response = await schedule(() =>
      fetch(url, {
        headers: {
          "User-Agent": userAgent,
          Accept: options.accept ?? "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
        ...(options.revalidate === false
          ? { cache: "no-store" as const }
          : { next: { revalidate: options.revalidate } }),
      })
    ).catch((cause: unknown) => {
      console.error(`SEC request failed for ${url}:`, cause);
      throw new SecError(502, "Could not reach the SEC filing service");
    });

    if (response.ok) {
      return response;
    }

    if (response.status === 404 && options.allowNotFound) {
      return null;
    }

    // EDGAR answers rate-limit violations with 403 as well as 429.
    const retryable =
      response.status === 429 ||
      response.status === 503 ||
      response.status === 403;

    if (retryable && attempt < MAX_RETRIES) {
      const wait = RETRY_BASE_DELAY_MS * 2 ** attempt;

      console.warn(
        `SEC returned ${response.status}; retrying in ${wait}ms (attempt ${attempt + 1}/${MAX_RETRIES})`
      );

      await delay(wait);
      continue;
    }

    console.error(`SEC returned ${response.status} for ${url}`);

    if (response.status === 429 || response.status === 403) {
      throw new SecError(
        429,
        "The SEC is rate-limiting requests. Please try again shortly."
      );
    }

    if (response.status === 404) {
      throw new SecError(404, "No filing data found");
    }

    throw new SecError(502, "The SEC filing service returned an error");
  }

  throw new SecError(502, "The SEC filing service returned an error");
}

async function secFetch<T>(
  url: string,
  options: SecFetchOptions
): Promise<T | null> {
  const response = await secRequest(url, options);

  if (!response) {
    return null;
  }

  try {
    return (await response.json()) as T;
  } catch (cause) {
    console.error(`SEC returned unparseable JSON for ${url}:`, cause);
    throw new SecError(502, "Malformed response from the SEC");
  }
}

async function secFetchText(
  url: string,
  options: SecFetchOptions
): Promise<string | null> {
  const response = await secRequest(url, {
    ...options,
    accept: options.accept ?? "application/xml, text/xml, text/plain",
  });

  if (!response) {
    return null;
  }

  return response.text();
}

// -- Public helpers ------------------------------------------------------------

/** EDGAR identifies companies by a zero-padded 10-digit CIK. */
export function padCik(cik: string | number): string {
  return String(cik).replace(/\D/g, "").padStart(10, "0");
}

/** Archive paths drop the leading zeros that `padCik` adds. */
export function unpadCik(cik: string | number): string {
  return String(cik).replace(/\D/g, "").replace(/^0+/, "") || "0";
}

/** Accession numbers in archive URLs have the dashes stripped. */
export function accessionPath(accessionNumber: string): string {
  return accessionNumber.replace(/-/g, "");
}

/**
 * Filing history for one company. Returns null when the CIK is unknown rather
 * than throwing, so callers can treat it as "not a filer".
 */
export function fetchSubmissions<T>(
  cik: string | number,
  revalidateSeconds = 3_600
): Promise<T | null> {
  return secFetch<T>(
    `${DATA_BASE_URL}/submissions/CIK${padCik(cik)}.json`,
    { revalidate: revalidateSeconds, allowNotFound: true }
  );
}

/** Every XBRL concept a company has ever reported, in one document. */
export function fetchCompanyFacts<T>(
  cik: string | number,
  revalidateSeconds = 86_400
): Promise<T | null> {
  return secFetch<T>(
    `${DATA_BASE_URL}/api/xbrl/companyfacts/CIK${padCik(cik)}.json`,
    { revalidate: revalidateSeconds, allowNotFound: true }
  );
}

/**
 * One XBRL concept across every filer for a period, for cross-sectional
 * comparison. `period` is e.g. "CY2025Q4" for a duration or "CY2025Q4I" for an
 * instant.
 */
export function fetchFrame<T>(
  concept: string,
  unit: string,
  period: string,
  taxonomy = "us-gaap",
  revalidateSeconds = 86_400
): Promise<T | null> {
  return secFetch<T>(
    `${DATA_BASE_URL}/api/xbrl/frames/${taxonomy}/${concept}/${unit}/${period}.json`,
    { revalidate: revalidateSeconds, allowNotFound: true }
  );
}

/** The ticker-to-CIK directory. Small, and the seed for entity resolution. */
export function fetchCompanyTickers<T>(
  revalidateSeconds = 86_400
): Promise<T | null> {
  return secFetch<T>(`${WWW_BASE_URL}/files/company_tickers.json`, {
    revalidate: revalidateSeconds,
  });
}

/** Ticker-to-CIK plus the listing exchange. */
export function fetchCompanyTickersWithExchange<T>(
  revalidateSeconds = 86_400
): Promise<T | null> {
  return secFetch<T>(`${WWW_BASE_URL}/files/company_tickers_exchange.json`, {
    revalidate: revalidateSeconds,
  });
}

export interface FullTextSearchParams {
  /** Query string. Supports quoted phrases and boolean operators. */
  query: string;
  /** Comma-separated form types, e.g. "8-K,10-Q". */
  forms?: string;
  /** Zero-padded CIKs, comma separated. */
  ciks?: string;
  startDate?: string;
  endDate?: string;
  /** Result offset. `from + size` must not exceed 10,000. */
  from?: number;
}

/**
 * Full-text search across filing bodies and exhibits, 2001 onward. This is the
 * endpoint that makes contract, lawsuit, and executive-change discovery
 * possible, since those live in 8-K and exhibit text rather than in XBRL.
 */
export function searchFullText<T>(
  params: FullTextSearchParams,
  revalidateSeconds = 3_600
): Promise<T | null> {
  const url = new URL(FULL_TEXT_SEARCH_URL);

  url.searchParams.set("q", params.query);

  if (params.forms) {
    url.searchParams.set("forms", params.forms);
  }

  if (params.ciks) {
    url.searchParams.set("ciks", params.ciks);
  }

  if (params.startDate && params.endDate) {
    url.searchParams.set("dateRange", "custom");
    url.searchParams.set("startdt", params.startDate);
    url.searchParams.set("enddt", params.endDate);
  }

  if (params.from !== undefined) {
    url.searchParams.set("from", String(params.from));
  }

  return secFetch<T>(url.toString(), { revalidate: revalidateSeconds });
}

export function archiveDocumentUrl(
  cik: string | number,
  accessionNumber: string,
  filename: string
): string {
  return `${WWW_BASE_URL}/Archives/edgar/data/${unpadCik(cik)}/${accessionPath(accessionNumber)}/${filename}`;
}

interface ArchiveIndexItem {
  name?: string;
  type?: string;
}

interface ArchiveIndex {
  directory?: {
    item?: ArchiveIndexItem | ArchiveIndexItem[];
  };
}

function asIndexItems(item: ArchiveIndex["directory"]): ArchiveIndexItem[] {
  const raw = item?.item;

  if (!raw) {
    return [];
  }

  return Array.isArray(raw) ? raw : [raw];
}

/**
 * Lists files in one EDGAR accession. Used to find the raw Form 4 XML when
 * `primaryDocument` points at the XSL-rendered HTML view.
 */
export async function fetchArchiveIndex(
  cik: string | number,
  accessionNumber: string,
  revalidateSeconds = 86_400
): Promise<string[]> {
  const url = archiveDocumentUrl(cik, accessionNumber, "index.json");
  const index = await secFetch<ArchiveIndex>(url, {
    revalidate: revalidateSeconds,
    allowNotFound: true,
  });

  return asIndexItems(index?.directory)
    .map((entry) => entry.name?.trim() ?? "")
    .filter((name) => name.length > 0);
}

/** Raw text of one archived filing document (XML, HTML, or complete .txt). */
export function fetchArchiveDocument(
  cik: string | number,
  accessionNumber: string,
  filename: string,
  revalidateSeconds = 86_400
): Promise<string | null> {
  return secFetchText(archiveDocumentUrl(cik, accessionNumber, filename), {
    revalidate: revalidateSeconds,
    allowNotFound: true,
  });
}

/** Translates a thrown value into a status and browser-safe message. */
export function toResearchApiError(error: unknown): {
  status: number;
  message: string;
} {
  if (error instanceof SecError) {
    return { status: error.status, message: error.publicMessage };
  }

  console.error("Unexpected research error:", error);

  return { status: 500, message: "Something went wrong" };
}
