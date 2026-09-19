/**
 * Server-only Twelve Data client.
 *
 * Mirrors the `lib/finnhub.ts` pattern: the API key, error translation, and
 * caching policy live in exactly one place. The key travels in the query
 * string, so URLs are never logged.
 *
 * Twelve Data returns HTTP 200 with `{ status: "error", code, message }` for
 * API-level errors (bad symbol, rate limit, etc.), so the response body must
 * be inspected even when the HTTP status is OK.
 */

const TWELVE_DATA_BASE_URL = "https://api.twelvedata.com";

export class TwelveDataError extends Error {
  readonly status: number;
  readonly publicMessage: string;

  constructor(status: number, publicMessage: string, detail?: string) {
    super(detail ?? publicMessage);
    this.name = "TwelveDataError";
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

interface TwelveDataFetchOptions {
  /** Seconds to cache the response, or `false` to bypass the data cache. */
  revalidate: number | false;
}

/** Shape of a Twelve Data error body (returned with HTTP 200). */
interface TwelveDataErrorBody {
  status?: string;
  code?: number;
  message?: string;
}

export async function twelveDataFetch<T>(
  endpoint: string,
  params: Record<string, string>,
  options: TwelveDataFetchOptions
): Promise<T> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;

  if (!apiKey) {
    console.error("TWELVE_DATA_API_KEY is not configured");
    throw new TwelveDataError(500, "Chart data is not configured");
  }

  const url = new URL(`${TWELVE_DATA_BASE_URL}${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set("apikey", apiKey);

  let response: Response;

  try {
    response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      ...(options.revalidate === false
        ? { cache: "no-store" as const }
        : { next: { revalidate: options.revalidate } }),
    });
  } catch (cause) {
    console.error(`Twelve Data request failed for ${endpoint}:`, cause);
    throw new TwelveDataError(502, "Could not reach the chart data provider");
  }

  if (response.status === 429) {
    console.error(`Twelve Data rate-limited for ${endpoint}`);
    throw new TwelveDataError(
      429,
      "Too many requests right now. Please try again in a moment."
    );
  }

  if (!response.ok) {
    console.error(`Twelve Data returned ${response.status} for ${endpoint}`);
    throw new TwelveDataError(502, "Chart data provider returned an error");
  }

  let body: unknown;

  try {
    body = await response.json();
  } catch (cause) {
    console.error(`Twelve Data returned unparseable JSON for ${endpoint}:`, cause);
    throw new TwelveDataError(502, "Malformed response from chart data provider");
  }

  // Twelve Data signals API errors in the body even when HTTP is 200.
  if (
    typeof body === "object" &&
    body !== null &&
    (body as TwelveDataErrorBody).status === "error"
  ) {
    const err = body as TwelveDataErrorBody;
    const code = err.code ?? 0;
    const message = err.message ?? "Unknown error";

    console.error(`Twelve Data API error ${code} for ${endpoint}: ${message}`);

    if (code === 429) {
      throw new TwelveDataError(
        429,
        "Too many requests right now. Please try again in a moment."
      );
    }

    throw new TwelveDataError(502, "Chart data provider returned an error");
  }

  return body as T;
}
