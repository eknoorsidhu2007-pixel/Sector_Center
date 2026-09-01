/**
 * Server-only Finnhub client.
 *
 * Every Finnhub call goes through `finnhubFetch` so the API key, error
 * translation, and caching policy live in exactly one place. The key is read
 * from the environment at call time and is never included in a log line,
 * because it travels in the query string.
 */

const FINNHUB_BASE_URL = "https://finnhub.io/api/v1";

/**
 * Carries a status and a message that is safe to return to the browser.
 * `message` may contain internal detail for server logs; `publicMessage` is
 * what the client is allowed to see.
 */
export class FinnhubError extends Error {
  readonly status: number;
  readonly publicMessage: string;

  constructor(status: number, publicMessage: string, detail?: string) {
    super(detail ?? publicMessage);
    this.name = "FinnhubError";
    this.status = status;
    this.publicMessage = publicMessage;
  }
}

interface FinnhubFetchOptions {
  /** Seconds to cache the response, or `false` to bypass the data cache. */
  revalidate: number | false;
}

export async function finnhubFetch<T>(
  endpoint: string,
  params: Record<string, string>,
  options: FinnhubFetchOptions
): Promise<T> {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (!apiKey) {
    console.error("FINNHUB_API_KEY is not configured");
    throw new FinnhubError(500, "Market data is not configured");
  }

  const url = new URL(`${FINNHUB_BASE_URL}${endpoint}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set("token", apiKey);

  let response: Response;

  try {
    response = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      ...(options.revalidate === false
        ? { cache: "no-store" as const }
        : { next: { revalidate: options.revalidate } }),
    });
  } catch (cause) {
    console.error(`Finnhub request failed for ${endpoint}:`, cause);
    throw new FinnhubError(502, "Could not reach the market data provider");
  }

  if (!response.ok) {
    console.error(`Finnhub returned ${response.status} for ${endpoint}`);

    if (response.status === 429) {
      throw new FinnhubError(
        429,
        "Too many requests right now. Please try again in a moment."
      );
    }

    if (response.status === 401 || response.status === 403) {
      throw new FinnhubError(502, "Market data provider rejected the request");
    }

    throw new FinnhubError(502, "Market data provider returned an error");
  }

  try {
    return (await response.json()) as T;
  } catch (cause) {
    console.error(`Finnhub returned unparseable JSON for ${endpoint}:`, cause);
    throw new FinnhubError(502, "Malformed response from market data provider");
  }
}

/**
 * Translates any thrown value into a status and browser-safe message.
 * Keeps route handlers from having to know about `FinnhubError`.
 */
export function toApiError(error: unknown): {
  status: number;
  message: string;
} {
  if (error instanceof FinnhubError) {
    return { status: error.status, message: error.publicMessage };
  }

  console.error("Unexpected error:", error);

  return { status: 500, message: "Something went wrong" };
}
