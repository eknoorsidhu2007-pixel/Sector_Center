import { NextResponse } from "next/server";

import { toApiError } from "@/lib/finnhub";
import { getSymbolIndex, searchCompanies } from "@/lib/symbols";
import type { ApiErrorResponse, SearchResponse } from "@/lib/types";

const MAX_QUERY_LENGTH = 40;
const RESULT_LIMIT = 8;

/**
 * Company/ticker autocomplete.
 *
 * Served from the in-memory US symbol index, so a keystroke costs no upstream
 * request. See `lib/symbols.ts` for why we do not proxy Finnhub's `/search`.
 */
export async function GET(
  request: Request
): Promise<NextResponse<SearchResponse | ApiErrorResponse>> {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";

  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json(
      { error: "Search query is too long" },
      { status: 400 }
    );
  }

  if (!query) {
    return NextResponse.json({ query: "", results: [] });
  }

  try {
    const index = await getSymbolIndex();
    const results = searchCompanies(index, query, RESULT_LIMIT);

    return NextResponse.json(
      { query, results },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
        },
      }
    );
  } catch (error) {
    const { status, message } = toApiError(error);

    return NextResponse.json({ error: message }, { status });
  }
}
